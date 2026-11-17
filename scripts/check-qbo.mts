import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { askParts } from "../src/lib/ask/links.ts"
import { asMoney, splitGst, sumExGst } from "../src/lib/qbo/money.ts"
import {
  claimOrFilter,
  cleanLines,
  invoiceBody,
  pickGstTaxCodeId,
  pickServiceItem,
  qboId,
  stageLineDescription,
} from "../src/lib/qbo/payload.ts"
import { canRaiseInvoice, canReviewInvoices } from "../src/lib/qbo/roles.ts"

assert.equal(canRaiseInvoice("boss"), true)
assert.equal(canRaiseInvoice("crew_boss"), true)
assert.equal(canRaiseInvoice("worker"), false)
assert.equal(canRaiseInvoice(null), false)
assert.equal(canReviewInvoices("boss"), true)
assert.equal(canReviewInvoices("crew_boss"), false)

assert.deepEqual(splitGst(18370), { exGst: 18370, gst: 1837, total: 20207 })
assert.deepEqual(sumExGst([100, 50.005]), { exGst: 150.01, gst: 15, total: 165.01 })
assert.equal(asMoney("18370"), 18370)
assert.equal(asMoney("nope"), null)

assert.equal(stageLineDescription("12 Smith St", "Lock up", "Q-4"), "12 Smith St — Lock up (quote Q-4)")
assert.equal(qboId("9130357573413016"), "9130357573413016")
assert.equal(qboId("abc"), null)
assert.deepEqual(cleanLines([{ description: " Extra ", amountExGst: "12.5" }]), [{ description: "Extra", amountExGst: 12.5 }])
assert.equal("error" in cleanLines([{ description: "", amountExGst: 1 }]), true)

const filter = claimOrFilter(Date.parse("2026-11-14T02:00:00.000Z"))
assert.match(filter, /invoice_claim\.is\.null/)
assert.match(filter, /invoice_claim_at\.lt\."/)

assert.equal(pickGstTaxCodeId([
  { Id: "2", Name: "GST free", Active: true },
  { Id: "10", Name: "GST", Active: true, SalesTaxRateList: { TaxRateDetail: [{}] } },
]), "10")
assert.deepEqual(pickServiceItem([
  { Id: "8", Name: "Materials", Type: "Service", Active: true },
  { Id: "3", Name: "Services", Type: "Service", Active: true },
]), { value: "3", name: "Services" })

const body = invoiceBody({
  customerId: "55",
  email: "builder@example.com",
  txnDate: "2026-11-14",
  lines: [{ description: "12 Smith St — Lock up", amountExGst: 1000 }],
  note: "Thanks",
  privateNote: "Raised in Scheduler",
  item: { value: "3", name: "Services" },
  taxCodeId: "10",
})
assert.equal(body.GlobalTaxCalculation, "TaxExcluded")
const line = (body.Line as { Amount: number; SalesItemLineDetail: { TaxCodeRef: { value: string }; UnitPrice: number } }[])[0]
assert.equal(line.Amount, 1000)
assert.equal(line.SalesItemLineDetail.UnitPrice, 1000)
assert.equal(line.SalesItemLineDetail.TaxCodeRef.value, "10")
assert.equal((body.BillEmail as { Address: string }).Address, "builder@example.com")

const parts = askParts("The quote is [Open quote PDF](/api/quotes/file?projectId=11111111-1111-4111-8111-111111111111).")
assert.equal(parts.filter((part) => part.type === "link").length, 1)
const link = parts.find((part) => part.type === "link")
assert.equal(link && link.type === "link" ? link.href.includes("redirect=1") : false, true)
assert.equal(askParts("[bad](javascript:alert(1))").every((part) => part.type === "text"), true)

function files(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...files(path))
    else if (name.endsWith(".ts")) found.push(path)
  }
  return found
}

for (const path of [...files("src/lib/qbo"), ...files("app/api/qbo")]) {
  const src = readFileSync(path, "utf8")
  let index = 0
  while (index < src.length) {
    const at = src.indexOf(".update(", index)
    if (at === -1) break
    const next = src.slice(at, at + 600)
    assert.match(next, /\.eq\(/, `${path} update is missing a filter`)
    index = at + 8
  }
  assert.equal(src.includes("refresh_token") && src.includes("console.log"), false)
}

console.log("qbo checks passed")
