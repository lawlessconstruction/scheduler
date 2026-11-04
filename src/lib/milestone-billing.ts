// Shared rules for "this visit is already on an invoiced stage" and
// "this amount is allowed to be marked invoiced or paid".
//
// Two link shapes exist and both count:
//   • segments.milestone_id  — many visits tagged to one stage
//   • milestones.segment_id  — the old one-visit-per-stage pointer
// A visit linked either way to a stage whose status is invoiced or paid
// is already billed. Don't offer it again, and don't let a $0 stage
// be marked invoiced or paid.

export type StageLink = {
  id: string
  status?: string | null
  segment_id?: string | null
}

export type VisitLink = {
  id: string
  project_id: string
  start_date: string
  end_date: string
  milestone_id?: string | null
}

const BILLED = new Set(["invoiced", "paid"])

export function amountCanBeInvoiced(amount: unknown): boolean {
  let n = NaN
  if (typeof amount === "number") n = amount
  else if (typeof amount === "string" && amount.trim() !== "") n = Number(amount)
  return Number.isFinite(n) && n > 0
}

export function segmentIsBilled(
  segment: { id: string; milestone_id?: string | null },
  milestones: readonly StageLink[],
): boolean {
  const stageId = segment.milestone_id
  return milestones.some((m) => {
    if (!m.status || !BILLED.has(m.status)) return false
    const viaStage = stageId != null && stageId !== "" && m.id === stageId
    const viaLegacy = m.segment_id != null && m.segment_id !== "" && m.segment_id === segment.id
    return viaStage || viaLegacy
  })
}

/** Already counted on this stage, by either link shape. */
export function segmentIsOnStage(
  segment: { id: string; milestone_id?: string | null },
  stageId: string,
  milestones: readonly StageLink[],
): boolean {
  if (!stageId) return false
  if (segment.milestone_id === stageId) return true
  return milestones.some((m) => m.id === stageId && m.segment_id === segment.id)
}

/** No stage tag and no legacy one-to-one pointer. */
export function segmentIsUntagged(
  segment: { id: string; milestone_id?: string | null },
  milestones: readonly StageLink[],
): boolean {
  if (segment.milestone_id != null && segment.milestone_id !== "") return false
  return !milestones.some((m) => m.segment_id === segment.id)
}

/**
 * Past visits on this job that are not already on an invoiced/paid stage
 * and not already on `stageId`. Any crew, any date. Sorted by start date.
 * Does not mutate `segments`.
 */
export function pastVisitsForInvoice<T extends VisitLink>(
  segments: readonly T[],
  milestones: readonly StageLink[],
  projectId: string,
  todayKey: string | null,
  stageId: string,
): T[] {
  if (!todayKey || !stageId || !projectId) return []
  const matches = segments.filter((s) =>
    s.project_id === projectId &&
    s.end_date < todayKey &&
    !segmentIsBilled(s, milestones) &&
    !segmentIsOnStage(s, stageId, milestones)
  )
  return [...matches].sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1
    if (a.end_date !== b.end_date) return a.end_date < b.end_date ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** QuickBooks TotalAmt is inc-GST. Scheduler amounts are the ex-GST figure. */
export function exGstFromQbo(totalAmt: unknown, totalTax: unknown): number | null {
  const total = typeof totalAmt === "number" ? totalAmt : Number(totalAmt)
  if (!Number.isFinite(total)) return null
  const tax = totalTax == null || totalTax === ""
    ? 0
    : (typeof totalTax === "number" ? totalTax : Number(totalTax))
  if (!Number.isFinite(tax)) return null
  const ex = Math.round((total - tax) * 100) / 100
  if (!Number.isFinite(ex)) return null
  return ex
}
