import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";

/** Shared primitives. Design §12.3 — every control clears 44px. */

/**
 * T32 (Rev 8) · T45 (Rev 9) — ONE CARD STYLE, and it is Alloro's own:
 *
 *   radius   14px                     card-radius   (StatBox.tsx: rounded-[14px])
 *   border   --color-line-soft        6% navy
 *   surface  #ffffff on #faf8f3       white card on linen
 *   shadow   shadow-premium           what separates it from the page
 *   padding  20px / 24px              p-5 sm:p-6
 *   control  hover + keyboard focus   only when the card IS a control
 *
 * ⛔ REV 8 GOT THIS WRONG AND THE CORRECTION IS THE POINT. The complaint was
 * that cards did not read as cards, so Rev 8 darkened the border to line-medium.
 * Alloro solves the same problem with the SHADOW and keeps the hairline border —
 * and shadow-premium was already in this stylesheet, unused on cards. A heavier
 * line was a different design; a shadow is the one the product already has.
 *
 * ⛔ Alloro's own tokens only. Its real dashboard cards also carry a raw slate
 * border class, which its own check:design fails on; the recipe is copied, the
 * violation is not. A41 scans the build for raw palette classes, and src/index.css
 * restricts Tailwind's source scan to src/ so the prose in CONTEXT.md and the spec
 * cannot generate one.
 */
export function Card({
  children, className = "", id, control, onClick, testId, label,
}: {
  children: ReactNode; className?: string; id?: string;
  /** A card that is itself a control: gets hover, focus and keyboard. */
  control?: boolean; onClick?: () => void; testId?: string; label?: string;
}) {
  const base =
    `card-radius border border-line-soft bg-alloro-surface p-5 sm:p-6 shadow-premium ${className}`;
  if (!control) return <div id={id} data-testid={testId} className={base}>{children}</div>;
  return (
    <div
      id={id}
      data-testid={testId}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
      className={`${base} cursor-pointer transition-colors hover:border-alloro-orange/40 hover:bg-alloro-bg focus-visible:border-alloro-orange/40 focus-visible:bg-alloro-bg`}
    >
      {children}
    </div>
  );
}

/**
 * T30 (Rev 8) — every button that performs an action carries an icon BEFORE its
 * label. ⛔ The icon comes through `icon={name}` and the wrapper; a screen never
 * imports an icon library.
 *
 * ⛔ AN ICON IS A LEADING MARK, NOT A PROMOTION. Design §4.3 still caps a screen
 * at one primary button, and A31 still counts them. Giving every button an icon
 * and then letting half of them go primary would undo the thing icons are for.
 */
