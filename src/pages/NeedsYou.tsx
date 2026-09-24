import { useUi } from "../lib/ui-context";
import { Card, EmptyState, PageSkeleton, Verdict } from "../components/ui";
import { CardRow } from "../components/Cards";
import { groupCards } from "../lib/cards";
import { plural } from "../lib/format";

/**
 * S18 — Needs you (spec Q1: an owner question, not "Cards").
 *
 * ⛔ NO INLINE CARD HERE. This tab IS the list; a card above it would be the
 * same card twice (spec §6.5).
 *
 * ⛔ Design §8.1, calm ONCE per surface: "Nothing needs you right now" appears
 * at the end, as the closing verdict, never five scattered reassurances.
 */
export default function NeedsYou() {
  const ui = useUi();
  if (ui.loading) return <PageSkeleton rows={3} />;

  const groups = groupCards(ui.cards);
  const total = ui.cards.length;
  const paymentsDown = !ui.world.feeds.payments.ok;
  const formsDown = !ui.world.feeds.forms.ok;

  return (
    <div>
      <Verdict>
        {total === 0 ? "Nothing needs you right now." : `${plural(total, "thing")} need${total === 1 ? "s" : ""} you.`}
      </Verdict>

      {/* ⛔ Nobody is flagged while a feed is down, and the list visibly shortens.
          That shortening IS the proof the suppression is real (acceptance A26). */}
      {paymentsDown ? (
        <Card className="mb-4 border-amber" >
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

      {total === 0 ? (
        <EmptyState title="Nothing needs you right now." body="Alloro will put anything here the moment it turns up." />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mb-6">
            <h2 className="eyebrow mb-1">{g.title}</h2>
            <p className="t-meta mb-2">{g.hint}</p>
            <div className="space-y-3">
              {g.items.map(({ card, n }) => <CardRow key={card.id} card={card} n={n} primary={n === 1} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
