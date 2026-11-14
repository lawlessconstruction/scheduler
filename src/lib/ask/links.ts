// Turns Ask replies into text and safe links. Quote PDFs use the same-origin
// file route, which redirects to a short-lived signed URL when opened.

export type AskPart =
  | { type: "text"; text: string }
  | { type: "link"; href: string; label: string }

const MARKDOWN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

export function askParts(content: string): AskPart[] {
  const parts: AskPart[] = []
  let cursor = 0
  for (const match of content.matchAll(MARKDOWN)) {
    const index = match.index ?? 0
    if (index > cursor) parts.push(...bare(content.slice(cursor, index)))
    const href = safeHref(match[2] ?? "")
    if (href) parts.push({ type: "link", href, label: match[1] || "Open" })
    else parts.push({ type: "text", text: match[0] })
    cursor = index + match[0].length
  }
  if (cursor < content.length) parts.push(...bare(content.slice(cursor)))
  return parts.length > 0 ? parts : [{ type: "text", text: content }]
}

function bare(text: string): AskPart[] {
  const parts: AskPart[] = []
  const pattern = /(\/api\/quotes\/file\?[^\s)]+|https?:\/\/[^\s)]+)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) parts.push({ type: "text", text: text.slice(cursor, index) })
    const href = safeHref(match[1] ?? "")
    if (href) parts.push({ type: "link", href, label: match[1].startsWith("/api/quotes/file") ? "Open quote PDF" : match[1] })
    else parts.push({ type: "text", text: match[0] })
    cursor = index + match[0].length
  }
  if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) })
  return parts
}

export function safeHref(raw: string): string | null {
  const href = raw.trim()
  if (href.startsWith("/api/quotes/file?") && !href.includes("\\") && !href.includes("//")) {
    try {
      const url = new URL(href, "https://scheduler.local")
      if (url.pathname !== "/api/quotes/file") return null
      const projectId = url.searchParams.get("projectId") ?? ""
      if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null
      url.searchParams.set("redirect", "1")
      return `${url.pathname}?${url.searchParams.toString()}`
    } catch {
      return null
    }
  }
  try {
    const url = new URL(href)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.toString()
  } catch {
    return null
  }
}
