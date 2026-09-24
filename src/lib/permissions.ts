import type { Ui } from "./ui-context";

/**
 * T110 (Rev 29) — ⛔ ONE RULE FOR WHO MAY SEE MONEY.
 *
 * The review found Luis — staff — reading "$6,240 quoted" and "$5,115 in the
 * last 12 months" on Needs you, and "$5,115" on a Dashboard card, while the Team
 * page promises him "No money, no export". The Dashboard's money TILE was
 * already hidden, and so was the People table's money column.
 *
 * ⛔ THAT IS THE SHAPE OF THE BUG, AND IT IS WORTH MORE THAN THE BUG. Every
 * screen hid money ON ITS OWN — `viewer !== "staff"` written out four times in
 * four files — so the rule was only as good as the memory of whoever added the
 * next screen. Two were missed. A promise kept in four places is a promise
 * waiting to be broken in a fifth.
 *
 * ⛔ AND A7 PASSED THE WHOLE TIME. It asked whether the People table had money
 * columns, whether the Email button was gone and whether Download was gone —
 * the three places somebody had thought of. A78 walks every route and fails on
 * any dollar sign at all.
 *
 * So: one function, and money is stripped where the STRINGS are built rather
 * than hidden where they are drawn. A component cannot un-say "$6,240 quoted"
 * once that sentence exists.
 */
export function canSeeMoney(viewer: Ui["viewer"]): boolean {
  return viewer !== "staff";
}
