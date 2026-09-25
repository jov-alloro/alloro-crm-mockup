import { Menu } from "../components/Menu";
import { useEffect, useMemo, useState } from "react";
import { useUi } from "../lib/ui-context";
import {
  Button, Card, EmptyState, PageSkeleton, Placeholder, Select, Verdict,
} from "../components/ui";
import {
  FIELDS, PRESET_LABEL, buildRows, guessMapping, hasRefundColumn,
  parseCsv, sampleFile, type FieldKey, type PresetKey,
} from "../lib/csvImport";
import { canUndo, previewImport, runImport, undoImport, type ImportPreview } from "../lib/actions";
import { dateWords, plural } from "../lib/format";
import { Icon } from "../components/icons";
import { handOff, takeHandoff } from "../lib/handoff";

/**
 * S9 · choose · S10 · CSV · S11 · Stripe · S12 · receipt and undo.
 *
 * ⛔ THE OWNER RUNS THESE NOW (the round-17 reversal), and Alloro staff reach the
 * same screens. One flow, two roles, nothing built twice. The safety that makes
 * the reversal survivable is the preview below and the 30-day undo on S12.
 */
export default function MoveIn({
  step, source, batchId,
}: { step: "choose" | "csv" | "stripe" | "receipt"; source?: string; batchId?: string }) {
  /**
   * T94 (Rev 21) — ⛔ THE LOADING SKELETON USED TO LIVE HERE, AND IT THREW AWAY
   * THE FILE THE OWNER HAD JUST CHOSEN.
   *
   * A route-level `if (ui.loading) return <PageSkeleton/>` UNMOUNTS the step
   * below it. The sequence, which took three runs to see: the hash changes, React
   * renders the new route, Mapper mounts and its effect takes the handed file and
   * loads it — and THEN App's own effect sets loading to true, this line returns
   * a skeleton, Mapper unmounts and its state goes with it. Four hundred
   * milliseconds later it remounts, asks for the file again, and the file has
   * already been taken.
   *
   * ⛔ EVERY PART OF THAT WAS WORKING CORRECTLY ON ITS OWN. A73 reported
   * "landed on the right screen, no error, nothing loaded" and it was exactly
   * right. The skeleton now lives inside each step, AFTER its hooks, so the
   * screen keeps what it was given while it waits.
   */
  if (step === "choose") return <Choose />;
  if (step === "receipt") return <Receipt batchId={batchId!} />;
  return <Mapper preset={step === "stripe" ? "stripe" : ((source as PresetKey) ?? "csv")} />;
}

/* ── S9 ───────────────────────────────────────────────────────────────────── */

/**
 * ⛔ SIX PRESETS AND STRIPE, KEPT APART ON PURPOSE (T62). The six all land on
 * the CSV screen with P1; Stripe lands on its own with P2. The split in this
 * array is the split on the screen.
 */
const CSV_SOURCES: PresetKey[] = ["hubspot", "mailchimp", "square", "shopify", "wix", "csv"];

/**
 * T93 (Rev 21) — ⛔ A BUTTON THAT OPENS THE FILE PICKER, NOT A LINK TO A SCREEN
 * THAT HAS ONE.
 *
 * ⛔ IT IS A <label> AROUND A REAL <input type="file">, AND THE INPUT IS NOT
 * display:none. Hiding it that way takes it out of the tab order, and the whole
 * control then exists only for a mouse. It is pulled off-screen with the sr-only
 * recipe instead, so it keeps focus, keyboard and a screen-reader name.
 *
 * ⛔ AND IT CARRIES data-btn, so A40a still sees it. A control that looks like a
 * button and is invisible to the check that governs buttons is worse than one
 * that fails it.
 */
function FileButton({
  children, testId, onPick,
}: {
  children: React.ReactNode;
  testId: string;
  onPick: (f: File) => void;
}) {
  return (
    <label
      data-btn="true"
      className="tap inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-medium bg-alloro-surface px-4 text-[13px] font-semibold tracking-tight text-alloro-navy transition-colors duration-150 hover:bg-alloro-bg motion-reduce:transition-none"
    >
      <span className="shrink-0 opacity-80"><Icon name="movein" size={15} /></span>
      {children}
      <input
        type="file"
        accept=".csv,text/csv"
        data-testid={testId}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
        className="absolute h-px w-px overflow-hidden opacity-0"
      />
    </label>
  );
}

