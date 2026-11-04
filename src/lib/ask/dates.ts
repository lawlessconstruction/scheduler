// Calendar maths for Australia/Melbourne. "Today" and "Thursday" are
// resolved here so the model is not asked to guess the timezone.

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

export const SCHEDULE_MAX_DAYS = 120
export const HOURS_MAX_DAYS = 370
export const COMPANY_HOURS_MAX_DAYS = 31

export function melbourneToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function isRealDate(ymd: string): boolean {
  const match = YMD.exec(ymd)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function addDays(ymd: string, days: number): string {
  const match = YMD.exec(ymd)
  if (!match) throw new Error("bad date")
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  date.setUTCDate(date.getUTCDate() + days)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function diffDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000)
}

/** Monday of the week that contains ymd. Weeks start Monday, same as timesheets. */
export function mondayOf(ymd: string): string {
  const match = YMD.exec(ymd)
  if (!match) throw new Error("bad date")
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const weekday = date.getUTCDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  return addDays(ymd, delta)
}

/** Australian wording: "Thursday 5 November". No month-first dates. */
export function formatAu(ymd: string): string {
  const match = YMD.exec(ymd)
  if (!match) return ymd
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const weekday = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long" }).format(date)
  const month = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "long" }).format(date)
  return `${weekday} ${Number(match[3])} ${month}`
}

export type DateRange = { ok: true; from: string; to: string } | { ok: false; error: string }

export function parseRange(from: unknown, to: unknown, maxDays: number): DateRange {
  if (typeof from !== "string" || typeof to !== "string" || !isRealDate(from) || !isRealDate(to)) {
    return { ok: false, error: "Use real dates in YYYY-MM-DD, Melbourne time." }
  }
  if (from > to) return { ok: false, error: "The start date is after the end date." }
  const days = diffDays(from, to) + 1
  if (days > maxDays) return { ok: false, error: `Ask about ${maxDays} days or fewer.` }
  return { ok: true, from, to }
}

export function weekLines(monday: string): string {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index)
    return `${formatAu(day)} (${day})`
  }).join("; ")
}
