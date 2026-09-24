import type {
  Consent, Contact, FoundKey, GotKey, TimelineEvent, World,
} from "../data/types";
import { packOf, type Pack, type Stage } from "./packs";
import { addDays, daysBetween, firstName, money, plural, weekday } from "./format";

/**
 * T2 — the engine. Every status, stage and verdict below is DERIVED from an
 * event. Nothing here reads a field the owner typed except their four marks.
 */

export const RULES = {
  /** Spec Q3: 48 hours, weekends paused. */
  answerHours: 48,
  /** "Came back" lasts this long after the purchase that answered a check-in. */
  cameBackDays: 30,
  /** A check-in with nothing after this long becomes "still quiet". */
  stillQuietDays: 60,
  /** A due-back customer is late this long after their date. */
  dueGraceDays: 30,
  /** An inquiry stops showing as open after this long. */
  openInquiryDays: 30,
};

export const FOUND_LABEL: Record<FoundKey, string> = {
  google: "Google",
  referral: "A referral",
  ad: "An ad",
  "walk-in": "Walked in",
  "not-known": "Not known",
};

export const GOT_LABEL: Record<GotKey, string> = {
  form: "Website form",
  newsletter: "Newsletter",
  payment: "Payment",
  "moved-in": "Moved in from a tool",
  "by-hand": "Added by hand",
};

export type StatusKey = "new" | "customer" | "came-back" | "not-back";

export const STATUS_ORDER: StatusKey[] = ["new", "customer", "came-back", "not-back"];

/** ⛔ "Quiet" is a retired word (spec §4.4). */
export function statusLabel(s: StatusKey, pack: Pack): string {
  switch (s) {
    case "new": return "New inquiry";
    case "customer": return pack.customer[0].toUpperCase() + pack.customer.slice(1);
    case "came-back": return "Came back";
    case "not-back": return "Hasn't been back";
  }
}

/* ── identity ─────────────────────────────────────────────────────────────── */

export function normalEmail(e?: string): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  if (!t.includes("@")) return null;
  const [user, host] = t.split("@");
  return `${user.split("+")[0]}@${host}`;
}

export function phoneDigits(p?: string): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-10) : null;
}

export function normalName(n: string): string {
  return n.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A one-way fingerprint, so an erased identifier can be refused without being kept. */
export function fingerprint(kind: "e" | "p", value: string): string {
  let h = 5381;
  const s = kind + ":" + value;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return kind + h.toString(36);
}

export function isSuppressed(w: World, email?: string, phone?: string): boolean {
  const e = normalEmail(email);
  const p = phoneDigits(phone);
  return (
    (!!e && w.suppressed.includes(fingerprint("e", e))) ||
    (!!p && w.suppressed.includes(fingerprint("p", p)))
  );
}

/**
 * ⛔ Match by email FIRST, then phone, NEVER by name alone. A name-only twin is
 * offered as a look-alike card (spec S5), never merged for you.
 */
export function findMatch(w: World, email?: string, phone?: string): Contact | null {
  const e = normalEmail(email);
  const p = phoneDigits(phone);
  const live = w.contacts.filter((c) => !c.mergedInto && !c.erased);
  if (e) {
    const hit = live.find((c) => normalEmail(c.email) === e);
    if (hit) return hit;
  }
  if (p) {
    const hit = live.find((c) => phoneDigits(c.phone) === p);
    if (hit) return hit;
  }
  return null;
}

/* ── the 48-hour clock, weekends paused (spec Q3) ─────────────────────────── */

/**
 * Hours of "answering time" between two instants, counting Monday to Friday only.
 * Worked example from acceptance A21: 3pm Friday to 3pm Tuesday is
 * 9 (Fri) + 0 (Sat) + 0 (Sun) + 24 (Mon) + 15 (Tue) = 48.
 */
export function workHoursBetween(
  fromDate: string, fromMinute: number, toDate: string, toMinute: number,
): number {
  if (fromDate > toDate || (fromDate === toDate && fromMinute >= toMinute)) return 0;
  let total = 0;
  let day = fromDate;
  while (day <= toDate) {
    const wd = weekday(day);
    const isWeekend = wd === 0 || wd === 6;
    if (!isWeekend) {
      const start = day === fromDate ? fromMinute : 0;
      const end = day === toDate ? toMinute : 24 * 60;
      total += Math.max(0, end - start);
    }
    day = addDays(day, 1);
  }
  return total / 60;
}

/* ── the model ────────────────────────────────────────────────────────────── */

export interface Buy { date: string; amount: number; item?: string; refunded?: boolean; }

export interface Profile {
  c: Contact;
  pack: Pack;
  events: TimelineEvent[];
  /** Inquiries and other messages from them, newest first. */
  messages: TimelineEvent[];
  /** Message ids that have been answered. */
  answered: Set<string>;
  buys: Buy[];
  refunds: TimelineEvent[];
  spentTotal: number;
  spent12: number;
  lastBuy?: string;
  firstSeen: string;
  status: StatusKey;
  stage: Stage;
  got: GotKey[];
  found: FoundKey;
  consent: Consent;
  /** People who work at this business (business profiles only). */
  people: Profile[];
  /** A look-alike suggestion: same name, no shared email or phone. */
  lookAlike?: Contact;
  /** Due-back rhythm: when Alloro expects them next. */
  dueBack?: string;
  /** Pace rhythm: their usual gap in days. */
  usualGap?: number;
  /** The owner reached out and is waiting. */
  waitingSince?: string;
  isQuiet: boolean;
  isStillQuiet: boolean;
  cameBack: boolean;
}

export interface Model {
  world: World;
  pack: Pack;
  list: Profile[];
  byId: Map<string, Profile>;
  /** Live, visible people and businesses — excludes hidden, erased and merged. */
  visible: Profile[];
  spamCount: number;
}

function evSort(a: TimelineEvent, b: TimelineEvent): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.minute ?? 0) - (a.minute ?? 0);
}

