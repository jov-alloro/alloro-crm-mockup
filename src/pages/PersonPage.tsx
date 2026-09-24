import { useMemo, useState } from "react";
import { canSeeMoney } from "../lib/permissions";
import { editContact, undoAddByHand } from "../lib/actions";
import { useUi } from "../lib/ui-context";
import {
  Button, Card, Chip, Combo, EmptyState, Field, PageSkeleton, Placeholder, Select, Sheet, Verdict,
} from "../components/ui";
import {
  FOUND_LABEL, GOT_LABEL, canEmail, moneyLine, openMessage, statusLabel, whyLine,
  type Profile,
} from "../lib/engine";
import { stageLabel } from "../lib/packs";
import { dateWords, firstName, money, relativeDay, timeWords } from "../lib/format";
import {
  addByHand, addNote, eraseContact, hideContact, markLost, mergeContacts,
  notSame, recordCall, recordCheckin, recordThanks, setMark, setReminder,
  recordEmail, showContact, splitMerge, unmarkLost,
} from "../lib/actions";
import type { FoundKey } from "../data/types";
import type { IconName } from "../components/icons";
import { addDays } from "../lib/format";
import { cleanUp, diffWords, suggestReply } from "../lib/drafts";

/**
 * S2 · One person, and S3 · One business — one file, branched on kind.
 *
 * ⛔ R12 IS THE ORDER, and the order is the decision: who they are, the verdict,
 * ONE primary move, the money line, the facts — THEN the ledger. "Everything
 * about a customer" is the oldest trap in CRM; the owner opens this page to
 * answer one question and everything else is reference.
 *
 * ⛔ The word "balance" appears nowhere on this page, in any state, even when
 * every billing field is filled (spec R13, acceptance A10).
 */

type SheetKind = null | "note" | "hide" | "erase" | "lost" | "call" | "remind" | "merge" | "email" | "edit";

export default function PersonPage({ id }: { id: string }) {
  const ui = useUi();
  if (ui.loading) return <PageSkeleton rows={3} />;
  const p = ui.model.byId.get(id);
  if (!p) {
    return <EmptyState title="That person isn't here." action={<Button primary icon="back" onClick={() => ui.go("#/people")}>Back to People</Button>} />;
  }
  return p.c.kind === "business" ? <BusinessBody p={p} /> : <PersonBody p={p} />;
}

/* ── S2 · one person ──────────────────────────────────────────────────────── */

