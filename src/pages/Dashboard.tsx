import { useMemo, type ReactNode } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, PageSkeleton, Verdict } from "../components/ui";
import { InlineCard } from "../components/Cards";
import { MonthBars, Ring, SpreadBars, TileGrid } from "../components/Charts";
import { bySource, foundStory, moneyByMonth, topItems, wroteInSplit } from "../lib/charts";
import { statusLabel } from "../lib/engine";
import type { StatusKey } from "../lib/engine";
import { money, plural } from "../lib/format";
import { inlineCard } from "../lib/cards";
import type { IconName } from "../components/icons";

/**
 * S21 — the bento dashboard (spec R1: Overview and Reports, merged).
 *
 * ⛔ IT COMPUTES NOTHING OF ITS OWN. Every tile reads what People, Conversation
 * and Needs you already calculated. If the first three tabs do not compute it,
 * the dashboard does not show it.
 *
 * ⛔ Design §7.1 — EVERY TILE CARRIES ITS NEXT STEP, or it does not ship.
 *
 * ⛔ T36 (Rev 8) — AND EVERY NUMBER NAMES ITS PEOPLE. A bar or a slice is a
 * control that opens the filtered list behind it, at #/people/f/<key>/<value>.
 * A chart you can only look at is decoration, which is roast item 7 and the
 * reason the next step sits beside it as well.
 */
