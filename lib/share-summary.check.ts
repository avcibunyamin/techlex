// Run: npx tsx lib/share-summary.check.ts
// Dependency-free checks for lib/share-summary.ts; exits with a thrown error on the first failure.

import {
  buildShareSummary,
  rankSharePacks,
  SHARE_SUMMARY_MAX_LENGTH,
  type ShareSummaryInput,
  type ShareSummaryPack,
} from './share-summary';

let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    throw new Error(`share-summary check failed: ${name}\n  ${(err as Error).message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function includes(text: string, part: string) {
  assert(text.includes(part), `expected ${JSON.stringify(part)} in ${JSON.stringify(text)}`);
}

function excludes(text: string, part: string) {
  assert(!text.includes(part), `did not expect ${JSON.stringify(part)} in ${JSON.stringify(text)}`);
}

function pack(id: string, learned: number, total = 1000, title = id): ShareSummaryPack {
  return { id, title, learned, total };
}

function input(over: Partial<ShareSummaryInput> = {}): ShareSummaryInput {
  return { language: 'en', learnedCount: 0, streak: 0, xp: 0, badgeCount: 0, packs: [], ...over };
}

const EMOJI = /\p{Extended_Pictographic}/u;

check('zero progress gives the starter sentence only', () => {
  const en = buildShareSummary(input());
  assert(en === 'I just started learning words with TechLex.', `got ${JSON.stringify(en)}`);
  const tr = buildShareSummary(input({ language: 'tr', packs: [pack('ngsl-1', 0)] }));
  assert(tr === 'TechLex ile kelime öğrenmeye yeni başladım.', `got ${JSON.stringify(tr)}`);
});

check('singular and plural forms (en, ru)', () => {
  const one = buildShareSummary(input({ learnedCount: 1, streak: 1, xp: 10, badgeCount: 1 }));
  assert(
    one === 'My TechLex progress: 1 word learned, 1-day streak, 10 XP, 1 badge.',
    `got ${JSON.stringify(one)}`,
  );
  const many = buildShareSummary(input({ learnedCount: 5, streak: 3, xp: 120, badgeCount: 2 }));
  includes(many, '5 words learned');
  includes(many, '2 badges');
  includes(buildShareSummary(input({ language: 'ru', learnedCount: 21, xp: 1 })), 'выучено 21 слово');
  includes(buildShareSummary(input({ language: 'ru', learnedCount: 3, xp: 1 })), 'выучено 3 слова');
  includes(buildShareSummary(input({ language: 'ru', learnedCount: 11, xp: 1 })), 'выучено 11 слов');
  includes(buildShareSummary(input({ language: 'ru', learnedCount: 25, xp: 1 })), 'выучено 25 слов');
});

check('zero streak and zero badges are left out', () => {
  const text = buildShareSummary(input({ learnedCount: 4, xp: 40 }));
  assert(text === 'My TechLex progress: 4 words learned, 40 XP.', `got ${JSON.stringify(text)}`);
  excludes(text, 'streak');
  excludes(text, 'badge');
});

check('top 3 packs: most learned first, then share, then id; unstarted packs skipped', () => {
  const packs = [
    pack('a', 10, 1000),
    pack('b', 50, 1000),
    pack('c', 10, 100),
    pack('d', 0, 1000),
    pack('e', 30, 957),
  ];
  const ranked = rankSharePacks(packs).map((p) => p.id).join(',');
  assert(ranked === 'b,e,c', `got ${ranked}`);
  const text = buildShareSummary(input({ learnedCount: 100, xp: 1, packs }));
  includes(text, 'Top packs: b 50/1000, e 30/957, c 10/100.');
  excludes(text, ' a 10/1000');
  excludes(text, ' d ');
});

check('language selection, unknown language falls back to English', () => {
  const base = { learnedCount: 2, streak: 2, xp: 20, badgeCount: 0, packs: [pack('ngsl-1', 2, 1000, 'NGSL')] };
  const tr = buildShareSummary(input({ ...base, language: 'tr' }));
  assert(
    tr === 'TechLex ilerlemem: 2 kelime öğrendim, 2 günlük seri, 20 XP. En çok ilerlediğim paketler: NGSL 2/1000.',
    `got ${JSON.stringify(tr)}`,
  );
  includes(buildShareSummary(input({ ...base, language: 'de' })), '2 Wörter gelernt');
  includes(buildShareSummary(input({ ...base, language: 'ja' })), '覚えた単語2語');
  includes(buildShareSummary(input({ ...base, language: 'ar' })), 'الكلمات المتعلَّمة: 2');
  includes(buildShareSummary(input({ ...base, language: 'xx' })), '2 words learned');
});

check('length limit: packs dropped first, then ellipsis; never longer than the cap', () => {
  const long = 'L'.repeat(120);
  const packs = [pack('p1', 30, 1000, long), pack('p2', 20, 1000, long), pack('p3', 10, 1000, long)];
  const text = buildShareSummary(input({ learnedCount: 60, streak: 5, xp: 600, badgeCount: 3, packs }));
  assert(text.length <= SHARE_SUMMARY_MAX_LENGTH, `length ${text.length}`);
  includes(text, `${long} 30/1000`);
  excludes(text, `${long} 20/1000`);
  assert(text.endsWith('.'), 'should end with a full stop, not an ellipsis');

  const tiny = buildShareSummary(input({ learnedCount: 60, xp: 600, packs }), 30);
  assert(tiny.length <= 30, `tiny length ${tiny.length}`);
  assert(tiny.endsWith('…'), `tiny should end with an ellipsis: ${JSON.stringify(tiny)}`);
});

check('no emoji and no invalid numbers in any language', () => {
  const langs = ['tr', 'en', 'de', 'fr', 'es', 'ar', 'ja', 'ko', 'ru', 'pt'];
  for (const language of langs) {
    const text = buildShareSummary(
      input({ language, learnedCount: 12, streak: 4, xp: 340, badgeCount: 2, packs: [pack('x', 12, 1000, 'X')] }),
    );
    assert(!EMOJI.test(text), `${language}: emoji found in ${JSON.stringify(text)}`);
    assert(text.length > 0 && text.length <= SHARE_SUMMARY_MAX_LENGTH, `${language}: bad length`);
  }
  const weird = buildShareSummary(input({ learnedCount: NaN, streak: -3, xp: 7.9, badgeCount: Infinity }));
  excludes(weird, 'NaN');
  excludes(weird, '-3');
  includes(weird, '7 XP');
});

check('rankSharePacks uses integer count() values, defaults non-finite limit, and non-empty packs skip starter', () => {
  const fractional = [
    pack('b', 5.9, 100), // displays as 5/100 (5%)
    pack('a', 5.1, 50),  // displays as 5/50 (10%) -> higher share on integer counts
    pack('c', 0.9, 10),  // count(0.9) === 0 -> skipped
    pack('d', 2, 100),
    pack('e', 1, 100),
  ];
  assert(
    rankSharePacks(fractional).map((p) => p.id).join(',') === 'a,b,d',
    `expected a,b,d, got ${rankSharePacks(fractional).map((p) => p.id).join(',')}`,
  );
  assert(rankSharePacks(fractional, Number.NaN).length === 3, 'NaN limit should use default 3');
  assert(rankSharePacks(fractional, Number.POSITIVE_INFINITY).length === 3, 'Infinity limit should use default 3');

  const withPackOnly = buildShareSummary(
    input({ learnedCount: 0, streak: 0, xp: 0, badgeCount: 0, packs: [pack('ngsl-1', 5, 1000, 'NGSL 1')] }),
  );
  includes(withPackOnly, 'Top packs: NGSL 1 5/1000.');
  excludes(withPackOnly, 'I just started');
});

console.log(`share-summary: ${passed} checks passed`);
