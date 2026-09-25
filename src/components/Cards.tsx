import { Button, Card, Chip } from "./ui";
import { useUi } from "../lib/ui-context";
import { dismissCard } from "../lib/actions";
import type { Card as CardModel, CardKind } from "../lib/cards";
import { Icon, type IconName } from "./icons";

/**
 * T30 (Rev 8) — the card's action leads with the icon its KIND implies, not
 * a generic one. Five cards in a column all reading the same mark would be
 * decoration; five that differ tell you what the column is before you read it.
 */
function cardIcon(kind: CardKind): IconName {
  switch (kind) {
    case "unanswered": return "mail";
    case "reminder": return "remind";
    case "not-back": return "call";
    case "quote": return "money";
    case "came-back": return "thanks";
  }
}

/**
 * Rev 34 — ONE CARD PER SCREEN, IN ALLORO'S OWN "1 ACTION" STYLE.
 *
 * Jov: "copy exactly the Mark done style", and "since there are three tabs, put
 * one of each only — those top three, not three in a row on every screen."
 * So the three highest-priority cards are SPREAD: the Dashboard shows the first,
 * People the second, Conversation the third. No screen shows more than one, and
 * no card is shown twice.
 *
 * The look is copied from frontend/src/components/dashboard/ActionBannerView.tsx
 * at origin/main 15d46f9 (reference/alloro-actionbannerview-2026-09-25.tsx): the
 * accent-soft tint, 14px radius, 22px/20px padding, terracotta eyebrow, Spectral
 * 21px title, 13.5px description, and a small outlined button.
 *
 * ⛔ THIS IS A DELIBERATE EXCEPTION to the five-role type roster (21px and 13.5px
 * are not roles) and to "one primary per screen": the button is Alloro's outlined
 * style, so no card holds a primary. Copying it exactly was the instruction, and
 * approximating it was the defect.
 */
export type TaskSlot = 0 | 1 | 2;

const ACTION_BUTTON_CLASS =
  "eyebrow inline-flex shrink-0 items-center gap-1.5 self-start rounded-[10px] border border-alloro-navy/15 bg-white/70 px-3 py-2 text-alloro-navy transition-colors hover:bg-white";

export function TopTasks({ slot }: { slot: TaskSlot }) {
  const ui = useUi();
  const card = ui.cards[slot];
  const paymentsDown = !ui.world.feeds.payments.ok;
  const formsDown = !ui.world.feeds.forms.ok;
  if (!card && !paymentsDown && !formsDown) return null;
  return (
    <section data-testid="top-tasks" aria-label="Do this first" className="mb-6 space-y-3">
      {/* ⛔ Nobody is flagged while a feed is down (acceptance A26). The notices live
          with the recommendation because they explain why there may be none. */}
      {paymentsDown ? (
        <Card className="border-amber">
          <p className="t-body font-semibold" data-testid="feed-card">
            Alloro isn't receiving your payments since {ui.world.feeds.payments.downSince}.
          </p>
          <p className="t-meta mt-1">Nobody is flagged as hasn't been back while this lasts, so there are fewer things here than usual.</p>
        </Card>
      ) : null}
      {formsDown ? (
        <Card className="border-amber">
          <p className="t-body font-semibold">Alloro isn't receiving website messages right now.</p>
          <p className="t-meta mt-1">Nothing is flagged as unanswered while this lasts. Check your own inbox.</p>
        </Card>
      ) : null}
      {card ? <TaskCard card={card} /> : null}
    </section>
  );
}

