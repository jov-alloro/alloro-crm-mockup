import type { Contact, FoundKey, TimelineEvent, World } from "./types";
import { addDays } from "../lib/format";

/**
 * ⛔ Bump this when the seeded world changes shape. On load, a saved demo whose
 * version does not match is DISCARDED AND RESEEDED, not migrated (spec §3.2).
 * Acceptance A35 proves it.
 */
export const WORLD_VERSION = 1;

/** The demo's fixed "today". A Wednesday, so the weekend rules are reachable. */
export const TODAY = "2026-09-23";

/* ── deterministic invented data ──────────────────────────────────────────── */

/**
 * ⛔ EVERY name, number, email and address in this mockup is invented. Nothing
 * here came from a real customer, patient or organization. Hard rule 3.
 * The generator is deterministic so the demo is the same on every machine.
 */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FIRST = [
  "Ana","Marcus","Priya","Theresa","Dana","Luis","Tomas","Joy","Hal","Nadia","Owen","Beatriz",
  "Caleb","Rosa","Emeka","Ingrid","Jonas","Keiko","Lila","Malik","Nina","Oscar","Paloma","Quinn",
  "Ruth","Samir","Tess","Ubah","Vera","Wes","Yara","Zane","Bruno","Cleo","Dara","Elias","Farah",
  "Gita","Hugo","Iris","Jae","Kofi","Leena","Mateo","Noor","Otto","Pia","Rafa","Sena","Tariq",
];

const LAST = [
  "Whitfield","Reyes","Raman","Okafor","Oyelaran","Arrieta","Brennan","Whitaker","Lindqvist",
  "Mbeki","Castellanos","Ferreira","Nakamura","Duarte","Halloran","Sandoval","Achebe","Kowalski",
  "Petrov","Mensah","Delgado","Ibarra","Novak","Osei","Ramachandran","Solberg","Tavares","Udoh",
  "Vargas","Weller","Ximenes","Yusuf","Zima","Barlow","Corrigan","Danforth","Eklund","Fontaine",
];

const FOUNDS: FoundKey[] = ["google", "referral", "ad", "walk-in", "not-known"];

const COMPANY_A = ["Harbor","Ridge","Cedar","Anchor","Foxglove","Kestrel","Birchwood","Lantern","Copper","Marlow"];
const COMPANY_B = ["Supply","Studio","Works","Partners","Trading","Collective","Group","Holdings"];

export function nameAt(_i: number, r: () => number): string {
  const f = FIRST[Math.floor(r() * FIRST.length)];
  const l = LAST[Math.floor(r() * LAST.length)];
  return `${f} ${l}`;
}

export function emailFor(name: string, i: number): string {
  const [f, l] = name.toLowerCase().split(" ");
  // example.com / example.org are reserved for documentation. Never a real host.
  return `${f}.${l}${i % 7 === 0 ? i : ""}@example.com`;
}

export function phoneFor(i: number): string {
  // 555-01xx is the reserved fictional block. Never a dialable number.
  return `(555) 01${String(10 + (i % 90)).padStart(2, "0")}`;
}

export function foundAt(r: () => number): FoundKey {
  return FOUNDS[Math.floor(r() * FOUNDS.length)];
}

export function companyName(r: () => number): string {
  return `${COMPANY_A[Math.floor(r() * COMPANY_A.length)]} ${COMPANY_B[Math.floor(r() * COMPANY_B.length)]}`;
}

/* ── builders ─────────────────────────────────────────────────────────────── */

export interface Builder {
  w: World;
  n: number;
  id(prefix: string): string;
  person(over: Partial<Contact> & { name: string }): Contact;
  ev(e: Omit<TimelineEvent, "id">): TimelineEvent;
}

export function builder(w: World): Builder {
  let n = 0;
  return {
    w,
    get n() { return n; },
    id(prefix: string) { return `${prefix}${++n}`; },
    person(over) {
      const c: Contact = {
        ...over,
        id: over.id ?? `c${++n}`,
        kind: over.kind ?? "person",
        name: over.name,
        addedBy: over.addedBy ?? "Alloro",
        consent: over.consent ?? "unknown",
      };
      w.contacts.push(c);
      return c;
    },
    ev(e) {
      const full: TimelineEvent = { id: `e${++n}`, ...e };
      w.events.push(full);
      return full;
    },
  };
}

export function emptyWorld(info: World["info"]): World {
  return {
    info,
    today: TODAY,
    contacts: [],
    events: [],
    spam: [],
    imports: [],
    reminders: [],
    dismissed: [],
    feeds: { payments: { ok: true }, forms: { ok: true } },
    sim: { slowSeason: false, failNextSave: false },
    suppressed: [],
    erasures: [],
    baaRecorded: false,
    seq: 0,
  };
}

/** Spam rows. Counted everywhere, never a person (spec S17). */
export function seedSpam(w: World, count: number, seed: number) {
  const r = rng(seed);
  const reasons = [
    "Looks like a bulk mailing",
    "Links to a site Alloro doesn't trust",
    "Same message sent to many businesses",
    "No real name or address",
  ];
  for (let i = 0; i < count; i++) {
    w.spam.push({
      id: `s${i + 1}`,
      name: nameAt(i, r),
      email: `offer${i}@example.org`,
      text: "Boost your ranking fast. Reply for a free audit and a special rate this week only.",
      date: addDays(TODAY, -Math.floor(r() * 90) - 1),
      reason: reasons[Math.floor(r() * reasons.length)],
    });
  }
}
