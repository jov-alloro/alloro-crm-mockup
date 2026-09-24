import { useEffect, useRef, useState, type ReactNode } from "react";
import { AREAS, areaOf, headerFor, type AreaKey } from "../lib/areas";
import { CONTAINER, upTarget, type UpTarget } from "../lib/layout";
import { Icon } from "./icons";
import type { Route } from "../lib/router";

/**
 * T1 — the shell (spec S0), restyled to the real Alloro app.
 *
 * The nav row recipe is copied from frontend/src/components/Sidebar.tsx on
 * origin/main and recorded in ../../reference/:
 *   rounded-xl px-3 py-3.5, border-transparent
 *   active   → bg-alloro-sidehover text-white shadow-sm border-white/5
 *   inactive → text-white/40 hover:text-white hover:bg-alloro-sidehover
 *   label    → 12px / 600 / tracking-tight
 *   icon     → Hugeicons 18px, terracotta when active, opacity-40 otherwise
 *
 * ⛔ TWO TRAPS, both found by driving the screen rather than reading it:
 *
 * 1. A STICKY RAIL MAKES ITS OWN STACKING CONTEXT, so a flyout inside it paints
 *    BEHIND the page and the pointer falls straight through. The rail carries an
 *    explicit z-index, and the bubble a higher one. Acceptance A1.
 * 2. A CLICK FOCUSES THE ROW FIRST, which opens the bubble — so a plain toggle
 *    closes what focus just opened. The click handler OPENS only. And Escape
 *    returns focus to Customers, which would re-open it, so that one return is
 *    suppressed.
 *
 * ⛔ REV 8 DID NOT TOUCH THE RAIL OR THE BUBBLE. Jov approved that pattern on
 * 2026-09-23 and the round's own instructions put it out of scope. What Rev 8
 * added here is the content container (T27) and the back control (T25), both
 * OUTSIDE the rail.
 */

const OTHER_ALLORO_ITEMS: { label: string; icon: "hub" | "journey" | "rankings" | "reviews" | "website" }[] = [
  { label: "Business Hub", icon: "hub" },
  { label: "Revenue Hub", icon: "hub" },
  { label: "Customer Journey Insights", icon: "journey" },
  { label: "Local Rankings", icon: "rankings" },
  { label: "Reviews & Posts", icon: "reviews" },
  { label: "Website", icon: "website" },
];

