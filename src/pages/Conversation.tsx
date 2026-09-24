import { useMemo, useState } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, Chip, EmptyState, PageSkeleton, Placeholder, Verdict } from "../components/ui";
import { Icon } from "../components/icons";
import { Menu } from "../components/Menu";
import { InlineCard } from "../components/Cards";
import { RULES, canEmail, pastAlarm, type Profile } from "../lib/engine";
import { daysBetween, listDate, plural } from "../lib/format";
import { inlineCard } from "../lib/cards";
import type { TimelineEvent } from "../data/types";

/**
 * S13 — the inbox. ONE list holding every message (spec R2).
 *
 * v1 split messages between Pipeline and Support, and its own code said a
 * message sits in exactly one place. One inbox ends that split: a quote request
 * and an unhappy regular are the same object here, and what differs is the
 * person's stage and the chip.
 *
 * ═══ T64 · T65 · T66 (Rev 13) — denser, dated, filterable. And three refusals. ═══
 *
 * ⛔ GMAIL IS A MAILBOX. THIS IS RUNG 1, AND ALLORO CANNOT SEND. The closer this
 * screen gets to Gmail the more it promises a mailbox it is not, which is roast
 * item 11 arriving on schedule: "a reply screen whose send button cannot be
 * built… demos beautifully and ships never." So P5 and the honesty line sit
 * FIRST here, above the list, and got more prominent in the same revision that
 * made the list more capable — not less.
 *
 * ⛔ THREE GMAIL BEHAVIOURS WERE REFUSED, and the reasons belong next to the code:
 *
 *   BULK SELECT AND BULK ACTIONS. Gmail has them because most of 200 daily
 *   emails are disposable. Here there are five unanswered messages and every one
 *   is a customer waiting; bulk-archiving a customer's question is the opposite
 *   of this product. R9 is one thing, one action.
 *
 *   READ / UNREAD. This app's state is ANSWERED / NOT ANSWERED, derived from
 *   events, which survives opening a message and forgetting about it. "Read"
 *   would be a manual mark beside a derived one, and the engine principle is
 *   that nothing is set by hand. Two states for one idea drift apart.
 *
 *   CATEGORY TABS. Those exist because Gmail cannot tell you what matters.
 *   The Dashboard's "What needs you" section already is that view.
 */

interface Row { p: Profile; e: TimelineEvent; open: boolean; }

type StateFilter = "all" | "open" | "answered" | "problem";

