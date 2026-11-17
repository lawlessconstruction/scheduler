import {
  CREW_COLUMNS,
  CREWMATE_COLUMNS,
  JOB_SEGMENT_COLUMNS,
  JOB_TIMESHEET_COLUMNS,
  LABEL_COLUMNS,
  MILESTONE_STAGE_COLUMNS,
  PROJECT_COLUMNS,
  QUOTE_COLUMNS,
  SEGMENT_COLUMNS,
  TIMESHEET_COLUMNS,
  WORKER_LOOKUP_COLUMNS,
} from "./columns"
import { COMPANY_HOURS_MAX_DAYS, HOURS_MAX_DAYS, SCHEDULE_MAX_DAYS, addDays, diffDays, parseRange } from "./dates"
import {
  clip,
  containsPattern,
  hoursTarget,
  isBoss,
  plainQuery,
  scheduleScope,
  type AskUser,
} from "./policy"

// Read-only schedule lookups. Every query is a .select() of an allow-listed
// column string, and crew members are filtered to their own crew before any
// project name search. There is no insert, update, or delete in this file.

type Row = Record<string, unknown>
type Result = { data: Row[] | null; error: { message: string } | null }

interface Filter {
  select(columns: string): Filter
  eq(column: string, value: string | boolean): Filter
  in(column: string, values: string[]): Filter
  ilike(column: string, pattern: string): Filter
  gte(column: string, value: string): Filter
  lte(column: string, value: string): Filter
  order(column: string, options?: { ascending: boolean }): Filter
  range(from: number, to: number): PromiseLike<Result>
  limit(count: number): PromiseLike<Result>
}

export type AskReader = {
  from(table: string): Filter
}

export class AskReadError extends Error {
  constructor() {
    super("read failed")
    this.name = "AskReadError"
  }
}

type Segment = {
  id: string
  name: string | null
  project_id: string
  crew_id: string
  start_date: string
  end_date: string
  notes: string | null
}

type Project = {
  id: string
  name: string
  client: string | null
  archived: boolean
  pinned: boolean
  completed: boolean
  completed_at: string | null
}
type Crew = { id: string; name: string; nickname: string | null }
type Label = { project_id: string; date: string; label: string }
type Crewmate = { name: string; crew_id: string; role: string | null }
type WorkerHit = { id: string; name: string; crew_id: string | null }
type Timesheet = {
  id: string
  date: string
  worker_id: string
  project_id: string | null
  ordinary_hours: number
  ot_hours: number
  notes: string | null
  absence_type: string | null
}

const ABSENCE: Record<string, string> = {
  annual: "annual leave",
  personal: "personal leave",
  public: "public holiday",
  rdo: "RDO",
  unpaid: "unpaid leave",
}

const PAGE = 1000
// A plain .select() stops at 1000 rows and says nothing. Page with .range().
// The cap is only a backstop; hitting it sets truncated and a count.
export const SCHEDULE_FETCH_CAP = 5000
// How many bookings we hand the model. The rest stay counted in matched.
export const SCHEDULE_JOB_LIMIT = 40
export const PROJECT_LIMIT = 100
// One job can outlive a 1000-row page. Page until this backstop, then say the total may be short.
export const JOB_SUMMARY_CAP = 20000
const BOARD_EMPTY_MAX_DAYS = 14
// Days before the window, so "next week" still reaches work logged this week.
const BOARD_HOURS_LOOKBACK = 7

function text(value: unknown): string | null {
  if (value == null) return null
  const str = String(value).trim()
  return str || null
}

function day(value: unknown): string {
  return String(value ?? "").slice(0, 10)
}

function earliest(dates: string[]): string | null {
  let best: string | null = null
  for (const date of dates) {
    if (!date) continue
    if (best === null || date < best) best = date
  }
  return best
}

function latest(dates: string[]): string | null {
  let best: string | null = null
  for (const date of dates) {
    if (!date) continue
    if (best === null || date > best) best = date
  }
  return best
}

function totalHours(ordinary: number, overtime: number): number {
  return Math.round((ordinary + overtime) * 100) / 100
}

function hours(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function awayLabel(value: string | null): string | null {
  if (!value) return null
  return ABSENCE[value] ?? value.slice(0, 40)
}

function mapProject(row: Row): Project {
  const completedAt = day(row.completed_at)
  return {
    id: String(row.id),
    name: text(row.name) ?? "Untitled job",
    client: text(row.client),
    archived: row.archived === true,
    pinned: row.pinned === true,
    completed: row.completed === true,
    completed_at: completedAt || null,
  }
}

type ProjectFilter = { pinned?: boolean; archived?: boolean; completed?: boolean; name: string | null }

function projectMatches(project: Project, filters: ProjectFilter): boolean {
  if (filters.pinned !== undefined && project.pinned !== filters.pinned) return false
  if (filters.archived !== undefined && project.archived !== filters.archived) return false
  if (filters.completed !== undefined && project.completed !== filters.completed) return false
  if (filters.name && !project.name.toLowerCase().includes(filters.name)) return false
  return true
}

function emptySchedule(about: string, from: string, to: string, note: string) {
  const span = diffDays(from, to) + 1
  if (span > BOARD_EMPTY_MAX_DAYS) return { about, from, to, jobs: [] as [], note }
  const hoursFrom = addDays(from, -BOARD_HOURS_LOOKBACK)
  return {
    about,
    from,
    to,
    jobs: [] as [],
    board_empty: true as const,
    hours_from: hoursFrom,
    hours_to: to,
    note: `${note} The board has no booking in this short window. Call lookup_hours from ${hoursFrom} to ${to} and answer from what was last logged.`,
  }
}

async function pages(
  build: (from: number, to: number) => PromiseLike<Result>,
  cap: number,
): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = []
  for (let offset = 0; rows.length <= cap; offset += PAGE) {
    const want = Math.min(PAGE, cap - rows.length + 1)
    const { data, error } = await build(offset, offset + want - 1)
    if (error) throw new AskReadError()
    const batch = data ?? []
    if (rows.length + batch.length > cap) {
      rows.push(...batch.slice(0, cap - rows.length))
      return { rows, truncated: true }
    }
    rows.push(...batch)
    if (batch.length < want) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

async function loadIn(reader: AskReader, table: string, columns: string, column: string, ids: string[]): Promise<Row[]> {
  const unique = [...new Set(ids)].filter(Boolean)
  const rows: Row[] = []
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80)
    // Order by id as well as the filter column so a full page cannot skip rows.
    const { rows: batch } = await pages((start, end) => {
      return reader
        .from(table)
        .select(columns)
        .in(column, chunk)
        .order(column, { ascending: true })
        .order("id", { ascending: true })
        .range(start, end)
    }, SCHEDULE_FETCH_CAP)
    rows.push(...batch)
  }
  return rows
}

