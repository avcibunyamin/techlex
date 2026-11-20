// Run: npx tsx lib/session-summary.check.ts
import { summarizeSession, SessionSwipe } from './session-summary';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`session-summary: FAILED ${name}`);
  passed++;
}

const r = (termId: string): SessionSwipe => ({ termId, direction: 'right' });
const l = (termId: string): SessionSwipe => ({ termId, direction: 'left' });

// 1. Empty session
{
  const s = summarizeSession([], 10);
  check('empty', s.seenIds.length === 0 && s.knownCount === 0 && s.reviewCount === 0 && s.xpEarned === 0);
}

// 2. All swiped right
{
  const s = summarizeSession([r('a'), r('b'), r('c'), r('d')], 10);
  check('all right', s.seenIds.join() === 'a,b,c,d' && s.knownCount === 4 && s.reviewCount === 0 && s.xpEarned === 40);
}

// 3. Mixed
{
  const s = summarizeSession([r('a'), l('b'), r('c'), l('d'), r('e')], 5);
  check('mixed', s.seenIds.length === 5 && s.knownCount === 3 && s.reviewCount === 2 && s.xpEarned === 25);
}

// 4. Re-fed card is not counted twice as a word (but each swipe still earns XP)
{
  const s = summarizeSession([l('a'), r('b'), r('a')], 10);
  check('refed once', s.seenIds.join() === 'a,b' && s.knownCount === 1 && s.reviewCount === 1 && s.xpEarned === 30);
}

// 5. Card swiped left twice in a row (fed back twice) still counts once
{
  const s = summarizeSession([l('a'), l('a'), r('a')], 10);
  check('refed twice', s.seenIds.length === 1 && s.reviewCount === 1 && s.knownCount === 0);
}

// 6. Practice mode passes 0 XP per swipe
{
  const s = summarizeSession([r('a'), l('b')], 0);
  check('practice xp', s.xpEarned === 0 && s.seenIds.length === 2);
}

console.log(`session-summary: ${passed} checks passed`);
