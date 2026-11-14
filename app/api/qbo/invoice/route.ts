import { NextRequest, NextResponse } from "next/server"
import { exGstFromQbo } from "../../../../src/lib/milestone-billing"
import { assertCanRaise, isFailure, readActor } from "../../../../src/lib/qbo/access"
import { listOf, qboQuery, QboApiError } from "../../../../src/lib/qbo/api"
import { schemaHint, serviceClient } from "../../../../src/lib/qbo/db"
import { qboQuote } from "../../../../src/lib/qbo/payload"
import { raiseInvoice } from "../../../../src/lib/qbo/raise"
import { qboConfigured, QboAuthError } from "../../../../src/lib/qbo/tokens"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const DOC_NUMBER = /^[A-Za-z0-9][A-Za-z0-9. /_-]{0,20}$/

function json(body: Record<string, unknown>, status = 200) {
  if (typeof body.error === "string") {
    const hint = schemaHint(body.error)
    if (hint) body = { ...body, error: hint }
  }
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
  const number = new URL(req.url).searchParams.get("number")?.trim() ?? ""
  if (!number) return json({ configured: qboConfigured() })
  if (!qboConfigured()) return json({ error: "QuickBooks lookup is not set up." }, 404)
  if (!DOC_NUMBER.test(number)) return json({ error: "That doesn't look like an invoice number." }, 400)

  try {
    const response = await qboQuery(`select * from Invoice where DocNumber = '${qboQuote(number)}'`)
    const exact = listOf<{ DocNumber?: string; TxnDate?: string; TotalAmt?: number; TxnTaxDetail?: { TotalTax?: number } }>(response.Invoice)
      .filter((inv) => String(inv.DocNumber ?? "") === number)
    if (exact.length === 0) return json({ error: `No QuickBooks invoice numbered ${number}.` }, 404)

    const inv = [...exact].sort((a, b) => String(b.TxnDate ?? "").localeCompare(String(a.TxnDate ?? "")))[0]
    const totalTax = inv.TxnTaxDetail?.TotalTax == null ? 0 : Number(inv.TxnTaxDetail.TotalTax)
    const amountExGst = exGstFromQbo(inv.TotalAmt, totalTax)
    if (amountExGst == null) return json({ error: "QuickBooks returned an invoice without a usable total." }, 502)
    const txnDate = typeof inv.TxnDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(inv.TxnDate) ? inv.TxnDate.slice(0, 10) : null
    return json({
      docNumber: number,
      txnDate,
      totalAmt: round2(Number(inv.TotalAmt)),
      totalTax: round2(totalTax),
      amountExGst,
    })
  } catch (err) {
    const message = err instanceof QboAuthError || err instanceof QboApiError
      ? err.message
      : "QuickBooks lookup failed."
    return json({ error: message }, 502)
  }
}

export async function POST(req: NextRequest) {
  if (!qboConfigured()) return json({ error: "QuickBooks isn't set up. Add QBO_CLIENT_ID and QBO_CLIENT_SECRET." }, 500)
  const db = serviceClient()
  if (!db) return json({ error: "Invoices can't be raised right now." }, 500)

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
  const denied = assertCanRaise(actor)
  if (denied) return json({ error: denied.error }, denied.status)

  const result = await raiseInvoice(db, actor, body)
  return json(result.body, result.status)
}
