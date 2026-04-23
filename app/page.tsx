"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../src/lib/supabase"

type Project = {
  id: string
  name: string
  client: string | null
  client_id: string | null
  archived: boolean | null
  contract_value: number | null
  profitability_included: boolean | null
}

type Extra = {
  id: string
  project_id: string | null
  title: string
  status: string
  issued_date: string | null
  notes: string | null
  created_at: string
}

type ExtraItem = {
  id: string
  extra_id: string
  description: string | null
  charge_type: string
  worker_id: string | null
  ordinary_hours: number
  ot_hours: number
  unit_cost: number
  margin_percent: number
  sort_order: number
}

type EstimateTemplate = {
  id: string
  name: string
  quote_type: string | null
  description: string | null
  sort_order: number
}

type EstimateTemplateItem = {
  id: string
  template_id: string
  category: string
  description: string | null
  quantity: number
  unit: string
  unit_cost: number
  margin_percent: number
  scope: string | null
  sort_order: number
}

type ScopeTemplate = {
  id: string
  name: string
  category: string
  scope: string | null
  sort_order: number
}

type Estimate = {
  id: string
  project_id: string | null
  client_id: string | null
  title: string
  version: number
  status: string
  issued_date: string | null
  valid_until: string | null
  notes: string | null
  terms: string | null
  quote_type: string | null
  created_at: string
}

type EstimateItem = {
  id: string
  estimate_id: string
  category: string
  description: string
  crew_id: string | null
  quantity: number
  unit: string
  unit_cost: number
  margin_percent: number
  sort_order: number
  scope: string | null
}

type Client = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  notes: string | null
}

type Worker = {
  id: string
  name: string
  crew_id: string | null
  role: string | null
  classification: string | null
  employment_type: string | null
  base_rate_hourly: number | null
  ot_rate_hourly: number | null
  super_hourly: number | null
  annual_leave_hourly: number | null
  personal_leave_hourly: number | null
  long_service_leave_hourly: number | null
  travel_allowance_hourly: number | null
  workcover_hourly: number | null
  public_hols_hourly: number | null
  total_cost_hourly: number | null
  total_cost_hourly_with_ot: number | null
  standard_charge_rate: number | null
  phone: string | null
  email: string | null
  start_date: string | null
  notes: string | null
  sub_super_workcover: boolean | null
  sort_order: number
}

type ClassificationRate = {
  id: string
  classification: string
  rate_ex_gst: number
  effective_from: string
}

type Crew = {
  id: string
  name: string
  color: string | null
  capacity: number | null
}

type Segment = {
  id: string
  name: string | null
  project_id: string
  crew_id: string
  contract_id: string | null
  start_date: string
  end_date: string
  capacity_fraction: number | null
  notes: string | null
  projects?: { name: string } | null
  crews?: { name: string; color: string | null; capacity: number | null } | null
}

type DayLabel = {
  id: string
  project_id: string
  date: string
  label: string
  projects?: { name: string } | null
}

type CellEditorState = {
  open: boolean
  projectId: string
  projectName: string
  date: string
  segmentId: string
  labelId: string
  existingSegmentIds: string[]
}

type CrewAvailabilityGap = {
  crew_id: string
  crew_name: string
  gap_start: string
  gap_end: string
  free_days: number
}

type ProfitabilityRow = {
  project_id: string
  project_name: string
  client: string | null
  profitability_included: boolean | null
  total_contract_value: number
  total_milestones_value: number
  total_labour_base_cost: number
  total_labour_true_cost: number
  total_ordinary_hours: number
  total_ot_hours: number
  total_materials_cost: number
  total_materials_only: number
  total_subcontractor_cost: number
  total_equipment_cost: number
  total_prelims_cost: number
}

type ProjectCost = {
  id: string
  project_id: string
  segment_id: string | null
  category: string
  description: string
  supplier: string | null
  amount: number
  date: string | null
  invoice_number: string | null
  notes: string | null
  date_trigger: string | null
  cost_group: string | null
  effective_date: string | null
}

type TimesheetEntry = {
  id: string
  date: string
  worker_id: string
  project_id: string | null
  segment_id: string | null
  ordinary_hours: number
  ot_hours: number
  notes: string | null
  entered_by: string | null
}

type TopModalType = "addProject" | "addSegment" | null

type ContractType = {
  id: string
  name: string
  default_milestone_count: number
  sort_order: number
}

type ContractTypeMilestone = {
  id: string
  contract_type_id: string
  name: string | null
  percent: number | null
  sort_order: number
}

type Contract = {
  id: string
  project_id: string
  name: string | null
  value: number | null
  color: string | null
  sort_order: number
}

type Milestone = {
  id: string
  project_id: string
  contract_id: string | null
  name: string | null
  amount: number | null
  percent: number | null
  segment_id: string | null
  due_date_override: string | null
  sort_order: number
}

type MilestoneModalState = {
  open: boolean
  projectId: string
  projectName: string
  focusedMilestoneId: string | null
}

type ProjectEditorState = {
  open: boolean
  projectId: string
  name: string
  client: string
  archived: boolean
  contract_value: string
}

const DAY_COL_WIDTH = 80
const ROW_HEADER_WIDTH = 340
const BAR_HEIGHT = 32
const LANE_GAP = 6
const ROW_PADDING_TOP = 12
const ROW_PADDING_BOTTOM = 12
const MIN_ROW_HEIGHT = 56

const baseButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #3f3f46",
  cursor: "pointer",
  color: "white",
  background: "#2563eb",
  fontWeight: 600,
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #3f3f46",
  cursor: "pointer",
  color: "white",
  background: "#27272a",
  fontWeight: 600,
}

const dangerButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #7f1d1d",
  cursor: "pointer",
  color: "white",
  background: "#b91c1c",
  fontWeight: 600,
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: "#1e2535",
  color: "white",
  border: "1px solid #52525b",
  outline: "none",
  boxSizing: "border-box",
}

const textareaStyle: React.CSSProperties = {
  ...fieldStyle,
  minHeight: 96,
  resize: "vertical",
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#d4d4d8",
  marginBottom: 6,
}

const helperStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#a1a1aa",
  marginTop: 6,
}

const sectionCardStyle: React.CSSProperties = {
  border: "1px solid #2e3650",
  borderRadius: 12,
  padding: 16,
  background: "#161d2e",
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={labelStyle}>{children}</div>
}

function formatMoney(value: number) {
  return value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMoneyK(value: number) {
  return (value / 1000).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "k"
}

function parseDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  })
}

