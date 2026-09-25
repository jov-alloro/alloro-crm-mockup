import type { Route } from "./router";
import { AREAS, areaOf } from "./areas";

/**
 * T39 · T40 (Rev 9) — THE ONE PLACE A PAGE WIDTH, A GUTTER OR A PARENT IS
 * WRITTEN.
 *
 * ═══ ONE WIDTH, EVERY SCREEN ═══
 *
 *   column        1280px maximum, centred
 *   phone gutter  16px each side   (<640px)
 *   desktop       32px each side   (≥640px)
 *
 * ⛔ REV 8 HAD TWO WIDTHS AND THAT WAS THE DEFECT. A 768px reading column and a
 * 1400px wide column cannot produce one margin. Measured at a 1280px window with
 * the 240px rail: the left margin was 32px on People and 168px on every other
 * screen, so the page visibly jumped as you moved between tabs. Two widths are
 * two margins; there is no tuning that fixes it, only removal.
 *
 * ⛔ AND THE PARAGRAPH IS WHAT GETS CAPPED, NOT THE PAGE. Rev 8 narrowed the page
 * to protect line length, which is backwards: it moved every margin on every
 * screen to solve a problem that lives inside one card. `.measure` (index.css)
 * caps running text at 68 characters where it appears, so a mail thread reads
 * correctly in a 1280px column while the People table still gets the full width.
 */

/** The single column maximum. There is no second one. */
export const COLUMN_MAX = "max-w-[1280px]";
/** 16px at 375px, 32px from 640px up. Both gutters, in one string, once. */
export const GUTTER = "px-4 sm:px-8";

/** The container class. ⛔ Every screen gets the same one. */
export const CONTAINER = `mx-auto w-full ${COLUMN_MAX} ${GUTTER}`;

export function containerClass(): string {
  return CONTAINER;
}

/**
 * ═══ T40 — UP, NOT BACK ═══
 *
 * ⛔ REV 8 KEPT ONE "PREVIOUS SCREEN" SLOT AND IT LOOPED, EVERY TIME:
 *
 *     A → B    slot = A    Back → A
 *     now A    slot = B    Back → B      ← trapped between two pages
 *
 * A single slot cannot hold a history, and A38b passed it because the check only
 * ever pressed Back once. Reported by Jov, who pressed it twice.
 *
 * ⛔ THE FIX IS TO STOP KEEPING HISTORY AT ALL. Every screen has ONE FIXED
 * PARENT, so there is no memory to disagree with and a loop is impossible by
 * construction rather than by care.
 *
 * ⛔ THE COST IS REAL AND IS ACCEPTED: reaching a person FROM a thread and
 * pressing Up lands on People, not back on the thread. The browser's own Back
 * still covers that case and is untouched. Android made this exact trade, for
 * this exact reason.
 */
export interface UpTarget {
  href: string;
  label: string;
}

/** The four tabs are the top of the tree. They carry no Up control. */
export function isTab(route: Route): boolean {
  return AREAS.some((a) => a.href === `#/${route.name}`);
}

/**
 * T85 (Rev 18) — ⛔ WHICH ARRIVALS A SCREEN IS ALLOWED TO REMEMBER.
 *
 * Jov's walk: Conversation → open a message → "open their page" → press Back,
 * and land on People. The person's page always answered "Back to People",
 * whoever sent you there. It has been wrong since the Up control was built, and
 * the comment below explains why cheerfully: a fixed parent cannot ping-pong.
 * True, and it was also the whole defect.
 *
 * ⛔ THE LOOP IS KEPT OUT BY THIS TABLE, NOT BY A RUNTIME CHECK. A38d requires
 * that pressing Back twice never returns you to where you started, and a
 * remembered origin is exactly how that loop gets built — person A links to
 * person B, B remembers A, A remembers B, and Back bounces forever. No screen
 * may remember an arrival from its own kind, and nothing here lists one.
 *
 * Everything not named here keeps the fixed parent, which is also what a cold
 * address bar gets: arrive at a person's page directly and there is no origin
 * to remember, so it lands on the owning tab. A38d checks that too.
 */
const REMEMBERS: Partial<Record<Route["name"], Route["name"][]>> = {
  person: ["thread", "dashboard", "conversation", "spam", "email-group"],
  /* Rev 33 — People carries the top-three cards too, and a card can open a thread. */
  thread: ["dashboard", "people"],
};

export function upTarget(route: Route, from?: Route | null, fromLabel?: string): UpTarget | null {
  if (isTab(route)) return null;
  /* ⛔ The remembered origin beats the fixed parent, and ONLY for an arrival the
     table above allows. It needs a label naming where it goes — A38a forbids a
     bare "Back", and "Back" alone is the exact control this fix exists to
     replace. Without a label, fall through to the parent. */
  if (from && fromLabel && REMEMBERS[route.name]?.includes(from.name)) {
    const href = hrefOf(from);
    if (href) return { href, label: `Back to ${fromLabel}` };
  }
  /* ⛔ T63 (Rev 12): "#/p/new" renders PEOPLE with the add sheet on top, so it is
     a tab for this purpose. Without this it showed "Back to People" while you
     were already standing on People — a control offering to take you where you
     already are. */
  if (route.name === "person" && route.id === "new") return null;
  switch (route.name) {
    /*
      T92 (Rev 21) — ⛔ THE FILE STEPS GO BACK TO MOVE IN, NOT TO PEOPLE.
      Jov: "the back button here is not functioning well, it will go back
      immediately to People." Move in is two screens — pick a source, then match
      the columns and look at the preview — and Back from the second skipped the
      first entirely, so the owner could not change their mind about the source
      without starting over from the list.

      ⛔ A38a PASSED THIS FOR NINETEEN REVISIONS. It asks whether the control
      NAMES its destination. It did: it said "Back to People" and went to People.
      Naming a destination and naming the RIGHT one are different questions, and
      this is the third control this week to pass the first while failing the
      second — after "Added by" over a marks menu and "Call" on a button that
      opens a message.

      ⛔ THE RECEIPT IS NOT ONE OF THEM, and that is a decision rather than an
      oversight. It is shown AFTER an import has happened; sending somebody back
      to "pick a source" from it offers to redo what they just did. Its parent is
      the list the people landed in.
    */
    case "import-csv":
    case "import-stripe":
      return { href: "#/people/import", label: "Back to Move in" };
    case "person":
    case "email-group":
    case "import":
    case "import-receipt":
      return { href: "#/people", label: "Back to People" };
    case "thread":
    case "spam":
      return { href: "#/conversation", label: "Back to Conversation" };
    case "team":
      return { href: "#/settings", label: "Back to Settings" };
    case "settings":
      // Settings hangs off the rail, not off a tab. People is the app's home
      // (router.HOME), so that is its parent — never a dead end (Design §5.3).
      return { href: "#/people", label: "Back to People" };
    default:
      return null;
  }
}

/** The address a route was reached at. Only the origins REMEMBERS allows. */
function hrefOf(r: Route): string | null {
  switch (r.name) {
    case "thread": return `#/conversation/${r.id}`;
    case "spam": return "#/conversation/spam";
    /* T125 (Rev 32) — the section a card was opened from, not just the tab. The
       verdict cards live IN the Dashboard now, so "Back" from a person or a
       thread must return to the list you were working down, not the top of the
       page. */
    case "dashboard": return "#/dashboard";
    case "conversation": return "#/conversation";
    case "people": return "#/people";
    case "email-group": return "#/people/email";
    default: return null;
  }
}

export { areaOf };