type SegmentFilter =
  | { kind: "crew"; crewId: string }
  | { kind: "projects"; projectIds: string[] }
  | { kind: "all" }

async function segmentsOverlapping(
  reader: AskReader,
  from: string,
  to: string,
  filter: SegmentFilter,
  cap: number,
): Promise<{ segments: Segment[]; truncated: boolean }> {
  if (filter.kind === "projects" && filter.projectIds.length === 0) return { segments: [], truncated: false }
  const { rows, truncated } = await pages((start, end) => {
    let query = reader
      .from("segments")
      .select(SEGMENT_COLUMNS)
      .lte("start_date", to)
      .gte("end_date", from)
    if (filter.kind === "crew") query = query.eq("crew_id", filter.crewId)
    if (filter.kind === "projects") query = query.in("project_id", filter.projectIds)
    return query.order("start_date", { ascending: true }).order("id", { ascending: true }).range(start, end)
  }, cap)
  return {
    truncated,
    segments: rows.map((row) => ({
      id: String(row.id),
      name: text(row.name),
      project_id: String(row.project_id),
      crew_id: String(row.crew_id),
      start_date: day(row.start_date),
      end_date: day(row.end_date),
      notes: text(row.notes),
    })),
  }
}

// An unwon quote is not live work. `quoted` is not null in the database, so
// .eq("quoted", false) is the real filter. The row check is what a reader that
// ignores .eq still has to honour.
function liveProjectRows(rows: Row[]): { projects: Project[]; quotedIds: Set<string> } {
  const quotedIds = new Set<string>()
  const projects: Project[] = []
  for (const row of rows) {
    if (row.quoted === true) {
      quotedIds.add(String(row.id))
      continue
    }
    projects.push(mapProject(row))
  }
  return { projects, quotedIds }
}

async function loadProjects(reader: AskReader, ids: string[]): Promise<{ projects: Project[]; quotedIds: Set<string> }> {
  const rows = await loadIn(reader, "projects", PROJECT_COLUMNS, "id", ids)
  return liveProjectRows(rows)
}

async function findProjectsByName(reader: AskReader, query: string): Promise<{ projects: Project[]; truncated: boolean }> {
  const pattern = containsPattern(query)
  if (!pattern) return { projects: [], truncated: false }
  const { rows, truncated } = await pages((start, end) => {
    return reader
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("quoted", false)
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  }, 200)
  return { truncated, projects: liveProjectRows(rows).projects }
}

async function findWorkers(reader: AskReader, query: string): Promise<WorkerHit[]> {
  const pattern = containsPattern(query)
  if (!pattern) return []
  const { data, error } = await reader
    .from("workers")
    .select(WORKER_LOOKUP_COLUMNS)
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(8)
  if (error) throw new AskReadError()
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: text(row.name) ?? "Unnamed",
    crew_id: text(row.crew_id),
  }))
}

function crewLabel(crew: Crew | undefined): string {
  if (!crew) return "Crew"
  return crew.nickname ? `${crew.name} — ${crew.nickname}` : crew.name
}

