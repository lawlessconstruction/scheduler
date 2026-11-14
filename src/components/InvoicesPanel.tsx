"use client"

import { useEffect, useState } from "react"
import { asMoney } from "../lib/qbo/money"

type InvoiceRow = {
  milestoneId: string
  job: string
  client: string | null
  stage: string
  amountExGst: number | null
  docNumber: string | null
  raisedBy: string | null
  sentAt: string | null
  emailed: boolean | null
  paid: boolean | null
  balance: number | null
}

function money(value: number | null): string {
  if (value == null) return "—"
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function when(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function flag(value: boolean | null, yes: string, no: string): string {
  if (value === true) return yes
  if (value === false) return no
  return "—"
}

export function InvoicesPanel({
  workerId,
  pin,
  onClose,
}: {
  workerId: string
  pin: string
  onClose: () => void
}) {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [error, setError] = useState("")
  const [qboError, setQboError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/qbo/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workerId, pin }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({})) as { invoices?: unknown; error?: unknown; qboError?: unknown }
      if (cancelled) return
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't load invoices.")
        setRows([])
        return
      }
      const invoices = Array.isArray(data.invoices) ? data.invoices : []
      setRows(invoices.map((row) => {
        const item = row as InvoiceRow
        return { ...item, amountExGst: asMoney(item.amountExGst), balance: asMoney(item.balance) }
      }))
      setQboError(typeof data.qboError === "string" ? data.qboError : "")
    }).catch(() => {
      if (!cancelled) setError("Couldn't load invoices.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [workerId, pin])

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "stretch", justifyContent: "center", zIndex: 120, padding: 16 }}>
      <div onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="invoices-title" className="modal-frame" style={{ width: "100%", maxWidth: "calc(100vw - 32px)", background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, color: "white", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #252f45", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div id="invoices-title" style={{ fontSize: 24, fontWeight: 900 }}>Invoices</div>
            <div style={{ fontSize: 13, color: "#6b7a9a", marginTop: 2 }}>Raised from Scheduler. Emailed and paid come from QuickBooks.</div>
          </div>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2e3650", background: "#141a28", color: "#8899bb", fontWeight: 700, cursor: "pointer" }}>Close</button>
        </div>
        <div className="modal-body-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 28px 24px" }}>
          {loading && <div style={{ color: "#8899bb", padding: 20 }}>Loading…</div>}
          {error && <div style={{ color: "#fca5a5", padding: 12 }}>{error}</div>}
          {qboError && <div style={{ color: "#fbbf24", fontSize: 13, marginBottom: 12 }}>{qboError}</div>}
          {!loading && !error && rows.length === 0 && <div style={{ color: "#8899bb", padding: 20 }}>No invoices have been raised from Scheduler yet.</div>}
          {rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Job", "Stage", "Amount ex GST", "Number", "Raised by", "Sent", "Emailed", "Paid"].map((heading) => (
                      <th key={heading} style={{ textAlign: "left", color: "#6b7a9a", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", padding: "8px 10px", borderBottom: "1px solid #252f45" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.milestoneId}>
                      <td style={cell}>
                        <div style={{ fontWeight: 700 }}>{row.job}</div>
                        {row.client && <div style={{ color: "#6b7a9a", fontSize: 12 }}>{row.client}</div>}
                      </td>
                      <td style={cell}>{row.stage}</td>
                      <td style={cell}>{money(row.amountExGst)}</td>
                      <td style={cell}>{row.docNumber || "—"}</td>
                      <td style={cell}>{row.raisedBy || "—"}</td>
                      <td style={cell}>{when(row.sentAt)}</td>
                      <td style={{ ...cell, color: row.emailed === true ? "#4ade80" : row.emailed === false ? "#fbbf24" : "#8899bb" }}>{flag(row.emailed, "Emailed", "Not emailed")}</td>
                      <td style={{ ...cell, color: row.paid === true ? "#4ade80" : row.paid === false ? "#fbbf24" : "#8899bb" }}>{flag(row.paid, "Paid", "Unpaid")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const cell: React.CSSProperties = { padding: "12px 10px", borderBottom: "1px solid #1a2035", verticalAlign: "top" }
