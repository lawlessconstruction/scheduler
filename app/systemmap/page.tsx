"use client"

export default function SystemMap() {
  const built = "#1d4ed8"        // Blue
  const inProgress = "#ca8a04"   // Warm amber/brown
  const toBuild = "#3f3f46"      // Dark grey dashed
  const core = "#b91c1c"         // Deep orange — distinct from blue and amber

  const builtText = "#bfdbfe"
  const builtSub = "#93c5fd"
  const nextText = "#fef08a"
  const nextSub = "#facc15"
  const coreText = "#fecaca"
  const coreSub = "#f87171"
  const planText = "#a1a1aa"
  const planSub = "#71717a"

  const nodes = [
    { id: "scheduler", label: "Scheduler", sub: "Projects · crews · segments · timeline", x: 240, y: 80, w: 220, h: 56, color: core, textColor: coreText, subColor: coreSub, status: "core" },
    { id: "projects", label: "Projects & contracts", sub: "Milestones · contract types", x: 30, y: 210, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "workers", label: "Workers & rates", sub: "Cost build-up · margins · OT", x: 195, y: 210, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "crews", label: "Crews", sub: "Availability · blended cost", x: 360, y: 210, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "clients", label: "Clients", sub: "Contact details · comms", x: 525, y: 210, w: 145, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "profitability", label: "Profitability", sub: "Margin · labour vs contract", x: 30, y: 340, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "timesheets", label: "Timesheets", sub: "Actual hours · cost per job", x: 195, y: 340, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "cashflow", label: "Cashflow timeline", sub: "Money in vs out by week", x: 360, y: 340, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "materials", label: "Materials & costs", sub: "Per project · per phase", x: 525, y: 340, w: 145, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "estbot", label: "Quoting bot", sub: "Reads plans + scope of works", x: 30, y: 470, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "estdb", label: "Estimate storage", sub: "Versions · line items · status", x: 195, y: 470, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "estui", label: "Estimation UI", sub: "Review · edit · approve", x: 360, y: 470, w: 150, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    // Quote PDF now marked as BUILT (blue)
    { id: "estpdf", label: "Quote PDF", sub: "Framing + steel · sent to builder", x: 525, y: 470, w: 145, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "db", label: "Supabase database", sub: "projects · segments · milestones · workers · timesheets · estimates · costs · views", x: 30, y: 590, w: 640, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "api", label: "Context API", sub: "Rates · history · availability", x: 30, y: 710, w: 185, h: 56, color: built, textColor: builtText, subColor: builtSub, status: "built" },
    { id: "botchat", label: "Bot chat interface", sub: "Natural language · actions", x: 240, y: 710, w: 185, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    { id: "webhooks", label: "Webhooks", sub: "Triggers · notifications", x: 450, y: 710, w: 185, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    { id: "payroll", label: "Payroll export", sub: "Timesheet to wages", x: 30, y: 840, w: 130, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    { id: "clientreports", label: "Client reports", sub: "Progress · invoicing", x: 175, y: 840, w: 130, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    { id: "accounting", label: "Accounting", sub: "Xero · invoices", x: 320, y: 840, w: 130, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    { id: "extras", label: "Extras billing", sub: "Hourly · overtime", x: 465, y: 840, w: 130, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    // Mobile app moved left so it doesn't clip
    { id: "mobile", label: "Mobile app", sub: "Crew bosses", x: 605, y: 840, w: 65, h: 56, color: toBuild, textColor: planText, subColor: planSub, status: "tobuild" },
    { id: "goal", label: "AI business operating system", sub: "Schedule · cashflow · profitability · estimation · crew · quoting — all connected", x: 30, y: 970, w: 640, h: 72, color: core, textColor: coreText, subColor: coreSub, status: "core" },
  ]

  const arrows = [
    { x1: 300, y1: 136, x2: 105, y2: 210 },
    { x1: 330, y1: 136, x2: 270, y2: 210 },
    { x1: 360, y1: 136, x2: 435, y2: 210 },
    { x1: 390, y1: 136, x2: 597, y2: 210 },
    { x1: 105, y1: 266, x2: 105, y2: 340 },
    { x1: 270, y1: 266, x2: 270, y2: 340 },
    { x1: 435, y1: 266, x2: 435, y2: 340 },
    { x1: 105, y1: 396, x2: 105, y2: 470 },
    { x1: 270, y1: 266, x2: 105, y2: 470 },
    { x1: 105, y1: 526, x2: 200, y2: 590 },
    { x1: 270, y1: 526, x2: 300, y2: 590 },
    { x1: 435, y1: 526, x2: 400, y2: 590 },
    { x1: 597, y1: 396, x2: 597, y2: 590 },
    { x1: 200, y1: 646, x2: 122, y2: 710 },
    { x1: 350, y1: 646, x2: 332, y2: 710 },
    { x1: 500, y1: 646, x2: 542, y2: 710 },
    { x1: 122, y1: 710, x2: 105, y2: 526 },
    { x1: 122, y1: 766, x2: 95, y2: 840 },
    { x1: 122, y1: 766, x2: 240, y2: 840 },
    { x1: 332, y1: 766, x2: 385, y2: 840 },
    { x1: 542, y1: 766, x2: 530, y2: 840 },
    { x1: 542, y1: 766, x2: 637, y2: 840 },
    { x1: 350, y1: 896, x2: 350, y2: 970 },
  ]

  const legend = [
    { color: built, label: "Built", dashed: false, bg: built + "33" },
    { color: inProgress, label: "Next to build", dashed: false, bg: inProgress + "33" },
    { color: toBuild, label: "Planned", dashed: true, bg: "transparent" },
    { color: core, label: "Core / Goal", dashed: false, bg: core + "33" },
  ]

  return (
    <div style={{ background: "#000", minHeight: "100vh", padding: 32, color: "white", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Lawless Construction — System Map</h1>
            <p style={{ color: "#71717a", marginTop: 8, fontSize: 14 }}>Everything we are building to run the company and power the AI bot.</p>
          </div>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#1e2535", border: "1.5px solid #2e3a58", borderRadius: 999, color: "#c8d4f0", fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
            ← Scheduler
          </a>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap", background: "#0a0a0a", border: "1px solid #222", borderRadius: 10, padding: "14px 18px" }}>
          {legend.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 20, borderRadius: 4, background: s.bg, border: `2px ${s.dashed ? "dashed" : "solid"} ${s.color}` }} />
              <span style={{ fontSize: 13, color: "#e4e4e7", fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 14, padding: 20, overflowX: "auto" }}>
          <svg width="100%" viewBox="0 0 700 1080" style={{ minWidth: 600 }}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </marker>
            </defs>
            {arrows.map((a, i) => (
              <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#2a2a2a" strokeWidth="1" markerEnd="url(#arr)" />
            ))}
            {nodes.map((n) => (
              <g key={n.id}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                  fill={n.color} fillOpacity={n.status === "tobuild" ? 0.04 : 0.2}
                  stroke={n.color} strokeWidth={n.status === "tobuild" ? 1 : 1.5}
                  strokeDasharray={n.status === "tobuild" ? "5 3" : undefined}
                />
                <text x={n.x + n.w / 2} y={n.sub ? n.y + n.h * 0.38 : n.y + n.h / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={n.textColor} fontSize="12" fontWeight="600" fontFamily="system-ui, sans-serif">
                  {n.label}
                </text>
                {n.sub && (
                  <text x={n.x + n.w / 2} y={n.y + n.h * 0.68}
                    textAnchor="middle" dominantBaseline="central"
                    fill={n.subColor} fontSize="10" fontFamily="system-ui, sans-serif">
                    {n.sub.length > 42 ? n.sub.slice(0, 42) + "..." : n.sub}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 32 }}>
          {[
            { title: "Built", color: built, items: ["Gantt scheduler with drag/resize","Projects, contracts & milestones","Clients with contact details","Worker cost build-up & margins","Timesheets with split-day support","Project profitability (labour + materials)","Cashflow timeline + weekly strip","Materials & costs with payment schedules","Estimate storage + UI (line items, versions)","Quoting bot (reads plans + scope)","Quote PDF (framing + steel)","Context API (/api/context)","Supabase database with views"] },
            { title: "Next to build", color: toBuild, items: ["Bot chat interface","Extras & hourly billing","Payroll export","Xero / accounting integration","Client reports","Mobile app for crew bosses","Webhooks & notifications"] },
          ].map((section) => (
            <div key={section.title} style={{ background: "#0a0a0a", border: `1px solid ${section.color}55`, borderRadius: 10, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: section.color }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#e4e4e7" }}>{section.title}</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {section.items.map((item) => (
                  <li key={item} style={{ fontSize: 13, color: "#71717a", paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: section.color }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, background: "#1a0000", border: "1px solid #b91c1c", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fecaca", marginBottom: 8 }}>The goal</div>
          <div style={{ fontSize: 14, color: "#fca5a5", lineHeight: 1.7 }}>An AI operating system that understands the full business in real time — schedule, cashflow, profitability, estimation, crew, and quoting.</div>
          <div style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>Most profitable carpentry business in Australia.</div>
        </div>


      </div>
    </div>
  )
}
