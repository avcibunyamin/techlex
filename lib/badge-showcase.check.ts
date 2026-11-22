import { BADGES } from '../constants/badges';
import { buildBadgeShowcase, BadgeShowcaseSource } from './badge-showcase';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 1. No earned badges: returns all default badges in definition order with earned = false.
{
  const list = buildBadgeShowcase([]);
  assert(list.length === BADGES.length, 'empty earnedIds should return all badges');
  assert(list.every((b) => !b.earned), 'all badges should be marked locked when earnedIds is empty');
  assert(
    list.map((b) => b.id).join(',') === BADGES.map((b) => b.id).join(','),
    'locked badges should preserve BADGES definition order'
  );
}

// 2. Subset of earned badges passed out of definition order: earned first in BADGES definition order, then locked.
{
  const list = buildBadgeShowcase(['night-owl', 'streak-7', 'swipes-100']);
  const earnedPart = list.filter((b) => b.earned);
  const lockedPart = list.filter((b) => !b.earned);
  assert(earnedPart.length === 3, 'should have 3 earned badges');
  assert(
    earnedPart.map((b) => b.id).join(',') === 'streak-7,swipes-100,night-owl',
    'earned badges should appear first in BADGES definition order'
  );
  assert(
    list.slice(0, 3).every((b) => b.earned) && list.slice(3).every((b) => !b.earned),
    'all earned badges should precede all locked badges'
  );
  assert(
    lockedPart[0]?.id === 'streak-3' && lockedPart[lockedPart.length - 1]?.id === 'early-bird',
    'locked badges should maintain relative definition order'
  );
}

// 3. All badges earned: all items marked earned in BADGES definition order.
{
  const allIds = BADGES.map((b) => b.id).reverse();
  const list = buildBadgeShowcase(allIds);
  assert(list.length === BADGES.length, 'all earned should return full badge count');
  assert(list.every((b) => b.earned), 'every badge should have earned = true');
  assert(
    list.map((b) => b.id).join(',') === BADGES.map((b) => b.id).join(','),
    'all earned badges should still follow BADGES definition order'
  );
}

// 4. Duplicate and unknown earned IDs are ignored and item fields (id, icon, xpReward, display) are preserved.
{
  const list = buildBadgeShowcase(['dom-bender', 'legacy-unknown-id', 'dom-bender']);
  assert(list.length === BADGES.length, 'unknown or duplicate earned IDs must not change total count');
  assert(list[0].id === 'dom-bender' && list[0].earned === true, 'dom-bender should be first and earned');
  assert(list[0].icon === 'Code' && list[0].xpReward === 200, 'icon and xpReward should match badge definition');
  assert(
    list[0].display.cond === 'tag' && list[0].display.count === 50 && list[0].display.tag === 'frontend',
    'display metadata for dom-bender should have cond=tag, count=50, tag=frontend'
  );
  assert(list.filter((b) => b.earned).length === 1, 'only known unique badge should be marked earned');
}

// 5. Custom badge source list works purely without relying on global BADGES.
{
  const customBadges: BadgeShowcaseSource[] = [
    { id: 'custom-a', icon: 'Sun', xpReward: 10, display: { cond: 'earlyBird' } },
    { id: 'custom-b', icon: 'UnknownIcon', xpReward: 25, display: { cond: 'streak', count: 5 } },
  ];
  const list = buildBadgeShowcase(['custom-b'], customBadges);
  assert(list.length === 2, 'custom badge list should return 2 items');
  assert(list[0].id === 'custom-b' && list[0].earned === true, 'custom-b should be ordered first');
  assert(list[1].id === 'custom-a' && list[1].earned === false, 'custom-a should be ordered second');
}

console.log('badge-showcase: 5 checks passed');
