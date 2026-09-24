import type {
  Contact, FoundKey, GotKey, ImportBatch, Mark, TimelineEvent, World,
} from "../data/types";
import { addDays, daysBetween } from "./format";
import { fingerprint, findMatch, isSuppressed, normalEmail, phoneDigits } from "./engine";

/** Every change to the world. Screens call these; none of them mutate directly. */

function next(w: World, p: string): string {
  w.seq += 1;
  return `${p}${w.seq}`;
}

function find(w: World, id: string): Contact {
  const c = w.contacts.find((x) => x.id === id);
  if (!c) throw new Error("no contact " + id);
  return c;
}

export function addEvent(w: World, e: Omit<TimelineEvent, "id">): TimelineEvent {
  const full: TimelineEvent = { id: next(w, "e"), ...e };
  w.events.push(full);
  return full;
}

/** The demo's "Next save fails" switch. Throws once, then clears itself. */
export function guardSave(w: World) {
  if (w.sim.failNextSave) {
    w.sim.failNextSave = false;
    throw new Error("save-failed");
  }
}

/* ── answering ────────────────────────────────────────────────────────────── */

export function recordEmail(w: World, contactId: string, by: string, answers?: string, subject?: string) {
  guardSave(w);
  addEvent(w, { contactId, kind: "email", date: w.today, minute: 600, by, answers, subject });
}

/**
 * ⛔ "No answer" does NOT count as answering (spec S16). Recording an unreached
 * person as answered is how an alarm becomes a lie.
 */
export function recordCall(
  w: World, contactId: string, by: string,
  outcome: "talked" | "left-message" | "no-answer", answers?: string,
) {
  guardSave(w);
  addEvent(w, {
    contactId, kind: "called", date: w.today, minute: 600, by, outcome,
    answers: outcome === "no-answer" ? undefined : answers,
  });
}

export function recordCheckin(w: World, contactId: string, by: string) {
  guardSave(w);
  addEvent(w, { contactId, kind: "checkin", date: w.today, minute: 600, by, subject: "Checking in" });
}

export function recordThanks(w: World, contactId: string, by: string) {
  guardSave(w);
  addEvent(w, { contactId, kind: "thanks", date: w.today, minute: 600, by });
}

export function addNote(w: World, contactId: string, text: string, by: string) {
  guardSave(w);
  addEvent(w, { contactId, kind: "note", date: w.today, minute: 600, by, text });
}

/* ── the owner's marks ────────────────────────────────────────────────────── */

export function setMark(w: World, contactId: string, mark: Mark | undefined) {
  find(w, contactId).mark = mark;
}

export function markLost(w: World, contactId: string, reason: string, by: string) {
  guardSave(w);
  const c = find(w, contactId);
  c.lost = { on: w.today, reason };
  addEvent(w, { contactId, kind: "lost", date: w.today, minute: 600, by, text: reason });
}

export function unmarkLost(w: World, contactId: string) {
  const c = find(w, contactId);
  c.lost = undefined;
  const i = w.events.findIndex((e) => e.contactId === contactId && e.kind === "lost");
  if (i >= 0) w.events.splice(i, 1);
}

/* ── Hide and Erase — ⛔ two different acts, two different code paths ─────── */

/**
 * HIDE (the owner's, reversible).
 *
 * ⛔ It KEEPS the email and phone. That is the mechanism, not an oversight: a
 * later import matching that address finds this record and attaches to it, so
 * no second row is created AND the person stays hidden. Merging this with
 * eraseContact() would give you a Hide that the next import quietly undoes.
 * Spec S6, acceptance A12.
 */
export function hideContact(w: World, contactId: string, by: string) {
  guardSave(w);
  const c = find(w, contactId);
  c.hidden = { on: w.today, by };
  addEvent(w, { contactId, kind: "hidden", date: w.today, minute: 600, by });
}

export function showContact(w: World, contactId: string, by: string) {
  const c = find(w, contactId);
  c.hidden = undefined;
  addEvent(w, { contactId, kind: "shown", date: w.today, minute: 600, by });
}

/**
 * ERASE (Alloro staff's, one-way).
 *
 * ⛔ It DESTROYS the identifiers and stores a one-way fingerprint of each, so a
 * later import or manual add carrying that address is refused and no new record
 * is created. Without that half, the next file undoes the privacy request.
 * Spec S7, acceptance A13.
 */
