import { useUi } from "../lib/ui-context";
import { Card } from "./ui";
import { CardRow } from "./Cards";
import { groupCards } from "../lib/cards";

/**
 * T125 (Rev 32) — the verdict cards, as a SECTION OF THE DASHBOARD.
 *
 * This was the "Needs you" tab (S18). The cards did not die when the tab went:
 * "one thing to do right now" is Pillar 3, and it is the surface the first-glance
 * test measures. What changed is where they live.
 *
 * ⛔ THE DASHBOARD SHOWS NO INLINE CARD ABOVE THIS. It is the list, and one card
 * over the list it belongs to is the same card twice (spec §6.5) — the rule the
 * tab already followed, carried across unchanged.
 *
 * ⛔ Design §8.1, calm ONCE per surface: with nothing to do, the Dashboard's
 * headline already says "Nothing needs you this week", so this section renders
 * nothing rather than say it a second time.
 *
 * ⛔ Nobody is flagged while a feed is down, and the list visibly shortens.
 * That shortening IS the proof the suppression is real (acceptance A26), so the
 * feed notices live here, above the cards they explain.
 */
export const NEEDS_ANCHOR = "needs-you";

export function NeedsSection() {
  const ui = useUi();
  const groups = groupCards(ui.cards);
  const paymentsDown = !ui.world.feeds.payments.ok;
  const formsDown = !ui.world.feeds.forms.ok;

  if (ui.cards.length === 0 && !paymentsDown && !formsDown) return null;

  return (
    <section id={NEEDS_ANCHOR} tabIndex={-1} className="mt-8 scroll-mt-4 outline-none" data-testid="needs-section">
      <h2 className="eyebrow mb-3">What needs you</h2>

      {paymentsDown ? (
        <Card className="mb-4 border-amber">
          <p className="t-body font-semibold" data-testid="feed-card">
            Alloro isn't receiving your payments since {ui.world.feeds.payments.downSince}.
          </p>
          <p className="t-meta mt-1">Nobody is flagged as hasn't been back while this lasts, so this list is shorter than usual.</p>
        </Card>
      ) : null}
      {formsDown ? (
        <Card className="mb-4 border-amber">
          <p className="t-body font-semibold">Alloro isn't receiving website messages right now.</p>
          <p className="t-meta mt-1">Nothing is flagged as unanswered while this lasts. Check your own inbox.</p>
        </Card>
      ) : null}

      {groups.map((g) => (
        <div key={g.key} className="mb-6" data-testid={`needs-group-${g.key}`}>
          <h3 className="eyebrow mb-1">{g.title}</h3>
          <p className="t-meta mb-2">{g.hint}</p>
          <div className="space-y-3">
            {g.items.map(({ card, n }) => <CardRow key={card.id} card={card} n={n} primary={n === 1} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
