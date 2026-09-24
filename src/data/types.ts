/**
 * T2 — the event and person types.
 *
 * ⛔ The property that makes this work, kept from v1: EVERY status, stage and
 * verdict is DERIVED FROM AN EVENT. Nothing is set by hand except the owner's
 * four marks (Not a fit, Do not contact, Mark lost, Hide) and Alloro staff's
 * Erase. That is why the demo never drifts, and it is why there is no board to
 * drag anything on (spec R2).
 */

export type BusinessKey = "riverside" | "harbor" | "northgate";
export type PackKey = "dealership" | "cafe" | "contractor";
export type Viewer = "owner" | "staff" | "alloro";
export type SeedVariant = "full" | "first-week" | "empty";

/** How Alloro got them. A closed list — spec §6.2's filter chips. */
export type GotKey = "form" | "newsletter" | "payment" | "moved-in" | "by-hand";

/** How they found you. A closed list; "not-known" is a real value, never a blank. */
export type FoundKey = "google" | "referral" | "ad" | "walk-in" | "not-known";

/** The owner's only marks on a person. */
export type Mark = "not-a-fit" | "do-not-contact";

/** Email permission. "unknown" is first-class: an import never grants it. */
export type Consent = "ok" | "stop" | "unknown";

export interface Billing {
  plan: string;
  amount?: number;
  cycle?: "weekly" | "monthly" | "yearly";
  nextDue?: string;
}

export interface Contact {
  id: string;
  kind: "person" | "business";
  name: string;
  email?: string;
  phone?: string;
  /** A person's employer, by business contact id. */
  businessId?: string;
  jobTitle?: string;
  mainContact?: boolean;
  found?: FoundKey;
  category?: string;
  /** Who added them. Filled by Alloro from the signed-in user, never typed. */
  addedBy: string;
  consent: Consent;
  billing?: Billing;
  mark?: Mark;
  lost?: { on: string; reason: string };
  /** The owner's Hide. Reversible, and it KEEPS email and phone (spec S6). */
  hidden?: { on: string; by: string };
  /** Alloro staff's Erase. One-way (spec S7). */
  erased?: { on: string; by: string };
  mergedInto?: string;
  notSameAs?: string[];
  /** Which import batch brought them in, for the 30-day undo. */
  importId?: string;
}

export type EventKind =
  | "inquiry"
  | "newsletter"
  | "added"
  | "payment"
  | "refund"
  | "quote"
  | "booked"
  | "email"
  | "called"
  | "note"
  | "checkin"
  | "thanks"
  | "reminder"
  | "group-email"
  | "merged"
  | "lost"
  | "hidden"
  | "shown"
  | "erased";

export interface TimelineEvent {
  id: string;
  contactId: string;
  kind: EventKind;
  /** ISO date. `minute` orders events inside one day. */
  date: string;
  minute?: number;
  by?: string;
  /** An inquiry's words; a note's words; a reply's subject line. */
  message?: string;
  subject?: string;
  text?: string;
  amount?: number;
  item?: string;
  /** An inquiry the owner answered, by event id. */
  answers?: string;
  /** Call outcome. ⛔ "no-answer" does NOT count as answering (spec S16). */
  outcome?: "talked" | "left-message" | "no-answer";
  /** This message is a complaint. */
  problem?: boolean;
  found?: FoundKey;
  got?: GotKey;
  importId?: string;
  /** A merge keeps the whole other record so a split can undo it. */
  merge?: { other: Contact; eventIds: string[]; why: string; filled: string[] };
}

export interface SpamMessage {
  id: string;
  name: string;
  email?: string;
  text: string;
  date: string;
  reason: string;
}

export interface ImportBatch {
  id: string;
  source: string;
  on: string;
  by: string;
  created: number;
  matched: number;
  /** Rows that matched a person the owner had hidden (spec S10). */
  matchedHidden: number;
  skipped: { reason: string; count: number }[];
  hasPaymentColumn: boolean;
  hasRefundColumn: boolean;
}

export interface Reminder {
  contactId: string;
  on: string;
  move: "reply" | "call";
  why?: string;
}

export interface WorldInfo {
  key: BusinessKey;
  name: string;
  pack: PackKey;
  ownerFirst: string;
  ownerFull: string;
  staffName: string;
  address: string;
}

export type FeedKey = "payments" | "forms";

export interface World {
  info: WorldInfo;
  /** The demo's today. "Move the clock forward" advances it (spec S24). */
  today: string;
  contacts: Contact[];
  events: TimelineEvent[];
  spam: SpamMessage[];
  imports: ImportBatch[];
  reminders: Reminder[];
  /** Cards the owner dismissed. Only "Came back" may be dismissed (spec §6.5). */
  dismissed: string[];
  feeds: Record<FeedKey, { ok: boolean; downSince?: string }>;
  sim: { slowSeason: boolean; failNextSave: boolean };
  /** One-way fingerprints of erased identifiers. Nothing re-adds them. */
  suppressed: string[];
  erasures: { id: string; on: string; by: string }[];
  /** Health practice. The switch will not turn on (spec R8, P10). */
  baaRecorded: boolean;
  seq: number;
}
