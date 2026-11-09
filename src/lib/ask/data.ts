import {
  CREW_COLUMNS,
  CREWMATE_COLUMNS,
  LABEL_COLUMNS,
  PROJECT_COLUMNS,
  SEGMENT_COLUMNS,
  TIMESHEET_COLUMNS,
  WORKER_LOOKUP_COLUMNS,
} from "./columns"
import { COMPANY_HOURS_MAX_DAYS, HOURS_MAX_DAYS, SCHEDULE_MAX_DAYS, parseRange } from "./dates"
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
  eq(column: string, value: string): Filter
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

type Project = { id: string; name: string; client: string | null; archived: boolean }
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

function text(value: unknown): string | null {
  if (value == null) return null
  const str = String(value).trim()
  return str || null
}

function day(value: unknown): string {
  return String(value ?? "").slice(0, 10)
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
    const { data, error } = await reader.from(table).select(columns).in(column, chunk).limit(PAGE)
    if (error) throw new AskReadError()
    rows.push(...(data ?? []))
    if ((data ?? []).length >= PAGE) break
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

async function loadProjects(reader: AskReader, ids: string[]): Promise<Project[]> {
  const rows = await loadIn(reader, "projects", PROJECT_COLUMNS, "id", ids)
  return rows.map((row) => ({
    id: String(row.id),
    name: text(row.name) ?? "Untitled job",
    client: text(row.client),
    archived: row.archived === true,
  }))
}

async function findProjectsByName(reader: AskReader, query: string): Promise<{ projects: Project[]; truncated: boolean }> {
  const pattern = containsPattern(query)
  if (!pattern) return { projects: [], truncated: false }
  const { data, error } = await reader
    .from("projects")
    .select(PROJECT_COLUMNS)
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(40)
  if (error) throw new AskReadError()
  const rows = data ?? []
  return {
    truncated: rows.length >= 40,
    projects: rows.map((row) => ({
      id: String(row.id),
      name: text(row.name) ?? "Untitled job",
      client: text(row.client),
      archived: row.archived === true,
    })),
  }
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

  const jobs = args.segments.slice(0, 60).map((segment) => {
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
      crew: crewLabel(crewsById.get(segment.crew_id)),
      starts: segment.start_date,
      ends: segment.end_date,
      ...(block ? { block } : {}),
      ...(notes ? { notes } : {}),
      ...(dayNotes.length ? { day_notes: dayNotes } : {}),
      people: peopleByCrew.get(segment.crew_id) ?? [],
    }
  })

  return {
    about: args.about,
    from: args.from,
    to: args.to,
    jobs,
    ...(jobs.length === 0 ? { note: args.emptyNote } : {}),
    ...(args.truncated || args.segments.length > 60 ? { truncated: true, note: "Some bookings were left out. Ask about fewer days or one street." } : {}),
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
  const [projects, crewRows, labelRows, peopleRows] = await Promise.all([
    loadProjects(reader, projectIds),
    loadIn(reader, "crews", CREW_COLUMNS, "id", crewIds),
    loadLabels(reader, projectIds, from, to),
    loadIn(reader, "workers", CREWMATE_COLUMNS, "crew_id", crewIds),
  ])
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
    segments,
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
  const mine = await segmentsOverlapping(reader, from, to, { kind: "crew", crewId }, 300)
  const projects = await loadProjects(reader, mine.segments.map((segment) => segment.project_id))
  const matched = jobQuery
    ? projects.filter((project) => project.name.toLowerCase().includes(jobQuery))
    : projects
  const ids = matched.map((project) => project.id)
  if (jobQuery && ids.length === 0) {
    return { about, from, to, jobs: [], note: notOnJob }
  }
  if (ids.length === 0) {
    return { about, from, to, jobs: [], note: nothing }
  }
  // Other crews on the same jobs, same dates. Not their other jobs.
  const expanded = await segmentsOverlapping(reader, from, to, { kind: "projects", projectIds: ids }, 300)
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
    const loaded = await segmentsOverlapping(reader, range.from, range.to, { kind: "projects", projectIds: found.projects.map((project) => project.id) }, 200)
    segments = loaded.segments
    truncated = loaded.truncated || found.truncated
  } else {
    const loaded = await segmentsOverlapping(reader, range.from, range.to, { kind: "all" }, 200)
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
    return query.order("date", { ascending: true }).order("id", { ascending: true }).range(start, end)
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
  const projects = await loadProjects(reader, projectIds)
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
  })
  return {
    worker: name,
    scope,
    from,
    to,
    ...sumHours(loaded.rows),
    days,
    ...(loaded.truncated ? { truncated: true, note: "Some days were left out. Ask about a shorter period." } : {}),
  }
}

export async function lookupHours(reader: AskReader, user: AskUser, input: { from?: unknown; to?: unknown; person?: string }) {
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

  // Boss, whole company, short window. Totals only — no one else's notes.
  const loaded = await loadTimesheets(reader, range.from, range.to, null, 2000)
  const workerIds = [...new Set(loaded.rows.map((row) => row.worker_id))]
  const nameRows = await loadIn(reader, "workers", WORKER_LOOKUP_COLUMNS, "id", workerIds)
  const names = new Map(nameRows.map((row) => [String(row.id), text(row.name) ?? "Unnamed"]))
  const byWorker = new Map<string, Timesheet[]>()
  for (const row of loaded.rows) {
    const list = byWorker.get(row.worker_id) ?? []
    list.push(row)
    byWorker.set(row.worker_id, list)
  }
  const people = [...byWorker.entries()]
    .map(([id, rows]) => ({ name: names.get(id) ?? "Unnamed", ...sumHours(rows) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    scope: "company",
    from: range.from,
    to: range.to,
    ...sumHours(loaded.rows),
    people,
    ...(loaded.truncated ? { truncated: true, note: "Some hours were left out. Ask about fewer days or one person." } : {}),
  }
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

export async function runAskTool(reader: AskReader, user: AskUser, name: string | undefined, input: unknown) {
  const args = readToolInput(input)
  try {
    if (name === "lookup_schedule") return await lookupSchedule(reader, user, args)
    if (name === "lookup_hours") return await lookupHours(reader, user, args)
    return { error: "That lookup is not available." }
  } catch (err) {
    if (err instanceof AskReadError) return { error: "The schedule couldn't be read. Try again." }
    return { error: "The schedule couldn't be read. Try again." }
  }
}