export function eraseContact(w: World, contactId: string, by: string) {
  guardSave(w);
  const c = find(w, contactId);
  const e = normalEmail(c.email);
  const p = phoneDigits(c.phone);
  if (e) w.suppressed.push(fingerprint("e", e));
  if (p) w.suppressed.push(fingerprint("p", p));
  w.erasures.push({ id: next(w, "x"), on: w.today, by });

  c.name = "Erased on request";
  c.email = undefined;
  c.phone = undefined;
  c.jobTitle = undefined;
  c.found = undefined;
  c.category = undefined;
  c.mark = undefined;
  c.billing = undefined;
  c.hidden = undefined;
  c.erased = { on: w.today, by };

  // The words go; the shape of the history stays.
  w.events = w.events.filter((ev) => !(ev.contactId === contactId && ev.kind === "note"));
  for (const ev of w.events) {
    if (ev.contactId !== contactId) continue;
    if (ev.message) ev.message = "Message removed on request.";
    ev.subject = undefined;
    ev.text = undefined;
    ev.merge = undefined;
  }
  addEvent(w, { contactId, kind: "erased", date: w.today, minute: 601, by });
}

/* ── merge and split (spec S5) ────────────────────────────────────────────── */

export function mergeContacts(w: World, keepId: string, otherId: string, why: string, by: string): string {
  guardSave(w);
  const keep = find(w, keepId);
  const other = find(w, otherId);
  const snapshot: Contact = structuredClone(other);
  const moved = w.events.filter((e) => e.contactId === otherId);
  moved.forEach((e) => (e.contactId = keepId));
  const filled: string[] = [];
  if (!keep.email && other.email) { keep.email = other.email; filled.push("email"); }
  if (!keep.phone && other.phone) { keep.phone = other.phone; filled.push("phone"); }
  other.mergedInto = keepId;
  const ev = addEvent(w, {
    contactId: keepId, kind: "merged", date: w.today, minute: 600, by,
    text: `Joined with a second record (${why}).${filled.length ? ` Kept their ${filled.join(" and ")}.` : ""} The money on this page may have changed.`,
    merge: { other: snapshot, eventIds: moved.map((e) => e.id), why, filled },
  });
  return ev.id;
}

export function splitMerge(w: World, mergedEventId: string, by: string) {
  const ev = w.events.find((e) => e.id === mergedEventId);
  if (!ev?.merge) return;
  const keep = find(w, ev.contactId);
  const other = find(w, ev.merge.other.id);
  other.mergedInto = undefined;
  w.events.filter((e) => ev.merge!.eventIds.includes(e.id)).forEach((e) => (e.contactId = other.id));
  for (const f of ev.merge.filled) {
    if (f === "email") keep.email = undefined;
    if (f === "phone") keep.phone = undefined;
  }
  keep.notSameAs = [...(keep.notSameAs ?? []), other.id];
  other.notSameAs = [...(other.notSameAs ?? []), keep.id];
  w.events.splice(w.events.indexOf(ev), 1);
  addEvent(w, { contactId: keep.id, kind: "merged", date: w.today, minute: 600, by, text: "Kept apart: not the same person." });
}

export function notSame(w: World, aId: string, bId: string) {
  const a = find(w, aId);
  const b = find(w, bId);
  a.notSameAs = [...(a.notSameAs ?? []), bId];
  b.notSameAs = [...(b.notSameAs ?? []), aId];
}

/* ── add by hand (spec S4) ────────────────────────────────────────────────── */

export interface AddResult { kind: "added" | "already-here" | "erased-before"; id?: string; }

