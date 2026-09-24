import { useState } from "react";
import type { ReactNode } from "react";
import { chartSummary, type Point } from "../lib/charts";

/**
 * T35 · T36 (Rev 8) — small charts drawn in the app with SVG shapes and HTML
 * text. Carried over from Desktop\alloro-crm-mvp\src\components\Charts.tsx.
 *
 * ⛔ NO CHART LIBRARY, NO npm install. Hard rule 3 and the no-new-dependency
 * rule both bind, and a chart library would also break acceptance A35's
 * zero-network single-file rule the moment it wanted a font or a worker.
 *
 * ⛔ THE SHAPES STRETCH; THE WORDS STAY HTML. That is the whole trick, and it is
 * why every chart is readable at 375px: text inside an SVG scales with the
 * viewBox and would fall under 12px on a phone (Design §1.2). Text outside it
 * cannot.
 *
 * Each chart is one `figure` with role="img", a one-line summary as its name and
 * its numbers written out for screen readers (Design §5.1).
 *
 * ⛔ EVERY BAR AND SLICE IS A CONTROL. A point carrying an `href` renders as a
 * button that opens the people behind it. A chart that only shows a number is
 * decoration — roast item 7, and the reason the next step is beside it too.
 */

function Figure({ title, points, className = "", children }: { title: string; points: Point[]; className?: string; children: ReactNode }) {
  const summary = chartSummary(title, points);
  return (
    <figure data-chart data-values={points.map((p) => p.value).join(",")} role="img" aria-label={summary} className={`m-0 ${className}`}>
      {children}
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

/**
 * T49 (Rev 10) — ALLORO'S INSET TILE, for a set of related numbers.
 *
 * ⛔ THE REAL APP DOES NOT DRAW BAR CHARTS FOR A CATEGORY BREAKDOWN. Read at
 * origin/main and recorded in reference/alloro-metric-tile-2026-09-24.md:
 * PatientJourneyDetailMetricCard.tsx renders
 *     rounded-[12px] bg-alloro-bg px-4 py-4
 *     <dt class="eyebrow">  over  <dd class="text-[14px] font-extrabold text-alloro-navy">
 * — an inset on parchment, inside a white card. So "make the charts look like
 * Alloro" and "stop drawing these bars" were one instruction.
 *
 * ⛔ AND THE BARS THEY REPLACE WERE DRAWN WRONG, not merely unloved.
 * `<svg viewBox="0 0 100 8" preserveAspectRatio="none">` with `rx="4"`, rendered
 * ~760px wide, is a 7.6× horizontal stretch: the 4-unit corner drew as a 30×4
 * ELLIPSE, which is the tapered-needle look. A rounded rectangle cannot survive
 * a non-uniform scale. Rev 8 hid the same bug behind thicker bars in a narrower
 * column. A49 now forbids the combination outright.
 *
 * ⛔ ONE DEPARTURE FROM THE REAL APP, STATED: its tile is static. These are
 * controls, because T36 requires every number to name its people.
 */
export function TileGrid({
  title, points, go,
}: { title: string; points: Point[]; go?: (href: string) => void }) {
  return (
    /*
      ⛔ FLEX-WRAP, NOT A FIXED GRID, AND THE ROWS SPREAD TO FILL. Found by
      looking at desktop-dashboard.png: five tiles in a three-column grid leave
      an empty cell, and the card is stretched to its taller neighbour's height,
      so the tile block sat in the top half with a pool of white under it — the
      same complaint T53 fixed on the tile beside it.

      `flex-1 basis-28` lets the last row's tiles stretch across the leftover
      width, so there is no empty cell at any count; `content-between` spreads
      the rows down the card, so there is no pool under them.
    */
    <Figure title={title} points={points} className="flex flex-1 flex-col">
      {/*
        ⛔ content-evenly, NOT content-between, AND THE DIFFERENCE ONLY SHOWS WITH
        ONE ROW. `content-between` pushes the first row to the top and the last to
        the bottom, which spreads two rows beautifully and does NOTHING to one —
        it pins the single row to the top and leaves the whole remainder as a pool
        underneath. Measured on this card: 152px of it. T97 removed a tile, which
        made it one row of four, which made the bug visible.
      */}
      <dl className="flex flex-1 flex-wrap content-evenly gap-2">
        {points.map((pt) => {
          const body = (
            <>
              <dt className="eyebrow">{pt.label}</dt>
              {/* ⛔ #B8473A, not #D66853: raw terracotta on white is 3.52:1 and
                  fails AA under 24px (Design §2.4). This value is 14px. */}
              <dd className={`mt-1.5 text-[14px] font-extrabold leading-snug tabular-nums ${pt.needsYou ? "text-alloro-orange-text-safe" : "text-alloro-navy"}`}>
                {pt.display ?? pt.value}
              </dd>
              {/* T97 — the share, under the count. Quiet on purpose: the count is
                  the number, the share is what makes two counts comparable. */}
              {pt.sub ? <dd className="t-meta tabular-nums">{pt.sub}</dd> : null}
            </>
          );
          return pt.href && go ? (
            <button
              key={pt.label}
              type="button"
              data-testid="chart-point"
              data-href={pt.href}
              aria-label={`${pt.label}: ${pt.display ?? pt.value}. Open these people.`}
              onClick={() => go(pt.href!)}
              className="card-inset block min-w-0 flex-1 basis-28 px-4 py-3.5 text-left transition-colors hover:bg-alloro-surface hover:ring-1 hover:ring-line-medium focus-visible:bg-alloro-surface"
            >
              {body}
            </button>
          ) : (
            <div key={pt.label} className="card-inset min-w-0 flex-1 basis-28 px-4 py-3.5">{body}</div>
          );
        })}
      </dl>
    </Figure>
  );
}

/**
 * T50 (Rev 10) — the ONE bar, and the rule it has to pass.
 *
 * ⛔ A BAR WHEN THE SPREAD CARRIES THE MEANING; A TILE WHEN THE NUMBER DOES.
 * "Who came from where" reads 46, 44, 34, 32, 30 — within 35% of each other and
 * already sorted, so its bars drew a ranking the order had already given. "What
 * sells" reads $135,868 against $43,318, and there the gap IS the finding.
 *
 * ⛔ AN HTML ELEMENT WITH A PERCENTAGE WIDTH, NEVER A STRETCHED SVG. The radius
 * is then in real pixels and nothing scales it, which is the whole fix.
 */
/**
 * T106 (Rev 27) — ⛔ TWO PILLARS, WHICH IS A DIFFERENT CLAIM FROM ONE STACKED BAR.
 *
 * Jov: "on the bar chart on the right, use 2 pillars side by side." Built, and
 * the trade is worth naming rather than hiding: a stacked bar says "these are
 * two parts of ONE whole" — which is exactly what the headline above it says,
 * "67 of 110". Two pillars say "here are two quantities, compare them". The
 * card keeps its headline, so the whole is still stated in words; the pillars
 * now carry the comparison, which is the half a reader actually acts on.
 *
 * ⛔ T50's RULE STILL SAYS YES. A bar when the SPREAD carries the meaning: 67
 * against 43 is the finding, because forty-three people wrote in and never paid.
 *
 * ⛔ NO STRETCHED RADIUS. Plain HTML, percentage heights inside a fixed-height
 * row, rounded-t on each pillar. A49 exists because a rounded shape scaled
 * inside an SVG viewBox turned a 4px corner into a 30px ellipse; nothing here
 * is scaled.
 */
export function Pillars({
  title, points, go,
}: { title: string; points: Point[]; go?: (href: string) => void }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <Figure title={title} points={points} className="flex flex-1 flex-col justify-end">
      <div className="flex h-36 items-end gap-4">
        {points.map((pt) => {
          const h = Math.max(4, Math.round((pt.value / max) * 100));
          const body = (
            <span className="flex h-full w-full flex-col justify-end gap-1.5">
              <span className={`text-[17px] font-extrabold leading-none tabular-nums ${pt.needsYou ? "text-alloro-orange-text-safe" : "text-alloro-navy"}`}>
                {pt.display ?? pt.value}
              </span>
              <span
                aria-hidden="true"
                style={{ height: `${h}%` }}
                className={`w-full rounded-t-lg ${pt.needsYou ? "bg-alloro-orange" : "bg-alloro-navy"}`}
              />
              <span className="t-meta leading-tight">{pt.label.toLowerCase()}</span>
            </span>
          );
          return pt.href && go ? (
            <button
              key={pt.label}
              type="button"
              data-testid="chart-point"
              data-href={pt.href}
              aria-label={`${pt.label}: ${pt.display ?? pt.value}. Open these people.`}
              onClick={() => go(pt.href!)}
              className="flex h-full flex-1 rounded-xl px-1 text-left transition-colors hover:bg-alloro-bg focus-visible:bg-alloro-bg"
            >
              {body}
            </button>
          ) : (
            <span key={pt.label} className="flex h-full flex-1 px-1">{body}</span>
          );
        })}
      </div>
    </Figure>
  );
}

/**
 * T101 (Rev 25) — ⛔ TWO PARTS OF ONE WHOLE, AS ONE BAR.
 *
 * ⛔ T50's RULE ALLOWS THIS, AND I CHECKED RATHER THAN ASSUMED. The rule reads:
 * a bar when the SPREAD carries the meaning, a tile when the NUMBER does. This
 * is 67 against 43 — 61% and 39% — and the gap IS the finding, because the
 * whole point of the card is that forty-three people wrote in and never paid.
 * That is the same test that REFUSED bars on the card beside it, where four
 * shares sat within 35% of each other. The rule said yes here and no there,
 * which is what a rule is for.
 *
 * ⛔ THE RADIUS LIVES ON THE TRACK, NOT ON THE SEGMENTS. A49 exists because a
 * rounded shape scaled inside an SVG viewBox turned a 4px corner into a 30px
 * ellipse. The track is a plain HTML element with overflow-hidden and
 * rounded-full; the segments are rectangles clipped by it, so nothing is
 * stretched and there is no radius to distort.
 *
 * ⛔ TERRACOTTA IS THE SECOND SEGMENT BECAUSE IT IS THE ONE THAT NEEDS SOMEBODY
 * (A47, Design §2.2 — attention, never decoration). The data already says so:
 * "Not yet" carries needsYou, set where the numbers are built rather than here.
 */
export function SplitBar({
  title, points, go,
}: { title: string; points: Point[]; go?: (href: string) => void }) {
  const total = Math.max(1, points.reduce((n, p) => n + p.value, 0));
  return (
    <Figure title={title} points={points} className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line-medium" aria-hidden="true">
        {points.map((pt) => (
          <div
            key={pt.label}
            className={pt.needsYou ? "bg-alloro-orange" : "bg-alloro-navy"}
            style={{ width: `${Math.round((pt.value / total) * 100)}%` }}
          />
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1">
        {points.map((pt) => {
          const body = (
            <span className="inline-flex items-baseline gap-1.5">
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${pt.needsYou ? "bg-alloro-orange" : "bg-alloro-navy"}`}
              />
              <dd className="text-[15px] font-extrabold tabular-nums text-alloro-navy">{pt.display ?? pt.value}</dd>
              <dt className="t-meta">{pt.label.toLowerCase()}</dt>
            </span>
          );
          return pt.href && go ? (
            <button key={pt.label} type="button" onClick={() => go(pt.href!)} data-testid="chart-point"
              data-href={pt.href} aria-label={`${pt.label}: ${pt.display ?? pt.value}`}
              className="underline-offset-4 hover:underline">
              {body}
            </button>
          ) : (
            <span key={pt.label}>{body}</span>
          );
        })}
      </dl>
    </Figure>
  );
}

export function SpreadBars({ title, points }: { title: string; points: Point[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <Figure title={title} points={points} className="flex flex-col gap-3">
      {points.map((pt, i) => {
        const pct = pt.value === 0 ? 0 : Math.max(2, Math.round((pt.value / max) * 100));
        const fill = pt.needsYou
          ? "bg-alloro-orange"
          : ["bg-alloro-navy", "bg-alloro-navy/75", "bg-alloro-navy/55", "bg-alloro-navy/40", "bg-alloro-navy/30"][Math.min(i, 4)];
        return (
          <div key={pt.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-meta truncate text-alloro-navy">{pt.label}</span>
              <span className="t-meta shrink-0 font-bold tabular-nums text-alloro-navy">{pt.display ?? pt.value}</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-line-medium" aria-hidden="true">
              <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </Figure>
  );
}

/**
 * Columns, one per month; the last column is solid, earlier ones are lighter.
 *
 * ⛔ THIS HAD THE SAME STRETCHED-RADIUS BUG AND I FIXED ONLY THE OTHER CHART.
 * `viewBox="0 0 10 {h}"` with `preserveAspectRatio="none"`, rendered ~100px wide,
 * is a 10x horizontal stretch, so `rx="1.5"` drew as a 15px x 1.5px ellipse —
 * six of them, on the same screen I had just looked at. A49 caught it; my eyes
 * did not, because at that size the taper reads as "a bar". <b>The check is the
 * reason this is fixed, not the looking.</b> HTML now, so the radius is real.
 */
export function MonthBars({ title, points }: { title: string; points: Point[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <Figure title={title} points={points} className="flex flex-col gap-1">
      <div className="flex h-[104px] items-end gap-1.5 sm:gap-2" aria-hidden="true">
        {points.map((pt, i) => {
          const pct = pt.value === 0 ? 2 : Math.max(4, Math.round((pt.value / max) * 100));
          const now = i === points.length - 1;
          return (
            <div key={pt.label} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <div
                className={`w-full rounded-t-[3px] ${now ? "bg-alloro-navy" : "bg-alloro-navy/30"}`}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 sm:gap-2" aria-hidden="true">
        {points.map((pt) => (
          <span key={pt.label} className="t-meta min-w-0 flex-1 truncate text-center">{pt.label}</span>
        ))}
      </div>
      {/* ⛔ The newest month's value in words, outside the SVG. Putting it above
          each column looked tidy at 1280px and collided at 375px. */}
      <p className="t-meta mt-1">
        {points[points.length - 1]?.label}: <b className="text-alloro-navy">{points[points.length - 1]?.display}</b>
      </p>
    </Figure>
  );
}

/** A ring split into parts, with a key beside it. Each part is a control. */
/**
 * T104 (Rev 26) — ⛔ THE DONUT LIGHTS UP, AND IT DOES IT ON FOCUS TOO.
 *
 * Jov asked twice for a donut on "Who came from where" with a highlight on
 * hover. I argued against it twice: four shares within 35% of each other is the
 * case a ring reads worst, and T50's rule points at tiles. He asked again, so it
 * is built — and the objections are kept in the spec rather than dropped,
 * because "he asked twice" is a reason to build it, not a reason to pretend the
 * reasoning changed.
 *
 * ⛔ HOVER ALONE WOULD HAVE BEEN HALF A FEATURE. There is no hover on a phone,
 * and this dashboard is checked at 375px. So the highlight is driven by hover
 * AND by keyboard focus, and — the part that actually matters — every label,
 * count and share is in the legend at all times. Nothing is only discoverable by
 * pointing at it.
 */
export function Ring({
  title, points, go, big,
}: { title: string; points: Point[]; go?: (href: string) => void; big?: boolean }) {
  const [hot, setHot] = useState<number | null>(null);
  const total = points.reduce((s, p) => s + p.value, 0) || 1;
  /**
   * T105 (Rev 27) — ⛔ ALLORO'S OWN COLOURS, NOT ONE COLOUR AT FOUR OPACITIES.
   *
   * Jov: "on the donut use the Alloro colors." He was looking at four steps of
   * navy at 100/55/25/12%, which on white renders as black and three greys. It
   * is technically the brand colour and it reads as a greyscale chart.
   *
   * These are four real tokens from the palette, dark to light:
   *   alloro-navy #11151c · alloro-deepblue #212d40 · alloro-slateblue #364156
   *   · ink-muted #8e8579, the WARM grey the rest of the app uses for quiet text.
   * They stay legible against each other and against the linen background.
   *
   * ⛔ TERRACOTTA IS NOT IN THE RAMP, AND THAT IS THE CONSTITUTION, NOT TASTE.
   * Design §2.2 makes alloro-orange the only attention-grabber and §8.1 says a
   * colour encoding no state is decoration; A47 checks it. A slice of a
   * where-did-they-come-from chart does not need anybody, so it does not get her.
   * A five-hue chart would be prettier and would break that rule — if it is
   * wanted, it is a Design §2.2 amendment, not a chart tweak.
   */
  const shades = ["stroke-alloro-navy", "stroke-alloro-deepblue", "stroke-alloro-slateblue", "stroke-ink-muted"];
  const swatches = ["bg-alloro-navy", "bg-alloro-deepblue", "bg-alloro-slateblue", "bg-ink-muted"];
  const strokeOf = (p: Point, i: number) =>
    p.muted ? "stroke-line-medium" : p.needsYou ? "stroke-alloro-orange" : shades[i % shades.length];
  const swatchOf = (p: Point, i: number) =>
    p.muted ? "bg-line-medium" : p.needsYou ? "bg-alloro-orange" : swatches[i % swatches.length];

  let start = 0;
  return (
    <Figure title={title} points={points} className="flex flex-wrap items-center gap-4 sm:gap-5">
      {/* T105 — ⛔ BIGGER WHEN THE CARD HAS THE ROOM. Jov: "maximize its space, so
          it's elegant to look at." The ring sat at 128px inside a two-column card
          with a pool of linen beside it. The viewBox is square, so growing it
          scales nothing unevenly — A49's stretched-radius trap needs a
          non-square viewBox and this has never had one. */}
      <svg className={`block shrink-0 -rotate-90 ${big ? "h-44 w-44 sm:h-52 sm:w-52" : "h-24 w-24"}`} viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth="6" className="stroke-line-soft" />
        {points.map((p, i) => {
          const pct = (p.value / total) * 100;
          const lit = hot === i;
          const dim = hot !== null && !lit;
          const seg = (
            <circle
              key={p.label}
              cx="21" cy="21" r="15.915" fill="none"
              /* ⛔ The lit slice thickens OUTWARD from the same centre line, so the
                 ring never changes size and nothing beside it moves. */
              strokeWidth={lit ? 7.6 : 6}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-start}
              opacity={dim ? 0.3 : 1}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
              className={`${strokeOf(p, i)} transition-all duration-150 motion-reduce:transition-none`}
            />
          );
          start += pct;
          return seg;
        })}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
        {points.map((p, i) => {
          const lit = hot === i;
          const body = (
            <>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${swatchOf(p, i)}`}
                aria-hidden="true"
              />
              <span className="truncate text-left">
                <span className={`font-semibold tabular-nums ${p.needsYou ? "text-alloro-orange-text-safe" : "text-alloro-navy"}`}>
                  {p.display ?? p.value}
                </span> {p.label.toLowerCase()}
                {/* ⛔ THE SHARE IS ALWAYS HERE, not revealed by pointing. A count with
                    no denominator makes the reader do the arithmetic, and a phone
                    cannot hover to be told. */}
                {p.sub ? <span className="tabular-nums text-ink-muted-text-safe"> · {p.sub}</span> : null}
              </span>
            </>
          );
          const hover = {
            onMouseEnter: () => setHot(i),
            onMouseLeave: () => setHot(null),
            onFocus: () => setHot(i),
            onBlur: () => setHot(null),
          };
          return p.href && go ? (
            <li key={p.label}>
              <button
                type="button"
                data-testid="chart-point"
                data-href={p.href}
                data-lit={lit ? "true" : undefined}
                aria-label={`${p.label}: ${p.display ?? p.value}. Open these people.`}
                onClick={() => go(p.href!)}
                {...hover}
                className={`t-meta -mx-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 transition-colors hover:bg-alloro-bg focus-visible:bg-alloro-bg ${lit ? "bg-alloro-bg" : ""}`}
              >
                {body}
              </button>
            </li>
          ) : (
            <li key={p.label} className="t-meta -mx-2 flex min-h-11 items-center gap-2 px-2" {...hover}>{body}</li>
          );
        })}
      </ul>
    </Figure>
  );
}

