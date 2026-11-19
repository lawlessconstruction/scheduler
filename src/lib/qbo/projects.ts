import type { SupabaseClient } from "@supabase/supabase-js"
import { customerEmail, listOf, qboGet, qboGraphql, qboPost, qboQuery, QboApiError } from "./api"
import { likeExact } from "./access"
import { schemaHint } from "./db"
import {
  billEmail,
  matchBuilderName,
  matchProjects,
  normaliseJobName,
  pickProjectRef,
  projectChoices,
  projectDisplayName,
  soleProjectRef,
  type JobName,
  type ProjectRefCandidate,
} from "./names"
import { qboId, qboQuote } from "./payload"

const PAGE = 1000
const PAGE_CAP = 20

export type QboCustomer = JobName & { email: string; job: boolean }

export type ProjectResult = {
  status: number
  body: {
    qboProjectId: string | null
    qboProjectName: string | null
    created: boolean
    linked: boolean
    canCreate: boolean
    candidates: { id: string; name: string }[]
    message: string
    billEmail: string
  }
}

type SchedulerProject = {
  id: string
  name: string
  client: string | null
  client_id: string | null
  qbo_project_id: string | null
}

type ClientRow = { id: string; name: string | null; qbo_customer_id: string | null }

const creating = new Map<string, Promise<ProjectResult>>()

function result(status: number, patch: Partial<ProjectResult["body"]> & { message?: string }): ProjectResult {
  return {
    status,
    body: {
      qboProjectId: null,
      qboProjectName: null,
      created: false,
      linked: false,
      canCreate: false,
      candidates: [],
      message: "",
      billEmail: "",
      ...patch,
    },
  }
}

function parentOf(row: Record<string, unknown>): string | null {
  const parent = row.ParentRef
  if (!parent || typeof parent !== "object") return null
  return qboId((parent as { value?: unknown }).value)
}

export function presentCustomer(row: Record<string, unknown>): QboCustomer | null {
  if (row.Active === false) return null
  const id = qboId(row.Id)
  const name = typeof row.DisplayName === "string" ? row.DisplayName.trim() : ""
  if (!id || !name) return null
  return {
    id,
    name,
    parentId: parentOf(row),
    email: customerEmail(row),
    job: row.Job === true || row.IsProject === true,
  }
}

function jobsOf(customers: readonly QboCustomer[]): JobName[] {
  return customers.filter((customer) => customer.job).map(({ id, name, parentId }) => ({ id, name, parentId }))
}

function choiceList(jobName: string, customers: readonly QboCustomer[], builderId: string | null) {
  return projectChoices(jobName, jobsOf(customers), builderId).map((job) => ({ id: job.id, name: job.name }))
}

function graphqlNodeId(value: unknown): string | null {
  const id = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
  if (!id || id.length > 80 || /\s/.test(id)) return null
  return id
}

export async function listActiveCustomers(): Promise<QboCustomer[]> {
  const found: QboCustomer[] = []
  for (let page = 0; page < PAGE_CAP; page++) {
    const start = page * PAGE + 1
    const response = await qboQuery(`select * from Customer where Active = true startposition ${start} maxresults ${PAGE}`)
    const rows = listOf<Record<string, unknown>>(response.Customer)
    for (const row of rows) {
      const customer = presentCustomer(row)
      if (customer) found.push(customer)
    }
    if (rows.length < PAGE) return found
  }
  throw new QboApiError("QuickBooks has too many customers to match a project safely. Nothing was created.", 500)
}

async function readCustomer(customerId: string): Promise<QboCustomer | null> {
  const json = await qboGet(`customer/${encodeURIComponent(customerId)}`)
  const customer = json.Customer
  if (!customer || typeof customer !== "object") return null
  return presentCustomer(customer as Record<string, unknown>)
}

function refValue(value: unknown): string | null {
  if (value && typeof value === "object" && "value" in value) return qboId((value as { value?: unknown }).value)
  return qboId(value)
}

