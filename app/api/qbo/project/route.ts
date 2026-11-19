import { NextRequest, NextResponse } from "next/server"
import { assertCanRaise, isFailure, readActor } from "../../../../src/lib/qbo/access"
import { QboApiError } from "../../../../src/lib/qbo/api"
import { schemaHint, serviceClient } from "../../../../src/lib/qbo/db"
import { createProject, linkChosenProject, previewProject } from "../../../../src/lib/qbo/projects"
import { qboConfigured, QboAuthError } from "../../../../src/lib/qbo/tokens"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: Record<string, unknown>, status = 200) {
  if (typeof body.error === "string") {
    const hint = schemaHint(body.error)
    if (hint) body = { ...body, error: hint }
  }
  if (typeof body.message === "string") {
    const hint = schemaHint(body.message)
    if (hint) body = { ...body, message: hint }
  }
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const db = serviceClient()
  if (!db) return json({ error: "QuickBooks projects can't be loaded right now." }, 500)

  let body: Record<string, unknown>
  try {
    const parsed = await req.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad")
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: "That didn't come through. Try again." }, 400)
  }

  const actor = await readActor(db, body)
  if (isFailure(actor)) return json({ error: actor.error }, actor.status)
  const denied = assertCanRaise(actor)
  if (denied) return json({ error: denied.error }, denied.status)

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
  if (!UUID.test(projectId)) return json({ error: "Pick a job." }, 400)
  const action = body.action
  const ensuring = action === "ensure"

  if (!qboConfigured()) {
    const message = "QuickBooks isn't set up, so the project wasn't created. You can create it from Raise invoice once QuickBooks is connected."
    if (ensuring) return json({ created: false, linked: false, qboProjectId: null, qboProjectName: null, message }, 200)
    return json({ error: "QuickBooks isn't set up." }, 500)
  }

  try {
    if (action === "preview") {
      const result = await previewProject(db, projectId)
      return json(result.body, result.status)
    }
    if (action === "link") {
      const qboProjectId = typeof body.qboProjectId === "string" ? body.qboProjectId : ""
      const result = await linkChosenProject(db, projectId, qboProjectId)
      return json(result.body, result.status)
    }
    if (action === "create" || action === "ensure") {
      const result = await createProject(db, projectId)
      if (ensuring && result.status >= 400) {
        const message = result.body.message || "The QuickBooks project wasn't created. You can create it from Raise invoice."
        return json({ ...result.body, created: false, message }, 200)
      }
      return json(result.body, result.status)
    }
    return json({ error: "That action isn't available." }, 400)
  } catch (err) {
    const message = err instanceof QboAuthError || err instanceof QboApiError
      ? err.message
      : "QuickBooks projects could not be loaded."
    if (ensuring) {
      return json({
        created: false,
        linked: false,
        qboProjectId: null,
        qboProjectName: null,
        message: `The QuickBooks project wasn't created. ${message} You can create it from Raise invoice.`,
      }, 200)
    }
    const status = err instanceof QboAuthError || err instanceof QboApiError ? err.status : 502
    return json({ error: message }, status)
  }
}
