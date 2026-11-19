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
import {
  billEmail,
  matchBuilderName,
  matchProjects,
  normaliseJobName,
  pickProjectRef,
  projectChoices,
  projectDisplayName,
  soleProjectRef,
} from "../src/lib/qbo/names.ts"

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
assert.equal("ProjectRef" in body, false)

const withProject = invoiceBody({
  customerId: "344",
  projectRefId: "820539257",
  email: "builder@example.com",
  txnDate: "2026-11-14",
  lines: [{ description: "81 Haldane Rd Niddrie — Lock up", amountExGst: 1000 }],
  note: "",
  privateNote: "Raised in Scheduler",
  item: { value: "3", name: "Services" },
  taxCodeId: "10",
})
assert.equal((withProject.CustomerRef as { value: string }).value, "344")
assert.equal((withProject.ProjectRef as { value: string }).value, "820539257")
assert.equal((withProject.BillEmail as { Address: string }).Address, "builder@example.com")

const skippedRef = invoiceBody({
  customerId: "344",
  projectRefId: "not-a-project",
  email: "builder@example.com",
  txnDate: "2026-11-14",
  lines: [{ description: "Job", amountExGst: 10 }],
  note: "",
  privateNote: "Raised in Scheduler",
  item: { value: "3", name: "Services" },
  taxCodeId: "10",
})
assert.equal("ProjectRef" in skippedRef, false)

assert.equal(normaliseJobName("7 Fyfe st, Templestowe Lower"), normaliseJobName("7 Fyfe Street Templestowe Lower"))
assert.equal(normaliseJobName("81 Haldane Rd Niddrie"), normaliseJobName("81 haldane road, niddrie"))
assert.equal(normaliseJobName("88 May St. Fitzroy North"), normaliseJobName("88 May Street Fitzroy North"))
assert.notEqual(normaliseJobName("81 Haldane Rd Niddrie"), normaliseJobName("81 Haldane Rd"))
assert.equal(projectDisplayName(" 81 Haldane: Rd\nNiddrie "), "81 Haldane Rd Niddrie")

const jobs = [
  { id: "344", name: "81 Haldane Rd Niddrie", parentId: "58" },
  { id: "321", name: "88 May Street, Fitzroy North", parentId: "58" },
  { id: "900", name: "81 Haldane Road, Niddrie", parentId: "77" },
  { id: "901", name: "81 Haldane Rd Niddrie", parentId: "58" },
]
const original = jobs.map((job) => job.id)
assert.equal(matchProjects("81 Haldane Road, Niddrie", jobs, "58").status, "many")
assert.equal(matchProjects("88 May St Fitzroy North", jobs, "58").status, "one")
const one = matchProjects("88 May St Fitzroy North", jobs, "58")
assert.equal(one.status === "one" ? one.match.id : "", "321")
assert.equal(matchProjects("81 Haldane Road, Niddrie", jobs, "77").status, "one")
assert.equal(matchProjects("81 Haldane Road, Niddrie", jobs, null).status, "many")
assert.equal(matchProjects("12 Smith St", jobs, "58").status, "none")
assert.equal(matchProjects("", jobs, "58").status, "none")
assert.deepEqual(jobs.map((job) => job.id), original)

const choices = projectChoices("no such job", jobs, "58")
assert.deepEqual(choices.map((job) => job.id), ["344", "901", "321"])
assert.deepEqual(jobs.map((job) => job.id), original)

assert.equal(matchBuilderName("Metricon", [
  { id: "1", name: "metricon", job: false },
  { id: "2", name: "Metricon", job: true },
]).status, "one")
assert.equal(matchBuilderName("Metricon", [
  { id: "1", name: "Metricon", job: false },
  { id: "3", name: "METRICON", job: false },
]).status, "many")

assert.equal(billEmail("builder@example.com", "site@example.com"), "builder@example.com")
assert.equal(billEmail("", "site@example.com"), "site@example.com")
assert.equal(billEmail("not-an-email", ""), null)

assert.equal(pickProjectRef([
  { id: "820539257", name: "81 Haldane Rd Niddrie", customerId: "344" },
  { id: "809096466", name: "88 May St Fitzroy North", customerId: "321" },
], "81 Haldane Road, Niddrie", ["344", "58"]), "820539257")
assert.equal(pickProjectRef([
  { id: "1", name: "81 Haldane Rd Niddrie", customerId: "344" },
  { id: "2", name: "81 Haldane Road Niddrie", customerId: "900" },
], "81 Haldane Rd Niddrie", ["344"]), "1")
assert.equal(pickProjectRef([
  { id: "1", name: "81 Haldane Rd Niddrie", customerId: "344" },
  { id: "2", name: "81 Haldane Road Niddrie", customerId: "900" },
], "81 Haldane Rd Niddrie", ["58"]), null)
assert.equal(soleProjectRef(["820539257", "820539257"]), "820539257")
assert.equal(soleProjectRef(["820539257", "809096466"]), null)

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
