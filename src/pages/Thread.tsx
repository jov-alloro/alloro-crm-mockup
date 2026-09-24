import { useMemo, useState } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, EmptyState, PageSkeleton, Placeholder, Sheet, Verdict } from "../components/ui";
import { canEmail, type Profile } from "../lib/engine";
import { relativeDay, timeWords, firstName } from "../lib/format";
import { recordCall, recordEmail } from "../lib/actions";
import { suggestReply, cleanUp, diffWords } from "../lib/drafts";
import type { TimelineEvent } from "../data/types";

/**
 * S14 — one thread, at RUNG 1 (spec R3).
 *
 * ⛔ THE HONESTY LINE IS NOT OPTIONAL. Alloro sees what the client wrote. It does
 * NOT see the owner's words back, because those leave from the owner's own
 * mailbox. Rung 1 records THAT a reply happened and when, never what it said.
 * Without this line on screen the page reads as a mailbox it is not (risk K3).
 */
export default function Thread({ id }: { id: string }) {
  const ui = useUi();
  const [reply, setReply] = useState(false);
  const [call, setCall] = useState(false);

  const found = useMemo(() => {
    for (const p of ui.model.list) {
      const e = p.events.find((x) => x.id === id);
      if (e) return { p, e };
      if (p.c.id === id) return { p, e: p.messages[0] };
    }
    return null;
  }, [ui.model, id]);

  if (ui.loading) return <PageSkeleton rows={3} />;
  if (!found) return <EmptyState title="That conversation isn't here." action={<Button primary icon="back" onClick={() => ui.go("#/conversation")}>Back to Conversation</Button>} />;

  const { p } = found;
  const thread = p.events.filter((e) => ["inquiry", "email", "called", "checkin", "thanks"].includes(e.kind)).slice().reverse();
  const reachable = canEmail(p);

  return (
    <div>
      <Verdict sub={`Website form · ${p.c.email ?? p.c.phone ?? "no email or phone"}`}>
        {p.c.name}
      </Verdict>

      <div className="space-y-3" data-testid="thread">
        {thread.map((e) => <Bubble key={e.id} e={e} p={p} />)}
      </div>

      {/* ⛔ The honesty line. Always, under the last message. */}
      <p className="measure mt-4 card-radius border border-line-soft bg-alloro-bg px-3 py-2 text-sm" data-testid="honesty-line">
        Alloro can see what they wrote. It records that you replied and when, not what you said —
        your reply goes from your own email.
      </p>

      {/* P6 — the greyed rung, with the reason ON SCREEN (spec §4.5, risk K3).
          ⛔ It sits ABOVE the action row. Below it, at 375px, it fell under the
          fold — and this sentence is the only thing stopping the screen from
          reading as a mailbox it is not. Found by looking at phone-thread.png. */}
      {/*
        T51 (Rev 10) — ⛔ IT SAID ITSELF TWICE. A disabled box read "Reply inside
        Alloro · Coming later" and this paragraph then repeated those six words and
        finished the sentence, back to back on the screen. Found by looking.

        ⛔ A32 REQUIRES ph-P6 TO CARRY ITS EXACT REGISTERED SENTENCE, so the
        paragraph was never the thing to change. The box is gone and the
        PLACEHOLDER IS THE RUNG: one element, one sentence, the registered words,
        styled as the greyed step it describes.
      */}
      <div className="mt-4">
        <p
          data-testid="ph-P6"
          data-placeholder="true"
          aria-disabled="true"
          className="measure card-radius border border-dashed border-line-medium bg-alloro-bg px-4 py-3 text-[13px] leading-5"
        >
          Reply inside Alloro · Coming later. It needs a verified sending address for {ui.world.info.name},
          so that a reply arrives from you and not from Alloro.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {reachable ? (
          <Button primary icon="mail" testId="thread-reply" onClick={() => setReply(true)}>Reply to {firstName(p.c.name)}</Button>
        ) : null}
        {p.c.phone ? <Button primary={!reachable} icon="call" testId="thread-call" onClick={() => setCall(true)}>Call {firstName(p.c.name)}</Button> : null}
        <Button icon="person" testId="thread-person" onClick={() => ui.go(`#/p/${p.c.id}`)}>Open their page</Button>
      </div>

      {reply ? <ReplySheet p={p} messageId={found.e?.id} onClose={() => setReply(false)} /> : null}
      {call ? <CallSheet p={p} messageId={found.e?.id} onClose={() => setCall(false)} /> : null}
    </div>
  );
}

function Bubble({ e, p }: { e: TimelineEvent; p: Profile }) {
  const ui = useUi();
  const mine = e.kind !== "inquiry";
  return (
    <Card className={mine ? "ml-8 bg-alloro-bg" : "mr-8"}>
      <p className="eyebrow mb-1">
        {mine ? "You" : p.c.name} · {relativeDay(e.date, ui.world.today)}{e.minute ? `, ${timeWords(e.minute)}` : ""}
      </p>
      {e.kind === "inquiry" ? (
        <p className="t-body measure" data-testid="client-text">{e.message}</p>
      ) : e.kind === "called" ? (
        <p className="t-body measure">
          You called{e.outcome === "talked" ? " and talked." : e.outcome === "left-message" ? " and left a message." : ". No answer, so they are still waiting."}
        </p>
      ) : (
        <p className="t-body measure">You replied. Alloro doesn't keep the words — they went from your own email.</p>
      )}
    </Card>
  );
}