function Choose() {
  const ui = useUi();
  const [error, setError] = useState<string | null>(null);

  /**
   * ⛔ THE FILE IS READ HERE AND HANDED ON. Jov: "why does it go to another page
   * when I want to upload something?" It no longer does for the PICKING — the
   * picker opens on this screen.
   *
   * ⛔ THE SECOND SCREEN STILL EXISTS, AND SAYING SO PLAINLY IS BETTER THAN
   * PRETENDING IT DOES NOT. That screen is where the columns are matched and the
   * preview is looked at, which is this product's one promise on its one
   * destructive screen: "Nothing is added until you have looked at it." What went
   * away is the dead stop in the middle — a screen whose only job was to hold a
   * file input the owner had already decided to use.
   */
  const pick = (preset: PresetKey | "stripe", f: File) => {
    if (!/\.csv$/i.test(f.name)) {
      setError("Alloro can read CSV files. Export one and try again.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      handOff({ preset, text: String(r.result), name: f.name });
      ui.go(preset === "stripe" ? "#/people/import/stripe" : `#/people/import/csv/${preset}`);
    };
    r.onerror = () => setError("Alloro couldn't read this file.");
    r.readAsText(f);
  };
  if (ui.loading) return <PageSkeleton rows={4} />;

  return (
    <div>
      {/* T56 — ⛔ "Bring people in from a file." was BOTH this verdict and the
          header subtitle, word for word, under a page headed "Move in". R14's
          safety promise takes the slot, because that is what is worth reading
          first on the one destructive screen in the product. */}
      <Verdict>Nothing is added until you have looked at it.</Verdict>
      {/*
        T62 (Rev 12) — ⛔ SEVEN CARDS BECAME TWO. Each of the seven held one label
        and one "Choose a file": the card was a border around a name, doing no
        work, and it filled a screen with six repetitions of one idea.

        ⛔ STRIPE STAYS ITS OWN CARD, and that is not tidiness. The six are
        column-mapping presets that land on the SAME screen carrying P1. Stripe
        routes elsewhere and carries P2 — a different promise about what Alloro
        reads and where. Folding it in would hide that, and A32 checks both
        sentences on their own named screens.
      */}
      <div className="grid gap-3" data-testid="sources-list">
        <Card>
          <p className="eyebrow mb-1">A file from another tool</p>
          <p className="t-meta measure mb-3">Pick where it came from, so Alloro knows which columns to read.</p>
          <div className="flex flex-wrap gap-2">
            {CSV_SOURCES.map((k) => (
              <FileButton key={k} testId={`source-${k}`} onPick={(f) => pick(k, f)}>
                {PRESET_LABEL[k]}
              </FileButton>
            ))}
          </div>
        </Card>

        <Card>
          <p className="eyebrow mb-1">A Stripe export</p>
          <p className="t-meta measure mb-3">Payments, not just names. It reads what each person paid and when.</p>
          <FileButton testId="source-stripe" onPick={(f) => pick("stripe", f)}>
            Choose a file
          </FileButton>
        </Card>
      </div>
      {error ? <p className="t-meta mt-3" data-testid="choose-error">{error}</p> : null}
      {/*
        T96 (Rev 23) — ⛔ CANCEL IS GONE, BECAUSE IT WAS THE SECOND WAY OUT.
        "Back to People" sits directly above this screen's own heading and goes to
        the same place. Two controls, one destination, and the lower one dressed
        as a decision — "Cancel" implies something is in progress that would be
        thrown away, and on this screen nothing is: no file has been chosen yet.
        The one that names where it goes is the one that stays.
      */}
    </div>
  );
}

/* ── S10 and S11 ──────────────────────────────────────────────────────────── */

function Mapper({ preset }: { preset: PresetKey }) {
  const ui = useUi();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [map, setMap] = useState<Record<number, FieldKey | "">>({});
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const grid = useMemo(() => (text ? parseCsv(text) : null), [text]);
  const headers = grid?.[0] ?? [];
  const body = grid?.slice(1) ?? [];

  const preview: ImportPreview | null = useMemo(() => {
    if (!grid) return null;
    const rows = buildRows(body, headers, map);
    return previewImport(ui.world, rows, hasRefundColumn(headers));
  }, [grid, map, headers, body, ui.world]);

  const loadText = (t: string, name: string) => {
    setError(null);
    const g = parseCsv(t);
    if (!g.length) { setError("Alloro couldn't read this file."); return; }
    setText(t);
    setFileName(name);
    setMap(guessMapping(g[0], preset));
  };

  const onFile = (f: File) => {
    if (!/\.csv$/i.test(f.name)) {
      setError(`Alloro can read CSV files. Export one from ${PRESET_LABEL[preset]} and try again.`);
      return;
    }
    setReading(true);
    const r = new FileReader();
    r.onload = () => { setReading(false); loadText(String(r.result), f.name); };
    r.onerror = () => { setReading(false); setError("Alloro couldn't read this file."); };
    r.readAsText(f);
  };

  /* T93 — ⛔ TAKE THE HANDED FILE ONCE, IF IT WAS PICKED FOR THIS STEP. No
     handoff means a direct arrival or a reload, and this screen's own file input
     and sample button are still here for that. */
  useEffect(() => {
    const h = takeHandoff(preset);
    if (h) loadText(h.text, h.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const setField = (i: number, v: FieldKey | "") => {
    // Two columns to one field: refuse the second and say which.
    const taken = Object.entries(map).find(([k, val]) => val === v && Number(k) !== i);
    if (v && taken) { setError(`"${headers[Number(taken[0])]}" is already the ${FIELDS.find((f) => f.key === v)!.label}.`); return; }
    setError(null);
    setMap({ ...map, [i]: v });
  };

  /* ⛔ AFTER THE HOOKS, SO THE STEP KEEPS ITS STATE WHILE IT WAITS. See T94. */
  if (ui.loading) return <PageSkeleton rows={4} />;

  return (
    <div>
      <Verdict sub={PRESET_LABEL[preset]}>Match the columns, then look at it.</Verdict>

      {/* P1 / P2 — the exact sentences from the register (spec §4.5). */}
      {preset === "stripe" ? (
        <Placeholder testId="ph-P2">
          In the real product this step reads your Stripe export on Alloro's servers.
          Here it is read in your browser and nothing leaves it.
        </Placeholder>
      ) : (
        <Placeholder testId="ph-P1">
          In the real product Alloro reads this file on its servers, with row limits and a download
          of the rows that failed. Here it is read in your browser and nothing leaves it.
        </Placeholder>
      )}

      {preset === "stripe" ? (
        <p className="t-meta mb-3">In Stripe, go to Payments and export. The file has one row per payment.</p>
      ) : null}

      <Card className="mb-4">
        <input
          type="file"
          accept=".csv,text/csv"
          data-testid="file-input"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          className="tap block w-full text-base"
        />
        <div className="mt-2">
          <Button small icon="run" testId="use-sample" onClick={() => loadText(sampleFile(preset), "sample.csv")}>
            Use a sample file instead
          </Button>
        </div>
        {reading ? <p className="t-meta mt-2" data-testid="reading">Reading your file…</p> : null}
        {error ? <p className="t-meta mt-2" data-testid="file-error">{error}</p> : null}
      </Card>

      {!grid ? (
        <EmptyState title="Choose a file to begin." body="Nothing is added until you have looked at the preview." />
      ) : (
        <>
          <h2 className="eyebrow mb-2">Which column is which</h2>
          <Card className="mb-4 p-0 overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="mapping">
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} className="border-b border-line-soft last:border-0">
                    <td className="px-3 py-2 font-semibold">{h || `(column ${i + 1})`}</td>
                    <td className="px-3 py-2 t-meta">{body[0]?.[i] ?? ""}</td>
                    <td className="px-3 py-2">
                      <Menu
                        id={`map-${i}`}
                        label={map[i] ? (FIELDS.find((f) => f.key === map[i])?.label ?? "Keep as a note") : "Keep as a note"}
                        ariaLabel={`What "${h || `column ${i + 1}`}" is`}
                        value={map[i] ?? ""}
                        options={[{ value: "", label: "Keep as a note" }, ...FIELDS.map((f) => ({ value: f.key, label: f.label }))]}
                        onChange={(v) => setField(i, v as FieldKey | "")}
                        caret="menu"
                        on={false}
                        field
                        triggerClass="tap flex items-center justify-between gap-2 rounded-lg border border-line-medium bg-alloro-surface px-2 text-sm normal-case tracking-normal text-alloro-navy hover:border-alloro-navy"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {preview ? <Preview preview={preview} fileName={fileName} preset={preset} /> : null}
        </>
      )}
    </div>
  );
}

function Preview({ preview, fileName, preset }: { preview: ImportPreview; fileName: string; preset: PresetKey }) {
  const ui = useUi();
  const [failed, setFailed] = useState(false);
  const nothing = preview.created === 0 && preview.matched === 0;

  return (
    <>
      <h2 className="eyebrow mb-2">What will happen</h2>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3" data-testid="preview-counts">
          <Count n={preview.created} label="New people" />
          <Count n={preview.matched} label="Already here" />
          <Count n={preview.skipped.reduce((s, x) => s + x.count, 0)} label="Skipped" />
        </div>

        {preview.matchedHidden > 0 ? (
          <p className="t-meta mt-3" data-testid="preview-hidden">
            {plural(preview.matchedHidden, "row")} match{preview.matchedHidden === 1 ? "es" : ""} someone you hid.
            They stay hidden, and no second record is made.
          </p>
        ) : null}

        {preview.skipped.length ? (
          <ul className="t-meta mt-3" data-testid="preview-skipped">
            {preview.skipped.map((s) => (
              <li key={s.reason} className="flex justify-between border-b border-line-soft py-1 last:border-0">
                <span>{s.reason}</span><span>{s.count}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {!preview.hasPaymentColumn ? (
          <p className="t-meta mt-3" data-testid="no-payment-column">
            This file has no payment column, so nobody gains a purchase.
          </p>
        ) : null}
        {preset === "stripe" && !preview.hasRefundColumn ? (
          <p className="t-meta mt-1" data-testid="no-refund-column">
            This file has no refund column, so refunds are not shown.
          </p>
        ) : null}

        <p className="t-meta mt-3">
          "Unsubscribed" becomes "asked not to be emailed". Bringing a file in never gives
          Alloro permission to email anyone.
        </p>
      </Card>

      {nothing ? (
        <EmptyState title="Nothing in this file can be brought in." body="The reasons are listed above." />
      ) : null}

      {failed ? <p className="t-meta mb-2" data-testid="import-error">Couldn't bring them in. Nothing changed. Try again.</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button primary icon="movein" disabled={nothing} testId="import-run" onClick={() => {
          const id = ui.act((w) => runImport(w, preview, `${PRESET_LABEL[preset]} · ${fileName}`, ui.actor));
          if (id) { ui.toast("Brought in."); ui.go(`#/people/import/${id}`); } else setFailed(true);
        }}>
          Bring them in
        </Button>
        <Button icon="back" onClick={() => ui.go("#/people/import")}>Back to the file list</Button>
      </div>
    </>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-alloro-bg p-3">
      <p className="t-hero">{n}</p>
      <p className="t-meta">{label}</p>
    </div>
  );
}

/* ── S12 ──────────────────────────────────────────────────────────────────── */

function Receipt({ batchId }: { batchId: string }) {
  const ui = useUi();
  const [failed, setFailed] = useState(false);
  if (ui.loading) return <PageSkeleton rows={4} />;
  const b = ui.world.imports.find((x) => x.id === batchId);
  if (!b) {
    return <EmptyState title="That import isn't here." action={<Button primary icon="back" onClick={() => ui.go("#/people")}>Back to People</Button>} />;
  }
  const undoable = canUndo(ui.world, b);
  return (
    <div>
      <Verdict sub={`${b.source} · ${dateWords(b.on, ui.world.today)} · ${b.by}`}>
        {plural(b.created, "person", "people")} came in.
      </Verdict>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Count n={b.created} label="New people" />
          <Count n={b.matched} label="Already here" />
          <Count n={b.skipped.reduce((s, x) => s + x.count, 0)} label="Skipped" />
        </div>
        {b.skipped.length ? (
          <ul className="t-meta mt-3">
            {b.skipped.map((s) => (
              <li key={s.reason} className="flex justify-between border-b border-line-soft py-1 last:border-0">
                <span>{s.reason}</span><span>{s.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!b.hasPaymentColumn ? <p className="t-meta mt-3">Nobody gained a purchase from this file.</p> : null}
      </Card>

      {/* ⛔ R14 — undo is a first-class button, not a menu item, and it says
          exactly what it will and will not remove BEFORE it is pressed. */}
      {b.created > 0 ? (
        <Card className="mb-4">
          <p className="t-body font-semibold">Undo this import</p>
          <p className="t-meta mt-1" data-testid="undo-explains">
            It removes the {plural(b.created, "person", "people")} this file created.
            The {plural(b.matched, "person", "people")} who {b.matched === 1 ? "was" : "were"} already
            here {b.matched === 1 ? "stays" : "stay"}, and so does what this file added to them.
          </p>
          {undoable ? (
            <>
              <p className="t-meta mt-1">You can undo it until {dateWords(addDays30(b.on), ui.world.today)}.</p>
              {failed ? <p className="t-meta mt-1" data-testid="undo-error">Couldn't undo it. Nothing changed. Try again.</p> : null}
              <div className="mt-3">
                <Button primary icon="reset" testId="undo-import" onClick={() => {
                  const ok = ui.act((w) => { undoImport(w, b.id); return true; });
                  if (ok) { ui.toast("That import was undone."); ui.go("#/people"); } else setFailed(true);
                }}>
                  Undo this import
                </Button>
              </div>
            </>
          ) : (
            <p className="t-meta mt-1" data-testid="undo-expired">
              The 30 days to undo this ran out on {dateWords(addDays30(b.on), ui.world.today)}.
            </p>
          )}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button icon="people" testId="receipt-see" onClick={() => ui.go("#/people")}>See these people</Button>
        <Button icon="settings" onClick={() => ui.go("#/settings")}>Open Settings</Button>
      </div>
    </div>
  );
}

function addDays30(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 30);
  return dt.toISOString().slice(0, 10);
}

export { Select };
