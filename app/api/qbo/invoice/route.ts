import { NextRequest, NextResponse } from "next/server"
import { exGstFromQbo } from "../../../../src/lib/milestone-billing"

// Looks up one QuickBooks Online invoice by its number and returns the
// ex-GST amount (TotalAmt minus TxnTaxDetail.TotalTax) plus the invoice date.
//
// Credentials stay on the server. The button in the app is hidden unless all
// of these are set:
//   QBO_CLIENT_ID        Intuit app client id
//   QBO_CLIENT_SECRET    Intuit app client secret
//   QBO_REFRESH_TOKEN    OAuth refresh token (from the Intuit playground or OAuth flow)
//   QBO_REALM_ID         QuickBooks company id
//   QBO_ENVIRONMENT      optional, "sandbox" or "production" (default production)
//
// Intuit access tokens last about an hour. This route refreshes them and keeps
// the latest refresh token in memory for this server instance. A cold start
// goes back to QBO_REFRESH_TOKEN. If Intuit has rotated that token, generate
// a new one and update the env var — nothing here is written to the database.

type QboConfig = {
  clientId: string
  clientSecret: string
  refreshToken: string
  realmId: string
  sandbox: boolean
}

type TokenCache = { accessToken: string; refreshToken: string; expiresAt: number }

let tokenCache: TokenCache | null = null
let refreshing: Promise<string> | null = null

function qboConfig(): QboConfig | null {
  const clientId = process.env.QBO_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.QBO_CLIENT_SECRET?.trim() ?? ""
  const refreshToken = process.env.QBO_REFRESH_TOKEN?.trim() ?? ""
  const realmId = process.env.QBO_REALM_ID?.trim() ?? ""
  if (!clientId || !clientSecret || !refreshToken || !realmId) return null
  const sandbox = (process.env.QBO_ENVIRONMENT ?? "").trim().toLowerCase() === "sandbox"
  return { clientId, clientSecret, refreshToken, realmId, sandbox }
}

async function refreshAccessToken(cfg: QboConfig): Promise<string> {
  const refreshToken = tokenCache?.refreshToken || cfg.refreshToken
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  const json = await res.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number } | null
  if (!res.ok || !json?.access_token) {
    tokenCache = null
    throw new Error("QuickBooks authorisation failed. The refresh token may have expired — generate a new one and update QBO_REFRESH_TOKEN.")
  }
  tokenCache = {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : refreshToken,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  }
  return tokenCache.accessToken
}

async function getAccessToken(cfg: QboConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken
  if (!refreshing) {
    refreshing = refreshAccessToken(cfg).finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

const DOC_NUMBER = /^[A-Za-z0-9][A-Za-z0-9. /_-]{0,30}$/

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function GET(req: NextRequest) {
  const number = new URL(req.url).searchParams.get("number")?.trim() ?? ""
  const cfg = qboConfig()

  // No number: just tell the page whether the button should show.
  if (!number) {
    return NextResponse.json({ configured: cfg != null })
  }
  if (!cfg) {
    return NextResponse.json({ error: "QuickBooks lookup is not set up." }, { status: 404 })
  }
  if (!DOC_NUMBER.test(number)) {
    return NextResponse.json({ error: "That doesn't look like an invoice number." }, { status: 400 })
  }

  try {
    const token = await getAccessToken(cfg)
    const escaped = number.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    const query = `select * from Invoice where DocNumber = '${escaped}'`
    const host = cfg.sandbox
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com"
    const url = `${host}/v3/company/${encodeURIComponent(cfg.realmId)}/query?minorversion=75&query=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })
    const body = await res.json().catch(() => null) as { QueryResponse?: { Invoice?: unknown } } | null
    if (!res.ok || !body) {
      return NextResponse.json({
        error: "QuickBooks didn't return that invoice. Check the number, or renew the QuickBooks connection.",
      }, { status: 502 })
    }

    const raw = body.QueryResponse?.Invoice
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    const exact = list.filter((inv) => {
      const doc = (inv as { DocNumber?: unknown })?.DocNumber
      return String(doc ?? "") === number
    }) as { DocNumber?: string; TxnDate?: string; TotalAmt?: number; TxnTaxDetail?: { TotalTax?: number } }[]

    if (exact.length === 0) {
      return NextResponse.json({ error: `No QuickBooks invoice numbered ${number}.` }, { status: 404 })
    }

    const inv = [...exact].sort((a, b) => String(b.TxnDate ?? "").localeCompare(String(a.TxnDate ?? "")))[0]
    const totalTax = inv.TxnTaxDetail?.TotalTax == null ? 0 : Number(inv.TxnTaxDetail.TotalTax)
    const amountExGst = exGstFromQbo(inv.TotalAmt, totalTax)
    if (amountExGst == null) {
      return NextResponse.json({ error: "QuickBooks returned an invoice without a usable total." }, { status: 502 })
    }
    const txnDate = typeof inv.TxnDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(inv.TxnDate)
      ? inv.TxnDate.slice(0, 10)
      : null

    return NextResponse.json({
      docNumber: number,
      txnDate,
      totalAmt: round2(Number(inv.TotalAmt)),
      totalTax: round2(totalTax),
      amountExGst,
    })
  } catch (err) {
    const message = err instanceof Error && err.message.startsWith("QuickBooks authorisation")
      ? err.message
      : "QuickBooks lookup failed."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
