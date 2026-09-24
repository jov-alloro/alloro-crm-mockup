import type { Route } from "./router";

/**
 * T1 — the tabs, from ONE array. THREE since Rev 32: the fourth, "Needs you",
 * became a section of the Dashboard (T125).
 *
 * The rail, the bubble, the phone picker and every page header read this list,
 * so they cannot disagree (spec S0).
 *
 * ⛔ REV 32 REVERSES R5 (four areas). The verdict cards did not die — they
 * moved into the Dashboard as their own section, so the menu names three areas
 * and the "Needs you" question is answered one screen over, not on a tab.
 * Design §12.4 still holds for the three that are left: a tab is an owner
 * question, not the name of a container.
 */

export type AreaKey = "people" | "conversation" | "dashboard";

export interface Area {
  key: AreaKey;
  label: string;
  subtitle: string;
  href: string;
}

/**
 * ⛔ DASHBOARD IS FIRST (Jov, 2026-09-24). The app still OPENS on People and an
 * unknown address still lands there — this array is the menu's order, not the
 * home route. Changing both would move A3's landing and the spec's no-dead-ends
 * rule, which is a larger edit than the menu.
 *
 * ⛔ THE `subtitle` NOW HAS EXACTLY ONE READER: THE PHONE PICKER. The bubble
 * dropped it in round 18 (four one-line sentences under four labels is noise in
 * a menu you already know), and T55 dropped it from the page header in Rev 11.
 * It survives on the phone for the reason U4 gave — there that menu is the only
 * place the sentence is ever seen.
 *
 * ⛔ So this comment is the whole justification for the field. If the phone
 * picker ever stops rendering it, the field is dead and should go with it.
 */
export const AREAS: Area[] = [
  { key: "dashboard", label: "Dashboard", subtitle: "Is it working?", href: "#/dashboard" },
  { key: "people", label: "People", subtitle: "Everyone, and where each one came from.", href: "#/people" },
  { key: "conversation", label: "Conversation", subtitle: "What they said, and who has answered.", href: "#/conversation" },
];

export function area(key: AreaKey): Area {
  return AREAS.find((a) => a.key === key)!;
}

/** Which of the three a screen belongs to. */
export function areaOf(route: Route): AreaKey | null {
  switch (route.name) {
    case "people":
    case "person":
    case "email-group":
    case "import":
    case "import-csv":
    case "import-stripe":
    case "import-receipt":
      return "people";
    case "conversation":
    case "thread":
    case "spam":
      return "conversation";
    case "dashboard":
      return "dashboard";
    default:
      return null;
  }
}

/**
 * The header above every screen. ⛔ A NAME, AND NOTHING ELSE.
 *
 * T46 (Rev 9) gave every sub-screen its own title, because they all read
 * "People". T55 (Rev 11) removes the second line under it.
 *
 * ⛔ THIS REVERSES HALF OF DECISION U4, deliberately. Round 18 removed the
 * one-line subtext from the bubble and KEPT it under the page title. What
 * changed since is the VERDICT: every screen now opens with one, and a verdict
 * carries a number — "151 clients in your list", "26 things need you this week"
 * — which a subtitle never did. The subtitle was the best sentence available in
 * round 18; it is the second-best now, and on three screens it sat three lines
 * from a verdict saying the same thing.
 *
 * ⛔ AREAS KEEPS ITS `subtitle` FIELD. The phone picker still renders it, for
 * exactly the reason U4 gave: on a phone that menu is the only place the
 * sentence is ever seen. The rendering is removed here, not the sentence.
 */
export function headerFor(route: Route): { title: string } {
  const key = areaOf(route);
  if (key) {
    const a = area(key);
    switch (route.name) {
      case "person":
        /* ⛔ T63 (Rev 12): "#/p/new" is no longer its own screen — it is PEOPLE
           with the add sheet open on top. The band names what is underneath, and
           the sheet names itself in its own title. */
        return route.id === "new"
          ? { title: a.label }
          : { title: "One person" };
      case "email-group": return { title: "Email a group" };
      case "import": return { title: "Move in" };
      case "import-csv": return { title: "Move in" };
      case "import-stripe": return { title: "Move in" };
      case "import-receipt": return { title: "What moved in" };
      case "thread": return { title: "One conversation" };
      case "spam": return { title: "Hidden as spam" };
      default: return { title: a.label };
    }
  }
  switch (route.name) {
    case "settings": return { title: "Settings" };
    case "team": return { title: "Who can see what" };
    default: return { title: "Customers" };
  }
}