function presentJobs(args: {
  about: string
  from: string
  to: string
  segments: Segment[]
  projects: Project[]
  crews: Crew[]
  labels: Label[]
  people: Crewmate[]
  truncated: boolean
  emptyNote: string
}) {
  const projectsById = new Map(args.projects.map((project) => [project.id, project]))
  const crewsById = new Map(args.crews.map((crew) => [crew.id, crew]))
  const peopleByCrew = new Map<string, string[]>()
  for (const person of args.people) {
    const list = peopleByCrew.get(person.crew_id) ?? []
    const label = person.role ? `${person.name} (${person.role})` : person.name
    if (!list.includes(label)) list.push(label)
    peopleByCrew.set(person.crew_id, list)
  }

  // Copy before sorting. Nearest the asked start first, so a cap keeps those days.
  const ordered = args.segments.slice().sort((a, b) => {
    const aKey = a.start_date > args.from ? a.start_date : args.from
    const bKey = b.start_date > args.from ? b.start_date : args.from
    if (aKey !== bKey) return aKey < bKey ? -1 : 1
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1
    if (a.id !== b.id) return a.id < b.id ? -1 : 1
    return 0
  })
  const shown = ordered.slice(0, SCHEDULE_JOB_LIMIT)
  let jobs = shown.map((segment) => {
    const project = projectsById.get(segment.project_id)
    const dayNotes = args.labels
      .filter((label) =>
        label.project_id === segment.project_id
        && label.date >= segment.start_date
        && label.date <= segment.end_date
        && label.date >= args.from
        && label.date <= args.to
      )
      .map((label) => ({ date: label.date, note: clip(label.label, 300) }))
      .filter((label) => label.note)
    const notes = clip(segment.notes, 500)
    const block = clip(segment.name, 120)
    return {
      address: project?.name ?? "Unknown job",
      ...(project?.client ? { client: project.client } : {}),
      ...(project?.archived ? { archived: true } : {}),
      pinned: project?.pinned === true,
      completed: project?.completed === true,
      ...(project?.completed_at ? { completed_at: project.completed_at } : {}),
      crew: crewLabel(crewsById.get(segment.crew_id)),
      starts: segment.start_date,
      ends: segment.end_date,
      ...(block ? { block } : {}),
      ...(notes ? { notes } : {}),
      ...(dayNotes.length ? { day_notes: dayNotes } : {}),
      people: peopleByCrew.get(segment.crew_id) ?? [],
    }
  })
  // The route drops a tool result past 14,000 characters. Shrink from the
  // far end of the window so the truncated count still reaches the model.
  while (jobs.length > 1 && JSON.stringify(jobs).length > 11000) jobs = jobs.slice(0, -1)

  if (jobs.length === 0) return emptySchedule(args.about, args.from, args.to, args.emptyNote)

  const hidden = args.truncated || ordered.length > jobs.length
  const matchedNote = args.truncated
    ? `Showing ${jobs.length} bookings nearest ${args.from}. At least ${ordered.length} overlap this window and the rest were not loaded. Ask about fewer days or one street.`
    : `Showing ${jobs.length} of ${ordered.length} bookings, nearest ${args.from} first. Ask about fewer days or one street for the rest.`
  return {
    about: args.about,
    from: args.from,
    to: args.to,
    jobs,
    ...(hidden
      ? {
          truncated: true,
          returned: jobs.length,
          ...(args.truncated ? { matched_at_least: ordered.length } : { matched: ordered.length }),
          note: matchedNote,
        }
      : {}),
  }
}

async function describeSegments(
  reader: AskReader,
  from: string,
  to: string,
  about: string,
  segments: Segment[],
  truncated: boolean,
  emptyNote: string,
) {
  const projectIds = segments.map((segment) => segment.project_id)
  const crewIds = segments.map((segment) => segment.crew_id)
  const [loaded, crewRows, labelRows, peopleRows] = await Promise.all([
    loadProjects(reader, projectIds),
    loadIn(reader, "crews", CREW_COLUMNS, "id", crewIds),
    loadLabels(reader, projectIds, from, to),
    loadIn(reader, "workers", CREWMATE_COLUMNS, "crew_id", crewIds),
  ])
  const projects = loaded.projects
  // Drop bookings on an unwon quote. A segment whose project row is missing
  // still shows as an unknown job, same as before.
  const liveSegments = segments.filter((segment) => !loaded.quotedIds.has(segment.project_id))
  const crews: Crew[] = crewRows.map((row) => ({
    id: String(row.id),
    name: text(row.name) ?? "Crew",
    nickname: text(row.nickname),
  }))
  const people: Crewmate[] = peopleRows.map((row) => ({
    name: text(row.name) ?? "Unnamed",
    crew_id: String(row.crew_id),
    role: text(row.role),
  }))
  return presentJobs({
    about,
    from,
    to,
    segments: liveSegments,
    projects,
    crews,
    labels: labelRows,
    people,
    truncated,
    emptyNote,
  })
}

async function loadLabels(reader: AskReader, projectIds: string[], from: string, to: string): Promise<Label[]> {
  const unique = [...new Set(projectIds)].filter(Boolean)
  const labels: Label[] = []
  for (let i = 0; i < unique.length && labels.length < 300; i += 80) {
    const chunk = unique.slice(i, i + 80)
    const { data, error } = await reader
      .from("project_day_labels")
      .select(LABEL_COLUMNS)
      .in("project_id", chunk)
      .gte("date", from)
      .lte("date", to)
      .limit(300)
    if (error) throw new AskReadError()
    for (const row of data ?? []) {
      const label = text(row.label)
      if (!label) continue
      labels.push({ project_id: String(row.project_id), date: day(row.date), label })
    }
  }
  return labels.slice(0, 300)
}

async function rosterForCrew(
  reader: AskReader,
  from: string,
  to: string,
  crewId: string,
  jobQuery: string | null,
  about: string,
  voice: "self" | "other",
) {
  const notOnJob = voice === "self"
    ? "You are not rostered on a job matching that in those dates."
    : "That person is not rostered on a job matching that in those dates."
  const nothing = voice === "self"
    ? "Nothing is booked for you in those dates."
    : "Nothing is booked for that person in those dates."
  const mine = await segmentsOverlapping(reader, from, to, { kind: "crew", crewId }, SCHEDULE_FETCH_CAP)
  const { projects } = await loadProjects(reader, mine.segments.map((segment) => segment.project_id))
  const matched = jobQuery
    ? projects.filter((project) => project.name.toLowerCase().includes(jobQuery))
    : projects
  const ids = matched.map((project) => project.id)
  if (jobQuery && ids.length === 0) return emptySchedule(about, from, to, notOnJob)
  if (ids.length === 0) return emptySchedule(about, from, to, nothing)
  // Other crews on the same jobs, same dates. Not their other jobs.
  const expanded = await segmentsOverlapping(reader, from, to, { kind: "projects", projectIds: ids }, SCHEDULE_FETCH_CAP)
  return describeSegments(
    reader,
    from,
    to,
    about,
    expanded.segments,
    mine.truncated || expanded.truncated,
    nothing,
  )
}

