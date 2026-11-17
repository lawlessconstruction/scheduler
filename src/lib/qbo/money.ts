// Stage amounts in Scheduler are ex GST. QuickBooks Australia adds 10%.

export type GstSplit = { exGst: number; gst: number; total: number }

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function asMoney(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  return round2(n)
}

export function splitGst(exGst: number): GstSplit {
  const ex = round2(exGst)
  const gst = round2(ex * 0.1)
  return { exGst: ex, gst, total: round2(ex + gst) }
}

export function sumExGst(amounts: number[]): GstSplit {
  const ex = round2(amounts.reduce((sum, amount) => sum + amount, 0))
  return splitGst(ex)
}
