import { useState, type ReactNode } from "react";
import { Button, Sheet } from "./ui";
import { Icon } from "./icons";
import { useUi } from "../lib/ui-context";
import { BUSINESS_KEYS, BUSINESS_LABELS } from "../data/seed";
import {
  arriveMessage, arriveNewsletter, arrivePayment, askNoEmail, moveClock,
  quoteMoves, refundLast, setFeed,
} from "../lib/actions";
import type { BusinessKey, Viewer } from "../data/types";

/**
 * S24 — the demo controls.
 *
 * ⛔ NOT PART OF THE PRODUCT. Every switch here stands in for something the real
 * product would receive. Each group below names the acceptance items that need
 * it (spec §6.7), and no acceptance item may depend on a switch that is not here.
 *
 * ⛔ Three switches are NEW in v2 and have no v1 analog: "Move the clock
 * forward" (A21 cannot run without it), "A quote moves" (A4's chips would be
 * empty), and "Someone asks not to be emailed" (A20 needs a real reason).
 * v1's "Naming a partner" is deliberately absent: partners are cut.
 */
export function DemoStripe() {
  const [open, setOpen] = useState(false);
  const ui = useUi();
  return (
    <>
      {/* T27 — the stripe is full-bleed but its TEXT uses the same gutter as the
          page, so the demo line and the page title start on the same vertical. */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-alloro-navy px-4 py-2 text-white sm:px-8">
        <p className="text-sm">
          <span className="font-semibold">{ui.world.info.name}</span>
          <span className="ml-2 text-white/70">a demo · no real data · today is {ui.world.today}</span>
        </p>
        <button
          type="button"
          data-testid="demo-open"
          onClick={() => setOpen(true)}
          className="tap inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 text-sm font-semibold"
        >
          <Icon name="run" size={15} />
          Try it
        </button>
      </div>
      {open ? <DemoPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="eyebrow">{title}</p>
      {note ? <p className="t-meta mb-2">{note}</p> : null}
      <div className="mt-1 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function DemoPanel({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  const { demo, world } = ui;
  const [confirmReset, setConfirmReset] = useState(false);
  const run = (label: string, fn: (w: typeof world) => unknown) => {
    ui.act(fn);
    ui.toast(label);
  };

  return (
    <Sheet title="Try it" onClose={onClose} wide>
      <p className="t-meta mb-4">
        Not part of the product: these buttons stand in for your customers and your payments,
        so you can watch the screens change.
      </p>

      <Group title="Business">
        {BUSINESS_KEYS.map((k: BusinessKey) => (
          <Button key={k} small primary={demo.state.business === k} testId={`demo-business-${k}`}
            onClick={() => demo.setBusiness(k)}>
            {BUSINESS_LABELS[k]}
          </Button>
        ))}
      </Group>

      <Group title="Viewing as" note="Staff see no money and no export. Erase is Alloro staff's only.">
        {([
          ["owner", `${world.info.ownerFirst} (owner)`],
          ["staff", `${world.info.staffName.split(" ")[0]} (staff)`],
          ["alloro", "Alloro staff"],
        ] as [Viewer, string][]).map(([v, label]) => (
          <Button key={v} small primary={demo.state.viewer === v} testId={`demo-viewer-${v}`}
            onClick={() => demo.setViewer(v)}>
            {label}
          </Button>
        ))}
      </Group>

      <Group title="A message arrives">
        <Button small testId="demo-msg-new" onClick={() => run("A new message arrived.", (w) => arriveMessage(w, "new"))}>From someone new</Button>
        <Button small testId="demo-msg-known" onClick={() => run("They wrote again.", (w) => arriveMessage(w, "known"))}>From someone you know</Button>
        <Button small testId="demo-msg-phone" onClick={() => run("They left a phone number only.", (w) => arriveMessage(w, "phone"))}>Phone number only</Button>
        <Button small testId="demo-msg-spam" onClick={() => run("Hidden as spam.", (w) => arriveMessage(w, "spam"))}>Spam</Button>
      </Group>

      <Group title="A payment arrives">
        <Button small testId="demo-pay-new" onClick={() => run("A payment arrived.", (w) => arrivePayment(w, "new", guessAmount(w.info.pack), "Order"))}>From someone new</Button>
        <Button small testId="demo-pay-quiet" onClick={() => run("Someone came back.", (w) => arrivePayment(w, "quiet", guessAmount(w.info.pack), "Order"))}>From someone who hasn't been back</Button>
        <Button small testId="demo-refund" onClick={() => run("The last payment was refunded.", refundLast)}>Refund the last payment</Button>
        <Button small testId="demo-buy-after-email" onClick={() => run("Two people bought after your email.", (w) => { arrivePayment(w, "quiet", guessAmount(w.info.pack), "Order"); arrivePayment(w, "quiet", guessAmount(w.info.pack), "Order"); })}>After your email, two people buy it</Button>
      </Group>

      <Group title="Newsletter">
        <Button small testId="demo-newsletter" onClick={() => run("Someone confirmed a sign-up.", arriveNewsletter)}>Someone confirms a sign-up</Button>
      </Group>

      <Group title="A quote moves" note="New in v2: without this, the stage chips have nothing in them.">
        <Button small testId="demo-quote-ask" onClick={() => run("Someone asked.", (w) => quoteMoves(w, "ask"))}>Someone asks for a quote</Button>
        <Button small testId="demo-quote-send" onClick={() => run("You sent a price.", (w) => quoteMoves(w, "quote"))}>Send them a quote</Button>
        <Button small testId="demo-quote-accept" onClick={() => run("They said yes.", (w) => quoteMoves(w, "accept"))}>They accept</Button>
      </Group>

      <Group title="Things go wrong" note="Alloro flags nobody while a feed is down, and says why.">
        <Button small testId="demo-feed-payments"
          onClick={() => run(world.feeds.payments.ok ? "Payments stopped arriving." : "Payments are back.", (w) => setFeed(w, "payments", !w.feeds.payments.ok))}>
          {world.feeds.payments.ok ? "Payments stop arriving" : "Payments are back"}
        </Button>
        <Button small testId="demo-feed-forms"
          onClick={() => run(world.feeds.forms.ok ? "Website forms stopped." : "Website forms are back.", (w) => setFeed(w, "forms", !w.feeds.forms.ok))}>
          {world.feeds.forms.ok ? "Website forms stop" : "Website forms come back"}
        </Button>
        <Button small testId="demo-slow-season"
          onClick={() => run(world.sim.slowSeason ? "Back to a normal month." : "Now it's a slow month.", (w) => { w.sim.slowSeason = !w.sim.slowSeason; })}>
          {world.sim.slowSeason ? "End the slow month" : "Slow month for everyone"}
        </Button>
        <Button small testId="demo-fail-save"
          onClick={() => run(world.sim.failNextSave ? "Saves work normally again." : "The next save will fail.", (w) => { w.sim.failNextSave = !w.sim.failNextSave; })}>
          {world.sim.failNextSave ? "Saves work normally" : "Next save fails (note, rescue, import or email)"}
        </Button>
        <Button small testId="demo-slow-connection"
          onClick={() => { const on = !demo.state.slowConnection; demo.setSlowConnection(on); ui.toast(on ? "Slow connection on." : "Back to a normal connection."); }}>
          {demo.state.slowConnection ? "Normal connection" : "Slow connection"}
        </Button>
      </Group>

      <Group title="Move the clock forward" note="New in v2. The 48-hour alarm pauses at weekends, so it needs real days to pass.">
        <Button small testId="demo-clock-day" onClick={() => run("A day passed.", (w) => moveClock(w, 1))}>A day</Button>
        <Button small testId="demo-clock-week" onClick={() => run("A week passed.", (w) => moveClock(w, 7))}>A week</Button>
      </Group>

      <Group title="Someone asks not to be emailed" note="New in v2. The campaign screen needs a real reason to leave someone out.">
        <Button small testId="demo-stop" onClick={() => run("They asked not to be emailed.", askNoEmail)}>Mark the next person</Button>
      </Group>

      <Group title="Start from" note={`Replaces ${world.info.name}'s data only.`}>
        <Button small testId="demo-seed-empty" onClick={() => { demo.reseed("empty"); ui.toast("Nobody has written or paid yet."); }}>Nothing yet</Button>
        <Button small testId="demo-seed-first" onClick={() => { demo.reseed("first-week"); ui.toast("First week: a few messages, almost no payments."); }}>First week</Button>
        <Button small testId="demo-seed-full" onClick={() => { demo.reseed("full"); ui.toast("Two years of history."); }}>Two years of history</Button>
      </Group>

      <Group title="Reset" note="Puts every business back, including anything you erased.">
        {confirmReset ? (
          <>
            <Button small primary testId="demo-reset-yes" onClick={() => { demo.resetAll(); setConfirmReset(false); ui.toast("The demo was reset."); }}>Yes, reset everything</Button>
            <Button small onClick={() => setConfirmReset(false)}>Keep my changes</Button>
          </>
        ) : (
          <Button small testId="demo-reset" onClick={() => setConfirmReset(true)}>Reset demo</Button>
        )}
      </Group>
    </Sheet>
  );
}

function guessAmount(pack: string): number {
  return pack === "cafe" ? 9 : pack === "dealership" ? 2400 : 5200;
}
