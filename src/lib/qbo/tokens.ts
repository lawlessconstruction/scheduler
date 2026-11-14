import type { SupabaseClient } from "@supabase/supabase-js"
import { serviceClient } from "./db"
import { QBO_REALM_ID, QBO_TOKEN_ROW_ID } from "./payload"

// Single source of truth for the Woodcode Pty Ltd QuickBooks connection.
//
// Table public.qbo_tokens, one row, id = "woodcode":
//   id                 text  primary key, always "woodcode"
//   realm_id           text  "9130357573413016"
//   access_token       text  nullable until the first refresh
//   refresh_token      text  Intuit rotates this on every refresh
//   access_expires_at  timestamptz
//   updated_at         timestamptz
//   locked_until       timestamptz  null when nobody is refreshing
//   lock_token         uuid         who holds the refresh lock
//
// Scheduler and Anthony's assistant both read and write this row with the
// service role key. After every successful refresh, write the new
// refresh_token back with a conditional update that still matches the
// refresh_token you just used and the lock_token you hold. A second copy
// in an env var is only a one-time seed when the row does not exist yet.
// Never send these tokens to the browser.

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
const LOCK_MS = 45_000
const FRESH_MS = 60_000
const WAIT_TRIES = 8

type TokenRow = {
  id: string
  realm_id: string
  access_token: string | null
  refresh_token: string
  access_expires_at: string | null
  locked_until: string | null
  lock_token: string | null
}

type Refreshed = { accessToken: string; refreshToken: string; expiresAt: string }

export class QboAuthError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = "QboAuthError"
    this.status = status
  }
}

type Memory = { token: string; expiresAt: number }
let memory: Memory | null = null
let inflight: Promise<string> | null = null

function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.QBO_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.QBO_CLIENT_SECRET?.trim() ?? ""
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function qboConfigured(): boolean {
  return credentials() != null
}

function fresh(row: TokenRow | null, now = Date.now()): boolean {
  if (!row?.access_token || !row.access_expires_at) return false
  const expires = Date.parse(row.access_expires_at)
  return Number.isFinite(expires) && expires > now + FRESH_MS
}

function remember(accessToken: string, expiresAt: string) {
  const expires = Date.parse(expiresAt)
  if (!Number.isFinite(expires)) return
  memory = { token: accessToken, expiresAt: expires }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readRow(db: SupabaseClient): Promise<TokenRow | null> {
  const { data, error } = await db.from("qbo_tokens").select("id, realm_id, access_token, refresh_token, access_expires_at, locked_until, lock_token").eq("id", QBO_TOKEN_ROW_ID).maybeSingle()
  if (error) throw new QboAuthError(error.message, 500)
  return (data as TokenRow | null) ?? null
}

async function seedRow(db: SupabaseClient): Promise<TokenRow> {
  const seed = process.env.QBO_REFRESH_TOKEN?.trim() ?? ""
  if (!seed) {
    throw new QboAuthError("QuickBooks isn't connected yet. Add the woodcode row to qbo_tokens.", 500)
  }
  const inserted = await db.from("qbo_tokens").upsert({
    id: QBO_TOKEN_ROW_ID,
    realm_id: QBO_REALM_ID,
    refresh_token: seed,
  }, { onConflict: "id", ignoreDuplicates: true }).select("id")
  if (inserted.error) throw new QboAuthError(inserted.error.message, 500)
  const row = await readRow(db)
  if (!row?.refresh_token) throw new QboAuthError("QuickBooks isn't connected yet. Add the woodcode row to qbo_tokens.", 500)
  return row
}

function assertRealm(row: TokenRow) {
  if (row.realm_id !== QBO_REALM_ID) {
    throw new QboAuthError("The QuickBooks connection is for a different company.", 500)
  }
}

async function tryLock(db: SupabaseClient, lock: string, now: number): Promise<TokenRow | null> {
  const until = new Date(now + LOCK_MS).toISOString()
  const { data, error } = await db
    .from("qbo_tokens")
    .update({ locked_until: until, lock_token: lock })
    .eq("id", QBO_TOKEN_ROW_ID)
    .eq("realm_id", QBO_REALM_ID)
    .or(`locked_until.is.null,locked_until.lt."${new Date(now).toISOString()}"`)
    .select("id, realm_id, access_token, refresh_token, access_expires_at, locked_until, lock_token")
  if (error) throw new QboAuthError(error.message, 500)
  const row = Array.isArray(data) ? data[0] as TokenRow | undefined : null
  return row ?? null
}

async function unlock(db: SupabaseClient, lock: string) {
  await db
    .from("qbo_tokens")
    .update({ locked_until: null, lock_token: null })
    .eq("id", QBO_TOKEN_ROW_ID)
    .eq("lock_token", lock)
}

async function refreshWithIntuit(refreshToken: string): Promise<Refreshed> {
  const cfg = credentials()
  if (!cfg) throw new QboAuthError("QuickBooks isn't set up.", 500)
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  })
  const json = await res.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number } | null
  if (!res.ok || !json?.access_token) {
    throw new QboAuthError("QuickBooks authorisation failed. The refresh token on the woodcode row may have expired — paste a new one into qbo_tokens.", 502)
  }
  const nextRefresh = typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : refreshToken
  const expiresAt = new Date(Date.now() + (Number(json.expires_in) || 3600) * 1000).toISOString()
  return { accessToken: json.access_token, refreshToken: nextRefresh, expiresAt }
}

