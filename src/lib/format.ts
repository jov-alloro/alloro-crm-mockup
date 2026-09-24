/** Dates, money and plurals. Design §10.5 — time is honest and relative. */

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

/** 0 = Sunday, 6 = Saturday. */
export function weekday(date: string): number {
  return parse(date).getUTCDay();
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? one + "s")}`;
}

/**
 * Design §8.4, the precision ceiling: money is rounded, never $8,912.47.
 * ⛔ Callers must not pass 0 meaning "unknown" — see moneyLine() in engine.ts.
 */
export function money(n: number): string {
  const r = Math.round(n);
  return "$" + r.toLocaleString("en-US");
}

/** Design §10.5 — "Wrote today", "3 days ago", then a plain date. */
export function relativeDay(date: string, today: string): string {
  const d = daysBetween(date, today);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "last week";
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return dateWords(date, today);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function dateWords(date: string, today?: string): string {
  const d = parse(date);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  // ⛔ Without the year, last September reads as this September — and a date in
  // the past can look like tomorrow. Design §10.5: time is honest.
  const thisYear = today ? parse(today).getUTCFullYear() : new Date().getUTCFullYear();
  return d.getUTCFullYear() === thisYear ? base : `${base} ${d.getUTCFullYear()}`;
}

export function timeWords(minute?: number): string {
  if (minute === undefined) return "";
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * T64 (Rev 13) — a message list's date, the way a mailbox writes it.
 *
 * ⛔ SHORT ENOUGH TO SIT RIGHT-ALIGNED IN A ROW. The old line read "Wrote last
 * week, 3:00 PM · website form" — a relative phrase buried mid-sentence, which
 * is why the screen felt undated while carrying a date.
 *
 * Today → the time. This year → "18 Sep". Older → "18 Sep 2025".
 */
export function listDate(date: string, today: string, minute?: number): string {
  if (date === today) return timeWords(minute) || "Today";
  const d = parse(date);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const same = d.getUTCFullYear() === parse(today).getUTCFullYear();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${same ? "" : " " + d.getUTCFullYear()}`;
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}
