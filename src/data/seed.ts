import type { BusinessKey, Contact, SeedVariant, World } from "./types";
import {
  TODAY, builder, companyName, emailFor, emptyWorld, foundAt, nameAt, phoneFor,
  rng, seedSpam,
} from "./kit";
import { addDays } from "../lib/format";

/**
 * T4 — the three businesses' invented data, at the volumes in spec §3.7.
 *
 * ⛔ Every name, number, email and address is invented. Emails use the reserved
 * documentation domain `example.com`; phones use the reserved fictional 555-01xx
 * block. No real customer or organization data appears anywhere. Hard rule 3.
 *
 * Volumes (spec §3.7, and acceptance A34 reads them from the SAVED demo):
 *   Riverside Motors  180 people ·  96 messages ·   210 payments · 14 spam
 *   Harbor Bean       640 people · 120 messages · 4,800 payments · 31 spam · 2 hidden · 1 erased
 *   Northgate         145 people · 210 messages ·   130 payments · 22 spam
 */

interface Plan {
  key: BusinessKey;
  info: World["info"];
  people: number;
  messages: number;
  payments: number;
  spam: number;
  hidden: number;
  erased: number;
  seed: number;
  /** Average money per payment, and its spread. */
  avg: number;
  spread: number;
  items: string[];
  /** How many people carry a quote, and how many of those are booked. */
  quoted: number;
  booked: number;
}

const PLANS: Record<BusinessKey, Plan> = {
  riverside: {
    key: "riverside",
    info: {
      key: "riverside", name: "Riverside Motors", pack: "dealership",
      ownerFirst: "Dana", ownerFull: "Dana Whitfield", staffName: "Marcus Reyes",
      address: "418 Riverside Way, Fairbrook",
    },
    people: 180, messages: 96, payments: 210, spam: 14, hidden: 0, erased: 0,
    seed: 1001, avg: 2400, spread: 1800,
    items: ["Used sedan", "Service plan", "Trade-in credit", "Extended cover", "Tyres and fitting"],
    quoted: 22, booked: 9,
  },
  harbor: {
    key: "harbor",
    info: {
      key: "harbor", name: "Harbor Bean", pack: "cafe",
      ownerFirst: "Priya", ownerFull: "Priya Raman", staffName: "Tomas Oyelaran",
      address: "12 Quay Street, Fairbrook",
    },
    people: 640, messages: 120, payments: 4800, spam: 31, hidden: 2, erased: 1,
    seed: 2002, avg: 9, spread: 7,
    items: ["Flat white", "Bag of beans", "Pastry and coffee", "Cold brew", "Lunch"],
    quoted: 0, booked: 0,
  },
  northgate: {
    key: "northgate",
    info: {
      key: "northgate", name: "Northgate Remodeling", pack: "contractor",
      ownerFirst: "Theresa", ownerFull: "Theresa Okafor", staffName: "Luis Arrieta",
      address: "7 Northgate Road, Fairbrook",
    },
    people: 145, messages: 210, payments: 130, spam: 22, hidden: 0, erased: 0,
    seed: 3003, avg: 5200, spread: 4000,
    items: ["Kitchen refit", "Bathroom", "Deck build", "Window replacement", "Repair visit"],
    quoted: 18, booked: 7,
  },
};

const MESSAGES = [
  "Hi, could you let me know what you'd charge for this? Thanks.",
  "I saw your website and wanted to ask about availability next month.",
  "Do you have anything coming in that would suit a small family?",
  "A friend sent me your way. Are you taking new work at the moment?",
  "Quick question about what's included before I decide.",
  "I've been meaning to get back in touch about the work we discussed.",
];

const PROBLEMS = [
  "I'm not happy with how this turned out. Can someone call me?",
  "This is the second time I've had to ask. I'd like it sorted please.",
];

