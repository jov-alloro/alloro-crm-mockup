import { canSeeMoney } from "../lib/permissions";
import { useEffect, useMemo, useState } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, Chip, EmptyState, PageSkeleton, Sheet, Verdict } from "../components/ui";
import { AddByHand } from "./PersonPage";
import { Icon } from "../components/icons";
import { Menu, type MenuOption } from "../components/Menu";
import { InlineCard } from "../components/Cards";
import { FOUND_LABEL, GOT_LABEL, statusLabel, type Profile } from "../lib/engine";
import { STAGES, type Stage } from "../lib/packs";
import { money, plural, relativeDay } from "../lib/format";
import { inlineCard } from "../lib/cards";
import type { GotKey, FoundKey } from "../data/types";
import type { PeopleFilter } from "../lib/router";

/** S1 — People. The stage chips replace the cut Pipeline board (spec R2). */

type StatusFilter = "all" | "new" | "customer" | "came-back" | "not-back";
type MarkFilter = "none" | "not-a-fit" | "do-not-contact" | "hidden";
/**
 * T80 (Rev 17) — ⛔ A SORT IS A COLUMN AND A DIRECTION, so the key carries both.
 *
 * Until now "name" meant A–Z and nothing could ask for Z–A; "year" meant most
 * first and nothing could ask for least. Half of every sort was unreachable and
 * no check could see it, because A59 only asked whether the values that EXIST
 * are reachable — never whether the ones a person would want exist at all.
 *
 * One value, not two pieces of state: two would let "name" and "low" be true at
 * the same time, which is a state the screen cannot draw.
 */
type SortKey =
  | "name-az" | "name-za"
  | "last-new" | "last-old"
  | "year-high" | "year-low"
  | "total-high" | "total-low";

/** T79 (Rev 17) — what one header's menu is; see the note above Th. */
type ThMenu = {
  id: string;
  col: string;
  aria: string;
  value: string;
  onChange: (v: string) => void;
  on: boolean;
  chosen?: string;
  caret: "menu" | "up" | "down";
  options: MenuOption[];
};

/**
 * T84 (Rev 18) — ⛔ THE TABLE'S DEFAULT ORDER, NAMED ONCE.
 *
 * Jov: "when you click it and click it again, it won't go back." He was right,
 * and the cause was mine: a sorted column's menu held nothing that undid it.
 *
 * ⛔ BUT "NOT SORTED" IS NOT A STATE A TABLE CAN BE IN. It always has an order,
 * so an option offering to remove it would be a third header lying in three
 * rounds. The way out returns the list to THIS, and says so in those words.
 */
const DEFAULT_SORT: SortKey = "name-az";

