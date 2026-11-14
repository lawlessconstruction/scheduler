// Who can raise a QuickBooks invoice, and who can review the ones Scheduler sent.
//
// workers.app_role is the only signal the app has:
//   boss       office accounts. Anthony, and the other office logins that
//              already see milestones, clients, and money.
//   crew_boss  crew leads.
//   worker     everyone else.
// There is no separate flag for Anthony. The office role is how he already
// gets the money screens, so the Invoices list uses that same role.

export function canRaiseInvoice(appRole: string | null | undefined): boolean {
  return appRole === "boss" || appRole === "crew_boss"
}

export function canReviewInvoices(appRole: string | null | undefined): boolean {
  return appRole === "boss"
}
