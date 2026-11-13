import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// The quotes bucket is private, so the browser cannot read the PDF with the
// anon key. This returns a short-lived signed URL for the path stored on the
// project. The caller names a project id, never a storage path.

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIGNED_URL_SECONDS = 120

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function json(body: { url?: string; error?: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
}

export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get("projectId")?.trim() ?? ""
  if (!UUID.test(projectId)) return json({ error: "projectId required" }, 400)

  const db = serviceClient()
  if (!db) return json({ error: "Quotes can't be opened right now." }, 500)

  const found = await db.from("projects").select("id, quote_pdf_path").eq("id", projectId).maybeSingle()
  if (found.error || !found.data) return json({ error: "Quote not found" }, 404)

  const stored = typeof found.data.quote_pdf_path === "string" ? found.data.quote_pdf_path.trim() : ""
  if (!stored || stored.includes("..") || stored.startsWith("/")) {
    return json({ error: "No quote file" }, 404)
  }

  const signed = await db.storage.from("quotes").createSignedUrl(stored, SIGNED_URL_SECONDS)
  if (signed.error || !signed.data?.signedUrl) return json({ error: "Could not open the quote" }, 500)
  return json({ url: signed.data.signedUrl })
}
