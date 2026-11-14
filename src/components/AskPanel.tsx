"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { askParts } from "../lib/ask/links"
import { supabase } from "../lib/supabase"

export type AskPerson = {
  id: string
  name: string
  app_role: string
}

type ChatMessage = { role: "user" | "assistant"; content: string; error?: boolean }

const WORKER_PROMPTS = [
  "What job am I on tomorrow?",
  "Who's on with me next week?",
  "How many hours did I log last week?",
]

const BOSS_PROMPTS = [
  "What's on tomorrow?",
  "Which jobs have the star?",
  "Who's on site next week?",
  "How many hours did we log last week?",
]

export function AskButton({ variant, onClick }: { variant: "landing" | "header" | "float"; onClick: () => void }) {
  if (variant === "landing") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          padding: "16px 18px",
          borderRadius: 16,
          border: "1.5px solid #2563eb",
          background: "#121a2b",
          color: "#f0f4ff",
          fontSize: 17,
          fontWeight: 800,
          cursor: "pointer",
          marginBottom: 12,
          touchAction: "manipulation",
        }}
      >
        Ask
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#93c5fd", marginTop: 4 }}>
          Jobs, who’s on site, your hours
        </span>
      </button>
    )
  }
  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid #1e3a6e",
          background: "#0a0f1e",
          color: "#f0f4ff",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          touchAction: "manipulation",
        }}
      >
        Ask
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask"
      style={{
        position: "fixed",
        right: 16,
        bottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 80,
        padding: "14px 18px",
        borderRadius: 999,
        border: "1px solid #2563eb",
        background: "#0a0f1e",
        color: "#f0f4ff",
        fontWeight: 800,
        fontSize: 15,
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        touchAction: "manipulation",
      }}
    >
      Ask
    </button>
  )
}

