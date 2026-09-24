import { dateWords, money, plural, daysBetween } from "./format";
import { canSeeMoney } from "./permissions";
import { canEmail, openMessage, pastAlarm, type Model, type Profile } from "./engine";

/**
 * T20 — the five card kinds (spec §6.5).
 *
 * ⛔ A card that cannot be finished is a badge, and badges are banned. Every
 * kind below has a written done state, and nothing finishes because the owner
 * ticked a box — it finishes because something happened.
 */

export type CardKind = "unanswered" | "reminder" | "not-back" | "quote" | "came-back";
export type Move = "reply" | "call" | "checkin" | "follow-up" | "thanks";

export interface Card {
  id: string;
  kind: CardKind;
  p: Profile;
  /** The one thing to do. Every card has exactly one. */
  move: Move;
  /** The button's words: the action and the person. */
  action: string;
  why: string;
  moneyLine?: string;
  chip: string;
  group: GroupKey;
  /** ⛔ Only "Came back" may be dismissed without acting (spec §6.5). */
  dismissible: boolean;
  /** The message this card is about, when it has one. */
  messageId?: string;
}

export type GroupKey = "mine" | "reply" | "follow" | "checkin";

export const GROUPS: { key: GroupKey; title: string; hint: string }[] = [
  { key: "mine", title: "Given to you", hint: "What the owner handed to you." },
  { key: "reply", title: "Reply first", hint: "People waiting to hear from you." },
  { key: "follow", title: "Follow up", hint: "Quotes and reminders." },
  { key: "checkin", title: "Check in", hint: "People who haven't been back." },
];

