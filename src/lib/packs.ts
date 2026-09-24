import type { PackKey } from "../data/types";

/**
 * T3 — the word packs, the five stage chips and the two rhythms.
 *
 * ⛔ ONE stage vocabulary for all three businesses (spec Q2). v1 branched the
 * stage names per business; v2 does not, so the chips never change mid-demo.
 * A business that never quotes simply has empty Quoted and Booked columns.
 */

export type Stage = "asked" | "quoted" | "booked" | "paid" | "none";

/** Spec §6.2 — the five chips, in order. "No stage yet" is a real chip. */
export const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "asked", label: "Asked", hint: "They wrote in and haven't bought." },
  { key: "quoted", label: "Quoted", hint: "You sent them a price." },
  { key: "booked", label: "Booked", hint: "They said yes. Not paid yet." },
  { key: "paid", label: "Paid", hint: "Money has arrived from them." },
  { key: "none", label: "No stage yet", hint: "They signed up, and that's all so far." },
];

export function stageLabel(s: Stage): string {
  return STAGES.find((x) => x.key === s)!.label;
}

/** Which rhythm decides "hasn't been back". */
export type Rhythm = "pace" | "due-back";

export interface Pack {
  key: PackKey;
  /** The word for one of the organization's own customers. */
  customer: string;
  customers: string;
  /** What they buy. */
  thing: string;
  things: string;
  rhythm: Rhythm;
  /** Days after which a quote with no movement becomes "Quote waiting". */
  quoteWaitDays: number;
  /** Pace rhythm: how many purchases before Alloro will judge a gap. */
  minBuys: number;
}

export const PACKS: Record<PackKey, Pack> = {
  dealership: {
    key: "dealership",
    customer: "customer",
    customers: "customers",
    thing: "vehicle",
    things: "vehicles",
    rhythm: "due-back",
    quoteWaitDays: 5,
    minBuys: 2,
  },
  cafe: {
    key: "cafe",
    customer: "customer",
    customers: "customers",
    thing: "visit",
    things: "visits",
    rhythm: "pace",
    quoteWaitDays: 3,
    minBuys: 6,
  },
  contractor: {
    key: "contractor",
    customer: "client",
    customers: "clients",
    thing: "job",
    things: "jobs",
    rhythm: "due-back",
    quoteWaitDays: 7,
    minBuys: 2,
  },
};

export function packOf(key: PackKey): Pack {
  return PACKS[key];
}