function TaskCard({ card }: { card: CardModel }) {
  const ui = useUi();
  const p = card.p;
  const view = card.messageId ? `#/conversation/${card.messageId}` : `#/p/${p.c.id}`;
  const doMove = () => {
    switch (card.move) {
      case "reply": ui.go(`#/conversation/${card.messageId ?? p.c.id}`); break;
      case "call": ui.go(`#/p/${p.c.id}?call=1`); break;
      case "checkin":
      case "follow-up":
      case "thanks": ui.go(`#/p/${p.c.id}`); break;
    }
  };
  /* Same rule as CardRow (A69): the card is a mouse convenience, the SENTENCE is the
     keyboard path, and a click that landed on a control is not the card's. */
  const openIfBody = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a[href], input, select, textarea")) return;
    ui.go(view);
  };
  return (
    <div
      data-testid="card"
      data-card-id={card.id}
      data-person-id={p.c.id}
      onClick={openIfBody}
      className="cursor-pointer rounded-[14px] border border-accent-soft-line bg-accent-soft px-[22px] py-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5 text-alloro-orange" data-testid="card-chip">{card.chip}</div>
          <h3 className="font-display text-[21px] font-medium leading-[1.2] text-alloro-navy">
            <button
              type="button"
              data-testid="card-why"
              onClick={() => ui.go(view)}
              className="block text-left underline-offset-4 hover:underline"
            >
              {card.why}
            </button>
          </h3>
          {card.moneyLine ? (
            <p className="mt-1.5 max-w-[720px] text-[13.5px] leading-[1.55] text-alloro-navy">{card.moneyLine}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" data-btn="true" data-testid="card-action" onClick={doMove} className={ACTION_BUTTON_CLASS}>
            <Icon name={cardIcon(card.kind)} size={13} />
            {card.action}
          </button>
          {card.dismissible ? (
            <button
              type="button"
              data-btn="true"
              data-testid="card-dismiss"
              onClick={() => { ui.act((w) => dismissCard(w, card.id)); ui.toast("Cleared."); }}
              className={ACTION_BUTTON_CLASS}
            >
              <Icon name="close" size={13} />
              Not now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CardRow({ card, n, primary = true }: { card: CardModel; n?: number; primary?: boolean }) {
  const ui = useUi();
  const p = card.p;

  const doMove = () => {
    switch (card.move) {
      case "reply": ui.go(`#/conversation/${card.messageId ?? p.c.id}`); break;
      case "call": ui.go(`#/p/${p.c.id}?call=1`); break;
      case "checkin":
      case "follow-up":
      case "thanks": ui.go(`#/p/${p.c.id}`); break;
    }
  };

  /**
   * T95 (Rev 23) — ⛔ THE WHOLE CARD OPENS THE THING IT IS ABOUT.
   *
   * Jov: "make these cards be clickable so that I can easily view it." The card
   * said "Rosa wrote 30 days ago and nobody has answered" and the only way to go
   * and look was the button, which does something narrower — it starts a reply.
   *
   * ⛔ VIEWING AND ACTING ARE DIFFERENT DESTINATIONS, so the card has both. The
   * body opens the message or the person; the button still does its one move. A
   * "Call" card is where they visibly differ: the button lands on the person with
   * the call sheet open, the body lands on the person.
   */
  const view = card.messageId ? `#/conversation/${card.messageId}` : `#/p/${p.c.id}`;

  /**
   * ⛔ NO role="button" AND NO tabIndex ON THE CARD, AND THAT IS DELIBERATE.
   *
   * People's rows are clickable that way, and it works there because a row holds
   * no controls of its own. This card holds two buttons, and A69 exists precisely
   * to stop a focusable control being nested inside a clickable row — the trap
   * People hit and fixed. Making the card a button would break the rule this
   * project wrote down two rounds ago.
   *
   * So the SENTENCE is the real control, reachable by keyboard and announced by a
   * screen reader, and the card's click handler is a mouse convenience layered on
   * top of it. Nothing here is reachable by mouse only.
   *
   * ⛔ AND IT IGNORES CLICKS THAT LANDED ON A CONTROL. Without this, pressing
   * "Not now" would dismiss the card AND navigate away from the screen you were
   * clearing it from — one press, two things, one of them unasked for.
   */
  const openIfBody = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a[href], input, select, textarea")) return;
    ui.go(view);
  };

  return (
    <Card>
      {/* A card is identified by its person, not by a first name: the demo has
          more than one Owen, and a check that matched on "Owen" matched the
          wrong card. */}
      <div
        data-testid="card"
        data-card-id={card.id}
        data-person-id={p.c.id}
        onClick={openIfBody}
        className="flex cursor-pointer flex-wrap items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            {n ? <span className="eyebrow" data-testid="card-number">{n}</span> : null}
            <Chip tone={card.kind === "came-back" ? "plain" : "amber"}>{card.chip}</Chip>
          </div>
          {/* Design §6.1 — the sentence, before any number.
              ⛔ T95: the sentence IS the keyboard path into the card. It carries no
              button chrome and no icon on purpose — it is the card's own words,
              not an action added beside them — so it also carries no data-btn,
              which is what A40a's "every action button leads with an icon" governs. */}
          <button
            type="button"
            data-testid="card-why"
            onClick={() => ui.go(view)}
            className="t-body block text-left font-semibold underline-offset-4 hover:underline"
          >
            {card.why}
          </button>
          {/* Design §7.1 — money never appears without the sentence above it. */}
          {card.moneyLine ? <p className="t-meta mt-0.5">{card.moneyLine}</p> : null}
        </div>
        {/*
          T114b (Rev 29) — ⛔ FULL NAMES MADE THE BUTTONS TOO WIDE FOR A PHONE.
          "Check in with Beatriz" became "Check in with Beatriz Ferreira", and
          "Add a phone number for Cleo Ferreira" is longer still. With shrink-0
          the button could not give way, so Needs you scrolled sideways at 375px
          and A39c caught it. The group still refuses to shrink where there is
          room; below sm it is allowed to take its own line.
        */}
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          {/* ⛔ Design §4.3 — ONE primary per SCREEN, not per card. Five stacked
              black buttons is the "which do I press" problem, and it was on
              screen. The first card keeps the primary; the rest step down. */}
          <Button primary={primary} icon={cardIcon(card.kind)} onClick={doMove} testId="card-action">{card.action}</Button>
          {/* ⛔ Only "Came back" may be dismissed (spec §6.5). */}
          {card.dismissible ? (
            <Button
              icon="close"
              testId="card-dismiss"
              onClick={() => { ui.act((w) => dismissCard(w, card.id)); ui.toast("Cleared."); }}
            >
              Not now
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
