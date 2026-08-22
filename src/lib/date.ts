/**
 * Date helpers.
 *
 * All "today"/"this week" bucketing uses LOCAL date keys. The web dashboard
 * deliberately avoids `toISOString()` for this because it shifts to UTC and
 * mis-buckets evening orders; the Reports page still gets this wrong. Mobile
 * uses `localDateKey` everywhere.
 */

/** `YYYY-MM-DD` in the device's local timezone. */
export function localDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isToday(date: Date | string): boolean {
  return localDateKey(date) === localDateKey(new Date());
}

/** The last `count` days ending today, oldest first. */
export function lastNDays(count: number): Date[] {
  const days: Date[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

/** Short weekday label for chart axes, e.g. 'Mon'. */
export function weekdayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

/** `dd/mm/yyyy` — the format the printed receipt uses. */
export function receiptDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/** `hh:mm` in 24-hour form. */
export function timeLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Medium-length date for list rows, e.g. '19 Aug 2026'. */
export function displayDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
