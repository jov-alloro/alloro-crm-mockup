import { Button, Card, Chip } from "./ui";
import { useUi } from "../lib/ui-context";
import { dismissCard } from "../lib/actions";
import type { Card as CardModel, CardKind } from "../lib/cards";
import type { IconName } from "./icons";

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
 * Rev 33 — "NEEDS YOU" IS A TASK RECOMMENDATION, NOT A PLACE.
 *
 * Jov: it becomes cards like Alloro's action card, shown on the Dashboard and
 * the other customer screens, top three only. There is no tab, no section and
 * no full list any more (that reverses Rev 32's section). Three is the whole
 * point: a list of 34 is a backlog, and a backlog is what people stop opening.
 *
 * ⛔ THE FIRST CARD HOLDS THE SCREEN'S ONE PRIMARY (Design §4.3) unless the
 * screen already has its own leading action, which is what `quiet` says —
 * People leads with "Add by hand".
 */
export const TOP_TASKS = 3;

export function TopTasks({ quiet }: { quiet?: boolean }) {
  const ui = useUi();
  const top = ui.cards.slice(0, TOP_TASKS);
  const paymentsDown = !ui.world.feeds.payments.ok;
  const formsDown = !ui.world.feeds.forms.ok;
  if (top.length === 0 && !paymentsDown && !formsDown) return null;
  return (
    <section data-testid="top-tasks" aria-label="Do these first" className="mb-6">
      {/* ⛔ Nobody is flagged while a feed is down (acceptance A26). These notices
          used to sit above the Needs you list; they live with the recommendations
          now, because they explain why the recommendations are fewer. */}
      {paymentsDown ? (
        <Card className="mb-3 border-amber">
          <p className="t-body font-semibold" data-testid="feed-card">
            Alloro isn't receiving your payments since {ui.world.feeds.payments.downSince}.
          </p>
          <p className="t-meta mt-1">Nobody is flagged as hasn't been back while this lasts, so there are fewer things here than usual.</p>
        </Card>
      ) : null}
      {formsDown ? (
        <Card className="mb-3 border-amber">
          <p className="t-body font-semibold">Alloro isn't receiving website messages right now.</p>
          <p className="t-meta mt-1">Nothing is flagged as unanswered while this lasts. Check your own inbox.</p>
        </Card>
      ) : null}
      {top.length > 0 ? (
        <>
          <h2 className="eyebrow mb-2">
            {ui.cards.length > TOP_TASKS ? `Do these first · ${TOP_TASKS} of ${ui.cards.length}` : "Do these first"}
          </h2>
          <div className="space-y-3">
            {top.map((c, i) => <CardRow key={c.id} card={c} task primary={!quiet && i === 0} />)}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function CardRow({ card, n, task, primary = true }: { card: CardModel; n?: number; task?: boolean; primary?: boolean }) {
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
    <Card className={task ? "!border-alloro-orange/30 !bg-alloro-orange/[0.07]" : ""}>
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
            {task
              ? <span className="eyebrow text-alloro-orange-text-safe" data-testid="card-chip">{card.chip}</span>
              : <Chip tone={card.kind === "came-back" ? "plain" : "amber"}>{card.chip}</Chip>}
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
            className={`${task ? "t-verdict" : "t-body font-semibold"} block text-left underline-offset-4 hover:underline`}
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
