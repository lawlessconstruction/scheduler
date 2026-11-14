import { NextRequest, NextResponse } from "next/server"
import { assertCanRaise, isFailure, readActor } from "../../../../src/lib/qbo/access"
import { customerEmail, listOf, qboGet, qboQuery, QboApiError, searchCustomersQuery } from "../../../../src/lib/qbo/api"
import { schemaHint, serviceClient } from "../../../../src/lib/qbo/db"
import { qboId } from "../../../../src/lib/qbo/payload"
import { qboConfigured, QboAuthError } from "../../../../src/lib/qbo/tokens"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: Record<string, unknown>, status = 200) {
  if (typeof body.error === "string") {
    const hint = schemaHint(body.error)
    if (hint) body = { ...body, error: hint }
  }
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
}

type CustomerHit = { id: string; displayName: string; companyName: string | null; email: string }

function present(row: Record<string, unknown>): CustomerHit | null {
  const id = qboId(row.Id)
  if (!id) return null
  const displayName = typeof row.DisplayName === "string" ? row.DisplayName.trim() : ""
  if (!displayName) return null
  const company = typeof row.CompanyName === "string" ? row.CompanyName.trim() : ""
  return { id, displayName, companyName: company || null, email: customerEmail(row) }
}

export async function POST(req: NextRequest) {
  if (!qboConfigured()) return json({ error: "QuickBooks isn't set up." }, 500)
  const db = serviceClient()
  if (!db) return json({ error: "QuickBooks customers can't be loaded right now." }, 500)

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

  const action = body.action
  try {
    if (action === "search") {
      const query = typeof body.query === "string" ? searchCustomersQuery(body.query) : null
      if (!query) return json({ error: "Type at least two letters of the builder's name." }, 400)
      const response = await qboQuery(query)
      const customers = listOf<Record<string, unknown>>(response.Customer).map(present).filter((row): row is CustomerHit => row != null)
      return json({ customers })
    }

    if (action === "status" || action === "link") {
      const clientId = typeof body.clientId === "string" ? body.clientId.trim() : ""
      if (!UUID.test(clientId)) return json({ error: "Pick a builder." }, 400)
      const client = await db.from("clients").select("id, name, qbo_customer_id").eq("id", clientId).maybeSingle()
      if (client.error || !client.data) return json({ error: "That builder could not be found." }, 404)

      let customerId = qboId(client.data.qbo_customer_id)
      if (action === "link") {
        const nextId = qboId(body.qboCustomerId)
        if (!nextId) return json({ error: "Pick a QuickBooks customer." }, 400)
        if (customerId && customerId !== nextId) {
          return json({ error: "This builder is already linked to a QuickBooks customer." }, 409)
        }
        const chosen = await qboGet(`customer/${encodeURIComponent(nextId)}`)
        const chosenCustomer = chosen.Customer
        if (!chosenCustomer || typeof chosenCustomer !== "object") return json({ error: "That QuickBooks customer could not be found." }, 404)
        const chosenPresented = present(chosenCustomer as Record<string, unknown>)
        if (!chosenPresented) return json({ error: "That QuickBooks customer could not be found." }, 404)
        if (!chosenPresented.email.includes("@")) {
          return json({ error: "This builder has no email address in QuickBooks, so the invoice was not created and nothing was sent. Add their email on the customer in QuickBooks, then try again." }, 400)
        }
        if (!customerId) {
          const saved = await db
            .from("clients")
            .update({ qbo_customer_id: nextId })
            .eq("id", clientId)
            .is("qbo_customer_id", null)
            .select("id, qbo_customer_id")
          if (saved.error) return json({ error: saved.error.message }, 500)
          if (!saved.data || saved.data.length === 0) {
            const again = await db.from("clients").select("qbo_customer_id").eq("id", clientId).maybeSingle()
            customerId = qboId(again.data?.qbo_customer_id)
            if (customerId !== nextId) return json({ error: "This builder is already linked to a QuickBooks customer." }, 409)
          }
        }
        return json({
          qboCustomerId: chosenPresented.id,
          displayName: chosenPresented.displayName,
          email: chosenPresented.email,
        })
      }

      if (!customerId) return json({ qboCustomerId: null, email: "", displayName: "" })
      const remote = await qboGet(`customer/${encodeURIComponent(customerId)}`)
      const customer = remote.Customer
      if (!customer || typeof customer !== "object") return json({ error: "That QuickBooks customer could not be found." }, 404)
      const presented = present(customer as Record<string, unknown>)
      if (!presented) return json({ error: "That QuickBooks customer could not be found." }, 404)
      return json({
        qboCustomerId: presented.id,
        displayName: presented.displayName,
        email: presented.email,
      })
    }

    return json({ error: "That action isn't available." }, 400)
  } catch (err) {
    const message = err instanceof QboAuthError || err instanceof QboApiError ? err.message : "QuickBooks customers could not be loaded."
    const status = err instanceof QboAuthError || err instanceof QboApiError ? err.status : 502
    return json({ error: message }, status)
  }
}