export default function Conversation() {
  const ui = useUi();
  const { model, world } = ui;
  const [q, setQ] = useState("");
  const [state, setState] = useState<StateFilter>("all");

  const all = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of model.visible) {
      for (const e of p.messages) {
        // ⛔ "Open" means the same thing here as it does to the engine: unanswered
        // AND inside the window. A message from two years ago is unanswered, but
        // nobody is waiting on it — and counting it made this screen disagree
        // with Needs you. Found by looking, not by the suite.
        const open = !p.answered.has(e.id) && daysBetween(e.date, world.today) <= RULES.openInquiryDays;
        out.push({ p, e, open });
      }
    }
    const key = (r: Row) => Number(r.e.date.replace(/-/g, "")) * 10000 + (r.e.minute ?? 0);
    const openRows = out.filter((r) => r.open).sort((a, b) => key(a) - key(b));   // oldest first
    const rest = out.filter((r) => !r.open).sort((a, b) => key(b) - key(a));      // newest first
    return [...openRows, ...rest];
  }, [model, world.today]);

  /**
   * T65 — ⛔ THIS SCREEN HAD NO FILTER AND NO SEARCH while People had six and a
   * search box. That is an inconsistency, not a preference. Every one of these
   * reads something the row already carries; nothing new is computed.
   */
  const matches = (r: Row, skipState = false) => {
    if (!skipState) {
      if (state === "open" && !r.open) return false;
      if (state === "answered" && !r.p.answered.has(r.e.id)) return false;
      if (state === "problem" && !r.e.problem) return false;
    }
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      if (![r.p.c.name, r.e.message ?? ""].join(" ").toLowerCase().includes(t)) return false;
    }
    return true;
  };

  const rows = all.filter((r) => matches(r));
  const count = (f: StateFilter) =>
    all.filter((r) => matches(r, true) && (
      f === "all" ? true : f === "open" ? r.open : f === "answered" ? r.p.answered.has(r.e.id) : !!r.e.problem
    )).length;

  if (ui.loading) return <PageSkeleton rows={4} />;

  const openCount = all.filter((r) => r.open).length;
  const card = inlineCard(ui.cards, "conversation");
  const formsDown = !world.feeds.forms.ok;
  const filtered = state !== "all" || q.trim().length > 0;

  return (
    <div>
      <Verdict sub={filtered ? `${plural(rows.length, "message")} with these filters.` : undefined}>
        {all.length === 0
          ? "No messages yet."
          : openCount === 0
            ? "Everyone has heard back from you."
            : `${openCount} ${openCount === 1 ? "person is" : "people are"} waiting to hear from you.`}
      </Verdict>

      {card ? <InlineCard card={card} /> : null}

      {formsDown ? (
        <Card className="mb-4 border-amber">
          <p className="t-body font-semibold">Alloro isn't receiving website messages right now.</p>
          <p className="t-meta mt-1">Check your own inbox until it's fixed. Nobody is flagged while this lasts.</p>
        </Card>
      ) : null}

      {/* P5 — the exact sentence from the register (spec §4.5).
          ⛔ T66: it stays ABOVE the list. The denser this screen gets, the harder
          this sentence works, so it does not move down to make room. */}
      <Placeholder testId="ph-P5">
        In the real product, messages arrive at your own Alloro address. Here they come from this demo's own data.
      </Placeholder>

      {all.length === 0 ? (
        <EmptyState
          title="No messages yet."
          body="Alloro checks your website forms all day. New messages show up here and in your inbox."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted-text-safe">
                <Icon name="search" size={16} />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="inbox-search"
                placeholder="Search messages"
                aria-label="Search messages"
                className="tap w-full card-radius border border-line-soft bg-alloro-surface pl-9 pr-3 text-base shadow-premium transition-colors focus:border-alloro-orange"
              />
            </div>
            {/*
              T83 (Rev 18) — ⛔ THIS ONE WAS NOT ASKED FOR, AND LEAVING IT WOULD
              HAVE BEEN THE HALF-JOB. Jov's words were "I don't like this dropdown
              select style, use the Alloro design" — said about the People header,
              but this is the same operating-system dropdown on the next screen.
              Fixing one and shipping the other would only have moved the report.
            */}
            <Menu
              id="filter-state"
              ariaLabel="Show"
              value={state}
              on={state !== "all"}
              caret="menu"
              onChange={(v) => setState(v as StateFilter)}
              label={
                state === "all" ? `Everything (${count("all")})`
                : state === "open" ? `Nobody has answered (${count("open")})`
                : state === "problem" ? `Unhappy (${count("problem")})`
                : `Answered (${count("answered")})`
              }
              triggerClass="tap card-radius inline-flex w-full items-center justify-between gap-1 border bg-alloro-surface px-3 text-[14px] font-semibold shadow-premium transition-colors sm:w-auto"
              options={[
                { value: "all", label: "Everything", hint: String(count("all")) },
                { value: "open", label: "Nobody has answered", hint: String(count("open")), disabled: count("open") === 0 && state !== "open" },
                { value: "problem", label: "Unhappy", hint: String(count("problem")), disabled: count("problem") === 0 && state !== "problem" },
                { value: "answered", label: "Answered", hint: String(count("answered")), disabled: count("answered") === 0 && state !== "answered" },
              ]}
            />
            {/* T91 (Rev 20) — the same act, so the same word. This one already cleared
                both its filter and its search, which is exactly what Reset now means
                on People.
                ⛔ T100 (Rev 24) — AND THE SAME PLACE. Jov: "same, this reset button
                should be on the right side." People's Reset was pushed to the far
                edge in Rev 20 for the reason recorded on the Email button: what you
                turn on at one end, what turns it off at the other. Two screens with
                the same control in two positions is the same fact told twice in
                different words. The phone keeps a divider, because a wrapped row
                has no far edge to push to. */}
            {filtered ? (
              <>
                <span aria-hidden="true" data-testid="inbox-divider" className="mx-1 h-8 w-px bg-line-soft sm:hidden" />
                <span className="sm:ml-auto">
                  <Button small icon="reset" testId="inbox-clear" onClick={() => { setState("all"); setQ(""); }}>
                    Reset
                  </Button>
                </span>
              </>
            ) : null}
          </div>

          {rows.length === 0 ? (
            /* ⛔ Two empties, worded differently, same rule as People's three. */
            <EmptyState
              title={q.trim() ? "No message says that." : "Nothing matches that filter."}
              body={q.trim() ? "Try part of a name instead." : undefined}
              action={<Button primary icon="reset" onClick={() => { setState("all"); setQ(""); }}>Reset</Button>}
            />
          ) : (
            <Card className="p-0" data-testid="inbox">
              <ul>
                {rows.slice(0, 60).map((r, i) => (
                  <MessageRow key={r.e.id} r={r} first={i === 0 && r.open} lead={i === 0 && r.open && !card} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <button type="button" data-testid="spam-link" onClick={() => ui.go("#/conversation/spam")}
        className="t-meta mt-4 underline underline-offset-2">
        {model.spamCount} hidden as spam
      </button>
    </div>
  );
}

/**
 * T64 — ⛔ A ROW, NOT A CARD. Four messages used to fill a viewport: the card
 * wrapped a name, two chips, a quote and a meta line and added nothing the row
 * spacing would not. The whole row opens the message, the same way a People row
 * opens a person.
 *
 * ⛔ AND THE DATE IS RIGHT-ALIGNED, where a mailbox puts it. It used to read
 * "Wrote last week, 3:00 PM · website form" — a relative phrase buried mid
 * sentence, which is why the screen felt undated while carrying a date.
 */
function MessageRow({ r, first, lead }: { r: Row; first: boolean; lead: boolean }) {
  const ui = useUi();
  const alarm = r.open && pastAlarm(r.e, ui.world) && ui.world.feeds.forms.ok;
  const reachable = canEmail(r.p);
  const open = () => ui.go(`#/conversation/${r.e.id}`);
  return (
    <li
      className="flex cursor-pointer items-start gap-3 border-b border-line-soft px-4 py-3 transition-colors last:border-0 hover:bg-alloro-bg focus-visible:bg-alloro-bg"
      data-testid="msg-row"
      role="button"
      tabIndex={0}
      aria-label={`Open the message from ${r.p.c.name}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`truncate ${r.open ? "font-bold" : "font-semibold"}`} data-testid="msg-name">{r.p.c.name}</span>
          {r.e.problem ? <Chip tone="amber">Unhappy</Chip> : null}
          {r.open
            ? <Chip tone={alarm ? "amber" : "plain"}>{alarm ? "Nobody has answered" : "Needs a reply"}</Chip>
            : r.p.answered.has(r.e.id)
              ? <Chip tone="quiet">Answered</Chip>
              : <Chip tone="quiet">Too old to chase</Chip>}
        </span>
        {/* T59 — ⛔ THE CLIENT'S WORDS, NOT ALLORO'S. The reading grade excludes
            this: grading the demo's invented messages made Conversation read
            125 sentences and 1,375 words, and called it the worst screen for
            five revisions. */}
        <span className="t-meta mt-0.5 block truncate italic" data-testid="client-text">"{r.e.message}"</span>
        {!reachable ? (
          <span className="t-meta mt-0.5 block">
            {r.p.c.phone ? "Left a phone number only" : r.p.consent === "stop" ? "Asked not to be emailed, so call instead" : ""}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="t-meta whitespace-nowrap tabular-nums" data-testid="msg-date">
          {listDate(r.e.date, ui.world.today, r.e.minute)}
        </span>
        {/*
          T88 (Rev 19) — ⛔ ONE NEXT STEP IN THE LIST, NOT ONE PER ROW.

          Jov: "the icons here make no sense, it says Open on different icons.
          Make it clear what its main action is." He was reading a marker on
          EVERY row whose picture changed and whose word did not.

          ⛔ AND ONE OF THE TWO WORDS WAS UNTRUE. The label read "Call" for a
          person with a phone and no email — and clicking the row OPENS THE
          MESSAGE. It has never placed a call. That is the same defect as the
          header that said "Added by" over a menu filtering marks, in a third
          costume: a control whose words name something it does not do.

          ⛔ THE PICTURE WAS ALSO WRONG WHERE IT MATTERED MOST. The icon was
          `reachable ? mail : call`, so somebody with NO email AND NO phone — an
          island, who cannot be answered at all — got the telephone.

          So: the marker survives only on the first unanswered row, where it is
          the screen's one primary (Design §4.3, checked by A31), and it says
          what clicking does. Every other row is just a row, and the rows that
          cannot be answered still say so in words, in the line above.

          ⛔ A CORRECTION TO MY OWN REPORT, KEPT ON PURPOSE: I told Jov this was a
          <button> nested inside a clickable row — the invalid-nesting defect
          People had fixed. IT WAS NOT. It is a span, and the comment saying so
          was right here. I inferred the bug from a test id and from the row
          being clickable, and reported it before reading the element. The rule
          is worth checking anyway, so A69 now checks it; it found nothing.
        */}
        {/* ⛔ THE MARKER SHOWS ALWAYS ON THE FIRST UNANSWERED ROW, AND IS PRIMARY
            ONLY WHEN NO CARD IS HOLDING THE SCREEN'S ONE PRIMARY (Design §4.3,
            A31). Tying its EXISTENCE to the card was the first attempt, and it
            made the marker invisible in the state the screen is usually in — so
            A70 read its words off an empty set and passed on nothing. Being the
            next step and being the loudest thing on the screen are two questions;
            this answers them separately. */}
        {first ? (
          <span
            data-testid="msg-open"
            data-primary={lead ? "true" : undefined}
            className={[
              "tap hidden items-center gap-2 rounded-xl px-4 text-[13px] font-semibold sm:inline-flex",
              lead ? "bg-alloro-navy text-white shadow-sm" : "border border-line-medium bg-alloro-surface text-alloro-navy",
            ].join(" ")}
          >
            <Icon name="mail" size={15} />
            Open message
          </span>
        ) : null}
      </span>
    </li>
  );
}