export function seedWorld(key: BusinessKey, variant: SeedVariant = "full"): World {
  const plan = PLANS[key];
  const w = emptyWorld({ ...plan.info });
  if (variant === "empty") return w;

  const scale = variant === "first-week" ? 0.03 : 1;
  // The twin below is one of the people, not an extra one.
  const people = Math.max(3, Math.round(plan.people * scale)) - 1;
  // One message is placed by hand at 3pm on a Friday for acceptance A21.
  const messages = Math.max(2, Math.round(plan.messages * scale)) - 1;
  const payments = Math.round(plan.payments * scale);

  const r = rng(plan.seed);
  const b = builder(w);
  const owner = plan.info.ownerFull;
  const staff = plan.info.staffName;

  /* ── a handful of businesses, so S3 has content ───────────────────────── */
  const businesses: Contact[] = [];
  const bizCount = variant === "first-week" ? 1 : 6;
  for (let i = 0; i < bizCount; i++) {
    businesses.push(
      b.person({
        id: `b${i + 1}`,
        kind: "business",
        name: companyName(r),
        email: `hello@example.com`,
        phone: phoneFor(900 + i),
        found: foundAt(r),
        addedBy: i % 2 === 0 ? owner : staff,
        consent: "unknown",
      }),
    );
  }

  /* ── people ───────────────────────────────────────────────────────────── */
  const made: Contact[] = [];
  for (let i = 0; i < people; i++) {
    const name = nameAt(i, r);
    const atBusiness = i < bizCount * 2 && businesses.length > 0;
    const c = b.person({
      id: `c${i + 1}`,
      name,
      email: r() > 0.06 ? emailFor(name, i) : undefined,
      phone: r() > 0.25 ? phoneFor(i) : undefined,
      found: foundAt(r),
      businessId: atBusiness ? businesses[i % businesses.length].id : undefined,
      jobTitle: atBusiness ? "Buyer" : undefined,
      mainContact: atBusiness && i < businesses.length,
      addedBy: r() > 0.5 ? owner : staff,
      consent: r() > 0.88 ? "stop" : "unknown",
      category: ["Regular", "New this year", "Trade", "Online"][Math.floor(r() * 4)],
    });
    made.push(c);
  }

  // ⛔ Named edge cases the acceptance items need, not left to chance.
  if (made.length > 6) {
    // A person with a phone and no email: S16 is the only way to answer them.
    made[3].email = undefined;
    made[3].phone = phoneFor(303);
    // A person with neither: an island. Nothing can ever attach to them.
    made[4].email = undefined;
    made[4].phone = undefined;
    // A name-only look-alike pair, so S5's card is reachable without inventing data.
    const twin = b.person({
      id: "c-twin",
      name: made[5].name,
      email: `${made[5].name.toLowerCase().replace(" ", ".")}.2@example.com`,
      phone: phoneFor(777),
      found: "referral",
      addedBy: owner,
      consent: "unknown",
    });
    made.push(twin);
    b.ev({ contactId: twin.id, kind: "added", date: addDays(TODAY, -40), minute: 600, by: owner, got: "by-hand" });
  }

  // A Riverside person with every billing field filled (spec §3.7, acceptance A10).
  if (key === "riverside" && made.length > 2) {
    made[1].billing = {
      plan: "Used car payment plan",
      amount: 310,
      cycle: "monthly",
      nextDue: addDays(TODAY, 11),
    };
  }

  /* ── events ───────────────────────────────────────────────────────────── */
  const daySpan = variant === "first-week" ? 7 : 700;

  // Messages. The most recent few stay unanswered so the inbox and the alarm work.
  for (let i = 0; i < messages; i++) {
    const c = made[Math.floor(r() * made.length)];
    const ago = Math.floor(r() * daySpan) + 1;
    const date = addDays(TODAY, -ago);
    const problem = r() > 0.9;
    const m = b.ev({
      contactId: c.id,
      kind: "inquiry",
      date,
      minute: 8 * 60 + Math.floor(r() * 540),
      message: problem ? PROBLEMS[Math.floor(r() * PROBLEMS.length)] : MESSAGES[Math.floor(r() * MESSAGES.length)],
      problem,
      found: c.found,
      got: "form",
    });
    // Most older messages were answered. Recent ones were not, which is the point.
    if (ago > 6 && r() > 0.22) {
      b.ev({
        contactId: c.id, kind: "email", date: addDays(date, 1), minute: 600,
        by: owner, answers: m.id, subject: "Re: your message",
      });
    }
  }

  // ⛔ One message placed at 3pm on a Friday, so acceptance A21 has a subject.
  {
    let d = addDays(TODAY, -6);
    while (new Date(d + "T00:00:00Z").getUTCDay() !== 5) d = addDays(d, -1);
    b.ev({
      contactId: made[0].id, kind: "inquiry", date: d, minute: 15 * 60,
      message: MESSAGES[0], got: "form", found: made[0].found,
    });
  }

  // Payments. Two are placed by hand below (the came-back and the still-quiet
  // scenarios), so the loop fills the rest and the total is the named number.
  const byHandPayments = made.length > 12 ? 1 : 0;
  for (let i = 0; i < payments - byHandPayments; i++) {
    const c = made[Math.floor(r() * made.length)];
    const date = addDays(TODAY, -(Math.floor(r() * daySpan) + 1));
    const amount = Math.max(3, Math.round(plan.avg + (r() - 0.5) * plan.spread));
    b.ev({
      contactId: c.id, kind: "payment", date, minute: 9 * 60 + Math.floor(r() * 480),
      amount, item: plan.items[Math.floor(r() * plan.items.length)], got: "payment",
    });
  }

  // Quotes and bookings, so all five stage chips have something (acceptance A4).
  for (let i = 0; i < Math.round(plan.quoted * scale); i++) {
    const c = made[10 + i] ?? made[i];
    const date = addDays(TODAY, -(Math.floor(r() * 40) + 2));
    b.ev({ contactId: c.id, kind: "quote", date, minute: 660, by: owner, amount: Math.round(plan.avg * 1.2), item: plan.items[0] });
    if (i < Math.round(plan.booked * scale)) {
      b.ev({ contactId: c.id, kind: "booked", date: addDays(date, 3), minute: 660, by: owner });
    }
  }

  // Newsletter sign-ups who never wrote and never paid: the "No stage yet" chip
  // (spec defect 12, acceptance A5). Placed on people with no other event.
  const quiet = made.filter((c) => !w.events.some((e) => e.contactId === c.id));
  for (const c of quiet.slice(0, Math.max(2, Math.round(quiet.length * 0.4)))) {
    b.ev({
      contactId: c.id, kind: "newsletter", date: addDays(TODAY, -(Math.floor(r() * 300) + 5)),
      minute: 540, got: "newsletter",
    });
  }
  // Anyone still with no event at all gets an "added by hand" line, so no person
  // in the list is a record with no history.
  for (const c of made) {
    if (!w.events.some((e) => e.contactId === c.id)) {
      b.ev({ contactId: c.id, kind: "added", date: addDays(TODAY, -(Math.floor(r() * 400) + 5)), minute: 540, by: c.addedBy, got: "by-hand" });
    }
  }
  for (const biz of businesses) {
    if (!w.events.some((e) => e.contactId === biz.id)) {
      b.ev({ contactId: biz.id, kind: "added", date: addDays(TODAY, -420), minute: 540, by: owner, got: "by-hand" });
    }
  }

  // A check-in the owner already sent, so "Came back" and "still quiet" exist.
  if (made.length > 12) {
    b.ev({ contactId: made[8].id, kind: "checkin", date: addDays(TODAY, -20), minute: 600, by: owner, subject: "Checking in" });
    b.ev({ contactId: made[8].id, kind: "payment", date: addDays(TODAY, -4), minute: 700, amount: plan.avg, item: plan.items[0], got: "payment" });
    b.ev({ contactId: made[9].id, kind: "checkin", date: addDays(TODAY, -80), minute: 600, by: owner, subject: "Checking in" });
  }

  seedSpam(w, Math.round(plan.spam * scale), plan.seed + 7);

  /* ── hidden and erased, so S6 and S7 are reachable by clicking ────────── */
  if (variant === "full") {
    for (let i = 0; i < plan.hidden; i++) {
      const c = made[made.length - 1 - i];
      c.hidden = { on: addDays(TODAY, -12), by: owner };
      b.ev({ contactId: c.id, kind: "hidden", date: c.hidden.on, minute: 600, by: owner });
    }
    for (let i = 0; i < plan.erased; i++) {
      const c = made[made.length - 1 - plan.hidden - i];
      c.erased = { on: addDays(TODAY, -30), by: "Alloro staff" };
      w.erasures.push({ id: `x${i + 1}`, on: c.erased.on, by: "Alloro staff" });
      c.name = "Erased on request";
      c.email = undefined;
      c.phone = undefined;
      c.found = undefined;
      b.ev({ contactId: c.id, kind: "erased", date: c.erased.on, minute: 600, by: "Alloro staff" });
    }
  }

  w.seq = 100000;
  return w;
}

export const BUSINESS_KEYS: BusinessKey[] = ["riverside", "harbor", "northgate"];
export const DEFAULT_BUSINESS: BusinessKey = "northgate";
export const BUSINESS_LABELS: Record<BusinessKey, string> = {
  riverside: "Riverside Motors",
  harbor: "Harbor Bean",
  northgate: "Northgate Remodeling",
};
