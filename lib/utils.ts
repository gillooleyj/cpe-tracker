/**
 * Calculates the number of days remaining in the current annual period
 * based on a certification's issue date.
 *
 * The annual period runs from the most recent anniversary of the issue date
 * up to (and including) the day before the next anniversary.
 *
 * Example: issued March 1, 2023. On Feb 26, 2026 the current period is
 * March 1, 2025 → Feb 28, 2026. Days left = 2 (Feb 27 and Feb 28).
 * On March 1, 2026 the period resets.
 *
 * Returns null if issueDate is falsy.
 */
export function calculateAnnualDaysLeft(
  issueDate: string | null | undefined
): number | null {
  if (!issueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const issue = new Date(issueDate + "T00:00:00Z");
  const issueMonth = issue.getUTCMonth(); // 0-indexed
  const issueDay = issue.getUTCDate();

  // Find the next anniversary (strictly after today)
  let nextAnniversary = new Date(today.getFullYear(), issueMonth, issueDay);
  nextAnniversary.setHours(0, 0, 0, 0);

  if (nextAnniversary <= today) {
    nextAnniversary = new Date(today.getFullYear() + 1, issueMonth, issueDay);
    nextAnniversary.setHours(0, 0, 0, 0);
  }

  // The current period ends the day before the next anniversary.
  // Days left = days from today (exclusive) to that last day (inclusive).
  const lastDayMs = nextAnniversary.getTime() - 86_400_000;
  return Math.floor((lastDayMs - today.getTime()) / 86_400_000);
}

/**
 * Returns the start of the current annual period (local midnight) based on
 * a certification's issue date — i.e. the most recent anniversary.
 */
export function getAnnualPeriodStart(issueDate: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const issue = new Date(issueDate + "T00:00:00Z");
  const issueMonth = issue.getUTCMonth();
  const issueDay = issue.getUTCDate();

  // Start with this calendar year's anniversary
  let periodStart = new Date(today.getFullYear(), issueMonth, issueDay);
  periodStart.setHours(0, 0, 0, 0);

  // If the anniversary hasn't happened yet this year, fall back to last year's
  if (periodStart > today) {
    periodStart = new Date(today.getFullYear() - 1, issueMonth, issueDay);
    periodStart.setHours(0, 0, 0, 0);
  }

  return periodStart;
}