async function listGraphqlProjects(): Promise<ProjectRefCandidate[]> {
  const found: ProjectRefCandidate[] = []
  let after: string | null = null
  for (let page = 0; page < PAGE_CAP; page++) {
    const data = await qboGraphql(
      `query projectManagementProjects($first: PositiveInt!, $after: String, $filter: ProjectManagement_ProjectFilter!) {
        projectManagementProjects(first: $first, after: $after, filter: $filter) {
          edges { node { id name customer { id } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { first: 100, after, filter: { deleted: false } },
    )
    const connection = data.projectManagementProjects
    if (!connection || typeof connection !== "object") break
    const edges = (connection as { edges?: unknown }).edges
    const pageInfo = (connection as { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } }).pageInfo
    for (const edge of listOf<{ node?: { id?: unknown; name?: unknown; customer?: { id?: unknown } } }>(edges)) {
      const node = edge?.node
      const id = graphqlNodeId(node?.id)
      const name = typeof node?.name === "string" ? node.name.trim() : ""
      if (!id || !name) continue
      found.push({ id, name, customerId: qboId(node?.customer?.id) })
    }
    const next = pageInfo?.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : null
    if (!next) break
    after = next
  }
  return found
}

async function projectRefFromInvoices(customerId: string): Promise<string | null> {
  try {
    const response = await qboQuery(
      `select Id, ProjectRef from Invoice where CustomerRef = '${qboQuote(customerId)}' maxresults 20`,
    )
    const refs = listOf<Record<string, unknown>>(response.Invoice).map((row) => refValue(row.ProjectRef))
    return soleProjectRef(refs)
  } catch {
    return null
  }
}

export async function lookupProjectRef(jobName: string, customerIds: string[]): Promise<string | null> {
  try {
    const projects = await listGraphqlProjects()
    const picked = pickProjectRef(projects.filter((project) => qboId(project.id)), jobName, customerIds)
    if (picked) return picked
  } catch {
    // The Projects API can be unavailable on this connection. The job customer still receives the invoice.
  }
  const customerId = customerIds.find((id) => qboId(id))
  if (!customerId) return null
  return projectRefFromInvoices(customerId)
}

async function loadSchedulerProject(db: SupabaseClient, projectId: string): Promise<SchedulerProject | { error: string }> {
  const loaded = await db
    .from("projects")
    .select("id, name, client, client_id, qbo_project_id")
    .eq("id", projectId)
    .maybeSingle()
  if (loaded.error) return { error: schemaHint(loaded.error.message) ?? loaded.error.message }
  const row = loaded.data as SchedulerProject | null
  if (!row?.id) return { error: "That job could not be found." }
  return row
}

async function loadClient(db: SupabaseClient, project: SchedulerProject): Promise<ClientRow | null | { error: string }> {
  if (project.client_id) {
    const found = await db.from("clients").select("id, name, qbo_customer_id").eq("id", project.client_id).maybeSingle()
    if (found.error) return { error: found.error.message }
    return (found.data as ClientRow | null) ?? null
  }
  const name = project.client?.trim() ?? ""
  if (!name) return null
  const found = await db.from("clients").select("id, name, qbo_customer_id").ilike("name", likeExact(name))
  if (found.error) return { error: found.error.message }
  const rows = (found.data ?? []) as ClientRow[]
  if (rows.length > 1) return { error: `More than one builder is named ${name}. Set the builder on the job, then try again.` }
  return rows[0] ?? null
}

async function rememberCustomer(db: SupabaseClient, clientId: string, customerId: string): Promise<string | { error: string }> {
  const saved = await db
    .from("clients")
    .update({ qbo_customer_id: customerId })
    .eq("id", clientId)
    .is("qbo_customer_id", null)
    .select("id, qbo_customer_id")
  if (saved.error) return { error: schemaHint(saved.error.message) ?? saved.error.message }
  if (saved.data && saved.data.length > 0) return customerId
  const again = await db.from("clients").select("qbo_customer_id").eq("id", clientId).maybeSingle()
  if (again.error) return { error: again.error.message }
  return qboId(again.data?.qbo_customer_id) ?? { error: "This builder was linked to a different QuickBooks customer." }
}

async function rememberProject(db: SupabaseClient, projectId: string, qboProjectId: string): Promise<string | { error: string }> {
  const saved = await db
    .from("projects")
    .update({ qbo_project_id: qboProjectId })
    .eq("id", projectId)
    .is("qbo_project_id", null)
    .select("id, qbo_project_id")
  if (saved.error) return { error: schemaHint(saved.error.message) ?? saved.error.message }
  if (saved.data && saved.data.length > 0) return qboProjectId
  const again = await db.from("projects").select("qbo_project_id").eq("id", projectId).maybeSingle()
  if (again.error) return { error: schemaHint(again.error.message) ?? again.error.message }
  const current = qboId(again.data?.qbo_project_id)
  return current ?? { error: "The QuickBooks project could not be saved on this job." }
}

async function replaceProject(db: SupabaseClient, projectId: string, qboProjectId: string): Promise<true | { error: string }> {
  const saved = await db
    .from("projects")
    .update({ qbo_project_id: qboProjectId })
    .eq("id", projectId)
    .select("id")
  if (saved.error) return { error: schemaHint(saved.error.message) ?? saved.error.message }
  if (!saved.data || saved.data.length === 0) return { error: "That job could not be found." }
  return true
}

function jobTitle(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? ""
  return trimmed || "this job"
}

function noEmailMessage(): string {
  return "This builder has no email address in QuickBooks, and the job project doesn't either, so the invoice was not created and nothing was sent. Add the builder's email on the customer in QuickBooks, then try again."
}

async function builderEmail(builderId: string, customers: readonly QboCustomer[]): Promise<string> {
  const known = customers.find((customer) => customer.id === builderId)
  if (known) return known.email
  const remote = await readCustomer(builderId)
  return remote?.email ?? ""
}

function ready(customer: QboCustomer, email: string, flags: { created?: boolean; linked?: boolean } = {}): ProjectResult {
  return result(200, {
    qboProjectId: customer.id,
    qboProjectName: customer.name,
    created: flags.created ?? false,
    linked: flags.linked ?? true,
    billEmail: email,
    message: "",
  })
}

async function resolveBuilderId(
  db: SupabaseClient,
  client: ClientRow,
  customers: readonly QboCustomer[],
): Promise<string | { error: string }> {
  const stored = qboId(client.qbo_customer_id)
  if (stored) return stored
  const matched = matchBuilderName(client.name ?? "", customers)
  if (matched.status === "many") {
    return { error: `More than one QuickBooks customer is named ${client.name}. Match the builder in Raise invoice, then create the project. The project was not created.` }
  }
  if (matched.status === "none") {
    return { error: `${client.name || "This builder"} isn't matched to a QuickBooks customer yet, so the project was not created. Match the builder in Raise invoice, then create the project there.` }
  }
  return rememberCustomer(db, client.id, matched.match.id)
}

// REST Customer.IsProject is read-only, so Job=true does not create a Projects-centre project.
// projectManagementCreateProject does. The invoice still uses the job sub-customer as CustomerRef,
// which is what Woodcode's existing invoices do, plus ProjectRef when the Projects API returns one.
async function createGraphqlProject(name: string, builderId: string): Promise<{ id: string; customerId: string | null }> {
  const data = await qboGraphql(
    `mutation ProjectManagementCreateProject($name: String!, $customer: ProjectManagement_CustomerInput, $status: ProjectManagement_Status) {
      projectManagementCreateProject(input: { name: $name, customer: $customer, status: $status }) {
        ... on ProjectManagement_Project { id name customer { id } }
      }
    }`,
    { name, customer: { id: builderId }, status: "OPEN" },
  )
  const created = data.projectManagementCreateProject
  if (!created || typeof created !== "object") {
    throw new QboApiError("QuickBooks did not return the project, so it was not linked.", 502)
  }
  const id = graphqlNodeId((created as { id?: unknown }).id)
  if (!id) throw new QboApiError("QuickBooks did not return a project id, so it was not linked.", 502)
  const customer = (created as { customer?: { id?: unknown } }).customer
  return { id, customerId: qboId(customer?.id) }
}

async function createSubCustomer(name: string, builderId: string): Promise<QboCustomer> {
  const created = await qboPost("customer", {
    DisplayName: name,
    Job: true,
    BillWithParent: true,
    ParentRef: { value: builderId },
  })
  const customer = created.Customer
  const parsed = customer && typeof customer === "object" ? presentCustomer(customer as Record<string, unknown>) : null
  if (!parsed?.job) throw new QboApiError("QuickBooks did not return the job customer for the new project.", 502)
  return parsed
}

function graphqlFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : "QuickBooks didn't respond."
  if (/scope|forbidden|not authorized|projects are not|feature/i.test(message)) {
    return "QuickBooks didn't allow Scheduler to create a project, so nothing was created. Create it in QuickBooks, then pick it in Raise invoice."
  }
  return `The QuickBooks project wasn't created. ${message}`
}