/** S15 — the reply sheet and the AI helper (spec R11). */
function ReplySheet({ p, messageId, onClose }: { p: Profile; messageId?: string; onClose: () => void }) {
  const ui = useUi();
  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [copyMode, setCopyMode] = useState(false);

  const suggest = () => {
    setThinking(true);
    // A visible pause, so the owner can see it was generated rather than pre-written.
    window.setTimeout(() => {
      setText(suggestReply(p, ui.world));
      setThinking(false);
    }, 500);
  };

  const clean = () => {
    setThinking(true);
    window.setTimeout(() => {
      setDiff({ before: text, after: cleanUp(text) });
      setThinking(false);
    }, 500);
  };

  const mailto = `mailto:${p.c.email ?? ""}?subject=${encodeURIComponent("Re: your message")}&body=${encodeURIComponent(text)}`;

  return (
    <Sheet title={step === 1 ? `Reply to ${firstName(p.c.name)}` : "Did you send it?"} onClose={onClose} wide>
      {step === 1 ? (
        <>
          <Card className="mb-3 bg-alloro-bg">
            <p className="eyebrow mb-1">They wrote</p>
            <p className="t-body measure italic" data-testid="client-text">"{p.messages[0]?.message}"</p>
          </Card>
          <p className="t-meta mb-1">To: {p.c.email}</p>
          <p className="t-meta mb-2">Subject: Re: your message</p>

          <textarea
            value={text}
            data-testid="reply-text"
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Write your reply…"
            className="w-full rounded-lg border border-line-medium p-3 text-base"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            {!text.trim() ? (
              <Button small icon="suggest" testId="ai-suggest" onClick={suggest} disabled={thinking}>
                {thinking ? "Writing…" : "Suggest a reply"}
              </Button>
            ) : (
              <Button small icon="suggest" testId="ai-clean" onClick={clean} disabled={thinking}>
                {thinking ? "Reading…" : "Clean this up"}
              </Button>
            )}
          </div>

          {/* P9 — the exact sentence from the register. */}
          <Placeholder testId="ph-P9">
            In the real product Alloro's model writes this. Here it is built from what is already on this page.
          </Placeholder>

          {diff ? (
            <Card className="mb-3">
              <p className="eyebrow mb-2">What changed</p>
              <p className="t-body" data-testid="ai-diff">{diffWords(diff.before, diff.after)}</p>
              <div className="mt-3 flex gap-2">
                <Button small primary icon="tick" testId="ai-use" onClick={() => { setText(diff.after); setDiff(null); }}>Use this</Button>
                <Button small icon="close" testId="ai-keep" onClick={() => setDiff(null)}>Keep mine</Button>
              </div>
            </Card>
          ) : null}

          <Card className="mb-3 bg-alloro-bg">
            <p className="t-meta">
              {ui.world.info.name} · {ui.world.info.address}
              <br />Reply "stop" and I won't email you about this again.
            </p>
          </Card>
          <p className="t-meta mb-3">Alloro never sends. This opens your own email with the message ready.</p>

          <div className="flex flex-wrap gap-2">
            <Button primary icon="mail" testId="reply-open" onClick={() => {
              try { window.location.href = mailto; } catch { setCopyMode(true); }
              setStep(2);
            }}>Open in my email</Button>
            <Button icon="note" testId="reply-copy" onClick={() => setCopyMode(true)}>Copy it instead</Button>
          </div>

          {copyMode ? (
            <Card className="mt-3">
              <p className="eyebrow mb-1">Copy this</p>
              <p className="t-meta mb-1">{p.c.email}</p>
              <pre className="whitespace-pre-wrap rounded bg-alloro-bg p-3 text-sm" data-testid="reply-fallback">{text}</pre>
            </Card>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button primary icon="tick" testId="reply-sent" onClick={() => {
            const ok = ui.act((w) => { recordEmail(w, p.c.id, ui.actor, messageId, "Re: your message"); return true; });
            if (ok) { ui.toast("Recorded. They're no longer waiting."); onClose(); }
          }}>Yes, I sent it</Button>
          <Button icon="close" testId="reply-notyet" onClick={() => setStep(1)}>Not yet</Button>
        </div>
      )}
    </Sheet>
  );
}

function CallSheet({ p, messageId, onClose }: { p: Profile; messageId?: string; onClose: () => void }) {
  const ui = useUi();
  if (!p.c.phone) {
    return <Sheet title={`Call ${p.c.name}`} onClose={onClose}><p className="t-body" data-testid="call-nonumber">No phone number yet.</p></Sheet>;
  }
  const record = (outcome: "talked" | "left-message" | "no-answer", label: string) => {
    const ok = ui.act((w) => { recordCall(w, p.c.id, ui.actor, outcome, messageId); return true; });
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