export function AskPanel({
  open,
  onClose,
  user,
  pin,
  onPinChange,
}: {
  open: boolean
  onClose: () => void
  user: AskPerson
  pin: string
  onPinChange: (pin: string) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [pinError, setPinError] = useState("")
  const [enteredPin, setEnteredPin] = useState("")
  const [box, setBox] = useState<{ top: number; height: number } | null>(null)
  const sendingRef = useRef(false)
  // Each question records this number. New chat bumps it so a reply
  // that arrives afterwards is dropped and does not join the fresh thread.
  const threadGeneration = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const prompts = user.app_role === "boss" ? BOSS_PROMPTS : WORKER_PROMPTS

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const viewport = window.visualViewport
    const apply = () => {
      if (!viewport) return
      setBox({ top: viewport.offsetTop, height: viewport.height })
    }
    apply()
    viewport?.addEventListener("resize", apply)
    viewport?.addEventListener("scroll", apply)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      viewport?.removeEventListener("resize", apply)
      viewport?.removeEventListener("scroll", apply)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending, open])

  useEffect(() => {
    if (pin) setEnteredPin("")
  }, [pin])

  async function sendText(text: string) {
    const question = text.trim()
    if (!question || sendingRef.current) return
    if (pin.length < 4) return
    if (question.length > 500) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Ask a shorter question.", error: true }])
      return
    }
    // The ref flips before any await. Two taps in the same moment both
    // read the old state, so state alone cannot lock the button.
    const generation = threadGeneration.current
    sendingRef.current = true
    setSending(true)
    setDraft("")
    const history = [...messages.filter((message) => !message.error), { role: "user" as const, content: question }]
    setMessages((prev) => [...prev, { role: "user", content: question }])
    try {
      let token: string | undefined
      try {
        const { data } = await supabase.auth.getSession()
        token = data.session?.access_token || undefined
      } catch {
        token = undefined
      }
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          workerId: user.id,
          pin,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      })
      const data = await res.json().catch(() => null) as { answer?: unknown; error?: unknown } | null
      if (threadGeneration.current !== generation) return
      if (res.status === 401) {
        onPinChange("")
        setDraft(question)
        setPinError(typeof data?.error === "string" ? data.error : "That PIN doesn't match.")
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === "user" && last.content === question) next.pop()
          return next
        })
        return
      }
      if (!res.ok || typeof data?.answer !== "string") {
        const message = typeof data?.error === "string" ? data.error : "No answer came back. Try again."
        setMessages((prev) => [...prev, { role: "assistant", content: message, error: true }])
        return
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer as string }])
    } catch {
      if (threadGeneration.current !== generation) return
      setMessages((prev) => [...prev, { role: "assistant", content: "No answer came back. Try again.", error: true }])
    } finally {
      if (threadGeneration.current !== generation) return
      sendingRef.current = false
      setSending(false)
    }
  }

  function startNewChat() {
    const nothingToClear = messages.length === 0 && draft.trim() === "" && pinError === ""
    if (nothingToClear && !sendingRef.current) return
    threadGeneration.current += 1
    sendingRef.current = false
    setSending(false)
    setMessages([])
    setDraft("")
    setPinError("")
  }

  function pushPinDigit(digit: string) {
    setPinError("")
    const next = `${enteredPin}${digit}`.slice(0, 4)
    if (next.length === 4) {
      setEnteredPin("")
      onPinChange(next)
      return
    }
    setEnteredPin(next)
  }

  if (!open) return null

  const newChatDisabled = sending || (messages.length === 0 && draft.trim() === "" && pinError === "")

  const overlayStyle: CSSProperties = box
    ? { position: "fixed", top: box.top, left: 0, width: "100%", height: box.height, zIndex: 240 }
    : { position: "fixed", inset: 0, zIndex: 240 }

  return (
    <div style={{ ...overlayStyle, background: "rgba(0,0,0,0.62)" }} onClick={onClose} role="presentation">
      <style>{`
        .ask-frame {
          height: 100%;
          display: flex;
          justify-content: flex-end;
          box-sizing: border-box;
          padding: 16px;
          min-height: 0;
        }
        .ask-sheet {
          width: min(440px, 100%);
          height: 100%;
          min-height: 0;
          border-radius: 16px;
          border: 1px solid #2e3a58;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #0a0f1e;
          color: #f0f4ff;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
        }
        .ask-log {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 767px) {
          .ask-frame { padding: 0; }
          .ask-sheet { width: 100%; border: none; border-radius: 0; }
        }
      `}</style>
      <div className="ask-frame">
        <div className="ask-sheet" role="dialog" aria-modal="true" aria-labelledby="ask-title" onClick={(event) => event.stopPropagation()}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 12px 12px 16px", borderBottom: "1px solid #2e3a58" }}>
            <div style={{ minWidth: 0 }}>
              <div id="ask-title" style={{ fontWeight: 800, fontSize: 18 }}>Ask</div>
              <div style={{ fontSize: 12, color: "#8ea0c0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={startNewChat}
                disabled={newChatDisabled}
                style={{
                  height: 44,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid #2e3a58",
                  background: newChatDisabled ? "#1a2035" : "#141a28",
                  color: newChatDisabled ? "#6b7a9a" : "#f0f4ff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: newChatDisabled ? "default" : "pointer",
                  touchAction: "manipulation",
                  whiteSpace: "nowrap",
                }}
              >
                New chat
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #2e3a58", background: "#141a28", color: "#f0f4ff", fontSize: 22, cursor: "pointer", touchAction: "manipulation" }}
              >
                ×
              </button>
            </div>
          </div>

          {pin.length < 4 ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Enter your PIN</div>
              <div style={{ fontSize: 13, color: "#8ea0c0", marginBottom: 16 }}>It’s only kept while this page is open.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} style={{ width: 48, height: 48, borderRadius: 12, background: enteredPin.length > index ? "#2563eb" : "#111827", border: `2px solid ${enteredPin.length > index ? "#3b82f6" : "#2e3a58"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "white" }}>
                    {enteredPin.length > index ? "●" : ""}
                  </div>
                ))}
              </div>
              {pinError && <div style={{ background: "#2a1010", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 12 }}>{pinError}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, maxWidth: 320, margin: "0 auto" }}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" onClick={() => pushPinDigit(digit)} style={pinKeyStyle}>{digit}</button>
                ))}
                <div />
                <button type="button" onClick={() => pushPinDigit("0")} style={pinKeyStyle}>0</button>
                <button type="button" onClick={() => setEnteredPin((current) => current.slice(0, -1))} style={pinKeyStyle} aria-label="Delete">⌫</button>
              </div>
            </div>
          ) : (
            <>
              <div ref={listRef} className="ask-log" style={{ padding: 16 }}>
                {messages.length === 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 14, color: "#c5d0e6", marginBottom: 12, lineHeight: 1.45 }}>
                      Ask in plain words. Nothing here is saved to the job.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void sendText(prompt)}
                          disabled={sending}
                          style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1px solid #2e3a58", background: "#141a28", color: "#dbe7ff", fontSize: 14, cursor: "pointer", touchAction: "manipulation" }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div key={`${index}-${message.role}`} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div style={{
                      maxWidth: "85%",
                      padding: "10px 12px",
                      borderRadius: 12,
                      fontSize: 15,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      background: message.error ? "#2a1010" : message.role === "user" ? "#1e3a6e" : "#1e2535",
                      border: `1px solid ${message.error ? "#7f1d1d" : message.role === "user" ? "#2563eb" : "#2e3a58"}`,
                      color: message.error ? "#f87171" : "#f0f4ff",
                    }}>
                      {message.role === "assistant" && !message.error ? <AskText content={message.content} /> : message.content}
                    </div>
                  </div>
                ))}
                {sending && <div style={{ fontSize: 13, color: "#8ea0c0", padding: "4px 2px 12px" }}>Looking that up…</div>}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendText(draft)
                }}
                style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end", padding: 12, paddingBottom: "max(12px, env(safe-area-inset-bottom))", borderTop: "1px solid #2e3a58", background: "#0a0f1e" }}
              >
                <label htmlFor="ask-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Your question</label>
                <textarea
                  id="ask-input"
                  value={draft}
                  maxLength={500}
                  rows={2}
                  placeholder="What job am I on tomorrow?"
                  aria-label="Your question"
                  enterKeyHint="send"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void sendText(draft)
                    }
                  }}
                  style={{ flex: 1, resize: "none", maxHeight: 120, padding: "12px 14px", borderRadius: 12, border: "1.5px solid #2e3a58", background: "#111827", color: "#f0f4ff", fontSize: 16, lineHeight: 1.4, fontFamily: "inherit", outline: "none" }}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  style={{
                    minWidth: 76,
                    minHeight: 48,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #2563eb",
                    background: sending || !draft.trim() ? "#1a2035" : "#2563eb",
                    color: sending || !draft.trim() ? "#6b7a9a" : "white",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: sending || !draft.trim() ? "default" : "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  {sending ? "…" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const pinKeyStyle: CSSProperties = {
  padding: "14px 0",
  borderRadius: 12,
  fontSize: 18,
  fontWeight: 700,
  background: "#141a28",
  border: "1.5px solid #2e3a58",
  color: "#f0f4ff",
  cursor: "pointer",
  touchAction: "manipulation",
}

function AskText({ content }: { content: string }): ReactNode {
  const parts = askParts(content)
  return parts.map((part, index) => {
    if (part.type === "text") return <span key={index}>{part.text}</span>
    return (
      <a
        key={index}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#93c5fd", fontWeight: 700 }}
      >
        {part.label}
      </a>
    )
  })
}