function formatLongDateLabel(dateStr: string) {
  const date = parseDate(dateStr)
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getDates(start: Date, end: Date) {
  const dates: Date[] = []
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const finish = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (current <= finish) {
    dates.push(new Date(current.getFullYear(), current.getMonth(), current.getDate()))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function compareDateStrings(a: string, b: string) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function isDateWithinRange(dateKey: string, start: string, end: string) {
  return start <= dateKey && end >= dateKey
}

function countWorkingDaysInclusive(start: string, end: string) {
  let current = parseDate(start)
  const finish = parseDate(end)
  let count = 0

  while (current <= finish) {
    if (!isWeekend(current)) count += 1
    current.setDate(current.getDate() + 1)
  }

  return count
}

function addWorkingDaysInclusive(startDate: string, workingDays: number) {
  const start = parseDate(startDate)

  if (workingDays <= 1) {
    return formatDateKey(start)
  }

  let remaining = workingDays - 1
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())

  while (remaining > 0) {
    current.setDate(current.getDate() + 1)
    if (!isWeekend(current)) {
      remaining -= 1
    }
  }

  return formatDateKey(current)
}

function addCalendarDays(dateStr: string, days: number) {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return formatDateKey(d)
}

function nextWorkingDate(dateStr: string) {
  const d = parseDate(dateStr)
  do {
    d.setDate(d.getDate() + 1)
  } while (isWeekend(d))
  return formatDateKey(d)
}

function previousWorkingDate(dateStr: string) {
  const d = parseDate(dateStr)
  do {
    d.setDate(d.getDate() - 1)
  } while (isWeekend(d))
  return formatDateKey(d)
}

function normaliseSegmentToWorkingDays(start: string, end: string) {
  let workingDays = countWorkingDaysInclusive(start, end)

  if (workingDays < 1) {
    workingDays = 1
  }

  const startObj = parseDate(start)
  let safeStart = start

  if (isWeekend(startObj)) {
    const adjusted = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate())
    while (isWeekend(adjusted)) {
      adjusted.setDate(adjusted.getDate() + 1)
    }
    safeStart = formatDateKey(adjusted)
  }

  const safeEnd = addWorkingDaysInclusive(safeStart, workingDays)

  return {
    start_date: safeStart,
    end_date: safeEnd,
    working_days: workingDays,
  }
}

function getDateIndexMap(dates: Date[]) {
  const map = new Map<string, number>()
  dates.forEach((date, index) => {
    map.set(formatDateKey(date), index)
  })
  return map
}

function getWorkingRuns(start: string, end: string, dates: Date[], dateIndexMap: Map<string, number>) {
  const startIndex = dateIndexMap.get(start)
  const endIndex = dateIndexMap.get(end)

  if (startIndex === undefined || endIndex === undefined) return []

  const runs: Array<{ startIndex: number; endIndex: number }> = []
  let runStart: number | null = null

  for (let i = startIndex; i <= endIndex; i += 1) {
    const weekend = isWeekend(dates[i])

    if (!weekend) {
      if (runStart === null) {
        runStart = i
      }
    } else if (runStart !== null) {
      runs.push({ startIndex: runStart, endIndex: i - 1 })
      runStart = null
    }
  }

  if (runStart !== null) {
    runs.push({ startIndex: runStart, endIndex })
  }

  return runs
}

function getDateKeyFromPointer(clientX: number, container: HTMLDivElement, dates: Date[]) {
  const rect = container.getBoundingClientRect()
  const x = clientX - rect.left
  const rawIndex = Math.floor(x / DAY_COL_WIDTH)
  const index = Math.max(0, Math.min(dates.length - 1, rawIndex))
  return formatDateKey(dates[index])
}

function assignLanes(segments: Segment[]) {
  const lanes: Segment[][] = []

  const sorted = [...segments].sort((a, b) => {
    const byStart = compareDateStrings(a.start_date, b.start_date)
    if (byStart !== 0) return byStart
    return compareDateStrings(a.end_date, b.end_date)
  })

  for (const seg of sorted) {
    let placed = false

    for (const lane of lanes) {
      const overlaps = lane.some(
        (existing) => !(seg.end_date < existing.start_date || seg.start_date > existing.end_date)
      )

      if (!overlaps) {
        lane.push(seg)
        placed = true
        break
      }
    }

    if (!placed) {
      lanes.push([seg])
    }
  }

  return lanes
}

function getRowHeight(laneCount: number) {
  return Math.max(
    MIN_ROW_HEIGHT,
    ROW_PADDING_TOP + ROW_PADDING_BOTTOM + laneCount * BAR_HEIGHT + Math.max(0, laneCount - 1) * LANE_GAP
  )
}

function getSegmentConflictInfo(segment: Segment, allSegments: Segment[], dates: Date[]) {
  const crewCapacity = Number(segment.crews?.capacity ?? 1)
  let maxTotalCapacity = 0

  for (const date of dates) {
    if (isWeekend(date)) continue

    const dateKey = formatDateKey(date)
    if (!isDateWithinRange(dateKey, segment.start_date, segment.end_date)) continue

    const totalCapacityForDay = allSegments
      .filter(
        (other) =>
          other.crew_id === segment.crew_id &&
          isDateWithinRange(dateKey, other.start_date, other.end_date)
      )
      .reduce((sum, item) => sum + Number(item.capacity_fraction ?? 1), 0)

    if (totalCapacityForDay > maxTotalCapacity) {
      maxTotalCapacity = totalCapacityForDay
    }
  }

  return {
    crewCapacity,
    maxTotalCapacity,
    conflict: maxTotalCapacity > crewCapacity,
  }
}

function clampSegmentToWindow(segment: Segment, windowStart: string, windowEnd: string) {
  return {
    ...segment,
    start_date: segment.start_date < windowStart ? windowStart : segment.start_date,
    end_date: segment.end_date > windowEnd ? windowEnd : segment.end_date,
  }
}

function findCrewAvailability(
  crews: Crew[],
  segments: Segment[],
  windowStart: string,
  weeks: number,
  minimumFreeDays: number
) {
  const windowEnd = addCalendarDays(windowStart, weeks * 7 - 1)
  const results: CrewAvailabilityGap[] = []

  for (const crew of crews) {
    const crewSegments = segments
      .filter(
        (s) =>
          s.crew_id === crew.id &&
          s.end_date >= windowStart &&
          s.start_date <= windowEnd
      )
      .map((s) => clampSegmentToWindow(s, windowStart, windowEnd))
      .sort((a, b) => {
        const byStart = compareDateStrings(a.start_date, b.start_date)
        if (byStart !== 0) return byStart
        return compareDateStrings(a.end_date, b.end_date)
      })

    let cursor = windowStart
    while (cursor <= windowEnd && isWeekend(parseDate(cursor))) {
      cursor = nextWorkingDate(previousWorkingDate(cursor))
    }

    for (const booking of crewSegments) {
      if (cursor < booking.start_date) {
        const gapEnd = previousWorkingDate(booking.start_date)

        if (cursor <= gapEnd) {
          const freeDays = countWorkingDaysInclusive(cursor, gapEnd)
          if (freeDays >= minimumFreeDays) {
            results.push({
              crew_id: crew.id,
              crew_name: crew.name,
              gap_start: cursor,
              gap_end: gapEnd,
              free_days: freeDays,
            })
          }
        }
      }

      cursor = nextWorkingDate(booking.end_date)
      if (cursor > windowEnd) break
    }

    if (cursor <= windowEnd) {
      let adjustedEnd = windowEnd

      while (adjustedEnd > cursor && isWeekend(parseDate(adjustedEnd))) {
        adjustedEnd = previousWorkingDate(adjustedEnd)
      }

      if (cursor <= adjustedEnd) {
        const freeDays = countWorkingDaysInclusive(cursor, adjustedEnd)
        if (freeDays >= minimumFreeDays) {
          results.push({
            crew_id: crew.id,
            crew_name: crew.name,
            gap_start: cursor,
            gap_end: adjustedEnd,
            free_days: freeDays,
          })
        }
      }
    }
  }

  return results.sort((a, b) => {
    const byStart = compareDateStrings(a.gap_start, b.gap_start)
    if (byStart !== 0) return byStart
    if (b.free_days !== a.free_days) return b.free_days - a.free_days
    return a.crew_name.localeCompare(b.crew_name)
  })
}


function LoginScreen({ onLogin }: { onLogin: (user: { id: string; name: string; app_role: string; crew_id: string | null }) => void }) {
  const [email, setEmail] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || pin.length < 4) { setError("Enter your email and 4-digit PIN"); return }
    setLoading(true); setError("")
    const { data, error: dbError } = await supabase.from("workers").select("id, name, app_role, crew_id, pin, email").ilike("email", email.trim()).single()
    if (dbError || !data) { setError("Email not found. Ask your boss to add you."); setLoading(false); return }
    if (data.pin !== pin) { setError("Wrong PIN. Try again."); setLoading(false); return }
    onLogin({ id: data.id, name: data.name, app_role: data.app_role ?? "worker", crew_id: data.crew_id })
  }

  function handlePinKey(digit: string) { if (pin.length < 4) setPin(p => p + digit) }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <img src="/lawless-logo.png" alt="Lawless Construction" style={{ height: 56, width: "auto", objectFit: "contain", marginBottom: 40 }} />
      <div style={{ width: "100%", maxWidth: 380, background: "#1e2535", border: "1px solid #2e3a58", borderRadius: 16, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f4ff", marginBottom: 6 }}>Sign in</div>
        <div style={{ fontSize: 13, color: "#6b7a9a", marginBottom: 28 }}>Lawless Construction — Operations</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899bb", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Email</div>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError("") }}
            placeholder="your@email.com" onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "#111827", border: "1.5px solid #2e3a58", color: "#f0f4ff", fontSize: 15, outline: "none", boxSizing: "border-box" as const }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899bb", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>PIN</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 56, height: 56, borderRadius: 12, background: pin.length > i ? "#2563eb" : "#111827", border: `2px solid ${pin.length > i ? "#3b82f6" : "#2e3a58"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white" }}>
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {["1","2","3","4","5","6","7","8","9"].map(d => (
              <button key={d} type="button" onClick={() => handlePinKey(d)}
                style={{ padding: "18px", borderRadius: 12, fontSize: 20, fontWeight: 700, background: "#141a28", border: "1.5px solid #2e3a58", color: "#f0f4ff", cursor: "pointer" }}>{d}</button>
            ))}
            <div />
            <button type="button" onClick={() => handlePinKey("0")}
              style={{ padding: "18px", borderRadius: 12, fontSize: 20, fontWeight: 700, background: "#141a28", border: "1.5px solid #2e3a58", color: "#f0f4ff", cursor: "pointer" }}>0</button>
            <button type="button" onClick={() => setPin(p => p.slice(0, -1))}
              style={{ padding: "18px", borderRadius: 12, fontSize: 20, background: "#141a28", border: "1.5px solid #2e3a58", color: "#6b7a9a", cursor: "pointer" }}>⌫</button>
          </div>
        </div>

        {error && <div style={{ background: "#2a1010", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16 }}>{error}</div>}

        <button type="button" onClick={handleLogin} disabled={loading || pin.length < 4 || !email.trim()}
          style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 16, fontWeight: 800, background: pin.length === 4 && email.trim() ? "linear-gradient(135deg, #1e3a6e, #2563eb)" : "#1a2035", border: "1.5px solid #2563eb", color: pin.length === 4 && email.trim() ? "white" : "#4a6080", cursor: pin.length === 4 && email.trim() ? "pointer" : "default" }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: "#2e3a58" }}>Lawless Construction Operations System</div>
    </div>
  )
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [labels, setLabels] = useState<DayLabel[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [contractTypeMilestones, setContractTypeMilestones] = useState<ContractTypeMilestone[]>([])
  const [showContractTypesModal, setShowContractTypesModal] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [showClientsModal, setShowClientsModal] = useState(false)
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([])
  const [showEstimatesModal, setShowEstimatesModal] = useState(false)
  const [showExtrasModal, setShowExtrasModal] = useState(false)
  const [extras, setExtras] = useState<Extra[]>([])
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([])
  const [activeExtraId, setActiveExtraId] = useState<string | null>(null)
  const [quickAddProject, setQuickAddProject] = useState(false)
  const [quickProjectForm, setQuickProjectForm] = useState({ name: "", client_id: "", client: "" })
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null)
  const [scopeTemplates, setScopeTemplates] = useState<ScopeTemplate[]>([])
  const [estimateTemplates, setEstimateTemplates] = useState<EstimateTemplate[]>([])
  const [estimateTemplateItems, setEstimateTemplateItems] = useState<EstimateTemplateItem[]>([])
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([])
  const [costsModal, setCostsModal] = useState<{ open: boolean; projectId: string; projectName: string } | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [classificationRates, setClassificationRates] = useState<ClassificationRate[]>([])
  const [showWorkersModal, setShowWorkersModal] = useState(false)
  const [selectedWorkerCrew, setSelectedWorkerCrew] = useState<string>("all")
  const [showTimesheetModal, setShowTimesheetModal] = useState(false)
  const [showCashflowModal, setShowCashflowModal] = useState(false)
  const [cashflowView, setCashflowView] = useState<"weekly" | "monthly">("monthly")
  const [showProfitabilityModal, setShowProfitabilityModal] = useState(false)
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityRow[]>([])
  const [selectedProfitProjects, setSelectedProfitProjects] = useState<Set<string>>(new Set())
  const [timesheetWeekStart, setTimesheetWeekStart] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return formatDateKey(d)
  })
  const [timesheetCrewId, setTimesheetCrewId] = useState<string>("")
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([])
  const [timesheetLoading, setTimesheetLoading] = useState(false)
  const [companyCost, setCompanyCost] = useState<{
    total_workers: number
    company_blended_hourly: number
    company_rate_30pct: number
    company_rate_40pct: number
    company_rate_50pct: number
    company_cost_per_person_per_day: number
    company_cost_per_person_per_week: number
  } | null>(null)
  const [milestoneModal, setMilestoneModal] = useState<MilestoneModalState>({ open: false, projectId: "", projectName: "", focusedMilestoneId: null })
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showChangePinModal, setShowChangePinModal] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; app_role: string; crew_id: string | null } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [draggingToken, setDraggingToken] = useState<string | null>(null)
  const [todayKey, setTodayKey] = useState<string | null>(null)
  const [topModal, setTopModal] = useState<TopModalType>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [ganttExtendWeeks, setGanttExtendWeeks] = useState(4)
  const ganttScrollRef = useRef<HTMLDivElement>(null)

  const [projectEditor, setProjectEditor] = useState<ProjectEditorState>({
    open: false,
    projectId: "",
    name: "",
    client: "",
    archived: false,
    contract_value: "",
  })

  const [segmentForm, setSegmentForm] = useState({
    project_id: "",
    crew_id: "",
    name: "",
    start_date: "",
    end_date: "",
    capacity_fraction: "1",
    notes: "",
  })

  const [projectForm, setProjectForm] = useState({
    name: "",
    client: "",
  })

  const [showAvailability, setShowAvailability] = useState(false)
  const [expandedCrews, setExpandedCrews] = useState<Set<string>>(new Set())

  const [cellEditor, setCellEditor] = useState<CellEditorState>({
    open: false,
    projectId: "",
    projectName: "",
    date: "",
    segmentId: "",
    labelId: "",
    existingSegmentIds: [],
  })

  const [cellSegmentForm, setCellSegmentForm] = useState({
    segmentId: "",
    crew_id: "",
    name: "",
    start_date: "",
    end_date: "",
    capacity_fraction: "1",
    notes: "",
  })

  const [cellLabelForm, setCellLabelForm] = useState({
    labelId: "",
    label: "",
  })

  const isBoss = currentUser?.app_role === "boss"
  const isCrewBoss = currentUser?.app_role === "crew_boss"
  const isWorker = currentUser?.app_role === "worker"
  const canSeeAll = isBoss
  const canSeeTimesheets = isBoss || isCrewBoss
  const canSeeSchedulerOnly = isWorker

  function logout() {
    localStorage.removeItem("lc_user")
    setCurrentUser(null)
  }

  async function loadData() {
    setLoading(true)

    const [projectsRes, crewsRes, segmentsRes, labelsRes, milestonesRes, contractsRes, contractTypesRes, contractTypeMilestonesRes, workersRes, classificationRatesRes, clientsRes, allTimesheetsRes, projectCostsRes, estimatesRes, estimateItemsRes, scopeTemplatesRes, estimateTemplatesRes, estimateTemplateItemsRes, extrasRes, extraItemsRes] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("crews").select("*").order("name"),
      supabase.from("segments").select(`*, projects(name), crews(name, color, capacity)`).order("start_date"),
      supabase.from("project_day_labels").select(`*, projects(name)`),
      supabase.from("milestones").select("*").order("sort_order"),
      supabase.from("contracts").select("*").order("sort_order"),
      supabase.from("contract_types").select("*").order("sort_order"),
      supabase.from("contract_type_milestones").select("*").order("sort_order"),
      supabase.from("workers").select("*").order("sort_order"),
      supabase.from("classification_rates").select("*").order("effective_from", { ascending: false }),
      supabase.from("clients").select("*").order("name"),
      supabase.from("timesheets").select("*").order("date"),
      supabase.from("project_costs_with_dates").select("*").order("effective_date", { ascending: true, nullsFirst: false }),
      supabase.from("estimates").select("*").order("created_at", { ascending: false }),
      supabase.from("estimate_items").select("*").order("sort_order"),
      supabase.from("scope_templates").select("*").order("sort_order"),
      supabase.from("extras").select("*").order("created_at", { ascending: false }),
      supabase.from("extra_items").select("*").order("sort_order"),
      supabase.from("estimate_templates").select("*").order("sort_order"),
      supabase.from("estimate_template_items").select("*").order("sort_order"),
    ])

    const projectsData = (projectsRes.data ?? []) as Project[]
    const crewsData = (crewsRes.data ?? []) as Crew[]
    const segmentsData = (segmentsRes.data ?? []) as Segment[]
    const labelsData = (labelsRes.data ?? []) as DayLabel[]
    const milestonesData = (milestonesRes.data ?? []) as Milestone[]
    const contractsData = (contractsRes.data ?? []) as Contract[]
    const contractTypesData = (contractTypesRes.data ?? []) as ContractType[]
    const contractTypeMilestonesData = (contractTypeMilestonesRes.data ?? []) as ContractTypeMilestone[]
    const workersData = (workersRes.data ?? []) as Worker[]
    const classificationRatesData = (classificationRatesRes.data ?? []) as ClassificationRate[]
    const clientsData = (clientsRes.data ?? []) as Client[]
    const allTimesheetsData = (allTimesheetsRes.data ?? []) as TimesheetEntry[]
    const projectCostsData = (projectCostsRes.data ?? []) as ProjectCost[]
    const estimatesData = (estimatesRes.data ?? []) as Estimate[]
    const estimateItemsData = (estimateItemsRes.data ?? []) as EstimateItem[]
    const scopeTemplatesData = (scopeTemplatesRes.data ?? []) as ScopeTemplate[]

    setProjects(projectsData)
    setCrews(crewsData)
    setSegments(segmentsData)
    setLabels(labelsData)
    setMilestones(milestonesData)
    setContracts(contractsData)
    setContractTypes(contractTypesData)
    setContractTypeMilestones(contractTypeMilestonesData)
    setWorkers(workersData)
    setClassificationRates(classificationRatesData)
    setClients(clientsData)
    setTimesheetEntries(allTimesheetsData)
    setProjectCosts(projectCostsData)
    setEstimates(estimatesData)
    setEstimateItems(estimateItemsData)
    setScopeTemplates(scopeTemplatesData)
    setEstimateTemplates((estimateTemplatesRes.data ?? []) as EstimateTemplate[])
    setEstimateTemplateItems((estimateTemplateItemsRes.data ?? []) as EstimateTemplateItem[])
    setExtras((extrasRes.data ?? []) as Extra[])
    setExtraItems((extraItemsRes.data ?? []) as ExtraItem[])

    const { data: companyCostData } = await supabase.from("company_cost_summary").select("*").single()
    if (companyCostData) setCompanyCost(companyCostData as typeof companyCost)
    setLoading(false)

    // Scroll Gantt to today after load
    setTimeout(() => {
      if (ganttScrollRef.current) {
        const todayStr = formatDateKey(new Date())
        // We need dates to be computed — just scroll to approximate position
        // Will be handled by the useEffect below
      }
    }, 100)

    if (!segmentForm.project_id && projectsData[0]?.id) {
      setSegmentForm((prev) => ({ ...prev, project_id: projectsData[0].id }))
    }

    if (!segmentForm.crew_id && crewsData[0]?.id) {
      setSegmentForm((prev) => ({ ...prev, crew_id: crewsData[0].id }))
    }
  }

  useEffect(() => {
    // Check auth from localStorage on mount (client only)
    try {
      const s = localStorage.getItem("lc_user")
      if (s) setCurrentUser(JSON.parse(s))
    } catch {}
    setAuthChecked(true)
    loadData()
    setTodayKey(formatDateKey(new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])



  const dateStrings = useMemo(() => {
    return [
      ...segments.flatMap((s) => [s.start_date, s.end_date]),
      ...labels.map((l) => l.date),
    ].filter(Boolean)
  }, [segments, labels])

  const minDate = useMemo(() => {
    // Always start at least 1 week before today
    const todayMinus1Week = new Date()
    todayMinus1Week.setDate(todayMinus1Week.getDate() - 7)
    if (dateStrings.length === 0) return todayMinus1Week
    const min = [...dateStrings].sort(compareDateStrings)[0]
    const segMin = parseDate(min)
    return segMin < todayMinus1Week ? segMin : todayMinus1Week
  }, [dateStrings])

  const maxDate = useMemo(() => {
    // Always extend at least ganttExtendWeeks past today
    const todayPlusExtend = new Date()
    todayPlusExtend.setDate(todayPlusExtend.getDate() + ganttExtendWeeks * 7)
    if (dateStrings.length === 0) return todayPlusExtend
    const max = [...dateStrings].sort(compareDateStrings)[dateStrings.length - 1]
    const segMax = parseDate(max)
    return segMax > todayPlusExtend ? segMax : todayPlusExtend
  }, [dateStrings, ganttExtendWeeks])

  const dates = useMemo(() => getDates(minDate, maxDate), [minDate, maxDate])
  const dateIndexMap = useMemo(() => getDateIndexMap(dates), [dates])

  // Scroll to today whenever dates load or change
  useEffect(() => {
    if (loading) return
    const scrollToToday = () => {
      if (!ganttScrollRef.current) return
      const todayStr = formatDateKey(new Date())
      const todayIdx = dates.findIndex(d => formatDateKey(d) === todayStr)
      if (todayIdx === -1) return
      const scrollPos = todayIdx * DAY_COL_WIDTH - 400
      ganttScrollRef.current.scrollLeft = Math.max(0, scrollPos)
    }
    // Try immediately, then again after a short delay for production
    scrollToToday()
    const t = setTimeout(scrollToToday, 300)
    return () => clearTimeout(t)
  }, [loading, dates])

  // For each crew, for each date: total booked capacity fraction
  const crewCapacityByDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const crew of crews) {
      map.set(crew.id, new Map())
    }
    for (const seg of segments) {
      const crewMap = map.get(seg.crew_id)
      if (!crewMap) continue
      for (const date of dates) {
        if (isWeekend(date)) continue
        const dk = formatDateKey(date)
        if (dk >= seg.start_date && dk <= seg.end_date) {
          crewMap.set(dk, (crewMap.get(dk) ?? 0) + Number(seg.capacity_fraction ?? 1))
        }
      }
    }
    return map
  }, [crews, segments, dates])

  const projectRows = useMemo(() => {
    const map = new Map<string, { projectId: string; projectName: string; segments: Segment[] }>()

    for (const segment of segments) {
      const projectId = segment.project_id
      const projectName =
        segment.projects?.name ??
        projects.find((p) => p.id === projectId)?.name ??
        "Unknown Project"

      if (!map.has(projectId)) {
        map.set(projectId, { projectId, projectName, segments: [] })
      }

      map.get(projectId)!.segments.push(segment)
    }

    for (const label of labels) {
      const projectId = label.project_id
      const projectName =
        label.projects?.name ??
        projects.find((p) => p.id === projectId)?.name ??
        "Unknown Project"

      if (!map.has(projectId)) {
        map.set(projectId, { projectId, projectName, segments: [] })
      }
    }

    for (const project of projects) {
      if (!map.has(project.id)) {
        map.set(project.id, { projectId: project.id, projectName: project.name, segments: [] })
      }
    }

    return Array.from(map.values())
      .filter((row) => {
        const project = projects.find((p) => p.id === row.projectId)
        if (project?.archived && !showArchived) return false
        return true
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName))
  }, [segments, labels, projects, showArchived])

  function openCellEditor(projectId: string, projectName: string, date: string, preferredSegmentId?: string) {
    const existingSegments = segments.filter(
      (s) => s.project_id === projectId && isDateWithinRange(date, s.start_date, s.end_date)
    )
    const existingLabel = labels.find((l) => l.project_id === projectId && l.date === date) ?? null

    const chosenSegment =
      existingSegments.find((s) => s.id === preferredSegmentId) ??
      existingSegments[0] ??
      null

    setCellEditor({
      open: true,
      projectId,
      projectName,
      date,
      segmentId: chosenSegment?.id ?? "",
      labelId: existingLabel?.id ?? "",
      existingSegmentIds: existingSegments.map((s) => s.id),
    })

    setCellSegmentForm({
      segmentId: chosenSegment?.id ?? "",
      crew_id: chosenSegment?.crew_id ?? crews[0]?.id ?? "",
      name: chosenSegment?.name ?? "",
      start_date: chosenSegment?.start_date ?? date,
      end_date: chosenSegment?.end_date ?? date,
      capacity_fraction: String(chosenSegment?.capacity_fraction ?? 1),
      notes: chosenSegment?.notes ?? "",
    })

    setCellLabelForm({
      labelId: existingLabel?.id ?? "",
      label: existingLabel?.label ?? "",
    })
  }

  function closeCellEditor() {
    setCellEditor({
      open: false,
      projectId: "",
      projectName: "",
      date: "",
      segmentId: "",
      labelId: "",
      existingSegmentIds: [],
    })

    setCellSegmentForm({
      segmentId: "",
      crew_id: "",
      name: "",
      start_date: "",
      end_date: "",
      capacity_fraction: "1",
      notes: "",
    })

    setCellLabelForm({
      labelId: "",
      label: "",
    })
  }

  function closeTopModal() {
    setTopModal(null)
  }

  function handleSelectExistingSegment(segmentId: string) {
    const segment = segments.find((s) => s.id === segmentId) ?? null

    setCellEditor((prev) => ({
      ...prev,
      segmentId: segment?.id ?? "",
    }))

    setCellSegmentForm({
      segmentId: segment?.id ?? "",
      crew_id: segment?.crew_id ?? crews[0]?.id ?? "",
      name: segment?.name ?? "",
      start_date: segment?.start_date ?? cellEditor.date,
      end_date: segment?.end_date ?? cellEditor.date,
      capacity_fraction: String(segment?.capacity_fraction ?? 1),
      notes: segment?.notes ?? "",
    })
  }

  async function saveCellSegment() {
    if (!cellEditor.projectId || !cellSegmentForm.crew_id || !cellSegmentForm.start_date || !cellSegmentForm.end_date) {
      return
    }

    const startObj = parseDate(cellSegmentForm.start_date)
    if (isWeekend(startObj)) {
      alert("Start date cannot be a weekend.")
      return
    }

    const normalised = normaliseSegmentToWorkingDays(cellSegmentForm.start_date, cellSegmentForm.end_date)

    const payload = {
      project_id: cellEditor.projectId,
      crew_id: cellSegmentForm.crew_id,
      name: cellSegmentForm.name || null,
      start_date: normalised.start_date,
      end_date: normalised.end_date,
      capacity_fraction: Number(cellSegmentForm.capacity_fraction || "1"),
      notes: cellSegmentForm.notes || null,
    }

    if (cellSegmentForm.segmentId) {
      await supabase.from("segments").update(payload).eq("id", cellSegmentForm.segmentId)
    } else {
      const { data: inserted } = await supabase.from("segments").insert(payload).select().single()
      if (inserted) {
        await attachMilestoneToNewSegment(inserted.id, cellEditor.projectId)
      }
    }

    await loadData()
    closeCellEditor()
  }

  async function deleteCellSegment() {
    if (!cellSegmentForm.segmentId) return
    const confirmed = window.confirm("Delete this segment?")
    if (!confirmed) return

    await supabase.from("segments").delete().eq("id", cellSegmentForm.segmentId)
    await loadData()
    closeCellEditor()
  }

  async function saveCellLabel() {
    if (!cellEditor.projectId || !cellEditor.date) return

    const trimmed = cellLabelForm.label.trim()

    if (!trimmed) {
      if (cellLabelForm.labelId) {
        await supabase.from("project_day_labels").delete().eq("id", cellLabelForm.labelId)
      }
      await loadData()
      closeCellEditor()
      return
    }

    if (cellLabelForm.labelId) {
      await supabase
        .from("project_day_labels")
        .update({ label: trimmed })
        .eq("id", cellLabelForm.labelId)
    } else {
      await supabase.from("project_day_labels").insert({
        project_id: cellEditor.projectId,
        date: cellEditor.date,
        label: trimmed,
      })
    }

    await loadData()
    closeCellEditor()
  }

  async function deleteCellLabel() {
    if (!cellLabelForm.labelId) return
    const confirmed = window.confirm("Delete this label?")
    if (!confirmed) return

    await supabase.from("project_day_labels").delete().eq("id", cellLabelForm.labelId)
    await loadData()
    closeCellEditor()
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    if (!projectForm.name.trim()) return

    await supabase.from("projects").insert({
      name: projectForm.name,
      client: projectForm.client || null,
    })

    setProjectForm({ name: "", client: "" })
    await loadData()
    closeTopModal()
  }

  async function addSegment(e: React.FormEvent) {
    e.preventDefault()

    if (!segmentForm.project_id || !segmentForm.crew_id || !segmentForm.start_date || !segmentForm.end_date) return

    const startObj = parseDate(segmentForm.start_date)
    if (isWeekend(startObj)) return

    const normalised = normaliseSegmentToWorkingDays(segmentForm.start_date, segmentForm.end_date)

    const { data: inserted } = await supabase.from("segments").insert({
      project_id: segmentForm.project_id,
      crew_id: segmentForm.crew_id,
      name: segmentForm.name || null,
      start_date: normalised.start_date,
      end_date: normalised.end_date,
      capacity_fraction: Number(segmentForm.capacity_fraction),
      notes: segmentForm.notes || null,
    }).select().single()

    if (inserted) {
      await attachMilestoneToNewSegment(inserted.id, segmentForm.project_id)
    }

    setSegmentForm((prev) => ({ ...prev, name: "", start_date: "", end_date: "", capacity_fraction: "1", notes: "" }))
    await loadData()
    closeTopModal()
  }

  function getMilestoneDate(m: Milestone): string | null {
    if (m.due_date_override) return m.due_date_override
    if (m.segment_id) {
      const seg = segments.find((s) => s.id === m.segment_id)
      return seg?.end_date ?? null
    }
    return null
  }

  async function openMilestoneModal(projectId: string, projectName: string, focusedMilestoneId?: string) {
    setMilestoneModal({ open: true, projectId, projectName, focusedMilestoneId: focusedMilestoneId ?? null })

    // Auto-fix: if a milestone has percent but no amount, calculate and save it now
    const projectContracts = contracts.filter(c => c.project_id === projectId)
    const projectMilestones = milestones.filter(m => m.project_id === projectId)
    const toFix = projectMilestones.filter(m => m.percent != null && (m.amount == null || m.amount === 0))
    if (toFix.length > 0) {
      await Promise.all(toFix.map(m => {
        const contract = projectContracts.find(c => c.id === m.contract_id)
        const contractValue = contract?.value ?? null
        if (!contractValue || !m.percent) return Promise.resolve()
        const amount = Math.round(contractValue * m.percent / 100)
        return supabase.from("milestones").update({ amount }).eq("id", m.id)
      }))
      await loadData()
    }
  }

  async function saveMilestone(m: Milestone) {
    await supabase.from("milestones").update({
      name: m.name,
      amount: m.amount,
      percent: m.percent,
      segment_id: m.segment_id,
      due_date_override: m.due_date_override,
    }).eq("id", m.id)
    // Reload segments first so reorder has fresh data
    const { data: freshSegments } = await supabase.from("segments").select("*,projects(name),crews(name,color,capacity)").order("start_date")
    if (freshSegments) {
      await reorderMilestonesForProject(m.project_id, freshSegments as Segment[])
    }
    await loadData()
  }

  async function addMilestone(projectId: string, contractId?: string) {
    const existing = milestones.filter((m) => m.project_id === projectId && m.contract_id === (contractId ?? null))
    await supabase.from("milestones").insert({
      project_id: projectId,
      contract_id: contractId ?? null,
      name: "Payment milestone",
      amount: null,
      percent: null,
      segment_id: null,
      due_date_override: null,
      sort_order: existing.length,
    })
    await loadData()
  }

  async function deleteMilestone(id: string) {
    await supabase.from("milestones").delete().eq("id", id)
    await loadData()
  }

  const CONTRACT_COLORS = ["#2563eb","#16a34a","#d97706","#9333ea","#db2777","#0891b2","#dc2626","#65a30d"]

  const CLASSIFICATIONS = [
    { value: "boss", label: "Boss" },
    { value: "qualified_carpenter", label: "Qualified Carpenter" },
    { value: "apprentice_4th", label: "4th Year Apprentice" },
    { value: "apprentice_3rd", label: "3rd Year Apprentice" },
    { value: "apprentice_2nd", label: "2nd Year Apprentice" },
    { value: "apprentice_1st", label: "1st Year Apprentice" },
  ]

  function calcChargeout(costPerHour: number, margin: number) {
    return costPerHour / (1 - margin)
  }

  function getCrewBlendedCost(crewId: string) {
    const crewWorkers = workers.filter((w) => w.crew_id === crewId && w.total_cost_hourly != null)
    if (crewWorkers.length === 0) return null
    return crewWorkers.reduce((sum, w) => sum + (w.total_cost_hourly ?? 0), 0) / crewWorkers.length
  }

  function getCrewBlendedCostWithOT(crewId: string) {
    const crewWorkers = workers.filter((w) => w.crew_id === crewId && w.total_cost_hourly_with_ot != null)
    if (crewWorkers.length === 0) return null
    return crewWorkers.reduce((sum, w) => sum + (w.total_cost_hourly_with_ot ?? 0), 0) / crewWorkers.length
  }

  async function saveWorker(w: Worker) {
    await supabase.from("workers").update({
      name: w.name,
      crew_id: w.crew_id,
      role: w.role,
      classification: w.classification,
      employment_type: w.employment_type,
      base_rate_hourly: w.base_rate_hourly,
      ot_rate_hourly: w.ot_rate_hourly,
      super_hourly: w.super_hourly,
      annual_leave_hourly: w.annual_leave_hourly,
      personal_leave_hourly: w.personal_leave_hourly,
      long_service_leave_hourly: w.long_service_leave_hourly,
      travel_allowance_hourly: w.travel_allowance_hourly,
      workcover_hourly: w.workcover_hourly,
      public_hols_hourly: w.public_hols_hourly,
      standard_charge_rate: w.standard_charge_rate,
      phone: w.phone,
      email: w.email,
      start_date: w.start_date,
      notes: w.notes,
      sub_super_workcover: w.sub_super_workcover,
    }).eq("id", w.id)
    await loadData()
  }

  async function addWorker(crewId?: string) {
    const existing = workers.filter((w) => w.crew_id === (crewId ?? null))
    await supabase.from("workers").insert({
      name: "New worker",
      crew_id: crewId ?? null,
      sort_order: existing.length,
    })
    await loadData()
  }

  async function deleteWorker(id: string) {
    const confirmed = window.confirm("Delete this worker?")
    if (!confirmed) return
    await supabase.from("workers").delete().eq("id", id)
    await loadData()
  }

  async function saveClassificationRate(r: ClassificationRate) {
    await supabase.from("classification_rates").update({ rate_ex_gst: r.rate_ex_gst }).eq("id", r.id)
    await loadData()
  }

  async function addClassificationRate() {
    await supabase.from("classification_rates").insert({
      classification: "New classification",
      rate_ex_gst: 0,
      effective_from: new Date().toISOString().slice(0, 10),
    })
    await loadData()
  }

  async function loadTimesheetEntries(weekStart: string, crewId: string) {
    if (!crewId) return
    setTimesheetLoading(true)
    const weekEnd = addCalendarDays(weekStart, 6)
    const crewWorkerIds = workers.filter((w) => w.crew_id === crewId).map((w) => w.id)
    if (crewWorkerIds.length === 0) { setTimesheetLoading(false); return }

    const { data } = await supabase
      .from("timesheets")
      .select("*")
      .in("worker_id", crewWorkerIds)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date")

    setTimesheetEntries((data ?? []) as TimesheetEntry[])
    setTimesheetLoading(false)
  }

  async function saveTimesheetEntry(entry: Partial<TimesheetEntry> & { worker_id: string; date: string }) {
    const existing = timesheetEntries.find(
      (e) => e.worker_id === entry.worker_id && e.date === entry.date && e.project_id === (entry.project_id ?? null)
    )
    if (existing) {
      await supabase.from("timesheets").update({
        ordinary_hours: entry.ordinary_hours ?? existing.ordinary_hours,
        ot_hours: entry.ot_hours ?? existing.ot_hours,
        project_id: entry.project_id ?? existing.project_id,
        segment_id: entry.segment_id ?? existing.segment_id,
        notes: entry.notes ?? existing.notes,
      }).eq("id", existing.id)
    } else {
      await supabase.from("timesheets").insert({
        date: entry.date,
        worker_id: entry.worker_id,
        project_id: entry.project_id ?? null,
        segment_id: entry.segment_id ?? null,
        ordinary_hours: entry.ordinary_hours ?? 9,
        ot_hours: entry.ot_hours ?? 0,
        notes: entry.notes ?? null,
      })
    }
    await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
  }

  async function deleteTimesheetEntry(id: string) {
    await supabase.from("timesheets").delete().eq("id", id)
    await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
  }

  async function quickFillDay(date: string, projectId: string) {
    const crewWorkers = workers.filter((w) => w.crew_id === timesheetCrewId)
    await Promise.all(crewWorkers.map((w) =>
      saveTimesheetEntry({ worker_id: w.id, date, project_id: projectId, ordinary_hours: 9, ot_hours: 0 })
    ))
  }

  async function saveClient(c: Client) {
    await supabase.from("clients").update({
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      notes: c.notes,
    }).eq("id", c.id)
    await loadData()
  }

  async function addClient() {
    await supabase.from("clients").insert({ name: "New client" })
    await loadData()
  }

  async function deleteClient(id: string) {
    const confirmed = window.confirm("Delete this client? Their projects will be unlinked but not deleted.")
    if (!confirmed) return
    await supabase.from("clients").delete().eq("id", id)
    await loadData()
  }

  const COST_CATEGORIES = [
    { value: "materials", label: "Materials" },
    { value: "subcontractor", label: "Subcontractor" },
    { value: "equipment", label: "Equipment hire" },
    { value: "prelims", label: "Prelims" },
    { value: "other", label: "Other" },
  ]

  async function addProjectCost(projectId: string, group?: string) {
    await supabase.from("project_costs").insert({
      project_id: projectId,
      category: "materials",
      description: group ? `${group} — payment` : "New cost",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      date_trigger: "fixed",
      cost_group: group ?? null,
    })
    await loadData()
  }

  async function saveProjectCost(c: ProjectCost) {
    await supabase.from("project_costs").update({
      category: c.category,
      description: c.description,
      supplier: c.supplier,
      amount: c.amount,
      date: c.date,
      invoice_number: c.invoice_number,
      segment_id: c.segment_id,
      notes: c.notes,
      date_trigger: c.date_trigger,
      cost_group: c.cost_group,
    }).eq("id", c.id)
    await loadData()
  }

  async function deleteProjectCost(id: string) {
    await supabase.from("project_costs").delete().eq("id", id)
    await loadData()
  }

  const ESTIMATE_STATUSES = [
    { value: "draft", label: "Draft", color: "#8899bb" },
    { value: "sent", label: "Sent", color: "#60a5fa" },
    { value: "accepted", label: "Accepted", color: "#4ade80" },
    { value: "declined", label: "Declined", color: "#f87171" },
    { value: "revised", label: "Revised", color: "#fbbf24" },
  ]

  const ESTIMATE_ITEM_CATEGORIES = [
    { value: "labour", label: "Labour" },
    { value: "materials", label: "Materials" },
    { value: "subcontractor", label: "Subcontractor" },
    { value: "equipment", label: "Equipment" },
    { value: "prelims", label: "Prelims" },
    { value: "allowance", label: "Allowance" },
  ]

  const ESTIMATE_UNITS = ["week", "day", "hr", "m²", "m³", "lm", "item", "allow", "lot"]

  function calcItemTotal(item: EstimateItem) {
    return item.quantity * item.unit_cost * (1 + item.margin_percent / 100)
  }

  async function createEstimate(projectId?: string, clientId?: string) {
    const project = projects.find(p => p.id === projectId)
    const { data, error } = await supabase.from("estimates").insert({
      project_id: projectId ?? null,
      client_id: clientId ?? project?.client_id ?? null,
      title: project ? `${project.name} — Quote` : "New Estimate",
      version: 1,
      status: "draft",
    }).select()
    if (error) {
      console.error("createEstimate error:", error)
      showToast(`Error: ${error.message}`)
      return
    }
    const newEstimate = (data ?? [])[0] as Estimate | undefined
    if (newEstimate) {
      setEstimates(prev => [newEstimate, ...prev])
      setActiveEstimateId(newEstimate.id)
    }
  }

  async function saveEstimate(e: Estimate) {
    await supabase.from("estimates").update({
      project_id: e.project_id,
      client_id: e.client_id,
      title: e.title,
      version: e.version,
      status: e.status,
      issued_date: e.issued_date,
      valid_until: e.valid_until,
      notes: e.notes,
      terms: e.terms,
      quote_type: e.quote_type,
    }).eq("id", e.id)
    setEstimates(prev => prev.map(est => est.id === e.id ? e : est))
  }

  async function deleteEstimate(id: string) {
    if (!window.confirm("Delete this estimate and all its line items?")) return
    await supabase.from("estimates").delete().eq("id", id)
    setEstimates(prev => prev.filter(e => e.id !== id))
    setEstimateItems(prev => prev.filter(i => i.estimate_id !== id))
    if (activeEstimateId === id) setActiveEstimateId(null)
  }

  async function duplicateEstimate(e: Estimate) {
    const { data: newEstData } = await supabase.from("estimates").insert({
      project_id: e.project_id,
      client_id: e.client_id,
      title: e.title,
      version: e.version + 1,
      status: "draft",
      notes: e.notes,
    }).select()
    const newEst = (newEstData ?? [])[0] as Estimate | undefined
    if (newEst) {
      const items = estimateItems.filter(i => i.estimate_id === e.id)
      let newItems: EstimateItem[] = []
      if (items.length > 0) {
        const { data: insertedItems } = await supabase.from("estimate_items").insert(items.map(i => ({
          estimate_id: newEst.id,
          category: i.category,
          description: i.description,
          crew_id: i.crew_id,
          quantity: i.quantity,
          unit: i.unit,
          unit_cost: i.unit_cost,
          margin_percent: i.margin_percent,
          sort_order: i.sort_order,
        }))).select()
        newItems = (insertedItems ?? []) as EstimateItem[]
      }
      setEstimates(prev => [newEst as Estimate, ...prev])
      setEstimateItems(prev => [...prev, ...newItems])
      setActiveEstimateId(newEst.id)
    }
  }

  async function addEstimateItem(estimateId: string, category = "labour") {
    const existing = estimateItems.filter(i => i.estimate_id === estimateId)
    const crew = crews[0]
    const crewCost = crew ? (workers.filter(w => w.crew_id === crew.id && w.total_cost_hourly_with_ot != null).reduce((s, w) => s + (w.total_cost_hourly_with_ot ?? 0), 0) / Math.max(workers.filter(w => w.crew_id === crew.id).length, 1)) * 9 : 0
    const { data } = await supabase.from("estimate_items").insert({
      estimate_id: estimateId,
      category,
      description: category === "labour" ? "Labour — " : "New item",
      crew_id: category === "labour" ? (crew?.id ?? null) : null,
      quantity: 1,
      unit: category === "labour" ? "week" : "allow",
      unit_cost: category === "labour" ? Math.round(crewCost * 100) / 100 : 0,
      margin_percent: 30,
      sort_order: existing.length,
    }).select()
    const newItem = (data ?? [])[0] as EstimateItem | undefined
    if (newItem) setEstimateItems(prev => [...prev, newItem])
  }

  const FRAMING_TERMS_BASE = [
    "The use of our generator if needed will be $85 per day",
    "Any extra works that are not in the scope are to be agreed upon and charged at an accepted price",
    "Flooring to be craned onto subfloor (If not charges apply)",
    "Trusses to be craned onto First floor walls (If not charges apply)",
    "Timber to be at a reasonable distance from slab or working area (If not charges apply)",
    "Scaffold, rail or void protection to be supplied by builder when necessary",
    "All nails, screws and hardware to be provided by builder",
    "Any reworking of Steel will be at an extra cost (Eg. Out of Plumb Columns)",
    "Price includes full material take off for the job if requested",
    "Price includes full frame write up, photos and descriptions of any changes made throughout the job",
    "Price includes 1 return trip for windows if scaffold prevents installation at time of completion",
    "Price includes 1 return trip to fix any frame or QA items",
  ].join("\n")

  function buildFramingTerms(items: EstimateItem[]) {
    const labourItems = items.filter(i => i.category === "labour" && i.description)
    const stages = labourItems.length
    const lines: string[] = ["Payment terms 7 days from stage completed"]

    if (stages === 0) {
      lines.push("- 25% at Ground Floor wall completion")
      lines.push("- 25% at Subfloor and flooring completion")
      lines.push("- 25% at First Floor walls completion")
      lines.push("- 20% at Truss completion")
      lines.push("- 5% after frame inspection items are completed")
    } else {
      const remainingPct = 95
      const basePct = Math.floor(remainingPct / stages)
      const remainder = remainingPct - basePct * stages
      labourItems.forEach((item, idx) => {
        const pct = idx === 0 ? basePct + remainder : basePct
        const stageName = item.description.replace(/^Labour\s*[-\u2013\u2014]\s*/i, "").trim() || ("Stage " + (idx + 1))
        lines.push("- " + pct + "% at " + stageName + " completion")
      })
      lines.push("- 5% after frame inspection items are completed")
    }

    return FRAMING_TERMS_BASE + "\n" + lines.join("\n")
  }

  const FRAMING_TERMS = buildFramingTerms([])

  const STEEL_TERMS = `All payments must be made in full prior to commencement of relevant stage of construction
Initial deposits are required to be paid in full before steel is supplied, fabricated and scheduling booked in
Initial deposits cover the cost of supply, fabrication & installation of first stage installation of steel columns (if viable)
Subsequent payments must be made in full prior to delivery & installation of structural steel
If any payment is delayed, Lawless Construction does not hold any responsibility in scheduling conflicts or delays. Once payment is received a new date can be arranged
Projects less than $6000 will be invoiced and expected to be paid in full prior to commencement of installation
Lawless Construction does not issue any refunds
Client has the right to retain up to 5% of total quoted price until frame inspection has passed, with 5 working days written notice prior to commencement. Final balance must be paid immediately after frame inspection passes
Lawless Construction has a rear mounted crane-truck with a reach of up to approx. 450kg@18m
If the project requires 3rd party crane-hire, the invoice shall be forwarded to the client to be paid immediately
A platform is required for works above 3.3m — builder's responsibility to provide a suitable and safe working platform
Clear access to the main body of works must be provided, clear of any rubbish or large debris
Any extra work not shown on the engineering plan will be at an extra cost
All steel-to-steel connections will be done either bolted to the web or directly welded on site
Latest stamped plans must be provided prior to commencement of project
Any plan changes thereafter are subject to extra charges for new material and a restocking fee of $2.50 per KG for unused material
Quotation is valid for 30 days from date of quote
Quote estimate is based on current steel cost, labour cost & timeframe
Payment terms:
- 1. First Deposit Due Upon Quote Acceptance (no material ordered until paid)
- 2. Final Balance Due Before Installation`

  async function saveEstimateItem(item: EstimateItem) {
    await supabase.from("estimate_items").update({
      category: item.category,
      description: item.description,
      crew_id: item.crew_id,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      margin_percent: item.margin_percent,
      sort_order: item.sort_order,
      scope: item.scope,
    }).eq("id", item.id)
    setEstimateItems(prev => prev.map(i => i.id === item.id ? item : i))
  }

  async function deleteEstimateItem(id: string) {
    await supabase.from("estimate_items").delete().eq("id", id)
    setEstimateItems(prev => prev.filter(i => i.id !== id))
  }

  async function loadProfitability() {
    const { data } = await supabase.from("project_profitability").select("*")
    const rows = (data ?? []) as ProfitabilityRow[]
    setProfitabilityData(rows)
    setSelectedProfitProjects(new Set(rows.filter((r) => r.profitability_included !== false).map((r) => r.project_id)))
  }

  async function autoLinkMilestones(projectId: string, contractId: string) {
    const unlinkedMilestones = milestones
      .filter((m) => m.project_id === projectId && m.contract_id === contractId && !m.segment_id && !m.due_date_override)
      .sort((a, b) => a.sort_order - b.sort_order)

    if (unlinkedMilestones.length === 0) {
      showToast("No unlinked milestones to assign")
      return
    }

    const projectSegments = segments
      .filter((s) => s.project_id === projectId)
      .sort((a, b) => compareDateStrings(a.start_date, b.start_date))

    if (projectSegments.length === 0) {
      showToast("No segments on this project yet")
      return
    }

    await Promise.all(
      unlinkedMilestones.map((m, i) => {
        const seg = projectSegments[i]
        if (!seg) return Promise.resolve()
        return supabase.from("milestones").update({ segment_id: seg.id }).eq("id", m.id)
      })
    )

    const updatedSegs = segments.filter((s) => s.project_id === projectId)
    await reorderMilestonesForProject(projectId, updatedSegs)
    await loadData()
    showToast(`Linked ${Math.min(unlinkedMilestones.length, projectSegments.length)} milestone${Math.min(unlinkedMilestones.length, projectSegments.length) === 1 ? "" : "s"} to segments`)
  }

  async function addContract(projectId: string, typeId?: string) {
    const existing = contracts.filter((c) => c.project_id === projectId)
    const color = CONTRACT_COLORS[existing.length % CONTRACT_COLORS.length]
    const contractType = contractTypes.find((t) => t.id === typeId)

    const { data: inserted } = await supabase.from("contracts").insert({
      project_id: projectId,
      name: contractType?.name ?? "New contract",
      value: null,
      color,
      sort_order: existing.length,
    }).select().single()

    // Auto-create milestones from contract type template
    if (inserted && typeId) {
      const templateMilestones = contractTypeMilestones
        .filter((m) => m.contract_type_id === typeId)
        .sort((a, b) => a.sort_order - b.sort_order)

      if (templateMilestones.length > 0) {
        await supabase.from("milestones").insert(
          templateMilestones.map((m, i) => ({
            project_id: projectId,
            contract_id: inserted.id,
            name: m.name,
            amount: null,
            percent: m.percent ?? null,
            segment_id: null,
            due_date_override: null,
            sort_order: i,
          }))
        )
      }
    }

    await loadData()
    return inserted as Contract | null
  }

  async function saveContractType(ct: ContractType) {
    await supabase.from("contract_types").update({ name: ct.name, default_milestone_count: ct.default_milestone_count }).eq("id", ct.id)
    await loadData()
  }

  async function addContractType() {
    await supabase.from("contract_types").insert({ name: "New contract type", default_milestone_count: 1, sort_order: contractTypes.length })
    await loadData()
  }

  async function deleteContractType(id: string) {
    const confirmed = window.confirm("Delete this contract type and its default milestones?")
    if (!confirmed) return
    await supabase.from("contract_type_milestones").delete().eq("contract_type_id", id)
    await supabase.from("contract_types").delete().eq("id", id)
    await loadData()
  }

  async function addContractTypeMilestone(contractTypeId: string) {
    const existing = contractTypeMilestones.filter((m) => m.contract_type_id === contractTypeId)
    await supabase.from("contract_type_milestones").insert({
      contract_type_id: contractTypeId,
      name: "New milestone",
      percent: null,
      sort_order: existing.length,
    })
    await loadData()
  }

  async function saveContractTypeMilestone(m: ContractTypeMilestone) {
    await supabase.from("contract_type_milestones").update({ name: m.name, percent: m.percent }).eq("id", m.id)
    await loadData()
  }

  async function deleteContractTypeMilestone(id: string) {
    await supabase.from("contract_type_milestones").delete().eq("id", id)
    await loadData()
  }

  async function saveContract(c: Contract) {
    await supabase.from("contracts").update({
      name: c.name,
      value: c.value,
      color: c.color,
    }).eq("id", c.id)
    await loadData()
  }

  async function deleteContract(id: string) {
    const confirmed = window.confirm("Delete this contract and all its milestones?")
    if (!confirmed) return
    await supabase.from("milestones").update({ contract_id: null }).eq("contract_id", id)
    await supabase.from("contracts").delete().eq("id", id)
    await loadData()
  }

  function openProjectEditor(project: Project) {
    setProjectEditor({
      open: true,
      projectId: project.id,
      name: project.name,
      client: project.client ?? "",
      archived: project.archived ?? false,
      contract_value: project.contract_value != null ? String(project.contract_value) : "",
    })
  }

  function closeProjectEditor() {
    setProjectEditor({ open: false, projectId: "", name: "", client: "", archived: false, contract_value: "" })
  }

  async function saveProject() {
    if (!projectEditor.projectId || !projectEditor.name.trim()) return
    await supabase
      .from("projects")
      .update({
        name: projectEditor.name.trim(),
        client: projectEditor.client.trim() || null,
        archived: projectEditor.archived,
        contract_value: projectEditor.contract_value ? Number(projectEditor.contract_value) : null,
      })
      .eq("id", projectEditor.projectId)
    await loadData()
    closeProjectEditor()
  }

  async function deleteProject() {
    if (!projectEditor.projectId) return
    const confirmed = window.confirm("Delete this project and ALL its segments and labels? This cannot be undone.")
    if (!confirmed) return
    await supabase.from("project_day_labels").delete().eq("project_id", projectEditor.projectId)
    await supabase.from("segments").delete().eq("project_id", projectEditor.projectId)
    await supabase.from("projects").delete().eq("id", projectEditor.projectId)
    await loadData()
    closeProjectEditor()
  }

  async function toggleArchiveProject() {
    if (!projectEditor.projectId) return
    await supabase
      .from("projects")
      .update({ archived: !projectEditor.archived })
      .eq("id", projectEditor.projectId)
    await loadData()
    closeProjectEditor()
  }

  // When a segment moves to a new project, detach its milestone from the old project
  // and attach the first unallocated milestone on the new project to it.
  async function reattachMilestone(segmentId: string, oldProjectId: string, newProjectId: string) {
    if (oldProjectId === newProjectId) return

    // Detach from old project milestone
    const oldMilestone = milestones.find((m) => m.project_id === oldProjectId && m.segment_id === segmentId)
    if (oldMilestone) {
      await supabase.from("milestones").update({ segment_id: null }).eq("id", oldMilestone.id)
    }

    // Find first unallocated milestone on new project
    const unallocated = milestones
      .filter((m) => m.project_id === newProjectId && !m.segment_id && !m.due_date_override)
      .sort((a, b) => a.sort_order - b.sort_order)[0]
    if (unallocated) {
      await supabase.from("milestones").update({ segment_id: segmentId }).eq("id", unallocated.id)
    }
  }

  // When a new segment is added to a project, attach the first unallocated milestone
  async function attachMilestoneToNewSegment(segmentId: string, projectId: string) {
    const unallocated = milestones
      .filter((m) => m.project_id === projectId && !m.segment_id && !m.due_date_override)
      .sort((a, b) => a.sort_order - b.sort_order)[0]
    if (unallocated) {
      await supabase.from("milestones").update({ segment_id: segmentId }).eq("id", unallocated.id)
    }
  }

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // After any segment change, re-sort milestones on that project by their linked segment's end date
  async function reorderMilestonesForProject(projectId: string, updatedSegments: Segment[]) {
    const projectMilestones = milestones
      .filter((m) => m.project_id === projectId && m.segment_id)
      .sort((a, b) => {
        const segA = updatedSegments.find((s) => s.id === a.segment_id)
        const segB = updatedSegments.find((s) => s.id === b.segment_id)
        return compareDateStrings(segA?.end_date ?? "", segB?.end_date ?? "")
      })

    const currentOrders = projectMilestones.map((m) => m.sort_order)
    const sortedOrders = [...currentOrders].sort((a, b) => a - b)
    const changed = projectMilestones.some((m, i) => m.sort_order !== sortedOrders[i])

    if (!changed) return

    await Promise.all(
      projectMilestones.map((m, i) =>
        supabase.from("milestones").update({ sort_order: sortedOrders[i] }).eq("id", m.id)
      )
    )
    showToast("Milestones reordered")
  }

  async function moveSegment(segmentId: string, targetProjectId: string, targetStartDate: string) {
    const segment = segments.find((s) => s.id === segmentId)
    if (!segment) return

    const targetDateObj = parseDate(targetStartDate)
    if (isWeekend(targetDateObj)) return

    const workingDays = countWorkingDaysInclusive(segment.start_date, segment.end_date)
    const newStart = targetStartDate
    const newEnd = addWorkingDaysInclusive(newStart, Math.max(workingDays, 1))

    await supabase
      .from("segments")
      .update({ project_id: targetProjectId, start_date: newStart, end_date: newEnd })
      .eq("id", segmentId)

    await reattachMilestone(segmentId, segment.project_id, targetProjectId)

    // Build updated segment list for reorder calculation
    const updatedSegments = segments.map((s) =>
      s.id === segmentId ? { ...s, project_id: targetProjectId, start_date: newStart, end_date: newEnd } : s
    )
    await reorderMilestonesForProject(targetProjectId, updatedSegments)

    setDraggingToken(null)
    await loadData()
  }

  async function resizeSegment(segmentId: string, targetEndDate: string) {
    const segment = segments.find((s) => s.id === segmentId)
    if (!segment) return

    const targetDateObj = parseDate(targetEndDate)
    if (isWeekend(targetDateObj)) return
    if (targetEndDate < segment.start_date) return

    const workingDays = countWorkingDaysInclusive(segment.start_date, targetEndDate)
    const safeEnd = addWorkingDaysInclusive(segment.start_date, Math.max(workingDays, 1))

    await supabase
      .from("segments")
      .update({ end_date: safeEnd })
      .eq("id", segmentId)

    const updatedSegments = segments.map((s) =>
      s.id === segmentId ? { ...s, end_date: safeEnd } : s
    )
    await reorderMilestonesForProject(segment.project_id, updatedSegments)

    setDraggingToken(null)
    await loadData()
  }

  // ── Auth gate ──
  if (!authChecked) return null // wait for client mount before rendering
  if (!currentUser) {
    return <LoginScreen onLogin={(user) => {
      localStorage.setItem("lc_user", JSON.stringify(user))
      setCurrentUser(user)
    }} />
  }

  return (
    <div style={{ background: "#111827", color: "white", minHeight: "100vh" }}>
      {/* ── Branded header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 64,
        background: "#0a0f1e",
        borderBottom: "1px solid #1e2a45",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <img
          src="/lawless-logo.png"
          alt="Lawless Construction"
          style={{ height: 42, width: "auto", objectFit: "contain" }}
        />
        {/* Centre label */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", letterSpacing: "0.25em", textTransform: "uppercase" }}>Operations</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#8899bb", letterSpacing: "0.1em" }}>Scheduler</div>
        </div>
        {/* Right side — user + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: "#4a6080", fontWeight: 600 }}>
            {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1e2535", border: "1px solid #2e3a58", borderRadius: 8, padding: "6px 12px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isBoss ? "#fbbf24" : isCrewBoss ? "#34d399" : "#60a5fa" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#c8d4f0" }}>{currentUser.name}</span>
            <span style={{ fontSize: 10, color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.05em" }}>{currentUser.app_role.replace("_", " ")}</span>
            <button type="button" onClick={() => setShowChangePinModal(true)}
              style={{ fontSize: 11, color: "#93c5fd", background: "none", border: "none", cursor: "pointer", padding: "0 4px 0 8px", borderLeft: "1px solid #2e3a58" }}>
              Change PIN
            </button>
            <button type="button" onClick={logout}
              style={{ fontSize: 11, color: "#6b7a9a", background: "none", border: "none", cursor: "pointer", padding: "0 0 0 8px", borderLeft: "1px solid #2e3a58" }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: "20px 28px" }}>

      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "#1e1b4b",
          border: "1px solid #4c1d95",
          color: "#c4b5fd",
          padding: "10px 18px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 200,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {toast}
        </div>
      )}

      {/* Toolbar — single row, pill style */}
      {(() => {
        const pillBase: React.CSSProperties = {
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderRadius: 999,
          border: "1.5px solid #2e3a58", background: "#1e2535",
          color: "#c8d4f0", fontWeight: 600, fontSize: 13,
          cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1,
          transition: "background 0.15s",
        }
        const pillPrimary: React.CSSProperties = {
          ...pillBase, background: "#1e3a6e", border: "1.5px solid #2563eb", color: "#93c5fd",
        }
        const pillActive: React.CSSProperties = {
          ...pillBase, background: "#14532d", border: "1.5px solid #16a34a", color: "#86efac",
        }
        const pillAmber: React.CSSProperties = {
          ...pillBase, background: "#431407", border: "1.5px solid #c2410c", color: "#fed7aa",
        }
        const iconStyle: React.CSSProperties = {
          width: 22, height: 22, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, flexShrink: 0,
        }
        const divider: React.CSSProperties = {
          width: 1, background: "#2e3a58", alignSelf: "stretch", margin: "0 4px",
        }
        return (
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            {/* Primary actions */}
            {canSeeAll && <button type="button" onClick={() => setTopModal("addProject")} style={pillPrimary}>
              <span style={{ ...iconStyle, background: "#2563eb22" }}>＋</span>
              Add Project
            </button>}
            <button type="button" onClick={() => setShowAvailability((v) => !v)}
              style={showAvailability ? pillActive : pillBase}>
              <span style={{ ...iconStyle, background: showAvailability ? "#16a34a22" : "#ffffff11" }}>◎</span>
              {showAvailability ? "Hide Availability" : "Find Availability"}
            </button>

            <div style={divider} />

            {/* Data views */}
            {canSeeAll && <button type="button" onClick={() => setShowExtrasModal(true)} style={{ ...pillBase, background: "#1a1a3e", border: "1.5px solid #7c3aed", color: "#c4b5fd" }}>
              <span style={{ ...iconStyle, background: "#7c3aed22" }}>⚡</span>
              Extras {extras.length > 0 && <span style={{ background: "#7c3aed", color: "white", borderRadius: 999, fontSize: 10, padding: "1px 6px", marginLeft: 2 }}>{extras.length}</span>}
            </button>}
            {canSeeAll && <button type="button" onClick={() => setShowEstimatesModal(true)} style={pillAmber}>
              <span style={{ ...iconStyle, background: "#c2410c22" }}>📋</span>
              Estimates {estimates.length > 0 && <span style={{ background: "#c2410c", color: "white", borderRadius: 999, fontSize: 10, padding: "1px 6px", marginLeft: 2 }}>{estimates.length}</span>}
            </button>}
            {canSeeAll && <button type="button" onClick={() => setShowCashflowModal(true)} style={pillBase}>
              <span style={{ ...iconStyle, background: "#2563eb22" }}>📈</span>
              Cashflow
            </button>}
            {canSeeAll && <button type="button" onClick={() => { setShowProfitabilityModal(true); loadProfitability() }} style={pillBase}>
              <span style={{ ...iconStyle, background: "#16a34a22" }}>$</span>
              Profitability
            </button>}

            <div style={divider} />

            {/* Settings */}
            {canSeeAll && <button type="button" onClick={() => setShowWorkersModal(true)} style={pillBase}>
              <span style={{ ...iconStyle, background: "#ffffff11" }}>👷</span>
              Workers
            </button>}
            {canSeeTimesheets && <button type="button" onClick={() => setShowTimesheetModal(true)} style={pillBase}>
              <span style={{ ...iconStyle, background: "#ffffff11" }}>🕐</span>
              Timesheets
            </button>}
            {canSeeAll && <button type="button" onClick={() => setShowClientsModal(true)} style={pillBase}>
              <span style={{ ...iconStyle, background: "#ffffff11" }}>👤</span>
              Clients
            </button>}
            {canSeeAll && <button type="button" onClick={() => setShowContractTypesModal(true)} style={pillBase}>
              <span style={{ ...iconStyle, background: "#ffffff11" }}>📄</span>
              Contracts
            </button>}
            <button type="button" onClick={() => setShowArchived((v) => !v)}
              style={{ ...pillBase, opacity: showArchived ? 1 : 0.6 }}>
              <span style={{ ...iconStyle, background: "#ffffff11" }}>🗄</span>
              {showArchived ? "Hide archived" : "Archived"}
            </button>
            <a href="/systemmap" style={{ ...pillBase, textDecoration: "none" }}>
              <span style={{ ...iconStyle, background: "#ffffff11" }}>🗺</span>
              Map
            </a>

            {/* Timeline extend/shrink — far right */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #1e3a6e, #1e4d2e)", border: "1.5px solid #2563eb", borderRadius: 999, padding: "6px 14px" }}>
              <button type="button" onClick={() => setGanttExtendWeeks(w => Math.max(4, w - 4))}
                style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1, fontWeight: 700 }}>−</button>
              <span style={{ fontSize: 13, color: "#93c5fd", fontWeight: 700 }}>📅 4 weeks</span>
              <button type="button" onClick={() => setGanttExtendWeeks(w => w + 4)}
                style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1, fontWeight: 700 }}>＋</button>
            </div>
          </div>
        )
      })()}


      {loading ? (
        <div>Loading...</div>
      ) : (
        <div ref={ganttScrollRef} style={{ overflowX: "auto", position: "relative" }}>
          <table
            style={{
              borderCollapse: "collapse",
              minWidth: ROW_HEADER_WIDTH + dates.length * DAY_COL_WIDTH,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #2e3650",
                    padding: 6,
                    minWidth: ROW_HEADER_WIDTH,
                    width: ROW_HEADER_WIDTH,
                    background: "#1e2130",
                    position: "sticky",
                    left: 0,
                    zIndex: 5,
                    boxShadow: "2px 0 0 #333",
                  }}
                >
                  Project
                </th>

                {dates.map((date) => {
                  const dateKey = formatDateKey(date)
                  const isToday = todayKey === dateKey

                  return (
                    <th
                      key={dateKey}
                      style={{
                        border: "1px solid #2e3650",
                        padding: 6,
                        background: isToday ? "#171717" : isWeekend(date) ? "#222" : "#111",
                        color: isWeekend(date) ? "#888" : "#ddd",
                        minWidth: DAY_COL_WIDTH,
                        width: DAY_COL_WIDTH,
                        position: "relative",
                      }}
                    >
                      {formatDateLabel(date)}
                      {isToday && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: "50%",
                            width: 2,
                            transform: "translateX(-50%)",
                            background: "#f59e0b",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {projectRows.map((row) => {
                const labelsForRow = labels.filter((l) => l.project_id === row.projectId)
                const lanes = assignLanes(row.segments)
                const rowHeight = getRowHeight(Math.max(lanes.length, 1))

                return (
                  <tr key={row.projectId}>
                    <td
                      style={{
                        border: "1px solid #2e3650",
                        padding: 8,
                        fontWeight: 600,
                        background: "#1e2130",
                        position: "sticky",
                        left: 0,
                        zIndex: 4,
                        width: ROW_HEADER_WIDTH,
                        minWidth: ROW_HEADER_WIDTH,
                        verticalAlign: "top",
                        boxShadow: "2px 0 0 #333",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {projects.find((p) => p.id === row.projectId)?.archived && (
                              <span style={{ fontSize: 10, background: "#3f3f46", color: "#a1a1aa", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>
                                ARCHIVED
                              </span>
                            )}
                            <span>{row.projectName}</span>
                          </div>
                          {projects.find((p) => p.id === row.projectId)?.client && (
                            <div style={{ fontSize: 12, color: "#8899bb", fontWeight: 400, marginTop: 2 }}>
                              {projects.find((p) => p.id === row.projectId)?.client}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => {
                              const project = projects.find((p) => p.id === row.projectId)
                              if (project) openProjectEditor(project)
                            }}
                            style={{
                              background: "none",
                              border: "1px solid #3f3f46",
                              borderRadius: 6,
                              color: "#8899bb",
                              cursor: "pointer",
                              fontSize: 11,
                              padding: "3px 8px",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openMilestoneModal(row.projectId, row.projectName)}
                            style={{
                              background: "none",
                              border: "1px solid #3f3f46",
                              borderRadius: 6,
                              color: "#a78bfa",
                              cursor: "pointer",
                              fontSize: 11,
                              padding: "3px 8px",
                            }}
                          >
                            {(() => {
                              const pm = milestones.filter((m) => m.project_id === row.projectId)
                              const placed = pm.filter((m) => getMilestoneDate(m) !== null).length
                              const total = pm.length
                              const projectContracts = contracts.filter((c) => c.project_id === row.projectId)
                              const contractTotal = projectContracts.reduce((s, c) => s + (c.value ?? 0), 0)
                              const totalAllocated = pm.reduce((sum, m) => sum + (m.amount ?? 0), 0)

                              if (total === 0 && contractTotal === 0) return <span>$</span>

                              if (contractTotal > 0) {
                                const over = totalAllocated > contractTotal
                                const full = totalAllocated === contractTotal
                                return (
                                  <span style={{ color: over ? "#f87171" : full ? "#4ade80" : "#a78bfa" }}>
                                    ${formatMoneyK(totalAllocated)} / ${formatMoneyK(contractTotal)}
                                    {placed < total ? ` · ${placed}/${total}` : ""}
                                  </span>
                                )
                              }

                              const allPlaced = placed === total
                              return (
                                <span style={{ color: allPlaced ? "#a78bfa" : "#f87171" }}>
                                  $ {placed}/{total}
                                </span>
                              )
                            })()}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCostsModal({ open: true, projectId: row.projectId, projectName: row.projectName })}
                            style={{
                              background: "none",
                              border: "1px solid #3f3f46",
                              borderRadius: 6,
                              color: "#fbbf24",
                              cursor: "pointer",
                              fontSize: 11,
                              padding: "3px 8px",
                            }}
                          >
                            {(() => {
                              const costs = projectCosts.filter(c => c.project_id === row.projectId)
                              const total = costs.reduce((s, c) => s + c.amount, 0)
                              return total > 0 ? <span>costs ${formatMoneyK(total)}</span> : <span>costs</span>
                            })()}
                          </button>
                        </div>
                      </div>
                    </td>

                    <td
                      colSpan={dates.length}
                      style={{
                        padding: 0,
                        border: "1px solid #2e3650",
                        background: "#0f1520",
                        position: "relative",
                      }}
                    >
                      <div
                        onDragOverCapture={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = "move"
                        }}
                        onDropCapture={async (e) => {
                          e.preventDefault()

                          if (!draggingToken) return

                          const container = e.currentTarget as HTMLDivElement
                          const targetDateKey = getDateKeyFromPointer(e.clientX, container, dates)
                          const targetDateObj = parseDate(targetDateKey)

                          if (isWeekend(targetDateObj)) return

                          if (draggingToken.startsWith("resize:")) {
                            const segmentId = draggingToken.replace("resize:", "")
                            await resizeSegment(segmentId, targetDateKey)
                            return
                          }

                          await moveSegment(draggingToken, row.projectId, targetDateKey)
                        }}
                        style={{
                          position: "relative",
                          width: dates.length * DAY_COL_WIDTH,
                          height: rowHeight,
                        }}
                      >
                        {dates.map((date) => {
                          const dateKey = formatDateKey(date)
                          const weekend = isWeekend(date)
                          const isToday = todayKey === dateKey

                          return (
                            <div
                              key={dateKey}
                              onClick={() => {
                                if (weekend) return
                                openCellEditor(row.projectId, row.projectName, dateKey)
                              }}
                              style={{
                                position: "absolute",
                                left: dateIndexMap.get(dateKey)! * DAY_COL_WIDTH,
                                top: 0,
                                width: DAY_COL_WIDTH,
                                height: rowHeight,
                                boxSizing: "border-box",
                                borderRight: "1px solid #2e3650",
                                background: weekend ? "#1a1a1a" : "#000",
                                cursor: weekend ? "default" : "pointer",
                              }}
                            >
                              {!weekend && (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 4,
                                    borderRadius: 8,
                                    fontSize: 11,
                                    color: "#888",
                                    background: draggingToken ? "#111827" : "#2a2a2a",
                                    textAlign: "center",
                                    border: draggingToken ? "1px dashed #60a5fa" : "1px dashed #555",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    pointerEvents: "none",
                                    opacity: 0.35,
                                  }}
                                >
                                  NO CREW
                                </div>
                              )}

                              {isToday && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    left: "50%",
                                    width: 2,
                                    transform: "translateX(-50%)",
                                    background: "#f59e0b",
                                    pointerEvents: "none",
                                    zIndex: 3,
                                  }}
                                />
                              )}
                            </div>
                          )
                        })}

                        {labelsForRow.map((label) => {
                          const index = dateIndexMap.get(label.date)
                          if (index === undefined) return null

                          return (
                            <div
                              key={label.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                openCellEditor(row.projectId, row.projectName, label.date)
                              }}
                              style={{
                                position: "absolute",
                                left: index * DAY_COL_WIDTH + 4,
                                top: 4,
                                width: DAY_COL_WIDTH - 8,
                                height: 22,
                                background: "#374151",
                                color: "#e5e7eb",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 600,
                                textAlign: "center",
                                border: "1px dashed #6b7280",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 1,
                                cursor: "pointer",
                              }}
                            >
                              {label.label}
                            </div>
                          )
                        })}

                        {lanes.map((lane, laneIndex) =>
                          lane.map((s) => {
                            const runs = getWorkingRuns(s.start_date, s.end_date, dates, dateIndexMap)
                            if (runs.length === 0) return null

                            const conflictInfo = getSegmentConflictInfo(s, segments, dates)
                            const conflict = conflictInfo.conflict
                            const isBeingMoved = draggingToken === s.id
                            const isBeingResized = draggingToken === `resize:${s.id}`
                            const top = ROW_PADDING_TOP + laneIndex * (BAR_HEIGHT + LANE_GAP)

                            return (
                              <div key={s.id}>
                                {runs.map((run, runIndex) => {
                                  const isFirstRun = runIndex === 0
                                  const isLastRun = runIndex === runs.length - 1
                                  const runWidth = (run.endIndex - run.startIndex + 1) * DAY_COL_WIDTH - 8

                                  return (
                                    <div
                                      key={`${s.id}-${runIndex}`}
                                      draggable={isFirstRun}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openCellEditor(row.projectId, row.projectName, s.start_date, s.id)
                                      }}
                                      onDragStart={(e) => {
                                        if (!isFirstRun) return
                                        e.dataTransfer.setData("text/plain", s.id)
                                        e.dataTransfer.effectAllowed = "move"
                                        setDraggingToken(s.id)
                                      }}
                                      onDragEnd={() => {
                                        if (isFirstRun) setDraggingToken(null)
                                      }}
                                      title={
                                        conflict
                                          ? `${s.crews?.name} overbooked: ${conflictInfo.maxTotalCapacity} / ${conflictInfo.crewCapacity}`
                                          : `${s.crews?.name}: ${conflictInfo.maxTotalCapacity} / ${conflictInfo.crewCapacity}`
                                      }
                                      style={{
                                        position: "absolute",
                                        left: run.startIndex * DAY_COL_WIDTH + 4,
                                        top,
                                        width: Math.max(runWidth, DAY_COL_WIDTH - 8),
                                        height: BAR_HEIGHT,
                                        background: conflict ? "#DC2626" : s.crews?.color || "#2563eb",
                                        borderRadius: 8,
                                        fontSize: 12,
                                        color: "white",
                                        border: conflict ? "2px solid #FCA5A5" : "1px solid rgba(255,255,255,0.15)",
                                        cursor: isFirstRun ? "grab" : "pointer",
                                        opacity: isBeingMoved || isBeingResized ? 0.65 : 1,
                                        userSelect: "none",
                                        zIndex: 2,
                                        display: "flex",
                                        alignItems: "center",
                                        paddingLeft: 10,
                                        paddingRight: isLastRun ? 14 : 10,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                      }}
                                    >
                                      {isFirstRun && (
                                        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                                          {s.name && (
                                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.95 }}>{s.name}</span>
                                          )}
                                          <span style={{ fontSize: s.name ? 10 : 12, opacity: s.name ? 0.7 : 1 }}>
                                            {s.crews?.name}
                                            {Number(s.capacity_fraction ?? 1) < 1 ? ` (${s.capacity_fraction})` : ""}
                                            {conflict ? " ⚠" : ""}
                                          </span>
                                        </span>
                                      )}

                                      {isLastRun && (
                                        <div
                                          draggable
                                          onClick={(e) => e.stopPropagation()}
                                          onDragStart={(e) => {
                                            e.stopPropagation()
                                            e.dataTransfer.setData("text/plain", `resize:${s.id}`)
                                            e.dataTransfer.effectAllowed = "move"
                                            setDraggingToken(`resize:${s.id}`)
                                          }}
                                          onDragEnd={(e) => {
                                            e.stopPropagation()
                                            setDraggingToken(null)
                                          }}
                                          title="Resize segment"
                                          style={{
                                            position: "absolute",
                                            top: 0,
                                            right: 0,
                                            bottom: 0,
                                            width: 10,
                                            cursor: "ew-resize",
                                            background: "rgba(255,255,255,0.35)",
                                            borderTopRightRadius: 8,
                                            borderBottomRightRadius: 8,
                                          }}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })
                        )}

                        {/* Milestone markers */}
                        {milestones
                          .filter((m) => m.project_id === row.projectId)
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((m, milestoneIndex) => {
                            const dateKey = getMilestoneDate(m)
                            if (!dateKey) return null
                            const index = dateIndexMap.get(dateKey)
                            if (index === undefined) return null
                            const left = index * DAY_COL_WIDTH + DAY_COL_WIDTH / 2
                            const contractColor = contracts.find((c) => c.id === m.contract_id)?.color ?? "#a78bfa"
                            return (
                              <div
                                key={m.id}
                                onClick={(e) => { e.stopPropagation(); openMilestoneModal(row.projectId, row.projectName, m.id) }}
                                title={`${m.name ?? "Milestone"}${m.amount ? ` — $${formatMoney(m.amount)}` : ""}${m.percent ? ` (${m.percent}%)` : ""}`}
                                style={{
                                  position: "absolute",
                                  left: left - 10,
                                  bottom: 4,
                                  width: 20,
                                  height: 20,
                                  background: contractColor,
                                  transform: "rotate(45deg)",
                                  cursor: "pointer",
                                  zIndex: 5,
                                  border: `2px solid ${contractColor}cc`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <span style={{ transform: "rotate(-45deg)", fontSize: 9, fontWeight: 800, color: "white", lineHeight: 1, pointerEvents: "none" }}>
                                  {milestoneIndex + 1}
                                </span>
                              </div>
                            )
                          })}

                        {/* Cost payment flags — amber $ at top of bar on effective date */}
                        {projectCosts
                          .filter(c => c.project_id === row.projectId && c.effective_date)
                          .map(c => {
                            const dateKey = c.effective_date!
                            const index = dateIndexMap.get(dateKey)
                            if (index === undefined) return null
                            const left = index * DAY_COL_WIDTH + DAY_COL_WIDTH / 2
                            return (
                              <div
                                key={c.id}
                                onClick={(e) => { e.stopPropagation(); setCostsModal({ open: true, projectId: row.projectId, projectName: row.projectName }) }}
                                title={`${c.description}${c.cost_group ? ` (${c.cost_group})` : ""} — $${formatMoney(c.amount)} — ${c.date_trigger === "segment_start" ? "segment start" : c.date_trigger === "segment_end" ? "segment end" : "fixed date"}`}
                                style={{
                                  position: "absolute",
                                  left: left - 8,
                                  top: 4,
                                  width: 16,
                                  height: 16,
                                  background: "#854d0e",
                                  border: "1px solid #fbbf24",
                                  borderRadius: 3,
                                  cursor: "pointer",
                                  zIndex: 5,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <span style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", lineHeight: 1 }}>$</span>
                              </div>
                            )
                          })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {showAvailability && crews.map((crew) => {
              const capacity = Number(crew.capacity ?? 1)
              const dayMap = crewCapacityByDay.get(crew.id) ?? new Map()
              const expanded = expandedCrews.has(crew.id)

              return (
                <tbody key={`avail-${crew.id}`}>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #252f45",
                        padding: "6px 8px",
                        background: "#0a1a0f",
                        position: "sticky",
                        left: 0,
                        zIndex: 4,
                        width: ROW_HEADER_WIDTH,
                        minWidth: ROW_HEADER_WIDTH,
                        verticalAlign: "middle",
                        boxShadow: "2px 0 0 #333",
                      }}
                    >
                      <div
                        onClick={() => setExpandedCrews((prev) => {
                          const next = new Set(prev)
                          next.has(crew.id) ? next.delete(crew.id) : next.add(crew.id)
                          return next
                        })}
                        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: crew.color ?? "#22c55e", flexShrink: 0 }} />
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#d1fae5", flex: 1 }}>{crew.name}</div>
                        <div style={{ fontSize: 11, color: "#4ade80", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</div>
                      </div>
                    </td>

                    <td
                      colSpan={dates.length}
                      style={{
                        padding: 0,
                        border: "1px solid #252f45",
                        background: "#050f07",
                        position: "relative",
                      }}
                    >
                      {expanded ? (
                        <div style={{ position: "relative", width: dates.length * DAY_COL_WIDTH, height: 48, display: "flex" }}>
                          {dates.map((date) => {
                            const dk = formatDateKey(date)
                            const weekend = isWeekend(date)
                            const booked = dayMap.get(dk) ?? 0
                            const free = capacity - booked
                            const hasGap = !weekend && free > 0
                            const isFull = !weekend && free <= 0
                            const pct = weekend ? 0 : Math.min(booked / capacity, 1)
                            const isToday = todayKey === dk

                            return (
                              <div
                                key={dk}
                                title={weekend ? undefined : `${crew.name}: ${booked} / ${capacity} booked${hasGap ? ` — ${free} free` : ""}`}
                                onClick={() => {
                                  if (!hasGap) return
                                  setSegmentForm((prev) => ({ ...prev, crew_id: crew.id, start_date: dk, end_date: dk }))
                                  setTopModal("addSegment")
                                }}
                                style={{
                                  width: DAY_COL_WIDTH,
                                  height: 48,
                                  flexShrink: 0,
                                  borderRight: "1px solid #1a2e1a",
                                  background: weekend
                                    ? "#050f07"
                                    : hasGap
                                    ? `linear-gradient(to top, #16a34a ${Math.round((1 - pct) * 100)}%, #052e0f ${Math.round((1 - pct) * 100)}%)`
                                    : isFull ? "#1a1a1a" : "#050f07",
                                  cursor: hasGap ? "pointer" : "default",
                                  position: "relative",
                                  boxSizing: "border-box",
                                }}
                              >
                                {hasGap && (
                                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4ade80", pointerEvents: "none" }}>
                                    {free < 1 ? `+${free}` : `+${Math.round(free)}`}
                                  </div>
                                )}
                                {isToday && (
                                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, transform: "translateX(-50%)", background: "#f59e0b", pointerEvents: "none", zIndex: 3 }} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ width: dates.length * DAY_COL_WIDTH, height: 28 }} />
                      )}
                    </td>
                  </tr>
                </tbody>
              )
            })}
          </table>

          {/* Per-week cashflow strip */}
          {(() => {
            if (dates.length === 0) return null

            // Get the Monday on or before the first date in range
            const firstDate = dates[0]
            const firstDay = firstDate.getDay()
            const firstMon = new Date(firstDate)
            firstMon.setDate(firstDate.getDate() - (firstDay === 0 ? 6 : firstDay - 1))

            // Generate all week starts from firstMon until after last date
            const lastDate = dates[dates.length - 1]
            const weekStarts: Date[] = []
            const cursor = new Date(firstMon)
            while (cursor <= lastDate) {
              weekStarts.push(new Date(cursor))
              cursor.setDate(cursor.getDate() + 7)
            }

            // Calculate the pixel offset of each week relative to the start of the dates array
            const firstDateKey = formatDateKey(dates[0])

            return (
              <div style={{ display: "flex", borderTop: "1px solid #1f1f1f", marginTop: 2 }}>
                {/* Sticky label column */}
                <div style={{
                  width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  position: "sticky", left: 0, background: "#0f1520", zIndex: 2,
                }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#6b7a9a", fontWeight: 600 }}>Net cashflow</div>
                    <button
                      type="button"
                      onClick={() => setShowCashflowModal(true)}
                      style={{ fontSize: 10, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}
                    >
                      Full view →
                    </button>
                  </div>
                </div>

                {/* Week cells — positioned to align with date columns */}
                <div style={{ position: "relative", width: dates.length * DAY_COL_WIDTH, flexShrink: 0, minHeight: 52 }}>
                  {weekStarts.map(weekMon => {
                    const wsKey = formatDateKey(weekMon)
                    const weekEndDate = new Date(weekMon)
                    weekEndDate.setDate(weekMon.getDate() + 6)
                    const weKey = formatDateKey(weekEndDate)

                    // Find pixel offset: span from Monday to Sunday within dates array
                    const startIdx = dates.findIndex(d => formatDateKey(d) >= wsKey)
                    if (startIdx === -1) return null
                    const endIdx = dates.findLastIndex(d => formatDateKey(d) <= weKey)
                    if (endIdx === -1) return null
                    const cellWidth = (endIdx - startIdx + 1) * DAY_COL_WIDTH
                    const leftOffset = startIdx * DAY_COL_WIDTH

                    // Find Wednesday of this week for centre alignment
                    const wed = new Date(weekMon)
                    wed.setDate(weekMon.getDate() + 2)
                    const wedKey = formatDateKey(wed)
                    const wedIdx = dates.findIndex(d => formatDateKey(d) === wedKey)
                    // If Wednesday is in range use it, otherwise use midpoint of visible days
                    const centreOffset = wedIdx !== -1
                      ? (wedIdx * DAY_COL_WIDTH) + DAY_COL_WIDTH / 2
                      : leftOffset + cellWidth / 2

                    // Money in
                    const moneyIn = milestones
                      .filter(m => {
                        if (!m.amount) return false
                        const due = m.due_date_override ?? segments.find(s => s.id === m.segment_id)?.end_date
                        return due && due >= wsKey && due <= weKey
                      })
                      .reduce((s, m) => s + (m.amount ?? 0), 0)

                    // Actual labour out
                    const actualOut = timesheetEntries
                      .filter(e => e.date >= wsKey && e.date <= weKey)
                      .reduce((s, e) => {
                        const w = workers.find(x => x.id === e.worker_id)
                        if (!w) return s
                        const trueCost = w.total_cost_hourly_with_ot ?? w.base_rate_hourly ?? 0
                        return s + (e.ordinary_hours ?? 0) * trueCost + (e.ot_hours ?? 0) * (w.ot_rate_hourly ?? 0)
                      }, 0)

                    // Forecast labour out
                    const forecastOut = segments
                      .filter(seg => seg.start_date <= weKey && seg.end_date >= wsKey)
                      .reduce((s, seg) => {
                        const crewWorkerList = workers.filter(w => w.crew_id === seg.crew_id && w.total_cost_hourly_with_ot != null)
                        if (crewWorkerList.length === 0) return s
                        const blended = crewWorkerList.reduce((sum, w) => sum + (w.total_cost_hourly_with_ot ?? 0), 0) / crewWorkerList.length
                        const start = seg.start_date > wsKey ? seg.start_date : wsKey
                        const end = seg.end_date < weKey ? seg.end_date : weKey
                        const days = countWorkingDaysInclusive(start, end)
                        return s + blended * 9 * crewWorkerList.length * days * (seg.capacity_fraction ?? 1)
                      }, 0)

                    // Materials costs out this week — use effective_date
                    const materialsOut = projectCosts
                      .filter(c => c.effective_date && c.effective_date >= wsKey && c.effective_date <= weKey)
                      .reduce((s, c) => s + c.amount, 0)

                    const hasActual = actualOut > 0
                    const outAmount = hasActual ? actualOut + materialsOut : forecastOut + materialsOut
                    const net = moneyIn - outAmount
                    const isPositive = net >= 0
                    const isCurrentWeek = todayKey != null && todayKey >= wsKey && todayKey <= weKey

                    return (
                      <div
                        key={wsKey}
                        style={{
                          position: "absolute",
                          left: centreOffset,
                          transform: "translateX(-50%)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          padding: "8px 4px",
                          background: isCurrentWeek ? "rgba(255,255,255,0.02)" : "transparent",
                          top: 0, bottom: 0,
                        }}
                      >
                        <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: isPositive ? "#4ade80" : "#f87171" }}>
                          {isPositive ? "+" : ""}{formatMoneyK(net)}
                        </div>
                        <div style={{ fontSize: 9, color: "#4a5680", marginTop: 3 }}>
                          {hasActual ? "actual" : "forecast"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {topModal !== null && (
        <div
          onClick={closeTopModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#1e2130",
              border: "1px solid #2e3650",
              borderRadius: 14,
              padding: 22,
              color: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {topModal === "addProject" && "Add Project"}
                {topModal === "addSegment" && "Add Segment"}
              </div>

              <button type="button" onClick={closeTopModal} style={secondaryButtonStyle}>
                Close
              </button>
            </div>

            {topModal === "addProject" && (
              <form onSubmit={addProject} style={{ display: "grid", gap: 16 }}>
                <div style={sectionCardStyle}>
                  <FieldLabel>Project name</FieldLabel>
                  <input
                    placeholder="Enter project name"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    style={fieldStyle}
                  />
                </div>

                <div style={sectionCardStyle}>
                  <FieldLabel>Client</FieldLabel>
                  <input
                    placeholder="Enter client name"
                    value={projectForm.client}
                    onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })}
                    style={fieldStyle}
                  />
                </div>

                <div>
                  <button type="submit" style={baseButtonStyle}>
                    Add Project
                  </button>
                </div>
              </form>
            )}

            {topModal === "addSegment" && (
              <form onSubmit={addSegment} style={{ display: "grid", gap: 16 }}>
                <div style={{ ...sectionCardStyle, borderColor: "#6d28d9" }}>
                  <FieldLabel>Segment name</FieldLabel>
                  <input
                    placeholder="e.g. Frame ground floor, Lock up, Roof..."
                    value={segmentForm.name}
                    onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                    style={{ ...fieldStyle, borderColor: "#6d28d9" }}
                  />
                  <div style={helperStyle}>Name this stage so it appears clearly in milestone dropdowns.</div>
                </div>

                <div style={sectionCardStyle}>
                  <FieldLabel>Project</FieldLabel>
                  <select
                    value={segmentForm.project_id}
                    onChange={(e) => setSegmentForm({ ...segmentForm, project_id: e.target.value })}
                    style={fieldStyle}
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div style={helperStyle}>Choose the project this crew booking belongs to.</div>
                </div>

                <div style={sectionCardStyle}>
                  <FieldLabel>Crew</FieldLabel>
                  <select
                    value={segmentForm.crew_id}
                    onChange={(e) => setSegmentForm({ ...segmentForm, crew_id: e.target.value })}
                    style={fieldStyle}
                  >
                    <option value="">Select crew</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    ...sectionCardStyle,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div>
                    <FieldLabel>Start date</FieldLabel>
                    <input
                      type="date"
                      value={segmentForm.start_date}
                      onChange={(e) => {
                        const nextStart = e.target.value
                        setSegmentForm((prev) => ({
                          ...prev,
                          start_date: nextStart,
                          end_date:
                            !prev.end_date || prev.end_date < nextStart ? nextStart : prev.end_date,
                        }))
                      }}
                      style={fieldStyle}
                    />
                    <div style={helperStyle}>Choose the first working day.</div>
                  </div>

                  <div>
                    <FieldLabel>End date</FieldLabel>
                    <input
                      type="date"
                      value={segmentForm.end_date}
                      onChange={(e) => setSegmentForm({ ...segmentForm, end_date: e.target.value })}
                      style={fieldStyle}
                    />
                    <div style={helperStyle}>Defaults to the same date for a 1-day segment.</div>
                  </div>
                </div>

                <div style={sectionCardStyle}>
                  <FieldLabel>Capacity fraction</FieldLabel>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={segmentForm.capacity_fraction}
                    onChange={(e) => setSegmentForm({ ...segmentForm, capacity_fraction: e.target.value })}
                    style={{ ...fieldStyle, maxWidth: 180 }}
                  />
                  <div style={helperStyle}>Examples: 1, 0.5, 0.25</div>
                </div>

                <div style={sectionCardStyle}>
                  <FieldLabel>Notes</FieldLabel>
                  <textarea
                    placeholder="Optional notes"
                    value={segmentForm.notes}
                    onChange={(e) => setSegmentForm({ ...segmentForm, notes: e.target.value })}
                    style={textareaStyle}
                  />
                </div>

                <div>
                  <button type="submit" style={baseButtonStyle}>
                    Add Segment
                  </button>
                </div>
              </form>
            )}

            {(topModal as string) === "availability" && null}
          </div>
        </div>
      )}

      {cellEditor.open && (
        <div
          onClick={closeCellEditor}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 760,
              background: "#1e2130",
              border: "1px solid #2e3650",
              borderRadius: 14,
              padding: 22,
              color: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{cellEditor.projectName}</div>
                <div style={{ color: "#aaa", marginTop: 4 }}>{formatLongDateLabel(cellEditor.date)}</div>
              </div>
              <button type="button" onClick={closeCellEditor} style={secondaryButtonStyle}>
                Close
              </button>
            </div>

            {cellEditor.existingSegmentIds.length > 0 && (
              <div style={{ ...sectionCardStyle, marginBottom: 18 }}>
                <FieldLabel>Existing booking in this cell</FieldLabel>
                <select
                  value={cellSegmentForm.segmentId}
                  onChange={(e) => handleSelectExistingSegment(e.target.value)}
                  style={fieldStyle}
                >
                  {cellEditor.existingSegmentIds.map((id) => {
                    const seg = segments.find((s) => s.id === id)
                    return (
                      <option key={id} value={id}>
                        {(seg?.crews?.name ?? crews.find((c) => c.id === seg?.crew_id)?.name ?? "Crew")}
                        {seg?.name ? ` - ${seg.name}` : ""} ({seg?.start_date} to {seg?.end_date})
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div style={sectionCardStyle}>
                <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 18 }}>Crew booking</div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <FieldLabel>Segment name</FieldLabel>
                    <input
                      placeholder="e.g. Frame ground floor, Lock up, Roof..."
                      value={cellSegmentForm.name}
                      onChange={(e) => setCellSegmentForm((prev) => ({ ...prev, name: e.target.value }))}
                      style={{ ...fieldStyle, borderColor: "#6d28d9" }}
                    />
                    <div style={helperStyle}>Name this stage so it appears clearly in milestone dropdowns.</div>
                  </div>

                  <div>
                    <FieldLabel>Crew</FieldLabel>
                    <select
                      value={cellSegmentForm.crew_id}
                      onChange={(e) => setCellSegmentForm((prev) => ({ ...prev, crew_id: e.target.value }))}
                      style={fieldStyle}
                    >
                      <option value="">Select crew</option>
                      {crews.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <FieldLabel>Start date</FieldLabel>
                      <input
                        type="date"
                        value={cellSegmentForm.start_date}
                        onChange={(e) => {
                          const nextStart = e.target.value
                          setCellSegmentForm((prev) => ({
                            ...prev,
                            start_date: nextStart,
                            end_date:
                              !prev.end_date || prev.end_date < nextStart ? nextStart : prev.end_date,
                          }))
                        }}
                        style={fieldStyle}
                      />
                    </div>

                    <div>
                      <FieldLabel>End date</FieldLabel>
                      <input
                        type="date"
                        value={cellSegmentForm.end_date}
                        onChange={(e) => setCellSegmentForm((prev) => ({ ...prev, end_date: e.target.value }))}
                        style={fieldStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Capacity fraction</FieldLabel>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      placeholder="Capacity fraction"
                      value={cellSegmentForm.capacity_fraction}
                      onChange={(e) =>
                        setCellSegmentForm((prev) => ({ ...prev, capacity_fraction: e.target.value }))
                      }
                      style={fieldStyle}
                    />
                  </div>

                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <textarea
                      placeholder="Optional notes"
                      value={cellSegmentForm.notes}
                      onChange={(e) => setCellSegmentForm((prev) => ({ ...prev, notes: e.target.value }))}
                      style={textareaStyle}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={saveCellSegment}
                      style={baseButtonStyle}
                    >
                      {cellSegmentForm.segmentId ? "Save segment" : "Add segment"}
                    </button>

                    {cellSegmentForm.segmentId && (
                      <button
                        type="button"
                        onClick={deleteCellSegment}
                        style={dangerButtonStyle}
                      >
                        Delete segment
                      </button>
                    )}
                  </div>

                  {cellSegmentForm.segmentId && (() => {
                    const linkedMilestone = milestones.find((m) => m.segment_id === cellSegmentForm.segmentId)
                    const unlinkedMilestones = milestones.filter(
                      (m) => m.project_id === cellEditor.projectId && !m.segment_id && !m.due_date_override
                    )
                    const segmentProjectId = segments.find((s) => s.id === cellSegmentForm.segmentId)?.project_id ?? cellEditor.projectId

                    return (
                      <div style={{ borderTop: "1px solid #2e3650", paddingTop: 12, marginTop: 4 }}>
                        <FieldLabel>Milestone</FieldLabel>
                        {linkedMilestone ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: "#1a1030", border: "1px solid #4c1d95", borderRadius: 8, padding: "8px 12px" }}>
                                <div style={{ width: 14, height: 14, background: "#a78bfa", border: "2px solid #7c3aed", transform: "rotate(45deg)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ transform: "rotate(-45deg)", fontSize: 8, fontWeight: 800, color: "#3b0764" }}>
                                    {milestones.filter((m) => m.project_id === cellEditor.projectId).sort((a,b) => a.sort_order - b.sort_order).findIndex((m) => m.id === linkedMilestone.id) + 1}
                                  </span>
                                </div>
                                <span style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 600 }}>
                                  {linkedMilestone.name ?? "Milestone"}
                                  {linkedMilestone.amount ? ` — $${formatMoney(linkedMilestone.amount)}` : ""}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  await supabase.from("milestones").update({ segment_id: null }).eq("id", linkedMilestone.id)
                                  await loadData()
                                }}
                                style={{ ...secondaryButtonStyle, fontSize: 11, padding: "6px 10px" }}
                              >
                                Unlink
                              </button>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                defaultValue={linkedMilestone.name ?? ""}
                                key={linkedMilestone.id}
                                placeholder="Rename milestone..."
                                style={{ ...fieldStyle, fontSize: 12, padding: "6px 10px" }}
                                onBlur={async (e) => {
                                  const newName = e.target.value.trim()
                                  if (!newName || newName === linkedMilestone.name) return
                                  await supabase.from("milestones").update({ name: newName }).eq("id", linkedMilestone.id)
                                  await loadData()
                                  showToast("Milestone renamed")
                                }}
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return
                                  const newName = (e.target as HTMLInputElement).value.trim()
                                  if (!newName || newName === linkedMilestone.name) return
                                  await supabase.from("milestones").update({ name: newName }).eq("id", linkedMilestone.id)
                                  await loadData()
                                  showToast("Milestone renamed")
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {unlinkedMilestones.length > 0 ? (
                              <select
                                defaultValue=""
                                onChange={async (e) => {
                                  if (!e.target.value) return
                                  await supabase.from("milestones").update({ segment_id: cellSegmentForm.segmentId }).eq("id", e.target.value)
                                  await loadData()
                                }}
                                style={{ ...fieldStyle, flex: 1 }}
                              >
                                <option value="">Link existing milestone...</option>
                                {unlinkedMilestones.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name ?? "Unnamed milestone"}</option>
                                ))}
                              </select>
                            ) : null}
                            <button
                              type="button"
                              onClick={async () => {
                                const existing = milestones.filter((m) => m.project_id === segmentProjectId)
                                await supabase.from("milestones").insert({
                                  project_id: segmentProjectId,
                                  name: "Payment milestone",
                                  segment_id: cellSegmentForm.segmentId,
                                  amount: null,
                                  percent: null,
                                  due_date_override: null,
                                  sort_order: existing.length,
                                })
                                await loadData()
                                showToast("Milestone added")
                              }}
                              style={{ ...secondaryButtonStyle, fontSize: 11, padding: "6px 12px", color: "#a78bfa", borderColor: "#4c1d95" }}
                            >
                              + New milestone
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div style={sectionCardStyle}>
                <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 18 }}>Day label</div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <FieldLabel>Label</FieldLabel>
                    <input
                      placeholder="Materials, Steel, Windows"
                      value={cellLabelForm.label}
                      onChange={(e) => setCellLabelForm((prev) => ({ ...prev, label: e.target.value }))}
                      style={fieldStyle}
                    />
                    <div style={helperStyle}>Leave blank and save to remove the label.</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={saveCellLabel}
                      style={{ ...secondaryButtonStyle, background: "#4b5563" }}
                    >
                      {cellLabelForm.labelId ? "Save label" : "Add label"}
                    </button>

                    {cellLabelForm.labelId && (
                      <button
                        type="button"
                        onClick={deleteCellLabel}
                        style={dangerButtonStyle}
                      >
                        Delete label
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {projectEditor.open && (
        <div
          onClick={closeProjectEditor}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 680,
              background: "#1e2130",
              border: "1px solid #2e3650",
              borderRadius: 14,
              padding: 22,
              color: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>Edit Project</div>
              <button type="button" onClick={closeProjectEditor} style={secondaryButtonStyle}>
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={sectionCardStyle}>
                  <FieldLabel>Project name</FieldLabel>
                  <input
                    placeholder="Project name"
                    value={projectEditor.name}
                    onChange={(e) => setProjectEditor((prev) => ({ ...prev, name: e.target.value }))}
                    style={fieldStyle}
                  />
                </div>
                <div style={sectionCardStyle}>
                  <FieldLabel>Client</FieldLabel>
                  <input
                    placeholder="Client name"
                    value={projectEditor.client}
                    onChange={(e) => setProjectEditor((prev) => ({ ...prev, client: e.target.value }))}
                    style={fieldStyle}
                  />
                </div>
              </div>

              {/* Contracts section */}
              <div style={{ ...sectionCardStyle, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#d4d4d8" }}>Trade contracts</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      defaultValue=""
                      onChange={async (e) => {
                        if (!e.target.value) return
                        const typeId = e.target.value === "custom" ? undefined : e.target.value
                        await addContract(projectEditor.projectId, typeId)
                        e.target.value = ""
                      }}
                      style={{ ...fieldStyle, fontSize: 12, padding: "4px 10px", width: "auto" }}
                    >
                      <option value="">+ Add contract...</option>
                      {contractTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                      ))}
                      <option value="custom">Custom (no template)</option>
                    </select>
                  </div>
                </div>
                {contracts.filter((c) => c.project_id === projectEditor.projectId).sort((a, b) => a.sort_order - b.sort_order).map((c) => (
                  <div key={c.id} style={{ background: "#1e2535", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                      <div>
                        <FieldLabel>Contract name</FieldLabel>
                        <input
                          defaultValue={c.name ?? ""}
                          key={`name-${c.id}`}
                          placeholder="e.g. Framing carpentry"
                          style={fieldStyle}
                          onBlur={async (e) => {
                            await saveContract({ ...c, name: e.target.value })
                          }}
                        />
                      </div>
                      <div>
                        <FieldLabel>Value ($ inc. GST)</FieldLabel>
                        <input
                          type="number"
                          defaultValue={c.value ?? ""}
                          key={`val-${c.id}`}
                          placeholder="0.00"
                          style={fieldStyle}
                          onBlur={async (e) => {
                            await saveContract({ ...c, value: e.target.value ? Number(e.target.value) : null })
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 2 }}>
                        <input
                          type="color"
                          defaultValue={c.color ?? "#2563eb"}
                          key={`col-${c.id}`}
                          style={{ width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer", background: "none" }}
                          onBlur={async (e) => {
                            await saveContract({ ...c, color: e.target.value })
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => deleteContract(c.id)}
                          style={{ ...dangerButtonStyle, fontSize: 11, padding: "4px 8px" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {c.value && (
                      <div style={{ fontSize: 11, color: "#6b7a9a" }}>
                        ${formatMoney(c.value)} inc. GST · ${formatMoney(c.value / 1.1)} ex. GST
                      </div>
                    )}
                  </div>
                ))}
                {contracts.filter((c) => c.project_id === projectEditor.projectId).length === 0 && (
                  <div style={{ fontSize: 12, color: "#6b7a9a" }}>No contracts yet — add one above.</div>
                )}
                {contracts.filter((c) => c.project_id === projectEditor.projectId).length > 0 && (
                  <div style={{ fontSize: 12, color: "#6b7a9a", borderTop: "1px solid #252f45", paddingTop: 8 }}>
                    Total: ${formatMoney(contracts.filter((c) => c.project_id === projectEditor.projectId).reduce((s, c) => s + (c.value ?? 0), 0))} inc. GST
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
                <button type="button" onClick={saveProject} style={baseButtonStyle}>
                  Save changes
                </button>

                <button type="button" onClick={toggleArchiveProject} style={secondaryButtonStyle}>
                  {projectEditor.archived ? "Unarchive project" : "Archive project"}
                </button>

                <button type="button" onClick={deleteProject} style={dangerButtonStyle}>
                  Delete project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {milestoneModal.open && (() => {
        const projectContracts = contracts
          .filter((c) => c.project_id === milestoneModal.projectId)
          .sort((a, b) => a.sort_order - b.sort_order)
        const projectSegments = segments
          .filter((s) => s.project_id === milestoneModal.projectId)
          .sort((a, b) => compareDateStrings(a.start_date, b.start_date))
        const closeModal = () => setMilestoneModal({ open: false, projectId: "", projectName: "", focusedMilestoneId: null })
        const totalContractValue = projectContracts.reduce((s, c) => s + (c.value ?? 0), 0)
        const totalAllocated = milestones.filter((m) => m.project_id === milestoneModal.projectId).reduce((s, m) => s + (m.amount ?? 0), 0)

        const renderMilestoneCard = (m: Milestone, milestoneIndex: number, contractColor: string, contractValue: number | null) => {
          const resolvedDate = getMilestoneDate(m)
          const isFocused = milestoneModal.focusedMilestoneId === m.id
          return (
            <div
              key={m.id}
              id={`milestone-${m.id}`}
              ref={isFocused ? (el) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" }) : undefined}
              style={{ ...sectionCardStyle, display: "grid", gap: 12, border: isFocused ? `2px solid ${contractColor}` : sectionCardStyle.border, background: isFocused ? "#1a1030" : sectionCardStyle.background }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 20, height: 20, background: contractColor, border: `2px solid ${contractColor}cc`, transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ transform: "rotate(-45deg)", fontSize: 9, fontWeight: 800, color: "white" }}>{milestoneIndex + 1}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: isFocused ? "#c4b5fd" : "#d4d4d8" }}>
                  {m.name ?? `Milestone ${milestoneIndex + 1}`}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <FieldLabel>Linked segment</FieldLabel>
                  <select value={m.segment_id ?? ""} onChange={(e) => { const updated = { ...m, segment_id: e.target.value || null }; setMilestones((prev) => prev.map((x) => x.id === m.id ? updated : x)); saveMilestone(updated) }} style={fieldStyle}>
                    <option value="">None</option>
                    {projectSegments.map((s, si) => {
                      const crewName = s.crews?.name ?? s.name ?? "Crew"
                      const segLabel = s.name ? `${s.name} (${crewName})` : crewName
                      return <option key={s.id} value={s.id}>{si + 1}. {segLabel} — {formatLongDateLabel(s.start_date)} to {formatLongDateLabel(s.end_date)}</option>
                    })}
                  </select>
                </div>
                <div>
                  <FieldLabel>Resolved date</FieldLabel>
                  <div style={{ ...fieldStyle, color: resolvedDate ? contractColor : "#52525b", display: "flex", alignItems: "center" }}>{resolvedDate ?? "Not set"}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <input value={m.name ?? ""} onChange={(e) => setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, name: e.target.value } : x))} onBlur={() => saveMilestone(m)} style={fieldStyle} />
                </div>
                <div>
                  <FieldLabel>Fixed date override</FieldLabel>
                  <input type="date" value={m.due_date_override ?? ""} onChange={(e) => { const updated = { ...m, due_date_override: e.target.value || null }; setMilestones((prev) => prev.map((x) => x.id === m.id ? updated : x)); saveMilestone(updated) }} style={fieldStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <FieldLabel>Amount ($ inc. GST)</FieldLabel>
                  <input type="number" value={m.amount ?? ""} onChange={(e) => { const amount = e.target.value ? Number(e.target.value) : null; const percent = amount != null && contractValue ? Number(((amount / contractValue) * 100).toFixed(2)) : m.percent; setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, amount, percent } : x)) }} onBlur={(e) => { const amount = e.target.value ? Number(e.target.value) : null; const percent = amount != null && contractValue ? Number(((amount / contractValue) * 100).toFixed(2)) : m.percent; saveMilestone({ ...m, amount, percent }) }} placeholder="0.00" style={fieldStyle} />
                </div>
                <div>
                  <FieldLabel>% of contract{contractValue ? ` ($${formatMoney(contractValue)} inc. GST)` : ""}</FieldLabel>
                  <input type="number" value={m.percent ?? ""} onChange={(e) => { const percent = e.target.value ? Number(e.target.value) : null; const amount = percent != null && contractValue ? Math.round(contractValue * percent / 100) : m.amount; setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, percent, amount } : x)) }} onBlur={(e) => { const percent = e.target.value ? Number(e.target.value) : null; const amount = percent != null && contractValue ? Math.round(contractValue * percent / 100) : m.amount; saveMilestone({ ...m, percent, amount }) }} placeholder="25" style={fieldStyle} />
                </div>
              </div>
              <button type="button" onClick={() => deleteMilestone(m.id)} style={{ ...dangerButtonStyle, fontSize: 12, padding: "6px 12px", width: "fit-content" }}>Delete milestone</button>
            </div>
          )
        }

        return (
          <div onClick={closeModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Milestones</div>
                  <div style={{ fontSize: 13, color: "#8899bb", marginTop: 2 }}>{milestoneModal.projectName}</div>
                </div>
                <button type="button" onClick={closeModal} style={secondaryButtonStyle}>Close</button>
              </div>

              {/* Project totals bar */}
              {totalContractValue > 0 && (
                <div style={{ background: "#141a28", border: "1px solid #252f45", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 3 }}>Total contracts (inc. GST)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#e4e4e7" }}>${formatMoney(totalContractValue)}</div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginTop: 2 }}>${formatMoney(totalContractValue / 1.1)} ex. GST</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 3 }}>Allocated</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: totalAllocated > totalContractValue ? "#f87171" : "#a78bfa" }}>${formatMoney(totalAllocated)}</div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginTop: 2 }}>${formatMoney(totalAllocated / 1.1)} ex. GST</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 3 }}>Remaining</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: totalContractValue - totalAllocated === 0 ? "#4ade80" : totalAllocated > totalContractValue ? "#f87171" : "#e4e4e7" }}>
                      {totalAllocated === totalContractValue ? "✓ Fully allocated" : totalAllocated > totalContractValue ? `-$${formatMoney(totalAllocated - totalContractValue)}` : `$${formatMoney(totalContractValue - totalAllocated)}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Per-contract sections */}
              {projectContracts.length === 0 && (
                <div style={{ color: "#6b7a9a", fontSize: 13, marginBottom: 16 }}>
                  No contracts set up yet. Add contracts via the Edit button on the project row.
                </div>
              )}

              {projectContracts.map((contract) => {
                const contractMilestones = milestones
                  .filter((m) => m.project_id === milestoneModal.projectId && m.contract_id === contract.id)
                  .sort((a, b) => a.sort_order - b.sort_order)
                const contractAllocated = contractMilestones.reduce((s, m) => s + (m.amount ?? 0), 0)
                const color = contract.color ?? "#a78bfa"

                return (
                  <div key={contract.id} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${color}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#e4e4e7" }}>{contract.name ?? "Unnamed contract"}</span>
                        {contract.value && (
                          <span style={{ fontSize: 12, color: "#8899bb" }}>${formatMoney(contract.value)} inc. GST</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {contract.value && (
                          <span style={{ fontSize: 12, color: contractAllocated > contract.value ? "#f87171" : contractAllocated === contract.value ? "#4ade80" : "#71717a" }}>
                            ${formatMoney(contractAllocated)} / ${formatMoney(contract.value)} allocated
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => autoLinkMilestones(milestoneModal.projectId, contract.id)}
                          style={{ ...secondaryButtonStyle, fontSize: 11, padding: "4px 10px", color: "#4ade80", borderColor: "#166534" }}
                          title="Automatically link unlinked milestones to segments in chronological order"
                        >
                          Auto-link
                        </button>
                        <button type="button" onClick={() => addMilestone(milestoneModal.projectId, contract.id)} style={{ ...secondaryButtonStyle, fontSize: 11, padding: "4px 10px" }}>+ Add</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {contractMilestones.map((m, i) => renderMilestoneCard(m, i, color, contract.value))}
                      {contractMilestones.length === 0 && (
                        <div style={{ fontSize: 12, color: "#6b7a9a", padding: "8px 0" }}>No milestones yet — click + Add above.</div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Unlinked milestones (no contract) */}
              {(() => {
                const unlinked = milestones.filter((m) => m.project_id === milestoneModal.projectId && !m.contract_id).sort((a, b) => a.sort_order - b.sort_order)
                if (unlinked.length === 0) return null
                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#8899bb", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #2e3650" }}>Unassigned milestones</div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {unlinked.map((m, i) => renderMilestoneCard(m, i, "#71717a", null))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}


      {/* ── Estimate Template Manager ── */}
      {showTemplateManager && (
        <div onClick={() => setShowTemplateManager(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 130, padding: 20, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 900, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 28, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", marginBottom: 20 }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#f0f4ff" }}>Job Templates</div>
                <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 4 }}>Build reusable estimate templates with multiple line items. Load them into any estimate in one click.</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={async () => {
                  const { data } = await supabase.from("estimate_templates").insert({ name: "New template", quote_type: "framing", sort_order: estimateTemplates.length }).select().single()
                  await loadData()
                }} style={{ ...secondaryButtonStyle, color: "#86efac", borderColor: "#166534" }}>+ New template</button>
                <button type="button" onClick={() => setShowTemplateManager(false)} style={secondaryButtonStyle}>Close</button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 20 }}>
              {estimateTemplates.map(tmpl => {
                const items = estimateTemplateItems.filter(i => i.template_id === tmpl.id).sort((a, b) => a.sort_order - b.sort_order)
                const total = items.reduce((s, i) => s + i.quantity * i.unit_cost * (1 + i.margin_percent / 100), 0)
                return (
                  <div key={tmpl.id} style={{ background: "#141a28", border: "1px solid #252f45", borderRadius: 12, padding: 20 }}>
                    {/* Template header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
                      <div>
                        <FieldLabel>Template name</FieldLabel>
                        <input defaultValue={tmpl.name} key={`tn-${tmpl.id}`} style={{ ...fieldStyle, fontSize: 16, fontWeight: 700 }}
                          onBlur={async e => { await supabase.from("estimate_templates").update({ name: e.target.value }).eq("id", tmpl.id); await loadData() }} />
                      </div>
                      <div>
                        <FieldLabel>Description</FieldLabel>
                        <input defaultValue={tmpl.description ?? ""} key={`td-${tmpl.id}`} placeholder="Short description..." style={fieldStyle}
                          onBlur={async e => { await supabase.from("estimate_templates").update({ description: e.target.value || null }).eq("id", tmpl.id); await loadData() }} />
                      </div>
                      <div>
                        <FieldLabel>Quote type</FieldLabel>
                        <select defaultValue={tmpl.quote_type ?? "framing"} key={`tq-${tmpl.id}`} style={fieldStyle}
                          onChange={async e => { await supabase.from("estimate_templates").update({ quote_type: e.target.value }).eq("id", tmpl.id); await loadData() }}>
                          <option value="framing">Framing</option>
                          <option value="steel">Structural Steel</option>
                        </select>
                      </div>
                      <button type="button" onClick={async () => {
                        if (!window.confirm("Delete this template?")) return
                        await supabase.from("estimate_templates").delete().eq("id", tmpl.id)
                        await loadData()
                      }} style={{ ...dangerButtonStyle, fontSize: 12, padding: "6px 12px" }}>Delete</button>
                    </div>

                    {/* Items */}
                    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 70px 70px 90px 80px auto", gap: 8, padding: "6px 8px", background: "#0f1520", borderRadius: 6 }}>
                        {["Category", "Description / Scope", "Qty", "Unit", "Unit cost", "Margin%", ""].map(h => (
                          <div key={h} style={{ fontSize: 10, color: "#6b7a9a", fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
                        ))}
                      </div>
                      {items.map((item, idx) => (
                        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 70px 70px 90px 80px auto", gap: 8, alignItems: "start", background: "#1e2535", borderRadius: 8, padding: "10px 8px" }}>
                          <select defaultValue={item.category} key={`tic-${item.id}`} style={{ ...fieldStyle, fontSize: 12, padding: "6px 8px" }}
                            onChange={async e => { await supabase.from("estimate_template_items").update({ category: e.target.value }).eq("id", item.id); await loadData() }}>
                            {ESTIMATE_ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <div style={{ display: "grid", gap: 4 }}>
                            <input defaultValue={item.description ?? ""} key={`tid-${item.id}`} placeholder="Description" style={{ ...fieldStyle, fontSize: 13, fontWeight: 600 }}
                              onBlur={async e => { await supabase.from("estimate_template_items").update({ description: e.target.value }).eq("id", item.id); await loadData() }} />
                            <textarea defaultValue={item.scope ?? ""} key={`tis-${item.id}`} placeholder="Scope bullet points (one per line)..." rows={2}
                              style={{ ...fieldStyle, fontSize: 11, resize: "vertical" }}
                              onBlur={async e => { await supabase.from("estimate_template_items").update({ scope: e.target.value || null }).eq("id", item.id); await loadData() }} />
                          </div>
                          <input type="number" defaultValue={item.quantity} key={`tiq-${item.id}`} style={{ ...fieldStyle, fontSize: 13, padding: "6px 8px", textAlign: "center" }}
                            onBlur={async e => { await supabase.from("estimate_template_items").update({ quantity: Number(e.target.value) }).eq("id", item.id); await loadData() }} />
                          <select defaultValue={item.unit} key={`tiu-${item.id}`} style={{ ...fieldStyle, fontSize: 12, padding: "6px 8px" }}
                            onChange={async e => { await supabase.from("estimate_template_items").update({ unit: e.target.value }).eq("id", item.id); await loadData() }}>
                            {["week","day","hr","m²","m³","lm","item","allow","lot"].map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <input type="number" defaultValue={item.unit_cost} key={`tiuc-${item.id}`} placeholder="0" style={{ ...fieldStyle, fontSize: 13, padding: "6px 8px" }}
                            onBlur={async e => { await supabase.from("estimate_template_items").update({ unit_cost: Number(e.target.value) }).eq("id", item.id); await loadData() }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <input type="number" defaultValue={item.margin_percent} key={`tim-${item.id}`} style={{ ...fieldStyle, fontSize: 13, padding: "6px 6px" }}
                              onBlur={async e => { await supabase.from("estimate_template_items").update({ margin_percent: Number(e.target.value) }).eq("id", item.id); await loadData() }} />
                            <span style={{ fontSize: 10, color: "#6b7a9a" }}>%</span>
                          </div>
                          <button type="button" onClick={async () => {
                            await supabase.from("estimate_template_items").delete().eq("id", item.id)
                            await loadData()
                          }} style={{ background: "none", border: "none", color: "#6b7a9a", cursor: "pointer", fontSize: 16, padding: "4px" }}>×</button>
                        </div>
                      ))}
                      {items.length === 0 && <div style={{ fontSize: 13, color: "#6b7a9a", padding: "8px 0" }}>No items yet — add one below.</div>}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <button type="button" onClick={async () => {
                        await supabase.from("estimate_template_items").insert({ template_id: tmpl.id, category: "labour", description: "New item", quantity: 1, unit: "week", unit_cost: 0, margin_percent: 30, sort_order: items.length })
                        await loadData()
                      }} style={{ ...secondaryButtonStyle, fontSize: 12, padding: "6px 14px", color: "#60a5fa", borderColor: "#1d4ed8" }}>+ Add item</button>
                      {total > 0 && <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>Template total: ${total.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ex GST</div>}
                    </div>
                  </div>
                )
              })}
              {estimateTemplates.length === 0 && <div style={{ fontSize: 14, color: "#6b7a9a", textAlign: "center", padding: "40px 0" }}>No templates yet — click + New template above.</div>}
            </div>
          </div>
        </div>
      )}

      {showContractTypesModal && (
        <div
          onClick={() => setShowContractTypesModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 680, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Contract types</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={addContractType} style={secondaryButtonStyle}>+ Add type</button>
                <button type="button" onClick={() => setShowContractTypesModal(false)} style={secondaryButtonStyle}>Close</button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {contractTypes.map((ct) => {
                const typeMilestones = contractTypeMilestones
                  .filter((m) => m.contract_type_id === ct.id)
                  .sort((a, b) => a.sort_order - b.sort_order)

                return (
                  <div key={ct.id} style={sectionCardStyle}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <FieldLabel>Type name</FieldLabel>
                        <input
                          defaultValue={ct.name}
                          key={`ct-name-${ct.id}`}
                          style={fieldStyle}
                          onBlur={async (e) => { await saveContractType({ ...ct, name: e.target.value }) }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteContractType(ct.id)}
                        style={{ ...dangerButtonStyle, fontSize: 11, padding: "6px 10px", marginBottom: 2 }}
                      >
                        Delete type
                      </button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <FieldLabel>Default milestones</FieldLabel>
                        <button
                          type="button"
                          onClick={() => addContractTypeMilestone(ct.id)}
                          style={{ ...secondaryButtonStyle, fontSize: 11, padding: "3px 8px" }}
                        >
                          + Add
                        </button>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {typeMilestones.map((m, i) => (
                          <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", background: "#1e2535", borderRadius: 8, padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: "#8899bb", minWidth: 16 }}>{i + 1}.</span>
                              <input
                                defaultValue={m.name ?? ""}
                                key={`ctm-name-${m.id}`}
                                placeholder="Milestone name"
                                style={{ ...fieldStyle, padding: "6px 10px", fontSize: 13 }}
                                onBlur={async (e) => { await saveContractTypeMilestone({ ...m, name: e.target.value }) }}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <input
                                type="number"
                                defaultValue={m.percent ?? ""}
                                key={`ctm-pct-${m.id}`}
                                placeholder="%"
                                style={{ ...fieldStyle, padding: "6px 10px", fontSize: 13, width: 70 }}
                                onBlur={async (e) => { await saveContractTypeMilestone({ ...m, percent: e.target.value ? Number(e.target.value) : null }) }}
                              />
                              <span style={{ fontSize: 11, color: "#8899bb" }}>%</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteContractTypeMilestone(m.id)}
                              style={{ ...dangerButtonStyle, fontSize: 11, padding: "4px 8px" }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {typeMilestones.length === 0 && (
                          <div style={{ fontSize: 12, color: "#6b7a9a" }}>No default milestones — click + Add above.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {contractTypes.length === 0 && (
                <div style={{ fontSize: 13, color: "#6b7a9a" }}>No contract types yet — click + Add type above.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showWorkersModal && (
        <div
          onClick={() => setShowWorkersModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 120, padding: 20, overflowY: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 1100, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", marginBottom: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Workers & Rates</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={selectedWorkerCrew}
                  onChange={(e) => setSelectedWorkerCrew(e.target.value)}
                  style={{ ...fieldStyle, width: "auto", fontSize: 13, padding: "6px 10px" }}
                >
                  <option value="all">All crews</option>
                  {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowWorkersModal(false)} style={secondaryButtonStyle}>Close</button>
              </div>
            </div>

            {/* Classification rates section */}
            <div style={{ ...sectionCardStyle, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Standard charge-out rates (ex GST)</div>
                <button type="button" onClick={addClassificationRate} style={{ ...secondaryButtonStyle, fontSize: 11, padding: "4px 10px" }}>+ Add</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {classificationRates.map((r) => (
                  <div key={r.id} style={{ background: "#1e2535", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#8899bb", marginBottom: 4 }}>{r.classification}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "#8899bb" }}>$</span>
                      <input
                        type="number"
                        defaultValue={r.rate_ex_gst}
                        key={`cr-${r.id}`}
                        style={{ ...fieldStyle, padding: "4px 8px", fontSize: 14, fontWeight: 700 }}
                        onBlur={async (e) => { await saveClassificationRate({ ...r, rate_ex_gst: Number(e.target.value) }) }}
                      />
                      <span style={{ fontSize: 11, color: "#8899bb" }}>/hr</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginTop: 4 }}>${formatMoney(r.rate_ex_gst * 1.1)} inc. GST</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-crew worker sections */}
            {(selectedWorkerCrew === "all" ? crews : crews.filter((c) => c.id === selectedWorkerCrew)).map((crew) => {
              const crewWorkers = workers.filter((w) => w.crew_id === crew.id).sort((a, b) => a.sort_order - b.sort_order)
              const blendedCost = getCrewBlendedCost(crew.id)
              const blendedCostWithOT = getCrewBlendedCostWithOT(crew.id)

              return (
                <div key={crew.id} style={{ marginBottom: 32 }}>
                  <div style={{ background: "#161d2e", border: `1px solid ${crew.color ?? "#2e3650"}`, borderLeft: `5px solid ${crew.color ?? "#2563eb"}`, borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                    {/* Line 1 — crew name + worker count + add button */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: crew.color ?? "#666", flexShrink: 0, boxShadow: `0 0 8px ${crew.color ?? "#666"}88` }} />
                        <span style={{ fontWeight: 900, fontSize: 28, color: "#f0f4ff", letterSpacing: "-0.5px" }}>{crew.name}</span>
                        {blendedCostWithOT != null && (
                          <span style={{ fontSize: 14, color: "#8899bb", fontWeight: 600, background: "#1e2535", border: "1px solid #2e3a58", borderRadius: 6, padding: "3px 10px" }}>
                            {crewWorkers.filter(w => w.total_cost_hourly_with_ot != null).length} workers
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => addWorker(crew.id)} style={{ ...secondaryButtonStyle, fontSize: 13, padding: "8px 16px" }}>+ Add worker</button>
                    </div>
                    {/* Line 2 — rate cards */}
                    {blendedCostWithOT != null && (() => {
                      const hoursPerDay = 9
                      const workerCount = crewWorkers.filter((w) => w.total_cost_hourly_with_ot != null).length
                      const totalCostPerDay = blendedCostWithOT * hoursPerDay * workerCount
                      const totalCostPerWeek = totalCostPerDay * 5
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                          <div style={{ background: "#1e2535", borderRadius: 10, padding: "14px 18px" }}>
                            <div style={{ fontSize: 12, color: "#6b7a9a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Whole crew cost</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#f0f4ff", lineHeight: 1 }}>${formatMoney(blendedCostWithOT * workerCount)}<span style={{ fontSize: 14, fontWeight: 500, color: "#8899bb" }}>/hr</span></div>
                            <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 6 }}>${formatMoney(blendedCostWithOT)}/hr per worker · <strong style={{ color: "#a0b0cc" }}>straight ${formatMoney(blendedCost ?? 0)}/hr</strong></div>
                          </div>
                          <div style={{ background: "#1e2535", borderRadius: 10, padding: "14px 18px" }}>
                            <div style={{ fontSize: 12, color: "#6b7a9a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Crew cost per day</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#f0f4ff", lineHeight: 1 }}>${formatMoneyK(totalCostPerDay)}<span style={{ fontSize: 14, fontWeight: 500, color: "#8899bb" }}>/day</span></div>
                            <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 6 }}>${formatMoneyK(totalCostPerWeek)}/wk · <strong style={{ color: "#a0b0cc" }}>{workerCount} workers</strong></div>
                          </div>
                          <div style={{ background: "#0f1d35", border: "1px solid #1d4ed8", borderRadius: 10, padding: "14px 18px" }}>
                            <div style={{ fontSize: 12, color: "#60a5fa", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Charge-out @ 30%</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#60a5fa", lineHeight: 1 }}>${formatMoney(calcChargeout(blendedCostWithOT, 0.3) * workerCount)}<span style={{ fontSize: 14, fontWeight: 500 }}>/hr</span></div>
                            <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 6 }}>${formatMoneyK(calcChargeout(blendedCostWithOT, 0.3) * hoursPerDay * workerCount)}/day · <strong style={{ color: "#60a5fa" }}>${formatMoneyK(calcChargeout(blendedCostWithOT, 0.3) * hoursPerDay * workerCount * 5)}/wk</strong></div>
                          </div>
                          <div style={{ background: "#0a2010", border: "1px solid #16a34a", borderRadius: 10, padding: "14px 18px" }}>
                            <div style={{ fontSize: 12, color: "#34d399", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Charge-out @ 40%</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#34d399", lineHeight: 1 }}>${formatMoney(calcChargeout(blendedCostWithOT, 0.4) * workerCount)}<span style={{ fontSize: 14, fontWeight: 500 }}>/hr</span></div>
                            <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 6 }}>${formatMoneyK(calcChargeout(blendedCostWithOT, 0.4) * hoursPerDay * workerCount)}/day · <strong style={{ color: "#34d399" }}>${formatMoneyK(calcChargeout(blendedCostWithOT, 0.4) * hoursPerDay * workerCount * 5)}/wk</strong></div>
                          </div>
                          <div style={{ background: "#150f2e", border: "1px solid #7c3aed", borderRadius: 10, padding: "14px 18px" }}>
                            <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Charge-out @ 50%</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: "#a78bfa", lineHeight: 1 }}>${formatMoney(calcChargeout(blendedCostWithOT, 0.5) * workerCount)}<span style={{ fontSize: 14, fontWeight: 500 }}>/hr</span></div>
                            <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 6 }}>${formatMoneyK(calcChargeout(blendedCostWithOT, 0.5) * hoursPerDay * workerCount)}/day · <strong style={{ color: "#a78bfa" }}>${formatMoneyK(calcChargeout(blendedCostWithOT, 0.5) * hoursPerDay * workerCount * 5)}/wk</strong></div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {crewWorkers.length === 0 && <div style={{ fontSize: 12, color: "#6b7a9a", marginBottom: 12 }}>No workers assigned to this crew yet.</div>}

                  {crewWorkers.map((w) => {
                    const total = w.total_cost_hourly
                    const isSub = w.employment_type === "subcontractor"
                    const subWithOncosts = isSub && w.sub_super_workcover

                    async function autoCalcOncosts() {
                      const base = w.base_rate_hourly
                      if (!base) { showToast("Enter base rate first"); return }

                      const ot = Number((base * 2).toFixed(2))

                      if (isSub && !subWithOncosts) {
                        await saveWorker({ ...w, ot_rate_hourly: ot, super_hourly: null, annual_leave_hourly: null, personal_leave_hourly: null, long_service_leave_hourly: null, workcover_hourly: null, public_hols_hourly: null })
                        showToast(`Oncosts calculated for ${w.name}`)
                        return
                      }

                      const superHr = Number((base * 0.115).toFixed(2))
                      const annualLeave = Number((base * (4 / 52) * 1.175).toFixed(2))
                      const personalLeave = Number((base * (10 / (52 * 5))).toFixed(2))
                      const lsl = w.employment_type === "casual" ? null : Number((base * (1 / 52)).toFixed(2))
                      const workcover = Number((base * 0.055).toFixed(2))
                      const pubHols = Number((base * (11 / (52 * 5))).toFixed(2))

                      if (isSub && subWithOncosts) {
                        // Sub with deemed employee rules — super + workcover only, no leave
                        await saveWorker({ ...w, ot_rate_hourly: ot, super_hourly: superHr, annual_leave_hourly: null, personal_leave_hourly: null, long_service_leave_hourly: null, workcover_hourly: workcover, public_hols_hourly: null })
                      } else {
                        await saveWorker({ ...w, ot_rate_hourly: ot, super_hourly: superHr, annual_leave_hourly: annualLeave, personal_leave_hourly: personalLeave, long_service_leave_hourly: lsl, workcover_hourly: workcover, public_hols_hourly: pubHols })
                      }
                      showToast(`Oncosts calculated for ${w.name}`)
                    }

                    return (
                      <div key={w.id} style={{ background: "#161d2e", border: `1px solid ${isSub ? "#422006" : "#222"}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        {/* Header row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
                          <div>
                            <FieldLabel>Name</FieldLabel>
                            <input defaultValue={w.name} key={`w-name-${w.id}`} style={fieldStyle} onBlur={async (e) => { await saveWorker({ ...w, name: e.target.value }) }} />
                          </div>
                          <div>
                            <FieldLabel>Role</FieldLabel>
                            <input defaultValue={w.role ?? ""} key={`w-role-${w.id}`} placeholder="e.g. Framing Carpenter" style={fieldStyle} onBlur={async (e) => { await saveWorker({ ...w, role: e.target.value || null }) }} />
                          </div>
                          <div>
                            <FieldLabel>Classification</FieldLabel>
                            <select defaultValue={w.classification ?? ""} key={`w-class-${w.id}`} style={fieldStyle} onChange={async (e) => { await saveWorker({ ...w, classification: e.target.value || null }) }}>
                              <option value="">Select...</option>
                              {CLASSIFICATIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <FieldLabel>Employment type</FieldLabel>
                            <select defaultValue={w.employment_type ?? "full_time"} key={`w-emp-${w.id}`} style={fieldStyle} onChange={async (e) => { await saveWorker({ ...w, employment_type: e.target.value }) }}>
                              <option value="full_time">Full Time</option>
                              <option value="casual">Casual</option>
                              <option value="subcontractor">Subcontractor</option>
                            </select>
                          </div>
                          <button type="button" onClick={autoCalcOncosts} style={{ ...secondaryButtonStyle, fontSize: 11, padding: "6px 10px", marginBottom: 2, color: "#4ade80", borderColor: "#166534" }} title="Auto-calculate oncosts from base rate">Calc</button>
                          <button type="button" onClick={() => deleteWorker(w.id)} style={{ ...dangerButtonStyle, fontSize: 11, padding: "6px 10px", marginBottom: 2 }}>×</button>
                        </div>
                        {/* Login credentials row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, marginBottom: 10, padding: "10px 12px", background: "#0f1520", borderRadius: 8, border: "1px solid #1e2a45" }}>
                          <div>
                            <FieldLabel>Login email</FieldLabel>
                            <input defaultValue={w.email ?? ""} key={`w-email-${w.id}`} type="email" placeholder="worker@email.com"
                              style={fieldStyle} onBlur={async (e) => { await saveWorker({ ...w, email: e.target.value || null }) }} />
                          </div>
                          <div>
                            <FieldLabel>PIN (4 digits)</FieldLabel>
                            <input defaultValue={(w as any).pin ?? ""} key={`w-pin-${w.id}`} type="text" maxLength={4} placeholder="e.g. 1234"
                              style={fieldStyle} onBlur={async (e) => {
                                await supabase.from("workers").update({ pin: e.target.value || null }).eq("id", w.id)
                              }} />
                          </div>
                          <div>
                            <FieldLabel>App role</FieldLabel>
                            <select defaultValue={(w as any).app_role ?? "worker"} key={`w-role-${w.id}`} style={fieldStyle}
                              onChange={async (e) => {
                                await supabase.from("workers").update({ app_role: e.target.value }).eq("id", w.id)
                              }}>
                              <option value="worker">Worker</option>
                              <option value="crew_boss">Crew Boss</option>
                              <option value="boss">Boss</option>
                            </select>
                          </div>
                        </div>

                        {/* Subcontractor super/workcover flag */}
                        {isSub && (
                          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, background: "#1c0a00", border: "1px solid #422006", borderRadius: 8, padding: "8px 12px" }}>
                            <input
                              type="checkbox"
                              id={`sub-oncost-${w.id}`}
                              checked={w.sub_super_workcover ?? false}
                              onChange={async (e) => { await saveWorker({ ...w, sub_super_workcover: e.target.checked }) }}
                              style={{ width: 16, height: 16 }}
                            />
                            <label htmlFor={`sub-oncost-${w.id}`} style={{ fontSize: 12, color: "#fb923c", cursor: "pointer" }}>
                              Deemed employee — super & workcover apply (works &gt;80% for Lawless)
                            </label>
                          </div>
                        )}

                        {/* Cost build-up */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 8, marginBottom: 12 }}>
                          {[
                            { label: "Base rate", key: "base_rate_hourly", val: w.base_rate_hourly, highlight: true },
                            { label: "OT rate", key: "ot_rate_hourly", val: w.ot_rate_hourly },
                            { label: "Super", key: "super_hourly", val: w.super_hourly, dim: isSub && !subWithOncosts },
                            { label: "Ann. leave", key: "annual_leave_hourly", val: w.annual_leave_hourly, dim: isSub },
                            { label: "Pers. leave", key: "personal_leave_hourly", val: w.personal_leave_hourly, dim: isSub },
                            { label: "LSL", key: "long_service_leave_hourly", val: w.long_service_leave_hourly, dim: isSub || w.employment_type === "casual" },
                            { label: "Travel", key: "travel_allowance_hourly", val: w.travel_allowance_hourly },
                            { label: "Workcover", key: "workcover_hourly", val: w.workcover_hourly, dim: isSub && !subWithOncosts },
                            { label: "Pub. hols", key: "public_hols_hourly", val: w.public_hols_hourly, dim: isSub },
                          ].map(({ label, key, val, dim, highlight }) => (
                            <div key={key} style={{ background: highlight ? "#1a2a1a" : "#1a1f2e", borderRadius: 8, padding: "8px 10px", border: highlight ? "1px solid #166534" : "1px solid #252f45", opacity: dim ? 0.3 : 1 }}>
                              <div style={{ fontSize: 11, color: highlight ? "#86efac" : "#6b7a9a", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <span style={{ fontSize: 11, color: "#6b7a9a" }}>$</span>
                                <input
                                  type="number"
                                  defaultValue={val ?? ""}
                                  key={`w-${key}-${w.id}`}
                                  placeholder="0.00"
                                  disabled={dim}
                                  style={{ ...fieldStyle, padding: "4px 6px", fontSize: 15, fontWeight: 700, color: highlight ? "#86efac" : "#e0e8ff", background: "transparent", border: "none", width: "100%", outline: "none" }}
                                  onBlur={async (e) => { await saveWorker({ ...w, [key]: e.target.value ? Number(e.target.value) : null }) }}
                                />
                              </div>
                              <div style={{ fontSize: 10, color: "#4a5680", marginTop: 2 }}>/hr</div>
                            </div>
                          ))}
                        </div>

                        {/* Summary row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 10, background: "#1e2535", borderRadius: 8, padding: "10px 12px" }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginBottom: 2 }}>True cost/hr</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#8899bb" }}>{total != null ? `$${formatMoney(total)}` : "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginBottom: 2 }}>w/ avg OT (3hrs)</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>{w.total_cost_hourly_with_ot != null ? `$${formatMoney(w.total_cost_hourly_with_ot)}` : "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginBottom: 2 }}>30% margin</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>{w.total_cost_hourly_with_ot != null ? `$${formatMoney(calcChargeout(w.total_cost_hourly_with_ot, 0.3))}` : "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginBottom: 2 }}>40% margin</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>{w.total_cost_hourly_with_ot != null ? `$${formatMoney(calcChargeout(w.total_cost_hourly_with_ot, 0.4))}` : "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginBottom: 2 }}>50% margin</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{w.total_cost_hourly_with_ot != null ? `$${formatMoney(calcChargeout(w.total_cost_hourly_with_ot, 0.5))}` : "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginBottom: 2 }}>Standard charge rate</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "#8899bb" }}>$</span>
                              <input
                                type="number"
                                defaultValue={w.standard_charge_rate ?? ""}
                                key={`w-scr-${w.id}`}
                                placeholder="103"
                                style={{ ...fieldStyle, padding: "4px 6px", fontSize: 13, fontWeight: 700, color: "#fbbf24" }}
                                onBlur={async (e) => { await saveWorker({ ...w, standard_charge_rate: e.target.value ? Number(e.target.value) : null }) }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showTimesheetModal && (() => {
        const weekDays = Array.from({ length: 7 }, (_, i) => addCalendarDays(timesheetWeekStart, i))
        const workingDays = weekDays // show all 7 days, weekends rendered differently
        const crewWorkers = workers.filter((w) => w.crew_id === timesheetCrewId).sort((a, b) => a.sort_order - b.sort_order)

        const getEntries = (workerId: string, date: string) =>
          timesheetEntries.filter((e) => e.worker_id === workerId && e.date === date)

        const weekLabel = (() => {
          const start = parseDate(timesheetWeekStart)
          const end = parseDate(addCalendarDays(timesheetWeekStart, 6))
          return `${formatDateLabel(start)} – ${formatDateLabel(end)}`
        })()

        return (
          <div
            onClick={() => setShowTimesheetModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "stretch", justifyContent: "center", zIndex: 120, padding: 16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: "calc(100vw - 32px)", background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 24, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Timesheets</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" onClick={() => { const d = addCalendarDays(timesheetWeekStart, -7); setTimesheetWeekStart(d); loadTimesheetEntries(d, timesheetCrewId) }} style={{ ...secondaryButtonStyle, padding: "6px 12px" }}>◀</button>
                  <span style={{ fontSize: 14, color: "#a1a1aa", minWidth: 160, textAlign: "center" }}>{weekLabel}</span>
                  <button type="button" onClick={() => { const d = addCalendarDays(timesheetWeekStart, 7); setTimesheetWeekStart(d); loadTimesheetEntries(d, timesheetCrewId) }} style={{ ...secondaryButtonStyle, padding: "6px 12px" }}>▶</button>
                  <select
                    value={timesheetCrewId}
                    onChange={(e) => { setTimesheetCrewId(e.target.value); loadTimesheetEntries(timesheetWeekStart, e.target.value) }}
                    style={{ ...fieldStyle, width: "auto", fontSize: 13, padding: "6px 10px" }}
                  >
                    <option value="">Select crew...</option>
                    {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowTimesheetModal(false)} style={secondaryButtonStyle}>Close</button>
                </div>
              </div>

              {!timesheetCrewId && (
                <div style={{ color: "#6b7a9a", fontSize: 14, textAlign: "center", padding: 40 }}>Select a crew to view their timesheet.</div>
              )}

              {timesheetCrewId && timesheetLoading && (
                <div style={{ color: "#6b7a9a", fontSize: 14, textAlign: "center", padding: 40 }}>Loading...</div>
              )}

              {timesheetCrewId && !timesheetLoading && (
                <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "12px 14px", background: "#161d2e", borderBottom: "2px solid #2e3650", minWidth: 160, fontSize: 13, color: "#8899bb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Worker</th>
                        {workingDays.map((d) => {
                            const weekend = isWeekend(parseDate(d))
                            const hasWeekendEntries = weekend && timesheetEntries.some(e => e.date === d && crewWorkers.some(w => w.id === e.worker_id))
                            const narrow = weekend && !hasWeekendEntries
                            return (
                              <th key={d} style={{ textAlign: "center", padding: narrow ? "10px 4px" : "10px 8px", background: weekend ? "#12161f" : "#161d2e", borderBottom: "2px solid #2e3650", minWidth: narrow ? 72 : 190, width: narrow ? 72 : undefined }}>
                                <div style={{ fontSize: narrow ? 10 : 14, fontWeight: 800, color: weekend ? "#6b7a9a" : "#f0f4ff", marginBottom: narrow ? 0 : 8, whiteSpace: narrow ? "nowrap" : undefined }}>
                                  {weekend ? parseDate(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric" }) : formatLongDateLabel(d)}
                                </div>
                                {!weekend && (
                                  <select
                                    defaultValue=""
                                    onChange={async (e) => { if (e.target.value) { await quickFillDay(d, e.target.value); e.target.value = "" } }}
                                    style={{
                                      width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                      background: "linear-gradient(135deg, #1e3a6e, #2563eb)",
                                      border: "2px solid #3b82f6", color: "#bfdbfe", cursor: "pointer",
                                      boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
                                    }}
                                  >
                                    <option value="">⚡ Quick fill whole crew...</option>
                                    {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                )}
                                {weekend && hasWeekendEntries && (
                                  <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 4 }}>WEEKEND</div>
                                )}
                              </th>
                            )
                          })}
                        <th style={{ textAlign: "center", padding: "12px 8px", background: "#161d2e", borderBottom: "2px solid #2e3650", minWidth: 110, fontSize: 13, color: "#8899bb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Week total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crewWorkers.map((w) => {
                        const getEntries = (workerId: string, date: string) =>
                          timesheetEntries.filter((e) => e.worker_id === workerId && e.date === date)

                        const weekOrdinary = workingDays.reduce((sum, d) => sum + getEntries(w.id, d).reduce((s, e) => s + (e.ordinary_hours ?? 0), 0), 0)
                        const weekOT = workingDays.reduce((sum, d) => sum + getEntries(w.id, d).reduce((s, e) => s + (e.ot_hours ?? 0), 0), 0)
                        const weekCost = workingDays.reduce((sum, d) => {
                          return sum + getEntries(w.id, d).reduce((s, e) => {
                            const trueCost = w.total_cost_hourly_with_ot ?? w.base_rate_hourly ?? 0
                            return s + (e.ordinary_hours ?? 0) * trueCost + (e.ot_hours ?? 0) * (w.ot_rate_hourly ?? 0)
                          }, 0)
                        }, 0)

                        return (
                          <tr key={w.id} style={{ borderBottom: "1px solid #252f45" }}>
                            {/* Worker name cell */}
                            <td style={{ padding: "14px", verticalAlign: "middle", background: "#161d2e" }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: "#f0f4ff" }}>{w.name}</div>
                              <div style={{ fontSize: 12, color: "#6b7a9a", marginTop: 2 }}>{w.role}</div>
                            </td>
                            {workingDays.map((d) => {
                              const entries = getEntries(w.id, d)
                              const hasEntries = entries.length > 0
                              return (
                                <td key={d} style={{ padding: "8px", verticalAlign: "top", background: isWeekend(parseDate(d)) ? (hasEntries ? "#1a1a10" : "#0d1018") : (hasEntries ? "#141c2a" : "#0f1520"), borderLeft: "1px solid #252f45", minWidth: isWeekend(parseDate(d)) && !hasEntries ? 80 : 190, width: isWeekend(parseDate(d)) && !hasEntries ? 80 : undefined }}>
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {entries.map((entry, ei) => (
                                      <div key={entry.id} style={{ background: "#1e2535", borderRadius: 8, padding: "8px 10px", border: "1px solid #2e3a58", display: "grid", gap: 6 }}>
                                        {/* Site selector */}
                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                          <select
                                            value={entry.project_id ?? ""}
                                            onChange={async (e) => {
                                              await supabase.from("timesheets").update({ project_id: e.target.value || null }).eq("id", entry.id)
                                              await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
                                            }}
                                            style={{ ...fieldStyle, fontSize: 13, padding: "6px 8px", flex: 1, fontWeight: 600 }}
                                          >
                                            <option value="">No site</option>
                                            {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                          </select>
                                          <button type="button" onClick={async () => { await deleteTimesheetEntry(entry.id) }}
                                            style={{ background: "#2a1a1a", border: "1px solid #5a2020", borderRadius: 6, color: "#f87171", cursor: "pointer", fontSize: 14, padding: "4px 8px", lineHeight: 1, flexShrink: 0 }}
                                            title="Remove">×</button>
                                        </div>
                                        {/* Hours inputs */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                          <div>
                                            <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 3, fontWeight: 600 }}>Ord hrs</div>
                                            <input type="number" step="0.5" defaultValue={entry.ordinary_hours} key={`ord-${entry.id}`}
                                              style={{ ...fieldStyle, fontSize: 16, fontWeight: 700, padding: "8px 10px", textAlign: "center" }}
                                              onBlur={async (e) => {
                                                await supabase.from("timesheets").update({ ordinary_hours: Number(e.target.value) }).eq("id", entry.id)
                                                await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
                                              }} />
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 3, fontWeight: 600 }}>OT hrs</div>
                                            <input type="number" step="0.5" defaultValue={entry.ot_hours} key={`ot-${entry.id}`}
                                              style={{ ...fieldStyle, fontSize: 16, fontWeight: 700, padding: "8px 10px", textAlign: "center", borderColor: entry.ot_hours > 0 ? "#f59e0b" : undefined, color: entry.ot_hours > 0 ? "#fbbf24" : undefined }}
                                              onBlur={async (e) => {
                                                await supabase.from("timesheets").update({ ot_hours: Number(e.target.value) }).eq("id", entry.id)
                                                await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
                                              }} />
                                          </div>
                                        </div>
                                        <input type="text" defaultValue={entry.notes ?? ""} key={`note-${entry.id}`} placeholder="Notes..."
                                          style={{ ...fieldStyle, fontSize: 12, padding: "6px 8px" }}
                                          onBlur={async (e) => {
                                            await supabase.from("timesheets").update({ notes: e.target.value || null }).eq("id", entry.id)
                                            await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
                                          }} />
                                      </div>
                                    ))}
                                    {entries.length === 0 && (
                                      <select value="" onChange={async (e) => {
                                        if (!e.target.value) return
                                        await supabase.from("timesheets").insert({ date: d, worker_id: w.id, project_id: e.target.value, ordinary_hours: 9, ot_hours: 0 })
                                        await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
                                      }}
                                        style={{ ...fieldStyle, fontSize: 13, padding: "10px 12px", color: "#6b7a9a", borderStyle: "dashed" }}>
                                        <option value="">+ Add site...</option>
                                        {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>
                                    )}
                                    {entries.length > 0 && (
                                      <button type="button" onClick={async () => {
                                        await supabase.from("timesheets").insert({ date: d, worker_id: w.id, project_id: null, ordinary_hours: 0, ot_hours: 0 })
                                        await loadTimesheetEntries(timesheetWeekStart, timesheetCrewId)
                                      }}
                                        style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "1px dashed #1d4ed8", borderRadius: 6, cursor: "pointer", padding: "6px 8px", width: "100%", fontWeight: 600 }}>
                                        + Split day
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                            {/* Week total */}
                            <td style={{ padding: "14px 12px", verticalAlign: "middle", textAlign: "center", background: "#161d2e", borderLeft: "2px solid #2e3650" }}>
                              <div style={{ fontWeight: 900, fontSize: 20, color: "#f0f4ff" }}>{weekOrdinary + weekOT}<span style={{ fontSize: 13, fontWeight: 500, color: "#8899bb" }}>hrs</span></div>
                              <div style={{ fontSize: 12, color: "#6b7a9a", marginTop: 3 }}>{weekOrdinary} + <span style={{ color: "#fbbf24" }}>{weekOT} OT</span></div>
                              {weekCost > 0 && <div style={{ fontSize: 13, color: "#00dd44", marginTop: 6, fontWeight: 700 }}>${formatMoney(weekCost)}</div>}
                            </td>
                          </tr>
                        )
                      })}

                      {/* Totals row */}
                      <tr style={{ borderTop: "3px solid #2e3650", background: "#161d2e" }}>
                        <td style={{ padding: "14px", fontWeight: 800, fontSize: 15, color: "#f0f4ff" }}>Totals</td>
                        {workingDays.map((d) => {
                          const dayEntries = timesheetEntries.filter((e) => e.date === d && crewWorkers.some((w) => w.id === e.worker_id))
                          const dayOrd = dayEntries.reduce((sum, e) => sum + (e.ordinary_hours ?? 0), 0)
                          const dayOT = dayEntries.reduce((sum, e) => sum + (e.ot_hours ?? 0), 0)
                          return (
                            <td key={d} style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #252f45" }}>
                              <div style={{ fontWeight: 800, fontSize: 18, color: "#f0f4ff" }}>{dayOrd + dayOT}<span style={{ fontSize: 12, color: "#8899bb" }}>hrs</span></div>
                              <div style={{ fontSize: 12, color: "#6b7a9a", marginTop: 2 }}>{dayOrd} + <span style={{ color: "#fbbf24" }}>{dayOT} OT</span></div>
                            </td>
                          )
                        })}
                        <td style={{ padding: "14px 12px", textAlign: "center", borderLeft: "2px solid #2e3650" }}>
                          <div style={{ fontWeight: 900, fontSize: 20, color: "#f0f4ff" }}>
                            {crewWorkers.reduce((sum, w) => sum + timesheetEntries.filter((e) => e.worker_id === w.id).reduce((s, e) => s + (e.ordinary_hours ?? 0) + (e.ot_hours ?? 0), 0), 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#8899bb" }}>hrs</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#00dd44", marginTop: 4, fontWeight: 700 }}>
                            ${formatMoney(crewWorkers.reduce((sum, w) => sum + timesheetEntries.filter((e) => e.worker_id === w.id).reduce((s, e) => {
                              const trueCost = w.total_cost_hourly_with_ot ?? w.base_rate_hourly ?? 0
                              return s + (e.ordinary_hours ?? 0) * trueCost + (e.ot_hours ?? 0) * (w.ot_rate_hourly ?? 0)
                            }, 0), 0))}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Per-project cost summary */}
                  {(() => {
                    const projectIds = [...new Set(timesheetEntries.filter((e) => e.project_id).map((e) => e.project_id!))]
                    if (projectIds.length === 0) return null

                    const projectSummaries = projectIds.map((pid) => {
                      const projectEntries = timesheetEntries.filter((e) => e.project_id === pid)
                      const project = projects.find((p) => p.id === pid)
                      const totalOrd = projectEntries.reduce((sum, e) => sum + (e.ordinary_hours ?? 0), 0)
                      const totalOT = projectEntries.reduce((sum, e) => sum + (e.ot_hours ?? 0), 0)
                      const totalCost = projectEntries.reduce((sum, e) => {
                        const worker = crewWorkers.find((w) => w.id === e.worker_id)
                        if (!worker) return sum
                        const trueCost = worker.total_cost_hourly_with_ot ?? worker.base_rate_hourly ?? 0
                        return sum + (e.ordinary_hours ?? 0) * trueCost + (e.ot_hours ?? 0) * (worker.ot_rate_hourly ?? 0)
                      }, 0)
                      const totalCostWithOncosts = projectEntries.reduce((sum, e) => {
                        const worker = crewWorkers.find((w) => w.id === e.worker_id)
                        if (!worker) return sum
                        const hrCost = worker.total_cost_hourly_with_ot ?? worker.base_rate_hourly ?? 0
                        return sum + (e.ordinary_hours ?? 0) * hrCost + (e.ot_hours ?? 0) * (worker.ot_rate_hourly ?? 0)
                      }, 0)
                      return { project, totalOrd, totalOT, totalCost, totalCostWithOncosts }
                    })

                    return (
                      <div style={{ marginTop: 20, borderTop: "2px solid #2e3650", paddingTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#e4e4e7" }}>Labour cost by project this week</div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {projectSummaries.map(({ project, totalOrd, totalOT, totalCost, totalCostWithOncosts }) => (
                            <div key={project?.id} style={{ background: "#161d2e", border: "1px solid #252f45", borderRadius: 8, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 16, alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{project?.name ?? "Unknown project"}</div>
                                <div style={{ fontSize: 11, color: "#8899bb" }}>{project?.client ?? ""}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 2 }}>Hours</div>
                                <div style={{ fontWeight: 600 }}>{totalOrd + totalOT}hrs</div>
                                <div style={{ fontSize: 11, color: "#8899bb" }}>{totalOrd} ord + {totalOT} OT</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 2 }}>Base wages</div>
                                <div style={{ fontWeight: 600, color: "#e4e4e7" }}>${formatMoney(totalCost)}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 2 }}>True cost (w/ oncosts)</div>
                                <div style={{ fontWeight: 700, color: "#f87171", fontSize: 15 }}>${formatMoney(totalCostWithOncosts)}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 2 }}>At 30% margin</div>
                                <div style={{ fontWeight: 700, color: "#60a5fa", fontSize: 15 }}>${formatMoney(totalCostWithOncosts / 0.7)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {showProfitabilityModal && (() => {
        const selectedRows = profitabilityData.filter((r) => selectedProfitProjects.has(r.project_id))
        const totalContractValue = selectedRows.reduce((s, r) => s + r.total_contract_value, 0)
        const totalLabourCost = selectedRows.reduce((s, r) => s + r.total_labour_true_cost, 0)
        const totalMaterialsCost = selectedRows.reduce((s, r) => s + (r.total_materials_cost ?? 0), 0)
        const totalAllCosts = totalLabourCost + totalMaterialsCost
        const totalHours = selectedRows.reduce((s, r) => s + r.total_ordinary_hours + r.total_ot_hours, 0)
        const allSelected = profitabilityData.every((r) => selectedProfitProjects.has(r.project_id))
        const noneSelected = selectedProfitProjects.size === 0

        return (
          <div
            onClick={() => setShowProfitabilityModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 120, padding: 20, overflowY: "auto" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 1100, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", marginBottom: 20 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Project Profitability</div>
                  <div style={{ fontSize: 12, color: "#6b7a9a", marginTop: 4 }}>
                    {selectedProfitProjects.size} of {profitabilityData.length} projects included in summary
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={async () => {
                    setSelectedProfitProjects(new Set(profitabilityData.map((r) => r.project_id)))
                    await Promise.all(profitabilityData.map((r) => supabase.from("projects").update({ profitability_included: true }).eq("id", r.project_id)))
                  }} style={{ ...secondaryButtonStyle, fontSize: 11, padding: "6px 10px" }}>Select all</button>
                  <button type="button" onClick={async () => {
                    setSelectedProfitProjects(new Set())
                    await Promise.all(profitabilityData.map((r) => supabase.from("projects").update({ profitability_included: false }).eq("id", r.project_id)))
                  }} style={{ ...secondaryButtonStyle, fontSize: 11, padding: "6px 10px" }}>Clear all</button>
                  <button type="button" onClick={loadProfitability} style={secondaryButtonStyle}>Refresh</button>
                  <button type="button" onClick={() => setShowProfitabilityModal(false)} style={secondaryButtonStyle}>Close</button>
                </div>
              </div>

              {/* Company summary bar — only selected projects */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24, marginTop: 16 }}>
                {[
                  { label: "Total contract value", value: `$${formatMoney(totalContractValue)}`, sub: `$${formatMoney(totalContractValue / 1.1)} ex. GST`, color: "#e4e4e7" },
                  { label: "Labour cost (true)", value: `$${formatMoney(totalLabourCost)}`, sub: `${totalHours.toFixed(1)} hrs logged`, color: "#f87171" },
                  { label: "Materials & other costs", value: `$${formatMoney(totalMaterialsCost)}`, sub: "subcon · equip · prelims", color: "#fbbf24" },
                  { label: "Gross profit", value: `$${formatMoney(totalContractValue - totalAllCosts)}`, sub: totalContractValue > 0 ? `${(((totalContractValue - totalAllCosts) / totalContractValue) * 100).toFixed(1)}% margin` : "—", color: totalContractValue > totalAllCosts ? "#4ade80" : "#f87171" },
                  { label: "Total costs % of contract", value: totalContractValue > 0 ? `${((totalAllCosts / totalContractValue) * 100).toFixed(1)}%` : "—", sub: "labour + materials", color: totalContractValue > 0 && totalAllCosts / totalContractValue < 0.7 ? "#4ade80" : "#f87171" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#141a28", border: "1px solid #252f45", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 6 }}>{stat.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginTop: 4 }}>{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Per-project table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2e3650" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#8899bb", fontWeight: 600, fontSize: 11, width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProfitProjects(new Set(profitabilityData.map((r) => r.project_id)))
                          else setSelectedProfitProjects(new Set())
                        }}
                        style={{ width: 14, height: 14 }}
                      />
                    </th>
                    {["Project", "Client", "Contract value", "Labour cost", "Materials", "Gross profit", "Margin %", "Hours", "Cost/hr"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Project" || h === "Client" ? "left" : "right", padding: "8px 12px", color: "#8899bb", fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitabilityData
                    .sort((a, b) => b.total_contract_value - a.total_contract_value)
                    .map((row) => {
                      const included = selectedProfitProjects.has(row.project_id)
                      const grossProfit = row.total_contract_value - row.total_labour_true_cost - (row.total_materials_cost ?? 0)
                      const totalAllCostsRow = row.total_labour_true_cost + (row.total_materials_cost ?? 0)
                      const margin = row.total_contract_value > 0 ? (grossProfit / row.total_contract_value) * 100 : null
                      const totalHrs = row.total_ordinary_hours + row.total_ot_hours
                      const costPerHr = totalHrs > 0 ? row.total_labour_true_cost / totalHrs : null
                      const hasLabour = row.total_labour_true_cost > 0
                      const hasMaterials = (row.total_materials_cost ?? 0) > 0
                      const hasContract = row.total_contract_value > 0
                      const marginColor = margin == null ? "#71717a" : margin >= 30 ? "#4ade80" : margin >= 0 ? "#fbbf24" : "#f87171"

                      return (
                        <tr key={row.project_id} style={{ borderBottom: "1px solid #1a1a1a", opacity: included ? 1 : 0.35 }}>
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={async (e) => {
                                const checked = e.target.checked
                                setSelectedProfitProjects((prev) => {
                                  const next = new Set(prev)
                                  checked ? next.add(row.project_id) : next.delete(row.project_id)
                                  return next
                                })
                                await supabase.from("projects").update({ profitability_included: checked }).eq("id", row.project_id)
                              }}
                              style={{ width: 14, height: 14 }}
                            />
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.project_name}</td>
                          <td style={{ padding: "10px 12px", color: "#8899bb" }}>{row.client ?? "—"}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {hasContract ? (
                              <>
                                <div style={{ fontWeight: 600 }}>${formatMoney(row.total_contract_value)}</div>
                                <div style={{ fontSize: 11, color: "#6b7a9a" }}>${formatMoney(row.total_contract_value / 1.1)} ex. GST</div>
                              </>
                            ) : <span style={{ color: "#6b7a9a" }}>No contract</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {hasLabour ? (
                              <>
                                <div style={{ fontWeight: 600, color: "#f87171" }}>${formatMoney(row.total_labour_true_cost)}</div>
                                <div style={{ fontSize: 11, color: "#6b7a9a" }}>{totalHrs.toFixed(1)}hrs</div>
                              </>
                            ) : <span style={{ color: "#6b7a9a" }}>No timesheets</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {hasMaterials ? (
                              <>
                                <div style={{ fontWeight: 600, color: "#fbbf24" }}>${formatMoney(row.total_materials_cost ?? 0)}</div>
                                <div style={{ fontSize: 11, color: "#6b7a9a" }}>
                                  {(row.total_materials_only ?? 0) > 0 && `mat $${formatMoneyK(row.total_materials_only ?? 0)}`}
                                  {(row.total_subcontractor_cost ?? 0) > 0 && ` sub $${formatMoneyK(row.total_subcontractor_cost ?? 0)}`}
                                </div>
                              </>
                            ) : <span style={{ color: "#6b7a9a" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {hasContract && hasLabour ? (
                              <div style={{ fontWeight: 700, color: grossProfit >= 0 ? "#4ade80" : "#f87171" }}>${formatMoney(grossProfit)}</div>
                            ) : <span style={{ color: "#6b7a9a" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {margin != null ? (
                              <div style={{ fontWeight: 700, color: marginColor, fontSize: 15 }}>{margin.toFixed(1)}%</div>
                            ) : <span style={{ color: "#6b7a9a" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {hasLabour ? (
                              <>
                                <div style={{ fontWeight: 600 }}>{totalHrs.toFixed(1)}hrs</div>
                                <div style={{ fontSize: 11, color: "#6b7a9a" }}>{row.total_ordinary_hours}ord + {row.total_ot_hours}OT</div>
                              </>
                            ) : <span style={{ color: "#6b7a9a" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {costPerHr != null ? (
                              <div style={{ fontWeight: 600, color: "#a78bfa" }}>${formatMoney(costPerHr)}</div>
                            ) : <span style={{ color: "#6b7a9a" }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>

              <div style={{ marginTop: 16, fontSize: 12, color: "#6b7a9a" }}>
                Labour cost uses true cost (inc. super, leave, workcover, avg OT). Materials includes subcontractors, equipment hire and prelims. Margin = (contract − labour − materials) ÷ contract.
              </div>
            </div>
          </div>
        )
      })()}

      {showClientsModal && (
        <div
          onClick={() => setShowClientsModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 120, padding: 20, overflowY: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 860, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", marginBottom: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Clients</div>
                <div style={{ fontSize: 12, color: "#6b7a9a", marginTop: 4 }}>{clients.length} clients · contact details for bot communication</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={addClient} style={{ ...secondaryButtonStyle, color: "#4ade80", borderColor: "#166534" }}>+ Add client</button>
                <button type="button" onClick={() => setShowClientsModal(false)} style={secondaryButtonStyle}>Close</button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {clients.map((c) => {
                const clientProjects = projects.filter((p) => p.client_id === c.id || p.client === c.name)
                return (
                  <div key={c.id} style={{ background: "#161d2e", border: "1px solid #252f45", borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
                      <div>
                        <FieldLabel>Name</FieldLabel>
                        <input
                          defaultValue={c.name}
                          key={`cn-${c.id}`}
                          style={fieldStyle}
                          onBlur={async (e) => { await saveClient({ ...c, name: e.target.value }) }}
                        />
                      </div>
                      <div>
                        <FieldLabel>Company / Builder</FieldLabel>
                        <input
                          defaultValue={c.company ?? ""}
                          key={`cc-${c.id}`}
                          placeholder="e.g. Backman Builders"
                          style={fieldStyle}
                          onBlur={async (e) => { await saveClient({ ...c, company: e.target.value || null }) }}
                        />
                      </div>
                      <div>
                        <FieldLabel>Email</FieldLabel>
                        <input
                          defaultValue={c.email ?? ""}
                          key={`ce-${c.id}`}
                          placeholder="email@example.com"
                          type="email"
                          style={fieldStyle}
                          onBlur={async (e) => { await saveClient({ ...c, email: e.target.value || null }) }}
                        />
                      </div>
                      <div>
                        <FieldLabel>Phone</FieldLabel>
                        <input
                          defaultValue={c.phone ?? ""}
                          key={`cp-${c.id}`}
                          placeholder="04XX XXX XXX"
                          style={fieldStyle}
                          onBlur={async (e) => { await saveClient({ ...c, phone: e.target.value || null }) }}
                        />
                      </div>
                      <button type="button" onClick={() => deleteClient(c.id)} style={{ ...dangerButtonStyle, fontSize: 11, padding: "6px 10px", marginBottom: 2 }}>×</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <FieldLabel>Notes</FieldLabel>
                        <input
                          defaultValue={c.notes ?? ""}
                          key={`cnotes-${c.id}`}
                          placeholder="Any notes for the bot..."
                          style={fieldStyle}
                          onBlur={async (e) => { await saveClient({ ...c, notes: e.target.value || null }) }}
                        />
                      </div>
                      <div>
                        <FieldLabel>Projects</FieldLabel>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                          {clientProjects.length === 0 && <span style={{ fontSize: 12, color: "#6b7a9a" }}>No projects linked</span>}
                          {clientProjects.map((p) => (
                            <span key={p.id} style={{ fontSize: 11, background: "#1e2535", border: "1px solid #2e3650", borderRadius: 6, padding: "2px 8px", color: "#a1a1aa" }}>
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Contact actions for bot */}
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          style={{ fontSize: 11, color: "#60a5fa", background: "#0c1a2e", border: "1px solid #1d4ed8", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}
                        >
                          Email {c.name.split(" ")[0]}
                        </a>
                      )}
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          style={{ fontSize: 11, color: "#4ade80", background: "#0a1f0f", border: "1px solid #166534", borderRadius: 6, padding: "4px 10px", textDecoration: "none" }}
                        >
                          Call {c.name.split(" ")[0]}
                        </a>
                      )}
                      {!c.email && !c.phone && (
                        <span style={{ fontSize: 11, color: "#6b7a9a" }}>Add email or phone to enable bot communication</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showCashflowModal && (() => {
        const today = todayKey ?? new Date().toISOString().slice(0, 10)
        const HOURS_PER_DAY = 9

        // --- Build period buckets ---
        const allDates = [
          ...milestones.map(m => m.due_date_override ?? segments.find(s => s.id === m.segment_id)?.end_date).filter((d): d is string => !!d),
          ...segments.map(s => s.end_date),
          today,
        ].sort()
        const rangeStart = allDates[0] ?? today
        const rangeEnd = allDates[allDates.length - 1] ?? today

        // Generate period keys
        function getPeriodKey(dateStr: string, view: "weekly" | "monthly") {
          const d = parseDate(dateStr)
          if (view === "monthly") {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          } else {
            // ISO week: get Monday of that week
            const day = d.getDay()
            const diff = d.getDate() - day + (day === 0 ? -6 : 1)
            const mon = new Date(d)
            mon.setDate(diff)
            return formatDateKey(mon)
          }
        }

        function periodLabel(key: string, view: "weekly" | "monthly") {
          if (view === "monthly") {
            const [y, m] = key.split("-")
            return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en-AU", { month: "short", year: "2-digit" })
          } else {
            const d = parseDate(key)
            return `${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })}`
          }
        }

        // Collect all period keys in range
        const periodKeys: string[] = []
        const cursor = parseDate(rangeStart)
        const end = parseDate(rangeEnd)
        const step = cashflowView === "monthly" ? "month" : "week"
        while (cursor <= end) {
          const key = getPeriodKey(formatDateKey(cursor), cashflowView)
          if (!periodKeys.includes(key)) periodKeys.push(key)
          if (step === "month") cursor.setMonth(cursor.getMonth() + 1)
          else cursor.setDate(cursor.getDate() + 7)
        }

        // --- Money IN: milestones with dates ---
        const moneyIn: Record<string, number> = {}
        const outstanding: { name: string; project: string; amount: number; dueDate: string }[] = []

        for (const m of milestones) {
          if (!m.amount) continue
          const dueDate = m.due_date_override ?? segments.find(s => s.id === m.segment_id)?.end_date
          if (!dueDate) continue
          const key = getPeriodKey(dueDate, cashflowView)
          moneyIn[key] = (moneyIn[key] ?? 0) + m.amount
          // Outstanding = past due
          if (dueDate < today) {
            const proj = projects.find(p => p.id === m.project_id)
            outstanding.push({ name: m.name ?? "Milestone", project: proj?.name ?? "", amount: m.amount, dueDate })
          }
        }

        // --- Money OUT (actual): timesheets ---
        const moneyOutActual: Record<string, number> = {}
        for (const entry of segments) {
          // use timesheet data already loaded
        }
        // Group timesheet entries by period
        const allTimesheetEntries = timesheetEntries // loaded for current crew — we need all
        // We'll use a separate query approach — approximate from loaded data
        // For now sum from loaded timesheetEntries
        for (const entry of timesheetEntries) {
          const worker = workers.find(w => w.id === entry.worker_id)
          if (!worker) continue
          const trueCostPerHour = worker.total_cost_hourly_with_ot ?? worker.base_rate_hourly ?? 0
          const cost = (entry.ordinary_hours ?? 0) * trueCostPerHour +
                       (entry.ot_hours ?? 0) * (worker.ot_rate_hourly ?? 0)
          const key = getPeriodKey(entry.date, cashflowView)
          moneyOutActual[key] = (moneyOutActual[key] ?? 0) + cost
        }

        // --- Money OUT (forecast): future segments × crew blended cost ---
        const moneyOutForecast: Record<string, number> = {}
        for (const seg of segments) {
          if (seg.end_date <= today) continue // already past
          const crew = crews.find(c => c.id === seg.crew_id)
          if (!crew) continue
          const crewWorkerList = workers.filter(w => w.crew_id === crew.id && w.total_cost_hourly_with_ot != null)
          if (crewWorkerList.length === 0) continue
          const blended = crewWorkerList.reduce((s, w) => s + (w.total_cost_hourly_with_ot ?? 0), 0) / crewWorkerList.length
          const startKey = seg.start_date > today ? seg.start_date : today
          const workingDays = countWorkingDaysInclusive(startKey, seg.end_date)
          const totalCost = blended * HOURS_PER_DAY * crewWorkerList.length * workingDays * (seg.capacity_fraction ?? 1)
          // Spread evenly across periods the segment covers
          const segPeriods: string[] = []
          const sc = parseDate(startKey)
          const se = parseDate(seg.end_date)
          const tc = new Date(sc)
          while (tc <= se) {
            const k = getPeriodKey(formatDateKey(tc), cashflowView)
            if (!segPeriods.includes(k)) segPeriods.push(k)
            tc.setDate(tc.getDate() + 7)
          }
          const perPeriod = totalCost / Math.max(segPeriods.length, 1)
          for (const k of segPeriods) {
            moneyOutForecast[k] = (moneyOutForecast[k] ?? 0) + perPeriod
          }
        }

        // --- Money OUT (materials/costs): by effective date ---
        const moneyOutMaterials: Record<string, number> = {}
        for (const c of projectCosts) {
          if (!c.effective_date) continue
          const key = getPeriodKey(c.effective_date, cashflowView)
          moneyOutMaterials[key] = (moneyOutMaterials[key] ?? 0) + c.amount
        }

        // --- Build chart data ---
        const chartData = periodKeys.map(key => ({
          key,
          label: periodLabel(key, cashflowView),
          in: moneyIn[key] ?? 0,
          outActual: (moneyOutActual[key] ?? 0) + (moneyOutMaterials[key] ?? 0),
          outForecast: moneyOutForecast[key] ?? 0,
        }))

        // Running balance
        let balance = 0
        const withBalance = chartData.map(d => {
          balance += d.in - d.outActual - d.outForecast
          return { ...d, balance }
        })

        const totalIn = chartData.reduce((s, d) => s + d.in, 0)
        const totalOutActual = chartData.reduce((s, d) => s + d.outActual, 0)
        const totalOutForecast = chartData.reduce((s, d) => s + d.outForecast, 0)
        const maxBar = Math.max(...chartData.map(d => Math.max(d.in, d.outActual + d.outForecast, 1)))
        const minBalance = Math.min(...withBalance.map(d => d.balance), 0)
        const maxBalance = Math.max(...withBalance.map(d => d.balance), 0)
        const balanceRange = maxBalance - minBalance || 1

        const CHART_H = 200
        const BAR_W = Math.max(Math.min(Math.floor(560 / Math.max(periodKeys.length, 1)) - 6, 60), 8)
        const COL_W = BAR_W + 8

        const totalMaterialsOut = Object.values(moneyOutMaterials).reduce((s, v) => s + v, 0)
        const totalLabourOut = chartData.reduce((s, d) => s + d.outActual, 0) - totalMaterialsOut

        return (
          <div
            onClick={() => setShowCashflowModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 120, padding: 20, overflowY: "auto" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 1100, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", marginBottom: 20 }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Cashflow Timeline</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" onClick={() => setCashflowView("weekly")} style={{ ...secondaryButtonStyle, opacity: cashflowView === "weekly" ? 1 : 0.5 }}>Weekly</button>
                  <button type="button" onClick={() => setCashflowView("monthly")} style={{ ...secondaryButtonStyle, opacity: cashflowView === "monthly" ? 1 : 0.5 }}>Monthly</button>
                  <button type="button" onClick={() => setShowCashflowModal(false)} style={secondaryButtonStyle}>Close</button>
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total milestones due", value: `$${formatMoney(totalIn)}`, color: "#4ade80", sub: `${milestones.filter(m => m.amount).length} payments` },
                  { label: "Labour cost (actual)", value: `$${formatMoney(totalLabourOut)}`, color: "#f87171", sub: "from timesheets" },
                  { label: "Materials & costs", value: `$${formatMoney(totalMaterialsOut)}`, color: "#fbbf24", sub: `${projectCosts.filter(c => c.effective_date).length} payments scheduled` },
                  { label: "Forecast labour", value: `$${formatMoney(totalOutForecast)}`, color: "#fb923c", sub: "from schedule" },
                  { label: "Net position", value: `$${formatMoney(totalIn - totalLabourOut - totalMaterialsOut - totalOutForecast)}`, color: totalIn - totalLabourOut - totalMaterialsOut - totalOutForecast >= 0 ? "#4ade80" : "#f87171", sub: "in minus all out" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#141a28", border: "1px solid #252f45", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginTop: 4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
                {[
                  { color: "#00dd44", label: "Money in (milestones)" },
                  { color: "#ff1a1a", label: "Actual labour cost" },
                  { color: "#ffcc00", label: "Forecast labour cost" },
                  { color: "#00aaff", label: "Running balance" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
                    <span style={{ color: "#a1a1aa" }}>{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <svg width={Math.max(periodKeys.length * COL_W + 60, 600)} height={CHART_H + 80}>
                  {/* Y axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map(t => {
                    const y = CHART_H - t * CHART_H
                    const val = t * maxBar
                    return (
                      <g key={t}>
                        <line x1={40} y1={y + 10} x2={periodKeys.length * COL_W + 50} y2={y + 10} stroke="#1f1f1f" strokeWidth="1" />
                        <text x={36} y={y + 14} textAnchor="end" fill="#52525b" fontSize="10">${Math.round(val / 1000)}k</text>
                      </g>
                    )
                  })}

                  {/* Bars and balance line */}
                  {withBalance.map((d, i) => {
                    const x = 44 + i * COL_W
                    const inH = maxBar > 0 ? (d.in / maxBar) * CHART_H : 0
                    const outActH = maxBar > 0 ? (d.outActual / maxBar) * CHART_H : 0
                    const outForeH = maxBar > 0 ? (d.outForecast / maxBar) * CHART_H : 0
                    const balY = CHART_H + 10 - ((d.balance - minBalance) / balanceRange) * (CHART_H * 0.6) - CHART_H * 0.15

                    return (
                      <g key={d.key}>
                        {/* Money in bar */}
                        <rect x={x} y={CHART_H + 10 - inH} width={BAR_W * 0.45} height={Math.max(inH, 1)} fill="#00dd44" fillOpacity="1" rx="2" />
                        {/* Actual out bar */}
                        <rect x={x + BAR_W * 0.5} y={CHART_H + 10 - outActH} width={BAR_W * 0.22} height={Math.max(outActH, 1)} fill="#ff1a1a" fillOpacity="1" rx="2" />
                        {/* Forecast out bar (stacked on actual) */}
                        <rect x={x + BAR_W * 0.5} y={CHART_H + 10 - outActH - outForeH} width={BAR_W * 0.22} height={Math.max(outForeH, 1)} fill="#ffcc00" fillOpacity="1" rx="2" />
                        {/* Balance dot */}
                        <circle cx={x + BAR_W * 0.5} cy={balY} r="3" fill="#00aaff" />
                        {/* Connect balance line */}
                        {i > 0 && (() => {
                          const prev = withBalance[i - 1]
                          const prevBalY = CHART_H + 10 - ((prev.balance - minBalance) / balanceRange) * (CHART_H * 0.6) - CHART_H * 0.15
                          const prevX = 44 + (i - 1) * COL_W + BAR_W * 0.5
                          return <line x1={prevX} y1={prevBalY} x2={x + BAR_W * 0.5} y2={balY} stroke="#00aaff" strokeWidth="2" />
                        })()}
                        {/* X axis label */}
                        <text x={x + BAR_W * 0.5} y={CHART_H + 26} textAnchor="middle" fill="#52525b" fontSize="10">{d.label}</text>
                      </g>
                    )
                  })}
                  {/* Zero line */}
                  <line x1={40} y1={CHART_H + 10} x2={periodKeys.length * COL_W + 50} y2={CHART_H + 10} stroke="#333" strokeWidth="1" />
                </svg>
              </div>

              {/* Outstanding invoices */}
              {outstanding.length > 0 && (
                <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#f87171", marginBottom: 10 }}>
                    Outstanding payments ({outstanding.length}) — past due date
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {outstanding.map((o, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#161d2e", borderRadius: 6, padding: "8px 12px" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{o.name}</span>
                          <span style={{ color: "#8899bb", fontSize: 12, marginLeft: 8 }}>{o.project}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#f87171" }}>${formatMoney(o.amount)}</div>
                          <div style={{ fontSize: 11, color: "#6b7a9a" }}>due {formatDateLabel(parseDate(o.dueDate))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, fontSize: 12, color: "#6b7a9a" }}>
                Money in = milestone amounts by due date. Actual out = true labour cost from timesheets (inc. super, leave, workcover, avg OT) + scheduled material payments. Forecast out = future segments × crew blended rate (true cost).
              </div>
            </div>
          </div>
        )
      })()}

      {costsModal?.open && (() => {
        const costs = projectCosts.filter(c => c.project_id === costsModal.projectId)
        const projectSegs = segments.filter(s => s.project_id === costsModal.projectId)

        // Group by cost_group, ungrouped costs get their own entry
        const groups: { groupName: string | null; items: ProjectCost[] }[] = []
        const seen = new Set<string>()
        for (const c of costs) {
          const key = c.cost_group ?? c.id
          if (!seen.has(key)) {
            seen.add(key)
            groups.push({
              groupName: c.cost_group ?? null,
              items: c.cost_group ? costs.filter(x => x.cost_group === c.cost_group) : [c]
            })
          }
        }

        const grandTotal = costs.reduce((s, c) => s + c.amount, 0)
        const totalByCat = COST_CATEGORIES.map(cat => ({
          ...cat,
          total: costs.filter(c => c.category === cat.value).reduce((s, c) => s + c.amount, 0)
        })).filter(c => c.total > 0)

        // New group name input state (local)
        let newGroupName = ""

        return (
          <div
            onClick={() => setCostsModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 120, padding: 20, overflowY: "auto" }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 960, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", marginBottom: 20 }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>Project Costs</div>
                  <div style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>{costsModal.projectName}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    placeholder="New group name e.g. Structural steel"
                    style={{ ...fieldStyle, width: 240, fontSize: 12 }}
                    onChange={(e) => { newGroupName = e.target.value }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                        await addProjectCost(costsModal.projectId, (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = ""
                      }
                    }}
                  />
                  <button type="button" onClick={() => addProjectCost(costsModal.projectId)} style={{ ...secondaryButtonStyle, color: "#4ade80", borderColor: "#166534" }}>+ Single cost</button>
                  <button type="button" onClick={() => setCostsModal(null)} style={secondaryButtonStyle}>Close</button>
                </div>
              </div>

              {/* Summary */}
              {totalByCat.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  {totalByCat.map(cat => (
                    <div key={cat.value} style={{ background: "#141a28", border: "1px solid #252f45", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 4 }}>{cat.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24" }}>${formatMoney(cat.total)}</div>
                    </div>
                  ))}
                  <div style={{ background: "#141a28", border: "1px solid #fbbf24", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6b7a9a", marginBottom: 4 }}>Total all costs</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fbbf24" }}>${formatMoney(grandTotal)}</div>
                  </div>
                </div>
              )}

              {costs.length === 0 && (
                <div style={{ color: "#6b7a9a", fontSize: 14, textAlign: "center", padding: "40px 0" }}>
                  No costs yet. Type a group name above + Enter to create a payment schedule, or click + Single cost for a one-off.
                </div>
              )}

              {/* Grouped cost sections */}
              <div style={{ display: "grid", gap: 14 }}>
                {groups.map(({ groupName, items }) => {
                  const groupTotal = items.reduce((s, c) => s + c.amount, 0)
                  return (
                    <div key={groupName ?? items[0].id} style={{ background: "#161d2e", border: "1px solid #252f45", borderRadius: 10, padding: 14 }}>
                      {/* Group header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #1f1f1f" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {groupName ? (
                            <span style={{ fontWeight: 700, fontSize: 14, color: "#fbbf24" }}>{groupName}</span>
                          ) : (
                            <span style={{ fontWeight: 600, fontSize: 13, color: "#a1a1aa" }}>Single cost</span>
                          )}
                          <span style={{ fontSize: 12, color: "#6b7a9a" }}>${formatMoney(groupTotal)} total</span>
                        </div>
                        {groupName && (
                          <button
                            type="button"
                            onClick={() => addProjectCost(costsModal.projectId, groupName)}
                            style={{ fontSize: 11, color: "#60a5fa", background: "none", border: "1px dashed #1d4ed8", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                          >
                            + Add instalment
                          </button>
                        )}
                      </div>

                      {/* Instalment rows */}
                      <div style={{ display: "grid", gap: 8 }}>
                        {items.map((c, idx) => {
                          const effectiveDate = c.date_trigger === "segment_start"
                            ? projectSegs.find(s => s.id === c.segment_id)?.start_date
                            : c.date_trigger === "segment_end"
                              ? projectSegs.find(s => s.id === c.segment_id)?.end_date
                              : c.date

                          return (
                            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 160px 1fr 110px auto", gap: 8, alignItems: "end", background: "#111827", borderRadius: 8, padding: "10px 12px" }}>
                              <div>
                                <FieldLabel>{groupName ? `Instalment ${idx + 1} — label` : "Description"}</FieldLabel>
                                <input
                                  defaultValue={c.description}
                                  key={`desc-${c.id}`}
                                  placeholder={groupName ? "e.g. Deposit, Posts, Beams" : "e.g. Structural steel package"}
                                  style={fieldStyle}
                                  onBlur={async (e) => { await saveProjectCost({ ...c, description: e.target.value }) }}
                                />
                              </div>
                              <div>
                                <FieldLabel>Amount (ex GST)</FieldLabel>
                                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <span style={{ fontSize: 11, color: "#8899bb" }}>$</span>
                                  <input
                                    type="number"
                                    defaultValue={c.amount}
                                    key={`amt-${c.id}`}
                                    style={{ ...fieldStyle, fontWeight: 700, color: "#fbbf24", padding: "5px 6px" }}
                                    onBlur={async (e) => { await saveProjectCost({ ...c, amount: Number(e.target.value) }) }}
                                  />
                                </div>
                              </div>
                              <div>
                                <FieldLabel>When to pay</FieldLabel>
                                <select
                                  defaultValue={c.date_trigger ?? "fixed"}
                                  key={`trig-${c.id}`}
                                  style={fieldStyle}
                                  onChange={async (e) => { await saveProjectCost({ ...c, date_trigger: e.target.value }) }}
                                >
                                  <option value="fixed">Fixed date</option>
                                  <option value="segment_start">When segment starts</option>
                                  <option value="segment_end">When segment ends</option>
                                </select>
                              </div>
                              <div>
                                {(c.date_trigger === "segment_start" || c.date_trigger === "segment_end") ? (
                                  <>
                                    <FieldLabel>Segment</FieldLabel>
                                    <select
                                      defaultValue={c.segment_id ?? ""}
                                      key={`seg-${c.id}`}
                                      style={fieldStyle}
                                      onChange={async (e) => { await saveProjectCost({ ...c, segment_id: e.target.value || null }) }}
                                    >
                                      <option value="">Select segment...</option>
                                      {projectSegs.map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.name ?? crews.find(cr => cr.id === s.crew_id)?.name ?? "Segment"} ({s.start_date} – {s.end_date})
                                        </option>
                                      ))}
                                    </select>
                                  </>
                                ) : (
                                  <>
                                    <FieldLabel>Date</FieldLabel>
                                    <input
                                      type="date"
                                      defaultValue={c.date ?? ""}
                                      key={`date-${c.id}`}
                                      style={fieldStyle}
                                      onBlur={async (e) => { await saveProjectCost({ ...c, date: e.target.value || null }) }}
                                    />
                                  </>
                                )}
                              </div>
                              <div>
                                <FieldLabel>Effective date</FieldLabel>
                                <div style={{ fontSize: 12, color: effectiveDate ? "#4ade80" : "#52525b", paddingTop: 8 }}>
                                  {effectiveDate ? formatDateLabel(parseDate(effectiveDate)) : "Not set"}
                                </div>
                              </div>
                              <button type="button" onClick={() => deleteProjectCost(c.id)} style={{ ...dangerButtonStyle, fontSize: 11, padding: "6px 10px", marginBottom: 2 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 16, fontSize: 12, color: "#6b7a9a" }}>
                All amounts ex GST. Segment-triggered payments update automatically when you move segments. Costs flow into cashflow and profitability.
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Extras & Variations Modal ── */}
      {showExtrasModal && (() => {
        const activeExtra = extras.find(e => e.id === activeExtraId) ?? extras[0] ?? null
        const activeExtraItemsList = activeExtra ? extraItems.filter(i => i.extra_id === activeExtra.id) : []

        function calcItemTotal(item: ExtraItem): number {
          if (item.charge_type === 'labour') {
            const worker = workers.find(w => w.id === item.worker_id)
            if (!worker) return 0
            const ordCost = (item.ordinary_hours ?? 0) * (worker.total_cost_hourly_with_ot ?? worker.base_rate_hourly ?? 0)
            const otCost = (item.ot_hours ?? 0) * (worker.ot_rate_hourly ?? 0)
            return (ordCost + otCost) * (1 + item.margin_percent / 100)
          }
          return item.unit_cost * (1 + item.margin_percent / 100)
        }

        const subtotal = activeExtraItemsList.reduce((s, i) => s + calcItemTotal(i), 0)
        const gst = subtotal * 0.1
        const total = subtotal + gst

        return (
          <div onClick={() => setShowExtrasModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "stretch", justifyContent: "center", zIndex: 120, padding: 16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: "calc(100vw - 32px)", background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", overflow: "hidden" }}>

              {/* Sidebar */}
              <div style={{ width: 300, minWidth: 300, borderRight: "1px solid #252f45", padding: 20, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#f0f4ff" }}>Extras & Variations</div>
                  <button type="button" onClick={async () => {
                    const { data } = await supabase.from("extras").insert({ title: "New variation", status: "draft" }).select().single()
                    if (data) { setExtras(prev => [data as Extra, ...prev]); setActiveExtraId(data.id) }
                  }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #7c3aed", background: "#1a1a3e", color: "#c4b5fd", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ New</button>
                </div>
                {extras.map(ex => {
                  const items = extraItems.filter(i => i.extra_id === ex.id)
                  const exTotal = items.reduce((s, i) => {
                    if (i.charge_type === 'labour') {
                      const w = workers.find(wk => wk.id === i.worker_id)
                      if (!w) return s
                      return s + ((i.ordinary_hours ?? 0) * (w.total_cost_hourly_with_ot ?? w.base_rate_hourly ?? 0) + (i.ot_hours ?? 0) * (w.ot_rate_hourly ?? 0)) * (1 + i.margin_percent / 100)
                    }
                    return s + i.unit_cost * (1 + i.margin_percent / 100)
                  }, 0)
                  const proj = projects.find(p => p.id === ex.project_id)
                  return (
                    <div key={ex.id} onClick={() => setActiveExtraId(ex.id)}
                      style={{ background: activeExtraId === ex.id ? "#1a1a3e" : "#141a28", border: `1.5px solid ${activeExtraId === ex.id ? "#7c3aed" : "#252f45"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f4ff", marginBottom: 4 }}>{ex.title}</div>
                      <div style={{ fontSize: 12, color: "#6b7a9a", marginBottom: 6 }}>{proj?.name ?? "No project"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: ex.status === "invoiced" ? "#4ade80" : "#c4b5fd", background: ex.status === "invoiced" ? "#14532d" : "#1a1a3e", borderRadius: 6, padding: "2px 8px" }}>{ex.status}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#c4b5fd" }}>${formatMoney(exTotal * 1.1)}</span>
                      </div>
                    </div>
                  )
                })}
                {extras.length === 0 && <div style={{ fontSize: 13, color: "#6b7a9a", textAlign: "center", padding: "30px 0" }}>No extras yet</div>}
                <div style={{ marginTop: "auto", paddingTop: 12 }}>
                  <button type="button" onClick={() => setShowExtrasModal(false)} style={{ ...secondaryButtonStyle, width: "100%", textAlign: "center", padding: "12px", fontSize: 14, fontWeight: 700 }}>Close</button>
                </div>
              </div>

              {/* Right panel */}
              <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
                {!activeExtra && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 14, color: "#6b7a9a" }}>Select a variation or create a new one</div>
                  </div>
                )}
                {activeExtra && (
                  <>
                    {/* Header */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7a9a", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 6 }}>Title</div>
                      <input defaultValue={activeExtra.title} key={`ext-${activeExtra.id}`}
                        style={{ ...fieldStyle, fontSize: 22, fontWeight: 900, padding: "14px 16px", color: "#f0f4ff" }}
                        onBlur={async e => { await supabase.from("extras").update({ title: e.target.value }).eq("id", activeExtra.id); setExtras(prev => prev.map(x => x.id === activeExtra.id ? { ...x, title: e.target.value } : x)) }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: 12, marginBottom: 20, alignItems: "end" }}>
                      <div>
                        <FieldLabel>Project</FieldLabel>
                        <select defaultValue={activeExtra.project_id ?? ""} key={`exp-${activeExtra.id}`} style={fieldStyle}
                          onChange={async e => { await supabase.from("extras").update({ project_id: e.target.value || null }).eq("id", activeExtra.id); setExtras(prev => prev.map(x => x.id === activeExtra.id ? { ...x, project_id: e.target.value || null } : x)) }}>
                          <option value="">No project</option>
                          {projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Date</FieldLabel>
                        <input type="date" defaultValue={activeExtra.issued_date ?? ""} key={`exd-${activeExtra.id}`} style={fieldStyle}
                          onBlur={async e => { await supabase.from("extras").update({ issued_date: e.target.value || null }).eq("id", activeExtra.id) }} />
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <select defaultValue={activeExtra.status} key={`exs-${activeExtra.id}`} style={fieldStyle}
                          onChange={async e => { await supabase.from("extras").update({ status: e.target.value }).eq("id", activeExtra.id); setExtras(prev => prev.map(x => x.id === activeExtra.id ? { ...x, status: e.target.value } : x)) }}>
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="invoiced">Invoiced</option>
                        </select>
                      </div>
                      <button type="button" onClick={async () => {
                        if (!window.confirm("Delete this variation?")) return
                        await supabase.from("extras").delete().eq("id", activeExtra.id)
                        setExtras(prev => prev.filter(x => x.id !== activeExtra.id))
                        setExtraItems(prev => prev.filter(x => x.extra_id !== activeExtra.id))
                        setActiveExtraId(null)
                      }} style={{ ...dangerButtonStyle, fontSize: 13, padding: "10px 14px" }}>×</button>
                    </div>

                    {/* Line items */}
                    <div style={{ borderTop: "1px solid #252f45", paddingTop: 16, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#f0f4ff" }}>Line items</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ type: "labour", label: "👷 Labour", color: "#2563eb" }, { type: "material", label: "🧱 Material", color: "#d97706" }, { type: "fixed", label: "💰 Fixed price", color: "#16a34a" }].map(ct => (
                            <button key={ct.type} type="button" onClick={async () => {
                              const { data } = await supabase.from("extra_items").insert({
                                extra_id: activeExtra.id, charge_type: ct.type, description: ct.type === "labour" ? "Labour" : ct.type === "material" ? "Materials" : "Fixed charge",
                                ordinary_hours: 0, ot_hours: 0, unit_cost: 0, margin_percent: ct.type === "material" ? 0 : 30, sort_order: activeExtraItemsList.length
                              }).select().single()
                              if (data) setExtraItems(prev => [...prev, data as ExtraItem])
                            }} style={{ ...secondaryButtonStyle, fontSize: 12, padding: "6px 12px", color: ct.color, borderColor: ct.color }}>+ {ct.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Column headers */}
                      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 160px 80px 80px 100px 90px auto", gap: 10, marginBottom: 10, padding: "8px 14px", background: "#161d2e", borderRadius: 8 }}>
                        {["Type", "Description", "Worker / Cost", "Ord hrs", "OT hrs", "Margin", "Total", ""].map(h => (
                          <div key={h} style={{ fontSize: 11, color: "#6b7a9a", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.4px" }}>{h}</div>
                        ))}
                      </div>

                      {activeExtraItemsList.length === 0 && (
                        <div style={{ fontSize: 13, color: "#6b7a9a", textAlign: "center", padding: "30px 0" }}>Add labour, material or fixed price items above</div>
                      )}

                      {activeExtraItemsList.map(item => {
                        const itemTotal = calcItemTotal(item)
                        const worker = workers.find(w => w.id === item.worker_id)
                        const isLabour = item.charge_type === "labour"
                        const isMaterial = item.charge_type === "material"
                        const isFixed = item.charge_type === "fixed"
                        const typeColor = isLabour ? "#2563eb" : isMaterial ? "#d97706" : "#16a34a"

                        return (
                          <div key={item.id} style={{ marginBottom: 10, background: "#141a28", borderRadius: 12, padding: "14px", border: `1px solid ${typeColor}44`, display: "grid", gridTemplateColumns: "120px 1fr 160px 80px 80px 100px 90px auto", gap: 10, alignItems: "center" }}>
                            {/* Type badge */}
                            <div style={{ fontSize: 12, fontWeight: 700, color: typeColor, background: typeColor + "22", borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>
                              {isLabour ? "👷 Labour" : isMaterial ? "🧱 Material" : "💰 Fixed"}
                            </div>

                            {/* Description */}
                            <input defaultValue={item.description ?? ""} key={`exid-${item.id}`}
                              style={{ ...fieldStyle, fontSize: 14, fontWeight: 600 }}
                              placeholder="e.g. New doorway, Relocate wall..."
                              onBlur={async e => { await supabase.from("extra_items").update({ description: e.target.value }).eq("id", item.id); setExtraItems(prev => prev.map(x => x.id === item.id ? { ...x, description: e.target.value } : x)) }} />

                            {/* Worker selector or cost input */}
                            {isLabour ? (
                              <select defaultValue={item.worker_id ?? ""} key={`exiw-${item.id}`} style={{ ...fieldStyle, fontSize: 12 }}
                                onChange={async e => { await supabase.from("extra_items").update({ worker_id: e.target.value || null }).eq("id", item.id); setExtraItems(prev => prev.map(x => x.id === item.id ? { ...x, worker_id: e.target.value || null } : x)) }}>
                                <option value="">Select worker...</option>
                                {workers.map(w => <option key={w.id} value={w.id}>{w.name} — ${formatMoney(w.total_cost_hourly_with_ot ?? 0)}/hr</option>)}
                              </select>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 12, color: "#6b7a9a" }}>$</span>
                                <input type="number" defaultValue={item.unit_cost} key={`exiuc-${item.id}`} style={{ ...fieldStyle, fontSize: 14, fontWeight: 700 }}
                                  placeholder={isMaterial ? "Material cost" : "Fixed price"}
                                  onBlur={async e => { await supabase.from("extra_items").update({ unit_cost: Number(e.target.value) }).eq("id", item.id); setExtraItems(prev => prev.map(x => x.id === item.id ? { ...x, unit_cost: Number(e.target.value) } : x)) }} />
                              </div>
                            )}

                            {/* Ord hours */}
                            {isLabour ? (
                              <input type="number" step="0.5" defaultValue={item.ordinary_hours} key={`exiord-${item.id}`}
                                style={{ ...fieldStyle, fontSize: 16, fontWeight: 700, textAlign: "center" as const }}
                                onBlur={async e => { await supabase.from("extra_items").update({ ordinary_hours: Number(e.target.value) }).eq("id", item.id); setExtraItems(prev => prev.map(x => x.id === item.id ? { ...x, ordinary_hours: Number(e.target.value) } : x)) }} />
                            ) : <div />}

                            {/* OT hours */}
                            {isLabour ? (
                              <input type="number" step="0.5" defaultValue={item.ot_hours} key={`exiot-${item.id}`}
                                style={{ ...fieldStyle, fontSize: 16, fontWeight: 700, textAlign: "center" as const, borderColor: item.ot_hours > 0 ? "#f59e0b" : undefined }}
                                onBlur={async e => { await supabase.from("extra_items").update({ ot_hours: Number(e.target.value) }).eq("id", item.id); setExtraItems(prev => prev.map(x => x.id === item.id ? { ...x, ot_hours: Number(e.target.value) } : x)) }} />
                            ) : <div />}

                            {/* Margin */}
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <input type="number" defaultValue={item.margin_percent} key={`exim-${item.id}`}
                                style={{ ...fieldStyle, fontSize: 13, padding: "8px 6px" }}
                                onBlur={async e => { await supabase.from("extra_items").update({ margin_percent: Number(e.target.value) }).eq("id", item.id); setExtraItems(prev => prev.map(x => x.id === item.id ? { ...x, margin_percent: Number(e.target.value) } : x)) }} />
                              <span style={{ fontSize: 11, color: "#6b7a9a" }}>%</span>
                            </div>

                            {/* Total */}
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#c4b5fd", textAlign: "right" as const }}>${formatMoney(itemTotal)}</div>

                            {/* Delete */}
                            <button type="button" onClick={async () => {
                              await supabase.from("extra_items").delete().eq("id", item.id)
                              setExtraItems(prev => prev.filter(x => x.id !== item.id))
                            }} style={{ background: "none", border: "none", color: "#6b7a9a", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Totals + notes */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
                      <div>
                        <FieldLabel>Notes</FieldLabel>
                        <textarea defaultValue={activeExtra.notes ?? ""} key={`exnotes-${activeExtra.id}`} rows={4}
                          placeholder="Notes for client or accounting..."
                          style={{ ...fieldStyle, resize: "vertical" as const, fontFamily: "system-ui" }}
                          onBlur={async e => { await supabase.from("extras").update({ notes: e.target.value || null }).eq("id", activeExtra.id) }} />
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7a9a" }}>
                          <span>Subtotal (ex GST)</span><span>${formatMoney(subtotal)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7a9a" }}>
                          <span>GST (10%)</span><span>${formatMoney(gst)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, color: "#c4b5fd", borderTop: "2px solid #2e3650", paddingTop: 10 }}>
                          <span>TOTAL inc GST</span><span>${formatMoney(total)}</span>
                        </div>
                        <div style={{ marginTop: 8, padding: "12px 16px", background: "#141a28", border: "1px solid #252f45", borderRadius: 10, fontSize: 12, color: "#6b7a9a" }}>
                          <div style={{ fontWeight: 700, color: "#a0b0cc", marginBottom: 6 }}>For accounting invoice:</div>
                          <div>{activeExtra.title}</div>
                          {activeExtra.project_id && <div>{projects.find(p => p.id === activeExtra.project_id)?.name}</div>}
                          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "#c4b5fd" }}>Total: ${formatMoney(total)} inc GST</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {showEstimatesModal && (() => {
        const activeEstimate = estimates.find(e => e.id === activeEstimateId) ?? estimates[0] ?? null
        const activeItems = activeEstimate ? estimateItems.filter(i => i.estimate_id === activeEstimate.id) : []
        const subtotal = activeItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0)
        const total = activeItems.reduce((s, i) => s + calcItemTotal(i), 0)
        const gst = total * 0.1
        const totalIncGst = total + gst

        return (
          <div
            onClick={() => setShowEstimatesModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "stretch", justifyContent: "center", zIndex: 120, padding: 16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: "calc(100vw - 32px)", background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, color: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "flex", flexDirection: "row", overflow: "hidden" }}
            >
              {/* Left sidebar — estimate list */}
              <div style={{ width: 320, minWidth: 320, borderRight: "1px solid #252f45", padding: 20, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#f0f4ff" }}>Estimates</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => setShowTemplateManager(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #4a5680", background: "#1e2535", color: "#8899bb", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>⚙ Templates</button>
                    <button type="button" onClick={() => createEstimate()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #d97706", background: "#431407", color: "#fbbf24", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ New estimate</button>
                  </div>
                </div>

                {estimates.length === 0 && (
                  <div style={{ fontSize: 12, color: "#6b7a9a", textAlign: "center", padding: "20px 0" }}>No estimates yet</div>
                )}

                {estimates.map(e => {
                  const status = ESTIMATE_STATUSES.find(s => s.value === e.status)
                  const itemCount = estimateItems.filter(i => i.estimate_id === e.id).length
                  const estTotal = estimateItems.filter(i => i.estimate_id === e.id).reduce((s, i) => s + calcItemTotal(i), 0)
                  const project = projects.find(p => p.id === e.project_id)
                  return (
                    <div
                      key={e.id}
                      onClick={() => setActiveEstimateId(e.id)}
                      style={{
                        background: activeEstimateId === e.id ? "#1a1a1a" : "#0b0b0b",
                        border: `1px solid ${activeEstimateId === e.id ? "#fbbf24" : "#222"}`,
                        borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: "#8899bb", marginBottom: 4 }}>
                        {project?.name ?? "No project"} · v{e.version}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: status?.color ?? "#71717a", background: (status?.color ?? "#71717a") + "22", borderRadius: 4, padding: "2px 6px" }}>{status?.label}</span>
                        <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700 }}>${formatMoneyK(estTotal)}</span>
                      </div>
                    </div>
                  )
                })}

                <div style={{ marginTop: "auto", paddingTop: 12 }}>
                  <button type="button" onClick={() => setShowEstimatesModal(false)} style={{ ...secondaryButtonStyle, width: "100%", textAlign: "center", padding: "12px", fontSize: 14, fontWeight: 700 }}>Close</button>
                </div>
              </div>

              {/* Right panel — active estimate */}
              <div style={{ flex: 1, padding: 28, overflowY: "auto" }}>
                {!activeEstimate && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
                    <div style={{ fontSize: 14, color: "#6b7a9a" }}>Select an estimate or create a new one</div>
                    <button type="button" onClick={() => createEstimate()} style={{ ...secondaryButtonStyle, color: "#fbbf24", borderColor: "#854d0e" }}>+ New estimate</button>
                  </div>
                )}

                {activeEstimate && (
                  <>
                    {/* Estimate header */}
                    {/* Row 1: Title full width */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7a9a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Title</div>
                      <input defaultValue={activeEstimate.title} key={`et-${activeEstimate.id}`}
                        style={{ ...fieldStyle, fontSize: 22, fontWeight: 900, padding: "14px 16px", color: "#f0f4ff" }}
                        onBlur={async (e) => { await saveEstimate({ ...activeEstimate, title: e.target.value }) }} />
                    </div>
                    {/* Row 2: Project + Client + Status + actions */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto auto", gap: 12, marginBottom: 16, alignItems: "end" }}>
                      <div>
                        <FieldLabel>Project</FieldLabel>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select defaultValue={activeEstimate.project_id ?? ""} key={`ep-${activeEstimate.id}`} style={{ ...fieldStyle, flex: 1 }}
                            onChange={async (e) => {
                              const projectId = e.target.value || null
                              const project = projects.find(p => p.id === projectId)
                              const clientId = project?.client_id ?? activeEstimate.client_id
                              const title = project && (activeEstimate.title === "New Estimate" || !activeEstimate.title)
                                ? `${project.name} — Quote`
                                : activeEstimate.title
                              await saveEstimate({ ...activeEstimate, project_id: projectId, client_id: clientId, title })
                            }}>
                            <option value="">No project</option>
                            {projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button type="button" title="Add new project"
                            onClick={() => { setQuickAddProject(v => !v); setQuickProjectForm({ name: "", client_id: "", client: "" }) }}
                            style={{ ...fieldStyle, width: "auto", padding: "0 12px", background: quickAddProject ? "#1e3a6e" : "#141a28", border: "1.5px solid #2563eb", color: "#93c5fd", fontWeight: 700, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>
                            {quickAddProject ? "×" : "+"}
                          </button>
                        </div>
                      </div>

                      {/* Quick-add project inline panel */}
                      {quickAddProject && (
                        <div style={{ gridColumn: "1 / -1", background: "#0f1d35", border: "1.5px solid #2563eb", borderRadius: 10, padding: "16px 18px", display: "grid", gap: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#93c5fd" }}>New project</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                            <div>
                              <FieldLabel>Project name</FieldLabel>
                              <input
                                placeholder="e.g. 12 Smith St, Carlton"
                                value={quickProjectForm.name}
                                onChange={e => setQuickProjectForm(p => ({ ...p, name: e.target.value }))}
                                style={fieldStyle}
                                autoFocus
                              />
                            </div>
                            <div>
                              <FieldLabel>Client / Builder</FieldLabel>
                              <select
                                value={quickProjectForm.client_id}
                                onChange={e => setQuickProjectForm(p => ({ ...p, client_id: e.target.value }))}
                                style={fieldStyle}
                              >
                                <option value="">Select client...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!quickProjectForm.name.trim()) return
                                const selectedClient = clients.find(c => c.id === quickProjectForm.client_id)
                                const { data } = await supabase.from("projects").insert({
                                  name: quickProjectForm.name.trim(),
                                  client: selectedClient?.name ?? null,
                                  client_id: quickProjectForm.client_id || null,
                                }).select().single()
                                await loadData()
                                if (data) {
                                  await saveEstimate({ ...activeEstimate, project_id: data.id, client_id: quickProjectForm.client_id || activeEstimate.client_id, title: `${quickProjectForm.name.trim()} — Quote` })
                                }
                                setQuickAddProject(false)
                                setQuickProjectForm({ name: "", client_id: "", client: "" })
                              }}
                              style={{ ...fieldStyle, width: "auto", padding: "10px 18px", background: "#1e3a6e", border: "1.5px solid #2563eb", color: "#93c5fd", fontWeight: 700, cursor: "pointer" }}
                            >
                              Create project
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: "#4a6080" }}>
                            Don't see the client? Add them in the Clients section first.
                          </div>
                        </div>
                      )}

                      <div>
                        <FieldLabel>Client</FieldLabel>
                        <select defaultValue={activeEstimate.client_id ?? ""} key={`ec-${activeEstimate.id}`} style={fieldStyle}
                          onChange={async (e) => { await saveEstimate({ ...activeEstimate, client_id: e.target.value || null }) }}>
                          <option value="">No client</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Status</FieldLabel>
                        <select defaultValue={activeEstimate.status} key={`es-${activeEstimate.id}`} style={fieldStyle}
                          onChange={async (e) => { await saveEstimate({ ...activeEstimate, status: e.target.value }) }}>
                          {ESTIMATE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={() => duplicateEstimate(activeEstimate)}
                        style={{ ...secondaryButtonStyle, fontSize: 13, padding: "10px 14px", fontWeight: 700 }} title="New version">v+</button>
                      <button type="button" onClick={() => deleteEstimate(activeEstimate.id)}
                        style={{ ...dangerButtonStyle, fontSize: 13, padding: "10px 14px" }}>×</button>
                    </div>
                    {/* Row 3: dates + notes compact */}
                    <div style={{ display: "grid", gridTemplateColumns: "160px 160px 1fr", gap: 12, marginBottom: 20 }}>
                      <div>
                        <FieldLabel>Issue date</FieldLabel>
                        <input type="date" defaultValue={activeEstimate.issued_date ?? ""} key={`ed-${activeEstimate.id}`} style={fieldStyle}
                          onBlur={async (e) => { await saveEstimate({ ...activeEstimate, issued_date: e.target.value || null }) }} />
                      </div>
                      <div>
                        <FieldLabel>Valid until</FieldLabel>
                        <input type="date" defaultValue={activeEstimate.valid_until ?? ""} key={`ev-${activeEstimate.id}`} style={fieldStyle}
                          onBlur={async (e) => { await saveEstimate({ ...activeEstimate, valid_until: e.target.value || null }) }} />
                      </div>
                      <div>
                        <FieldLabel>Internal notes</FieldLabel>
                        <input defaultValue={activeEstimate.notes ?? ""} key={`en-${activeEstimate.id}`} placeholder="Notes..." style={fieldStyle}
                          onBlur={async (e) => { await saveEstimate({ ...activeEstimate, notes: e.target.value || null }) }} />
                      </div>
                    </div>

                    {/* Line items */}
                    <div style={{ borderTop: "1px solid #252f45", paddingTop: 16, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#f0f4ff" }}>Line items</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {/* Load full job template */}
                          <select
                            defaultValue=""
                            onChange={async (e) => {
                              if (!e.target.value) return
                              const tmpl = estimateTemplates.find(t => t.id === e.target.value)
                              if (!tmpl) return
                              const tmplItems = estimateTemplateItems.filter(i => i.template_id === tmpl.id).sort((a, b) => a.sort_order - b.sort_order)
                              const existing = estimateItems.filter(i => i.estimate_id === activeEstimate.id)
                              const inserts = tmplItems.map((ti, idx) => ({
                                estimate_id: activeEstimate.id,
                                category: ti.category,
                                description: ti.description ?? "",
                                crew_id: null,
                                quantity: ti.quantity,
                                unit: ti.unit,
                                unit_cost: ti.unit_cost,
                                margin_percent: ti.margin_percent,
                                scope: ti.scope ?? null,
                                sort_order: existing.length + idx,
                              }))
                              if (inserts.length > 0) {
                                const { data } = await supabase.from("estimate_items").insert(inserts).select()
                                if (data) setEstimateItems(prev => [...prev, ...(data as EstimateItem[])])
                              }
                              // Also set quote type from template
                              if (tmpl.quote_type) await saveEstimate({ ...activeEstimate, quote_type: tmpl.quote_type })
                              e.target.value = ""
                              showToast(`Loaded "${tmpl.name}" — ${tmplItems.length} items added`)
                            }}
                            style={{
                              padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                              background: "linear-gradient(135deg, #1a2e1a, #166534)",
                              border: "1.5px solid #16a34a", color: "#86efac", cursor: "pointer",
                            }}
                          >
                            <option value="">⚡ Load job template...</option>
                            {estimateTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}{t.description ? ` — ${t.description}` : ""}</option>
                            ))}
                          </select>
                          {ESTIMATE_ITEM_CATEGORIES.map(cat => (
                            <button key={cat.value} type="button"
                              onClick={() => addEstimateItem(activeEstimate.id, cat.value)}
                              style={{ ...secondaryButtonStyle, fontSize: 12, padding: "6px 12px", fontWeight: 600 }}>
                              + {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px 80px 80px 110px 90px 110px auto", gap: 10, marginBottom: 10, padding: "8px 14px", background: "#161d2e", borderRadius: 8 }}>
                        {["Category", "Description", "Crew", "Qty", "Unit", "Unit cost", "Margin", "Total", ""].map(h => (
                          <div key={h} style={{ fontSize: 11, color: "#6b7a9a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</div>
                        ))}
                      </div>

                      {activeItems.length === 0 && (
                        <div style={{ fontSize: 12, color: "#6b7a9a", textAlign: "center", padding: "20px 0" }}>
                          No line items yet — use the buttons above to add
                        </div>
                      )}

                      {activeItems.map(item => {
                        const itemTotal = calcItemTotal(item)
                        const crewBlended = item.crew_id
                          ? (workers.filter(w => w.crew_id === item.crew_id && w.total_cost_hourly_with_ot != null).reduce((s, w) => s + (w.total_cost_hourly_with_ot ?? 0), 0) / Math.max(workers.filter(w => w.crew_id === item.crew_id).length, 1)) * 9
                          : null

                        return (
                          <div key={item.id} style={{ marginBottom: 8, background: "#111827", borderRadius: 6, padding: "6px 0" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 70px 70px 90px 80px 90px auto", gap: 6, alignItems: "center" }}>
                            <select defaultValue={item.category} key={`ic-${item.id}`} style={{ ...fieldStyle, fontSize: 13, padding: "8px 8px" }}
                              onChange={async (e) => { await saveEstimateItem({ ...item, category: e.target.value }) }}>
                              {ESTIMATE_ITEM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <input defaultValue={item.description} key={`id-${item.id}`} style={{ ...fieldStyle, fontSize: 14, fontWeight: 600 }}
                              onBlur={async (e) => { await saveEstimateItem({ ...item, description: e.target.value }) }} />
                            <select defaultValue={item.crew_id ?? ""} key={`iw-${item.id}`} style={{ ...fieldStyle, fontSize: 11, padding: "4px 5px" }}
                              onChange={async (e) => {
                                const crewId = e.target.value || null
                                const newCrew = crews.find(c => c.id === crewId)
                                const newCost = crewId ? (workers.filter(w => w.crew_id === crewId && w.total_cost_hourly_with_ot != null).reduce((s, w) => s + (w.total_cost_hourly_with_ot ?? 0), 0) / Math.max(workers.filter(w => w.crew_id === crewId).length, 1)) * 9 : item.unit_cost
                                await saveEstimateItem({ ...item, crew_id: crewId, unit_cost: Math.round(newCost * 100) / 100 })
                              }}>
                              <option value="">No crew</option>
                              {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input type="number" step="0.5" defaultValue={item.quantity} key={`iq-${item.id}`} style={{ ...fieldStyle, fontSize: 12, padding: "4px 6px" }}
                              onBlur={async (e) => { await saveEstimateItem({ ...item, quantity: Number(e.target.value) }) }} />
                            <select defaultValue={item.unit} key={`iu-${item.id}`} style={{ ...fieldStyle, fontSize: 11, padding: "4px 5px" }}
                              onChange={async (e) => { await saveEstimateItem({ ...item, unit: e.target.value }) }}>
                              {ESTIMATE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <div style={{ position: "relative" }}>
                              <input type="number" defaultValue={item.unit_cost} key={`iuc-${item.id}`} style={{ ...fieldStyle, fontSize: 12, padding: "4px 6px" }}
                                onBlur={async (e) => { await saveEstimateItem({ ...item, unit_cost: Number(e.target.value) }) }} />
                              {crewBlended && Math.abs(crewBlended - item.unit_cost) > 10 && (
                                <div style={{ fontSize: 9, color: "#60a5fa", position: "absolute", bottom: -14, left: 0 }}>crew: ${Math.round(crewBlended)}</div>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                              <input type="number" defaultValue={item.margin_percent} key={`im-${item.id}`} style={{ ...fieldStyle, fontSize: 12, padding: "4px 6px" }}
                                onBlur={async (e) => { await saveEstimateItem({ ...item, margin_percent: Number(e.target.value) }) }} />
                              <span style={{ fontSize: 10, color: "#6b7a9a" }}>%</span>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#fbbf24", textAlign: "right" }}>${formatMoneyK(itemTotal)}</div>
                            <button type="button" onClick={() => deleteEstimateItem(item.id)} style={{ background: "none", border: "none", color: "#6b7a9a", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
                          </div>
                          {/* Scope field */}
                          <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
                            <textarea
                              defaultValue={item.scope ?? ""}
                              key={`scope-${item.id}`}
                              placeholder="Scope bullet points (one per line)..."
                              rows={3}
                              style={{ ...fieldStyle, fontSize: 11, padding: "6px 8px", resize: "vertical", fontFamily: "system-ui", lineHeight: 1.5 }}
                              onBlur={async (e) => { await saveEstimateItem({ ...item, scope: e.target.value || null }) }}
                            />

                          </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Totals */}
                    {activeItems.length > 0 && (
                      <div style={{ borderTop: "1px solid #252f45", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                        <div style={{ flex: 1 }}>
                          {/* Quote type */}
                          <div style={{ marginBottom: 12 }}>
                            <FieldLabel>Quote type</FieldLabel>
                            <div style={{ display: "flex", gap: 8 }}>
                              {[
                                { value: "framing", label: "Framing" },
                                { value: "steel", label: "Structural Steel" },
                              ].map(qt => (
                                <button
                                  key={qt.value}
                                  type="button"
                                  onClick={async () => {
                                    const terms = qt.value === "framing" ? buildFramingTerms(activeItems) : STEEL_TERMS
                                    await saveEstimate({ ...activeEstimate, quote_type: qt.value, terms })
                                  }}
                                  style={{
                                    ...secondaryButtonStyle,
                                    fontSize: 12,
                                    background: (activeEstimate.quote_type ?? "framing") === qt.value ? "#1d4ed8" : undefined,
                                    color: (activeEstimate.quote_type ?? "framing") === qt.value ? "white" : undefined,
                                  }}
                                >{qt.label}</button>
                              ))}
                              <button
                                type="button"
                                onClick={async () => {
                                  const terms = (activeEstimate.quote_type ?? "framing") === "steel" ? STEEL_TERMS : buildFramingTerms(activeItems)
                                  await saveEstimate({ ...activeEstimate, terms })
                                }}
                                style={{ ...secondaryButtonStyle, fontSize: 11, padding: "4px 8px", color: "#8899bb" }}
                              >Reset T&amp;Cs</button>
                            </div>
                          </div>

                          {/* T&C editor */}
                          <div>
                            <FieldLabel>Terms &amp; Conditions</FieldLabel>
                            <textarea
                              value={activeEstimate.terms ?? ((activeEstimate.quote_type ?? "framing") === "steel" ? STEEL_TERMS : FRAMING_TERMS)}
                              key={`terms-${activeEstimate.id}-${activeEstimate.quote_type}`}
                              rows={12}
                              style={{ ...fieldStyle, fontSize: 11, padding: "8px 10px", resize: "vertical", fontFamily: "system-ui", lineHeight: 1.6, width: "100%" }}
                              onChange={async (e) => { await saveEstimate({ ...activeEstimate, terms: e.target.value }) }}
                            />
                            <div style={{ fontSize: 10, color: "#6b7a9a", marginTop: 4 }}>One item per line. Lines starting with - are sub-items. Lines containing "charges apply" appear in red.</div>
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 6, minWidth: 280 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8899bb" }}>
                            <span>Subtotal (ex margin)</span>
                            <span>${formatMoney(subtotal)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8899bb" }}>
                            <span>Margin</span>
                            <span>${formatMoney(total - subtotal)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#fbbf24", borderTop: "1px solid #2e3650", paddingTop: 6 }}>
                            <span>Total ex GST</span>
                            <span>${formatMoney(total)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8899bb" }}>
                            <span>GST (10%)</span>
                            <span>${formatMoney(gst)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "#e4e4e7", borderTop: "1px solid #2e3650", paddingTop: 6 }}>
                            <span>TOTAL inc GST</span>
                            <span>${formatMoney(totalIncGst)}</span>
                          </div>

                          <a
                            href={`/api/quote-pdf?estimateId=${activeEstimate.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "block", marginTop: 20, padding: "16px 0",
                              background: "linear-gradient(135deg, #1e3a6e, #2563eb)",
                              color: "white", fontWeight: 800,
                              fontSize: 16, textAlign: "center", borderRadius: 10,
                              textDecoration: "none", cursor: "pointer",
                              boxShadow: "0 4px 16px rgba(37,99,235,0.4)",
                              letterSpacing: "0.02em",
                            }}
                          >
                            ↓ Download PDF
                          </a>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

    </div>
        {/* ── Change PIN modal ── */}
      {showChangePinModal && (() => {
        let newPin = ""
        let confirmPin = ""
        return (
          <div onClick={() => setShowChangePinModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 360, background: "#1e2535", border: "1px solid #2e3a58", borderRadius: 16, padding: 32, color: "white" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#f0f4ff", marginBottom: 6 }}>Change PIN</div>
              <div style={{ fontSize: 13, color: "#6b7a9a", marginBottom: 24 }}>Set a new 4-digit PIN for {currentUser.name}</div>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <FieldLabel>New PIN</FieldLabel>
                  <input type="password" maxLength={4} placeholder="4 digits"
                    style={{ ...fieldStyle, fontSize: 24, letterSpacing: "0.3em", textAlign: "center" }}
                    onChange={e => { newPin = e.target.value }} />
                </div>
                <div>
                  <FieldLabel>Confirm PIN</FieldLabel>
                  <input type="password" maxLength={4} placeholder="4 digits"
                    style={{ ...fieldStyle, fontSize: 24, letterSpacing: "0.3em", textAlign: "center" }}
                    onChange={e => { confirmPin = e.target.value }} />
                </div>
                <button type="button"
                  onClick={async () => {
                    if (newPin.length !== 4) { showToast("PIN must be 4 digits"); return }
                    if (newPin !== confirmPin) { showToast("PINs don't match"); return }
                    const { error } = await supabase.from("workers").update({ pin: newPin }).eq("id", currentUser.id)
                    if (error) { showToast("Error saving PIN"); return }
                    showToast("PIN updated ✓")
                    setShowChangePinModal(false)
                  }}
                  style={{ padding: "14px", borderRadius: 12, fontSize: 16, fontWeight: 800, background: "linear-gradient(135deg, #1e3a6e, #2563eb)", border: "1.5px solid #2563eb", color: "white", cursor: "pointer" }}>
                  Save new PIN
                </button>
                <button type="button" onClick={() => setShowChangePinModal(false)}
                  style={{ ...secondaryButtonStyle, width: "100%", textAlign: "center" }}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}