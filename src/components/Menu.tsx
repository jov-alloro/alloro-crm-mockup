import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * T83 (Rev 18) — ⛔ ALLORO'S OWN MENU, AND THIS REVERSES T77 ON PURPOSE.
 *
 * T77 put a real <select> at opacity-0 over each header label and said so
 * loudly: it keeps keyboard, Escape, type-ahead and screen readers for nothing,
 * and this project has been bitten TWICE by hand-rolled menus — the sidebar
 * bubble that painted behind the page because a sticky rail makes its own
 * stacking context, and the click-focus race that closed what focus had just
 * opened.
 *
 * ⛔ THE REASON FOR REVERSING IT IS NOT TASTE, IT IS A BROWSER FACT: no CSS
 * reaches a native select's option list. The operating system draws it. So
 * "make the dropdown look like Alloro" and "keep the native control" cannot
 * both be true, and Jov chose the look.
 *
 * ⛔ SO EVERY BEHAVIOUR THE NATIVE CONTROL WAS GIVING US FOR FREE IS NOW CODE
 * THIS FILE OWES, and each one is a separate acceptance item rather than one
 * item saying "the menu works":
 *
 *   A62  arrows move, Enter chooses, Escape closes and hands focus back to the
 *        header that opened it, and typing a letter jumps to that option.
 *   A63  it paints ABOVE the page from inside a sticky header. It is rendered
 *        into document.body through a portal for exactly this reason — the
 *        bubble defect proved that a z-index inside a stacking context cannot
 *        climb out of it.
 *   A64  opening one closes any other, and a click outside closes it, with no
 *        click-versus-focus race. Closing is driven by pointerdown on the
 *        document, and the trigger's own pointer events are excluded, which is
 *        what the second defect taught.
 *   A65  the roles and names a screen reader needs, since the native ones went.
 *   A66  Alloro's own tokens only.
 */

export type MenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Shown to the right, e.g. a count. Kept out of the label so the label reads plainly. */
  hint?: string;
};

/** One document-wide signal, so opening a menu closes whichever one was open. */
const OPENED = "alloro-menu-opened";

