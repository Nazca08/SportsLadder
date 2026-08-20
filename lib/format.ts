/**
 * Display helpers for the date and time columns.
 *
 * Postgres hands back a `time` column as "19:00:00", which was being printed
 * straight to the page. Storage stays 24-hour -- it sorts and compares
 * correctly -- and only the display is converted.
 */

/** "19:00:00" -> "7:00pm". Returns the input unchanged if it is not a time. */
export function formatTime(value?: string | null): string {
  if (!value) return "";

  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return value;

  const minutes = (minutePart ?? "00").slice(0, 2);
  const period = hour < 12 ? "am" : "pm";
  // 0 and 12 both map to 12: midnight is 12am, noon is 12pm.
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${hour12}:${minutes}${period}`;
}

/** "2026-08-25" -> "Tue, Aug 25". Parsed as a plain date, never shifted by timezone. */
export function formatDate(value?: string | null): string {
  if (!value) return "";

  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;

  // Constructed in local time on purpose. new Date("2026-08-25") parses as UTC
  // and can render as the 24th for anyone west of Greenwich.
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
