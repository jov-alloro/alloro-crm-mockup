/**
 * T1 — the hash router.
 *
 * ⛔ Design §5.3, no dead ends: an address this app does not know resolves to
 * People and rewrites the address bar, never a blank screen. Acceptance A3.
 */

/**
 * T37 (Rev 8) — A FILTER IN THE ADDRESS: `#/people/f/<key>/<value>`.
 *
 * ⛔ This is the item Rev 7 named and refused to build. The dashboard's "Who
 * became a client" tile once read "See the 43 who haven't" and opened all 151,
 * and Rev 7 fixed it by WEAKENING THE LABEL, because there was no filtered
 * address to land on. With one route the promise is keepable again — and the
 * same address is what lets a chart bar open the people behind it (T36).
 *
 * `unpaid` is its own key rather than a combination, because "wrote in and never
 * paid" is not expressible in the five chip filters: status "new" also excludes
 * anyone who has gone quiet.
 */
export type PeopleFilterKey = "status" | "stage" | "got" | "found" | "mark" | "unpaid";
export interface PeopleFilter {
  key: PeopleFilterKey;
  value: string;
}

export type Route =
  | { name: "people"; filter?: PeopleFilter }
  | { name: "person"; id: string }
  | { name: "email-group" }
  | { name: "import" }
  | { name: "import-csv"; source: string }
  | { name: "import-stripe" }
  | { name: "import-receipt"; id: string }
  | { name: "conversation" }
  | { name: "thread"; id: string }
  | { name: "spam" }
  | { name: "dashboard" }
  | { name: "settings" }
  | { name: "team" };

export const HOME = "#/people";

/**
 * T125 (Rev 32) — `redirect` is set when an address is OLD but still means
 * something. `#/needs` was the fourth tab, then a Dashboard section (Rev 32),
 * and since Rev 33 the cards are a top-three block on the Dashboard. A bookmark
 * to either old address lands on the Dashboard and the bar says so (Design
 * §5.3), rather than falling through to People.
 */
export function parse(hash: string): { route: Route; known: boolean; redirect?: string } {
  const h = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  const parts = h.split("/").filter(Boolean);
  const [a, b, c] = parts;
  if (!a) return { route: { name: "people" }, known: true };
  switch (a) {
    case "people":
      if (!b) return { route: { name: "people" }, known: true };
      if (b === "email") return { route: { name: "email-group" }, known: true };
      if (b === "f") {
        // #/people/f/<key>/<value>  — and #/people/f/unpaid, which takes none.
        const key = c as PeopleFilterKey | undefined;
        if (key === "unpaid") return { route: { name: "people", filter: { key, value: "" } }, known: true };
        const value = parts[3];
        if (key && value && ["status", "stage", "got", "found", "mark"].includes(key)) {
          return { route: { name: "people", filter: { key, value } }, known: true };
        }
        // An unknown filter is an unknown address: People, and the bar rewrites.
        return { route: { name: "people" }, known: false };
      }
      if (b === "import") {
        if (!c) return { route: { name: "import" }, known: true };
        if (c === "stripe") return { route: { name: "import-stripe" }, known: true };
        if (c === "csv") return { route: { name: "import-csv", source: parts[3] ?? "csv" }, known: true };
        return { route: { name: "import-receipt", id: c }, known: true };
      }
      break;
    case "p":
      if (b) return { route: { name: "person", id: b }, known: true };
      break;
    case "conversation":
      if (!b) return { route: { name: "conversation" }, known: true };
      if (b === "spam") return { route: { name: "spam" }, known: true };
      return { route: { name: "thread", id: b }, known: true };
    case "needs":
      return { route: { name: "dashboard" }, known: true, redirect: "#/dashboard" };
    case "dashboard":
      /* Rev 33 — `#/dashboard/needs` existed for one round (Rev 32). Anybody who
         bookmarked it lands on the Dashboard, where the top three cards live. */
      if (b === "needs") return { route: { name: "dashboard" }, known: true, redirect: "#/dashboard" };
      return { route: { name: "dashboard" }, known: true };
    case "settings":
      if (b === "team") return { route: { name: "team" }, known: true };
      return { route: { name: "settings" }, known: true };
  }
  return { route: { name: "people" }, known: false };
}

export function href(route: Route): string {
  switch (route.name) {
    case "people":
      return route.filter
        ? route.filter.key === "unpaid"
          ? "#/people/f/unpaid"
          : `#/people/f/${route.filter.key}/${route.filter.value}`
        : "#/people";
    case "person": return `#/p/${route.id}`;
    case "email-group": return "#/people/email";
    case "import": return "#/people/import";
    case "import-csv": return `#/people/import/csv/${route.source}`;
    case "import-stripe": return "#/people/import/stripe";
    case "import-receipt": return `#/people/import/${route.id}`;
    case "conversation": return "#/conversation";
    case "thread": return `#/conversation/${route.id}`;
    case "spam": return "#/conversation/spam";
    case "dashboard": return "#/dashboard";
    case "settings": return "#/settings";
    case "team": return "#/settings/team";
  }
}
