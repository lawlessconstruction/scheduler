"use client"

import { useEffect, useRef, useState } from "react"
import { amountCanBeInvoiced } from "../lib/milestone-billing"
import { asMoney, splitGst, sumExGst } from "../lib/qbo/money"

type Builder = { id: string; name: string; qboCustomerId: string | null }
type CustomerHit = { id: string; displayName: string; companyName: string | null; email: string }

function money(value: number): string {
  return value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function postJson(url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  return { status: res.status, data }
}

export function RaiseInvoiceDialog({
  jobName,
  stageName,
  amountExGst,
  builder,
  workerId,
  pin,
  milestoneId,
  onClose,
  onLinked,
  onChanged,
}: {
  jobName: string
  stageName: string
  amountExGst: number
  builder: Builder | null
  workerId: string
  pin: string
  milestoneId: string
  onClose: () => void
  onLinked: (clientId: string, qboCustomerId: string) => void
  onChanged: () => void
}) {
  const [note, setNote] = useState("")
  const [lines, setLines] = useState<{ description: string; amount: string }[]>([])
  const [query, setQuery] = useState(builder?.name ?? "")
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [remoteName, setRemoteName] = useState("")
  const [remoteEmail, setRemoteEmail] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const clientId = builder?.id ?? ""
  const linkedId = builder?.qboCustomerId ?? null

  useEffect(() => {
    if (!linkedId || !clientId) return
    let cancelled = false
    void postJson("/api/qbo/customers", { action: "status", workerId, pin, clientId }).then(({ data, status }) => {
      if (cancelled) return
      if (status === 401) {
        setError(typeof data.error === "string" ? data.error : "Sign in again, then try.")
        return
      }
      if (status >= 400) {
        setError(typeof data.error === "string" ? data.error : "Couldn't check the QuickBooks customer.")
        return
      }
      setRemoteName(typeof data.displayName === "string" ? data.displayName : "")
      setRemoteEmail(typeof data.email === "string" ? data.email : "")
    }).catch(() => {
      if (!cancelled) setError("Couldn't check the QuickBooks customer.")
    })
    return () => {
      cancelled = true
    }
  }, [linkedId, clientId, workerId, pin])

  const extras = lines
    .map((line) => ({ description: line.description.trim(), amount: asMoney(line.amount) }))
    .filter((line) => line.description !== "" || line.amount != null)
  const extraAmounts = extras.map((line) => line.amount ?? 0)
  const preview = sumExGst([amountExGst, ...extraAmounts])
  const stageOnly = splitGst(amountExGst)
  const canSend = pin.length >= 4 && !!builder?.qboCustomerId && !!remoteEmail && remoteEmail.includes("@") && amountCanBeInvoiced(amountExGst)

  async function search() {
    if (lock.current) return
    setError("")
    setHits([])
    lock.current = true
    setBusy(true)
    try {
      const { data, status } = await postJson("/api/qbo/customers", { action: "search", workerId, pin, query })
      if (status >= 400) {
        setError(typeof data.error === "string" ? data.error : "Couldn't search QuickBooks.")
        return
      }
      const customers = Array.isArray(data.customers) ? data.customers as CustomerHit[] : []
      setHits(customers)
      if (customers.length === 0) setInfo("No QuickBooks customer matches that name.")
      else setInfo("")
    } catch {
      setError("Couldn't search QuickBooks.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function link(customer: CustomerHit) {
    if (lock.current || !builder) return
    if (!customer.email || !customer.email.includes("@")) {
      setError(`${customer.displayName} has no email in QuickBooks. Add their email there, then match them again. Nothing was invoiced.`)
      return
    }
    setError("")
    lock.current = true
    setBusy(true)
    try {
      const { data, status } = await postJson("/api/qbo/customers", {
        action: "link",
        workerId,
        pin,
        clientId: builder.id,
        qboCustomerId: customer.id,
      })
      if (status >= 400) {
        setError(typeof data.error === "string" ? data.error : "Couldn't save that customer.")
        return
      }
      const email = typeof data.email === "string" ? data.email : customer.email
      if (!email || !email.includes("@")) {
        setError("This builder has no email address in QuickBooks, so the invoice was not created and nothing was sent. Add their email on the customer in QuickBooks, then try again.")
        return
      }
      setRemoteName(typeof data.displayName === "string" ? data.displayName : customer.displayName)
      setRemoteEmail(email)
      onLinked(builder.id, customer.id)
      setHits([])
      setInfo("")
    } catch {
      setError("Couldn't save that customer.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function confirm() {
    if (lock.current || !canSend) return
    const payloadLines = []
    for (const line of lines) {
      const description = line.description.trim()
      const amount = line.amount.trim()
      if (!description && !amount) continue
      const parsed = asMoney(amount)
      if (!description || parsed == null || parsed === 0) {
        setError("Each extra line needs a description and an amount.")
        return
      }
      payloadLines.push({ description, amountExGst: parsed })
    }
    lock.current = true
    setBusy(true)
    setError("")
    try {
      const { data, status } = await postJson("/api/qbo/invoice", {
        milestoneId,
        workerId,
        pin,
        note,
        lines: payloadLines,
      })
      if (data.invoiceId || status === 409) onChanged()
      if (status >= 400) {
        setError(typeof data.error === "string" ? data.error : "The invoice was not raised.")
        return
      }
      onChanged()
      onClose()
    } catch {
      setError("The invoice was not raised.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const missingEmail = remoteEmail === ""

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 160, padding: 16 }}>
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="raise-invoice-title"
        className="modal-scroll"
        style={{ width: "100%", maxWidth: 560, background: "#1e2130", border: "1px solid #2e3650", borderRadius: 14, padding: 22, color: "white" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div id="raise-invoice-title" style={{ fontSize: 22, fontWeight: 800 }}>Raise invoice</div>
            <div style={{ fontSize: 13, color: "#8899bb", marginTop: 4 }}>QuickBooks will email this to the builder.</div>
          </div>
          <button type="button" onClick={onClose} style={quietButton}>Close</button>
        </div>

        <div style={{ display: "grid", gap: 8, background: "#141a28", border: "1px solid #252f45", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <Row label="Builder" value={builder?.name ?? "No builder on this job"} />
          <Row label="Job" value={jobName} />
          <Row label="Stage" value={stageName} />
          <Row label="Amount ex GST" value={`$${money(stageOnly.exGst)}`} />
          <Row label="GST (10%)" value={`$${money(preview.gst)}`} />
          <Row label="Total" value={`$${money(preview.total)}`} strong />
        </div>

        {pin.length < 4 && <Banner>Sign out and sign in again so your PIN is available. Nothing has been invoiced.</Banner>}
        {!builder && <Banner>Link a builder to this job before raising an invoice.</Banner>}

        {builder && !linkedId && (
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="qbo-customer-search" style={labelStyle}>QuickBooks customer</label>
            <div style={{ fontSize: 12, color: "#8899bb", marginBottom: 8 }}>This builder is not matched yet. Search once, pick the customer, and Scheduler remembers it.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="qbo-customer-search" value={query} onChange={(event) => setQuery(event.target.value)} style={fieldStyle} placeholder="Builder name" />
              <button type="button" onClick={() => void search()} disabled={busy || pin.length < 4} style={primaryButton}>{busy ? "…" : "Search"}</button>
            </div>
            {info && <div style={{ fontSize: 12, color: "#8899bb", marginTop: 8 }}>{info}</div>}
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {hits.map((hit) => (
                <button key={hit.id} type="button" onClick={() => void link(hit)} disabled={busy} style={hitButton}>
                  <span style={{ fontWeight: 700 }}>{hit.displayName}</span>
                  <span style={{ color: "#8899bb" }}>{hit.companyName ? ` · ${hit.companyName}` : ""}{hit.email ? ` · ${hit.email}` : " · no email"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {builder && linkedId && (
          <div style={{ fontSize: 13, color: "#93c5fd", marginBottom: 12 }}>
            {remoteName ? `QuickBooks customer: ${remoteName}` : "Checking the QuickBooks customer…"}
            {remoteEmail ? ` · ${remoteEmail}` : ""}
          </div>
        )}
        {missingEmail && <Banner>This builder has no email address in QuickBooks, so the invoice was not created and nothing was sent. Add their email on the customer in QuickBooks, then try again.</Banner>}

        {canSend && (
          <>
            <label htmlFor="invoice-note" style={labelStyle}>Note on the invoice (optional)</label>
            <textarea id="invoice-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} style={{ ...fieldStyle, minHeight: 72, resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 8px" }}>
              <div style={labelStyle}>Extra lines (optional, ex GST)</div>
              <button type="button" onClick={() => setLines((prev) => prev.length >= 8 ? prev : [...prev, { description: "", amount: "" }])} style={quietButton}>Add line</button>
            </div>
            {lines.map((line, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, marginBottom: 8 }}>
                <input aria-label={`Extra line ${index + 1} description`} value={line.description} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} style={fieldStyle} placeholder="Description" />
                <input aria-label={`Extra line ${index + 1} amount ex GST`} value={line.amount} onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} style={fieldStyle} placeholder="0.00" inputMode="decimal" />
              </div>
            ))}
          </>
        )}

        {error && <Banner>{error}</Banner>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={quietButton}>Cancel</button>
          <button type="button" onClick={() => void confirm()} disabled={!canSend || busy} style={{ ...primaryButton, opacity: !canSend || busy ? 0.55 : 1, cursor: !canSend || busy ? "default" : "pointer" }}>
            {busy ? "Raising…" : "Raise and email"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: strong ? 16 : 14 }}>
      <span style={{ color: "#8899bb" }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 700, textAlign: "right" }}>{value}</span>
    </div>
  )
}

function Banner({ children }: { children: string }) {
  return <div style={{ background: "#2a1010", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 12px", color: "#fca5a5", fontSize: 13, marginBottom: 12, lineHeight: 1.45 }}>{children}</div>
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #3f3f46",
  background: "#111827",
  color: "white",
  fontSize: 14,
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#d4d4d8", marginBottom: 6 }

const quietButton: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #3f3f46",
  background: "#141a28",
  color: "#e4e4e7",
  fontWeight: 700,
  cursor: "pointer",
}

const primaryButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
}

const hitButton: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #2e3650",
  background: "#141a28",
  color: "white",
  cursor: "pointer",
}