export async function lookupSchedule(reader: AskReader, user: AskUser, input: { from?: unknown; to?: unknown; job_query?: string; person?: string }) {
  const range = parseRange(input.from, input.to, SCHEDULE_MAX_DAYS)
  if (!range.ok) return { error: range.error }
  const jobQuery = plainQuery(input.job_query)
  if (input.job_query?.trim() && !jobQuery) return { error: "Use a bit more of the street name." }

  const scope = scheduleScope(user, input.person)
  if (scope.kind === "no-crew") {
    return { about: user.name, jobs: [], note: "You aren't on a crew, so there is no roster to look up. You can still ask about your own hours." }
  }
  if (scope.kind === "own-crew") {
    if (!user.crewId) return { error: "You can only see your own jobs." }
    return rosterForCrew(reader, range.from, range.to, user.crewId, jobQuery, user.name, "self")
  }
  if (!isBoss(user)) return { error: "You can only see your own jobs." }

  if (scope.kind === "person") {
    const found = await findWorkers(reader, scope.name)
    if (found.length === 0) return { about: scope.name, jobs: [], note: "No one with that name is on the crew list." }
    if (found.length > 1) return { matches: found.map((person) => person.name), note: "More than one person matches. Ask again with the full name." }
    const person = found[0]
    if (!person.crew_id) return { about: person.name, jobs: [], note: "That person isn't on a crew, so nothing is rostered for them." }
    return rosterForCrew(reader, range.from, range.to, person.crew_id, jobQuery, person.name, "other")
  }

  let segments: Segment[] = []
  let truncated = false
  if (jobQuery) {
    const found = await findProjectsByName(reader, jobQuery)
    if (found.projects.length === 0) return { about: "whole company", from: range.from, to: range.to, jobs: [], note: "No job matches that." }
    const loaded = await segmentsOverlapping(reader, range.from, range.to, { kind: "projects", projectIds: found.projects.map((project) => project.id) }, SCHEDULE_FETCH_CAP)
    segments = loaded.segments
    truncated = loaded.truncated || found.truncated
  } else {
    const loaded = await segmentsOverlapping(reader, range.from, range.to, { kind: "all" }, SCHEDULE_FETCH_CAP)
    segments = loaded.segments
    truncated = loaded.truncated
  }
  return describeSegments(reader, range.from, range.to, "whole company", segments, truncated, "Nothing is booked in those dates.")
}

async function loadTimesheets(
  reader: AskReader,
  from: string,
  to: string,
  workerId: string | null,
  cap: number,
): Promise<{ rows: Timesheet[]; truncated: boolean }> {
  const { rows, truncated } = await pages((start, end) => {
    let query = reader.from("timesheets").select(TIMESHEET_COLUMNS).gte("date", from).lte("date", to)
    if (workerId) query = query.eq("worker_id", workerId)
    // Newest first, so a cap keeps recent days instead of the oldest page.
    return query.order("date", { ascending: false }).order("id", { ascending: true }).range(start, end)
  }, cap)
  return {
    truncated,
    rows: rows.map((row) => ({
      id: String(row.id),
      date: day(row.date),
      worker_id: String(row.worker_id),
      project_id: text(row.project_id),
      ordinary_hours: hours(row.ordinary_hours),
      ot_hours: hours(row.ot_hours),
      notes: text(row.notes),
      absence_type: text(row.absence_type),
    })),
  }
}

function sumHours(rows: { ordinary_hours: number; ot_hours: number }[]) {
  const ordinary = rows.reduce((total, row) => total + row.ordinary_hours, 0)
  const overtime = rows.reduce((total, row) => total + row.ot_hours, 0)
  return {
    ordinary_hours: Math.round(ordinary * 100) / 100,
    overtime_hours: Math.round(overtime * 100) / 100,
  }
}

async function onePersonsHours(reader: AskReader, from: string, to: string, workerId: string, name: string, scope: "self" | "one person") {
  const loaded = await loadTimesheets(reader, from, to, workerId, 1500)
  const projectIds = loaded.rows.map((row) => row.project_id).filter((id): id is string => !!id)
  const { projects } = await loadProjects(reader, projectIds)
  const names = new Map(projects.map((project) => [project.id, project.name]))
  const days = loaded.rows.map((row) => {
    const notes = clip(row.notes, 200)
    const away = awayLabel(row.absence_type)
    return {
      date: row.date,
      ...(row.project_id && names.get(row.project_id) ? { job: names.get(row.project_id) } : {}),
      ordinary: row.ordinary_hours,
      overtime: row.ot_hours,
      ...(away ? { away } : {}),
      ...(notes ? { notes } : {}),
    }
  }).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const lastLogged = days.length > 0 ? days[days.length - 1].date : null
  return {
    worker: name,
    scope,
    from,
    to,
    ...sumHours(loaded.rows),
    last_logged: lastLogged,
    days,
    ...(loaded.truncated ? { truncated: true, note: "Some days were left out. Ask about a shorter period." } : {}),
  }
}

