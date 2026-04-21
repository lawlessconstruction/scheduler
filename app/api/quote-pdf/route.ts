import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const estimateId = searchParams.get("estimateId")

  if (!estimateId) {
    return NextResponse.json({ error: "estimateId required" }, { status: 400 })
  }

  const [estRes, itemsRes] = await Promise.all([
    supabase.from("estimates").select("*").eq("id", estimateId).single(),
    supabase.from("estimate_items").select("*").eq("estimate_id", estimateId).order("sort_order"),
  ])

  if (estRes.error || !estRes.data) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 })
  }

  const estimate = estRes.data
  const items = itemsRes.data ?? []

  const [projectRes, clientRes] = await Promise.all([
    estimate.project_id
      ? supabase.from("projects").select("*").eq("id", estimate.project_id).single()
      : Promise.resolve({ data: null }),
    estimate.client_id
      ? supabase.from("clients").select("*").eq("id", estimate.client_id).single()
      : Promise.resolve({ data: null }),
  ])

  const project = projectRes.data
  const client = clientRes.data

  const tmpDir = os.tmpdir()
  const dataFile = path.join(tmpDir, "quote_data_" + Date.now() + ".json")
  const outFile = path.join(tmpDir, "quote_" + Date.now() + ".pdf")
  const logoFile = path.join(process.cwd(), "public", "lawless-logo.png")
  const pyScript = path.join(process.cwd(), "scripts", "generate_quote.py")

  fs.writeFileSync(dataFile, JSON.stringify({
    estimate,
    items,
    project,
    client,
    logo_path: logoFile,
    out_path: outFile,
  }))

  try {
    execSync("python3 \"" + pyScript + "\" \"" + dataFile + "\"", { timeout: 30000 })
    const pdfBuffer = fs.readFileSync(outFile)

    fs.unlinkSync(dataFile)
    fs.unlinkSync(outFile)

    const projectName = (project as any)?.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? "quote"
    const filename = "Lawless_Construction_" + projectName + "_Quote_v" + estimate.version + ".pdf"

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"" + filename + "\"",
      },
    })
  } catch (err: any) {
    console.error("PDF generation error:", err?.message ?? err)
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile)
    return NextResponse.json({ error: "PDF generation failed", detail: err?.message }, { status: 500 })
  }
}
