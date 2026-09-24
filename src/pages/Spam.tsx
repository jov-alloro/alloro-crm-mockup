import { useState } from "react";
import { useUi } from "../lib/ui-context";
import { Button, Card, EmptyState, PageSkeleton, Verdict } from "../components/ui";
import { rescueSpam } from "../lib/actions";
import { relativeDay } from "../lib/format";

/** S17 — hidden as spam. Design §8.3: the reason is shown, so the filter is inspectable. */
export default function Spam() {
  const ui = useUi();
  const [failed, setFailed] = useState<string | null>(null);
  if (ui.loading) return <PageSkeleton rows={3} />;

  const spam = ui.world.spam;
  return (
    <div>
      <Verdict sub="Spam is never a person and is left out of every count.">
        {spam.length === 0 ? "No spam right now." : `${spam.length} hidden as spam.`}
      </Verdict>
      

      {spam.length === 0 ? (
        <div className="mt-4"><EmptyState title="No spam right now." /></div>
      ) : (
        <div className="mt-4 space-y-3" data-testid="spam-list">
          {spam.slice(0, 40).map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  <p className="t-body italic" data-testid="client-text">"{s.text}"</p>
                  <p className="t-meta mt-1">{relativeDay(s.date, ui.world.today)} · {s.reason}</p>
                  {failed === s.id ? <p className="t-meta" data-testid="spam-error">Couldn't move it back. Try again.</p> : null}
                </div>
                <Button icon="show" testId="spam-rescue" onClick={() => {
                  const id = ui.act((w) => rescueSpam(w, s.id, ui.actor));
                  if (id) { ui.toast("Moved back. It's a person now."); ui.go(`#/p/${id}`); }
                  else setFailed(s.id);
                }}>
                  {failed === s.id ? "Try again" : "Not spam"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
