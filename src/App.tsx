import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "./components/Shell";
import { DemoStripe } from "./components/DemoPanel";
import { Toast } from "./components/ui";
import { useDemo } from "./lib/store";
import { parse, type Route } from "./lib/router";
import { buildCards } from "./lib/cards";
import { upTarget } from "./lib/layout";
import { UiContext, type Ui } from "./lib/ui-context";
import type { World } from "./data/types";

import People from "./pages/People";
import PersonPage from "./pages/PersonPage";
import EmailGroup from "./pages/EmailGroup";
import MoveIn from "./pages/MoveIn";
import Conversation from "./pages/Conversation";
import Thread from "./pages/Thread";
import Spam from "./pages/Spam";
import NeedsYou from "./pages/NeedsYou";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Team from "./pages/Team";

/**
 * One loading rule for every screen (spec §5, Level 1): a 400 ms skeleton on
 * first paint, 1600 ms when the demo's slow-connection switch is on. There is
 * no network, so this is the only honest way to show what the owner sees while
 * it loads.
 */
const FAST = 400;
const SLOW = 1600;

export default function App() {
  const demo = useDemo();
  const [hash, setHash] = useState(() => window.location.hash);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; action?: { label: string; onClick: () => void } } | null>(null);

  const parsed = useMemo(() => parse(hash), [hash]);
  const route: Route = parsed.route;

  /**
   * T85 (Rev 18) — ⛔ THE ADDRESS YOU CAME FROM, kept in a ref so remembering it
   * never causes a render of its own. `hash` is the only state; this trails it
   * by one.
   *
   * ⛔ IT IS NOT HISTORY AND MUST NOT BECOME IT. One step, no stack: a stack is
   * what the browser's own Back already is, and duplicating it here is how the
   * two start disagreeing. See REMEMBERS in layout.ts for which arrivals a
   * screen is allowed to use.
   */
  const seen = useRef<{ now: string; before: string | null }>({ now: hash, before: null });
  if (seen.current.now !== hash) seen.current = { now: hash, before: seen.current.now };
  const cameFrom = useMemo(() => {
    const h = seen.current.before;
    if (!h) return null;
    const r = parse(h);
    return r.known ? r.route : null;
  }, [hash]);


  // Design §5.3 — an unknown address lands on People and rewrites the bar.
  useEffect(() => {
    if (!parsed.known) window.location.hash = "#/people";
  }, [parsed.known]);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), demo.state.slowConnection ? SLOW : FAST);
    return () => window.clearTimeout(t);
  }, [hash, demo.state.business, demo.state.viewer, demo.state.slowConnection]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const go = useCallback((href: string) => { window.location.hash = href.replace(/^#/, "#"); }, []);

  const showToast = useCallback(
    (text: string, action?: { label: string; onClick: () => void }) => setToast({ text, action }),
    [],
  );

  const act = useCallback(
    <T,>(fn: (w: World) => T): T | undefined => {
      try {
        return demo.act(fn);
      } catch {
        showToast("Couldn't save that. Nothing changed. Try again.");
        return undefined;
      }
    },
    [demo, showToast],
  );

  const cards = useMemo(() => buildCards(demo.model, demo.state.viewer), [demo.model, demo.state.viewer]);

  /**
   * T85 — ⛔ NAMING THE ORIGIN IS WHY THIS LIVES IN App AND NOT IN Shell.
   * A38a requires the Up control to name where it goes, and "the message you
   * came from" is a person's name that only the model holds. A thread whose
   * person cannot be resolved gets no label, and upTarget falls back to the
   * fixed parent rather than shipping a bare "Back".
   */
  const up = useMemo(() => {
    let label: string | undefined;
    if (cameFrom?.name === "thread") {
      const id = cameFrom.id;
      for (const pr of demo.model.list) {
        if (pr.events.some((e) => e.id === id) || pr.c.id === id) { label = `${pr.c.name}'s message`; break; }
      }
    } else if (cameFrom?.name === "needs") label = "Needs you";
    else if (cameFrom?.name === "dashboard") label = "Dashboard";
    else if (cameFrom?.name === "conversation") label = "Conversation";
    else if (cameFrom?.name === "spam") label = "Hidden as spam";
    else if (cameFrom?.name === "email-group") label = "the email";
    return upTarget(route, cameFrom, label);
  }, [route, cameFrom, demo.model]);

  const ui: Ui = {
    demo, world: demo.world, model: demo.model, cards, route, loading,
    viewer: demo.state.viewer, actor:
      demo.state.viewer === "owner" ? demo.world.info.ownerFull
      : demo.state.viewer === "staff" ? demo.world.info.staffName
      : "Alloro staff",
    go, toast: showToast, act,
  };

  const savedWarning = !demo.saved
    ? "This browser isn't letting the demo save, so it won't be remembered after you close the tab. Everything still works."
    : demo.reseeded
      ? "The demo was rebuilt because its data changed since you last opened it."
      : undefined;

  return (
    <UiContext.Provider value={ui}>
      <Shell route={route} go={go} up={up} demoStripe={<DemoStripe />} savedWarning={savedWarning}>
        <Page route={route} />
      </Shell>
      {toast ? <Toast text={toast.text} action={toast.action?.label} onAction={toast.action?.onClick} /> : null}
    </UiContext.Provider>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "people": return <People filter={route.filter} />;
    /* T63 — ⛔ #/p/new IS PEOPLE WITH THE SHEET OPEN, not its own screen. The
       address survives, so every link to it still works and A3 still holds. */
    case "person":
      return route.id === "new" ? <People addOpen /> : <PersonPage id={route.id} />;
    case "email-group": return <EmailGroup />;
    case "import": return <MoveIn step="choose" />;
    case "import-csv": return <MoveIn step="csv" source={route.source} />;
    case "import-stripe": return <MoveIn step="stripe" />;
    case "import-receipt": return <MoveIn step="receipt" batchId={route.id} />;
    case "conversation": return <Conversation />;
    case "thread": return <Thread id={route.id} />;
    case "spam": return <Spam />;
    case "needs": return <NeedsYou />;
    case "dashboard": return <Dashboard />;
    case "settings": return <Settings />;
    case "team": return <Team />;
  }
}
