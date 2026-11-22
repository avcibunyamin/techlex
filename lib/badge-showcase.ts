import { BADGES, BadgeDefinition, BadgeDisplay } from '../constants/badges';

export type BadgeShowcaseSource = Pick<
  BadgeDefinition,
  'id' | 'icon' | 'xpReward' | 'display'
>;

export interface BadgeShowcaseItem {
  id: string;
  icon: string;
  xpReward: number;
  earned: boolean;
  display: BadgeDisplay;
}

/**
 * Builds the Profile badge showcase list: earned badges first (in definition order),
 * followed by locked badges (in definition order).
 */
export function buildBadgeShowcase(
  earnedIds: Iterable<string> | null | undefined,
  badges: readonly BadgeShowcaseSource[] = BADGES
): BadgeShowcaseItem[] {
  const earnedSet = new Set<string>(earnedIds ?? []);
  const earnedItems: BadgeShowcaseItem[] = [];
  const lockedItems: BadgeShowcaseItem[] = [];

  for (const badge of badges) {
    const earned = earnedSet.has(badge.id);
    const item: BadgeShowcaseItem = {
      id: badge.id,
      icon: badge.icon,
      xpReward: badge.xpReward,
      earned,
      display: badge.display,
    };
    if (earned) {
      earnedItems.push(item);
    } else {
      lockedItems.push(item);
    }
  }

  return [...earnedItems, ...lockedItems];
}