export function buildModel(w: World): Model {
  const pack = packOf(w.info.pack);
  const byContact = new Map<string, TimelineEvent[]>();
  for (const e of w.events) {
    const arr = byContact.get(e.contactId) ?? [];
    arr.push(e);
    byContact.set(e.contactId, arr);
  }

  const profiles: Profile[] = [];
  for (const c of w.contacts) {
    if (c.mergedInto) continue;
    const events = (byContact.get(c.id) ?? []).slice().sort(evSort);
    profiles.push(makeProfile(w, pack, c, events));
  }

  const byId = new Map(profiles.map((p) => [p.c.id, p]));
  // Businesses gather their people, and a person takes the business's status so
  // the two pages can never disagree (spec S3).
  //
  // ⛔ The business's own status must be computed from ITS PEOPLE TOO. A
  // business's only event is usually "added", so stamping its own status down
  // turned people with real payments into "New inquiry · No stage yet".
  // Found by looking at the screen; the suite read it as consistent, which it
  // was — consistently wrong.
  const STAGE_RANK: Stage[] = ["none", "asked", "quoted", "booked", "paid"];
  for (const p of profiles) {
    if (p.c.kind !== "business") continue;
    p.people = profiles.filter((x) => x.c.businessId === p.c.id);
    const all = [p, ...p.people];
    p.buys = all.flatMap((x) => x.buys);
    p.refunds = all.flatMap((x) => x.refunds);
    p.spentTotal = all.reduce((s, x) => s + x.spentTotal, 0);
    p.spent12 = all.reduce((s, x) => s + x.spent12, 0);
    p.lastBuy = all.map((x) => x.lastBuy).filter(Boolean).sort().pop();
    p.stage = STAGE_RANK[Math.max(...all.map((x) => STAGE_RANK.indexOf(x.stage)))];
    p.isQuiet = p.people.some((x) => x.isQuiet) || p.isQuiet;
    p.cameBack = p.people.some((x) => x.cameBack) || p.cameBack;
    p.status = p.cameBack ? "came-back" : p.isQuiet ? "not-back" : p.buys.length ? "customer" : "new";
    for (const person of p.people) {
      person.status = p.status;
      person.stage = p.stage;
    }
  }
  // Look-alikes: same normalised name, no shared email or phone, not already kept apart.
  for (const p of profiles) {
    if (p.c.erased || p.c.hidden) continue;
    const twin = profiles.find(
      (x) =>
        x.c.id !== p.c.id &&
        !x.c.erased &&
        !x.c.hidden &&
        normalName(x.c.name) === normalName(p.c.name) &&
        !(p.c.notSameAs ?? []).includes(x.c.id) &&
        normalEmail(x.c.email) !== normalEmail(p.c.email) &&
        phoneDigits(x.c.phone) !== phoneDigits(p.c.phone),
    );
    if (twin) p.lookAlike = twin.c;
  }

  const visible = profiles.filter((p) => !p.c.hidden && !p.c.erased);
  return { world: w, pack, list: profiles, byId, visible, spamCount: w.spam.length };
}