export function buildCards(m: Model, viewer: "owner" | "staff" | "alloro"): Card[] {
  const w = m.world;
  const cards: Card[] = [];
  /**
   * T114 (Rev 29) — ⛔ FULL NAMES, BECAUSE A FIRST NAME CAN POINT AT TWO PEOPLE.
   *
   * The review found two different Nadias, several Cleos — "Cleo came back" and
   * "Cleo still hasn't been back" are DIFFERENT PEOPLE, on the same screen — and
   * a customer called Theresa, which is also the owner's name in that business.
   * A card is an instruction: "Reply to Rosa" has to name one person or it is
   * not an instruction at all.
   *
   * ⛔ A CHECK CANNOT CATCH THIS BY READING THE CARDS. Two cards saying "Cleo"
   * are only wrong if the two Cleos are different people, which needs the data,
   * not the text. A80 compares the names cards use against the people they point
   * at.
   */
  const who = (p: Profile) => p.c.name;

  /**
   * T117 (Rev 29) — ⛔ A TASK THAT CANNOT BE DONE IS NOT A TASK.
   *
   * The review found Cleo Ferreira's "Check in with Cleo" on the Dashboard and on
   * Needs you. She asked not to be emailed and has no phone number, so there is
   * no way to reach her at all — the card names an action the product cannot
   * perform, and pressing it lands on a screen where every way out is disabled.
   *
   * ⛔ THE CARD NOW SAYS THE TRUE THING AND OFFERS THE ONLY USEFUL MOVE: add a
   * phone number. A task list that quietly includes impossible tasks teaches the
   * owner to stop trusting it, which is worse than showing one fewer card.
   */
  const reachable = (p: Profile) => canEmail(p) || !!p.c.phone;
  const noWayIn = (p: Profile) => ({
    why: `No way to reach ${p.c.name} — add a phone number.`,
    action: `Add a phone number for ${p.c.name}`,
    move: "checkin" as const,
  });

  for (const p of m.visible) {
    if (p.c.kind === "business" && p.people.length) continue; // people carry the card
    if (p.c.mark) continue;                                   // Not a fit / Do not contact finish every card

    // 1. Nobody answered — the 48-hour alarm (spec Q3).
    const open = openMessage(p, w);
    if (open && pastAlarm(open, w) && w.feeds.forms.ok) {
      cards.push({
        id: `unanswered:${open.id}`, kind: "unanswered", p,
        move: p.c.email ? "reply" : "call",
        action: `${p.c.email ? "Reply to" : "Call"} ${who(p)}`,
        why: open.problem
          ? `${who(p)} isn't happy and nobody has answered.`
          : `${who(p)} wrote ${plural(Math.max(1, daysBetween(open.date, w.today)), "day")} ago and nobody has answered.`,
        chip: open.problem ? "Unhappy" : "New message",
        group: "reply", dismissible: false, messageId: open.id,
      });
    }

    // 2. The owner's own follow-up reminder.
    const rem = w.reminders.find((r) => r.contactId === p.c.id);
    if (rem && rem.on <= w.today) {
      cards.push({
        id: `reminder:${p.c.id}`, kind: "reminder", p,
        move: rem.move === "call" ? "call" : "reply",
        action: `${rem.move === "call" ? "Call" : "Write to"} ${who(p)}`,
        why: rem.why ? `You asked to be reminded: ${rem.why}` : `You asked to be reminded about ${who(p)}.`,
        chip: "Reminder", group: "follow", dismissible: false,
      });
    }

    // 3. Hasn't been back.
    if (p.isQuiet && !p.waitingSince) {
      cards.push({
        id: `not-back:${p.c.id}`, kind: "not-back", p,
        /* T117 — if there is no way to reach them, the card says that instead of
           naming a check-in the product cannot perform. */
        ...(reachable(p) ? {
          move: "checkin" as const, action: `Check in with ${who(p)}`,
          why: p.dueBack
            /* T112 — the same sentence, the same formatter. */
            ? `${who(p)} was due back by ${dateWords(p.dueBack, w.today)}.`
            : `${who(p)} usually comes every ${plural(p.usualGap ?? 0, "day")}. It's been longer.`,
        } : noWayIn(p)),
        moneyLine: p.spent12 > 0 ? `${money(p.spent12)} in the last 12 months` : undefined,
        chip: "Hasn't been back", group: "checkin", dismissible: false,
      });
    }

    // 3b. Still quiet after a check-in.
    if (p.isStillQuiet) {
      cards.push({
        id: `still:${p.c.id}`, kind: "not-back", p,
        ...(reachable(p) ? {
          move: "checkin" as const, action: `Try ${who(p)} again`,
          why: `${who(p)} still hasn't been back since you wrote.`,
        } : noWayIn(p)),
        chip: "No reply yet", group: "checkin", dismissible: false,
      });
    }

    // 4. Quote waiting.
    const quote = p.events.find((e) => e.kind === "quote");
    if (p.stage === "quoted" && quote && daysBetween(quote.date, w.today) > p.pack.quoteWaitDays) {
      cards.push({
        id: `quote:${p.c.id}`, kind: "quote", p,
        move: "follow-up", action: `Follow up with ${who(p)}`,
        why: `${who(p)} has had a price for ${plural(daysBetween(quote.date, w.today), "day")} and hasn't answered.`,
        moneyLine: quote.amount ? `${money(quote.amount)} quoted` : undefined,
        chip: "Quote waiting", group: "follow", dismissible: false,
      });
    }

    // 5. Came back — the only good-news card, and the only dismissible one.
    if (p.cameBack) {
      cards.push({
        id: `back:${p.c.id}`, kind: "came-back", p,
        move: "thanks", action: `Say thanks to ${who(p)}`,
        why: `${who(p)} came back after you reached out.`,
        moneyLine: p.lastBuy && p.spent12 > 0 ? `${money(p.spent12)} in the last 12 months` : undefined,
        chip: "Came back", group: "follow", dismissible: true,
      });
    }
  }

  const live = cards.filter((c) => !w.dismissed.includes(c.id));

  /**
   * T110 (Rev 29) — ⛔ THE MONEY LINE IS REMOVED HERE, NOT HIDDEN ON THE SCREEN.
   *
   * These cards carry sentences like "$6,240 quoted" and "$5,115 in the last 12
   * months", built above without asking who is looking. Three screens then drew
   * them: Needs you, the Dashboard and People's inline card. ⛔ A COMPONENT
   * CANNOT UN-SAY A SENTENCE THAT ALREADY HAS THE MONEY IN IT — the only place
   * this can be fixed once is where the string is made.
   */
  if (!canSeeMoney(viewer)) for (const c of live) c.moneyLine = undefined;

  // Staff see what was handed to them first.
  if (viewer === "staff") {
    for (const c of live) if (c.p.c.addedBy === w.info.staffName) c.group = "mine";
  }
  const order: GroupKey[] = ["mine", "reply", "follow", "checkin"];
  // Inside a group, whoever has waited longest comes first. Without this the
  // list read 12, 4, 11, 22, 30 days old, which is no order at all.
  const waitedSince = (c: Card) => {
    const e = c.p.events.find((x) => x.id === c.messageId) ?? c.p.messages[0];
    return e ? e.date : "9999-99-99";
  };
  return live.sort(
    (a, b) =>
      order.indexOf(a.group) - order.indexOf(b.group) ||
      waitedSince(a).localeCompare(waitedSince(b)),
  );
}

export function groupCards(cards: Card[]): { key: GroupKey; title: string; hint: string; items: { card: Card; n: number }[] }[] {
  const groups = GROUPS.map((g) => ({ ...g, items: [] as { card: Card; n: number }[] }));
  for (const c of cards) groups.find((g) => g.key === c.group)!.items.push({ card: c, n: 0 });
  let n = 0;
  for (const g of groups) for (const it of g.items) it.n = ++n;
  return groups.filter((g) => g.items.length > 0);
}

/**
 * The ONE inline card for a tab (spec R9). ⛔ Never a stack, never a pop-up,
 * and Needs you itself renders none — it is the list.
 */
export function inlineCard(cards: Card[], tab: "people" | "conversation" | "dashboard", visibleIds?: Set<string>): Card | undefined {
  if (tab === "conversation") return cards.find((c) => c.kind === "unanswered");
  if (tab === "dashboard") return cards[0];
  if (visibleIds) return cards.find((c) => visibleIds.has(c.p.c.id));
  return cards[0];
}
