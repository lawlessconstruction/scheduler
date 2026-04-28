import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple token auth - Blake sends this header
function isAuthorised(req: NextRequest) {
  const token = req.headers.get("x-bot-token")
  return token === process.env.BOT_API_TOKEN
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  // ── GET /api/bot?action=projects ──────────────────────────────────
  if (action === "projects") {
    const { data } = await supabase
      .from("projects")
      .select("id, name, client, archived")
      .eq("archived", false)
      .order("name")
    return NextResponse.json({ projects: data })
  }

  // ── GET /api/bot?action=schedule&weeks=2 ─────────────────────────
  if (action === "schedule") {
    const weeks = parseInt(searchParams.get("weeks") ?? "2")
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date()
    future.setDate(future.getDate() + weeks * 7)
    const end = future.toISOString().slice(0, 10)

    const { data } = await supabase
      .from("segments")
      .select("*, projects(name, client), crews(name, color)")
      .gte("end_date", today)
      .lte("start_date", end)
      .order("start_date")
    return NextResponse.json({ segments: data, from: today, to: end })
  }

  // ── GET /api/bot?action=milestones&status=pending ─────────────────
  if (action === "milestones") {
    const status = searchParams.get("status") ?? "pending"
    const today = new Date().toISOString().slice(0, 10)

    let query = supabase
      .from("milestones")
      .select("*, projects(name, client)")
      .order("sort_order")

    if (status !== "all") query = query.eq("status", status)

    const { data } = await query
    // Attach resolved due date
    const { data: segs } = await supabase.from("segments").select("id, end_date")
    const segMap = new Map((segs ?? []).map((s: any) => [s.id, s.end_date]))

    const milestones = (data ?? []).map((m: any) => ({
      ...m,
      due_date: m.due_date_override ?? (m.segment_id ? segMap.get(m.segment_id) : null),
      overdue: (m.due_date_override ?? segMap.get(m.segment_id) ?? "9999") < today && m.status !== "paid",
    }))

    return NextResponse.json({ milestones })
  }

  // ── GET /api/bot?action=cashflow ──────────────────────────────────
  if (action === "cashflow") {
    const { data: milestones } = await supabase
      .from("milestones")
      .select("amount, status, due_date_override, segment_id")
      .not("amount", "is", null)

    const { data: segments } = await supabase
      .from("segments")
      .select("id, end_date")

    const segMap = new Map((segments ?? []).map((s: any) => [s.id, s.end_date]))
    const today = new Date().toISOString().slice(0, 10)

    let overdue = 0, pending = 0, invoiced = 0, paid = 0

    for (const m of (milestones ?? []) as any[]) {
      const due = m.due_date_override ?? (m.segment_id ? segMap.get(m.segment_id) : null)
      if (m.status === "paid") { paid += m.amount; continue }
      if (m.status === "invoiced") { invoiced += m.amount; continue }
      if (due && due < today) overdue += m.amount
      else pending += m.amount
    }

    return NextResponse.json({ cashflow: { overdue, pending, invoiced, paid, total: overdue + pending + invoiced + paid } })
  }

  // ── GET /api/bot?action=crew&crew=Crew+A ─────────────────────────
  if (action === "crew") {
    const crewName = searchParams.get("crew")
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date()
    future.setDate(future.getDate() + 14)

    let query = supabase
      .from("segments")
      .select("*, projects(name, client), crews(name)")
      .gte("end_date", today)
      .lte("start_date", future.toISOString().slice(0, 10))
      .order("start_date")

    if (crewName) query = query.ilike("crews.name", `%${crewName}%`)

    const { data } = await query
    return NextResponse.json({ segments: data })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const { action } = body

  // ── POST action: update_milestone_status ─────────────────────────
  if (action === "update_milestone_status") {
    const { milestone_id, status, invoice_number, invoice_date, paid_date } = body

    if (!milestone_id || !status) {
      return NextResponse.json({ error: "milestone_id and status required" }, { status: 400 })
    }

    const update: any = { status }
    if (invoice_number) update.invoice_number = invoice_number
    if (invoice_date) update.invoice_date = invoice_date
    if (paid_date) update.paid_date = paid_date

    const { data, error } = await supabase
      .from("milestones")
      .update(update)
      .eq("id", milestone_id)
      .select("*, projects(name)")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, milestone: data })
  }

  // ── POST action: add_project ──────────────────────────────────────
  if (action === "add_project") {
    const { name, client } = body
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

    // Find or create client
    let clientId = null
    if (client) {
      const { data: existing } = await supabase.from("clients").select("id").ilike("name", client).single()
      if (existing) {
        clientId = existing.id
      } else {
        const { data: newClient } = await supabase.from("clients").insert({ name: client }).select("id").single()
        clientId = newClient?.id
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, client, client_id: clientId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, project: data })
  }

  // ── POST action: log_timesheet ────────────────────────────────────
  if (action === "log_timesheet") {
    const { worker_id, project_id, date, ordinary_hours, ot_hours } = body
    if (!worker_id || !date) return NextResponse.json({ error: "worker_id and date required" }, { status: 400 })

    const { data, error } = await supabase
      .from("timesheets")
      .upsert({
        worker_id,
        project_id: project_id ?? null,
        date,
        ordinary_hours: ordinary_hours ?? 9,
        ot_hours: ot_hours ?? 0,
      }, { onConflict: "worker_id,date,project_id" })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, entry: data })
  }

  // ── POST action: add_extra ────────────────────────────────────────
  if (action === "add_extra") {
    const { project_id, title, notes } = body
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 })

    const { data, error } = await supabase
      .from("extras")
      .insert({ project_id: project_id ?? null, title, status: "draft", notes: notes ?? null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, extra: data })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
