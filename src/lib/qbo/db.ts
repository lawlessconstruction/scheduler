import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function schemaHint(message: string): string | null {
  if (/qbo_tokens|qbo_customer_id|qbo_invoice_id|invoice_claim|invoice_sent_at|invoiced_by/i.test(message)) {
    return "The QuickBooks columns aren't in the database yet. Run the SQL from the pull request, then try again."
  }
  return null
}
