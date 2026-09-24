import { useState } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, PageSkeleton, Placeholder, Verdict } from "../components/ui";
import { canUndo, undoImport } from "../lib/actions";
import { dateWords, plural } from "../lib/format";

/** S22 — Settings. Sources, imports, the locked health switch, and the export. */
export default function Settings() {
  const ui = useUi();
  const { world, model, viewer } = ui;
  const [downloadFailed, setDownloadFailed] = useState(false);
  if (ui.loading) return <PageSkeleton rows={4} />;

  const isOwner = viewer === "owner";
  const isAlloro = viewer === "alloro";

  const sources = [
    { name: "Website forms", state: world.feeds.forms.ok ? "Receiving" : `Not receiving since ${world.feeds.forms.downSince}`, last: `${model.spamCount} spam left out` },
    { name: "Newsletter sign-ups", state: "Receiving", last: "—" },
    { name: "Payments", state: world.feeds.payments.ok ? "Receiving" : `Not receiving since ${world.feeds.payments.downSince}`, last: "—" },
  ];

  return (
    <div>
      {/* The page subtitle already says where the list comes from, so the
          verdict says something the owner does not already know. */}
      <Verdict sub="Alloro staff can bring people in for you, and so can you.">
        Everything here is set up already.
      </Verdict>

      <h2 className="eyebrow mt-6 mb-2">Where your list comes from</h2>
      <Card className="p-0">
        <ul data-testid="sources">
          {sources.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-3 last:border-0">
              <span className="font-semibold">{s.name}</span>
              <span className="t-meta">{s.state} · {s.last}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button primary icon="movein" testId="settings-movein" onClick={() => ui.go("#/people/import")}>Move people in from a file</Button>
      </div>

      <h2 className="eyebrow mt-6 mb-2">Connections</h2>
      <div className="space-y-2">
        {/*
          P3, P4, P7 — the exact sentences from the register (spec §4.5).

          ⛔ EACH OF THESE SAID ITSELF TWICE, and I did not find it by looking —
          A50 did. A disabled box read "Connect Stripe · Coming later" and the
          paragraph under it repeated those words before finishing the sentence.
          T51 fixed exactly this on the thread; the same shape was sitting here
          three more times on a screen my by-eye pass never opened.

          ⛔ A32 requires each placeholder to keep its EXACT registered sentence,
          so the box goes and THE PLACEHOLDER IS THE ROW.
        */}
        {/* ⛔ NO OUTER CARD. It wrapped this dashed box in a white one with 24px
            of padding — a border around a border, three times down the screen.
            Found by looking; the same complaint as Move in's seven cards, and
            the same fix: let the row BE the row. */}
        <div>
          <p
            data-testid="ph-P3"
            data-placeholder="true"
            aria-disabled="true"
            className="measure card-radius border border-dashed border-line-medium bg-alloro-bg px-4 py-3 text-[13px] leading-5"
          >
            Connect Stripe · Coming later. Alloro needs a reviewed Stripe app before this can turn on.
            Until then, use your Stripe export file.
          </p>
        </div>
        {/* ⛔ NO OUTER CARD. It wrapped this dashed box in a white one with 24px
            of padding — a border around a border, three times down the screen.
            Found by looking; the same complaint as Move in's seven cards, and
            the same fix: let the row BE the row. */}
        <div>
          <p
            data-testid="ph-P4"
            data-placeholder="true"
            aria-disabled="true"
            className="measure card-radius border border-dashed border-line-medium bg-alloro-bg px-4 py-3 text-[13px] leading-5"
          >
            Connect Square · Coming later. Use your Square export file for now.
          </p>
        </div>
        {/* ⛔ NO OUTER CARD. It wrapped this dashed box in a white one with 24px
            of padding — a border around a border, three times down the screen.
            Found by looking; the same complaint as Move in's seven cards, and
            the same fix: let the row BE the row. */}
        <div>
          <p
            data-testid="ph-P7"
            data-placeholder="true"
            aria-disabled="true"
            className="measure card-radius border border-dashed border-line-medium bg-alloro-bg px-4 py-3 text-[13px] leading-5"
          >
            Connect Gmail · Coming later. It needs Google's review and a yearly security check.
          </p>
        </div>
      </div>

      {isOwner || isAlloro ? (
        <>
          <h2 className="eyebrow mt-6 mb-2">What was moved in</h2>
          {world.imports.length === 0 ? (
            <p className="t-meta" data-testid="imports-empty">Nothing has been moved in yet.</p>
          ) : (
            <Card className="p-0">
              <ul data-testid="imports">
                {world.imports.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-3 last:border-0">
                    <span>
                      <span className="font-semibold">{b.source}</span>
                      <span className="t-meta ml-2">{plural(b.created, "new person", "new people")} · {dateWords(b.on)} · {b.by}</span>
                    </span>
                    <span className="flex gap-2">
                      <Button small icon="forward" onClick={() => ui.go(`#/people/import/${b.id}`)}>See it</Button>
                      {canUndo(world, b) ? (
                        <Button small icon="reset" testId="settings-undo" onClick={() => { ui.act((w) => undoImport(w, b.id)); ui.toast("That import was undone."); }}>Undo</Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : null}

      {isOwner || isAlloro ? (
        <>
          <h2 className="eyebrow mt-6 mb-2">Health practice</h2>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">Health practice</span>
              {/* ⛔ R8 — a real switch that will not turn on. It must be legible as
                  a gate, not a grey rectangle with no explanation. */}
              <button
                type="button"
                role="switch"
                aria-checked={false}
                disabled
                data-testid="baa-switch"
                aria-label="Health practice. No BAA recorded."
                className="tap w-40 cursor-not-allowed rounded-full border border-line-medium bg-alloro-bg px-3 text-sm font-semibold opacity-80"
              >
                Off
              </button>
            </div>
            <p className="t-meta mt-2" data-testid="ph-P10">
              No BAA recorded. Alloro staff turn this on after the agreement is signed.
            </p>
          </Card>
        </>
      ) : null}

      {isOwner ? (
        <>
          <h2 className="eyebrow mt-6 mb-2">Download everything</h2>
          <Card>
            <Button icon="download" testId="settings-download" onClick={() => setDownloadFailed(world.sim.failNextSave)}>
              Download everything
            </Button>
            {downloadFailed ? <p className="t-meta mt-2" data-testid="download-error">Couldn't build the file. Try again.</p> : null}
            <Placeholder testId="ph-P11">
              In the real product Alloro builds this file on its servers and emails you the link.
            </Placeholder>
          </Card>
        </>
      ) : null}

      <h2 className="eyebrow mt-6 mb-2">Team</h2>
      <Button icon="people" testId="settings-team" onClick={() => ui.go("#/settings/team")}>Who can see what</Button>
    </div>
  );
}
