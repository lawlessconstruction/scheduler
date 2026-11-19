// Job addresses in Scheduler and QuickBooks don't share spelling.
// "7 Fyfe st, Templestowe Lower" and "7 Fyfe Street Templestowe Lower" are the same job.
// Comparison is exact after this cleanup. A near miss is not a match.

const STREET_SHORT: Record<string, string> = {
  street: "st",
  road: "rd",
  avenue: "ave",
  av: "ave",
  drive: "dr",
  court: "ct",
  crescent: "cres",
  parade: "pde",
  place: "pl",
  terrace: "tce",
  highway: "hwy",
  lane: "ln",
  boulevard: "blvd",
  close: "cl",
  circuit: "cct",
  grove: "gr",
}

export type JobName = {
  id: string
  name: string
  parentId: string | null
}

export type NamedCustomer = {
  id: string
  name: string
  job: boolean
}

export type NameMatch<T> =
  | { status: "one"; match: T }
  | { status: "none" }
  | { status: "many"; matches: T[] }

export function normaliseJobName(raw: string): string {
  const lowered = raw.toLowerCase().replace(/['’]/g, "")
  const spaced = lowered.replace(/[^a-z0-9]+/g, " ").trim()
  if (!spaced) return ""
  return spaced
    .split(/\s+/)
    .map((token) => STREET_SHORT[token] ?? token)
    .join(" ")
}

/** QuickBooks display names reject colons and line breaks. */
export function projectDisplayName(raw: string): string {
  return raw.replace(/[\r\n\t:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
}

export function matchProjects<T extends JobName>(
  jobName: string,
  candidates: readonly T[],
  builderId: string | null,
): NameMatch<T> {
  const wanted = normaliseJobName(jobName)
  if (!wanted) return { status: "none" }
  const named = candidates.filter((candidate) => normaliseJobName(candidate.name) === wanted)
  const pool = builderId ? named.filter((candidate) => candidate.parentId === builderId) : named
  if (pool.length === 1) return { status: "one", match: pool[0] }
  if (pool.length > 1) return { status: "many", matches: pool }
  return { status: "none" }
}

/** Case-insensitive exact name, and only a top-level customer (not a job project). */
export function matchBuilderName<T extends NamedCustomer>(
  builderName: string,
  customers: readonly T[],
): NameMatch<T> {
  const wanted = builderName.trim().toLowerCase()
  if (!wanted) return { status: "none" }
  const matches = customers.filter((customer) => !customer.job && customer.name.trim().toLowerCase() === wanted)
  if (matches.length === 1) return { status: "one", match: matches[0] }
  if (matches.length > 1) return { status: "many", matches }
  return { status: "none" }
}

export function projectChoices<T extends JobName>(
  jobName: string,
  candidates: readonly T[],
  builderId: string | null,
): T[] {
  const wanted = normaliseJobName(jobName)
  const exact = wanted ? candidates.filter((candidate) => normaliseJobName(candidate.name) === wanted) : []
  const scoped = builderId ? candidates.filter((candidate) => candidate.parentId === builderId) : []
  const byId = new Map<string, T>()
  for (const candidate of exact) byId.set(candidate.id, candidate)
  for (const candidate of scoped) byId.set(candidate.id, candidate)
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "en-AU", { numeric: true, sensitivity: "base" }))
}

/** Builder email wins. The job project email is only a fallback. */
export function billEmail(builderEmail: string, projectEmail: string): string | null {
  const builder = builderEmail.trim()
  if (builder.includes("@")) return builder
  const project = projectEmail.trim()
  if (project.includes("@")) return project
  return null
}

export type ProjectRefCandidate = {
  id: string
  name: string
  customerId: string | null
}

export function pickProjectRef(
  projects: readonly ProjectRefCandidate[],
  jobName: string,
  customerIds: readonly string[],
): string | null {
  const wanted = normaliseJobName(jobName)
  if (!wanted) return null
  const named = projects.filter((project) => project.id && normaliseJobName(project.name) === wanted)
  if (named.length === 0) return null
  const allowed = new Set(customerIds.filter((id) => id))
  if (allowed.size > 0) {
    const scoped = named.filter((project) => project.customerId != null && allowed.has(project.customerId))
    return scoped.length === 1 ? scoped[0].id : null
  }
  return named.length === 1 ? named[0].id : null
}

export function soleProjectRef(refs: readonly (string | null | undefined)[]): string | null {
  const ids = Array.from(new Set(refs.filter((id): id is string => typeof id === "string" && id !== "")))
  return ids.length === 1 ? ids[0] : null
}
