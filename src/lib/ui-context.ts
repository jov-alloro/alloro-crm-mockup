import { createContext, useContext } from "react";
import type { Demo } from "./store";
import type { Model } from "./engine";
import type { World } from "../data/types";
import type { Route } from "./router";
import type { Card } from "./cards";

export interface Ui {
  demo: Demo;
  world: World;
  model: Model;
  cards: Card[];
  route: Route;
  loading: boolean;
  /** Who is looking. Staff see no money and no export (spec R10). */
  viewer: "owner" | "staff" | "alloro";
  /** The name recorded against anything this viewer does. */
  actor: string;
  go: (href: string) => void;
  toast: (text: string, action?: { label: string; onClick: () => void }) => void;
  /** Run a change against the world, catching the demo's "next save fails". */
  act: <T>(fn: (w: World) => T) => T | undefined;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("no ui context");
  return ui;
}
