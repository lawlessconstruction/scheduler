import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { WORKER_AUTH_COLUMNS } from "../../../src/lib/ask/columns"
import { runAskTool, type AskReader } from "../../../src/lib/ask/data"
import { melbourneToday } from "../../../src/lib/ask/dates"
import { modelExtras, resolveAskModel } from "../../../src/lib/ask/model"
import {
  escapeLike,
  pinsMatch,
  sanitizeHistory,
  takeToken,
  toAskUser,
  type AskUser,
} from "../../../src/lib/ask/policy"
import { systemPrompt } from "../../../src/lib/ask/prompt"

// Crew Ask. Read-only. The browser sends the same email/PIN login the app
// already uses; this route checks the PIN again and reads app_role from the
// database. There is no Supabase Auth session in the app today. If a real
// auth JWT is presented, it is checked first.
//
// Nothing here is written to the logs: no question, no PIN, no tool payload.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const QUESTION_LIMIT = 20
const QUESTION_WINDOW_MS = 10 * 60 * 1000
const PIN_FAIL_LIMIT = 8
const PIN_FAIL_IP_LIMIT = 40
const GLOBAL_LIMIT = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const buckets = new Map<string, number[]>()

const TOOLS = [
  {
    name: "lookup_schedule",
    description: "Read-only. Jobs booked on the board in a date range: street address (the project name), client, whether the job is pinned or completed, crew, booking notes, day notes, and the names of people on those jobs. A crew member only gets jobs their crew is on, plus the other people on those same jobs. A boss can ask about one person or the whole company. If the result sets board_empty, the board has nothing in that short window: call lookup_hours for hours_from to hours_to and answer from what was last logged. This is not how you list current or starred jobs, and it is not the life of a job. For how long a named job has been going, when it started, or the total hours on it, call job_summary. Unwon quotes are not on the board; call lookup_quotes for those.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD, Australia/Melbourne." },
        to: { type: "string", description: "End date YYYY-MM-DD, inclusive." },
        job_query: { type: "string", description: "Optional part of a street address, e.g. Balmoral." },
        person: { type: "string", description: "Boss only. A person's name. Ignored for a crew member." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "lookup_hours",
    description: "Read-only timesheet hours: ordinary hours, overtime, leave, and the job name. Company results include last_logged and, for each day, sites with how many people were there. A crew member can only see their own hours. A boss can ask for one person, or a company total of 31 days or fewer. No pay rates. Use this after board_empty to say what was last logged. This cannot filter by job. For the hours on one named street, call job_summary. When a job is named, do not call this for the asker's own timesheet.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD, Australia/Melbourne." },
        to: { type: "string", description: "End date YYYY-MM-DD, inclusive." },
        person: { type: "string", description: "Boss only. Omit for a company total. For a crew member this is ignored unless it is their own name; anyone else's hours are refused." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "lookup_projects",
    description: "Read-only list of jobs. Returns the street (name), client, pinned, completed, and completed_at. Current, starred, and with the star mean pinned true, archived false, and completed false. A completed job is not current. Do not use a date search for this. A crew member only sees jobs their crew is booked on and jobs they have logged hours on. A boss sees the whole company. No pay, no invoices. Unwon quotes are left out; call lookup_quotes for those.",
    input_schema: {
      type: "object",
      properties: {
        pinned: { type: "boolean", description: "True for current, starred, or with the star. False to leave starred jobs out." },
        archived: { type: "boolean", description: "True for archived jobs only. False to leave archived jobs out. Omit to include both." },
        completed: { type: "boolean", description: "True for finished jobs. False to leave finished jobs out. A completed job is not current." },
        name: { type: "string", description: "Optional part of a street address, e.g. Vista." },
      },
    },
  },
  {
    name: "job_summary",
    description: "Read-only summary of one job, with no date window. Matches a street the same way as lookup_projects. Returns pinned, completed, completed_at, how many bookings, the first and last booking dates, the first and last day hours were logged, ordinary hours, overtime, total hours, days worked, and how many people. A boss also gets hours by crew and by person. A crew member only gets a job their crew is booked on or they have logged hours on, and only the totals, not anyone's individual hours. Use this for how long a job has been going, when it started, and the total hours on that street. If one job matches, answer from it and do not ask which job. If more than one job matches, ask for more of the street. Do not fall back to the asker's own timesheet. Unwon quotes are left out; call lookup_quotes for those.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Part of the street address, e.g. Hedderwick." },
      },
      required: ["name"],
    },
  },
  {
    name: "lookup_quotes",
    description: "Read-only list of open quotes that have not been won. Returns the street address, client, quote number, quote date, how many priced stages, and pdf_url when a PDF is saved. No dollar amounts. Boss only. Call this when the question is about quotes or a quote PDF, including when they do not name a street. If one quote matches, use it and do not ask which one. If pdf_url is set and they want the PDF, reply with that link. Do not use lookup_projects, lookup_schedule, lookup_hours, or job_summary for a quote that has not been won.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Optional part of a street address, e.g. Kent." },
      },
    },
  },
]

type ContentBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown }

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function readerFor(db: SupabaseClient): AskReader {
  return { from: (table) => db.from(table) as unknown as ReturnType<AskReader["from"]> }
}

function json(body: { answer?: string; error?: string; configured?: boolean }, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
}

async function userFromToken(db: SupabaseClient, token: string): Promise<AskUser | null> {
  const { data, error } = await db.auth.getUser(token)
  const email = data.user?.email?.trim()
  if (error || !email) return null
  const found = await db
    .from("workers")
    .select(WORKER_AUTH_COLUMNS)
    .ilike("email", escapeLike(email))
    .maybeSingle()
  if (found.error || !found.data) return null
  const row = found.data as { id: string; name: string; app_role: string | null; crew_id: string | null }
  return toAskUser(row)
}

