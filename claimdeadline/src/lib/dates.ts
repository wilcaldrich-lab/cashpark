const NY = "America/New_York";

export function todayInNewYork(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysUntil(deadline: string, today = todayInNewYork()): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${deadline}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function shiftDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatDeadline(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return "Closed";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function isOpen(deadline: string, today = todayInNewYork()): boolean {
  return daysUntil(deadline, today) >= 0;
}
