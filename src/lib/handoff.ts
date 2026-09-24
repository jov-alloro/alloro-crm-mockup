/**
 * T93 (Rev 21) — ⛔ ONE FILE, HANDED FROM THE SCREEN THAT PICKED IT TO THE SCREEN
 * THAT READS IT.
 *
 * Jov: "why does it go to another page when I want to upload something — is it
 * possible to upload it directly here?" It is. The picker opens on the Move in
 * screen now, and the file it returns has to reach the match-and-preview step.
 *
 * ⛔ IT IS DELIBERATELY NOT STORED. Not localStorage, not the demo save: a
 * customer file is somebody's contact list, it can be megabytes, and the whole
 * promise on that screen is that nothing leaves the browser. A module variable
 * lives exactly as long as the tab does and is read once.
 *
 * ⛔ AND IT IS TAKEN, NOT READ. If the owner reloads on the match step the
 * handoff is gone, and that screen still carries its own file input and its
 * sample button — so the fallback is the screen that already worked, not an
 * error. Leaving the value behind would instead reload a file the owner thought
 * they had left.
 */
export type Handoff = { preset: string; text: string; name: string };

let pending: Handoff | null = null;

export function handOff(h: Handoff): void {
  pending = h;
}

/** Returns the waiting file ONCE, and only to the step it was picked for. */
export function takeHandoff(preset: string): Handoff | null {
  if (!pending || pending.preset !== preset) return null;
  const out = pending;
  pending = null;
  return out;
}