export async function lookupHours(reader: AskReader, user: AskUser, input: { from?: unknown; to?: unknown; person?: string; job_query?: string }) {
  // A named job is job_summary. Searching one person's timesheet will not find it.
  if (typeof input.job_query === "string" && input.job_query.trim()) {
    return { error: "That tool can't filter by job. Call job_summary with the street." }
  }
  const target = hoursTarget(user, input.person)
  if (target.kind === "denied") return { error: "You can only see your own hours." }
  if (target.kind === "company" && !isBoss(user)) return { error: "You can only see your own hours." }
  if (target.kind === "named" && !isBoss(user)) return { error: "You can only see your own hours." }

  const maxDays = target.kind === "company" ? COMPANY_HOURS_MAX_DAYS : HOURS_MAX_DAYS
  const range = parseRange(input.from, input.to, maxDays)
  if (!range.ok) return { error: range.error }

  if (target.kind === "self") {
    return onePersonsHours(reader, range.from, range.to, user.id, user.name, "self")
  }

  if (target.kind === "named") {
    const found = await findWorkers(reader, target.name)
    if (found.length === 0) return { note: "No one with that name is on the crew list." }
    if (found.length > 1) return { matches: found.map((person) => person.name), note: "More than one person matches. Ask again with the full name." }
    return onePersonsHours(reader, range.from, range.to, found[0].id, found[0].name, "one person")
  }

  // Boss, whole company, short window. Totals and site headcounts — no one else's notes.
  const loaded = await loadTimesheets(reader, range.from, range.to, null, 2000)
  const workerIds = [...new Set(loaded.rows.map((row) => row.worker_id))]
  const projectIds = loaded.rows.map((row) => row.project_id).filter((id): id is string => !!id)
  const [nameRows, loadedProjects] = await Promise.all([
    loadIn(reader, "workers", WORKER_LOOKUP_COLUMNS, "id", workerIds),
    loadProjects(reader, projectIds),
  ])
  const names = new Map(nameRows.map((row) => [String(row.id), text(row.name) ?? "Unnamed"]))
  const projectNames = new Map(loadedProjects.projects.map((project) => [project.id, project.name]))
  const quotedIds = loadedProjects.quotedIds
  const byWorker = new Map<string, Timesheet[]>()
  for (const row of loaded.rows) {
    const list = byWorker.get(row.worker_id) ?? []
    list.push(row)
    byWorker.set(row.worker_id, list)
  }
  const people = [...byWorker.entries()]
    .map(([id, rows]) => ({ name: names.get(id) ?? "Unnamed", ...sumHours(rows) }))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const sitesByDay = new Map<string, Map<string, { job: string; workers: Set<string> }>>()
  for (const row of loaded.rows) {
    if (!row.project_id || quotedIds.has(row.project_id)) continue
    const job = projectNames.get(row.project_id) ?? "Unknown job"
    let sites = sitesByDay.get(row.date)
    if (!sites) {
      sites = new Map()
      sitesByDay.set(row.date, sites)
    }
    let site = sites.get(row.project_id)
    if (!site) {
      site = { job, workers: new Set() }
      sites.set(row.project_id, site)
    }
    site.workers.add(row.worker_id)
  }
  const days = [...sitesByDay.entries()]
    .map(([date, sites]) => ({
      date,
      sites: [...sites.values()]
        .map((site) => ({ job: site.job, people: site.workers.size }))
        .slice()
        .sort((a, b) => b.people - a.people || a.job.localeCompare(b.job)),
    }))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return {
    scope: "company",
    from: range.from,
    to: range.to,
    ...sumHours(loaded.rows),
    last_logged: days[0]?.date ?? null,
    days,
    people,
    ...(loaded.truncated ? { truncated: true, note: "Some hours were left out. Ask about fewer days or one person." } : {}),
  }
}

function presentProjects(projects: Project[], truncated: boolean, scope: string) {
  const sorted = projects.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" })
  })
  const shown = sorted.slice(0, PROJECT_LIMIT)
  const jobs = shown.map((project) => ({
    name: project.name,
    client: project.client,
    pinned: project.pinned,
    ...(project.archived ? { archived: true } : {}),
    completed: project.completed,
    ...(project.completed_at ? { completed_at: project.completed_at } : {}),
  }))
  const hidden = truncated || sorted.length > jobs.length
  return {
    scope,
    jobs,
    ...(hidden
      ? {
          truncated: true,
          returned: jobs.length,
          ...(truncated ? { matched_at_least: sorted.length } : { matched: sorted.length }),
          note: truncated
            ? `Showing ${jobs.length} jobs. At least ${sorted.length} matched and the rest were not loaded.`
            : `Showing ${jobs.length} of ${sorted.length} jobs.`,
        }
      : {}),
  }
}