export default function People({ filter, addOpen }: { filter?: PeopleFilter; addOpen?: boolean }) {
  const ui = useUi();
  const { model, world, viewer } = ui;
  const pack = model.pack;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [got, setGot] = useState<GotKey | "all">("all");
  const [found, setFound] = useState<FoundKey | "all">("all");
  const [mark, setMark] = useState<MarkFilter>("none");
  /**
   * T79 (Rev 17) — ⛔ THIS IS THE FIX FOR A HEADER THAT LIED.
   *
   * The header read "Added by" and its menu filtered the owner's MARKS — Not a
   * fit, Do not contact, Hidden. Nothing about who added anyone. It got there
   * because the marks filter had no column of its own and I put it under
   * somebody else's label, one round after arguing that a filter with no column
   * must not have one invented for it. Hiding it under a wrong label is worse
   * than inventing a column: a column would at least have been honest.
   *
   * Who added a person is real data — the owner, a staff member, or Alloro
   * itself — and it is already in the column. Now the menu filters it.
   */
  const [addedBy, setAddedBy] = useState<string>("all");
  /** T37 — "wrote in, never paid". Its own filter; see the note in router.ts. */
  const [unpaid, setUnpaid] = useState(false);
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  /**
   * T72 (Rev 14) — ⛔ THE PAGE RESETS WHEN THE RESULT CHANGES. A stale page 7
   * over a three-row result is the classic bug in every paginated list: the
   * filter works, the count is right, and the screen is empty. A58 checks it.
   *
   * ⛔ AND THE SIZE IS 25, NOT 10. Ten per page is SIXTY-FIVE PAGES for 643
   * people, and nobody pages through sixty-five screens — at that size
   * pagination is a way to not find someone. What finds a person here is search
   * and the filters, both of which already existed.
   */
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  /**
   * T37 (Rev 8) — a filter can arrive in the address, so a chart bar or a
   * dashboard tile can open the people behind its own number.
   *
   * ⛔ The address SETS the filter once and then stops mattering. Keying the
   * effect to the filter's key and value is what keeps it a one-shot: without
   * that, removing a chip would be undone on the next render and the chip would
   * look broken.
   */
  const fKey = filter?.key;
  const fValue = filter?.value;
  useEffect(() => {
    // ⛔ LEAVING A FILTERED ADDRESS CLEARS THE FILTER. Without this, the chips
    // survived the navigation: #/people/f/found/google -> #/people showed 38 of
    // 151 rows while the address said "everyone". A list that disagrees with its
    // own address is the class of lie this project exists to avoid, and the
    // suite caught it (A43b).
    setStatus("all"); setStage("all"); setGot("all"); setFound("all"); setMark("none"); setAddedBy("all"); setUnpaid(false);
    // ⛔ AND IT CLEARS THE SEARCH. Arriving from a chart bar with a stale search
    // box shows an empty list and blames the filter for it (A42c).
    setQ("");
    if (!fKey) return;
    switch (fKey) {
      case "status": setStatus(fValue as StatusFilter); break;
      case "stage": setStage(fValue as Stage); break;
      case "got": setGot(fValue as GotKey); break;
      case "found": setFound(fValue as FoundKey); break;
      case "mark": setMark(fValue as MarkFilter); break;
      case "unpaid": setUnpaid(true); break;
    }
  }, [fKey, fValue]);

  const showMoney = canSeeMoney(viewer);

  /** Everything the chips filter from — hidden people only when asked for. */
  const base = useMemo(
    () => (mark === "hidden" ? model.list.filter((p) => p.c.hidden && !p.c.erased) : model.visible),
    [model, mark],
  );

  const match = useMemo(
    () => (p: Profile, skip?: string) => {
      if (skip !== "status" && status !== "all" && p.status !== status) return false;
      if (skip !== "stage" && stage !== "all" && p.stage !== stage) return false;
      if (skip !== "got" && got !== "all" && !p.got.includes(got)) return false;
      if (skip !== "found" && found !== "all" && p.found !== found) return false;
      if (skip !== "mark" && mark === "not-a-fit" && p.c.mark !== "not-a-fit") return false;
      if (skip !== "mark" && mark === "do-not-contact" && p.c.mark !== "do-not-contact") return false;
      if (skip !== "added" && addedBy !== "all" && p.c.addedBy !== addedBy) return false;
      if (skip !== "unpaid" && unpaid && !(p.got.includes("form") && p.buys.length === 0)) return false;
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        const hay = [p.c.name, p.c.email ?? "", p.c.phone ?? "", p.c.category ?? ""].join(" ").toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    },
    [status, stage, got, found, mark, addedBy, unpaid, q],
  );

  const rows = useMemo(() => {
    const out = base.filter((p) => match(p));
    /**
     * T79 (Rev 17) — ⛔ THE SECOND HEADER THAT LIED, AND IT LIED MORE QUIETLY.
     *
     * The column is "Last thing" and its cell shows the last EVENT — T71 changed
     * it on purpose, because somebody who wrote yesterday and never paid used to
     * look identical to somebody gone two years. The sort under that same header
     * was never changed with it and still read `lastBuy`, the last PAYMENT.
     *
     * So clicking "Last thing" reordered the table by a number the column does
     * not show. Nothing failed, no check could see it, and the only way to catch
     * it was to read the sort next to the cell it claims to sort. A61 now checks
     * the filter half of this rule mechanically; this half is still read by eye.
     */
    const last = (x: Profile) => x.events[0]?.date ?? "";
    return out.slice().sort((a, b) => {
      switch (sort) {
        case "name-za": return b.c.name.localeCompare(a.c.name);
        case "last-new": return last(b).localeCompare(last(a));
        // ⛔ "Nothing yet" is not the oldest thing, it is the absence of one, so
        // it goes last in BOTH directions rather than heading the oldest-first list.
        case "last-old": {
          const x = last(a), y = last(b);
          if (!x || !y) return x === y ? 0 : x ? -1 : 1;
          return x.localeCompare(y);
        }
        case "year-high": return b.spent12 - a.spent12;
        case "year-low": return a.spent12 - b.spent12;
        case "total-high": return b.spentTotal - a.spentTotal;
        case "total-low": return a.spentTotal - b.spentTotal;
        default: return a.c.name.localeCompare(b.c.name);
      }
    });
  }, [base, match, sort]);

  /**
   * T33 — EVERY FILTER CARRIES ITS COUNT, and the count is what it would give
   * you WITH THE OTHER FILTERS STILL ON. A count that ignored the other chips
   * would promise 38 and deliver 4.
   *
   * ⛔ A chip reading 0 is DISABLED. That is the point of counting: a filter
   * that would drop you on a silent empty screen cannot be clicked at all.
   */
  const countIf = (dim: string, pred: (p: Profile) => boolean) =>
    base.filter((p) => match(p, dim) && pred(p)).length;

  /** T79 — the people who have added anyone: the owner, their staff, and Alloro. */
  const addedByNames = useMemo(
    () => Array.from(new Set(model.list.filter((x) => !x.c.erased).map((x) => x.c.addedBy))).sort(),
    [model],
  );

  /**
   * T80 (Rev 17) — ⛔ ONE MENU SHAPE FOR ALL NINE HEADERS, and the two builders
   * below are the only difference between them. A header offers what ITS column
   * can honestly do: a name can be sorted and not filtered, a stage can be
   * filtered and not usefully sorted, and neither should pretend otherwise.
   */
  const filterMenu = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    all: { label: string; n: number },
    options: { value: string; label: string; n: number }[],
    noneValue = "all",
  ): ThMenu => ({
    id: `filter-${id}`,
    col: id,
    aria: all.label,
    value,
    onChange,
    on: value !== noneValue,
    chosen: options.find((o) => o.value === value)?.label,
    caret: "menu",
    // ⛔ THE COUNT IS A HINT, NOT PART OF THE LABEL. In a native <option> the two
    // had to be one string; in Alloro's menu the count sits right-aligned in its
    // own column, so the labels line up and read as words rather than as data.
    options: [
      { value: noneValue, label: all.label, hint: String(all.n) },
      ...options.map((o) => ({
        value: o.value,
        label: o.label,
        hint: String(o.n),
        disabled: o.n === 0 && value !== o.value,
      })),
    ],
  });

  /**
   * ⛔ THE CARET IS THE WHOLE SIGNAL FOR A SORT. The chip row above the table
   * shows filters, not sorts, so without this a table sorted Z–A would say so
   * nowhere. It does NOT also write ": Z–A" into the label: one signal, not two.
   */
  const sortMenu = (
    id: string,
    name: string,
    opts: { value: SortKey; label: string; dir: "up" | "down" }[],
  ): ThMenu => {
    const cur = opts.find((o) => o.value === sort);
    return {
      id: `sort-${id}`,
      col: id,
      aria: `Sort by ${name}`,
      value: cur ? cur.value : "",
      onChange: (v) => setSort(v as SortKey),
      on: !!cur,
      caret: cur ? cur.dir : "menu",
      options: [
        ...opts.map((o) => ({ value: o.value, label: o.label })),
        /*
          T84 (Rev 18) — ⛔ THE WAY BACK, AND IT ONLY APPEARS WHEN THERE IS ONE.
          Rev 17's menu offered a DISABLED "Not sorted" placeholder while a column
          was unsorted and nothing at all once it was, so a sort could be turned on
          and never off. Both directions are always listed now, so any sorted column
          can be reversed from its own menu; this third row returns the whole table
          to its default. Name needs no such row — its own A–Z is the default.
        */
        ...(cur && id !== "name" ? [{ value: DEFAULT_SORT, label: "Sort by name instead (A–Z)" }] : []),
      ],
    };
  };

  /**
   * T87 (Rev 19) — ⛔ A FILTER IS SHOWN ONCE: IN ITS HEADER IF IT HAS ONE, IN A
   * CHIP IF IT DOES NOT.
   *
   * Jov: "this showing is just redundant, the user already knows what he
   * filtered." He is right, and by a rule I had written three hours earlier.
   * T80 says the caret is the WHOLE signal for a sort and the label does not
   * also spell the direction out, because two signals for one fact read as two
   * facts. I applied that to sorts and left the filters repeating themselves:
   * the header already reads STATUS: CLIENT in ink, and the chip said it again.
   *
   * ⛔ BUT THE ROW DOES NOT GO, AND BOTH REASONS ARE MINE. A filter can arrive
   * from an ADDRESS — a dashboard chart lands the owner on a filtered list they
   * did not set, so "he knows, he set it" is false there. And T82 cut the Stage
   * and Came from COLUMNS last round, so those two have no header left to show
   * them; the chip is now the only place either one can appear.
   */
  const active: { key: string; label: string; chip: boolean; clear: () => void }[] = [];
  if (status !== "all") active.push({ key: "status", label: statusLabel(status, pack), chip: false, clear: () => setStatus("all") });
  // ⛔ These two name their FIELD, because they no longer have a column heading
  // to borrow it from. "Asked" alone does not say it is a stage.
  if (stage !== "all") active.push({ key: "stage", label: `Stage: ${STAGES.find((s) => s.key === stage)?.label ?? stage}`, chip: true, clear: () => setStage("all") });
  if (got !== "all") active.push({ key: "got", label: `Came from: ${GOT_LABEL[got]}`, chip: true, clear: () => setGot("all") });
  if (found !== "all") active.push({ key: "found", label: `Found you: ${FOUND_LABEL[found]}`, chip: false, clear: () => setFound("all") });
  if (mark !== "none") active.push({ key: "mark", label: markLabel(mark), chip: false, clear: () => setMark("none") });
  if (addedBy !== "all") active.push({ key: "added", label: `Added by: ${addedBy}`, chip: false, clear: () => setAddedBy("all") });
  if (unpaid) active.push({ key: "unpaid", label: "Wrote in, never paid", chip: false, clear: () => setUnpaid(false) });
  const chips = active.filter((a) => a.chip);

  /**
   * T91 (Rev 20) — ⛔ RESET MEANS EVERYTHING, AND THE RENAME IS WHAT FORCED IT.
   *
   * Rev 19 called this "Clear all" and it put back filters, views and the sort
   * while LEAVING THE SEARCH BOX ALONE. As "Clear all" that was arguable. As
   * "Reset" it is a lie: press it with text typed in the box and the list is
   * still filtered by that text, while the word says everything went back.
   *
   * ⛔ THAT IS THE FOURTH CONTROL IN FOUR ROUNDS THAT WOULD HAVE SAID SOMETHING
   * IT DOES NOT DO — after the header labelled "Added by" over a marks menu, the
   * sort under "Last thing" reading the last payment, and the button saying
   * "Call" that opens a message. The name changed, so the behaviour had to.
   *
   * ⛔ A42c IS NOT AFFECTED, AND I CHECKED RATHER THAN ASSUMED. It reaches each
   * of its three empty screens by ADDRESS and by typing, never by pressing this
   * button, so the three sentences stay three sentences.
   */
  const clearAll = () => {
    setStatus("all"); setStage("all"); setGot("all"); setFound("all"); setMark("none"); setAddedBy("all"); setUnpaid(false);
    setSort(DEFAULT_SORT);
    setQ("");
  };
  /* ⛔ A SEARCH ALONE IS ENOUGH TO SHOW IT. It was not before, because the button
     could not have undone one. */
  const anythingOn = active.length > 0 || sort !== DEFAULT_SORT || q.trim().length > 0;

  /* T72 — anything that changes WHICH rows there are puts you back on page 1. */
  useEffect(() => { setPage(1); }, [status, stage, got, found, mark, addedBy, unpaid, q, sort, model]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const from = (Math.min(page, pages) - 1) * PAGE_SIZE;
  const shown = rows.slice(from, from + PAGE_SIZE);

  if (ui.loading) return <PageSkeleton rows={6} search />;

  const feedDown = !world.feeds.payments.ok;
  const visibleIds = new Set(rows.map((r) => r.c.id));
  const card = inlineCard(ui.cards, "people", visibleIds);

  const total = model.visible.length;
  const verdict =
    total === 0
      ? "Nobody here yet."
      /*
       * T111 (Rev 29) — ⛔ "151 CLIENTS IN YOUR LIST" COUNTED 59 NEW INQUIRIES.
       *
       * The pack renames the CUSTOMER word per business — client, customer,
       * patient — and the whole-list headline borrowed it. But the list is not a
       * list of clients: fifty-nine of those people have only ever asked a
       * question, and "Client" is a status on this very screen that 67 of them
       * hold. The headline was contradicting a column next to it.
       *
       * The list says PEOPLE. The pack word stays where it is true: on the
       * status, and on "Search clients", which is what the owner is doing.
       */
      : `${plural(total, "person", "people")} in your list.`;

  return (
    <div>
      <Verdict sub={active.length || q.trim() ? `${plural(rows.length, "match", "matches")} with these filters.` : undefined}>
        {verdict}
      </Verdict>

      {card ? <InlineCard card={card} quiet /> : null}

      {/*
        T63 — ⛔ THE ADD FORM OPENS OVER THE LIST, so the owner never loses their
        place in it. The Sheet already handles Escape and hands focus back to
        whatever opened it; closing returns to the plain list address.
      */}
      {addOpen ? (
        <Sheet title="Add by hand" onClose={() => ui.go("#/people")} wide>
          <AddByHand onClose={() => ui.go("#/people")} />
        </Sheet>
      ) : null}

      {feedDown ? (
        <Card className="mb-4 border-amber">
          <p className="t-body font-semibold">Alloro isn't receiving your payments since {world.feeds.payments.downSince}.</p>
          <p className="t-meta mt-1">Money is unknown while this lasts, and nobody is flagged as hasn't been back.</p>
        </Card>
      ) : null}

      {/*
        T41 (Rev 9) — ⛔ EMAIL IS NOT ONE OF THESE BUTTONS. Search, Add by hand
        and Move in all act on ONE person or on getting people IN; Email acts on
        the WHOLE LIST. Rev 8 put all four in one group, so the most far-reaching
        control on the screen sat in the same run as "Add by hand". The divider
        is the whole point of the change.

        ⛔ Add by hand leads, because it is the thing an owner does at their desk
        with somebody on the phone. Move in is a once-a-quarter job. Design §4.3
        still caps this screen at one primary, and it steps down when the inline
        card above already holds it.
      */}
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:[&>*:last-child]:ml-auto">
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted-text-safe">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="people-search"
            placeholder={`Search ${pack.customers}`}
            aria-label={`Search ${pack.customers}`}
            className="tap w-full rounded-xl border border-line-soft bg-alloro-surface pl-9 pr-3 text-base shadow-premium transition-colors focus:border-alloro-orange"
          />
        </div>
        {/* ⛔ ALWAYS PRIMARY, and this overrules an earlier call of mine. I had it
            step down while the inline card held the screen's one primary, on the
            reading that "Rosa wrote 30 days ago" outranks adding somebody. Jov
            decided the other way: the row's leading action should look like the
            leading action every time. Design §4.3's cap is kept by demoting the
            inline card's button on THIS screen instead (see People's InlineCard
            below) — still one primary, a different one. */}
        {/* ⛔ AND IT STEPS DOWN WHILE THE SHEET IS OPEN. T63 put the add form on
            top of this screen, so for a moment BOTH this button and the sheet's
            Save were primary — A31 caught it at #/p/new=2. The sheet is the task
            while it is open, so the button behind it is not the way forward.
            Design §4.3 caps the SCREEN, and a sheet is part of the screen. */}
        {/* T91 (Rev 20) — ⛔ AND IT IS NOT HERE ANY MORE. Rev 19 put it beside the
            search, which meant "Add by hand" — the screen's ONE PRIMARY — slid to
            the right the moment any filter came on. The leading action of the
            screen moved depending on what was filtered. I saw that in the built
            screenshot and did not put it in the report; Jov found it in the next
            one. It lives at the far right of the Views row now, where nothing it
            appears beside is load-bearing. */}
        <Button testId="people-add-hand" icon="add" primary={!addOpen} onClick={() => ui.go("#/p/new")}>Add by hand</Button>
        <Button testId="people-add" icon="movein" onClick={() => ui.go("#/people/import")}>Move in</Button>
        {showMoney ? (
          <>
            {/* ⛔ ml-auto, not a divider (Jov, 2026-09-24). A divider says "these
                are two groups"; pushing Email to the far edge says it as well,
                and says it without adding a mark to the screen. The gap IS the
                separation. The divider element stays as the phone's fallback,
                where a wrapped row has no far edge to push to. */}
            <span aria-hidden="true" data-testid="people-divider" className="mx-1 h-8 w-px bg-line-soft sm:hidden" />
            <Button testId="people-email" icon="mail" full={false} onClick={() => ui.go("#/people/email")}>Email</Button>
          </>
        ) : null}
      </div>

      {/*
        T33 — WHICH FILTERS ARE ON IS VISIBLE AT ALL TIMES, without opening
        anything. Before Rev 8 the only sign was a button reading "Filters · 2
        on", and you had to open the panel to find out WHICH two. Each chip here
        names one filter and removes just that one; the last control clears all.
      */}
      {/*
        T76 (Rev 15) — ⛔ A SEGMENT, NOT A COLUMN. "Wrote in, never paid" is a
        QUESTION about a person, not a fact stored on one, and its answer already
        sits in "Spent ever" two columns away. Giving it a column so a header
        dropdown had somewhere to live would have been a column restating another
        column — the interface writing the data model. A saved view is what this
        actually is, so it looks like one.
      */}
      <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="people-views">
        <span className="eyebrow">Views</span>
        <Segment
          testId="segment-unpaid"
          on={unpaid}
          n={countIf("unpaid", (x) => x.got.includes("form") && x.buys.length === 0)}
          onClick={() => setUnpaid((v) => !v)}
        >
          Wrote in, never paid
        </Segment>
        {/*
          T79 (Rev 17) — ⛔ THE MARKS LAND HERE, WHICH IS WHERE THEY BELONGED.
          "Show me the ones I marked not a fit" is the same kind of thing as
          "show me who wrote in and never paid": a question you ask of the list,
          not a fact printed in a column. It gets the control that already means
          that on this screen instead of a header label that means something else.
        */}
        <Segment
          testId="segment-not-a-fit"
          on={mark === "not-a-fit"}
          n={model.visible.filter((x) => match(x, "mark") && x.c.mark === "not-a-fit").length}
          onClick={() => setMark((m) => (m === "not-a-fit" ? "none" : "not-a-fit"))}
        >
          Not a fit
        </Segment>
        <Segment
          testId="segment-do-not-contact"
          on={mark === "do-not-contact"}
          n={model.visible.filter((x) => match(x, "mark") && x.c.mark === "do-not-contact").length}
          onClick={() => setMark((m) => (m === "do-not-contact" ? "none" : "do-not-contact"))}
        >
          Do not contact
        </Segment>
        <Segment
          testId="segment-hidden"
          on={mark === "hidden"}
          n={model.list.filter((x) => x.c.hidden && !x.c.erased).length}
          onClick={() => setMark((m) => (m === "hidden" ? "none" : "hidden"))}
        >
          Hidden
        </Segment>
        {/*
          T91 (Rev 20) — ⛔ THE FAR EDGE, USING THE ANSWER THIS FILE ALREADY GAVE.
          Jov chose ml-auto over a divider for the Email button on 2026-09-24, and
          the reason is recorded there: a divider says "these are two groups", and
          pushing to the far edge says the same thing without adding a mark to the
          screen. The Views row asks the identical question — what you turn on at
          one end, what turns it off at the other — so it gets the identical
          answer rather than a second one.

          ⛔ ml-auto ON THE BUTTON'S OWN WRAPPER, NOT ON THE ROW'S LAST CHILD. The
          button is conditional, so a rule aimed at "last child" would grab the
          Hidden segment and float it right whenever nothing was on.

          ⛔ AND THE PHONE HAS NO FAR EDGE to push to, because the row wraps. Same
          problem, same fallback as Email: a divider shown only below sm.
        */}
        {anythingOn ? (
          <>
            <span aria-hidden="true" data-testid="views-divider" className="mx-1 h-8 w-px bg-line-soft sm:hidden" />
            <span className="sm:ml-auto">
              <Button small icon="reset" testId="people-clear" onClick={clearAll}>Reset</Button>
            </span>
          </>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="active-filters">
          <span className="eyebrow">Showing</span>
          {chips.map((a) => (
            <button
              key={a.key}
              type="button"
              data-testid={`active-${a.key}`}
              onClick={a.clear}
              aria-label={`Stop filtering by ${a.label}`}
              className="tap inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-alloro-navy bg-alloro-navy px-3 text-[13px] font-semibold text-white transition-colors hover:bg-alloro-deepblue"
            >
              {a.label}
              <Icon name="close" size={13} />
            </button>
          ))}
        </div>
      ) : null}

      {/*
        T42 (Rev 9) — ⛔ ONE ROW OF DROPDOWNS, NOT THIRTY PILLS.

        Rev 8's T33 gave every chip its count and disabled every zero, and A42b
        passed. It was still six rows and thirty controls, and Jov called it a
        wall. A COUNT ON A CONTROL DOES NOT MAKE THIRTY CONTROLS READABLE — and
        no assertion in the suite could have said so, because that judgement
        needs a person looking at the screen.

        A dropdown is boring, which is the point: six of them fit one row, the
        counts live inside the list where they are read on demand rather than
        all at once, and a zero option is disabled IN the list so the number is
        still visible without being clickable.

        The active-filter chips above and the one Clear all control are kept
        exactly as they were. Those were the parts that worked.
      */}

      {/*
        T34 — THREE EMPTIES, THREE DIFFERENT SENTENCES, each with its own way
        out. One "nothing here" for all three is the failure this exists to stop:
        the owner cannot tell an empty list from a bad search from a filter they
        forgot was on.
      */}
      {rows.length === 0 ? (
        <div className="mt-4">
          {total === 0 ? (
            <EmptyState
              title="Nobody here yet."
              body="People appear when someone writes through your website or pays you. You can also add them yourself, or bring a file in."
              action={<Button primary icon="movein" onClick={() => ui.go("#/people/import")}>Move in</Button>}
            />
          ) : q.trim() ? (
            <EmptyState
              title="Nobody by that name"
              body="Try part of an email or a phone number instead."
              action={<Button primary icon="add" onClick={() => ui.go("#/p/new")}>Add by hand</Button>}
            />
          ) : mark === "hidden" ? (
            <EmptyState title="Nobody is hidden." body="Hiding someone takes them out of your list. You can always show them again." />
          ) : (
            <EmptyState
              title="No match for the filters you have on."
              body={active.length ? `You are filtering by ${active.map((a) => a.label).join(" and ")}.` : undefined}
              /* ⛔ ONE WORD FOR ONE ACTION. The same press cannot be "Reset" in the
                 Views row and "Clear all" in the empty state — elegant variation
                 reads as two different things. */
              action={<Button primary icon="reset" onClick={clearAll}>Reset</Button>}
            />
          )}
        </div>
      ) : (
        <Card className="mt-4 p-0">
          {/*
            T70 (Rev 14) — ⛔ ONE COMPACT STRIP, INSIDE THE TABLE'S OWN CARD.
            Six labelled dropdowns in two rows took about 120px before the list
            began. No stacked labels: "Any stage (643)" already says what it
            filters.

            ⛔ NOT IN THE COLUMN HEADERS, and the reason is not the phone. THREE OF
            THE SIX ARE NOT COLUMNS. "Who hasn't bought yet" is a SEGMENT, not a
            field; hosting it in a header means inventing a column whose only job
            is to hold a dropdown — the layout deciding what data the list shows.
          */}
          {/* ⛔ THE PHONE KEEPS THE STRIP. Headers scroll off with their columns
              below 1080px, so on a phone the filters would be unreachable without
              swiping right. Hidden from lg up, where the headers carry them. */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2 lg:hidden" data-testid="people-filter-rows">
            <FilterSelect
              id="status-phone" value={status} onChange={(v) => setStatus(v as StatusFilter)}
              all={{ label: "Everyone", n: base.filter((x) => match(x, "status")).length }}
              options={(["new", "customer", "came-back", "not-back"] as const).map((k) => ({
                value: k, label: statusLabel(k, pack), n: countIf("status", (x) => x.status === k),
              }))}
            />
            {/* T82 — the phone strip mirrors the headers, so Stage and Came from
                left it in the same change. Three filters, not five. */}
            <FilterSelect
              id="found-phone" value={found} onChange={(v) => setFound(v as FoundKey | "all")}
              all={{ label: "Found you any way", n: base.filter((x) => match(x, "found")).length }}
              options={(Object.keys(FOUND_LABEL) as FoundKey[]).map((k) => ({
                value: k, label: FOUND_LABEL[k], n: countIf("found", (x) => x.found === k),
              }))}
            />
            {/* ⛔ THE MARKS ARE NOT HERE EITHER. They are the Views row above, which
                is on screen at every width, so the phone loses nothing by it. */}
            <FilterSelect
              id="added-phone" value={addedBy} onChange={setAddedBy}
              all={{ label: "Added by anyone", n: base.filter((x) => match(x, "added")).length }}
              options={addedByNames.map((who) => ({ value: who, label: who, n: countIf("added", (x) => x.c.addedBy === who) }))}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="people-table">
              <thead className="bg-alloro-bg">
                <tr>
                  {/* T80 (Rev 17) — EVERY header carries a menu, and each one offers
                      only what its own column can do. Name can be sorted and not
                      filtered; Stage can be filtered and not usefully sorted. */}
                  <Th menu={sortMenu("name", "Name", [
                    { value: "name-az", label: "A–Z", dir: "up" },
                    { value: "name-za", label: "Z–A", dir: "down" },
                  ])}>Name</Th>
                  <Th menu={filterMenu("status", status, (v) => setStatus(v as StatusFilter),
                    { label: "Everyone", n: base.filter((x) => match(x, "status")).length },
                    (["new", "customer", "came-back", "not-back"] as const).map((k) => ({
                      value: k, label: statusLabel(k, pack), n: countIf("status", (x) => x.status === k),
                    })),
                  )}>Status</Th>
                  {/*
                    T82 (Rev 18) — ⛔ STAGE AND CAME FROM ARE GONE FROM THIS TABLE.
                    Nine columns did not fit: 1131px of table inside a 926px card,
                    with "Added by" entirely off the right edge, so the menu Rev 17
                    repaired could not be reached at all.

                    ⛔ STAGE WAS CUT ON A MEASUREMENT, NOT A FEELING. Read off the
                    rendered counts: Stage=Paid (92) is EXACTLY Status ∈ {Client 67,
                    Came back 7, Hasn't been back 18}, and Asked 38 + No stage 15 +
                    Quoted 5 + Booked 1 = New inquiry 59. It told the owner something
                    new about SIX people out of 151 — the 5 quoted and the 1 booked —
                    for 76px on every row.

                    Came from is how the RECORD arrived; Found you is how the PERSON
                    found the business, and only the second changes what an owner
                    does. It also held several values and wrapped to three lines,
                    which is what made the rows tall.

                    ⛔ BOTH FACTS STAY IN THE MODEL AND ON THE PERSON'S OWN PAGE, and
                    both still FILTER when an address carries them — the dashboard's
                    "Came from" chart links to #/people/f/got/<k>, so removing the
                    filter with the column would have broken A43b and left a chart
                    pointing at nothing. The arriving filter shows as a chip above
                    the table, which is what the chip row has always been for.
                  */}
                  <Th menu={filterMenu("found", found, (v) => setFound(v as FoundKey | "all"),
                    { label: "Any way", n: base.filter((x) => match(x, "found")).length },
                    (Object.keys(FOUND_LABEL) as FoundKey[]).map((k) => ({
                      value: k, label: FOUND_LABEL[k], n: countIf("found", (x) => x.found === k),
                    })),
                  )}>Found you</Th>
                  {/* T71 — the only date was "Last paid", so somebody who wrote
                      yesterday looked identical to somebody gone two years.
                      ⛔ T79 — and the SORT under it still read the last payment
                      until Rev 17. The cell and its sort now name the same thing. */}
                  <Th menu={sortMenu("last", "Last thing", [
                    { value: "last-new", label: "Newest first", dir: "down" },
                    { value: "last-old", label: "Oldest first", dir: "up" },
                  ])}>Last thing</Th>
                  {showMoney ? (
                    <Th menu={sortMenu("year", "Spent this year", [
                      { value: "year-high", label: "Most first", dir: "down" },
                      { value: "year-low", label: "Least first", dir: "up" },
                    ])}>Spent this year</Th>
                  ) : null}
                  {/* T71 — ⛔ THIS HEADER IS THE BUG FIX. SortKey has carried
                      "total" since the table was built, the sort handles it, and
                      no header set it: unreachable for fourteen revisions. */}
                  {showMoney ? (
                    <Th menu={sortMenu("total", "Spent ever", [
                      { value: "total-high", label: "Most first", dir: "down" },
                      { value: "total-low", label: "Least first", dir: "up" },
                    ])}>Spent ever</Th>
                  ) : null}
                  {/* T79 — ⛔ THIS MENU USED TO FILTER THE OWNER'S MARKS under a
                      label that said "Added by". It filters who added them now. */}
                  <Th menu={filterMenu("added", addedBy, setAddedBy,
                    { label: "Anyone", n: base.filter((x) => match(x, "added")).length },
                    addedByNames.map((who) => ({ value: who, label: who, n: countIf("added", (x) => x.c.addedBy === who) })),
                  )}>Added by</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <Row key={p.c.id} p={p} showMoney={showMoney} onOpen={() => ui.go(`#/p/${p.c.id}`)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* T72 — the total and the range are always visible, so the list never
              hides how much of itself you are looking at. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-2">
            <p className="t-meta" data-testid="page-count">
              {/* T111 — the footer counts the same thing the headline does. */}
              {plural(rows.length, "person", "people")} · showing {from + 1}–{Math.min(from + PAGE_SIZE, rows.length)}
            </p>
            {pages > 1 ? (
              <div className="flex items-center gap-2">
                <Button small icon="back" testId="page-prev" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>
                  Back
                </Button>
                <span className="t-meta tabular-nums" data-testid="page-of">Page {page} of {pages}</span>
                <Button small icon="forward" testId="page-next" disabled={page >= pages} onClick={() => setPage((n) => Math.min(pages, n + 1))}>
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}

function markLabel(m: MarkFilter): string {
  switch (m) {
    case "not-a-fit": return "Not a fit";
    case "do-not-contact": return "Do not contact";
    case "hidden": return "Hidden";
    default: return "Everyone";
  }
}

/**
 * T77 (Rev 16), widened by T80 (Rev 17) — ⛔ THE HEADER LABEL IS THE CONTROL,
 * ON EVERY COLUMN.
 *
 * Rev 16 gave five headers a menu and left four as plain sort buttons, so one
 * header row held two different grammars. Jov asked for the ninth: "I want all
 * the headers to be filtered, including the name, like A–Z, Z–A."
 *
 * ⛔ SORTING AND FILTERING ARE DIFFERENT OPERATIONS, and pretending otherwise
 * is how a header starts lying. A name cannot be filtered — there is no set of
 * values to pick from — and a stage cannot be usefully sorted. So every header
 * gets the same MENU, and each menu carries what its own column can honestly do.
 *
 * ⛔ AND MONEY GETS SORTS, NOT RANGES. "Over $1,000" needs two number boxes or
 * a slider, which is a second control shape and a form back in the label strip
 * this round spent two revisions clearing out. Sorting answers "who spent most"
 * without it.
 *
 * Rev 16's five faults, kept because they are why this shape exists:
 *
 *   1. ⛔ A RAGGED BASELINE, the worst of them. Filtered headers ran two lines,
 *      plain ones ran one, and align-bottom sank the plain ones, so "Name" did
 *      not sit level with "STATUS".
 *   2. Two type treatments in one row: uppercase micro-labels above full-size
 *      controls, reading as two rows pretending to be one.
 *   3. Form fields in a label strip. A header is a LABEL; five white bordered
 *      pills are the grammar of a form.
 *   4. ⛔ The controls drove the column widths — Status as wide as "Everyone
 *      (151)" while Name was squeezed. The filters deciding how wide the DATA is.
 *   5. Not Alloro's language. Its header is the quiet eyebrow on parchment.
 *
 * ⛔ A REAL SELECT AT opacity-0 OVER THE LABEL, NOT A HAND-ROLLED MENU. That
 * keeps keyboard, Escape, type-ahead and screen-reader behaviour for nothing.
 * This project has been bitten TWICE by hand-rolled menus — the bubble painting
 * behind the page because a sticky rail makes its own stacking context, and the
 * click-focus race that closed what focus had just opened. A third would have
 * been a choice rather than an accident.
 *
 * ⛔ data-col NAMES THE COLUMN THIS MENU GOVERNS, and it is not decoration: it
 * is what lets A61 check that choosing a value in a header leaves only rows
 * whose cell IN THAT COLUMN says so. That check is the one thing that would
 * have caught "Added by" filtering the owner's marks.
 *
 * ⛔ AND NOTHING HERE IS COPIED. The real app's cards, tiles, sidebar and metric
 * rows have been read and none of them is a table with header filters. This is
 * designed inside Alloro's constraints — eyebrow label, ink when active, one
 * radius, no new control shapes, terracotta only where something needs her,
 * which a filter does not — rather than matched to a precedent that exists.
 */
function Th({ children, menu }: { children?: React.ReactNode; menu?: ThMenu }) {
  /* T82 (Rev 18) — px-2, not px-3. Seven columns × 8px is the last of the width
     the cut needed, and at this type size the gap still reads as a gap. */
  const cls = "whitespace-nowrap px-2 py-2 text-left align-middle text-xs font-bold uppercase tracking-wide text-ink-muted-text-safe";
  if (!menu) return <th className={cls}>{children}</th>;
  return (
    /* ⛔ data-on IS HOW A CHECK CAN SEE THAT A HEADER IS CARRYING A FILTER.
       T87 made the header the only signal for three of the seven filters, so
       "is this filter visible?" stopped being answerable by counting chips.
       A42a and A43b both ask it, and guessing from the ink or from a colon in
       the text would be reading the paint instead of the state. Sorts are
       excluded: this marks FILTERING, not ordering. */
    <th
      data-col={menu.col}
      data-on={menu.on && menu.id.startsWith("filter-") ? "true" : undefined}
      className={cls}
    >
      {/* ⛔ The header TEXT is the state. Unfiltered it is the column name;
          filtered it is the name and the value, in ink. A SORT adds no text,
          because the caret already says it and two signals for one fact read as
          two facts. */}
      <span data-testid={`th-${menu.col}`}>
        <Menu
          id={menu.id}
          ariaLabel={menu.aria}
          value={menu.value}
          options={menu.options}
          onChange={menu.onChange}
          caret={menu.caret}
          on={menu.on}
          label={<>{children}{menu.chosen ? `: ${menu.chosen}` : ""}</>}
        />
      </span>
    </th>
  );
}

/**
 * T79 (Rev 17) — a saved view: one question asked of the whole list.
 *
 * ⛔ FOUR OF THESE, NOT ONE. T76 built the first for "Wrote in, never paid" and
 * left the owner's three marks in a column header. A mark is the same KIND of
 * thing — a question, not a fact in a column — so it gets the same control.
 * They are mutually exclusive because the underlying filter holds one value, and
 * pressing the one that is on turns it off.
 */
function Segment({
  children, on, n, onClick, testId,
}: {
  children: React.ReactNode;
  on: boolean;
  n: number;
  onClick: () => void;
  testId: string;
}) {
  // ⛔ A ZERO IS SHOWN AND CANNOT BE PRESSED, which is T33's rule moved across.
  // Found by LOOKING at the built screen: three of these read 0 in the demo world
  // and all three were pressable, each one a one-click trip to an empty list. As
  // dropdown options they had been disabled at zero since Rev 8; turning them into
  // buttons dropped that quietly, and no check noticed — A42b only counts options.
  const dead = n === 0 && !on;
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={on}
      disabled={dead}
      onClick={onClick}
      className={[
        "tap inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors",
        on ? "border-alloro-navy bg-alloro-navy text-white"
          : dead ? "border-line-soft bg-alloro-surface text-ink-muted-text-safe"
          : "border-line-medium bg-alloro-surface text-alloro-navy hover:bg-alloro-bg",
      ].join(" ")}
    >
      {children}
      <span className={`text-[12px] font-bold tabular-nums ${on ? "text-white/70" : "text-ink-muted-text-safe"}`}>{n}</span>
    </button>
  );
}

function Row({ p, showMoney, onOpen }: { p: Profile; showMoney: boolean; onOpen: () => void }) {
  const ui = useUi();
  const feedDown = !ui.world.feeds.payments.ok;
  /**
   * ⛔ THE WHOLE ROW OPENS THE PERSON. Before this, only the NAME cell was a
   * button and the other six cells were dead — clicking a row, which is the
   * obvious thing to do in a list of people, did nothing. Reported by Jov.
   *
   * The row itself carries the handler, a tabindex and a role, so it is
   * reachable by keyboard and shows the focus ring. ⛔ No <button> inside: a
   * button nested in a clickable row is invalid, and its click would fire twice.
   */
  const open = () => onOpen();
  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
  };
  return (
    <tr
      className="cursor-pointer border-t border-line-soft transition-colors hover:bg-alloro-bg focus-visible:bg-alloro-bg"
      data-testid="people-row"
      data-id={p.c.id}
      role="button"
      tabIndex={0}
      aria-label={`Open ${p.c.erased ? "an erased record" : p.c.name}`}
      onClick={open}
      onKeyDown={onKey}
    >
      <td className="px-2 py-3">
        <span className="font-semibold">{p.c.erased ? "Erased on request" : p.c.name}</span>
        {p.c.kind === "business" ? <span className="t-meta ml-2">business</span> : null}
        {p.c.hidden ? <span className="t-meta ml-2">hidden</span> : null}
      </td>
      <td className="px-2 py-3 whitespace-nowrap">
        <span className="inline-flex flex-wrap items-center gap-1">
          <Chip tone={p.status === "not-back" ? "amber" : "plain"}>{statusLabel(p.status, p.pack)}</Chip>
          {/* T71 — ⛔ THE OWNER'S MARK RIDES IN THE STATUS CELL, costing no width.
              That filter had no column, and inventing one for it would have been
              the layout deciding what the list shows. */}
          {p.c.mark === "not-a-fit" ? <Chip tone="quiet">Not a fit</Chip> : null}
          {p.c.mark === "do-not-contact" ? <Chip tone="quiet">Do not contact</Chip> : null}
        </span>
      </td>
      {/* T82 (Rev 18) — Stage and Came from left this table; see the note in the
          header. Both are still on the person's own page. */}
      <td className="px-2 py-3 text-ink-muted-text-safe">{FOUND_LABEL[p.found]}</td>
      {/* T71 — ⛔ THE LAST THING THAT HAPPENED, not the last PAYMENT. Somebody
          who wrote yesterday and never paid used to look identical to somebody
          gone two years. */}
      <td className="px-2 py-3 whitespace-nowrap text-ink-muted-text-safe">
        {p.events[0] ? relativeDay(p.events[0].date, ui.world.today) : <span className="t-meta">Nothing yet</span>}
      </td>
      {showMoney ? (
        <td className="px-2 py-3 whitespace-nowrap">
          {/* ⛔ Never "$0" — a zero is a claim, an unknown is a state (Design §8.3). */}
          {feedDown || !p.buys.length ? <span className="t-meta">—</span>
            : p.spent12 > 0 ? money(p.spent12)
            : <span className="t-meta">Nothing this year</span>}
        </td>
      ) : null}
      {showMoney ? (
        <td className="px-2 py-3 whitespace-nowrap">
          {feedDown || !p.buys.length ? <span className="t-meta">—</span> : money(p.spentTotal)}
        </td>
      ) : null}
      {/* ⛔ "Theresa Okafor" wrapped to two lines on EVERY row, so one two-word
          name made the whole table tall. Found by looking at desktop-people.png. */}
      <td className="whitespace-nowrap px-2 py-3 text-ink-muted-text-safe">{p.c.addedBy}</td>
    </tr>
  );
}


/**
 * T42 (Rev 9) — one dimension, one dropdown.
 *
 * ⛔ THE COUNT LIVES IN THE OPTION, and an option that would return nothing is
 * DISABLED inside the list. The zero stays visible — "Moved in from a tool 0"
 * tells the owner something true — but it cannot be chosen, so no filter can
 * ever drop them on a silent empty screen. That rule survives from Rev 8's
 * chips; only the shape of the control changed.
 */
/**
 * T70 (Rev 14) — ⛔ NO VISIBLE LABEL. Six of these each carried a stacked
 * eyebrow, and together they took about 120px before the list began. The option
 * text already says what it filters — "Any stage (643)" needs no heading above
 * it saying STAGE.
 *
 * ⛔ The label does not disappear, it moves to `aria-label`. A select a screen
 * reader cannot name is worse than a tall one.
 */
function FilterSelect({
  id, value, onChange, all, options, noneValue = "all",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  all: { label: string; n: number };
  options: { value: string; label: string; n: number }[];
  noneValue?: string;
}) {
  const on = value !== noneValue;
  const chosen = options.find((o) => o.value === value);
  return (
    <Menu
      id={`filter-${id}`}
      ariaLabel={all.label}
      value={value}
      on={on}
      caret="menu"
      onChange={onChange}
      label={chosen ? `${chosen.label} (${chosen.n})` : `${all.label} (${all.n})`}
      triggerClass="tap card-radius inline-flex items-center gap-1 whitespace-nowrap border bg-alloro-surface px-3 text-[13px] font-semibold transition-colors"
      options={[
        { value: noneValue, label: all.label, hint: String(all.n) },
        ...options.map((o) => ({
          value: o.value,
          label: o.label,
          hint: String(o.n),
          disabled: o.n === 0 && value !== o.value,
        })),
      ]}
    />
  );
}
