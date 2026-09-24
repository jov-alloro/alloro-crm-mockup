import { useMemo, useState } from "react";
import { useUi } from "../lib/ui-context";
import {
  Button, Card, EmptyState, Field, PageSkeleton, Placeholder, Select, Verdict,
} from "../components/ui";
import { canEmail, statusLabel, type Profile } from "../lib/engine";
import { plural } from "../lib/format";
import { cleanUp, diffWords, suggestCampaign, suggestSubject } from "../lib/drafts";

/**
 * S8 — Email a group, or write a campaign (spec R6, and the campaign reversal).
 *
 * ⛔ RISK K1: P8's sentence renders ABOVE the composer, not below it. Shown
 * without care, this screen reads as a promise that sending is close, when it
 * needs the same blocked sending identity as rung 2. Acceptance A20 fails if
 * the sentence is missing or below the fold at 375px.
 */
export default function EmailGroup() {
  const ui = useUi();
  const { model, viewer } = ui;
  const [group, setGroup] = useState("everyone");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("now");
  const [date, setDate] = useState("");
  const [approved, setApproved] = useState<null | string>(null);
  const [failed, setFailed] = useState(false);
  /* T67 — the AI's own state.  is a visible pause, so the owner sees a
     suggestion was generated rather than pre-written. */
  const [thinking, setThinking] = useState(false);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);

  /**
   * T98 (Rev 24) — ⛔ ONE GROUP PER CATEGORY, NOT ONE PER SPELLING.
   *
   * This list was built from a Set of the raw text and matched with ===, so
   * "Regular", "regular" and "Regular " were THREE separate email groups and none
   * contained the other's people. A typo on one record split an audience in
   * silence: the owner sent to 40 people believing they had sent to 43, and
   * nothing on the screen said otherwise.
   *
   * ⛔ THE FIRST SPELLING RECORDED IS THE ONE SHOWN, and that is a choice with a
   * reason. "Most used" also works and is worse: the group would RENAME ITSELF
   * the moment counts crossed, so a saved habit ("email the Regulars") would
   * quietly become something else. First-seen is stable.
   */
  const categories = useMemo(() => {
    const firstSpelling = new Map<string, string>();
    for (const p of model.visible) {
      const raw = p.c.category?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!firstSpelling.has(key)) firstSpelling.set(key, raw);
    }
    return [...firstSpelling.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [model]);

  /* ⛔ THE DRAFT GETS THE SPELLING, NOT THE KEY. `group` is lowercased for
     matching; handing that to the campaign writer would put "regular" in the
     owner's email where they had written "Regular". */
  const groupLabel = group === "everyone" ? "everyone" : (categories.find((c) => c.key === group)?.label ?? group);

  const { included, excluded } = useMemo(() => {
    const base = model.visible.filter((p) => p.c.kind === "person");
    /* ⛔ `group` holds the KEY (trimmed, lowercased), never the spelling. */
    const inGroup = base.filter(
      (p) => group === "everyone" || (p.c.category ?? "").trim().toLowerCase() === group,
    );
    const inc: Profile[] = [];
    const exc: { p: Profile; why: string }[] = [];
    for (const p of inGroup) {
      if (p.consent === "stop") exc.push({ p, why: "Asked not to be emailed" });
      else if (p.c.mark === "do-not-contact") exc.push({ p, why: "You marked them do not contact" });
      else if (!p.c.email) exc.push({ p, why: "No email address" });
      else if (canEmail(p)) inc.push(p);
    }
    // Hidden and erased people are not in model.visible at all, so they are
    // counted separately and named, rather than silently missing.
    const hidden = model.list.filter((p) => p.c.hidden).length;
    const erased = model.list.filter((p) => p.c.erased).length;
    if (hidden) exc.push({ p: null as unknown as Profile, why: `${plural(hidden, "person", "people")} you hid` });
    if (erased) exc.push({ p: null as unknown as Profile, why: `${plural(erased, "person", "people")} erased at their request` });
    return { included: inc, excluded: exc };
  }, [model, group]);

  if (ui.loading) return <PageSkeleton rows={4} />;

  if (viewer === "staff") {
    return <EmptyState title="Emailing a group is for the owner." body={`Only ${ui.world.info.ownerFirst} can write to a group.`} />;
  }

  if (approved) {
    return (
      <div>
        <Verdict>{approved}</Verdict>
        <Card>
          <p className="t-body">Nothing left this screen. Alloro sent no email.</p>
          <div className="mt-3 flex gap-2">
            <Button primary icon="back" onClick={() => ui.go("#/people")}>Back to People</Button>
            <Button icon="note" onClick={() => setApproved(null)}>Write another</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* T56 — ⛔ "Write to a group." under a page headed "Email a group" is the
          heading again. P8 leads instead, and it says what actually happens. */}

      {/* ⛔ P8 — ABOVE the composer. Risk K1. */}
      <Placeholder testId="ph-P8">
        In the real product, this sends from your verified address after you approve it.
        Alloro sends nothing from this screen.
      </Placeholder>

      <Card className="mb-4">
        <Select
          label="Who gets it"
          value={group}
          onChange={setGroup}
          testId="group-picker"
          options={[{ value: "everyone", label: "Everyone" }, ...categories.map((c) => ({ value: c.key, label: c.label }))]}
        />
        <p className="t-body" data-testid="group-count">
          {plural(included.length, "person", "people")} will get it.
        </p>
      </Card>

      <Card className="mb-4">
        <p className="eyebrow mb-2">Who is left out, and why</p>
        {excluded.length === 0 ? (
          <p className="t-meta">Nobody is left out.</p>
        ) : (
          <ul className="t-body" data-testid="excluded">
            {rollUp(excluded).map((row) => (
              <li key={row.why} className="flex justify-between border-b border-line-soft py-1 last:border-0">
                <span>{row.why}</span><span className="font-semibold">{row.n}</span>
              </li>
            ))}
          </ul>
        )}
        {/* Design §7.3 — it names the reason and never hands the owner a chore. */}
      </Card>

      <Card className="mb-4">
        <Field label="Subject" value={subject} onChange={setSubject} testId="campaign-subject" />
        <label className="block">
          <span className="eyebrow mb-1 block">Message</span>
          <textarea
            value={body}
            data-testid="campaign-body"
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-line-medium p-3 text-base"
            placeholder="What's new?"
          />
        </label>
        {/*
          T67 (Rev 13) — THE AI, ON THE ONE SCREEN THAT WRITES TO EVERYBODY.

          ⛔ THE RISK IS THE SAME RULE AT A DIFFERENT SIZE. R11 says a suggestion
          never invents a price, a date or an availability, and brackets what it
          cannot know. A made-up figure is one awkward email in a reply and
          hundreds in a campaign, with Alloro's name on every one — so the draft
          here is nothing BUT brackets and the owner's own signature.

          ⛔ TWO THINGS WERE REFUSED. A spam or deliverability warning: CONTEXT.md
          says deliverability is untested and deliberately out of scope, so "this
          will not deliver" is a claim the product cannot back. And AI picking the
          audience: R4 settled that categorization is the event engine's,
          "better, without drift" — the picker above is the answer, and a guess
          beside it could disagree with it.
        */}
        <div className="mt-2 flex flex-wrap gap-2">
          {!body.trim() ? (
            <Button small icon="suggest" testId="campaign-ai-draft" disabled={thinking}
              onClick={() => {
                setThinking(true);
                window.setTimeout(() => { setBody(suggestCampaign(groupLabel, included.length, ui.world)); setThinking(false); }, 500);
              }}>
              {thinking ? "Writing\u2026" : "Draft from the audience"}
            </Button>
          ) : (
            <Button small icon="suggest" testId="campaign-ai-clean" disabled={thinking}
              onClick={() => {
                setThinking(true);
                window.setTimeout(() => { setDiff({ before: body, after: cleanUp(body) }); setThinking(false); }, 500);
              }}>
              {thinking ? "Reading\u2026" : "Clean this up"}
            </Button>
          )}
          <Button small icon="suggest" testId="campaign-ai-subject" disabled={thinking || !body.trim()}
            onClick={() => setSubject(suggestSubject(body))}>
            Suggest a subject
          </Button>
        </div>

        {/* P9 — the exact sentence from the register. */}
        <Placeholder testId="ph-P9-campaign">
          In the real product Alloro's model writes this. Here it is built from what is already on this page.
        </Placeholder>

        {diff ? (
          <Card className="mb-3">
            <p className="eyebrow mb-2">What changed</p>
            <p className="t-body measure" data-testid="campaign-ai-diff">{diffWords(diff.before, diff.after)}</p>
            <div className="mt-3 flex gap-2">
              <Button small primary icon="tick" testId="campaign-ai-use"
                onClick={() => { setBody(diff.after); setDiff(null); }}>Use this</Button>
              <Button small icon="close" testId="campaign-ai-keep" onClick={() => setDiff(null)}>Keep mine</Button>
            </div>
          </Card>
        ) : null}

        <Card className="mt-3 bg-alloro-bg">
          <p className="t-meta">
            {ui.world.info.name} · {ui.world.info.address}
            <br />Reply "stop" and we won't email you about this again.
          </p>
        </Card>
      </Card>

      <Card className="mb-4">
        <Select label="When" value={when} onChange={setWhen} testId="campaign-when"
          options={[{ value: "now", label: "As soon as it's approved" }, { value: "date", label: "On a date" }]} />
        {when === "date" ? <Field label="On" value={date} onChange={setDate} type="date" testId="campaign-date" /> : null}
      </Card>

      {failed ? <p className="mb-3 t-meta" data-testid="campaign-error">Couldn't save it. Try again.</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button primary icon="tick" testId="campaign-approve" disabled={!subject.trim() || included.length === 0}
          onClick={() => {
            const ok = ui.act(() => true);
            if (!ok) { setFailed(true); return; }
            setApproved(
              when === "date" && date
                ? `Approved, waiting for ${date}.`
                : `Approved for ${plural(included.length, "person", "people")}.`,
            );
          }}>
          Approve
        </Button>
        <Button icon="download" testId="campaign-download" onClick={() => ui.toast("The list would download here.")}>Download the list</Button>
        <Button icon="close" onClick={() => ui.go("#/people")}>Cancel</Button>
      </div>
    </div>
  );
}

function rollUp(rows: { p: Profile; why: string }[]): { why: string; n: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.why, (m.get(r.why) ?? 0) + 1);
  return [...m.entries()].map(([why, n]) => ({ why, n }));
}

export { statusLabel };