async function projectIdsForCrewMember(reader: AskReader, user: AskUser): Promise<{ ids: string[]; truncated: boolean }> {
  const ids = new Set<string>()
  let truncated = false
  const crewId = user.crewId
  if (crewId) {
    const loaded = await pages((start, end) => {
      return reader
        .from("segments")
        .select(SEGMENT_COLUMNS)
        .eq("crew_id", crewId)
        .order("start_date", { ascending: true })
        .order("id", { ascending: true })
        .range(start, end)
    }, SCHEDULE_FETCH_CAP)
    truncated = loaded.truncated
    for (const row of loaded.rows) ids.add(String(row.project_id))
  }
  const mine = await pages((start, end) => {
    return reader
      .from("timesheets")
      .select(TIMESHEET_COLUMNS)
      .eq("worker_id", user.id)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(start, end)
  }, SCHEDULE_FETCH_CAP)
  if (mine.truncated) truncated = true
  for (const row of mine.rows) {
    const projectId = text(row.project_id)
    if (projectId) ids.add(projectId)
  }
  return { ids: [...ids], truncated }
}

async function loadProjectList(reader: AskReader, filters: ProjectFilter): Promise<{ projects: Project[]; truncated: boolean }> {
  const pattern = filters.name ? containsPattern(filters.name) : null
  const { rows, truncated } = await pages((start, end) => {
    // True is safe as .eq (null is not true). False is applied in projectMatches
    // so a null archived/completed flag still counts as not set, same as the board.
    // Unwon quotes are not live jobs. False is safe as .eq because quoted is not null.
    let query = reader.from("projects").select(PROJECT_COLUMNS).eq("quoted", false)
    if (filters.pinned === true) query = query.eq("pinned", true)
    if (filters.archived === true) query = query.eq("archived", true)
    if (filters.completed === true) query = query.eq("completed", true)
    if (pattern) query = query.ilike("name", pattern)
    return query.order("name", { ascending: true }).order("id", { ascending: true }).range(start, end)
  }, SCHEDULE_FETCH_CAP)
  return { truncated, projects: liveProjectRows(rows).projects.filter((project) => projectMatches(project, filters)) }
}

export async function lookupProjects(
  reader: AskReader,
  user: AskUser,
  input: { pinned?: boolean; archived?: boolean; completed?: boolean; name?: string },
) {
  const name = plainQuery(input.name)
  if (input.name?.trim() && !name) return { error: "Use a bit more of the street name." }
  const filters: ProjectFilter = {
    pinned: input.pinned,
    archived: input.archived,
    completed: input.completed,
    name,
  }

  if (!isBoss(user)) {
    const found = await projectIdsForCrewMember(reader, user)
    const allowed = new Set(found.ids)
    const projects = (await loadProjects(reader, found.ids)).projects.filter((project) => allowed.has(project.id) && projectMatches(project, filters))
    const listed = presentProjects(projects, found.truncated, "your jobs")
    if (listed.jobs.length === 0 && !("truncated" in listed)) {
      return { ...listed, note: "No job you are on matches that." }
    }
    return listed
  }

  const loaded = await loadProjectList(reader, filters)
  return presentProjects(loaded.projects, loaded.truncated, "company")
}

type HourRow = { date: string; workerId: string; ordinary: number; ot: number }

function jobFields(project: Project) {
  return {
    job: project.name,
    ...(project.client ? { client: project.client } : {}),
    pinned: project.pinned,
    ...(project.archived ? { archived: true } : {}),
    completed: project.completed,
    ...(project.completed_at ? { completed_at: project.completed_at } : {}),
  }
}

function byJobName(a: Project, b: Project): number {
  return a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" })
}

function presentJobMatches(projects: Project[], truncated: boolean) {
  const sorted = projects.slice().sort(byJobName)
  const shown = sorted.slice(0, PROJECT_LIMIT)
  const hidden = truncated || sorted.length > shown.length
  return {
    matches: shown.map(jobFields),
    ...(hidden
      ? {
          truncated: true,
          returned: shown.length,
          ...(truncated ? { matched_at_least: sorted.length } : { matched: sorted.length }),
        }
      : {}),
    note: hidden
      ? "More than one job matches, and some were not loaded. Ask again with more of the street."
      : "More than one job matches. Ask again with more of the street.",
  }
}