function PersonBody({ p }: { p: Profile }) {
  const ui = useUi();
  const { world } = ui;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const open = openMessage(p, world);
  /* T110 (Rev 29) — the verdict's money line goes through the one rule too. */
  const mline = canSeeMoney(ui.viewer) ? moneyLine(p, world) : null;
  const biz = p.c.businessId ? ui.model.byId.get(p.c.businessId) : undefined;

  /**
   * ⛔ R12: ONE primary move, and it is the first control on the page.
   * T30 (Rev 8) added `icon` only — the branch order, the labels and what each
   * one does are unchanged, because changing them would reopen R12.
   */
  const primary: { label: string; icon: IconName; run: () => void } | null = (() => {
    if (p.c.erased) return null;
    if (open) return canEmail(p)
      ? { label: `Reply to ${p.c.name.split(" ")[0]}`, icon: "mail" as const, run: () => ui.go(`#/conversation/${open.id}`) }
      : { label: `Call ${p.c.name.split(" ")[0]}`, icon: "call" as const, run: () => setSheet("call") };
    if (p.cameBack) return { label: "Say thanks", icon: "thanks" as const, run: () => { ui.act((w) => recordThanks(w, p.c.id, ui.actor)); ui.toast("Marked as thanked."); } };
    if (p.isQuiet) return { label: "Check in", icon: "call" as const, run: () => { ui.act((w) => recordCheckin(w, p.c.id, ui.actor)); ui.toast("Check-in recorded."); } };
    // ⛔ A REPLY STILL GOES TO THE THREAD, because a reply belongs beside what
    // they wrote. This branch is the OTHER case — nobody is waiting, the owner
    // just wants to write — and that needs no thread, so it opens the sheet and
    // the page stays put.
    if (canEmail(p)) return { label: "Write to them", icon: "mail" as const, run: () => setSheet("email") };
    if (p.c.phone) return { label: "Call", icon: "call" as const, run: () => setSheet("call") };
    return null;
  })();

  return (
    /*
      T43 (Rev 9) — TWO COLUMNS, AND ⛔ A BENTO WAS REFUSED HERE.

      A bento is a SCANNING layout: many independent numbers, no order, answering
      "how are things?". This page answers ONE question with an order — what do I
      do about this person right now — and a bento flattens order until the
      verdict weighs the same as the Category field. That is CONTEXT.md §7 item 2,
      "everything about a customer", under a nicer name, and the app would then
      have two bentos and no hierarchy anywhere.

      ⛔ THE COMPLAINT WAS NEVER THE LAYOUT. It was that the email address sat
      fifth of six sections. Two columns fix reachability without costing the
      order: the left column keeps R12 exactly, and the right holds who they are,
      sticky, always on screen.

      ⛔ ON A PHONE IT STACKS AND THE CONTACT CARD IS SECOND, directly under the
      money line — `order-*` moves it there without moving it in DOM order, so a
      screen reader still hears the verdict first. A44 reads document order for
      exactly that reason; comparing Y positions would now be meaningless.
    */
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {/*
        ⛔ THREE GRID CHILDREN, NOT TWO, and that is what makes the phone right.
        With one left column the aside could only be LAST in the stack — measured
        at y=2008 while the money line was at y=601. Splitting the left column at
        the money line lets the card sit SECOND on a phone AND in column two on a
        desktop, without `order`, so document order and reading order agree.
      */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
      {/* 1. who they are */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="t-hero" data-testid="person-name">{p.c.erased ? "Erased on request" : p.c.name}</h2>
        <Chip tone={p.status === "not-back" ? "amber" : "plain"}>{statusLabel(p.status, p.pack)}</Chip>
        <Chip tone="quiet">{stageLabel(p.stage)}</Chip>
        {p.c.hidden ? <Chip tone="quiet">Hidden</Chip> : null}
      </div>
      {biz ? (
        <p className="t-meta mb-2">
          Works at{" "}
          <button type="button" className="underline" onClick={() => ui.go(`#/p/${biz.c.id}`)} data-testid="person-business">
            {biz.c.name}
          </button>
        </p>
      ) : null}

      {/* 2. the verdict — Design §6.1, before any number */}
      <Verdict>{whyLine(p, world)}</Verdict>

      {/* 3. one primary move, at most two secondary */}
      {!p.c.erased ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {primary ? <Button primary icon={primary.icon} testId="person-primary" onClick={primary.run}>{primary.label}</Button> : null}
          {p.c.phone && primary?.label.startsWith("Call") === false ? (
            <Button icon="call" testId="person-call" onClick={() => setSheet("call")}>Call</Button>
          ) : null}
          {/*
            T47 — ⛔ DISABLED IS THE FEATURE HERE, NOT A MISSING ONE. canEmail()
            refuses on four grounds: they asked not to be emailed, the owner marked
            do-not-contact, there is no address, or the record was erased. A live
            Email button beside "They asked not to be emailed" would be the app
            contradicting its own contact card, so the button carries the reason.
          */}
          <Button
            icon="mail"
            testId="person-email"
            disabled={!canEmail(p)}
            title={emailBlockedBecause(p) ?? undefined}
            onClick={() => setSheet("email")}
          >
            Email
          </Button>
          <Button icon="note" testId="person-note" onClick={() => setSheet("note")}>Add a note</Button>
          {/* T120 (Rev 30) — ⛔ UNTIL NOW A TYPO WAS FOREVER. There was no edit
              anywhere in the product: a wrong name could only be worked around by
              erasing the person or adding a second one. */}
          <Button icon="note" testId="person-edit" onClick={() => setSheet("edit")}>Edit details</Button>
        </div>
      ) : null}

      {/* 4. the money line, or its honest absence — Design §7.1, §8.3 */}
      <p className="t-body mb-3" data-testid="person-money">
        {mline ?? (
          !world.feeds.payments.ok
            ? "Alloro can't see your payments right now, so this is unknown."
            : p.buys.length ? "Nothing in the last 12 months." : "No purchase yet."
        )}
      </p>

      {/* 5. fact chips with dates */}
      <div className="flex flex-wrap gap-2">
        {p.got.map((g) => <Chip key={g} tone="quiet">{GOT_LABEL[g]}</Chip>)}
        <Chip tone="quiet">Found you: {FOUND_LABEL[p.found]}</Chip>
        <Chip tone="quiet">First seen {dateWords(p.firstSeen, ui.world.today)}</Chip>
      </div>
      </div>
      {/* ── THE ANSWER ENDS HERE. Everything below is reference. ──────────── */}

      {/*
        Who they are. ⛔ SECOND CHILD OF THE GRID, which is what puts it SECOND on
        a phone — directly under the money line, where Jov asked for it — and in
        column two on a desktop. No `order` is used, so document order and
        reading order are the same thing and R12 survives both.
      */}
      {/*
        ⛔ lg:row-span-2, AND THIS IS THE FIX FOR A GAP REV 9 CREATED. T43 put this
        card in ROW 1 ONLY. Row 1 then grew to the card's height — about 520px —
        while the short top block used a fraction of it, and the ledger could not
        begin until row 2. The result was roughly 320px of empty page between the
        fact chips and Payments. Reported by Jov.

        ⛔ A44b MEASURED THE ORDER AND PASSED, because the order was right. Nothing
        measured the space between two things that were both in the right place.
        A51 does now. Spanning both rows lets the left column flow continuously.
      */}
      <aside className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4" data-testid="who-they-are">
        <Card>
          <p className="eyebrow mb-2">Who they are</p>
          {/* T38 — ⛔ A MISSING VALUE NAMES ITSELF. A blank cell reads as a bug;
              "No email yet" reads as a fact, and tells the owner what to go and
              get. Design §8.3. */}
          <Detail label="Email" value={p.c.email ?? "No email yet"} missing={!p.c.email} />
          <Detail label="Phone" value={p.c.phone ?? "No phone yet"} missing={!p.c.phone} />
          <Detail
            label="Emailing them"
            value={p.consent === "stop" ? "They asked not to be emailed" : canEmail(p) ? "You can email them" : "No email on file"}
            missing={!canEmail(p) && p.consent !== "stop"}
          />
          <Detail label="How Alloro got them" value={p.got.map((g) => GOT_LABEL[g]).join(" · ") || "Not known"} missing={p.got.length === 0} />
          <Detail label="How they found you" value={FOUND_LABEL[p.found]} />
          <Detail label="First seen" value={dateWords(p.firstSeen, ui.world.today)} />
          <Detail label="Added by" value={p.c.addedBy} />
          <Detail label="Category" value={p.c.category ?? "None set"} missing={!p.c.category} />
        </Card>
      </aside>

      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
      {/* S5 — the look-alike card. Only ever for a name match with nothing shared. */}
      {p.lookAlike ? (
        <Card className="mb-4 border-amber" id="look-alike">
          <p className="t-body font-semibold" data-testid="lookalike">Looks like the same person as another record.</p>
          <p className="t-meta mt-1">
            Same name. Different email and phone, so Alloro did not join them for you.
          </p>
          <div className="mt-3 flex gap-2">
            <Button primary icon="merge" testId="lookalike-merge"
              onClick={() => { ui.act((w) => mergeContacts(w, p.c.id, p.lookAlike!.id, "same name", ui.actor)); ui.toast("Joined. The money on this page may have changed."); }}>
              Merge them
            </Button>
            <Button icon="close" testId="lookalike-not-same"
              onClick={() => { ui.act((w) => notSame(w, p.c.id, p.lookAlike!.id)); ui.toast("Kept apart."); }}>
              Not the same person
            </Button>
          </div>
        </Card>
      ) : null}

      {/* ── 6. THEN the ledger. Everything below here is reference. ────────── */}
      {/*
        T110 (Rev 29) — ⛔ THIS SECTION HAD NO PERMISSION CHECK AT ALL. Every other
        screen had one written out by hand; the profile simply never got one, so
        staff read the full payment ledger of everybody they opened, while the
        Team page promised Luis "No money, no export".
      */}
      {!canSeeMoney(ui.viewer) ? null : (
      <>
      <h3 className="eyebrow mt-6 mb-2">Payments</h3>
      {p.buys.length === 0 ? (
        <p className="t-meta">No purchase yet.</p>
      ) : (
        <Card className="p-0">
          <table className="w-full text-left text-sm" data-testid="payments-table">
            <tbody>
              {p.buys.slice(0, 12).map((b, i) => (
                <tr key={i} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2">{dateWords(b.date, ui.world.today)}</td>
                  <td className="px-3 py-2">{b.item ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(b.amount)}</td>
                </tr>
              ))}
              {p.refunds.map((r) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2">{dateWords(r.date, ui.world.today)}</td>
                  <td className="px-3 py-2">Refunded</td>
                  <td className="px-3 py-2 text-right font-semibold">−{money(r.amount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.buys.length > 12 ? <p className="t-meta px-3 py-2">Showing the last 12 of {p.buys.length}.</p> : null}
          {/* T38 — the 12-month total, in the ledger where it is reference, not
              at the top where it would compete with the verdict (R12). */}
          <div className="flex items-center justify-between border-t border-line-medium px-3 py-2">
            <span className="eyebrow">Last 12 months</span>
            <span className="font-semibold tabular-nums" data-testid="payments-total">
              {!world.feeds.payments.ok ? "Value unknown" : p.spent12 > 0 ? money(p.spent12) : "Nothing this year"}
            </span>
          </div>
        </Card>
      )}

      {/* The billing block. ⛔ Fields only — no balance, ever (spec R13). */}
      {p.c.billing ? (
        <>
          <h3 className="eyebrow mt-6 mb-2">They pay on a plan</h3>
          <Card>
            <p className="t-body font-semibold" data-testid="billing-plan">{p.c.billing.plan}</p>
            <p className="t-meta mt-1">
              {p.c.billing.amount ? `${money(p.c.billing.amount)} ` : ""}
              {p.c.billing.cycle ?? ""}
              {p.c.billing.nextDue ? ` · next due ${dateWords(p.c.billing.nextDue, ui.world.today)}` : ""}
            </p>
            <p className="t-meta mt-2">You typed these. Alloro does not work them out from the payments above.</p>
          </Card>
        </>
      ) : null}
      </>
      )}

      {/* T38 — EVERY SOURCE WITH ITS DATE. The chips at the top say WHICH
          sources; this says WHEN each one first happened, which is the question
          a reference section is for. */}
      <h3 className="eyebrow mt-6 mb-2">Where they came from</h3>
      <Card>
        <ul data-testid="sources">
          {sourceDates(p).map((row) => (
            <li key={row.key} className="flex items-baseline justify-between gap-3 border-b border-line-soft py-1.5 last:border-0">
              <span className="t-body">{row.label}</span>
              <span className="t-meta whitespace-nowrap">{row.date ? dateWords(row.date, ui.world.today) : "date not known"}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 pt-1.5">
            <span className="t-body">How they found you</span>
            <span className="t-meta whitespace-nowrap">{FOUND_LABEL[p.found]}</span>
          </li>
          {/*
            T118 (Rev 30) — ⛔ WHAT THE SOURCE ACTUALLY GAVE, when it is no longer
            what the record says. Without this line the profile keeps claiming
            "Website form" while carrying an address nobody ever submitted —
            nothing looks wrong and the claim has quietly stopped being true.
            ⚠ An edit history is NOT this claim. It says what somebody typed; this
            says what arrived.
          */}
          {p.c.arrived && (p.c.arrived.email !== p.c.email || p.c.arrived.phone !== p.c.phone) ? (
            <li className="pt-1.5" data-testid="source-arrived">
              <span className="t-meta">
                What they first gave you:{" "}
                {p.c.arrived.email || p.c.arrived.phone || "no email or phone"}. You changed it since.
              </span>
            </li>
          ) : null}
        </ul>
      </Card>

      {/* T38 — NOTES WITH AUTHOR AND DATE, in their own section. They were
          only in the timeline before, mixed with payments and replies, so the
          one thing a person actually typed was the hardest thing to find. */}
      <h3 className="eyebrow mt-6 mb-2">Notes</h3>
      {p.events.filter((e) => e.kind === "note").length === 0 ? (
        <p className="t-meta" data-testid="notes-empty">No notes yet.</p>
      ) : (
        <Card className="p-0">
          <ul data-testid="notes">
            {p.events.filter((e) => e.kind === "note").map((e) => (
              <li key={e.id} className="border-b border-line-soft px-3 py-2 last:border-0">
                <p className="t-body">{e.text}</p>
                <p className="t-meta mt-0.5">
                  {e.by ?? "Not known"} · {dateWords(e.date, ui.world.today)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h3 className="eyebrow mt-6 mb-2">What happened</h3>
      <Card className="p-0">
        <ul data-testid="timeline">
          {p.events.slice(0, 25).map((e) => (
            <li key={e.id} className="border-b border-line-soft px-3 py-2 last:border-0">
              <span className="t-meta">{relativeDay(e.date, world.today)}{e.minute ? `, ${timeWords(e.minute)}` : ""}</span>
              <p className="t-body">{eventWords(e.kind)}{e.by ? ` · ${e.by}` : ""}</p>
              {e.message ? <p className="t-meta italic" data-testid="client-text">"{e.message}"</p> : null}
              {e.text ? <p className="t-meta">{e.text}</p> : null}
              {e.kind === "merged" && e.merge ? (
                <Button small icon="close" testId="split-merge"
                  onClick={() => { ui.act((w) => splitMerge(w, e.id, ui.actor)); ui.toast("Put back apart."); }}>
                  Not the same person
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {!p.c.erased ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button icon="remind" testId="person-remind" onClick={() => setSheet("remind")}>Remind me</Button>
          {p.c.lost ? (
            <Button icon="reset" testId="person-unlost" onClick={() => { ui.act((w) => unmarkLost(w, p.c.id)); ui.toast("No longer marked lost."); }}>Not lost after all</Button>
          ) : (
            <Button icon="lost" testId="person-lost" onClick={() => setSheet("lost")}>Mark lost</Button>
          )}
          <Button icon="close" testId="person-mark-fit" onClick={() => { ui.act((w) => setMark(w, p.c.id, p.c.mark === "not-a-fit" ? undefined : "not-a-fit")); }}>
            {p.c.mark === "not-a-fit" ? "Undo not a fit" : "Not a fit"}
          </Button>
          <Button icon="mail" testId="person-mark-dnc" onClick={() => { ui.act((w) => setMark(w, p.c.id, p.c.mark === "do-not-contact" ? undefined : "do-not-contact")); }}>
            {p.c.mark === "do-not-contact" ? "Undo do not contact" : "Do not contact"}
          </Button>
          {/* Hide is the OWNER's. Staff do not see it. */}
          {ui.viewer === "owner" ? (
            p.c.hidden ? (
              <Button icon="show" testId="person-show" onClick={() => { ui.act((w) => showContact(w, p.c.id, ui.actor)); ui.toast("They're back in your list."); }}>Show again</Button>
            ) : (
              <Button icon="hide" testId="person-hide" onClick={() => setSheet("hide")}>Hide</Button>
            )
          ) : null}
          {/* ⛔ Erase is Alloro staff's only (spec S7, risk K9). */}
          {ui.viewer === "alloro" ? <Button icon="erase" testId="person-erase" onClick={() => setSheet("erase")}>Erase</Button> : null}
        </div>
      ) : null}

      </div>

      {sheet === "email" ? <EmailSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "note" ? <NoteSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "edit" ? <EditSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "hide" ? <HideSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "erase" ? <EraseSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "lost" ? <LostSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "call" ? <CallSheet p={p} onClose={() => setSheet(null)} /> : null}
      {sheet === "remind" ? <RemindSheet p={p} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function eventWords(kind: string): string {
  switch (kind) {
    case "inquiry": return "Wrote to you";
    case "newsletter": return "Signed up for the newsletter";
    case "added": return "Added to your list";
    case "payment": return "Paid";
    case "refund": return "Refunded";
    case "quote": return "You sent a price";
    case "booked": return "They said yes";
    case "email": return "You wrote back";
    case "called": return "You called";
    case "note": return "Note";
    case "checkin": return "You checked in";
    case "thanks": return "You said thanks";
    case "merged": return "Records joined";
    case "lost": return "Marked lost";
    case "hidden": return "Hidden from the list";
    case "shown": return "Shown again";
    case "erased": return "Erased on request";
    default: return kind;
  }
}

/** Why the Email button is off, in the owner's words. */
function emailBlockedBecause(p: Profile): string | null {
  if (p.c.erased) return "This record was erased at their request.";
  if (p.consent === "stop") return "They asked not to be emailed.";
  if (p.c.mark === "do-not-contact") return "You marked them do not contact.";
  if (!p.c.email) return "No email address on file yet.";
  return null;
}

/**
 * S2b · T47 (Rev 9) — write to one person, without leaving their page.
 *
 * ⛔ IT IS THE THREAD'S REPLY FLOW, MOVED — NOT A SECOND ONE. Same draft helper
 * (R11), same signature block, same P6 sentence, same two ways out. A second
 * composer would be a second set of rules to keep in step, and they would drift.
 *
 * ⛔ AND IT STILL DOES NOT SEND. R3 builds rung 1 only: Alloro has no sending
 * identity (plans/07312026-sender-identity is Blocked), so the button opens the
 * owner's OWN mail app with the message ready. A composer whose send button
 * cannot be built is roast item 11 — "it demos beautifully and ships never" —
 * and the way to not be that is to say so on the screen, which P6 does.
 */
function EmailSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [copyMode, setCopyMode] = useState(false);

  const suggest = () => {
    setThinking(true);
    // A visible pause, so the owner sees it was generated rather than pre-written.
    window.setTimeout(() => { setText(suggestReply(p, ui.world)); setThinking(false); }, 500);
  };
  const clean = () => {
    setThinking(true);
    window.setTimeout(() => { setDiff({ before: text, after: cleanUp(text) }); setThinking(false); }, 500);
  };

  const mailto = `mailto:${p.c.email ?? ""}?subject=${encodeURIComponent(subject || "A quick note")}&body=${encodeURIComponent(text)}`;

  if (sent) {
    return (
      <Sheet title="Did you send it?" onClose={onClose}>
        <p className="t-body measure mb-4">
          Alloro records that you wrote and when, not what you said. Your email went from your own address.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button primary icon="tick" testId="person-email-sent" onClick={() => {
            ui.act((w) => recordEmail(w, p.c.id, ui.actor, undefined, subject || "A quick note"));
            ui.toast("Recorded: you wrote to them.");
            onClose();
          }}>Yes, it's sent</Button>
          <Button icon="close" testId="person-email-notyet" onClick={() => setSent(false)}>Not yet</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Write to ${firstName(p.c.name)}`} onClose={onClose} wide>
      <p className="t-meta mb-2">To: {p.c.email}</p>
      <Field label="Subject" value={subject} onChange={setSubject} placeholder="A quick note" testId="person-email-subject" />

      <span className="eyebrow mb-1 block">Message</span>
      <textarea
        value={text}
        data-testid="person-email-text"
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="What would you like to say?"
        className="w-full card-radius border border-line-soft p-3 text-base"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {!text.trim() ? (
          <Button small icon="suggest" testId="person-ai-suggest" onClick={suggest} disabled={thinking}>
            {thinking ? "Writing\u2026" : "Suggest a draft"}
          </Button>
        ) : (
          <Button small icon="suggest" testId="person-ai-clean" onClick={clean} disabled={thinking}>
            {thinking ? "Reading\u2026" : "Clean this up"}
          </Button>
        )}
      </div>

      {/* P9 — the exact sentence from the register. */}
      <Placeholder testId="ph-P9-person">
        In the real product Alloro's model writes this. Here it is built from what is already on this page.
      </Placeholder>

      {diff ? (
        <Card className="mb-3">
          <p className="eyebrow mb-2">What changed</p>
          <p className="t-body measure" data-testid="person-ai-diff">{diffWords(diff.before, diff.after)}</p>
          <div className="mt-3 flex gap-2">
            <Button small primary icon="tick" testId="person-ai-use" onClick={() => { setText(diff.after); setDiff(null); }}>Use this</Button>
            <Button small icon="close" testId="person-ai-keep" onClick={() => setDiff(null)}>Keep mine</Button>
          </div>
        </Card>
      ) : null}

      <Card className="mb-3 bg-alloro-bg">
        <p className="t-meta">
          {ui.world.info.name} · {ui.world.info.address}
          <br />Reply "stop" and I won't email you about this again.
        </p>
      </Card>

      {/* P6 — the exact sentence from the register. */}
      <Placeholder testId="ph-P6-person">
        Reply inside Alloro · Coming later. It needs a verified sending address for {ui.world.info.name},
        so that a reply arrives from you and not from Alloro.
      </Placeholder>

      {copyMode ? (
        <Card className="mb-3">
          <p className="t-meta mb-2">Copy this, then paste it into your email.</p>
          <textarea readOnly value={text} rows={6} data-testid="person-email-copy"
            className="w-full card-radius border border-line-soft p-3 text-base" />
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button primary icon="mail" disabled={!text.trim()} testId="person-email-open" onClick={() => {
          try { window.location.href = mailto; } catch { setCopyMode(true); }
          setSent(true);
        }}>Open in my email</Button>
        <Button icon="note" testId="person-email-copy-btn" onClick={() => setCopyMode(true)}>Copy it instead</Button>
      </div>
    </Sheet>
  );
}

/**
 * T38 — ⛔ A MISSING VALUE IS A SENTENCE, NOT A BLANK. `missing` greys the
 * value so the eye can skim what is absent, while the words still say what is
 * absent. A blank cell reads as a broken screen; "No phone yet" reads as a fact.
 */
function Detail({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    /* ⛔ The label sat in a 224px column, which does not fit a 320px card. It
       stacks now, so a long email wraps under its label instead of squeezing it. */
    <span className="block border-b border-line-soft py-2 last:border-0 last:pb-0">
      <span className="eyebrow block">{label}</span>
      {/* ⛔ break-words WILL NOT SPLIT AN UNBROKEN ADDRESS. A long email clipped
          at the card's edge at 375px — "marcus.ramachandran0@example.co" and then
          nothing. `overflow-wrap: anywhere` is the one that breaks inside a run of
          characters with no space in it. Found by looking at phone-person.png. */}
      <span
        className={`block ${missing ? "t-body text-ink-muted-text-safe" : "t-body"}`}
        style={{ overflowWrap: "anywhere" }}
        data-missing={missing ? "true" : undefined}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * T38 — every source with the date it first happened.
 *
 * ⛔ Derived from the events, not stored. `got` is a set of keys with no dates
 * on it; the date lives on the event that created the key, so the first event of
 * each kind IS the answer. Anything the events cannot date says so rather than
 * showing a guess.
 */
function sourceDates(p: Profile): { key: string; label: string; date?: string }[] {
  const KIND: Record<string, string> = {
    form: "inquiry",
    newsletter: "newsletter",
    payment: "payment",
    "moved-in": "added",
    "by-hand": "added",
  };
  return p.got.map((g) => {
    const kind = KIND[g];
    const ev = [...p.events].reverse().find((e) => e.kind === kind);
    return { key: g, label: GOT_LABEL[g], date: ev?.date };
  });
}

/* ── S3 · one business ────────────────────────────────────────────────────── */

function BusinessBody({ p }: { p: Profile }) {
  const ui = useUi();
  const { world } = ui;

  /**
   * The one move for a business, carried by the person it belongs to: whoever is
   * waiting, else the main contact when the account has gone quiet. A business
   * has no inbox of its own — a person does.
   */
  const move: { label: string; icon: IconName; who: Profile; run: () => void } | null = (() => {
    const main = p.people.find((x) => x.c.mainContact) ?? p.people[0];
    const waiting = p.people.find((x) => openMessage(x, world));
    if (waiting) {
      const m = openMessage(waiting, world)!;
      return canEmail(waiting)
        ? { label: `Reply to ${firstName(waiting.c.name)}`, icon: "mail" as const, who: waiting, run: () => ui.go(`#/conversation/${m.id}`) }
        : { label: `Open ${firstName(waiting.c.name)}`, icon: "person" as const, who: waiting, run: () => ui.go(`#/p/${waiting.c.id}`) };
    }
    if (p.isQuiet && main) {
      return {
        label: `Check in with ${firstName(main.c.name)}`,
        icon: "call" as const,
        who: main,
        run: () => { ui.act((w) => recordCheckin(w, main.c.id, ui.actor)); ui.toast("Check-in recorded."); },
      };
    }
    if (main && canEmail(main)) {
      return { label: `Write to ${firstName(main.c.name)}`, icon: "mail" as const, who: main, run: () => ui.go(`#/conversation/${main.c.id}`) };
    }
    return null;
  })();

  // ⛔ buildModel ALREADY aggregates a business's people into p.spent12. Adding
  // them again here double-counted: the People table read $5,620 and this page
  // read $11,240 for the same account. Two numbers about one business,
  // disagreeing — found by looking at both screens after the aggregation fix.
  const spent = p.spent12;
  const someUnknown = p.people.some((x) => !x.buys.length);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="t-hero" data-testid="business-name">{p.c.name}</h2>
        <Chip tone={p.status === "not-back" ? "amber" : "plain"}>{statusLabel(p.status, p.pack)}</Chip>
      </div>
      <Verdict>{whyLine(p, world)}</Verdict>

      {/*
        ⛔ Design §7.3 — naming a gap without offering the move that closes it is
        a scold. Before this the business page said "Nobody at Anchor has been
        back in a while" and offered NOTHING to do about it: no primary, no
        secondary, a dead end for the owner. Found by looking, Rev 7.
      */}
      {!p.c.erased && move ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button primary icon={move.icon} testId="business-primary" onClick={move.run}>{move.label}</Button>
          <Button icon="person" testId="business-open-person" onClick={() => ui.go(`#/p/${move.who.c.id}`)}>
            Open {firstName(move.who.c.name)}
          </Button>
        </div>
      ) : null}

      {/* T110 — a business page is a page about money too. */}
      {!canSeeMoney(ui.viewer) ? null : (
      <p className="t-body mb-4" data-testid="business-money">
        {!world.feeds.payments.ok
          ? "Alloro can't see your payments right now, so this is unknown."
          : spent > 0
            ? `${money(spent)} in the last 12 months${someUnknown ? ", from the people here who have paid. Some have not." : "."}`
            : "No order yet."}
      </p>
      )}

      <h3 className="eyebrow mt-6 mb-2">The people who work there</h3>
      {p.people.length === 0 ? (
        <p className="t-meta" data-testid="business-empty">Nobody here from {p.c.name} yet.</p>
      ) : (
        <Card className="p-0">
          <ul data-testid="business-people">
            {p.people.map((x) => (
              <li key={x.c.id} className="border-b border-line-soft px-3 py-2 last:border-0">
                <button type="button" className="tap text-left font-semibold underline-offset-2 hover:underline" onClick={() => ui.go(`#/p/${x.c.id}`)}>
                  {x.c.name}
                </button>
                {x.c.mainContact ? <Chip tone="quiet">main contact</Chip> : null}
                <span className="t-meta ml-2">{x.c.email ?? x.c.phone ?? "no email or phone"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h3 className="eyebrow mt-6 mb-2">What happened</h3>
      <Card className="p-0">
        <ul>
          {[...p.events, ...p.people.flatMap((x) => x.events)]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 20)
            .map((e) => (
              <li key={e.id} className="border-b border-line-soft px-3 py-2 last:border-0">
                <span className="t-meta">{relativeDay(e.date, world.today)}</span>
                <p className="t-body">{eventWords(e.kind)}</p>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

/* ── the sheets ───────────────────────────────────────────────────────────── */

/**
 * T120 (Rev 30) — ⛔ FOUR FIELDS, THREE RISK CLASSES, AND THE SCREEN SAYS SO.
 *
 * Name and company are free to type. Email and phone are the keys Alloro uses to
 * decide two records are the same person, so a value that already belongs to
 * somebody else is REFUSED and the merge is offered instead — named, so the
 * owner knows who they just collided with.
 *
 * ⛔ WHAT IS NOT ON THIS SHEET IS THE POINT OF IT. Status, stage, first seen, the
 * payment ledger, who added them and the source chips are computed from events.
 * If one of those is wrong the EVENT is wrong, and the fix is a new event, not a
 * typed override. That boundary is in CONTEXT.md as a settled decision, and the
 * shape of EditPatch is what enforces it.
 */
function EditSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const [name, setName] = useState(p.c.name);
  const [email, setEmail] = useState(p.c.email ?? "");
  const [phone, setPhone] = useState(p.c.phone ?? "");
  const biz = p.c.businessId ? ui.model.byId.get(p.c.businessId) : undefined;
  const [company, setCompany] = useState(biz?.c.name ?? "");
  const [clash, setClash] = useState<string | null>(null);

  const save = () => {
    setClash(null);
    const res = ui.act((w) => editContact(w, p.c.id, { name, email, phone, company }, ui.actor));
    if (!res) { setClash("Couldn't save that. Nothing changed. Try again."); return; }
    if (res.kind === "gone") { setClash("This person isn't here any more."); return; }
    if (res.kind === "clash") {
      setClash(`That ${res.field} belongs to ${res.withName}. Are these the same person? Open them and use "Same person" instead.`);
      return;
    }
    ui.toast(res.changed.length ? "Saved." : "Nothing changed.");
    onClose();
  };

  return (
    <Sheet title="Edit details" onClose={onClose}>
      <Field label="Name" value={name} onChange={setName} testId="edit-name" />
      <Field label="Email" value={email} onChange={setEmail} testId="edit-email"
        hint="Alloro uses this to know when a message is from them." />
      <Field label="Phone" value={phone} onChange={setPhone} testId="edit-phone"
        hint="Used the same way as the email, when there is no email." />
      <Field label="Company" value={company} onChange={setCompany} testId="edit-company"
        hint="Moving them moves their money to that company's page too." />
      {clash ? <p className="t-meta mb-3" data-testid="edit-clash">{clash}</p> : null}
      {/* ⛔ The fields NOT here are the ones Alloro works out. Said on the screen,
          not only in the code, so nobody has to guess why. */}
      <p className="t-meta mb-3">
        Alloro works out their status, their stage and when you first saw them from what has
        happened. Those are not typed, so they are not here.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button primary icon="tick" testId="edit-save" onClick={save}>Save</Button>
        <Button icon="close" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

function NoteSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <Sheet title="Add a note" onClose={onClose}>
      <textarea
        value={text}
        data-testid="note-text"
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-line-medium p-3 text-base"
        placeholder="What happened?"
      />
      {failed ? <p className="t-meta mt-2" data-testid="note-error">Couldn't save the note. Your text is still here.</p> : null}
      <div className="mt-3 flex gap-2">
        <Button primary icon="note" testId="note-save" onClick={() => {
          const ok = ui.act((w) => { addNote(w, p.c.id, text, ui.actor); return true; });
          if (ok) { ui.toast("Note saved."); onClose(); } else setFailed(true);
        }}>Save the note</Button>
      </div>
    </Sheet>
  );
}

/** S6 — Hide. ⛔ Keeps the email and phone, so a later import cannot un-hide them. */
function HideSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  return (
    <Sheet title={`Hide ${p.c.name}`} onClose={onClose}>
      <p className="t-body">
        {p.c.name} leaves your list and every filter. Nothing is deleted, and you can bring them back.
      </p>
      <p className="t-meta mt-2">
        A file you bring in later will not put them back in your list.
      </p>
      <div className="mt-4 flex gap-2">
        <Button primary icon="hide" testId="hide-confirm" onClick={() => {
          const ok = ui.act((w) => { hideContact(w, p.c.id, ui.actor); return true; });
          if (ok) {
            ui.toast(`${p.c.name} is hidden.`, { label: "Undo", onClick: () => ui.act((w) => showContact(w, p.c.id, ui.actor)) });
            onClose(); ui.go("#/people");
          }
        }}>Hide</Button>
        <Button icon="close" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

/** S7 — Erase. ⛔ One-way, Alloro staff only, and it stores fingerprints. */
function EraseSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const [typed, setTyped] = useState("");
  return (
    <Sheet title={`Erase ${p.c.name}`} onClose={onClose}>
      <p className="t-body font-semibold">This cannot be undone.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="eyebrow mb-1">What goes</p>
          <ul className="t-meta list-disc pl-4">
            <li>Their name, email, phone and address</li>
            <li>Every note about them</li>
            <li>The words of every message</li>
            <li>Any record of who read their notes</li>
          </ul>
        </Card>
        <Card>
          <p className="eyebrow mb-1">What stays</p>
          <ul className="t-meta list-disc pl-4">
            <li>A blank record, so nothing adds them again</li>
            <li>The dates things happened</li>
            <li>A line saying who erased them, and when</li>
          </ul>
        </Card>
      </div>
      <div className="mt-4">
        <Field label={`Type ERASE to confirm`} value={typed} onChange={setTyped} testId="erase-typed" />
      </div>
      <div className="flex gap-2">
        <Button primary icon="erase" disabled={typed.trim().toUpperCase() !== "ERASE"} testId="erase-confirm" onClick={() => {
          const ok = ui.act((w) => { eraseContact(w, p.c.id, ui.actor); return true; });
          if (ok) { ui.toast("Erased. Nothing will add them again."); onClose(); }
        }}>Erase</Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

/** S20 — Mark lost. ⛔ The owner's, always. Alloro never marks anyone lost. */
const LOST_REASONS = ["Went somewhere else", "Price", "Not the right fit", "No longer needs it", "Never heard back", "Other"];

function LostSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  return (
    <Sheet title={`Mark ${p.c.name} lost`} onClose={onClose}>
      <p className="t-body">{p.c.name} stops appearing in what needs you. They stay in your list.</p>
      <p className="t-meta mt-1">What they already spent does not change.</p>
      <div className="mt-3">
        <Select label="Why" value={reason} onChange={setReason} testId="lost-reason"
          options={LOST_REASONS.map((r) => ({ value: r, label: r }))} />
        {reason === "Other" ? <Field label="In your own words" value={other} onChange={setOther} testId="lost-other" /> : null}
      </div>
      <div className="flex gap-2">
        <Button primary icon="lost" testId="lost-confirm" onClick={() => {
          const text = reason === "Other" ? (other.trim() || "Other") : reason;
          const ok = ui.act((w) => { markLost(w, p.c.id, text, ui.actor); return true; });
          if (ok) {
            ui.toast("Marked lost.", { label: "Undo", onClick: () => ui.act((w) => unmarkLost(w, p.c.id)) });
            onClose();
          }
        }}>Mark lost</Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

/** S16 — Call. ⛔ "No answer" does NOT finish the 48-hour card. */
function CallSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const open = openMessage(p, ui.world);
  if (!p.c.phone) {
    return (
      <Sheet title={`Call ${p.c.name}`} onClose={onClose}>
        <p className="t-body" data-testid="call-nonumber">No phone number yet.</p>
      </Sheet>
    );
  }
  const record = (outcome: "talked" | "left-message" | "no-answer", label: string) => {
    const ok = ui.act((w) => { recordCall(w, p.c.id, ui.actor, outcome, open?.id); return true; });
    if (ok) { ui.toast(label); onClose(); }
  };
  return (
    <Sheet title={`Call ${p.c.name}`} onClose={onClose}>
      <a href={`tel:${p.c.phone}`} className="t-hero block underline" data-testid="call-number">{p.c.phone}</a>
      <p className="eyebrow mt-5 mb-2">How did it go?</p>
      <div className="flex flex-wrap gap-2">
        <Button icon="tick" testId="call-talked" onClick={() => record("talked", "Recorded: you talked.")}>Talked</Button>
        <Button icon="note" testId="call-left" onClick={() => record("left-message", "Recorded: you left a message.")}>Left a message</Button>
        <Button icon="close" testId="call-noanswer" onClick={() => record("no-answer", "Recorded: no answer. They're still waiting.")}>No answer</Button>
      </div>
      <p className="t-meta mt-3">No answer means they are still waiting, so this stays on your list.</p>
    </Sheet>
  );
}

/** S19 — Remind me. */
function RemindSheet({ p, onClose }: { p: Profile; onClose: () => void }) {
  const ui = useUi();
  const existing = ui.world.reminders.find((r) => r.contactId === p.c.id);
  const [when, setWhen] = useState(existing?.on ?? addDays(ui.world.today, 3));
  const [move, setMove] = useState<"reply" | "call">(existing?.move ?? "reply");
  const [why, setWhy] = useState(existing?.why ?? "");
  return (
    <Sheet title={`Remind me about ${p.c.name}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-2">
        {[["in 3 days", 3], ["next week", 7], ["next month", 30]].map(([label, n]) => (
          <Button key={label as string} small icon="date" testId={`remind-${n}`} onClick={() => setWhen(addDays(ui.world.today, n as number))}>{label as string}</Button>
        ))}
      </div>
      <Field label="On" value={when} onChange={setWhen} type="date" testId="remind-date" />
      <Select label="Then" value={move} onChange={(v) => setMove(v as "reply" | "call")} testId="remind-move"
        options={[{ value: "reply", label: "Write to them" }, { value: "call", label: "Call them" }]} />
      <Field label="Why (optional)" value={why} onChange={setWhy} testId="remind-why" />
      <div className="flex gap-2">
        <Button primary icon="remind" testId="remind-save" onClick={() => {
          const ok = ui.act((w) => { setReminder(w, p.c.id, when, move, why.trim() || undefined); return true; });
          if (ok) { ui.toast("Reminder set."); onClose(); }
        }}>Save</Button>
        {existing ? (
          <Button icon="close" testId="remind-clear" onClick={() => { ui.act((w) => { w.reminders = w.reminders.filter((r) => r.contactId !== p.c.id); }); ui.toast("Reminder cleared."); onClose(); }}>Clear reminder</Button>
        ) : null}
      </div>
    </Sheet>
  );
}

/* ── S4 · Add by hand ─────────────────────────────────────────────────────── */

/**
 * S12 · T63 (Rev 12) — add by hand, now rendered INSIDE A SHEET over People.
 *
 * ⛔ IT KEPT ITS ADDRESS. `#/p/new` still resolves; App routes it to People and
 * People opens this sheet. Two buttons link to it and areas.ts names it, so a
 * modal reachable only by clicking would have been a regression — Design §5.3's
 * no-dead-ends rule and A3's unknown-address landing both still apply.
 *
 * `onClose` is what the host passes to go back to the plain list.
 */
export function AddByHand({ onClose }: { onClose?: () => void }) {
  const ui = useUi();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [found, setFound] = useState<FoundKey>("not-known");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  /* T99 — what has been used before, one entry per category rather than one per
     spelling. The first spelling recorded is the one offered, the same rule the
     email groups use, so the two screens never disagree about a group's name. */
  const usedCategories = useMemo(() => {
    const first = new Map<string, string>();
    for (const x of ui.model.visible) {
      const raw = x.c.category?.trim();
      if (raw && !first.has(raw.toLowerCase())) first.set(raw.toLowerCase(), raw);
    }
    return [...first.values()].sort((a, b) => a.localeCompare(b));
  }, [ui.model]);
  const [billingOn, setBillingOn] = useState(false);
  const [plan, setPlan] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [nextDue, setNextDue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    setErr(null);
    if (!name.trim()) { setErr("A name is needed. It's the only thing your list can show."); return; }
    const res = ui.act((w) =>
      addByHand(w, {
        name, email, phone, company: company.trim() || undefined, found,
        category: category.trim() || undefined, note: note.trim() || undefined,
        billing: billingOn && plan.trim()
          ? { plan: plan.trim(), amount: amount ? Number(amount) : undefined, cycle: cycle as "weekly" | "monthly" | "yearly", nextDue: nextDue || undefined }
          : undefined,
      }, ui.actor),
    );
    if (!res) { setErr("Couldn't save. Try again."); return; }
    if (res.kind === "erased-before") { setErr("This email was erased at someone's request, so Alloro won't add it again."); return; }
    if (res.kind === "already-here") { ui.toast("Already here, so Alloro opened their page instead of making a copy."); ui.go(`#/p/${res.id}`); return; }
    /* T119 (Rev 30) — ⛔ THE UNDO EVERY OTHER DESTRUCTIVE ACTION ALREADY HAD.
       Hide, erase, merge and import can all be taken back; adding somebody could
       not, and adding is where a typo starts. */
    const added: string = res.id!;
    ui.toast("Added.", {
      label: "Undo",
      onClick: () => {
        const ok = ui.act((w) => undoAddByHand(w, added));
        if (ok) { ui.toast("Undone. Nothing was added."); ui.go("#/people"); }
        else ui.toast("Too late to undo — something has happened to them already.");
      },
    });
    ui.go(`#/p/${res.id}`);
  };

  return (
    <div>
      {/* T56 — ⛔ THE TITLE SAID ITSELF TWICE. The page is headed "Add by hand"
          and this read "Add someone by hand." three lines later. The line that
          FOLLOWED it is the only one of the three saying something new, so it
          becomes the verdict. */}
      <Verdict sub="They arrive when someone writes in or pays.">Most people are added for you.</Verdict>
      {err ? <p className="mb-3 rounded-lg border border-amber bg-amber-soft px-3 py-2 text-sm" data-testid="add-error">{err}</p> : null}
      <Card>
        <Field label="Name" value={name} onChange={setName} testId="add-name" hint="Needed. It is the only thing your list can show." />
        <Field label="Email" value={email} onChange={setEmail} testId="add-email" hint="Without it, nothing you send can reach them." />
        <Field label="Phone" value={phone} onChange={setPhone} testId="add-phone" hint="Without an email AND a phone, no payment or message can ever attach to them." />
        <Field label="Company" value={company} onChange={setCompany} testId="add-company" hint="Optional. It groups them under a business." />
        <Select label="How they found you" value={found} onChange={(v) => setFound(v as FoundKey)} testId="add-found"
          options={[
            { value: "google", label: "Google" }, { value: "referral", label: "A referral" },
            { value: "ad", label: "An ad" }, { value: "walk-in", label: "Walked in" },
            { value: "not-known", label: "Not known" },
          ]} />
        {/* T99 (Rev 24) — ⛔ A COMBO, NOT A TEXT BOX AND NOT A DROPDOWN. It shows
            the categories already in use so nobody invents a fourth spelling of
            one that exists, and it still takes a brand new word, because this
            field is the email audience list and the owner decides what their
            groups are. */}
        <Combo
          label="Category"
          value={category}
          onChange={setCategory}
          options={usedCategories}
          testId="add-category"
          hint="Optional. It is how you pick a group to email."
        />
        <Field label="Notes" value={note} onChange={setNote} testId="add-note" />
        <p className="flex items-center justify-between border-t border-line-soft pt-3">
          <span className="eyebrow">Added by</span>
          <span className="t-body" data-testid="add-addedby">{ui.actor}</span>
        </p>
        <p className="t-meta">Alloro fills this in. You cannot change it, so a record can always be traced.</p>
      </Card>

      <Card className="mt-4">
        <button type="button" data-testid="add-billing-toggle" onClick={() => setBillingOn((b) => !b)}
          className="tap flex w-full items-center justify-between text-left font-semibold">
          <span>They pay on a plan</span><span>{billingOn ? "−" : "+"}</span>
        </button>
        {billingOn ? (
          <div className="mt-3">
            <Field label="Plan name" value={plan} onChange={setPlan} testId="bill-plan" />
            <Field label="Amount" value={amount} onChange={setAmount} testId="bill-amount" />
            <Select label="How often" value={cycle} onChange={setCycle} testId="bill-cycle"
              options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
            <Field label="Next due" value={nextDue} onChange={setNextDue} type="date" testId="bill-next" />
            <Placeholder testId="billing-note">
              Alloro keeps what you type here. It does not work anything out from the payments it can see.
            </Placeholder>
          </div>
        ) : null}
      </Card>

      <div className="mt-4 flex gap-2">
        <Button primary icon="tick" testId="add-save" onClick={save}>Save</Button>
        <Button icon="close" testId="add-cancel" onClick={() => (onClose ? onClose() : ui.go("#/people"))}>Cancel</Button>
      </div>
    </div>
  );
}
