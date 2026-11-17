import { clearAccessTokenCache, getAccessToken, QboAuthError } from "./tokens"
import { QBO_API_BASE, QBO_MINOR_VERSION, QBO_REALM_ID, qboQuote } from "./payload"

type QboFault = { Fault?: { Error?: { Message?: string; Detail?: string }[] } }

export class QboApiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = "QboApiError"
    this.status = status
  }
}

function faultMessage(body: QboFault | null, fallback: string): string {
  const err = body?.Fault?.Error?.[0]
  const detail = [err?.Message, err?.Detail].filter((part) => typeof part === "string" && part.trim()).join(" — ")
  if (!detail) return fallback
  return detail.slice(0, 240)
}

async function call(path: string, init: RequestInit, retry: boolean): Promise<unknown> {
  const token = await getAccessToken(false)
  const url = `${QBO_API_BASE}/v3/company/${QBO_REALM_ID}/${path}${path.includes("?") ? "&" : "?"}minorversion=${QBO_MINOR_VERSION}`
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  headers.set("Accept", "application/json")
  const res = await fetch(url, { ...init, headers })
  const json = await res.json().catch(() => null) as QboFault | null
  if (res.status === 401 && retry) {
    clearAccessTokenCache()
    await getAccessToken(true)
    return call(path, init, false)
  }
  if (!res.ok) {
    throw new QboApiError(faultMessage(json, "QuickBooks didn't accept that request."), res.status === 400 ? 400 : 502)
  }
  return json
}

export async function qboQuery(query: string): Promise<Record<string, unknown>> {
  const json = await call(`query?query=${encodeURIComponent(query)}`, { method: "GET" }, true)
  const response = (json as { QueryResponse?: Record<string, unknown> } | null)?.QueryResponse
  return response ?? {}
}

export async function qboGet(path: string): Promise<Record<string, unknown>> {
  const json = await call(path, { method: "GET" }, true)
  return (json ?? {}) as Record<string, unknown>
}

export async function qboPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  const json = await call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, true)
  return (json ?? {}) as Record<string, unknown>
}

export async function qboSendInvoice(invoiceId: string): Promise<Record<string, unknown>> {
  const json = await call(`invoice/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
  }, true)
  return (json ?? {}) as Record<string, unknown>
}

export function listOf<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === "object") return [value as T]
  return []
}

export function customerEmail(customer: Record<string, unknown> | null): string {
  const email = customer?.PrimaryEmailAddr
  if (!email || typeof email !== "object") return ""
  const address = (email as { Address?: unknown }).Address
  return typeof address === "string" ? address.trim() : ""
}

export function searchCustomersQuery(raw: string): string | null {
  const cleaned = raw.trim().slice(0, 40).replace(/[%_\\]/g, "")
  if (cleaned.length < 2) return null
  return `select * from Customer where Active = true and DisplayName like '%${qboQuote(cleaned)}%' maxresults 15`
}

export { QboAuthError }