async function loadProjectRows(
  reader: AskReader,
  table: string,
  columns: string,
  projectId: string,
  dateColumn: string,
): Promise<{ rows: Row[]; truncated: boolean }> {
  return pages((start, end) => {
    return reader
      .from(table)
      .select(columns)
      .eq("project_id", projectId)
      .order(dateColumn, { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  }, JOB_SUMMARY_CAP)
}

// Hours are grouped by each worker's current crew. Timesheet rows on a job
// are not tied to the booking, so the segment's crew is not the hour split.
async function hourBreakdown(reader: AskReader, rows: HourRow[]) {
  const workerIds = [...new Set(rows.map((row) => row.workerId))]
  const workerRows = await loadIn(reader, "workers", WORKER_LOOKUP_COLUMNS, "id", workerIds)
  const workers = new Map(workerRows.map((row) => [String(row.id), {
    name: text(row.name) ?? "Unnamed",
    crewId: text(row.crew_id),
  }]))
  const crewIds = [...workers.values()].map((worker) => worker.crewId).filter((id): id is string => !!id)
  const crewRows = await loadIn(reader, "crews", CREW_COLUMNS, "id", crewIds)
  const crews = new Map(crewRows.map((row) => {
    const crew: Crew = {
      id: String(row.id),
      name: text(row.name) ?? "Crew",
      nickname: text(row.nickname),
    }
    return [crew.id, crew] as const
  }))

  const byWorker = new Map<string, { name: string; crew: string; ordinary: number; ot: number }>()
  const byCrew = new Map<string, { ordinary: number; ot: number; workers: Set<string> }>()
  for (const row of rows) {
    const worker = workers.get(row.workerId)
    const crewId = worker?.crewId ?? null
    const crew = crewId ? crewLabel(crews.get(crewId)) : "No crew"
    const person = byWorker.get(row.workerId) ?? { name: worker?.name ?? "Unnamed", crew, ordinary: 0, ot: 0 }
    person.ordinary += row.ordinary
    person.ot += row.ot
    byWorker.set(row.workerId, person)
    const bucket = byCrew.get(crew) ?? { ordinary: 0, ot: 0, workers: new Set<string>() }
    bucket.ordinary += row.ordinary
    bucket.ot += row.ot
    bucket.workers.add(row.workerId)
    byCrew.set(crew, bucket)
  }

  const pack = (ordinary: number, ot: number) => {
    const sums = sumHours([{ ordinary_hours: ordinary, ot_hours: ot }])
    return { ...sums, total_hours: totalHours(sums.ordinary_hours, sums.overtime_hours) }
  }
  const people = [...byWorker.values()]
    .map((person) => ({ name: person.name, crew: person.crew, ...pack(person.ordinary, person.ot) }))
    .sort((a, b) => b.total_hours - a.total_hours || a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
  const crewHours = [...byCrew.entries()]
    .map(([crew, bucket]) => ({ crew, ...pack(bucket.ordinary, bucket.ot), workers: bucket.workers.size }))
    .sort((a, b) => b.total_hours - a.total_hours || a.crew.localeCompare(b.crew, "en", { sensitivity: "base" }))
  return { people, crews: crewHours }
}

async function summarizeJob(reader: AskReader, project: Project, full: boolean) {
  const [segmentLoad, timeLoad] = await Promise.all([
    loadProjectRows(reader, "segments", JOB_SEGMENT_COLUMNS, project.id, "start_date"),
    loadProjectRows(reader, "timesheets", JOB_TIMESHEET_COLUMNS, project.id, "date"),
  ])
  const hourRows: HourRow[] = timeLoad.rows.map((row) => ({
    date: day(row.date),
    workerId: String(row.worker_id ?? ""),
    ordinary: hours(row.ordinary_hours),
    ot: hours(row.ot_hours),
  }))
  // A blank row is not a day worked and does not move the first or last hour.
  const worked = hourRows.filter((row) => row.workerId && row.ordinary + row.ot > 0)
  const sums = sumHours(worked.map((row) => ({ ordinary_hours: row.ordinary, ot_hours: row.ot })))
  const truncated = segmentLoad.truncated || timeLoad.truncated
  const notes = [
    ...(full ? [] : ["Totals only. Individual hours are not shown."]),
    ...(truncated ? ["Some rows were left out, so these totals can be short."] : []),
  ]
  const breakdown = full ? await hourBreakdown(reader, worked) : null
  return {
    ...jobFields(project),
    segment_count: segmentLoad.rows.length,
    first_segment: earliest(segmentLoad.rows.map((row) => day(row.start_date))),
    last_segment: latest(segmentLoad.rows.map((row) => day(row.end_date))),
    first_hours: earliest(worked.map((row) => row.date)),
    last_hours: latest(worked.map((row) => row.date)),
    ...sums,
    total_hours: totalHours(sums.ordinary_hours, sums.overtime_hours),
    days: new Set(worked.map((row) => row.date)).size,
    workers: new Set(worked.map((row) => row.workerId)).size,
    detail: full ? "full" as const : "totals" as const,
    ...(breakdown ? { crews: breakdown.crews, people: breakdown.people } : {}),
    ...(truncated ? { truncated: true } : {}),
    ...(notes.length ? { note: notes.join(" ") } : {}),
  }
}

export async function lookupJobSummary(reader: AskReader, user: AskUser, input: { name?: string }) {
  const name = plainQuery(input.name)
  if (input.name?.trim() && !name) return { error: "Use a bit more of the street name." }
  if (!name) return { error: "Name the street." }

  let projects: Project[]
  if (!isBoss(user)) {
    const found = await projectIdsForCrewMember(reader, user)
    const allowed = new Set(found.ids)
    projects = (await loadProjects(reader, found.ids)).projects.filter((project) => allowed.has(project.id) && project.name.toLowerCase().includes(name))
    if (projects.length === 0) return { note: "No job you are on matches that." }
  } else {
    const found = await findProjectsByName(reader, name)
    projects = found.projects.filter((project) => project.name.toLowerCase().includes(name))
    if (projects.length === 0) return { note: "No job matches that." }
    if (projects.length > 1 || found.truncated) return presentJobMatches(projects, found.truncated)
  }
  if (projects.length > 1) return presentJobMatches(projects, false)
  const project = projects[0]
  if (!project) return { note: isBoss(user) ? "No job matches that." : "No job you are on matches that." }
  return summarizeJob(reader, project, isBoss(user))
}

function flag(value: unknown): boolean | undefined {
  if (value === true || value === false) return value
  return undefined
}

type QuoteJob = {
  id: string
  name: string
  client: string | null
  quoteNumber: string | null
  quoteDate: string | null
  pdfUrl: string | null
}

const QUOTE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function quotePdfUrl(id: string, path: unknown): string | null {
  const stored = text(path)
  if (!stored || stored.includes("..") || stored.startsWith("/") || stored.includes("\\")) return null
  if (!QUOTE_ID.test(id)) return null
  return `/api/quotes/file?projectId=${id}&redirect=1`
}

function mapQuote(row: Row): QuoteJob {
  const quoteDate = day(row.quote_date)
  return {
    id: String(row.id),
    name: text(row.name) ?? "Untitled quote",
    client: text(row.client),
    quoteNumber: text(row.quote_number),
    quoteDate: quoteDate || null,
    pdfUrl: quotePdfUrl(String(row.id), row.quote_pdf_path),
  }
}

function byQuoteNewest(a: QuoteJob, b: QuoteJob): number {
  if (a.quoteDate !== b.quoteDate) {
    if (!a.quoteDate) return 1
    if (!b.quoteDate) return -1
    return a.quoteDate < b.quoteDate ? 1 : -1
  }
  return a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" })
}

async function stageCounts(reader: AskReader, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (ids.length === 0) return counts
  const rows = await loadIn(reader, "milestones", MILESTONE_STAGE_COLUMNS, "project_id", ids)
  for (const row of rows) {
    const projectId = String(row.project_id ?? "")
    if (!projectId) continue
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1)
  }
  return counts
}

export async function lookupQuotes(reader: AskReader, user: AskUser, input: { name?: string }) {
  if (!isBoss(user)) return { error: "You can't see quotes." }
  const name = plainQuery(input.name)
  if (input.name?.trim() && !name) return { error: "Use a bit more of the street name." }
  const pattern = name ? containsPattern(name) : null
  const { rows, truncated } = await pages((start, end) => {
    let query = reader.from("projects").select(QUOTE_COLUMNS).eq("quoted", true)
    if (pattern) query = query.ilike("name", pattern)
    return query.order("id", { ascending: true }).range(start, end)
  }, SCHEDULE_FETCH_CAP)
  const matched = rows.filter((row) => row.quoted === true).map(mapQuote)
  const named = name ? matched.filter((quote) => quote.name.toLowerCase().includes(name)) : matched
  const sorted = named.slice().sort(byQuoteNewest)
  const shown = sorted.slice(0, PROJECT_LIMIT)
  const counts = await stageCounts(reader, shown.map((quote) => quote.id))
  const quotes = shown.map((quote) => ({
    address: quote.name,
    ...(quote.client ? { client: quote.client } : {}),
    ...(quote.quoteNumber ? { quote_number: quote.quoteNumber } : {}),
    ...(quote.quoteDate ? { quote_date: quote.quoteDate } : {}),
    stages: counts.get(quote.id) ?? 0,
    ...(quote.pdfUrl ? { pdf_url: quote.pdfUrl } : {}),
  }))
  if (quotes.length === 0) return { quotes, note: name ? "No open quote matches that." : "No open quotes." }
  const hidden = truncated || sorted.length > quotes.length
  const note = hidden
    ? "Some open quotes were left out. Ask about one street."
    : quotes.length === 1
      ? "One open quote matches. Use it. If they asked for the PDF and pdf_url is set, give that link and do not ask which quote."
      : "More than one open quote matches. Ask which street only if they need a single one."
  return {
    quotes,
    note,
    ...(hidden
      ? {
          truncated: true,
          returned: quotes.length,
          ...(truncated ? { matched_at_least: sorted.length } : { matched: sorted.length }),
        }
      : {}),
  }
}

export function readQuoteInput(input: unknown): { name?: string } {
  if (!input || typeof input !== "object") return {}
  const src = input as Record<string, unknown>
  const rawName = typeof src.name === "string" ? src.name : typeof src.job_query === "string" ? src.job_query : undefined
  return { name: rawName?.slice(0, 80) }
}

export function readToolInput(input: unknown): { from?: unknown; to?: unknown; job_query?: string; person?: string } {
  if (!input || typeof input !== "object") return {}
  const src = input as Record<string, unknown>
  return {
    from: src.from,
    to: src.to,
    job_query: typeof src.job_query === "string" ? src.job_query.slice(0, 80) : undefined,
    person: typeof src.person === "string" ? src.person.slice(0, 80) : undefined,
  }
}

export function readJobSummaryInput(input: unknown): { name?: string } {
  if (!input || typeof input !== "object") return {}
  const src = input as Record<string, unknown>
  const rawName = typeof src.name === "string" ? src.name : typeof src.job_query === "string" ? src.job_query : undefined
  return { name: rawName?.slice(0, 80) }
}

export function readProjectInput(input: unknown): { pinned?: boolean; archived?: boolean; completed?: boolean; name?: string } {
  if (!input || typeof input !== "object") return {}
  const src = input as Record<string, unknown>
  const rawName = typeof src.name === "string" ? src.name : typeof src.job_query === "string" ? src.job_query : undefined
  return {
    pinned: flag(src.pinned),
    archived: flag(src.archived),
    completed: flag(src.completed),
    name: rawName?.slice(0, 80),
  }
}

export async function runAskTool(reader: AskReader, user: AskUser, name: string | undefined, input: unknown) {
  try {
    if (name === "lookup_schedule") return await lookupSchedule(reader, user, readToolInput(input))
    if (name === "lookup_hours") return await lookupHours(reader, user, readToolInput(input))
    if (name === "lookup_projects") return await lookupProjects(reader, user, readProjectInput(input))
    if (name === "job_summary") return await lookupJobSummary(reader, user, readJobSummaryInput(input))
    if (name === "lookup_quotes") return await lookupQuotes(reader, user, readQuoteInput(input))
    return { error: "That lookup is not available." }
  } catch (err) {
    if (err instanceof AskReadError) return { error: "The schedule couldn't be read. Try again." }
    return { error: "The schedule couldn't be read. Try again." }
  }
}
