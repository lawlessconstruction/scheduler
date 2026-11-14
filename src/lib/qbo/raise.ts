import type { SupabaseClient } from "@supabase/supabase-js"
import { amountCanBeInvoiced } from "../milestone-billing"
import { melbourneToday } from "../ask/dates"
import { customerEmail, listOf, qboGet, qboPost, qboQuery, qboSendInvoice, QboApiError } from "./api"
import { QboAuthError } from "./tokens"
import { likeExact, type Actor } from "./access"
import { asMoney, round2 } from "./money"
import {
  claimOrFilter,
  cleanLines,
  cleanNote,
  invoiceBody,
  pickGstTaxCodeId,
  pickServiceItem,
  qboId,
  qboQuote,
  stageLineDescription,
  type InvoiceLine,
} from "./payload"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ProjectRow = {
  id: string
  name: string | null
  client: string | null
  client_id: string | null
  quote_number: string | null
  quoted: boolean | null
}

type ClientRow = { id: string; name: string | null; qbo_customer_id: string | null }

type MilestoneRow = {
  id: string
  project_id: string | null
  name: string | null
  amount: number | string | null
  status: string | null
  invoice_number: string | null
  qbo_invoice_id: string | null
  invoice_sent_at: string | null
  invoiced_by: string | null
  invoiced_by_name: string | null
}

export type RaiseResult = {
  status: number
  body: Record<string, unknown>
}

let cachedItem: { value: string; name: string } | null = null
let cachedTax: string | null = null

async function serviceItem(): Promise<{ value: string; name: string }> {
  if (cachedItem) return cachedItem
  const response = await qboQuery("select Id, Name, Type, Active from Item where Type = 'Service' and Active = true maxresults 50")
  const item = pickServiceItem(listOf(response.Item))
  if (!item) throw new QboApiError("QuickBooks has no service item to put on the invoice. Add one named Services, then try again.", 500)
  cachedItem = item
  return item
}

async function gstTaxCode(): Promise<string> {
  if (cachedTax) return cachedTax
  const response = await qboQuery("select * from TaxCode where Active = true maxresults 200")
  const id = pickGstTaxCodeId(listOf(response.TaxCode))
  if (!id) throw new QboApiError("QuickBooks has no GST tax code, so the invoice was not created.", 500)
  cachedTax = id
  return id
}

async function resolveClient(db: SupabaseClient, project: ProjectRow): Promise<ClientRow | null | { error: string }> {
  if (project.client_id) {
    const found = await db.from("clients").select("id, name, qbo_customer_id").eq("id", project.client_id).maybeSingle()
    if (found.error) return { error: found.error.message }
    return (found.data as ClientRow | null) ?? null
  }
  const name = project.client?.trim() ?? ""
  if (!name) return null
  const found = await db.from("clients").select("id, name, qbo_customer_id").ilike("name", likeExact(name))
  if (found.error) return { error: found.error.message }
  const rows = (found.data ?? []) as ClientRow[]
  if (rows.length > 1) return { error: `More than one builder is named ${name}. Set the builder on the job, then try again.` }
  return rows[0] ?? null
}

function customerRecord(json: Record<string, unknown>): Record<string, unknown> | null {
  const customer = json.Customer
  if (!customer || typeof customer !== "object") return null
  return customer as Record<string, unknown>
}

async function loadCustomer(customerId: string): Promise<{ email: string; name: string } | { error: string; status: number }> {
  const json = await qboGet(`customer/${encodeURIComponent(customerId)}`)
  const customer = customerRecord(json)
  if (!customer || customer.Active === false) {
    return { error: "That QuickBooks customer could not be found.", status: 404 }
  }
  const email = customerEmail(customer)
  if (!email || !email.includes("@")) {
    return {
      error: "This builder has no email address in QuickBooks, so the invoice was not created and nothing was sent. Add their email on the customer in QuickBooks, then try again.",
      status: 400,
    }
  }
  const name = typeof customer.DisplayName === "string" ? customer.DisplayName : ""
  return { email, name }
}

async function releaseClaim(db: SupabaseClient, milestoneId: string, claim: string) {
  await db
    .from("milestones")
    .update({ invoice_claim: null, invoice_claim_at: null })
    .eq("id", milestoneId)
    .eq("invoice_claim", claim)
    .eq("status", "pending")
    .is("qbo_invoice_id", null)
}

