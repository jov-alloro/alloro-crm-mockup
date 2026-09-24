import type { Model, Profile } from "./engine";
import { FOUND_LABEL, GOT_LABEL } from "./engine";
import { money } from "./format";
import type { FoundKey, GotKey } from "../data/types";

/**
 * T35 (Rev 8) — the numbers behind the dashboard's charts.
 *
 * Carried over from Desktop\alloro-crm-mvp\src\lib\charts.ts. The `Point` shape
 * and `chartSummary` are that file's, unchanged; the builders are rewritten
 * against v2's Model, which is a different shape.
 *
 * ⛔ THESE FUNCTIONS ONLY COUNT, from the same events every other screen reads,
 * so a chart can never disagree with the sentence beside it. That is the whole
 * reason the dashboard "computes nothing of its own".
 *
 * ⛔ EVERY POINT CARRIES ITS OWN ADDRESS (`href`). T36 requires that every bar
 * and every slice opens the people behind it, and a point that cannot say where
 * its people are cannot satisfy that. A point with no href is a point that
 * should not have been drawn.
 */

export interface Point {
  label: string;
  value: number;
  /** How the value reads next to its bar: "38", "$6,180". */
  display?: string;
  /** Where this number's people live. T36 — every number names its people. */
  href?: string;
  /**
   * T45 (Rev 9) — ⛔ TERRACOTTA IS A SIGNAL, NOT A PALETTE.
   *
   * Design §2.2 calls alloro-orange "the ONLY attention-grabber that isn't
   * semantic", §8.1 says a colour encoding no state is decoration, and the real
   * app's StatBox.tsx states it in one line: "white card on linen, ink value,
   * terracotta = attention". A dashboard where everything is orange is a
   * dashboard where nothing is.
   *
   * So exactly the parts that need her carry this, and everything else is navy.
   */
  needsYou?: boolean;
}

/** A chart's numbers in words, for screen readers (v1's, unchanged). */
export function chartSummary(title: string, points: Point[]): string {
  return `${title}. ${points.map((x) => `${x.label}: ${x.display ?? x.value}.`).join(" ")}`;
}

/** How they found you — the biggest first. */
export function byFound(m: Model): Point[] {
  const counts = new Map<FoundKey, number>();
  for (const p of m.visible) counts.set(p.found, (counts.get(p.found) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({
      label: FOUND_LABEL[k],
      value: n,
      display: String(n),
      href: `#/people/f/found/${k}`,
    }));
}

/** How Alloro got them. A person can carry more than one, so these do not sum to the list. */
export function bySource(m: Model): Point[] {
  const counts = new Map<GotKey, number>();
  for (const p of m.visible) for (const g of p.got) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({
      label: GOT_LABEL[k],
      value: n,
      display: String(n),
      href: `#/people/f/got/${k}`,
    }));
}

/**
 * Of the people who wrote in: who paid, and who did not.
 *
 * ⛔ The second slice is the one Rev 7 could not link. `#/people/f/unpaid` now
 * exists, so the number names its people again.
 */
export function wroteInSplit(m: Model): Point[] {
  const wrote = m.visible.filter((p) => p.got.includes("form"));
  const paid = wrote.filter((p) => p.buys.length > 0).length;
  const not = wrote.length - paid;
  return [
    { label: "Paid", value: paid, display: String(paid), href: "#/people/f/got/form" },
    // ⛔ The gap is the point of this chart, so the gap is the terracotta.
    { label: "Not yet", value: not, display: String(not), href: "#/people/f/unpaid", needsYou: true },
  ].filter((x) => x.value > 0);
}

/** Where everyone stands: the status chips, as a ring. */
export function byStatus(m: Model, label: (k: string) => string): Point[] {
  const order = ["new", "customer", "came-back", "not-back"];
  const counts = new Map<string, number>();
  for (const p of m.visible) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  return order
    .filter((k) => (counts.get(k) ?? 0) > 0)
    .map((k) => ({
      label: label(k),
      value: counts.get(k) ?? 0,
      display: String(counts.get(k) ?? 0),
      href: `#/people/f/status/${k}`,
      needsYou: k === "not-back",
    }));
}

/** What sells, by money taken in the last 12 months. */
export function topItems(m: Model, n = 5): Point[] {
  const sums = new Map<string, number>();
  const from = yearAgo(m.world.today);
  for (const p of m.visible) {
    for (const b of p.buys) {
      if (b.date < from) continue;
      const name = b.item ?? "Not named";
      sums.set(name, (sums.get(name) ?? 0) + b.amount);
    }
  }
  return [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, sum]) => ({ label: name, value: sum, display: money(sum) }));
}

/** Money by month, the last six, oldest first. */
export function moneyByMonth(m: Model, n = 6): Point[] {
  const out: Point[] = [];
  const [ty, tm] = m.world.today.split("-").map(Number);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let sum = 0;
    for (const p of m.visible) for (const b of p.buys) if (b.date.startsWith(key)) sum += b.amount;
    out.push({ label: MONTHS[d.getUTCMonth()], value: sum, display: money(sum) });
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function yearAgo(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Used by the tiles that need the people, not just the count. */
export function peopleFor(m: Model, pred: (p: Profile) => boolean): Profile[] {
  return m.visible.filter(pred);
}
