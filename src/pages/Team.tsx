import { useUi } from "../lib/ui-context";
import { Card, EmptyState, PageSkeleton, Verdict } from "../components/ui";

/**
 * S23 — Team, inside Settings (spec R10).
 *
 * ⛔ SHOWN, NEVER EDITED. Roles are Alloro's to change, and a mockup that let the
 * owner edit them would be promising something that does not exist.
 */
const ROWS: { what: string; owner: boolean; staff: boolean }[] = [
  { what: "See everyone in the list", owner: true, staff: true },
  { what: "See what people spent", owner: true, staff: false },
  { what: "Reply and call", owner: true, staff: true },
  { what: "Add someone by hand", owner: true, staff: true },
  { what: "Move people in from a file", owner: true, staff: true },
  { what: "Email a group or write a campaign", owner: true, staff: false },
  { what: "Hide someone", owner: true, staff: false },
  { what: "Download everything", owner: true, staff: false },
];

export default function Team() {
  const ui = useUi();
  if (ui.loading) return <PageSkeleton rows={3} />;
  const { world, viewer } = ui;

  if (viewer === "staff") {
    return <EmptyState title="Team is for the owner." body={`Only ${world.info.ownerFirst} can see who sees what.`} />;
  }

  return (
    <div>
      <Verdict>Who can see what.</Verdict>
      

      <h2 className="eyebrow mt-6 mb-2">People</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-semibold">{world.info.ownerFull}</p>
          <p className="t-meta">Owner. Sees everything.</p>
        </Card>
        <Card>
          <p className="font-semibold">{world.info.staffName}</p>
          <p className="t-meta">Staff. No money, no export.</p>
        </Card>
      </div>

      <h2 className="eyebrow mt-6 mb-2">Who can see what</h2>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="team-matrix">
          <thead className="bg-alloro-bg">
            <tr>
              <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted-text-safe">What</th>
              <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted-text-safe">{world.info.ownerFirst}</th>
              <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted-text-safe">{world.info.staffName.split(" ")[0]}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.what} className="border-t border-line-soft">
                <td className="px-3 py-2">{r.what}</td>
                <td className="px-3 py-2">{r.owner ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{r.staff ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="t-meta mt-2">Alloro staff change who is on your team. You cannot edit this here.</p>
    </div>
  );
}
