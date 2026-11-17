import type { SupabaseClient } from "@supabase/supabase-js"
import { WORKER_AUTH_COLUMNS } from "../ask/columns"
import { escapeLike, pinsMatch, toAskUser } from "../ask/policy"
import { canRaiseInvoice, canReviewInvoices } from "./roles"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Actor = {
  id: string
  name: string
  appRole: "boss" | "crew_boss" | "worker"
}

export type ActorFailure = { error: string; status: number }

export async function readActor(
  db: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Actor | ActorFailure> {
  const workerId = typeof body.workerId === "string" ? body.workerId.trim() : ""
  const pin = typeof body.pin === "string" ? body.pin : ""
  if (!UUID.test(workerId) || !pin) return { error: "Sign in again, then try.", status: 401 }

  const found = await db.from("workers").select(WORKER_AUTH_COLUMNS).eq("id", workerId).maybeSingle()
  if (found.error || !found.data) return { error: "Sign in again, then try.", status: 401 }
  const row = found.data as { id: string; name: string; app_role: string | null; crew_id: string | null; pin: string | null }
  if (!pinsMatch(row.pin, pin)) return { error: "That PIN doesn't match. Try again.", status: 401 }
  const user = toAskUser(row)
  return { id: user.id, name: user.name, appRole: user.appRole }
}

export function isFailure(result: Actor | ActorFailure): result is ActorFailure {
  return "error" in result
}

export function assertCanRaise(actor: Actor): ActorFailure | null {
  if (canRaiseInvoice(actor.appRole)) return null
  return { error: "Only a crew lead or an office boss can raise an invoice.", status: 403 }
}

export function assertCanReview(actor: Actor): ActorFailure | null {
  if (canReviewInvoices(actor.appRole)) return null
  return { error: "The invoice list is for the office.", status: 403 }
}

export function likeExact(value: string): string {
  return escapeLike(value.trim())
}
