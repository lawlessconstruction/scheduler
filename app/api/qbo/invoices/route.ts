import { NextRequest, NextResponse } from "next/server"
import { assertCanReview, isFailure, readActor } from "../../../../src/lib/qbo/access"
import { listOf, qboQuery, QboApiError } from "../../../../src/lib/qbo/api"
import { schemaHint, serviceClient } from "../../../../src/lib/qbo/db"
import { asMoney } from "../../../../src/lib/qbo/money"
import { qboId } from "../../../../src/lib/qbo/payload"
import { qboConfigured, QboAuthError } from "../../../../src/lib/qbo/tokens"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

function json(body: Record<string, unknown>, status = 200) {
  if (typeof body.error === "string") {
    const hint = schemaHint(body.error)
    if (hint) body = { ...body, error: hint }
  }
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
}

type MilestoneInvoice = {
  id: string
  name: string | null
  amount: number | string | null
  invoice_number: string | null
  qbo_invoice_id: string | null
  invoice_sent_at: string | null
  invoiced_by_name: string | null
  projects: { name?: string | null; client?: string | null } | { name?: string | null; client?: string | null }[] | null
}

function projectOf(row: MilestoneInvoice): { name: string; client: string | null } {
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
  return {
    name: project?.name?.trim() || "Job",
    client: project?.client?.trim() || null,
  }
}

function emailedFlag(status: unknown): boolean | null {
  if (status === "EmailSent") return true
  if (status === "NotSet" || status === "NeedToSend") return false
  return null
}

function paidFlag(balance: unknown): boolean | null {
  const amount = asMoney(balance)
  if (amount == null) return null
  return amount === 0
}

export async function POST(req: NextRequest) {
  const db = serviceClient()
  if (!db) return json({ error: "Invoices can't be loaded right now." }, 500)

  let body: Record<string, unknown>
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad")
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: "That didn't come through. Try again." }, 400)
  }

  const actor = await readActor(db, body)
  if (isFailure(actor)) return json({ error: actor.error }, actor.status)
  const denied = assertCanReview(actor)
  if (denied) return json({ error: denied.error }, denied.status)

  const loaded = await db
    .from("milestones")
    .select("id, name, amount, invoice_number, qbo_invoice_id, invoice_sent_at, invoiced_by_name, projects(name, client)")
    .not("qbo_invoice_id", "is", null)
    .order("invoice_sent_at", { ascending: false })
    .limit(200)
  if (loaded.error) return json({ error: loaded.error.message }, 500)

  const rows = (loaded.data ?? []) as MilestoneInvoice[]
  const qbo = new Map<string, { emailed: boolean | null; paid: boolean | null; balance: number | null }>()
  let qboError = ""
  if (qboConfigured() && rows.length > 0) {
    try {
      const ids = rows.map((row) => qboId(row.qbo_invoice_id)).filter((id): id is string => id != null)
      for (let i = 0; i < ids.length; i += 15) {
        const chunk = ids.slice(i, i + 15)
        const query = `select Id, Balance, EmailStatus from Invoice where ${chunk.map((id) => `Id = '${id}'`).join(" or ")}`
        const response = await qboQuery(query)
        for (const invoice of listOf<{ Id?: unknown; Balance?: unknown; EmailStatus?: unknown }>(response.Invoice)) {
          const id = qboId(invoice.Id)
          if (!id) continue
          qbo.set(id, {
            emailed: emailedFlag(invoice.EmailStatus),
            paid: paidFlag(invoice.Balance),
            balance: asMoney(invoice.Balance),
          })
        }
      }
    } catch (err) {
      qboError = err instanceof QboAuthError || err instanceof QboApiError ? err.message : "QuickBooks status couldn't be checked."
    }
  } else if (!qboConfigured()) {
    qboError = "QuickBooks isn't set up, so sent and paid status couldn't be checked."
  }

  const invoices = rows.map((row) => {
    const project = projectOf(row)
    const id = qboId(row.qbo_invoice_id)
    const live = id ? qbo.get(id) : undefined
    return {
      milestoneId: row.id,
      job: project.name,
      client: project.client,
      stage: row.name?.trim() || "Stage",
      amountExGst: asMoney(row.amount),
      docNumber: row.invoice_number,
      raisedBy: row.invoiced_by_name,
      sentAt: row.invoice_sent_at,
      emailed: live?.emailed ?? null,
      paid: live?.paid ?? null,
      balance: live?.balance ?? null,
    }
  })

  return json({ invoices, ...(qboError ? { qboError } : {}) })
}
