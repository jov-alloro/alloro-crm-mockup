import type { FoundKey } from "../data/types";
import type { ImportRow } from "./actions";

/**
 * A real CSV, read in the browser. Nothing leaves it.
 *
 * Placeholder P1: in the real product Alloro reads this file on its servers,
 * with row limits and a download of the rows that failed. The steps and the
 * rules are the same.
 */

export type FieldKey =
  | "name" | "firstName" | "lastName" | "email" | "phone"
  | "emailStatus" | "found" | "notes" | "amount" | "date" | "item";

export const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Full name" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "emailStatus", label: "Email status (subscribed or not)" },
  { key: "found", label: "How they found you" },
  { key: "notes", label: "Notes" },
  { key: "amount", label: "Amount paid" },
  { key: "date", label: "Date paid" },
  { key: "item", label: "What they bought" },
];

export type PresetKey = "hubspot" | "mailchimp" | "square" | "shopify" | "wix" | "stripe" | "csv";

export const PRESET_LABEL: Record<PresetKey, string> = {
  hubspot: "HubSpot", mailchimp: "Mailchimp", square: "Square",
  shopify: "Shopify", wix: "Wix", stripe: "A Stripe export", csv: "A plain spreadsheet",
};

/** Column names each tool's export uses, most likely first. Matched without case or spaces. */
export const PRESETS: Record<PresetKey, Partial<Record<FieldKey, string[]>>> = {
  hubspot: {
    firstName: ["First Name"], lastName: ["Last Name"], email: ["Email"],
    phone: ["Phone Number", "Phone", "Mobile Phone Number"],
    emailStatus: ["Unsubscribed from all email", "Marketing contact status", "Email status"],
    found: ["Original Source", "Original source type", "Source"],
    notes: ["Notes", "Description"],
  },
  mailchimp: {
    email: ["Email Address", "Email"], firstName: ["First Name"], lastName: ["Last Name"],
    phone: ["Phone Number", "Phone"],
    emailStatus: ["Status", "Member status", "Unsubscribed"], notes: ["Notes"],
  },
  square: {
    firstName: ["First Name"], lastName: ["Last Name"], email: ["Email Address", "Email"],
    phone: ["Phone Number", "Phone"], emailStatus: ["Email Subscription Status"],
    notes: ["Memo", "Note", "Notes"],
  },
  shopify: {
    firstName: ["First Name"], lastName: ["Last Name"], email: ["Email"],
    phone: ["Phone", "Default Address Phone"], emailStatus: ["Accepts Email Marketing"],
    notes: ["Note", "Notes"],
  },
  wix: {
    firstName: ["First Name"], lastName: ["Last Name"], email: ["Email 1", "Email"],
    phone: ["Phone 1", "Phone"], emailStatus: ["Email subscriber status", "Email subscription status"],
    found: ["Source"], notes: ["Notes", "Labels"],
  },
  /** ⛔ The exact Stripe export columns the spec's five questions name (§6.3). */
  stripe: {
    name: ["Name", "Customer Name", "Card Name", "Customer Description"],
    email: ["Email", "Customer Email"],
    phone: ["Phone", "Customer Phone"],
    amount: ["Amount", "Converted Amount"],
    date: ["Created date (UTC)", "Created (UTC)", "Created"],
    item: ["Description"],
  },
  csv: {
    name: ["Name", "Full name", "Customer", "Contact"],
    firstName: ["First name", "First"], lastName: ["Last name", "Last", "Surname"],
    email: ["Email", "E-mail", "Email address"],
    phone: ["Phone", "Phone number", "Mobile", "Cell"],
    notes: ["Notes", "Note"], amount: ["Amount", "Total"], date: ["Date"], item: ["Item", "Product"],
  },
};

/** Stripe's refund column, so a file without one can say so (spec §6.3). */
const REFUND_COLUMNS = ["amount refunded", "refunded amount", "refunded"];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim().length));
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");