export function Button({
  children, onClick, primary, disabled, title, full, small, testId, icon, ariaLabel,
}: {
  children?: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean;
  title?: string; full?: boolean; small?: boolean; testId?: string;
  icon?: IconName;
  /** Required when there is no visible label (T31). */
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      /* ⛔ T30's check needs to tell an ACTION BUTTON from a filter chip or a
         nav row. Marking the component is exact; guessing from the class list
         is not. A40a reads this. */
      data-btn="true"
      data-primary={primary ? "true" : undefined}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={[
        "tap inline-flex items-center justify-center gap-2 rounded-xl px-4 font-semibold tracking-tight",
        "transition-colors duration-150 motion-reduce:transition-none",
        small ? "text-[13px]" : "text-[14px]",
        full ? "w-full" : "",
        primary
          ? "bg-alloro-navy text-white shadow-sm hover:bg-alloro-deepblue"
          : "border border-line-medium bg-alloro-surface text-alloro-navy hover:bg-alloro-bg",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {icon ? <span className="shrink-0 opacity-80"><Icon name={icon} size={small ? 15 : 16} /></span> : null}
      {children}
    </button>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "amber" | "quiet" }) {
  const cls =
    tone === "amber"
      ? "bg-amber-soft text-alloro-navy border-amber"
      : tone === "quiet"
        ? "bg-alloro-bg text-ink-muted-text-safe border-line-medium"
        : "bg-alloro-bg text-alloro-navy border-line-medium";
  return (
    // 12px is the floor (Design §1.2). Alloro's own sidebar badge sits at 9px;
    // that one is a violation and is not copied.
    // ⛔ whitespace-nowrap: in a narrow table column "Hasn't been back" wrapped
    // onto three lines and the last one was clipped by the row. Found by looking.
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-4 ${cls}`}>
      {children}
    </span>
  );
}

/** Design §6.1 — the verdict is the first thing rendered, before any number. */
export function Verdict({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="t-verdict" data-testid="verdict">{children}</p>
      {sub ? <p className="t-meta mt-1">{sub}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="eyebrow mt-6 mb-2">{children}</h2>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="text-center">
      <p className="t-body font-semibold" data-testid="empty-title">{title}</p>
      {body ? <p className="t-meta measure mx-auto mt-1">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} aria-hidden="true" />;
}

export function PageSkeleton({ rows = 3, search = false }: { rows?: number; search?: boolean }) {
  return (
    <div data-testid="skeleton" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-2/3 mb-4" />
      {search ? <Skeleton className="h-11 w-full mb-3" /> : null}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * A sheet. T26 (Rev 8): Escape closes it, a visible Close control closes it, and
 * ⛔ EITHER WAY THE FOCUS GOES BACK TO WHAT OPENED IT. Before Rev 8 the sheet
 * took focus and never gave it back, so closing with Escape dropped a keyboard
 * user at the top of the document with no idea where they were.
 */
export function Sheet({
  title, onClose, children, wide,
}: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    // Whatever had focus when the sheet mounted is where focus returns.
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      const back = opener.current as HTMLElement | null;
      if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-alloro-navy/40 p-0 sm:p-6">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="sheet"
        className={`max-h-[92vh] w-full overflow-auto rounded-t-[28px] sm:rounded-[28px] bg-alloro-surface p-5 sm:p-6 shadow-premium outline-none ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="t-verdict">{title}</h2>
          {/*
            T89 (Rev 19) — ⛔ ICON ONLY, AND IT KEEPS ITS NAME. Jov: "icon only is
            already enough here, it's okay without text on close." An X is the
            one control every sheet in every app carries, so the word was doing
            no work.

            ⛔ THE NAME IS NOT OPTIONAL. A40b requires one on every icon-only
            control, because an X with no name is a button a screen reader reads
            as nothing at all. And px-4 stays: a button that shrinks to fit the
            glyph is a smaller tap target on a phone, which is a regression
            dressed as a tidy-up.
          */}
          <Button small icon="close" onClick={onClose} testId="sheet-close" ariaLabel="Close" />
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * T99 (Rev 24) — ⛔ A COMBO BOX: PICK WHAT EXISTS, OR TYPE SOMETHING NEW.
 *
 * Jov asked for a dropdown and asked to be roasted, so: a closed dropdown means
 * the owner can never invent a group. This field IS the email audience list, so
 * freezing it lets the product decide what groups a business may have — the same
 * "interface writing the data model" move T76 refused.
 *
 * ⛔ AND FREE TEXT WAS WORSE, WHICH IS THE PART NOBODY ASKED ABOUT. The group
 * list was built from the raw text and matched with ===, so "Regular", "regular"
 * and "Regular " were three separate audiences. T98 fixed the matching; this
 * fixes the typing, by showing what already exists before somebody invents a
 * fourth spelling of it.
 *
 * ⛔ THE MENU FROM T83 DOES NOT FIT HERE, AND THAT IS WORTH SAYING RATHER THAN
 * FORCING. Its trigger is a button showing a chosen value, and its list is
 * closed. Here the control IS a text input, typing is the primary act, and the
 * list narrows as you type. Same visual recipe, different job.
 *
 * ⛔ THE LIST IS PORTALLED, for the reason Menu's is: this field lives inside a
 * Sheet, and a Sheet scrolls with overflow-auto, so an absolutely positioned list
 * would be clipped by it.
 */
export function Combo({
  label, value, onChange, options, hint, placeholder, testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** What has been used before. Never a limit on what can be typed. */
  options: string[];
  hint?: string;
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(-1);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = `${useId()}-combo`;

  const typed = value.trim().toLowerCase();
  const shown = options.filter((o) => !typed || o.toLowerCase().includes(typed));
  const exact = options.some((o) => o.trim().toLowerCase() === typed);

  const place = useCallback(() => {
    const r = input.current?.getBoundingClientRect();
    if (r) setBox({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const again = () => place();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    return () => { window.removeEventListener("resize", again); window.removeEventListener("scroll", again, true); };
  }, [open, place]);

  /* ⛔ pointerdown with the input excluded — the same click-versus-focus lesson
     Menu carries. Closing on blur and reopening on the click that caused it is a
     control that cannot be dismissed by pressing it. */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (input.current?.contains(t) || list.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); setAt(-1); input.current?.focus(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); setAt(0); return; }
      setAt((n) => (shown.length ? (n + 1) % shown.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAt((n) => (shown.length ? (n - 1 + shown.length) % shown.length : -1));
    } else if (e.key === "Enter") {
      // ⛔ Enter on a highlighted row picks it; Enter on your own words KEEPS
      // them. A combo that overwrote what you typed would be a dropdown wearing
      // a text box, which is the thing this is not.
      if (open && at >= 0 && shown[at]) { e.preventDefault(); choose(shown[at]); }
      else setOpen(false);
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); setAt(-1); }
    }
  };

  return (
    <label className="block mb-3">
      <span className="eyebrow block mb-1">{label}</span>
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && at >= 0 ? `${listId}-${at}` : undefined}
        value={value}
        data-testid={testId}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setAt(-1); }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onKeyDown={onKey}
        className="tap w-full rounded-xl border border-line-medium bg-alloro-surface px-3.5 text-base transition-colors focus:border-alloro-orange"
      />
      {hint ? <span className="t-meta mt-1 block">{hint}</span> : null}

      {open && box && shown.length > 0
        ? createPortal(
            <div
              ref={list}
              id={listId}
              role="listbox"
              aria-label={label}
              data-testid={testId ? `${testId}-list` : undefined}
              style={{ position: "fixed", top: box.top, left: box.left, minWidth: box.width, zIndex: 80 }}
              className="card-radius max-h-64 overflow-auto border border-line-soft bg-alloro-surface py-1 shadow-premium"
            >
              {shown.map((o, i) => (
                <div
                  key={o}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.trim().toLowerCase() === typed}
                  data-testid={testId ? `${testId}-opt` : undefined}
                  data-value={o}
                  onPointerEnter={() => setAt(i)}
                  onClick={() => choose(o)}
                  className={[
                    "cursor-pointer px-3 py-2 text-[13px] font-semibold",
                    i === at ? "bg-alloro-bg text-alloro-navy" : "text-alloro-navy",
                  ].join(" ")}
                >
                  {o}
                </div>
              ))}
              {/* ⛔ SAYS OUT LOUD THAT A NEW ONE IS ALLOWED. Without this a list of
                  existing values reads as the only values, which is the dropdown
                  this deliberately is not. */}
              {!exact && typed ? (
                <p className="t-meta border-t border-line-soft px-3 py-2" data-testid={testId ? `${testId}-new` : undefined}>
                  Or keep &ldquo;{value.trim()}&rdquo; as a new one.
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </label>
  );
}

export function Field({
  label, value, onChange, placeholder, hint, type = "text", testId,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string; testId?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="eyebrow block mb-1">{label}</span>
      <input
        type={type}
        value={value}
        data-testid={testId}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        /* Design §5.4 — 16px on phones, so iOS does not zoom on focus. */
        className="tap w-full rounded-xl border border-line-medium bg-alloro-surface px-3.5 text-base transition-colors focus:border-alloro-orange"
      />
      {hint ? <span className="t-meta mt-1 block">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label, value, onChange, options, testId,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; testId?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="eyebrow block mb-1">{label}</span>
      <select
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        className="tap w-full rounded-xl border border-line-medium bg-alloro-surface px-3.5 text-base transition-colors focus:border-alloro-orange"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** A named placeholder step. ⛔ The sentence comes from the register, verbatim. */
export function Placeholder({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId ?? "placeholder"}
      data-placeholder="true"
      className="measure mb-4 card-radius border border-accent-soft-line bg-accent-soft px-3.5 py-2.5 text-[13px] leading-5"
    >
      {children}
    </p>
  );
}

/**
 * ⛔ A STATUS MESSAGE MUST NOT EAT A CLICK. Found by A13 in Rev 8, and the
 * cause is worth keeping: the toast is a centred bar pinned to the bottom, and
 * T27 CENTRED THE CONTENT COLUMN. Before that the forms sat left-aligned and
 * their Save button was beside the toast; centring put Save directly underneath
 * it. For the six seconds a message is up, Save could not be clicked — by an
 * owner or by the suite. The layout change did not create the overlap; it
 * revealed it.
 *
 * `pointer-events-none` on the bar, `pointer-events-auto` on its one button:
 * the words never block anything, the undo still works.
 */
export function Toast({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div
      role="status"
      data-testid="toast"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-60 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl bg-alloro-navy px-4 py-3 text-white shadow-premium"
    >
      <span className="text-sm">{text}</span>
      {action ? (
        <button type="button" data-testid="toast-action" onClick={onAction} className="pointer-events-auto text-sm font-semibold underline">
          {action}
        </button>
      ) : null}
    </div>
  );
}