export function Menu({
  id, label, ariaLabel, value, options, onChange, caret, on, triggerClass,
}: {
  id: string;
  /** What the header reads when the menu is shut. */
  label: React.ReactNode;
  ariaLabel: string;
  value: string;
  options: MenuOption[];
  onChange: (v: string) => void;
  /** "menu" = there is a menu here. "up"/"down" = this column is sorted that way. */
  caret: "menu" | "up" | "down";
  on: boolean;
  /**
   * ⛔ THE HEADER TRIGGER CARRIES NO BORDER and a filter pill carries one. That
   * is the only difference between them, so it is the only thing passed in.
   * A60 forbids a visible bordered control inside the table header, which is
   * what keeps that row reading as a label strip rather than a form.
   */
  triggerClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const [box, setBox] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = `${useId()}-list`;

  const close = useCallback((focusBack = true) => {
    setOpen(false);
    if (focusBack) trigger.current?.focus();
  }, []);

  /* ⛔ ONE OPEN AT A TIME. A second menu announces itself and everyone else shuts.
     No focus is moved here: the new menu is about to take it. */
  useEffect(() => {
    if (!open) return;
    const onOther = (e: Event) => { if ((e as CustomEvent).detail !== id) setOpen(false); };
    document.addEventListener(OPENED, onOther);
    return () => document.removeEventListener(OPENED, onOther);
  }, [open, id]);

  /* ⛔ pointerdown, NOT click, AND THE TRIGGER IS EXCLUDED. The sidebar bubble
     closed on blur and reopened on the click that caused the blur — a control
     that could not be closed by pressing it. Excluding the trigger's own pointer
     leaves its onClick to do the toggling, once. */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (trigger.current?.contains(t) || list.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  /* Position against the trigger, in viewport coordinates, and keep it on screen. */
  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 200);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom;
    const wanted = Math.min(options.length * 38 + 12, 320);
    const top = below < wanted && r.top > wanted ? r.top - wanted - 6 : r.bottom + 6;
    setBox({ top, left, minWidth: width });
  }, [options.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const again = () => place();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    return () => { window.removeEventListener("resize", again); window.removeEventListener("scroll", again, true); };
  }, [open, place]);

  /**
   * ⛔ THIS EFFECT MUST DEPEND ON `open` ALONE, AND THAT IS NOT A STYLE CHOICE.
   *
   * It first read [open, options, value]. `options` is built inline by the header
   * on every render, so its identity changes every time — which meant the effect
   * re-ran after every keystroke and PUT THE HIGHLIGHT BACK where it started.
   * Arrow keys moved nothing, type-ahead landed nowhere, and Enter chose the row
   * that was already chosen. A62 caught all three at once.
   *
   * The lesson is the one this project keeps paying for in a new costume: a
   * dependency on a value that is recreated every render is not a dependency, it
   * is "run me always". Reading the current options through a ref is the fix.
   */
  const optsNow = useRef(options);
  optsNow.current = options;
  useEffect(() => {
    if (!open) return;
    setAt(Math.max(0, optsNow.current.findIndex((o) => o.value === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * ⛔ FOCUS WAITS FOR THE LIST TO EXIST, AND THAT ORDERING IS THE WHOLE BUG.
   *
   * Opening takes TWO commits: the first sets `open` with no position yet, so the
   * portal is not rendered and `list.current` is still null; the second arrives
   * after useLayoutEffect measures the trigger and sets `box`. An effect keyed on
   * `open` alone runs during the first commit and focuses nothing.
   *
   * ⛔ AND A MENU THAT NEVER TOOK FOCUS SWALLOWED EVERY KEY. Arrows moved
   * nothing, type-ahead landed nowhere, and Escape did not close it — which then
   * broke a check three items away, because a menu left open swallows the click
   * that was meant to open the next one. A62 and A61 failed together from this
   * one line, and the second failure looked nothing like the cause.
   */
  useEffect(() => {
    if (open && box) list.current?.focus();
  }, [open, box]);

  const step = (from: number, dir: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const n = (from + dir * i + options.length * 2) % options.length;
      if (!options[n].disabled) return n;
    }
    return from;
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape": e.preventDefault(); close(); return;
      case "ArrowDown": e.preventDefault(); setAt((n) => step(n, 1)); return;
      case "ArrowUp": e.preventDefault(); setAt((n) => step(n, -1)); return;
      case "Home": e.preventDefault(); setAt(step(-1, 1)); return;
      case "End": e.preventDefault(); setAt(step(options.length, -1)); return;
      case "Enter": case " ": e.preventDefault(); choose(at); return;
      case "Tab": close(false); return;
    }
    // ⛔ TYPE-AHEAD. The native control had it and people who use menus by
    // keyboard rely on it; dropping it silently would have been the quiet cost.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 900 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const want = typed.current.text.toLowerCase();
      const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(want));
      if (hit >= 0) setAt(hit);
    }
  };

  const openNow = () => {
    document.dispatchEvent(new CustomEvent(OPENED, { detail: id }));
    setOpen(true);
  };

  const mark = caret === "up" ? "▲" : caret === "down" ? "▼" : "▾";

  return (
    <>
      {/* ⛔ NO BORDER ON THE TRIGGER. A60 forbids a visible bordered control in the
          header row, and that rule is why the strip reads as a label strip. */}
      <button
        ref={trigger}
        type="button"
        data-testid={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openNow())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openNow(); }
        }}
        className={triggerClass
          ? `${triggerClass} ${on ? "border-alloro-navy text-alloro-navy" : "border-line-soft text-ink-muted-text-safe"}`
          : `tap inline-flex items-center gap-1 whitespace-nowrap ${on ? "text-alloro-navy" : ""}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-[9px] leading-none">{mark}</span>
      </button>

      {open && box
        ? createPortal(
            <div
              ref={list}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={`${listId}-${at}`}
              data-testid={`${id}-list`}
              onKeyDown={onKey}
              style={{ position: "fixed", top: box.top, left: box.left, minWidth: box.minWidth, zIndex: 80 }}
              className="card-radius max-h-80 overflow-auto border border-line-soft bg-alloro-surface py-1 shadow-premium outline-none"
            >
              {options.map((o, i) => {
                const chosen = o.value === value;
                return (
                  <div
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={chosen}
                    aria-disabled={o.disabled || undefined}
                    data-testid={`${id}-opt`}
                    data-value={o.value}
                    onPointerEnter={() => !o.disabled && setAt(i)}
                    onClick={() => choose(i)}
                    className={[
                      "flex cursor-pointer items-center justify-between gap-6 px-3 py-2 text-[13px] font-semibold normal-case tracking-normal",
                      o.disabled ? "cursor-default text-ink-muted-text-safe opacity-60"
                        : chosen ? "bg-alloro-navy text-white"
                        : i === at ? "bg-alloro-bg text-alloro-navy"
                        : "text-alloro-navy",
                    ].join(" ")}
                  >
                    <span>{o.label}</span>
                    {o.hint ? (
                      <span className={`tabular-nums text-[12px] ${chosen ? "text-white/70" : "text-ink-muted-text-safe"}`}>
                        {o.hint}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
