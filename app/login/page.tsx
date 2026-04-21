"use client"

import { useState } from "react"
import { supabase } from "../../src/lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || pin.length < 4) {
      setError("Enter your email and 4-digit PIN")
      return
    }
    setLoading(true)
    setError("")

    const { data, error: dbError } = await supabase
      .from("workers")
      .select("id, name, app_role, crew_id, pin, email")
      .ilike("email", email.trim())
      .single()

    if (dbError || !data) {
      setError("Email not found. Ask your boss to add you.")
      setLoading(false)
      return
    }

    if (data.pin !== pin) {
      setError("Wrong PIN. Try again.")
      setLoading(false)
      return
    }

    const user = { id: data.id, name: data.name, app_role: data.app_role ?? "worker", crew_id: data.crew_id }
    localStorage.setItem("lc_user", JSON.stringify(user))
    window.location.href = "/"
  }

  function handlePinKey(digit: string) {
    if (pin.length < 4) setPin(p => p + digit)
  }

  function handlePinClear() {
    setPin(p => p.slice(0, -1))
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", padding: 24,
    }}>
      {/* Logo */}
      <img src="/lawless-logo.png" alt="Lawless Construction"
        style={{ height: 56, width: "auto", objectFit: "contain", marginBottom: 40 }} />

      <div style={{
        width: "100%", maxWidth: 380, background: "#1e2535",
        border: "1px solid #2e3a58", borderRadius: 16, padding: 32,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f0f4ff", marginBottom: 6 }}>Sign in</div>
        <div style={{ fontSize: 13, color: "#6b7a9a", marginBottom: 28 }}>Lawless Construction — Operations</div>

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899bb", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError("") }}
            placeholder="your@email.com"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              background: "#111827", border: "1.5px solid #2e3a58",
              color: "#f0f4ff", fontSize: 15, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* PIN display */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8899bb", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>PIN</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 56, height: 56, borderRadius: 12,
                background: pin.length > i ? "#2563eb" : "#111827",
                border: `2px solid ${pin.length > i ? "#3b82f6" : "#2e3a58"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, color: "white", transition: "all 0.1s",
              }}>
                {pin.length > i ? "●" : ""}
              </div>
            ))}
          </div>

          {/* PIN pad */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {["1","2","3","4","5","6","7","8","9"].map(d => (
              <button key={d} type="button" onClick={() => handlePinKey(d)}
                style={{
                  padding: "18px", borderRadius: 12, fontSize: 20, fontWeight: 700,
                  background: "#141a28", border: "1.5px solid #2e3a58", color: "#f0f4ff",
                  cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseDown={e => (e.currentTarget.style.background = "#1e2a45")}
                onMouseUp={e => (e.currentTarget.style.background = "#141a28")}
              >{d}</button>
            ))}
            <div />
            <button type="button" onClick={() => handlePinKey("0")}
              style={{
                padding: "18px", borderRadius: 12, fontSize: 20, fontWeight: 700,
                background: "#141a28", border: "1.5px solid #2e3a58", color: "#f0f4ff",
                cursor: "pointer",
              }}>0</button>
            <button type="button" onClick={handlePinClear}
              style={{
                padding: "18px", borderRadius: 12, fontSize: 20,
                background: "#141a28", border: "1.5px solid #2e3a58", color: "#6b7a9a",
                cursor: "pointer",
              }}>⌫</button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#2a1010", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button type="button" onClick={handleLogin} disabled={loading || pin.length < 4 || !email.trim()}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, fontSize: 16, fontWeight: 800,
            background: pin.length === 4 && email.trim() ? "linear-gradient(135deg, #1e3a6e, #2563eb)" : "#1a2035",
            border: "1.5px solid #2563eb", color: pin.length === 4 && email.trim() ? "white" : "#4a6080",
            cursor: pin.length === 4 && email.trim() ? "pointer" : "default",
            transition: "all 0.2s",
          }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: "#2e3a58" }}>
        Lawless Construction Operations System
      </div>
    </div>
  )
}