async function identify(req: NextRequest, body: Record<string, unknown>, db: SupabaseClient): Promise<AskUser | Response> {
  const header = req.headers.get("authorization") ?? ""
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim()
    if (token) {
      const fromToken = await userFromToken(db, token)
      if (fromToken) return fromToken
    }
  }

  const workerId = typeof body.workerId === "string" ? body.workerId.trim() : ""
  const pin = typeof body.pin === "string" ? body.pin : ""
  if (!UUID.test(workerId) || !pin) return json({ error: "Sign in again, then ask." }, 401)

  const found = await db.from("workers").select(WORKER_AUTH_COLUMNS).eq("id", workerId).maybeSingle()
  if (found.error || !found.data) return json({ error: "Sign in again, then ask." }, 401)
  const row = found.data as { id: string; name: string; app_role: string | null; crew_id: string | null; pin: string | null }
  if (!pinsMatch(row.pin, pin)) {
    const now = Date.now()
    const ipBlocked = !takeToken(buckets, `pin-ip:${clientIp(req)}`, PIN_FAIL_IP_LIMIT, QUESTION_WINDOW_MS, now)
    const userBlocked = !takeToken(buckets, `pin-user:${workerId}`, PIN_FAIL_LIMIT, QUESTION_WINDOW_MS, now)
    if (ipBlocked || userBlocked) return json({ error: "Too many tries. Wait a few minutes." }, 429)
    return json({ error: "That PIN doesn't match. Try again." }, 401)
  }
  return toAskUser(row)
}

function answerFrom(blocks: ContentBlock[]): string {
  return blocks
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

function shortAnswer(text: string): string {
  if (text.length <= 1200) return text
  return `${text.slice(0, 1200).trimEnd()}…`
}

async function postModel(payload: Record<string, unknown>, apiKey: string): Promise<{ status: number; body: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  })
  const body = await res.text()
  return { status: res.status, body }
}

export async function GET() {
  return json({ configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) })
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return json({ error: "Ask isn't switched on." }, 503)

  const db = serviceClient()
  if (!db) return json({ error: "Ask can't reach the schedule right now." }, 500)

  let raw = ""
  try {
    raw = await req.text()
  } catch {
    return json({ error: "That didn't come through. Try again." }, 400)
  }
  if (raw.length > 20_000) return json({ error: "That question is too long." }, 413)

  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad")
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: "That didn't come through. Try again." }, 400)
  }

  const identified = await identify(req, body, db)
  if (identified instanceof Response) return identified
  const user = identified

  const now = Date.now()
  if (!takeToken(buckets, "ask:all", GLOBAL_LIMIT, QUESTION_WINDOW_MS, now)) {
    return json({ error: "Ask is busy. Try again in a few minutes." }, 429)
  }
  if (!takeToken(buckets, `ask:${user.id}`, QUESTION_LIMIT, QUESTION_WINDOW_MS, now)) {
    return json({ error: "Too many questions. Wait a few minutes and try again." }, 429)
  }

  const history = sanitizeHistory(body.messages)
  if (!history.ok) return json({ error: history.error }, 400)

  const reader = readerFor(db)
  const model = resolveAskModel(process.env.ANTHROPIC_MODEL)
  const extras = modelExtras(model)
  const today = melbourneToday()
  let messages: unknown[] = history.messages.map((turn) => ({ role: turn.role, content: turn.content }))
  let answer = ""

  try {
    for (let round = 0; round < 3; round++) {
      const payload: Record<string, unknown> = {
        model,
        max_tokens: 500,
        system: systemPrompt(user, today),
        tools: TOOLS,
        messages,
        ...extras,
      }
      let result = await postModel(payload, apiKey)
      if (result.status === 400 && Object.keys(extras).length > 0 && /thinking|output_config|effort/i.test(result.body)) {
        const rest = { ...payload }
        delete rest.thinking
        delete rest.output_config
        result = await postModel(rest, apiKey)
      }
      if (result.status === 429 || result.status === 529) return json({ error: "Ask is busy. Try again in a minute." }, 429)
      if (result.status < 200 || result.status >= 300) {
        console.error("ask model request failed", result.status)
        return json({ error: "Couldn't get an answer. Try again." }, 502)
      }

      let parsed: { content?: ContentBlock[] }
      try {
        parsed = JSON.parse(result.body) as { content?: ContentBlock[] }
      } catch {
        console.error("ask model request failed", result.status)
        return json({ error: "Couldn't get an answer. Try again." }, 502)
      }
      const blocks = Array.isArray(parsed.content) ? parsed.content : []
      const toolUses = blocks.filter((block) => block.type === "tool_use")
      if (toolUses.length === 0 || toolUses.some((block) => !block.id)) {
        answer = answerFrom(blocks)
        break
      }

      const results = []
      for (const tool of toolUses) {
        const output = await runAskTool(reader, user, tool.name, tool.input)
        let content = JSON.stringify(output)
        if (content.length > 14_000) content = JSON.stringify({ error: "Too much matched. Ask about fewer days." })
        results.push({ type: "tool_result", tool_use_id: tool.id, content })
      }
      messages = [
        ...messages,
        { role: "assistant", content: blocks },
        { role: "user", content: results },
      ]
      answer = answerFrom(blocks)
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    if (name === "TimeoutError" || name === "AbortError") {
      return json({ error: "That took too long. Try a shorter question." }, 504)
    }
    console.error("ask model request failed")
    return json({ error: "Couldn't get an answer. Try again." }, 502)
  }

  if (!answer) answer = "I couldn't find that. Try naming the day or the street."
  return json({ answer: shortAnswer(answer) })
}
