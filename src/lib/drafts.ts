import type { World } from "../data/types";
import type { Profile } from "./engine";
import { firstName } from "./format";

/**
 * The AI helper's words (spec R11).
 *
 * ⛔ IT NEVER SENDS. There is no path from a suggestion to an outbound message;
 * the only send is the owner's own mail app.
 *
 * ⛔ IT NEVER INVENTS A PRICE, A DATE OR AN AVAILABILITY. Mechanically: a
 * suggestion is built ONLY from facts already on the record — their name, what
 * they asked about, when they wrote — and where a figure or a time would go it
 * writes a bracketed placeholder the owner must replace. A suggestion containing
 * a digit that is not already on the record is a build defect, and acceptance
 * A18 is the check.
 */

export function suggestReply(p: Profile, w: World): string {
  const who = firstName(p.c.name);
  const asked = p.messages[0]?.message ?? "";
  const aboutPrice = /charge|price|cost|quote|how much/i.test(asked);
  const aboutTime = /available|availability|when|book|slot|next month/i.test(asked);

  const lines = [`Hi ${who},`, ""];
  lines.push("Thanks for writing in.");
  if (aboutPrice) lines.push("I'll put a price together for you and send it over by [when].");
  if (aboutTime) lines.push("I'll check what I have free and come back to you with dates by [when].");
  if (!aboutPrice && !aboutTime) lines.push("I'd be glad to help. I'll come back to you by [when] with what you need.");
  lines.push("");
  lines.push("If it's easier to talk it through, just say and I'll call.");
  lines.push("");
  lines.push(w.info.ownerFirst);
  return lines.join("\n");
}

/**
 * T67 (Rev 13) — a campaign draft, built from the AUDIENCE.
 *
 * ⛔ A CAMPAIGN HAS NO SINGLE RECORD TO READ, which is why suggestReply() could
 * not simply be reused: it builds from one person's name, their question and
 * when they wrote. Here there is a count and a group, and nothing else.
 *
 * ⛔ AND R11'S RULE MATTERS MORE HERE, NOT THE SAME. A reply goes to one person;
 * a campaign goes to hundreds. A price this invented would be wrong once in a
 * reply and hundreds of times in a campaign, with Alloro's name on it. So the
 * same discipline holds harder: every figure, date and offer is a bracket the
 * owner must fill, and A18 now checks this surface too.
 */
export function suggestCampaign(group: string, n: number, w: World): string {
  const who = group === "everyone" ? "everyone on your list" : group.toLowerCase();
  const lines = [`Hi [first name],`, ""];
  lines.push("[What's new — say it in one sentence.]");
  lines.push("");
  lines.push("[Why it matters to them.]");
  lines.push("");
  lines.push("If you'd like it, reply to this email or call and we'll sort it out.");
  lines.push("");
  lines.push(w.info.ownerFirst);
  lines.push(w.info.name);
  void who;
  void n;
  return lines.join("\n");
}

/**
 * T67 — a subject line, from the message the owner ALREADY WROTE.
 *
 * ⛔ IT INVENTS NOTHING. It takes the first real sentence of the body and
 * shortens it; if the body is empty it returns a bracket, never a guess.
 */
export function suggestSubject(body: string): string {
  const first = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\[/.test(l) && !/^hi\b/i.test(l))[0];
  if (!first) return "[What is this about?]";
  const words = first.replace(/[.!?]+$/, "").split(/\s+/);
  return words.slice(0, 8).join(" ");
}

/** Rewrites what the owner typed. Same rule: it adds no figure and no date. */
export function cleanUp(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\bASAP\b/gi, "as soon as I can")
    .replace(/\bre:\s*/gi, "")
    .replace(/\butilise|utilize\b/gi, "use")
    .replace(/\bcommence\b/gi, "start")
    .replace(/\bper our conversation\b/gi, "as we talked about")
    .replace(/([.!?])\s*/g, "$1\n")
    .trim();
}

/** Shows what changed, so the owner sees it rather than trusting it. */
export function diffWords(before: string, after: string): string {
  const b = before.trim().split(/\s+/);
  const a = after.trim().split(/\s+/);
  const removed = b.filter((w) => !a.includes(w));
  const added = a.filter((w) => !b.includes(w));
  const bits: string[] = [];
  if (added.length) bits.push(`Added: ${added.slice(0, 12).join(" ")}`);
  if (removed.length) bits.push(`Removed: ${removed.slice(0, 12).join(" ")}`);
  if (!bits.length) bits.push("Only the spacing changed.");
  return bits.join(" · ");
}