async function writeTokens(
  db: SupabaseClient,
  refreshed: Refreshed,
  oldRefresh: string,
  lock: string | null,
): Promise<boolean> {
  let query = db
    .from("qbo_tokens")
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      access_expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString(),
      locked_until: null,
      lock_token: null,
    })
    .eq("id", QBO_TOKEN_ROW_ID)
    .eq("realm_id", QBO_REALM_ID)
    .eq("refresh_token", oldRefresh)
  if (lock) query = query.eq("lock_token", lock)
  const { data, error } = await query.select("id")
  if (error) throw new QboAuthError(error.message, 500)
  return Array.isArray(data) && data.length > 0
}

async function loadAccessToken(force: boolean): Promise<string> {
  if (!credentials()) throw new QboAuthError("QuickBooks isn't set up. Add QBO_CLIENT_ID and QBO_CLIENT_SECRET.", 500)
  if (!force && memory && memory.expiresAt > Date.now() + FRESH_MS) return memory.token

  const db = serviceClient()
  if (!db) throw new QboAuthError("QuickBooks can't reach the token store.", 500)

  let row = await readRow(db)
  if (!row) row = await seedRow(db)
  assertRealm(row)
  if (!force && fresh(row)) {
    remember(row.access_token!, row.access_expires_at!)
    return row.access_token!
  }

  for (let attempt = 0; attempt < WAIT_TRIES; attempt++) {
    const lock = crypto.randomUUID()
    const locked = await tryLock(db, lock, Date.now())
    if (locked) {
      assertRealm(locked)
      try {
        if (!force && fresh(locked)) {
          await unlock(db, lock)
          remember(locked.access_token!, locked.access_expires_at!)
          return locked.access_token!
        }
        const refreshed = await refreshWithIntuit(locked.refresh_token)
        const saved = await writeTokens(db, refreshed, locked.refresh_token, lock)
        if (!saved) {
          const rescued = await writeTokens(db, refreshed, locked.refresh_token, null)
          await unlock(db, lock)
          if (!rescued) {
            const again = await readRow(db)
            if (again && fresh(again)) {
              remember(again.access_token!, again.access_expires_at!)
              return again.access_token!
            }
            throw new QboAuthError("QuickBooks token was updated by another session. Try again.", 503)
          }
        }
        remember(refreshed.accessToken, refreshed.expiresAt)
        return refreshed.accessToken
      } catch (err) {
        await unlock(db, lock)
        throw err
      }
    }

    await sleep(400 + attempt * 150)
    const current = await readRow(db)
    if (current && fresh(current)) {
      remember(current.access_token!, current.access_expires_at!)
      return current.access_token!
    }
  }

  throw new QboAuthError("QuickBooks is busy refreshing the connection. Try again.", 503)
}

export function clearAccessTokenCache() {
  memory = null
}

export async function getAccessToken(force = false): Promise<string> {
  if (!force && memory && memory.expiresAt > Date.now() + FRESH_MS) return memory.token
  if (!inflight) {
    inflight = loadAccessToken(force).finally(() => {
      inflight = null
    })
  }
  return inflight
}
