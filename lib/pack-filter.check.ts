// Run: npx tsx lib/pack-filter.check.ts
// Dependency-free checks for lib/pack-filter.ts; exits with a thrown error on the first failure.

import {
  countPackFilters,
  filterPackTerms,
  foldForSearch,
  isStruggling,
  wrongCount,
  type PackFilterTerm,
  type PackProgressMap,
} from './pack-filter';

function word(id: string, term: string, tr: string, en: string, rank?: number, order = 0): PackFilterTerm {
  return {
    id,
    term,
    translations: { tr: { definition: tr }, en: { definition: en } },
    order,
    rank,
  };
}

function ids(list: PackFilterTerm[]): string {
  return list.map((t) => t.id).join(',');
}

function expectEqual(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const WORDS: PackFilterTerm[] = [
  word('w3', 'issue', 'Sorun; mesele.', 'A problem or topic.', 3),
  word('w1', 'business', 'İş; ticari faaliyet.', 'Commercial activity.', 1),
  word('w2', 'fight', 'Kavga; dövüşmek.', 'A violent struggle.', 2),
  word('w4', 'light', 'Işık.', 'Brightness that lets you see.', 4),
  word('w5', 'change', 'Değiştirmek; başkalaştırmak.', 'To make different.', 5),
];

const PROGRESS: PackProgressMap = {
  w1: { box: 1, timesSeen: 3, timesCorrect: 1 }, // 2 wrong, box 1 -> struggling
  w2: { box: 1, timesSeen: 1, timesCorrect: 0 }, // 1 wrong, box 1 -> not struggling
  w3: { box: 3, timesSeen: 4, timesCorrect: 2 }, // 2 wrong but box 3 -> not struggling
  w4: { box: 2, timesSeen: 1, timesCorrect: 1 },
  // w5 has no progress -> new
};

check('Turkish letters fold case- and dotless-i-insensitively', () => {
  expectEqual(foldForSearch('İŞ'), 'is', 'İŞ');
  expectEqual(foldForSearch('ışık'), 'isik', 'ışık');
  expectEqual(foldForSearch('  DEĞİŞİKLİK  '), 'degisiklik', 'DEĞİŞİKLİK');
  expectEqual(foldForSearch('Çöğüş'), 'cogus', 'Çöğüş');
});

check('search with Turkish letters matches TR definitions in any case', () => {
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'IŞIK' })), 'w4', 'IŞIK');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'ISIK' })), 'w4', 'ASCII ISIK');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'TİCARİ' })), 'w1', 'TİCARİ');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'degis' })), 'w5', 'ASCII degis');
});

check('search matches the English term and the EN definition', () => {
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'FIGHT' })), 'w2', 'term');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'commercial' })), 'w1', 'EN definition');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'violent struggle' })), 'w2', 'two tokens');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'violent brightness' })), '', 'tokens are ANDed');
});

check('empty or blank search returns every word in rank order', () => {
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: '' })), 'w1,w2,w3,w4,w5', 'empty');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: '   ' })), 'w1,w2,w3,w4,w5', 'blank');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS)), 'w1,w2,w3,w4,w5', 'no options');
});

check('box filter keeps only words in that Leitner box', () => {
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { filter: 1 })), 'w1,w2', 'box 1');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { filter: 2 })), 'w4', 'box 2');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { filter: 5 })), '', 'box 5');
});

check('"new" means no progress record', () => {
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { filter: 'new' })), 'w5', 'new');
  expectEqual(ids(filterPackTerms(WORDS, {}, { filter: 'new' })), 'w1,w2,w3,w4,w5', 'all new without progress');
});

check('struggling = at least two wrong answers and back in box 1', () => {
  expectEqual(wrongCount(PROGRESS.w1), 2, 'w1 wrong');
  expectEqual(wrongCount(undefined), 0, 'no progress');
  expectEqual(wrongCount({ box: 1, timesSeen: 1, timesCorrect: 3 }), 0, 'clamped');
  expectEqual(isStruggling(PROGRESS.w1), true, 'w1');
  expectEqual(isStruggling(PROGRESS.w2), false, 'w2 one miss');
  expectEqual(isStruggling(PROGRESS.w3), false, 'w3 not in box 1');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { filter: 'struggling' })), 'w1', 'filter');
});

check('sort by rank, then order when rank is missing, then id; input untouched', () => {
  const list = [
    word('b', 'b', '', '', undefined, 2),
    word('c', 'c', '', '', 2),
    word('a', 'a', '', '', undefined, 2),
    word('d', 'd', '', '', 1),
  ];
  expectEqual(ids(filterPackTerms(list, {})), 'd,a,b,c', 'sorted');
  expectEqual(ids(list), 'b,c,a,d', 'input not mutated');
});

check('filter and search combine; counts follow the current search', () => {
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'fight', filter: 1 })), 'w2', 'combined');
  expectEqual(ids(filterPackTerms(WORDS, PROGRESS, { query: 'fight', filter: 2 })), '', 'combined, other box');
  const all = countPackFilters(WORDS, PROGRESS);
  expectEqual(all.all, 5, 'all');
  expectEqual(all['1'], 2, 'box 1');
  expectEqual(all['3'], 1, 'box 3');
  expectEqual(all.new, 1, 'new');
  expectEqual(all.struggling, 1, 'struggling');
  const searched = countPackFilters(WORDS, PROGRESS, 'ışık');
  expectEqual(searched.all, 1, 'searched all');
  expectEqual(searched['2'], 1, 'searched box 2');
  expectEqual(searched['1'], 0, 'searched box 1');
});

console.log(`pack-filter: ${passed} checks passed`);
