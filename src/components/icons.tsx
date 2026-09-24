import { HugeiconsIcon } from "@hugeicons/react";
import {
  LayoutDashboardIcon,
  UserMultiple02Icon,
  BubbleChatIcon,
  CheckListIcon,
  Settings01Icon,
  Analytics01Icon,
  FunnelIcon,
  SparklesIcon,
  TrophyIcon,
  ActivityIcon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  UserAdd01Icon,
  Upload04Icon,
  Download04Icon,
  Mail01Icon,
  Call02Icon,
  Note01Icon,
  ViewOffSlashIcon,
  ViewIcon,
  Delete02Icon,
  AlarmClockIcon,
  Search01Icon,
  Cancel01Icon,
  Tick02Icon,
  ThumbsUpIcon,
  UserRemove01Icon,
  Link01Icon,
  UserSharingIcon,
  CreditCardIcon,
  Calendar03Icon,
  RefreshIcon,
  Alert02Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";

/**
 * Hugeicons — the same library the real Alloro dashboard uses
 * (@hugeicons/react + @hugeicons/core-free-icons, frontend/package.json).
 *
 * ⛔ The icons are tree-shaken into the single file at build time. Nothing is
 * fetched at runtime, so acceptance A35's zero-network rule still holds.
 *
 * ⛔ ONE WRAPPER. No screen imports an icon library directly — the rule came
 * from v1 and it is the only reason one icon set survives across 25 screens.
 * Acceptance A40a scans the source for a direct `@hugeicons` import outside
 * this file and fails on one. Before Rev 8 (T30) this file carried navigation
 * only; the action names below are what let every button lead with an icon.
 */

const ICONS = {
  // navigation — the four tabs and the rail
  dashboard: LayoutDashboardIcon,
  people: UserMultiple02Icon,
  conversation: BubbleChatIcon,
  needs: CheckListIcon,
  settings: Settings01Icon,
  hub: Analytics01Icon,
  journey: FunnelIcon,
  rankings: TrophyIcon,
  reviews: SparklesIcon,
  website: ActivityIcon,

  // actions — Rev 8, T30. One name per thing the owner can do.
  back: ArrowLeft02Icon,
  forward: ArrowRight02Icon,
  add: UserAdd01Icon,
  movein: Upload04Icon,
  download: Download04Icon,
  mail: Mail01Icon,
  call: Call02Icon,
  note: Note01Icon,
  hide: ViewOffSlashIcon,
  show: ViewIcon,
  erase: Delete02Icon,
  remind: AlarmClockIcon,
  search: Search01Icon,
  close: Cancel01Icon,
  tick: Tick02Icon,
  thanks: ThumbsUpIcon,
  lost: UserRemove01Icon,
  merge: Link01Icon,
  person: UserSharingIcon,
  money: CreditCardIcon,
  date: Calendar03Icon,
  reset: RefreshIcon,
  warn: Alert02Icon,
  run: PlayIcon,
  suggest: SparklesIcon,
  filter: FunnelIcon,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name, size = 18, className,
}: { name: IconName; size?: number; className?: string }) {
  return <HugeiconsIcon icon={ICONS[name]} size={size} className={className} aria-hidden="true" />;
}