function makeProfile(w: World, pack: Pack, c: Contact, events: TimelineEvent[]): Profile {
  const messages = events.filter((e) => e.kind === "inquiry");
  const answered = new Set<string>();
  for (const e of events) {
    if ((e.kind === "email" || e.kind === "called") && e.answers) {
      // ⛔ "No answer" does not count as answering (spec S16).
      if (e.kind === "called" && e.outcome === "no-answer") continue;
      answered.add(e.answers);
    }
  }

  const payments = events.filter((e) => e.kind === "payment");
  const refunds = events.filter((e) => e.kind === "refund");
  const buys: Buy[] = payments.map((e) => ({
    date: e.date, amount: e.amount ?? 0, item: e.item,
  }));
  const refundTotal = refunds.reduce((s, e) => s + (e.amount ?? 0), 0);
  const spentTotal = buys.reduce((s, b) => s + b.amount, 0) - refundTotal;
  const cutoff = addDays(w.today, -365);
  const spent12 =
    buys.filter((b) => b.date >= cutoff).reduce((s, b) => s + b.amount, 0) -
    refunds.filter((e) => e.date >= cutoff).reduce((s, e) => s + (e.amount ?? 0), 0);

  const dates = buys.map((b) => b.date).sort();
  const lastBuy = dates[dates.length - 1];
  const firstSeen = events.length ? events[events.length - 1].date : w.today;

  // Stage: the FURTHEST point reached, never a path walked (spec §6.2).
  let stage: Stage = "none";
  if (events.some((e) => e.kind === "inquiry")) stage = "asked";
  if (events.some((e) => e.kind === "quote")) stage = "quoted";
  if (events.some((e) => e.kind === "booked")) stage = "booked";
  if (payments.length) stage = "paid";

  // Rhythm.
  let usualGap: number | undefined;
  let dueBack: string | undefined;
  if (pack.rhythm === "pace" && dates.length >= pack.minBuys) {
    let gaps = 0;
    for (let i = 1; i < dates.length; i++) gaps += daysBetween(dates[i - 1], dates[i]);
    usualGap = Math.round(gaps / (dates.length - 1));
  } else if (pack.rhythm === "due-back" && dates.length >= pack.minBuys) {
    let gaps = 0;
    for (let i = 1; i < dates.length; i++) gaps += daysBetween(dates[i - 1], dates[i]);
    const avg = Math.round(gaps / (dates.length - 1));
    dueBack = addDays(lastBuy!, avg);
  }

  const lastCheckin = events.find((e) => e.kind === "checkin" || e.kind === "email");
  const waitingSince =
    lastCheckin && (!lastBuy || lastBuy < lastCheckin.date) ? lastCheckin.date : undefined;

  // ⛔ Nobody is judged while a feed is down or the season is slow (spec S18).
  const suppressed = !w.feeds.payments.ok || w.sim.slowSeason;
  let isQuiet = false;
  if (!suppressed && !c.lost && lastBuy) {
    if (usualGap) {
      isQuiet = daysBetween(lastBuy, w.today) > usualGap * 2;
    } else if (dueBack) {
      isQuiet = daysBetween(dueBack, w.today) > RULES.dueGraceDays;
    }
  }
  if (c.lost) isQuiet = false;

  const isStillQuiet =
    !!waitingSince && daysBetween(waitingSince, w.today) > RULES.stillQuietDays && isQuiet;

  const cameBack =
    !!lastCheckin && !!lastBuy && lastBuy > lastCheckin.date &&
    daysBetween(lastBuy, w.today) <= RULES.cameBackDays;

  let status: StatusKey = "new";
  if (payments.length) status = "customer";
  if (cameBack) status = "came-back";
  if (isQuiet) status = "not-back";
  if (c.lost) status = "not-back";

  const got: GotKey[] = [];
  for (const e of events) {
    const g =
      e.got ??
      (e.kind === "inquiry" ? "form"
        : e.kind === "newsletter" ? "newsletter"
        : e.kind === "payment" ? "payment"
        : e.kind === "added" ? "by-hand"
        : undefined);
    if (g && !got.includes(g)) got.push(g);
  }

  return {
    c, pack, events, messages, answered, buys, refunds, spentTotal, spent12,
    lastBuy, firstSeen, status, stage, got, found: c.found ?? "not-known",
    consent: c.consent, people: [], dueBack, usualGap, waitingSince,
    isQuiet, isStillQuiet, cameBack,
  };
}