export default function Dashboard() {
  const ui = useUi();
  const { model, world, cards, viewer } = ui;
  const showMoney = viewer !== "staff";
  const paymentsDown = !world.feeds.payments.ok;

  const stats = useMemo(() => {
    const people = model.visible;
    const wrote = people.filter((p) => p.got.includes("form"));
    const became = wrote.filter((p) => p.buys.length > 0);
    const cameBack = people.filter((p) => p.cameBack);
    const unanswered = cards.filter((c) => c.kind === "unanswered");
    const year = people.reduce((s, p) => s + p.spent12, 0);
    const slipping = [...people].filter((p) => p.isQuiet && p.spent12 > 0).sort((a, b) => b.spent12 - a.spent12)[0];
    return { total: people.length, wrote: wrote.length, became: became.length, cameBack, unanswered, year, slipping };
  }, [model, cards]);

  /** Every chart's points, built from the same events every other screen reads. */
  const charts = useMemo(() => ({
    found: foundStory(model, model.pack.customers),
    source: bySource(model),
    split: wroteInSplit(model),
    items: topItems(model),
    months: moneyByMonth(model),
  }), [model]);

  if (ui.loading) return <PageSkeleton rows={4} />;

  const card = inlineCard(cards, "dashboard");
  const hiddenCount = model.list.filter((p) => p.c.hidden).length;
  const erasedCount = model.list.filter((p) => p.c.erased).length;

  if (stats.total === 0) {
    return (
      <div>
        <Verdict>Nothing to show yet.</Verdict>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tile title="Who came from where"><p className="t-meta">People appear when someone writes in or pays.</p></Tile>
          <Tile title="Who came back" span={1}><p className="t-meta">Alloro learns a customer's rhythm after a few purchases.</p></Tile>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Verdict sub={`${plural(stats.total, ui.model.pack.customer, ui.model.pack.customers)} in your list.`}>
        {cards.length === 0 ? "Nothing needs you this week." : `${plural(cards.length, "thing")} need${cards.length === 1 ? "s" : ""} you this week.`}
      </Verdict>

      {card ? <InlineCard card={card} /> : null}

      {/*
        T44 (Rev 9) — ⛔ THE GRID TILES COMPLETELY, AT EVERY COLUMN COUNT.

        Measured before this change: 2 empty cells at three columns. A 2-wide
        tile that could not fit the one column left in a row wrapped, and left
        that column blank. Two fixes, and both are needed:

          1. EXPLICIT SPANS that sum to a full row at 3 and at 2 columns.
          2. `grid-flow-row-dense`, so a later 1-wide tile backfills any gap a
             span still leaves — including in the STAFF view, where the money and
             what-sells tiles are hidden and the hand-tuned sums no longer apply.

        ⛔ Dense packing alone is not enough and spans alone are not enough. A45
        measures rendered cell positions in both views rather than trusting either.
      */}
      <div className="grid grid-flow-row-dense gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile title="Who came from where" span={2}>
          {/*
            T49/T50 — ⛔ STILL TILES, NOT BARS, AND THAT IS THE RULE DECIDING IT
            RATHER THAN INERTIA. T50's rule reads: a bar when the SPREAD carries
            the meaning, a tile when the NUMBER does. These read 38, 33, 29, 22 —
            within 35% of each other and already sorted, so a bar would redraw a
            ranking the order has already given.

            ⛔ I RECOMMENDED BARS FOR THIS CARD AND THE RULE SAYS NO. T50 was
            written so the next chart would have "a rule to be judged against
            rather than a precedent to copy". This is the first time it has been
            used that way, and it overruled me.

            What the card was missing was never the instrument. It had no
            sentence, no denominator, and it ranked an absence against a channel.
          */}
          {/* Design §6.1 — the verdict first. This card had none at all: an
              eyebrow label and five numbers, stating data and saying nothing. */}
          <p className="t-body measure font-semibold" data-testid="found-verdict">{charts.found.sentence}</p>
          <TileGrid title="Who came from where" points={charts.found.known} go={ui.go} />
          {/*
            ⛔ THE ABSENCE GETS ITS OWN LINE, BELOW THE SOURCES, NOT A RANK AMONG
            THEM. It is a fact about the records rather than a way anybody arrived,
            and at one person in five it is the most actionable number here.
          */}
          {charts.found.unknown ? (
            <button
              type="button"
              data-testid="found-unknown"
              onClick={() => ui.go(charts.found.unknown!.href)}
              className="t-meta mt-3 block text-left underline-offset-2 hover:underline"
            >
              {charts.found.unknown.n} of these {charts.found.total} have no source written down — about {charts.found.unknown.share}%.
            </button>
          ) : null}
          <Next icon="people" onClick={() => ui.go("#/people")}>See them in your list</Next>
        </Tile>

        <Tile title={`Who became a ${ui.model.pack.customer}`} span={1}>
          <p className="t-hero">{stats.became} of {stats.wrote}</p>
          <p className="t-meta mb-3">of the people who wrote in have paid.</p>
          {/*
            T53 — ⛔ THIS TILE ENDED IN A POOL OF WHITE, and the fix is NOT to
            remove mt-auto from the next step: that is what keeps every tile's
            button on the card's bottom edge and the buttons aligned across a row.
            A short tile beside a five-row chart has space; the answer is to give
            it something to say. The ring is bigger and the split is named in
            words underneath, so the space is used rather than hidden.
          */}
          <Ring title="Who became a client" points={charts.split} go={ui.go} big />
          <p className="t-meta mt-3">
            {stats.wrote - stats.became > 0
              ? `${stats.wrote - stats.became} wrote in and have not paid yet.`
              : "Everybody who wrote in has paid."}
          </p>
          {/*
            ⛔ THIS LABEL IS BACK, and the history is the point. It first read
            "See the 43 who haven't" and went to the UNFILTERED list of 151, so
            the owner had to find the 43 by hand. Rev 7 fixed that by WEAKENING
            the label to "Open your list", because there was no filtered address
            to land on. T37 built one. A next step that names a number must land
            on that number — now it can, so it names it again.
          */}
          <Next icon="people" onClick={() => ui.go("#/people/f/unpaid")}>
            See the {Math.max(0, stats.wrote - stats.became)} who haven't
          </Next>
        </Tile>

        <Tile title="Who came back" span={1}>
          {stats.cameBack.length === 0 ? (
            <p className="t-meta">Nobody has come back this month.</p>
          ) : (
            <>
              <p className="t-hero">{stats.cameBack.length}</p>
              <p className="t-meta">came back after you reached out.</p>
            </>
          )}
          <Next icon="thanks" onClick={() => ui.go("#/needs")}>
            {stats.cameBack.length ? `Say thanks to ${stats.cameBack[0].c.name.split(" ")[0]}` : "See what needs you"}
          </Next>
        </Tile>

        <Tile title="Nobody answered" span={1}>
          {/* ⛔ The only hero number that is terracotta. Somebody wrote in and
              nobody replied — that is the definition of needing her. Everything
              else on this page is ink. */}
          <p className={`t-hero ${stats.unanswered.length > 0 ? "text-alloro-orange-text-safe" : ""}`}>
            {stats.unanswered.length}
          </p>
          <p className="t-meta">{stats.unanswered.length === 1 ? "message has" : "messages have"} gone more than two working days.</p>
          <Next icon="mail" onClick={() => ui.go("#/conversation")}>Reply to the oldest</Next>
        </Tile>

        {showMoney ? (
          <Tile title="Money this year" span={2}>
            {paymentsDown ? (
              <p className="t-body" data-testid="money-unknown">Alloro can't see your payments, so this is unknown.</p>
            ) : (
              <>
                <p className="t-hero">{money(stats.year)}</p>
                <p className="t-meta mb-3">
                  from the people in your list.
                  {hiddenCount || erasedCount
                    ? ` ${plural(hiddenCount + erasedCount, "person", "people")} hidden or erased ${hiddenCount + erasedCount === 1 ? "is" : "are"} left out.`
                    : ""}
                </p>
                <MonthBars title="Money by month" points={charts.months} />
              </>
            )}
            <Next
              icon={stats.slipping ? "person" : "people"}
              onClick={() => ui.go(stats.slipping ? `#/p/${stats.slipping.c.id}` : "#/people")}
            >
              {stats.slipping ? `${stats.slipping.c.name} is slipping — check in` : "See your list"}
            </Next>
          </Tile>
        ) : null}

        {showMoney ? (
          <Tile title="What sells" span={1}>
            {/* ⛔ Design §8.3 — the honest blank is what makes the other tiles believable. */}
            {charts.items.length === 0 ? (
              <p className="t-body" data-testid="sells-unknown">
                Your payments don't say what was bought, so this is unknown.
              </p>
            ) : (
              /* T50 — ⛔ THE ONE BAR THAT SURVIVES. $135,868 against $43,318 is a
                 spread worth drawing; five counts within 35% of each other were not. */
              <SpreadBars title="What sells" points={charts.items} />
            )}
            {/* ⛔ This offered "Put X in a Google post" and went to Settings, which
                has no Google post — an action that exists nowhere in this app. The
                campaign screen is real (its send is placeholder P8), so the step
                now goes somewhere the owner can actually act. */}
            <Next icon="mail" onClick={() => ui.go("#/people/email")}>
              {charts.items.length ? `Tell your list about ${charts.items[0].label}` : "See who you could tell"}
            </Next>
          </Tile>
        ) : null}

        <Tile title="Where your list came from" span={3}>
          <TileGrid title="Where your list came from" points={charts.source} go={ui.go} />
          <p className="t-meta mt-2">Spam left out: <b className="text-alloro-navy">{model.spamCount}</b></p>
          <Next icon="settings" onClick={() => ui.go("#/settings")}>See your sources</Next>
        </Tile>

        <Tile title="Where everyone stands" span={1}>
          <Ring
            title="Where everyone stands"
            points={statusPoints(model, (k) => statusLabel(k as StatusKey, model.pack))}
            go={ui.go}
          />
          <Next icon="people" onClick={() => ui.go("#/people")}>See them in your list</Next>
        </Tile>
      </div>
    </div>
  );
}

/** Kept here rather than in charts.ts because only this screen needs the pack word. */
function statusPoints(model: ReturnType<typeof useUi>["model"], label: (k: string) => string) {
  const order: StatusKey[] = ["new", "customer", "came-back", "not-back"];
  const counts = new Map<string, number>();
  for (const p of model.visible) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  return order
    .filter((k) => (counts.get(k) ?? 0) > 0)
    .map((k) => ({
      label: label(k),
      value: counts.get(k) ?? 0,
      display: String(counts.get(k) ?? 0),
      href: `#/people/f/status/${k}`,
      // ⛔ The one slice that is a demand, not a fact (T45).
      needsYou: k === "not-back",
    }));
}

/**
 * T44 — a tile is a COLUMN, so its next step can be pinned to the bottom edge.
 *
 * ⛔ THE OTHER HALF OF THE WHITE-SPACE COMPLAINT. A grid stretches every card to
 * its row's height, so a short tile beside a tall chart ended in a pool of empty
 * card. Pinning the next step to the bottom closes that pool AND lines the
 * buttons up across the row, which is what makes a bento look deliberate.
 */
function Tile({ title, children, span = 1 }: { title: string; children: ReactNode; span?: 1 | 2 | 3 }) {
  /*
    ⛔ NOTHING SPANS TWO AT THE TWO-COLUMN BREAKPOINT, and that is arithmetic,
    not taste. With spans of 2,1,1,1,2,1,2,1 the widths sum to 11 across rows of
    two — an odd total cannot fill even rows, so one cell is always blank and no
    amount of dense packing closes it. At one span each the totals are 8 for the
    owner and 6 for staff: both even, both exact.

    Three columns keeps the wide tiles, because there the totals DO work out:
    2+1+1+1+2+1+3+1 = 12 for the owner and 9 for staff, four rows and three.
  */
  const cls =
    span === 3 ? "lg:col-span-3"
    : span === 2 ? "lg:col-span-2"
    : "";
  return (
    <Card className={`flex flex-col ${cls}`}>
      <p className="eyebrow mb-2">{title}</p>
      {children}
    </Card>
  );
}

/** ⛔ Design §7.1 — no number without the response beside it. Every tile has one. */
function Next({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: IconName }) {
  return (
    /* ⛔ mt-auto is the whole trick: it pushes the next step to the card's
       bottom edge, so a short tile has no pool of white under its last line. */
    <div className="mt-auto pt-3">
      <Button small icon={icon} testId="tile-next" onClick={onClick}>{children}</Button>
    </div>
  );
}