export function addByHand(
  w: World,
  input: { name: string; email?: string; phone?: string; company?: string; found: FoundKey; category?: string; note?: string; billing?: Contact["billing"] },
  by: string,
): AddResult {
  guardSave(w);
  if (isSuppressed(w, input.email, input.phone)) return { kind: "erased-before" };
  const hit = findMatch(w, input.email, input.phone);
  if (hit) return { kind: "already-here", id: hit.id };

  let businessId: string | undefined;
  if (input.company) {
    const biz = w.contacts.find((c) => c.kind === "business" && c.name.toLowerCase() === input.company!.toLowerCase());
    if (biz) businessId = biz.id;
    else {
      const made: Contact = {
        id: next(w, "b"), kind: "business", name: input.company,
        addedBy: by, consent: "unknown",
      };
      w.contacts.push(made);
      addEvent(w, { contactId: made.id, kind: "added", date: w.today, minute: 600, by, got: "by-hand" });
      businessId = made.id;
    }
  }

  const c: Contact = {
    id: next(w, "c"), kind: "person", name: input.name.trim(),
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    businessId,
    found: input.found,
    category: input.category || undefined,
    addedBy: by,          // ⛔ filled by Alloro, never typed (spec §6.2)
    consent: "unknown",   // ⛔ adding someone never grants permission to email
    billing: input.billing,
  };
  w.contacts.push(c);
  addEvent(w, { contactId: c.id, kind: "added", date: w.today, minute: 600, by, got: "by-hand", found: input.found });
  if (input.note) addEvent(w, { contactId: c.id, kind: "note", date: w.today, minute: 601, by, text: input.note });
  return { kind: "added", id: c.id };
}

/* \u2500\u2500 editing a profile (Rev 30) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/**
 * T119 (Rev 30) \u2014 \u26d4 UNDO AN ADD, WHICH EVERY OTHER DESTRUCTIVE ACTION ALREADY HAD.
 *
 * Hide, erase, merge and import can all be taken back. Adding a person could
 * not \u2014 and adding is the action that starts every typo. Nothing else refers to
 * a person in the second after they are created, so this removes them and the
 * events that came with them, and nothing else has to be unpicked.
 *
 * \u26d4 IT REFUSES ONCE ANYTHING HAS HAPPENED TO THEM. A payment or a message can
 * attach within the same session, and deleting a person who now owns events
 * would leave those events pointing at nobody.
 */
export function undoAddByHand(w: World, contactId: string): boolean {
  guardSave(w);
  const c = w.contacts.find((x) => x.id === contactId);
  if (!c) return false;
  const theirs = w.events.filter((e) => e.contactId === contactId);
  const onlyAddingEvents = theirs.every((e) => e.kind === "added" || e.kind === "note");
  if (!onlyAddingEvents) return false;
  w.events = w.events.filter((e) => e.contactId !== contactId);
  w.contacts = w.contacts.filter((x) => x.id !== contactId);
  return true;
}

export type EditPatch = { name?: string; email?: string; phone?: string; company?: string };
export type EditResult =
  | { kind: "saved"; changed: { field: string; from?: string; to?: string }[] }
  | { kind: "clash"; field: "email" | "phone"; withId: string; withName: string }
  | { kind: "gone" };

/**
 * T120 (Rev 30) \u2014 \u26d4 FOUR FIELDS, THREE RISK CLASSES, AND TREATING THEM AS ONE
 * LIST IS THE MISTAKE.
 *
 *   name     \u2014 free. Nothing keys off it; the matcher never uses a name.
 *   company  \u2014 free to type, but it MOVES the person between businesses, which
 *              moves a business's money with them.
 *   email,
 *   phone    \u2014 \u26d4 THESE ARE THE IDENTITY KEYS. findMatch(w, email, phone) is how
 *              Alloro decides two records are the same person. Writing one that
 *              already belongs to somebody else either creates the duplicate the
 *              matcher exists to prevent, or hands one person's key to another
 *              record. So the edit is REFUSED and the merge is offered instead.
 *
 * \u26d4 AND WHAT IS NEVER EDITABLE IS ENFORCED BY THE SHAPE OF THIS FUNCTION, not
 * by a comment: status, stage, first seen, the ledger, who added them and the
 * source chips are computed from events and are not in EditPatch. If one of them
 * is wrong, the EVENT is wrong, and the fix is a new event.
 */