async function linkMatched(
  db: SupabaseClient,
  projectId: string,
  customer: QboCustomer,
  builderId: string,
  customers: readonly QboCustomer[],
): Promise<ProjectResult> {
  const saved = await rememberProject(db, projectId, customer.id)
  if (typeof saved !== "string") return result(500, { message: saved.error })
  const email = billEmail(await builderEmail(builderId, customers), customer.email) ?? ""
  if (saved === customer.id) return ready(customer, email, { linked: true })
  const current = await readCustomer(saved).catch(() => null)
  if (current?.job) return ready(current, billEmail(await builderEmail(builderId, customers), current.email) ?? "", { linked: true })
  const replaced = await replaceProject(db, projectId, customer.id)
  if (replaced !== true) return result(500, { message: replaced.error })
  return ready(customer, email, { linked: true })
}

export async function previewProject(db: SupabaseClient, projectId: string): Promise<ProjectResult> {
  const project = await loadSchedulerProject(db, projectId)
  if ("error" in project) return result(project.error.includes("could not be found") ? 404 : 500, { message: project.error })
  const title = jobTitle(project.name)
  const stored = qboId(project.qbo_project_id)
  if (stored) {
    try {
      const customer = await readCustomer(stored)
      if (customer?.job) {
        const client = await loadClient(db, project)
        const builderId = client && !("error" in client) ? qboId(client.qbo_customer_id) : null
        const email = billEmail(builderId ? await builderEmail(builderId, []) : "", customer.email) ?? ""
        return ready(customer, email, { linked: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "The saved QuickBooks project could not be checked."
      if (!/not found|could not be found|object not found/i.test(message)) return result(502, { message })
    }
  }

  let customers: QboCustomer[]
  try {
    customers = await listActiveCustomers()
  } catch (err) {
    const message = err instanceof Error ? err.message : "QuickBooks customers could not be loaded."
    return result(502, { message })
  }

  const client = await loadClient(db, project)
  if (client && "error" in client) return result(400, { message: client.error })
  if (!client) {
    return result(200, {
      message: `Link a builder to ${title} before choosing a QuickBooks project. Nothing has been invoiced.`,
      candidates: [],
    })
  }
  const builder = await resolveBuilderId(db, client, customers)
  if (typeof builder !== "string") return result(200, { message: builder.error })

  const matched = matchProjects(project.name, jobsOf(customers), builder)
  if (matched.status === "one") {
    const customer = customers.find((item) => item.id === matched.match.id)
    if (!customer) return result(500, { message: "The matching QuickBooks project could not be read." })
    return linkMatched(db, project.id, customer, builder, customers)
  }
  const candidates = choiceList(project.name, customers, builder)
  if (matched.status === "many") {
    return result(200, {
      message: `More than one QuickBooks project matches ${title}. Pick the right one. Nothing has been invoiced.`,
      candidates,
      canCreate: false,
      billEmail: billEmail(await builderEmail(builder, customers), "") ?? "",
    })
  }
  return result(200, {
    message: `No QuickBooks project matches ${title}. Pick one below, or create it under the builder. Nothing has been invoiced.`,
    candidates,
    canCreate: true,
    billEmail: billEmail(await builderEmail(builder, customers), "") ?? "",
  })
}

export async function linkChosenProject(db: SupabaseClient, projectId: string, qboProjectId: string): Promise<ProjectResult> {
  const id = qboId(qboProjectId)
  if (!id) return result(400, { message: "Pick a QuickBooks project." })
  const project = await loadSchedulerProject(db, projectId)
  if ("error" in project) return result(project.error.includes("could not be found") ? 404 : 500, { message: project.error })
  let customer: QboCustomer | null
  try {
    customer = await readCustomer(id)
  } catch (err) {
    const message = err instanceof Error ? err.message : "That QuickBooks project could not be checked."
    return result(502, { message })
  }
  if (!customer?.job) return result(400, { message: "Pick a QuickBooks project, not the builder. Nothing was invoiced." })
  const saved = await replaceProject(db, projectId, customer.id)
  if (saved !== true) return result(500, { message: saved.error })
  const client = await loadClient(db, project)
  const builderId = client && !("error" in client) ? qboId(client.qbo_customer_id) : null
  const email = billEmail(builderId ? await builderEmail(builderId, []) : "", customer.email) ?? ""
  return ready(customer, email, { linked: true })
}

async function createProjectNow(db: SupabaseClient, projectId: string): Promise<ProjectResult> {
  const looked = await previewProject(db, projectId)
  if (looked.body.qboProjectId) return looked
  if (!looked.body.canCreate) return looked.status === 200 ? result(400, looked.body) : looked

  const project = await loadSchedulerProject(db, projectId)
  if ("error" in project) return result(500, { message: project.error })
  const display = projectDisplayName(project.name)
  if (!display) return result(400, { message: "This job has no name, so a QuickBooks project was not created." })

  const client = await loadClient(db, project)
  if (!client || "error" in client) {
    return result(400, { message: !client ? "Link a builder to this job before creating a QuickBooks project." : client.error })
  }
  let customers: QboCustomer[]
  try {
    customers = await listActiveCustomers()
  } catch (err) {
    return result(502, { message: graphqlFailure(err) })
  }
  const builder = await resolveBuilderId(db, client, customers)
  if (typeof builder !== "string") return result(400, { message: builder.error })

  const again = matchProjects(display, jobsOf(customers), builder)
  if (again.status === "one") {
    const customer = customers.find((item) => item.id === again.match.id)
    if (customer) return linkMatched(db, projectId, customer, builder, customers)
  }
  if (again.status === "many") {
    return result(409, {
      message: `More than one QuickBooks project matches ${jobTitle(display)}. Pick the right one. A new project was not created.`,
      candidates: choiceList(display, customers, builder),
    })
  }

  const latest = await listActiveCustomers().catch(() => customers)
  const latestMatch = matchProjects(display, jobsOf(latest), builder)
  if (latestMatch.status === "one") {
    const customer = latest.find((item) => item.id === latestMatch.match.id)
    if (customer) return linkMatched(db, projectId, customer, builder, latest)
  }
  if (latestMatch.status === "many") {
    return result(409, {
      message: `More than one QuickBooks project matches ${jobTitle(display)}. Pick the right one. A new project was not created.`,
      candidates: choiceList(display, latest, builder),
    })
  }

  let graphqlCustomerId: string | null = null
  let createdNew = false
  try {
    let existing: ProjectRefCandidate[] = []
    try {
      existing = await listGraphqlProjects()
    } catch {
      existing = []
    }
    const wanted = normaliseJobName(display)
    const named = existing.filter((project) => normaliseJobName(project.name) === wanted)
    const scoped = named.filter((project) => project.customerId === builder || latest.some((customer) => customer.job && customer.id === project.customerId && customer.parentId === builder))
    if (scoped.length > 1) {
      return result(409, {
        message: `More than one QuickBooks project is named ${display}. Pick the job customer instead of creating another.`,
        candidates: choiceList(display, latest, builder),
      })
    }
    if (scoped.length === 1) {
      graphqlCustomerId = scoped[0].customerId
    } else {
      const created = await createGraphqlProject(display, builder)
      graphqlCustomerId = created.customerId
      createdNew = true
    }
  } catch (err) {
    return result(502, { message: graphqlFailure(err) })
  }

  let fresh: QboCustomer[]
  try {
    fresh = await listActiveCustomers()
  } catch (err) {
    return result(502, { message: `QuickBooks created the project, but the job customer could not be checked. ${err instanceof Error ? err.message : ""}`.trim() })
  }
  const fromGraphql = graphqlCustomerId && graphqlCustomerId !== builder
    ? fresh.find((customer) => customer.id === graphqlCustomerId && customer.job) ?? null
    : null
  if (fromGraphql) {
    const linked = await linkMatched(db, projectId, fromGraphql, builder, fresh)
    if (linked.body.qboProjectId) linked.body.created = createdNew
    return linked
  }
  const named = matchProjects(display, jobsOf(fresh), builder)
  if (named.status === "one") {
    const customer = fresh.find((item) => item.id === named.match.id)
    if (customer) {
      const linked = await linkMatched(db, projectId, customer, builder, fresh)
      if (linked.body.qboProjectId) linked.body.created = createdNew
      return linked
    }
  }
  if (named.status === "many") {
    return result(409, {
      message: `QuickBooks has more than one job named ${display}. Pick the right one. Another project was not created.`,
      candidates: choiceList(display, fresh, builder),
    })
  }
  try {
    const sub = await createSubCustomer(display, builder)
    const linked = await linkMatched(db, projectId, sub, builder, fresh)
    if (linked.body.qboProjectId) linked.body.created = true
    return linked
  } catch (err) {
    const message = err instanceof Error ? err.message : "The job customer could not be created."
    return result(502, { message: `The QuickBooks project exists, but it could not be linked to this job. ${message}` })
  }
}

export function createProject(db: SupabaseClient, projectId: string): Promise<ProjectResult> {
  const existing = creating.get(projectId)
  if (existing) return existing
  const promise = createProjectNow(db, projectId).finally(() => {
    if (creating.get(projectId) === promise) creating.delete(projectId)
  })
  creating.set(projectId, promise)
  return promise
}

export async function resolveInvoiceProject(
  db: SupabaseClient,
  project: { id: string; name: string | null; qbo_project_id?: string | null },
  builder: { id: string; email: string },
): Promise<{ customerId: string; projectName: string; projectRefId: string | null; email: string } | { error: string; status: number }> {
  const title = jobTitle(project.name)
  const stored = qboId(project.qbo_project_id)
  let customer: QboCustomer | null = null
  if (stored) {
    if (stored === builder.id) {
      return { error: `This job points at the builder in QuickBooks, not the job project. Pick the project in the Raise invoice window. Nothing was invoiced.`, status: 400 }
    }
    try {
      customer = await readCustomer(stored)
    } catch (err) {
      const message = err instanceof Error ? err.message : "The saved QuickBooks project could not be checked."
      return { error: message, status: 502 }
    }
    if (!customer?.job) {
      return { error: `The QuickBooks project saved on ${title} could not be found. Pick it again in the Raise invoice window. Nothing was invoiced.`, status: 400 }
    }
  } else {
    let customers: QboCustomer[]
    try {
      customers = await listActiveCustomers()
    } catch (err) {
      const message = err instanceof Error ? err.message : "QuickBooks customers could not be loaded."
      return { error: message, status: 502 }
    }
    const matched = matchProjects(project.name ?? "", jobsOf(customers), builder.id)
    if (matched.status === "none") {
      return { error: `No QuickBooks project matches ${title}. Nothing was invoiced. In Raise invoice, pick the project or create it, then try again.`, status: 400 }
    }
    if (matched.status === "many") {
      return { error: `More than one QuickBooks project matches ${title}. Nothing was invoiced. Pick the right one in Raise invoice.`, status: 400 }
    }
    customer = customers.find((item) => item.id === matched.match.id) ?? null
    if (!customer) return { error: `No QuickBooks project matches ${title}. Nothing was invoiced.`, status: 400 }
    const saved = await rememberProject(db, project.id, customer.id)
    if (typeof saved !== "string") return { error: saved.error, status: 500 }
    if (saved !== customer.id) {
      const other = await readCustomer(saved)
      if (!other?.job) return { error: "The QuickBooks project saved on this job could not be read. Nothing was invoiced.", status: 500 }
      customer = other
    }
  }

  const email = billEmail(builder.email, customer.email)
  if (!email) return { error: noEmailMessage(), status: 400 }
  const projectRefId = await lookupProjectRef(customer.name, [customer.id, builder.id])
  return { customerId: customer.id, projectName: customer.name, projectRefId, email }
}
