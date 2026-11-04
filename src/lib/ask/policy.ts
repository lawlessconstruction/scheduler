import { timingSafeEqual } from "node:crypto"

// Who is asking, taken from the workers table after the PIN (or a real
// Supabase auth token) has been checked. app_role "boss" is the only
// admin. Crew bosses stay on the same side as workers.

export type AskUser = {
  id: string
  name: string
  appRole: "boss" | "crew_boss" | "worker"
  crewId: string | null
}

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type HistoryResult =
  | { ok: true; messages: ChatTurn[] }
  | { ok: false; error: string }

const QUESTION_MAX = 500

export function toAskUser(row: {
  id: string
  name: string
  app_role: string | null
  crew_id: string | null
}): AskUser {
  const appRole = row.app_role === "boss" || row.app_role === "crew_boss" ? row.app_role : "worker"
  return { id: row.id, name: row.name, appRole, crewId: row.crew_id }
}

export function isBoss(user: AskUser): boolean {
  return user.appRole === "boss"
}

/** First name or full name. "Sam" matches "Sam Jones", not "Samantha". */
export function samePerson(fullName: string, query: string): boolean {
  const name = fullName.trim().toLowerCase()
  const q = query.trim().toLowerCase()
  if (!name || !q) return false
  return name === q || name.startsWith(`${q} `)
}

export type HoursTarget =
  | { kind: "self" }
  | { kind: "named"; name: string }
  | { kind: "company" }
  | { kind: "denied" }

export function hoursTarget(user: AskUser, person: string | undefined): HoursTarget {
  const name = person?.trim() ?? ""
  if (!isBoss(user)) {
    if (name && !samePerson(user.name, name)) return { kind: "denied" }
    return { kind: "self" }
  }
  if (!name) return { kind: "company" }
  return { kind: "named", name: name.slice(0, 80) }
}

export type ScheduleScope =
  | { kind: "own-crew" }
  | { kind: "no-crew" }
  | { kind: "person"; name: string }
  | { kind: "company" }

export function scheduleScope(user: AskUser, person: string | undefined): ScheduleScope {
  if (!isBoss(user)) {
    return user.crewId ? { kind: "own-crew" } : { kind: "no-crew" }
  }
  const name = person?.trim() ?? ""
  if (!name) return { kind: "company" }
  return { kind: "person", name: name.slice(0, 80) }
}

/** Strip LIKE wildcards, then wrap for a contains match. Null if too short. */
export function containsPattern(raw: string | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().slice(0, 80).replace(/[\\%_]/g, "")
  if (cleaned.length < 2) return null
  return `%${cleaned}%`
}

export function plainQuery(raw: string | undefined): string | null {
  const pattern = containsPattern(raw)
  if (!pattern) return null
  return pattern.slice(1, -1).toLowerCase()
}

/** Escape a full email so ilike is an exact, case-insensitive match. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

export function clip(value: string | null | undefined, max: number): string | null {
  if (value == null) return null
  const text = value.trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function pinsMatch(stored: string | null, given: string): boolean {
  if (stored == null || stored.length === 0 || stored.length > 8) return false
  if (given.length === 0 || given.length > 8) return false
  const a = Buffer.from(stored)
  const b = Buffer.from(given)
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

export function takeToken(
  bucket: Map<string, number[]>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): boolean {
  const recent = (bucket.get(key) ?? []).filter((at) => now - at < windowMs)
  if (recent.length >= limit) {
    bucket.set(key, recent)
    return false
  }
  recent.push(now)
  bucket.set(key, recent)
  return true
}

export function sanitizeHistory(raw: unknown): HistoryResult {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Type a question." }
  const turns: ChatTurn[] = []
  for (const item of raw.slice(-20)) {
    if (!item || typeof item !== "object") continue
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue
    const text = content.trim()
    if (!text) continue
    turns.push({ role, content: text })
  }
  const last = turns[turns.length - 1]
  if (!last || last.role !== "user") return { ok: false, error: "Type a question." }
  if (last.content.length > QUESTION_MAX) return { ok: false, error: "Ask a shorter question." }

  const merged: ChatTurn[] = []
  for (const turn of turns.slice(0, -1)) {
    const clipped = { role: turn.role, content: turn.content.slice(0, 800) }
    const prev = merged[merged.length - 1]
    if (prev && prev.role === clipped.role) {
      prev.content = `${prev.content}\n${clipped.content}`.slice(0, 800)
    } else {
      merged.push(clipped)
    }
  }
  merged.push({ role: "user", content: last.content })

  let messages = merged.slice(-8)
  if (messages[0]?.role === "assistant") messages = messages.slice(1)
  if (messages[0]?.role !== "user") return { ok: false, error: "Type a question." }
  return { ok: true, messages }
}
