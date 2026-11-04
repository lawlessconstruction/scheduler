import assert from "node:assert/strict"
import {
  amountCanBeInvoiced,
  exGstFromQbo,
  pastVisitsForInvoice,
  segmentIsBilled,
  segmentIsUntagged,
  type StageLink,
  type VisitLink,
} from "../src/lib/milestone-billing.ts"

const stages: StageLink[] = [
  { id: "paid-stage", status: "paid", segment_id: null },
  { id: "invoiced-stage", status: "invoiced", segment_id: "legacy-billed" },
  { id: "pending-stage", status: "pending", segment_id: "legacy-pending" },
  { id: "target", status: "pending", segment_id: "legacy-on-target" },
]

const visits: VisitLink[] = [
  { id: "untagged-old", project_id: "job", start_date: "2026-03-02", end_date: "2026-03-04", milestone_id: null },
  { id: "untagged-later", project_id: "job", start_date: "2026-03-16", end_date: "2026-03-18", milestone_id: null },
  { id: "other-crew", project_id: "job", start_date: "2026-03-09", end_date: "2026-03-09", milestone_id: null },
  { id: "on-pending", project_id: "job", start_date: "2026-02-02", end_date: "2026-02-06", milestone_id: "pending-stage" },
  { id: "legacy-pending", project_id: "job", start_date: "2026-02-16", end_date: "2026-02-18", milestone_id: null },
  { id: "on-paid", project_id: "job", start_date: "2026-01-05", end_date: "2026-01-09", milestone_id: "paid-stage" },
  { id: "legacy-billed", project_id: "job", start_date: "2026-01-12", end_date: "2026-01-16", milestone_id: null },
  { id: "already-target", project_id: "job", start_date: "2026-03-23", end_date: "2026-03-25", milestone_id: "target" },
  { id: "legacy-on-target", project_id: "job", start_date: "2026-03-01", end_date: "2026-03-01", milestone_id: null },
  { id: "future", project_id: "job", start_date: "2026-04-06", end_date: "2026-04-10", milestone_id: null },
  { id: "today", project_id: "job", start_date: "2026-04-01", end_date: "2026-04-02", milestone_id: null },
  { id: "other-job", project_id: "other", start_date: "2026-03-02", end_date: "2026-03-04", milestone_id: null },
]

const today = "2026-04-02"
const originalOrder = visits.map((v) => v.id)
const offered = pastVisitsForInvoice(visits, stages, "job", today, "target")
const ids = offered.map((v) => v.id)

assert.deepEqual(ids, [
  "on-pending",
  "legacy-pending",
  "untagged-old",
  "other-crew",
  "untagged-later",
])
assert.deepEqual(visits.map((v) => v.id), originalOrder, "input order must not change")

for (const id of ["untagged-old", "untagged-later", "other-crew"]) {
  const visit = visits.find((v) => v.id === id)!
  assert.equal(segmentIsUntagged(visit, stages), true, id)
}
assert.equal(segmentIsUntagged(visits.find((v) => v.id === "on-pending")!, stages), false)
assert.equal(segmentIsUntagged(visits.find((v) => v.id === "legacy-pending")!, stages), false)

assert.equal(segmentIsBilled(visits.find((v) => v.id === "on-paid")!, stages), true)
assert.equal(segmentIsBilled(visits.find((v) => v.id === "legacy-billed")!, stages), true)
assert.equal(segmentIsBilled(visits.find((v) => v.id === "on-pending")!, stages), false)
assert.equal(segmentIsBilled({ id: "x", milestone_id: "" }, stages), false)

assert.equal(pastVisitsForInvoice(visits, stages, "job", null, "target").length, 0)
assert.equal(pastVisitsForInvoice(visits, stages, "job", today, "").length, 0)

assert.equal(amountCanBeInvoiced(null), false)
assert.equal(amountCanBeInvoiced(undefined), false)
assert.equal(amountCanBeInvoiced(0), false)
assert.equal(amountCanBeInvoiced(-5), false)
assert.equal(amountCanBeInvoiced(NaN), false)
assert.equal(amountCanBeInvoiced(""), false)
assert.equal(amountCanBeInvoiced("0"), false)
assert.equal(amountCanBeInvoiced("  "), false)
assert.equal(amountCanBeInvoiced(13000), true)
assert.equal(amountCanBeInvoiced("13.5"), true)
assert.equal(amountCanBeInvoiced(0.01), true)

// Invoice 1689 shape: QBO total inc-GST $13,090, tax $90, milestone holds $13,000 ex-GST.
assert.equal(exGstFromQbo(13090, 90), 13000)
assert.equal(exGstFromQbo(13090, 0), 13090)
assert.equal(exGstFromQbo(13090, null), 13090)
assert.equal(exGstFromQbo("13090.00", "90"), 13000)
assert.equal(exGstFromQbo(10.005, 0), 10.01)
assert.equal(exGstFromQbo("nope", 0), null)

console.log("milestone billing checks passed")