export function editContact(w: World, contactId: string, patch: EditPatch, by: string): EditResult {
  guardSave(w);
  const c = w.contacts.find((x) => x.id === contactId && !x.erased && !x.mergedInto);
  if (!c) return { kind: "gone" };

  const clean = (v?: string) => {
    const t = (v ?? "").trim();
    return t.length ? t : undefined;
  };
  const nextEmail = clean(patch.email);
  const nextPhone = clean(patch.phone);

  /* \u26d4 The collision check runs BEFORE anything is written, and excludes this
     record, or every save would clash with itself. */
  for (const [field, value] of [["email", nextEmail], ["phone", nextPhone]] as const) {
    if (!value) continue;
    const before = field === "email" ? c.email : c.phone;
    if ((before ?? "").toLowerCase() === value.toLowerCase()) continue;
    const hit = findMatch(w, field === "email" ? value : undefined, field === "phone" ? value : undefined);
    if (hit && hit.id !== c.id) {
      return { kind: "clash", field, withId: hit.id, withName: hit.name };
    }
  }

  /* \u26d4 Keep what the record arrived with, ONCE, before the first change. */
  if (!c.arrived && (nextEmail !== c.email || nextPhone !== c.phone)) {
    c.arrived = { email: c.email, phone: c.phone };
  }

  const changed: { field: string; from?: string; to?: string }[] = [];
  const note = (field: string, from?: string, to?: string) => {
    if ((from ?? "") === (to ?? "")) return;
    changed.push({ field, from, to });
  };

  const nextName = clean(patch.name);
  if (nextName) { note("name", c.name, nextName); c.name = nextName; }
  note("email", c.email, nextEmail); c.email = nextEmail;
  note("phone", c.phone, nextPhone); c.phone = nextPhone;

  const company = clean(patch.company);
  const wasBiz = c.businessId ? w.contacts.find((x) => x.id === c.businessId)?.name : undefined;
  if ((company ?? "") !== (wasBiz ?? "")) {
    if (!company) c.businessId = undefined;
    else {
      const biz = w.contacts.find((x) => x.kind === "business" && x.name.toLowerCase() === company.toLowerCase());
      if (biz) c.businessId = biz.id;
      else {
        const made: Contact = { id: next(w, "b"), kind: "business", name: company, addedBy: by, consent: "unknown" };
        w.contacts.push(made);
        addEvent(w, { contactId: made.id, kind: "added", date: w.today, minute: 600, by, got: "by-hand" });
        c.businessId = made.id;
      }
    }
    note("company", wasBiz, company);
  }

  /* \u26d4 One history entry per edit, naming every field that moved. An edit ADDS
     to the record; it never rewrites what was there. */
  if (changed.length) {
    addEvent(w, {
      contactId: c.id, kind: "note", date: w.today, minute: 700, by,
      text: `Changed ${changed.map((x) => `${x.field} from "${x.from ?? "nothing"}" to "${x.to ?? "nothing"}"`).join(", ")}.`,
    });
  }
  return { kind: "saved", changed };
}

/* ── imports (spec S9–S12) ────────────────────────────────────────────────── */

export interface ImportRow {
  name?: string; email?: string; phone?: string; emailStatus?: string;
  found?: FoundKey; notes?: string; amount?: number; date?: string; item?: string;
  extras?: Record<string, string>;
}

export interface ImportPreview {
  created: number;
  matched: number;
  matchedHidden: number;
  skipped: { reason: string; count: number }[];
  hasPaymentColumn: boolean;
  hasRefundColumn: boolean;
  /** Grouped rows, ready for runImport. */
  groups: { row: ImportRow; payments: ImportRow[]; existing?: string }[];
}

/** Look at it BEFORE anything lands (spec R14). Nothing here changes the world. */
export function previewImport(w: World, rows: ImportRow[], hasRefundColumn: boolean): ImportPreview {
  const skipped = new Map<string, number>();
  const bump = (r: string) => skipped.set(r, (skipped.get(r) ?? 0) + 1);
  const byKey = new Map<string, { row: ImportRow; payments: ImportRow[]; existing?: string }>();
  const seen = new Set<string>();
  let hasPayment = false;

  for (const row of rows) {
    if (row.amount !== undefined) hasPayment = true;
    if (!row.name || !row.name.trim()) { bump("No name"); continue; }
    if (!row.email && !row.phone) { bump("No email and no phone"); continue; }
    if (isSuppressed(w, row.email, row.phone)) { bump("Erased at someone's request"); continue; }
    const key = normalEmail(row.email) ?? phoneDigits(row.phone) ?? row.name.toLowerCase();
    if (seen.has(key)) {
      // A payments export has one row per payment: group it onto one person.
      byKey.get(key)!.payments.push(row);
      continue;
    }
    seen.add(key);
    const hit = findMatch(w, row.email, row.phone);
    byKey.set(key, { row, payments: row.amount !== undefined ? [row] : [], existing: hit?.id });
  }

  let created = 0, matched = 0, matchedHidden = 0;
  for (const g of byKey.values()) {
    if (g.existing) {
      matched++;
      const c = w.contacts.find((x) => x.id === g.existing);
      if (c?.hidden) matchedHidden++;
    } else created++;
  }

  return {
    created, matched, matchedHidden,
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
    hasPaymentColumn: hasPayment,
    hasRefundColumn,
    groups: [...byKey.values()],
  };
}

