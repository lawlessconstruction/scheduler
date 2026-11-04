// Column allow-lists for Ask. These strings are the only fields the
// assistant is allowed to read. Pay, invoices, pins, and contact details
// are intentionally absent. The auth lookup (pin check) uses its own list
// in the route and never hands that row to the model.

export const SEGMENT_COLUMNS = "id, name, project_id, crew_id, start_date, end_date, notes"
export const PROJECT_COLUMNS = "id, name, client, archived"
export const CREW_COLUMNS = "id, name, nickname"
export const LABEL_COLUMNS = "project_id, date, label"
export const CREWMATE_COLUMNS = "name, crew_id, role"
export const WORKER_LOOKUP_COLUMNS = "id, name, crew_id"
export const TIMESHEET_COLUMNS = "id, date, worker_id, project_id, ordinary_hours, ot_hours, notes, absence_type"

// Used only to check the PIN. Never passed to the model.
export const WORKER_AUTH_COLUMNS = "id, name, app_role, crew_id, pin"

export const TOOL_COLUMN_LISTS = [
  SEGMENT_COLUMNS,
  PROJECT_COLUMNS,
  CREW_COLUMNS,
  LABEL_COLUMNS,
  CREWMATE_COLUMNS,
  WORKER_LOOKUP_COLUMNS,
  TIMESHEET_COLUMNS,
]

export const FORBIDDEN_COLUMN_WORDS = [
  "pin",
  "rate",
  "amount",
  "invoice",
  "email",
  "phone",
  "contract",
  "billing",
  "password",
]
