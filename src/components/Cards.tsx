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
 * ⛔ ONE card, inline, at the top of the tab, under the page header (spec R9).
 * Never a pop-up, never a stack, never a rail. A card that covers what the owner
 * came to do is the thing they learn to dismiss by week two.
 */
export function InlineCard({ card, quiet }: { card: CardModel; quiet?: boolean }) {
  const ui = useUi();
  return (
    <div className="mb-4" data-testid="inline-card" data-card-id={card.id}>
      {/* ⛔ `quiet` steps this card's button down to secondary, for a screen whose
          own leading action holds the primary. Design §4.3 caps the SCREEN at one
          primary; which one it is, is a judgement per screen. */}
      <CardRow card={card} inline primary={!quiet} />
      <button
        type="button"
        onClick={() => ui.go("#/needs")}
        className="t-meta mt-1 underline underline-offset-2"
        data-testid="inline-card-seeall"
      >
        See everything that needs you
      </button>
    </div>
  );
}

export function CardRow({ card, n, inline, primary = true }: { card: CardModel; n?: number; inline?: boolean; primary?: boolean }) {
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

  return (
    <Card className={inline ? "border-amber" : ""}>
      {/* A card is identified by its person, not by a first name: the demo has
          more than one Owen, and a check that matched on "Owen" matched the
          wrong card. */}
      <div
        data-testid="card"
        data-card-id={card.id}
        data-person-id={p.c.id}
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            {n ? <span className="eyebrow" data-testid="card-number">{n}</span> : null}
            <Chip tone={card.kind === "came-back" ? "plain" : "amber"}>{card.chip}</Chip>
          </div>
          {/* Design §6.1 — the sentence, before any number. */}
          <p className="t-body font-semibold" data-testid="card-why">{card.why}</p>
          {/* Design §7.1 — money never appears without the sentence above it. */}
          {card.moneyLine ? <p className="t-meta mt-0.5">{card.moneyLine}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
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
