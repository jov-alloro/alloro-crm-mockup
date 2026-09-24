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
      <dl className="flex flex-1 flex-wrap content-between gap-2">
        {points.map((pt) => {
          const body = (
            <>
              <dt className="eyebrow">{pt.label}</dt>
              {/* ⛔ #B8473A, not #D66853: raw terracotta on white is 3.52:1 and
                  fails AA under 24px (Design §2.4). This value is 14px. */}
              <dd className={`mt-1.5 text-[14px] font-extrabold leading-snug tabular-nums ${pt.needsYou ? "text-alloro-orange-text-safe" : "text-alloro-navy"}`}>
                {pt.display ?? pt.value}
              </dd>
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
export function Ring({ title, points, go, big }: { title: string; points: Point[]; go?: (href: string) => void; big?: boolean }) {
  const total = points.reduce((s, p) => s + p.value, 0) || 1;
  const shades = ["stroke-alloro-navy", "stroke-alloro-navy/55", "stroke-alloro-navy/25", "stroke-alloro-navy/12"];
  const swatches = ["bg-alloro-navy", "bg-alloro-navy/55", "bg-alloro-navy/25", "bg-alloro-navy/12"];
  let start = 0;
  return (
    <Figure title={title} points={points} className="flex flex-wrap items-center gap-4 sm:gap-5">
      <svg className={`block shrink-0 -rotate-90 ${big ? "h-32 w-32" : "h-24 w-24"}`} viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth="6" className="stroke-line-soft" />
        {points.map((p, i) => {
          const pct = (p.value / total) * 100;
          const seg = (
            <circle key={p.label} cx="21" cy="21" r="15.915" fill="none" strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-start}
              className={p.needsYou ? "stroke-alloro-orange" : shades[i % shades.length]} />
          );
          start += pct;
          return seg;
        })}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
        {points.map((p, i) => {
          const body = (
            <>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.needsYou ? "bg-alloro-orange" : swatches[i % swatches.length]}`}
                aria-hidden="true"
              />
              <span className="truncate text-left">
                <span className={`font-semibold tabular-nums ${p.needsYou ? "text-alloro-orange-text-safe" : "text-alloro-navy"}`}>
                  {p.display ?? p.value}
                </span> {p.label.toLowerCase()}
              </span>
            </>
          );
          return p.href && go ? (
            <li key={p.label}>
              <button
                type="button"
                data-testid="chart-point"
                data-href={p.href}
                aria-label={`${p.label}: ${p.display ?? p.value}. Open these people.`}
                onClick={() => go(p.href!)}
                className="t-meta -mx-2 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 transition-colors hover:bg-alloro-bg focus-visible:bg-alloro-bg"
              >
                {body}
              </button>
            </li>
          ) : (
            <li key={p.label} className="t-meta -mx-2 flex min-h-11 items-center gap-2 px-2">{body}</li>
          );
        })}
      </ul>
    </Figure>
  );
}