export function runImport(w: World, preview: ImportPreview, source: string, by: string): string {
  guardSave(w);
  const importId = next(w, "i");
  for (const g of preview.groups) {
    let id = g.existing;
    if (!id) {
      const c: Contact = {
        id: next(w, "c"), kind: "person", name: g.row.name!.trim(),
        email: g.row.email, phone: g.row.phone,
        found: g.row.found ?? "not-known",
        addedBy: by,
        // ⛔ An import never GRANTS permission. "Unsubscribed" becomes "stop";
        // anything else stays unknown (spec S10).
        consent: readStop(g.row.emailStatus) ? "stop" : "unknown",
        importId,
      };
      w.contacts.push(c);
      id = c.id;
      addEvent(w, { contactId: id, kind: "added", date: w.today, minute: 600, by, got: "moved-in", found: c.found, importId });
      if (g.row.notes) addEvent(w, { contactId: id, kind: "note", date: w.today, minute: 601, by, text: g.row.notes, importId });
    } else {
      const c = w.contacts.find((x) => x.id === id)!;
      // ⛔ A match NEVER un-hides. Hide survives every import (spec S6).
      if (readStop(g.row.emailStatus)) c.consent = "stop";
    }
    for (const p of g.payments) {
      if (p.amount === undefined) continue;
      addEvent(w, {
        contactId: id, kind: "payment", date: p.date ?? w.today, minute: 600,
        amount: p.amount, item: p.item, got: "payment", importId,
      });
    }
  }
  const batch: ImportBatch = {
    id: importId, source, on: w.today, by,
    created: preview.created, matched: preview.matched, matchedHidden: preview.matchedHidden,
    skipped: preview.skipped,
    hasPaymentColumn: preview.hasPaymentColumn,
    hasRefundColumn: preview.hasRefundColumn,
  };
  w.imports.push(batch);
  return importId;
}

function readStop(status?: string): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return s === "unsubscribed" || s === "no" || s === "false" || s === "opted out" || s === "cleaned";
}

/** 30 days, and it removes ONLY what this import created (spec S12). */
export function canUndo(w: World, batch: ImportBatch): boolean {
  return daysBetween(batch.on, w.today) <= 30;
}

export function undoImport(w: World, importId: string) {
  guardSave(w);
  w.contacts = w.contacts.filter((c) => c.importId !== importId);
  w.events = w.events.filter((e) => e.importId !== importId);
  w.imports = w.imports.filter((b) => b.id !== importId);
}

/* ── reminders and cards ──────────────────────────────────────────────────── */

export function setReminder(w: World, contactId: string, on: string, move: "reply" | "call", why?: string) {
  guardSave(w);
  w.reminders = w.reminders.filter((r) => r.contactId !== contactId);
  w.reminders.push({ contactId, on, move, why });
}

export function clearReminder(w: World, contactId: string) {
  w.reminders = w.reminders.filter((r) => r.contactId !== contactId);
}

/** ⛔ Only the "Came back" card may be dismissed (spec §6.5). */
export function dismissCard(w: World, cardId: string) {
  if (!w.dismissed.includes(cardId)) w.dismissed.push(cardId);
}

/* ── spam ─────────────────────────────────────────────────────────────────── */

export function rescueSpam(w: World, spamId: string, by: string): string | null {
  guardSave(w);
  const i = w.spam.findIndex((s) => s.id === spamId);
  if (i < 0) return null;
  const s = w.spam[i];
  w.spam.splice(i, 1);
  const hit = findMatch(w, s.email, undefined);
  const id = hit?.id ?? next(w, "c");
  if (!hit) {
    w.contacts.push({
      id, kind: "person", name: s.name, email: s.email,
      found: "not-known", addedBy: by, consent: "unknown",
    });
  }
  addEvent(w, { contactId: id, kind: "inquiry", date: s.date, minute: 600, message: s.text, got: "form" });
  return id;
}