export async function raiseInvoice(
  db: SupabaseClient,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<RaiseResult> {
  const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId.trim() : ""
  if (!UUID.test(milestoneId)) return { status: 400, body: { error: "Pick a stage." } }

  const note = cleanNote(body.note)
  const extra = cleanLines(body.lines)
  if ("error" in extra) return { status: 400, body: { error: extra.error } }

  const loaded = await db
    .from("milestones")
    .select("id, project_id, name, amount, status, invoice_number, qbo_invoice_id, invoice_sent_at, invoiced_by, invoiced_by_name")
    .eq("id", milestoneId)
    .maybeSingle()
  if (loaded.error) return { status: 500, body: { error: loaded.error.message } }
  const milestone = loaded.data as MilestoneRow | null
  if (!milestone?.project_id) return { status: 404, body: { error: "That stage is not on a job." } }

  if (milestone.qbo_invoice_id || milestone.status === "invoiced" || milestone.status === "paid") {
    if (milestone.qbo_invoice_id && milestone.status === "pending") {
      await db
        .from("milestones")
        .update({
          status: "invoiced",
          invoiced_by: milestone.invoiced_by ?? actor.id,
          invoiced_by_name: milestone.invoiced_by_name ?? actor.name,
        })
        .eq("id", milestone.id)
        .eq("status", "pending")
        .eq("qbo_invoice_id", milestone.qbo_invoice_id)
      await db
        .from("milestones")
        .update({ invoice_claim: null, invoice_claim_at: null })
        .eq("id", milestone.id)
        .eq("qbo_invoice_id", milestone.qbo_invoice_id)
    }
    const number = milestone.invoice_number ? ` ${milestone.invoice_number}` : ""
    const emailed = milestone.invoice_sent_at ? "" : " It may not have been emailed — check QuickBooks before sending it again."
    return {
      status: 409,
      body: {
        error: `This stage already has QuickBooks invoice${number}. It was not created again.${emailed}`,
        invoiceId: milestone.qbo_invoice_id,
        docNumber: milestone.invoice_number,
      },
    }
  }

  if ((milestone.status ?? "pending") !== "pending") {
    return { status: 409, body: { error: "Only a pending stage can be invoiced." } }
  }
  if (!amountCanBeInvoiced(milestone.amount)) {
    return { status: 400, body: { error: "Set an amount greater than $0 before raising an invoice." } }
  }

  const projectRes = await db
    .from("projects")
    .select("id, name, client, client_id, quote_number, quoted")
    .eq("id", milestone.project_id)
    .maybeSingle()
  if (projectRes.error || !projectRes.data) return { status: 404, body: { error: "That job could not be found." } }
  const project = projectRes.data as ProjectRow
  if (project.quoted) return { status: 400, body: { error: "Win the quote before invoicing it." } }

  const client = await resolveClient(db, project)
  if (client && "error" in client) return { status: 400, body: { error: client.error } }
  if (!client) return { status: 400, body: { error: "Link a builder to this job before raising an invoice." } }
  const customerId = qboId(client.qbo_customer_id)
  if (!customerId) {
    return { status: 400, body: { error: "Match this builder to a QuickBooks customer first.", needsCustomer: true } }
  }

  const customer = await loadCustomer(customerId)
  if ("error" in customer) return { status: customer.status, body: { error: customer.error } }

  const stageAmount = asMoney(milestone.amount)
  if (stageAmount == null || stageAmount <= 0) {
    return { status: 400, body: { error: "Set an amount greater than $0 before raising an invoice." } }
  }
  const lines: InvoiceLine[] = [
    {
      description: stageLineDescription(project.name ?? "Job", milestone.name ?? "Stage", project.quote_number),
      amountExGst: stageAmount,
    },
    ...extra,
  ]
  const exGst = round2(lines.reduce((sum, line) => sum + line.amountExGst, 0))
  if (exGst <= 0) return { status: 400, body: { error: "The invoice total has to be more than $0." } }

  const claim = crypto.randomUUID()
  const claimed = await db
    .from("milestones")
    .update({ invoice_claim: claim, invoice_claim_at: new Date().toISOString() })
    .eq("id", milestone.id)
    .eq("status", "pending")
    .is("qbo_invoice_id", null)
    .or(claimOrFilter(Date.now()))
    .select("id")
  if (claimed.error) return { status: 500, body: { error: claimed.error.message } }
  if (!claimed.data || claimed.data.length === 0) {
    return { status: 409, body: { error: "Someone else is already raising this invoice. It was not created again." } }
  }

  let sentToQuickBooks = false
  try {
    let already: { Id?: unknown; DocNumber?: unknown; TxnDate?: unknown; EmailStatus?: unknown } | undefined
    try {
      const existing = await qboQuery(
        `select Id, DocNumber, TxnDate, EmailStatus from Invoice where PrivateNote like '%${qboQuote(milestone.id)}%' maxresults 5`,
      )
      already = listOf<{ Id?: unknown; DocNumber?: unknown; TxnDate?: unknown; EmailStatus?: unknown }>(existing.Invoice)
        .find((row) => qboId(row.Id))
    } catch {
      already = undefined
    }
    if (already && qboId(already.Id)) {
      return await finishExisting(db, actor, milestone.id, claim, {
        invoiceId: qboId(already.Id)!,
        docNumber: typeof already.DocNumber === "string" ? already.DocNumber.trim() : "",
        txnDate: typeof already.TxnDate === "string" ? already.TxnDate.slice(0, 10) : melbourneToday(),
        emailStatus: already.EmailStatus,
      })
    }

    const [item, taxCodeId] = await Promise.all([serviceItem(), gstTaxCode()])
    sentToQuickBooks = true
    const created = await qboPost(`invoice?requestid=${encodeURIComponent(claim)}`, invoiceBody({
      customerId,
      email: customer.email,
      txnDate: melbourneToday(),
      lines,
      note,
      privateNote: `Raised in Scheduler by ${actor.name} for stage ${milestone.id}`,
      item,
      taxCodeId,
    }))
    const invoice = created.Invoice
    const record = invoice && typeof invoice === "object" ? invoice as { Id?: unknown; DocNumber?: unknown; TxnDate?: unknown } : null
    const invoiceId = qboId(record?.Id)
    const docNumber = typeof record?.DocNumber === "string" ? record.DocNumber.trim() : ""
    if (!invoiceId) {
      return {
        status: 502,
        body: { error: "QuickBooks did not return an invoice id. Check QuickBooks before trying again — do not raise it a second time until you have looked." },
      }
    }

    return await finishExisting(db, actor, milestone.id, claim, {
      invoiceId,
      docNumber,
      txnDate: typeof record?.TxnDate === "string" ? record.TxnDate.slice(0, 10) : melbourneToday(),
      emailStatus: null,
    })
  } catch (err) {
    if (!sentToQuickBooks) await releaseClaim(db, milestone.id, claim)
    const message = err instanceof Error ? err.message : "QuickBooks could not create the invoice."
    const status = err instanceof QboApiError || err instanceof QboAuthError ? err.status : 502
    const held = sentToQuickBooks
      ? " If QuickBooks already has it, wait a minute and open this stage again. Scheduler will use that invoice instead of creating another."
      : ""
    return { status, body: { error: `${message}${held}` } }
  }
}

async function finishExisting(
  db: SupabaseClient,
  actor: Actor,
  milestoneId: string,
  claim: string,
  invoice: { invoiceId: string; docNumber: string; txnDate: string; emailStatus: unknown },
): Promise<RaiseResult> {
  const saved = await db
    .from("milestones")
    .update({
      qbo_invoice_id: invoice.invoiceId,
      invoice_number: invoice.docNumber || null,
      invoice_date: invoice.txnDate,
    })
    .eq("id", milestoneId)
    .eq("invoice_claim", claim)
    .eq("status", "pending")
    .is("qbo_invoice_id", null)
    .select("id")
  if (saved.error || !saved.data || saved.data.length === 0) {
    return {
      status: 500,
      body: {
        error: `QuickBooks invoice ${invoice.docNumber || invoice.invoiceId} exists, but Scheduler could not save it. Do not raise it again.`,
        invoiceId: invoice.invoiceId,
        docNumber: invoice.docNumber || null,
      },
    }
  }

  let emailed = invoice.emailStatus === "EmailSent"
  let sentAt: string | null = emailed ? new Date().toISOString() : null
  let sendError = ""
  if (!emailed) {
    try {
      const sent = await qboSendInvoice(invoice.invoiceId)
      const sentInvoice = sent.Invoice
      const emailStatus = sentInvoice && typeof sentInvoice === "object"
        ? (sentInvoice as { EmailStatus?: unknown }).EmailStatus
        : null
      emailed = emailStatus === "EmailSent"
      if (emailed) sentAt = new Date().toISOString()
      else sendError = "QuickBooks created the invoice but did not confirm the email was sent."
    } catch (err) {
      sendError = err instanceof Error ? err.message : "QuickBooks created the invoice but could not email it."
    }
  }

  const finished = await db
    .from("milestones")
    .update({
      status: "invoiced",
      invoice_sent_at: sentAt,
      invoiced_by: actor.id,
      invoiced_by_name: actor.name,
      invoice_claim: null,
      invoice_claim_at: null,
    })
    .eq("id", milestoneId)
    .eq("invoice_claim", claim)
    .eq("qbo_invoice_id", invoice.invoiceId)
    .select("id")
  if (finished.error || !finished.data || finished.data.length === 0) {
    return {
      status: 500,
      body: {
        error: `QuickBooks invoice ${invoice.docNumber || invoice.invoiceId} exists, but the stage could not be marked invoiced. It was not created again.`,
        invoiceId: invoice.invoiceId,
        docNumber: invoice.docNumber || null,
        emailed,
      },
    }
  }

  if (!emailed) {
    return {
      status: 502,
      body: {
        error: `${sendError} Invoice ${invoice.docNumber || invoice.invoiceId} is in QuickBooks. The stage is marked invoiced so it is not raised twice. Send the email from QuickBooks.`,
        invoiceId: invoice.invoiceId,
        docNumber: invoice.docNumber || null,
        emailed: false,
        sentAt: null,
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      invoiceId: invoice.invoiceId,
      docNumber: invoice.docNumber || null,
      emailed: true,
      sentAt,
    },
  }
}