export function Shell({
  route, go, children, demoStripe, savedWarning, up: upFromApp,
}: {
  route: Route;
  go: (href: string) => void;
  children: ReactNode;
  demoStripe: ReactNode;
  savedWarning?: string;
  /** T85 (Rev 18) — App works this out, because naming the origin needs the model. */
  up?: UpTarget | null;
}) {
  const current = areaOf(route);
  const header = headerFor(route);
  /* ⛔ T40 said: UP, not back — one fixed parent per screen, no history, so
     nothing to ping-pong against. T85 (Rev 18) keeps the fixed parent as the
     fallback and lets a screen return to the arrival it came from, for the few
     arrivals REMEMBERS allows. The loop T40 was avoiding is kept out by that
     table rather than by having no memory at all. */
  const up = upFromApp !== undefined ? upFromApp : upTarget(route);
  /* ⛔ T39 — THE ONLY PLACE A PAGE WIDTH OR GUTTER IS APPLIED, and it is the
     SAME string on every screen. */
  const container = CONTAINER;

  return (
    <div className="min-h-screen">
      {demoStripe}
      {savedWarning ? (
        <p className="border-b border-line-soft bg-alloro-bg px-4 py-2 text-sm" data-testid="storage-line">
          {savedWarning}
        </p>
      ) : null}
      <div className="flex">
        <Rail current={current} go={go} />
        <div className="min-w-0 flex-1">
          <PhonePicker current={current} go={go} />

          {/* T55 (Rev 11) — ⛔ THE BAND IS A NAME. No subtitle, no control. */}
          <header className="border-b border-line-soft bg-alloro-surface py-5">
            <div className={container}>
              <h1 className="t-hero" data-testid="page-title">{header.title}</h1>
            </div>
          </header>

          <main className="py-5 sm:py-7">
            <div className={container} data-testid="content">
              {/*
                T57 (Rev 11) — ⛔ THE UP CONTROL SITS WITH THE CONTENT IT LETS YOU
                LEAVE, not in the header band. It was above the title first, which
                made the way OUT the first thing read on every sub-screen; then
                under the title, which grew the band a third row. Out here the
                band is one line and the control is where the eye already is.

                Nothing about its behaviour changes: it still names its
                destination, and it still cannot loop, because T40's fixed parent
                has no memory to disagree with.
              */}
              {up ? (
                <button
                  type="button"
                  data-testid="back"
                  data-href={up.href}
                  onClick={() => go(up.href)}
                  className="tap -ml-2 mb-2 inline-flex items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-ink-muted-text-safe transition-colors hover:bg-alloro-bg hover:text-alloro-navy"
                >
                  <Icon name="back" size={16} />
                  {up.label}
                </button>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Rail({ current, go }: { current: AreaKey | null; go: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const skipFocusOpen = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        skipFocusOpen.current = true;
        btn.current?.focus();
        window.setTimeout(() => { skipFocusOpen.current = false; }, 0);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (open && wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const hold = () => { window.clearTimeout(closeTimer.current); setOpen(true); };
  const holdFromFocus = () => { if (!skipFocusOpen.current) hold(); };
  const release = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  return (
    <div className="relative z-30 hidden w-60 shrink-0 self-start md:block sticky top-0 h-screen bg-alloro-sidebg text-white">
      <div className="px-5 py-5">
        <p className="eyebrow text-white/50">Alloro</p>
      </div>

      <nav className="px-3">
        <div ref={wrap} className="relative" onMouseEnter={hold} onMouseLeave={release}>
          <button
            ref={btn}
            type="button"
            data-testid="rail-customers"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Customers"
            onFocus={holdFromFocus}
            onClick={hold}
            className={[
              "nav-row tap group",
              current
                ? "bg-alloro-sidehover text-white shadow-sm border-white/5"
                : "text-white/40 hover:text-white hover:bg-alloro-sidehover",
            ].join(" ")}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={`shrink-0 ${current ? "text-alloro-orange" : "opacity-40 group-hover:opacity-100"}`}>
                <Icon name={current ?? "people"} />
              </span>
              <span className={`nav-label ${current ? "text-white" : "group-hover:text-white/80"}`}>Customers</span>
            </span>
          </button>

          {open ? (
            /* 20px gap from the rail (Jov, 2026-09-24 — 12px read as almost
               touching). ⛔ THE GAP IS PADDING ON THIS WRAPPER, NOT A MARGIN, so
               it stays inside the bubble's own hover area: crossing it with the
               pointer never loses the bubble. Widening a margin instead would
               open a dead strip that closes the menu halfway to it. */
            <div
              data-testid="bubble"
              role="menu"
              aria-label="Customers areas"
              className="absolute left-full top-0 z-50 pl-5"
            >
              <div className="relative w-56 rounded-2xl bg-alloro-sidehover p-2 shadow-premium ring-1 ring-white/10">
                <span
                  aria-hidden="true"
                  data-testid="bubble-caret"
                  className="absolute -left-1.5 top-5 h-3 w-3 rotate-45 bg-alloro-sidehover"
                />
                {AREAS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    role="menuitem"
                    data-testid={`bubble-${a.key}`}
                    data-current={current === a.key ? "true" : undefined}
                    onClick={() => { go(a.href); setOpen(false); }}
                    className={[
                      "nav-row tap group",
                      current === a.key
                        ? "bg-white/10 text-white border-white/5"
                        : "text-white/40 hover:text-white hover:bg-white/5",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`shrink-0 ${current === a.key ? "text-alloro-orange" : "opacity-40 group-hover:opacity-100"}`}>
                        <Icon name={a.key} />
                      </span>
                      {/* ⛔ Label only. The one-line subtext is gone from this
                          menu (decision d); the page header still carries it. */}
                      <span className={`nav-label ${current === a.key ? "text-white" : "group-hover:text-white/80"}`}>
                        {a.label}
                      </span>
                    </span>
                    {current === a.key ? (
                      <span className="shrink-0 text-[11px] font-semibold text-white/50">here</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Design §13.4 — no counts and no badges in the navigation. */}
        <div className="mt-1" aria-hidden="true">
          {OTHER_ALLORO_ITEMS.map((n) => (
            <span key={n.label} className="nav-row tap text-white/25">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 opacity-40"><Icon name={n.icon} /></span>
                <span className="nav-label">{n.label}</span>
              </span>
            </span>
          ))}
        </div>
      </nav>

      <div className="absolute inset-x-3 bottom-3">
        <button
          type="button"
          data-testid="rail-settings"
          onClick={() => go("#/settings")}
          className="nav-row tap group text-white/40 hover:text-white hover:bg-alloro-sidehover"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 opacity-40 group-hover:opacity-100"><Icon name="settings" /></span>
            <span className="nav-label group-hover:text-white/80">Settings</span>
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * The phone keeps its "Customers · {area} ▾" button — and it KEEPS the subtext,
 * because on a phone this menu is the only place the sentence is ever seen.
 */
function PhonePicker({ current, go }: { current: AreaKey | null; go: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  const label = current ? AREAS.find((a) => a.key === current)!.label : "Settings";
  return (
    <div className="border-b border-line-soft bg-alloro-sidebg px-3 py-2 md:hidden">
      <button
        type="button"
        data-testid="phone-picker"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="nav-row tap text-white"
      >
        <span className="nav-label">Customers · {label}</span>
        <span aria-hidden="true" className="text-white/60">▾</span>
      </button>
      {open ? (
        <div data-testid="phone-menu" className="mt-2 rounded-2xl bg-alloro-sidehover p-2 shadow-premium">
          {AREAS.map((a) => (
            <button
              key={a.key}
              type="button"
              data-testid={`phone-${a.key}`}
              onClick={() => { go(a.href); setOpen(false); }}
              className="nav-row tap group text-white/70 hover:bg-white/5 hover:text-white"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 opacity-50"><Icon name={a.key} /></span>
                <span className="min-w-0">
                  <span className="nav-label block text-white">{a.label}</span>
                  <span className="block text-[12px] leading-4 text-white/50">{a.subtitle}</span>
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            data-testid="phone-settings"
            onClick={() => { go("#/settings"); setOpen(false); }}
            className="nav-row tap text-white/70 hover:bg-white/5 hover:text-white"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 opacity-50"><Icon name="settings" /></span>
              <span className="nav-label">Settings</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