/* ── sentences (Design §6.1, §6.2, §7.1) ──────────────────────────────────── */

/** The verdict line: one sentence answering "what do I do about this person now?" */
export function whyLine(p: Profile, w: World): string {
  const who = firstName(p.c.name);
  if (p.c.erased) return "Erased at their request. The details are gone.";
  if (p.c.hidden) return "Hidden from your list. You can show them again.";
  if (p.c.mark === "do-not-contact") return `${who} asked not to be contacted.`;
  if (p.c.mark === "not-a-fit") return `You marked ${who} as not a fit.`;
  if (p.c.lost) return `You marked ${who} lost: ${p.c.lost.reason.toLowerCase()}.`;
  const open = openMessage(p, w);
  if (open) return `${who} is waiting to hear from you.`;
  if (p.cameBack) return `${who} came back after you reached out.`;
  if (p.isStillQuiet) return `${who} still hasn't been back since you wrote.`;
  if (p.isQuiet && p.dueBack) return `${who} was due back by ${p.dueBack}.`;
  if (p.isQuiet && p.usualGap)
    return `${who} usually comes every ${plural(p.usualGap, "day")}. It's been longer.`;
  // ⛔ A business has no rhythm of its own — its people carry it — so without
  // this the verdict fell through to "Nothing needs you" while the chip beside
  // it read "Hasn't been back". Two things about the same account, disagreeing.
  if (p.isQuiet)
    return p.c.kind === "business"
      ? `Nobody at ${who} has been back in a while.`
      : `${who} hasn't been back in a while.`;
  if (p.stage === "quoted") return `${who} has a price from you and hasn't answered.`;
  if (p.stage === "booked") return `${who} said yes. Nothing has been paid yet.`;
  if (p.buys.length) return `Nothing needs you about ${who} right now.`;
  return `${who} hasn't bought anything yet.`;
}

/**
 * ⛔ Returns null rather than "$0" (Design §8.3). A screen renders NO money line
 * at all instead of a zero.
 */
export function moneyLine(p: Profile, w: World): string | null {
  if (p.c.erased) return null;
  if (!w.feeds.payments.ok) return null;
  if (!p.buys.length) return null;
  if (p.spent12 > 0) return `${money(p.spent12)} in the last 12 months`;
  return `Nothing in the last 12 months. ${money(p.spentTotal)} before that.`;
}

/** The oldest message from them that nobody has answered. */
export function openMessage(p: Profile, w: World): TimelineEvent | undefined {
  return p.messages
    .filter(
      (m) =>
        !p.answered.has(m.id) &&
        daysBetween(m.date, w.today) <= RULES.openInquiryDays,
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

/** Has this message passed 48 answering hours? (spec Q3) */
export function pastAlarm(m: TimelineEvent, w: World): boolean {
  return workHoursBetween(m.date, m.minute ?? 0, w.today, 24 * 60) >= RULES.answerHours;
}

export function canEmail(p: Profile): boolean {
  return p.consent !== "stop" && p.c.mark !== "do-not-contact" && !!p.c.email && !p.c.erased;
}

export function displayName(c: Contact): string {
  return c.erased ? "Erased on request" : c.name;
}
