// Column allow-lists for Ask. These strings are the only fields the
// assistant is allowed to read. Pay, invoices, and contact details are
// intentionally absent. The star on the board is projects.pinned, and
// completed / completed_at say a job is finished. The auth lookup (pin
// check) uses its own list in the route and never hands that row to the model.

export const SEGMENT_COLUMNS = "id, name, project_id, crew_id, start_date, end_date, notes"
// `quoted` is read so live tools can leave an unwon quote out. It is not
// passed through to the model.
export const PROJECT_COLUMNS = "id, name, client, archived, pinned, completed, completed_at, quoted"
// Open quotes only. No contract value and no stage amounts.
export const QUOTE_COLUMNS = "id, name, client, quote_number, quote_date, quoted, quote_pdf_path"
export const MILESTONE_STAGE_COLUMNS = "id, project_id"
export const CREW_COLUMNS = "id, name, nickname"
export const LABEL_COLUMNS = "project_id, date, label"
export const CREWMATE_COLUMNS = "name, crew_id, role"
export const WORKER_LOOKUP_COLUMNS = "id, name, crew_id"
export const TIMESHEET_COLUMNS = "id, date, worker_id, project_id, ordinary_hours, ot_hours, notes, absence_type"
// Job summary only needs dates and hours. Notes stay out of this read.
export const JOB_SEGMENT_COLUMNS = "id, project_id, start_date, end_date"
export const JOB_TIMESHEET_COLUMNS = "id, date, worker_id, project_id, ordinary_hours, ot_hours"

// Used only to check the PIN. Never passed to the model.
export const WORKER_AUTH_COLUMNS = "id, name, app_role, crew_id, pin"

export const TOOL_COLUMN_LISTS = [
  SEGMENT_COLUMNS,
  PROJECT_COLUMNS,
  QUOTE_COLUMNS,
  MILESTONE_STAGE_COLUMNS,
  CREW_COLUMNS,
  LABEL_COLUMNS,
  CREWMATE_COLUMNS,
  WORKER_LOOKUP_COLUMNS,
  TIMESHEET_COLUMNS,
  JOB_SEGMENT_COLUMNS,
  JOB_TIMESHEET_COLUMNS,
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