export function guessMapping(headers: string[], preset: PresetKey): Record<number, FieldKey | ""> {
  const map: Record<number, FieldKey | ""> = {};
  const table = PRESETS[preset];
  headers.forEach((h, i) => {
    map[i] = "";
    for (const [field, names] of Object.entries(table) as [FieldKey, string[]][]) {
      if (names.some((n) => norm(n) === norm(h))) { map[i] = field; return; }
    }
    // Fall back to the plain-spreadsheet names, so an unknown tool still maps.
    for (const [field, names] of Object.entries(PRESETS.csv) as [FieldKey, string[]][]) {
      if (names.some((n) => norm(n) === norm(h))) { map[i] = field; return; }
    }
  });
  return map;
}

export function hasRefundColumn(headers: string[]): boolean {
  return headers.some((h) => REFUND_COLUMNS.some((r) => norm(r) === norm(h)));
}

function readFound(v?: string): FoundKey | undefined {
  if (!v) return undefined;
  const t = v.toLowerCase();
  if (t.includes("organic") || t.includes("google") || t.includes("search")) return "google";
  if (t.includes("referr")) return "referral";
  if (t.includes("paid") || t.includes("ad")) return "ad";
  if (t.includes("offline") || t.includes("walk")) return "walk-in";
  return "not-known";
}

function readAmount(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : undefined;
}

function readDate(v?: string): string | undefined {
  if (!v) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export function buildRows(
  rows: string[][], headers: string[], map: Record<number, FieldKey | "">,
): ImportRow[] {
  const out: ImportRow[] = [];
  for (const r of rows) {
    const get = (f: FieldKey) => {
      const i = Object.entries(map).find(([, v]) => v === f)?.[0];
      return i === undefined ? undefined : (r[Number(i)] ?? "").trim() || undefined;
    };
    const first = get("firstName");
    const last = get("lastName");
    const name = get("name") ?? ([first, last].filter(Boolean).join(" ") || undefined);
    // A column Alloro has no place for is kept on the person as a note.
    const extras: string[] = [];
    headers.forEach((h, i) => {
      if (!map[i] && (r[i] ?? "").trim()) extras.push(`${h}: ${r[i].trim()}`);
    });
    const notes = [get("notes"), extras.join(" · ")].filter(Boolean).join(" · ") || undefined;
    out.push({
      name, email: get("email"), phone: get("phone"),
      emailStatus: get("emailStatus"), found: readFound(get("found")),
      notes, amount: readAmount(get("amount")), date: readDate(get("date")), item: get("item"),
    });
  }
  return out;
}

/** A sample file per preset, so the demo works without the owner having one. */
export function sampleFile(preset: PresetKey): string {
  if (preset === "stripe") {
    return [
      "Name,Email,Phone,Amount,Created date (UTC),Description",
      "Ana Sample,ana.sample@example.com,(555) 0902,240,2026-08-14,Service plan",
      "Ana Sample,ana.sample@example.com,(555) 0902,180,2026-09-02,Tyres and fitting",
      "Bruno Sample,bruno.sample@example.com,,1450,2026-09-10,Used sedan",
      ",no.name@example.com,,90,2026-09-11,Oddment",
      "Cleo Sample,,,120,2026-09-12,Repair visit",
    ].join("\n");
  }
  return [
    "First Name,Last Name,Email,Phone Number,Status,Original Source,Notes",
    "Ana,Sample,ana.sample@example.com,(555) 0902,subscribed,Organic Search,Long-standing",
    "Bruno,Sample,bruno.sample@example.com,,unsubscribed,Referrals,",
    "Cleo,Sample,cleo.sample@example.com,(555) 0903,subscribed,Paid Search,",
    ",,,,subscribed,,A row with no name at all",
    "Dara,Sample,,,subscribed,,No email and no phone",
    "Ana,Sample,ana.sample@example.com,(555) 0902,subscribed,Organic Search,The same person twice",
  ].join("\n");
}
