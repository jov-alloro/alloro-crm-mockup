import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WORLD_VERSION } from "../data/kit";
import { BUSINESS_KEYS, DEFAULT_BUSINESS, seedWorld } from "../data/seed";
import type { BusinessKey, SeedVariant, Viewer, World } from "../data/types";
import { buildModel, type Model } from "./engine";

/**
 * T0 — the saved world (spec §3.2).
 *
 * The whole world lives IN MEMORY and is mirrored to localStorage after every
 * change, so a refresh keeps it.
 *
 * ⛔ On load, a saved blob whose version does not match WORLD_VERSION — or that
 * is missing a business — is DISCARDED AND RESEEDED. That is the intended
 * behaviour, not a failure: bumping the number is how a data change reaches
 * anyone who already opened the file. Acceptance A35 proves it.
 *
 * ⚠️ Clearing localStorage by hand is NOT a reset. The world is held in memory,
 * so it must be cleared AND THEN reloaded. This trap cost v1 a rehearsal.
 */

const KEY = "alloro-crm-v2";

export interface AppState {
  version: number;
  business: BusinessKey;
  viewer: Viewer;
  /** Demo only: stretches the loading skeletons so they can be seen. */
  slowConnection: boolean;
  worlds: Record<BusinessKey, World>;
}

function fresh(): AppState {
  const worlds = Object.fromEntries(
    BUSINESS_KEYS.map((k) => [k, seedWorld(k, "full")]),
  ) as Record<BusinessKey, World>;
  return {
    version: WORLD_VERSION,
    business: DEFAULT_BUSINESS,
    viewer: "owner",
    slowConnection: false,
    worlds,
  };
}

function load(): { state: AppState; reseeded: boolean } {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { state: fresh(), reseeded: false };
    const s = JSON.parse(raw) as AppState;
    if (s.version !== WORLD_VERSION || BUSINESS_KEYS.some((k) => !s.worlds?.[k])) {
      return { state: fresh(), reseeded: true };
    }
    return { state: s, reseeded: false };
  } catch {
    return { state: fresh(), reseeded: false };
  }
}

export interface Demo {
  state: AppState;
  world: World;
  model: Model;
  /** Change the current business's world. Returns whatever the change returns. */
  act: <T>(fn: (w: World) => T) => T;
  setBusiness: (b: BusinessKey) => void;
  setViewer: (v: Viewer) => void;
  setSlowConnection: (on: boolean) => void;
  reseed: (variant: SeedVariant) => void;
  resetAll: () => void;
  /** False when the browser refused to store. The demo still works (spec S0). */
  saved: boolean;
  /** True when a version mismatch threw the saved demo away on this load. */
  reseeded: boolean;
}

export function useDemo(): Demo {
  const first = useRef(load());
  const [state, setState] = useState<AppState>(first.current.state);
  const [saved, setSaved] = useState(true);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      setSaved(true);
    } catch {
      // Private window, blocked site data, or a full disk. The demo must keep
      // working for the life of the tab and say so once (spec §3.2, S0).
      setSaved(false);
    }
  }, [state]);

  const commit = useCallback((next: AppState) => {
    ref.current = next;
    setState(next);
  }, []);

  const act = useCallback(
    <T,>(fn: (w: World) => T): T => {
      const s = ref.current;
      const w = structuredClone(s.worlds[s.business]);
      const result = fn(w);
      commit({ ...s, worlds: { ...s.worlds, [s.business]: w } });
      return result;
    },
    [commit],
  );

  const setBusiness = useCallback((b: BusinessKey) => commit({ ...ref.current, business: b }), [commit]);
  const setViewer = useCallback((v: Viewer) => commit({ ...ref.current, viewer: v }), [commit]);
  const setSlowConnection = useCallback((on: boolean) => commit({ ...ref.current, slowConnection: on }), [commit]);
  const reseed = useCallback(
    (variant: SeedVariant) => {
      const s = ref.current;
      commit({ ...s, worlds: { ...s.worlds, [s.business]: seedWorld(s.business, variant) } });
    },
    [commit],
  );
  const resetAll = useCallback(() => commit(fresh()), [commit]);

  const world = state.worlds[state.business];
  const model = useMemo(() => buildModel(world), [world]);

  return {
    state, world, model, act, setBusiness, setViewer, setSlowConnection,
    reseed, resetAll, saved, reseeded: first.current.reseeded,
  };
}
