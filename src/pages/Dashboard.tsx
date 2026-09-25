import { canSeeMoney } from "../lib/permissions";
import { useMemo, type ReactNode } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, PageSkeleton, Verdict } from "../components/ui";
import { TopTasks } from "../components/Cards";
import { Ring, SpreadBars, TileGrid } from "../components/Charts";
import { bySource, foundStory, topItems, wroteInSplit } from "../lib/charts";
import { statusLabel } from "../lib/engine";
import type { StatusKey } from "../lib/engine";
import { dateWords, money, plural } from "../lib/format";
import type { IconName } from "../components/icons";

/**
 * S21 — the bento dashboard (spec R1: Overview and Reports, merged).
 *
 * ⛔ IT COMPUTES NOTHING OF ITS OWN. Every tile reads what People and
 * Conversation already calculated, and the verdict cards are built once in
 * lib/cards.ts. If those do not compute it, the dashboard does not show it.
 *
 * ⛔ REV 32: THE VERDICT CARDS LIVE HERE, as the last section. They were the
 * "Needs you" tab. The headline says how many, and points at them.
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
  const showMoney = canSeeMoney(viewer);
  const paymentsDown = !world.feeds.payments.ok;

  const stats = useMemo(() => {
    const people = model.visible;
    const wrote = people.filter((p) => p.got.includes("form"));
    const became = wrote.filter((p) => p.buys.length > 0);
    const cameBack = people.filter((p) => p.cameBack);
    const unanswered = cards.filter((c) => c.kind === "unanswered");
    /*
      T122 (Rev 31) — the "Money in the last 6 months" tile and its chart are
      gone (removal-map item b, decided). `slipping` is kept — the brief was
      explicit: leave it alone — and gets its OWN tile below instead of living
      inside the removed money card, since it was never really about the
      headline number: it names one person who used to pay and hasn't been back.
    */
    const slipping = [...people].filter((p) => p.isQuiet && p.spent12 > 0).sort((a, b) => b.spent12 - a.spent12)[0];
    return { total: people.length, wrote: wrote.length, became: became.length, cameBack, unanswered, slipping };
  }, [model, cards]);

  /** Every chart's points, built from the same events every other screen reads. */
  const charts = useMemo(() => ({
    found: foundStory(model, model.pack.customers),
    source: bySource(model),
    split: wroteInSplit(model),
    items: topItems(model),
  }), [model]);

  if (ui.loading) return <PageSkeleton rows={4} />;

  if (stats.total === 0) {
    return (
      <div>
        <Verdict>Nothing to show yet.</Verdict>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tile title="Who came from where"><p className="t-meta">People appear when someone writes in or pays.</p></Tile>
          <Tile title="Back after you reached out" span={1}><p className="t-meta">Alloro learns a customer's rhythm after a few purchases.</p></Tile>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Verdict sub={`${plural(stats.total, ui.model.pack.customer, ui.model.pack.customers)} in your list.`}>
        {cards.length === 0 ? "Nothing needs you this week." : `${plural(cards.length, "thing")} need${cards.length === 1 ? "s" : ""} you this week.`}
      </Verdict>

      <TopTasks slot={0} />

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
          {/*
            T104 (Rev 26) — ⛔ A DONUT, AND THIS REVERSES T50's ANSWER FOR THIS CARD.
            Jov asked for it three times. I argued against it twice and the
            arguments have not changed: four shares within 35% of each other is
            the case a ring reads worst, which is exactly what T50's rule was
            written to catch. ⛔ THE RULE IS NOT DELETED AND NOT QUIETLY IGNORED —
            Rev 26 records that it was overruled by the person who owns the
            product, which is a different thing from being wrong.

            What was kept from T97, because it survives the change of shape: the
            sentence above, the share on every entry, and the line below naming
            the absence in words. The one thing that changed is that the absence
            is now IN the ring, because a donut claims to be a whole and leaving
            a fifth of the people out would be a worse lie than the one T97 fixed.
          */}
          <Ring title="Who came from where" points={charts.found.ring} go={ui.go} big />
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
          {/* T101 (Rev 25) — ⛔ A BAR, NOT A RING, AND T50's RULE WAS ASKED FIRST.
              67 against 43 is a spread and the gap is the finding — the same test
              that refused bars on the card beside it, where four shares sat within
              35% of each other. See the note above Ring. */}
          {/* T109 (Rev 28) — ⛔ TWO ROWS, WHICH IS THE EASIEST COMPARISON THERE IS:
              two lengths from a shared left edge, labels where words go. See the
              note above SpreadBars, including the plain admission that this card
              has now worn four shapes and that the headline above it is what has
              always done the work. */}
          <SpreadBars title="Who became a client" points={charts.split} go={ui.go} />
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

        {/*
          T113 (Rev 29) — ⛔ THE SAME WORDS SHOWED TWO NUMBERS: this tile read 5
          and "Where everyone stands" read "came back 7".

          They are not the same measure and collapsing them would have lost the
          useful one. This tile counts people who BOUGHT AGAIN AFTER YOU REACHED
          OUT — a check-in, then a purchase, inside thirty days. That is the one
          worth a thank-you, and it is what the next step below does. The ring
          counts the STATUS "Came back", which a person can hold for reasons this
          tile does not care about — and which the status rules can overwrite,
          since `isQuiet` is applied after `cameBack` in makeProfile.

          ⛔ SO THE TILE STOPS BORROWING THE STATUS WORDS. "Came back" now means
          exactly one thing on every screen: the status. This tile names its own
          narrower thing. Renaming the tile was the smaller change than renaming
          a status that People filters by and chips display.
        */}
        <Tile title="Back after you reached out" span={1}>
          {stats.cameBack.length === 0 ? (
            <p className="t-meta">Nobody has bought again after a check-in this month.</p>
          ) : (
            <>
              <p className="t-hero">{stats.cameBack.length}</p>
              <p className="t-meta">came back after you reached out.</p>
            </>
          )}
          <Next
            icon={stats.cameBack.length ? "thanks" : "people"}
            onClick={() => ui.go(stats.cameBack.length ? `#/p/${stats.cameBack[0].c.id}` : "#/people")}
          >
            {stats.cameBack.length ? `Say thanks to ${stats.cameBack[0].c.name}` : "See your list"}
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

        {/*
          T122 (Rev 31) — the money headline and its month-by-month chart are
          gone. `slipping` reads spent12 too, so it stays owner-only (R10), but it
          never needed the headline to make sense on its own — it names one
          person, not a total.

          ⛔ "QUIET" IS A RETIRED WORD (Design §10.1, checked by A33) and I wrote
          it into this tile's first draft without checking — caught by the suite,
          not by me. The status this reads is already named elsewhere in the app:
          `isQuiet` renders as "Hasn't been back" everywhere else (engine.ts:51),
          so this uses the SAME words rather than inventing a second phrase for
          one thing.

          ⛔ ALWAYS RENDERED, LIKE EVERY OTHER TILE ON THIS PAGE, with three
          honest states rather than disappearing when there is nothing to say —
          the same pattern "Back after you reached out" and "Nobody answered"
          already use for their own zero counts.
        */}
        {/*
          ⛔ FOUND BY LOOKING, NOT ASSUMED: THE FIRST VERSION POOLED WHITE SPACE.
          One line of text and a button in a two-wide card left the same dead
          gap T53 already named ("this tile ended in a pool of white") — worse
          here, because span 2 gives it double the room to be empty in. The fix
          T53 used is the same one that applies: give the tile something more
          to say, not less room to say it in. `spentTotal` and `lastBuy` are
          already on the Profile — this is the one tile in a good position to
          show them, since it exists specifically because they are worth a
          second look.
        */}
        {showMoney ? (
          <Tile title="Used to pay, hasn't been back" span={2}>
            {paymentsDown ? (
              <p className="t-body" data-testid="money-unknown">Alloro can't see your payments right now, so this is unknown.</p>
            ) : stats.slipping ? (
              <>
                <p className="t-body font-semibold">{stats.slipping.c.name} used to pay, and hasn't been back.</p>
                <p className="t-meta mb-3">
                  {money(stats.slipping.spentTotal)} altogether
                  {stats.slipping.lastBuy ? `, last paid ${dateWords(stats.slipping.lastBuy, world.today)}.` : "."}
                </p>
              </>
            ) : (
              <p className="t-meta">Everybody who used to pay is still coming back.</p>
            )}
            <Next
              icon={stats.slipping ? "person" : "people"}
              onClick={() => ui.go(stats.slipping ? `#/p/${stats.slipping!.c.id}` : "#/people")}
            >
              {stats.slipping ? `Check in with ${stats.slipping.c.name}` : "See your list"}
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
    not taste. `cls` only ever sets `lg:col-span-N` — there is no `sm:col-span`
    override — so at the two-column breakpoint every tile is exactly one slot
    wide regardless of its `span` prop, and what has to divide evenly is the
    TILE COUNT, not the sum of their spans: 8 for the owner, 6 for staff, both
    even, both exact.

    Three columns keeps the wide tiles, and there it IS the span sum that has
    to work: 2+1+1+1+2+1+3+1 = 12 for the owner and 9 for staff, four rows and
    three. ⛔ T122 (Rev 31) replaced the money tile (span 2) with "Used to pay,
    hasn't been back" — kept at span 2, same position, for exactly this reason:
    changing it to span 1 breaks the arithmetic and opens a hole two rows later,
    where "Where your list came from" (span 3) can no longer start a fresh row.
    Verified by re-measuring with A45 after the change, not assumed from the sum.
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
