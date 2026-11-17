import { round2 } from "./money"

// QuickBooks Online request bodies for one Woodcode progress claim.
// Line amounts are ex GST. GlobalTaxCalculation TaxExcluded tells QBO to add GST.

export const QBO_MINOR_VERSION = "75"
export const QBO_REALM_ID = "9130357573413016"
export const QBO_API_BASE = "https://quickbooks.api.intuit.com"
export const QBO_TOKEN_ROW_ID = "woodcode"

const CLAIM_TTL_MS = 3 * 60 * 1000

export type InvoiceLine = { description: string; amountExGst: number }

export type InvoiceDraft = {
  customerId: string
  email: string
  txnDate: string
  lines: InvoiceLine[]
  note: string
  privateNote: string
  item: { value: string; name: string }
  taxCodeId: string
}

export function claimOrFilter(now: number): string {
  const stale = new Date(now - CLAIM_TTL_MS).toISOString()
  return `invoice_claim.is.null,invoice_claim_at.lt."${stale}"`
}

export function stageLineDescription(job: string, stage: string, quoteNumber: string | null): string {
  const name = stage.trim() || "Stage"
  const title = `${job.trim() || "Job"} — ${name}`
  const quote = quoteNumber?.trim()
  return quote ? `${title} (quote ${quote})` : title
}

export function cleanNote(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.replace(/\u0000/g, "").trim().slice(0, 500)
}

export function cleanLines(raw: unknown): InvoiceLine[] | { error: string } {
  if (raw == null) return []
  if (!Array.isArray(raw)) return { error: "Extra lines were not a list." }
  if (raw.length > 8) return { error: "Use at most 8 extra lines." }
  const lines: InvoiceLine[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: "An extra line was incomplete." }
    const src = item as { description?: unknown; amountExGst?: unknown }
    const description = typeof src.description === "string" ? src.description.replace(/\u0000/g, "").trim().slice(0, 400) : ""
    const amount = typeof src.amountExGst === "number" ? src.amountExGst : Number(src.amountExGst)
    if (!description) return { error: "Each extra line needs a description." }
    if (!Number.isFinite(amount) || amount === 0) return { error: "Each extra line needs an amount that isn't zero." }
    const rounded = round2(amount)
    if (Math.abs(rounded) > 1_000_000) return { error: "An extra line amount is too large." }
    lines.push({ description, amountExGst: rounded })
  }
  return lines
}

export function invoiceBody(draft: InvoiceDraft): Record<string, unknown> {
  return {
    CustomerRef: { value: draft.customerId },
    BillEmail: { Address: draft.email },
    TxnDate: draft.txnDate,
    GlobalTaxCalculation: "TaxExcluded",
    ...(draft.note ? { CustomerMemo: { value: draft.note } } : {}),
    PrivateNote: draft.privateNote.slice(0, 4000),
    Line: draft.lines.map((line) => ({
      DetailType: "SalesItemLineDetail",
      Amount: line.amountExGst,
      Description: line.description,
      SalesItemLineDetail: {
        ItemRef: { value: draft.item.value, name: draft.item.name },
        Qty: 1,
        UnitPrice: line.amountExGst,
        TaxCodeRef: { value: draft.taxCodeId },
      },
    })),
  }
}

type TaxCode = {
  Id?: string
  Name?: string
  Active?: boolean
  SalesTaxRateList?: { TaxRateDetail?: unknown }
}

export function pickGstTaxCodeId(codes: TaxCode[]): string | null {
  const active = codes.filter((code) => code.Active !== false && code.Id)
  const named = active.filter((code) => (code.Name ?? "").trim().toUpperCase() === "GST")
  const withSales = named.find((code) => {
    const detail = code.SalesTaxRateList?.TaxRateDetail
    if (Array.isArray(detail)) return detail.length > 0
    return detail != null
  })
  return (withSales ?? named[0])?.Id ?? null
}

type Item = { Id?: string; Name?: string; Type?: string; Active?: boolean }

const ITEM_PREFERENCE = ["services", "service", "labour", "labor", "carpentry", "sales"]

export function pickServiceItem(items: Item[]): { value: string; name: string } | null {
  const services = items.filter((item) => item.Active !== false && item.Id && (item.Type ?? "Service") === "Service")
  const ranked = [...services].sort((a, b) => {
    const ai = ITEM_PREFERENCE.indexOf((a.Name ?? "").trim().toLowerCase())
    const bi = ITEM_PREFERENCE.indexOf((b.Name ?? "").trim().toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  const item = ranked[0]
  if (!item?.Id) return null
  return { value: item.Id, name: (item.Name ?? "Service").slice(0, 100) }
}

export function qboId(value: unknown): string | null {
  const id = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
  if (!/^\d{1,20}$/.test(id)) return null
  return id
}

/** Quote a value for a QBO query string. QBO escapes a single quote with a backslash. */
export function qboQuote(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}