/* ── the demo's own switches (spec S24) ───────────────────────────────────── */

export function setFeed(w: World, key: "payments" | "forms", ok: boolean) {
  w.feeds[key] = ok ? { ok: true } : { ok: false, downSince: addDays(w.today, -4) };
}

/** ⛔ New in v2: nothing in v1 needed elapsed hours. Acceptance A21 needs it. */
export function moveClock(w: World, days: number) {
  w.today = addDays(w.today, days);
}

export function arriveMessage(w: World, kind: "new" | "known" | "phone" | "spam") {
  if (kind === "spam") {
    w.spam.unshift({
      id: next(w, "s"), name: "Growth Team", email: "offers@example.org",
      text: "Boost your ranking fast. Reply for a free audit this week only.",
      date: w.today, reason: "Looks like a bulk mailing",
    });
    return null;
  }
  let id: string;
  if (kind === "known") {
    const known = w.contacts.find((c) => !c.hidden && !c.erased && !c.mergedInto && c.email);
    id = known ? known.id : next(w, "c");
  } else {
    id = next(w, "c");
    w.contacts.push({
      id, kind: "person",
      name: kind === "phone" ? "Nadia Petrov" : "Owen Halloran",
      email: kind === "phone" ? undefined : "owen.halloran@example.com",
      phone: kind === "phone" ? "(555) 0177" : undefined,
      found: "google", addedBy: "Alloro", consent: "unknown",
    });
  }
  addEvent(w, {
    contactId: id, kind: "inquiry", date: w.today, minute: 9 * 60,
    message: "Hi, could you let me know what you'd charge for this? Thanks.",
    got: "form", found: "google",
  });
  return id;
}

export function arrivePayment(w: World, kind: "new" | "quiet" | "after-email", amount: number, item: string) {
  let id: string;
  if (kind === "new") {
    id = next(w, "c");
    w.contacts.push({
      id, kind: "person", name: "Beatriz Sandoval", email: "beatriz.sandoval@example.com",
      found: "walk-in", addedBy: "Alloro", consent: "unknown",
    });
  } else {
    const target = w.contacts.find((c) => !c.hidden && !c.erased && !c.mergedInto);
    id = target ? target.id : next(w, "c");
  }
  addEvent(w, { contactId: id, kind: "payment", date: w.today, minute: 700, amount, item, got: "payment" });
  return id;
}

export function refundLast(w: World) {
  const pay = [...w.events].reverse().find((e) => e.kind === "payment");
  if (!pay) return;
  addEvent(w, {
    contactId: pay.contactId, kind: "refund", date: w.today, minute: 710,
    amount: pay.amount, item: pay.item,
  });
}

export function arriveNewsletter(w: World) {
  const id = next(w, "c");
  w.contacts.push({
    id, kind: "person", name: "Iris Novak", email: "iris.novak@example.com",
    found: "not-known", addedBy: "Alloro", consent: "unknown",
  });
  addEvent(w, { contactId: id, kind: "newsletter", date: w.today, minute: 540, got: "newsletter" });
  return id;
}

export function quoteMoves(w: World, step: "ask" | "quote" | "accept") {
  const live = w.contacts.filter((c) => !c.hidden && !c.erased && !c.mergedInto && c.kind === "person");
  if (!live.length) return null;
  if (step === "ask") return arriveMessage(w, "new");
  const target = live.find((c) =>
    step === "quote"
      ? w.events.some((e) => e.contactId === c.id && e.kind === "inquiry") &&
        !w.events.some((e) => e.contactId === c.id && e.kind === "quote")
      : w.events.some((e) => e.contactId === c.id && e.kind === "quote") &&
        !w.events.some((e) => e.contactId === c.id && e.kind === "booked"),
  );
  if (!target) return null;
  addEvent(w, {
    contactId: target.id, kind: step === "quote" ? "quote" : "booked",
    date: w.today, minute: 660, by: w.info.ownerFull,
  });
  return target.id;
}

export function askNoEmail(w: World) {
  const target = w.contacts.find((c) => !c.hidden && !c.erased && !c.mergedInto && c.consent !== "stop" && c.email);
  if (target) target.consent = "stop";
  return target?.id ?? null;
}

export function setBaa(w: World, on: boolean) {
  w.baaRecorded = on;
}

export function setGot(_w: World, _g: GotKey) { /* reserved */ }
