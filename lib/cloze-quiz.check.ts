// Run: npx tsx lib/cloze-quiz.check.ts
// Dependency-free checks for lib/cloze-quiz.ts; exits with a thrown error on the first failure.

import {
  buildChoiceOptions,
  buildClozeQuestion,
  inflectedForms,
  maskTermInSentence,
  termForms,
  CLOZE_BLANK,
  type ClozeTerm,
} from './cloze-quiz';

function card(id: string, term: string, example = '', pos?: string): ClozeTerm {
  return { id, term, pos, translations: { en: { example } } };
}

function expectEqual(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectMasked(sentence: string, term: string, expected: string, answerForm: string): void {
  const mask = maskTermInSentence(sentence, term);
  if (!mask) throw new Error(`"${term}" was not found in "${sentence}"`);
  expectEqual(mask.masked, expected, `masked "${term}"`);
  expectEqual(mask.answerForm, answerForm, `answerForm "${term}"`);
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const B = CLOZE_BLANK;

check('matching is case-insensitive and keeps the original surface form', () => {
  expectMasked('Invoice totals are due today.', 'invoice', `${B} totals are due today.`, 'Invoice');
  expectMasked('Send the INVOICE now.', 'Invoice', `Send the ${B} now.`, 'INVOICE');
});

check('word boundaries are respected ("cat" does not match "category")', () => {
  expectEqual(maskTermInSentence('Pick a category first.', 'cat'), null, 'cat in category');
  expectEqual(maskTermInSentence('The bobcat ran away.', 'cat'), null, 'cat in bobcat');
  expectMasked('The cat, not the category.', 'cat', `The ${B}, not the category.`, 'cat');
});

check('plural forms are matched (s, es, ies)', () => {
  expectMasked('All invoices were paid.', 'invoice', `All ${B} were paid.`, 'invoices');
  expectMasked('Two boxes arrived.', 'box', `Two ${B} arrived.`, 'boxes');
  expectMasked('Many companies hire in spring.', 'company', `Many ${B} hire in spring.`, 'companies');
});

check('past tense and -ing forms are matched (ed, e-drop, doubling)', () => {
  expectMasked('The manager approved it.', 'approve', `The manager ${B} it.`, 'approved');
  expectMasked('She is managing the team.', 'manage', `She is ${B} the team.`, 'managing');
  expectMasked('They delivered on time.', 'deliver', `They ${B} on time.`, 'delivered');
  expectMasked('The machine stopped.', 'stop', `The machine ${B}.`, 'stopped');
});

check('every occurrence is masked and multi-word terms inflect the last word', () => {
  expectMasked('A refund, then another refund.', 'refund', `A ${B}, then another ${B}.`, 'refund');
  expectMasked('Both data centers are online.', 'data center', `Both ${B} are online.`, 'data centers');
});

check('no match returns null (also for empty input)', () => {
  expectEqual(maskTermInSentence('Nothing to see here.', 'invoice'), null, 'absent term');
  expectEqual(maskTermInSentence('', 'invoice'), null, 'empty sentence');
  expectEqual(maskTermInSentence('Some text.', '  '), null, 'empty term');
  const target = card('p-1', 'invoice', 'No match in this sentence.');
  const pack = [target, card('p-2', 'refund'), card('p-3', 'receipt'), card('p-4', 'budget')];
  expectEqual(buildClozeQuestion(target, pack, 1), null, 'question without match');
});

const PACK: ClozeTerm[] = [
  card('p-1', 'invoice', 'Please pay the invoice by Friday.', 'noun'),
  card('p-2', 'refund', '', 'noun'),
  card('p-3', 'receipt', '', 'noun'),
  card('p-4', 'approve', '', 'verb'),
  card('p-5', 'budget', '', 'noun'),
  card('p-6', 'deliver', '', 'verb'),
  card('p-7', 'Invoice', '', 'noun'), // same spelling as the target, must never be an option
  card('p-8', 'refund', '', 'noun'), // duplicate spelling of p-2
];
const OTHER_PACK: ClozeTerm[] = [card('o-1', 'firewall', '', 'noun'), card('o-2', 'router', '', 'noun')];

check('4 options: the answer plus 3 distinct distractors from the same pack', () => {
  for (let seed = 0; seed < 50; seed++) {
    const q = buildClozeQuestion(PACK[0], PACK, seed);
    if (!q) throw new Error(`seed ${seed}: question is null`);
    expectEqual(q.options.length, 4, 'option count');
    expectEqual(q.options[q.correctIndex]?.id, 'p-1', 'correctIndex points to the answer');
    expectEqual(q.masked, `Please pay the ${B} by Friday.`, 'masked sentence');
    const spellings = new Set(q.options.map((o) => o.term.toLowerCase()));
    expectEqual(spellings.size, 4, `seed ${seed}: distinct spellings`);
    const packIds = new Set(PACK.map((t) => t.id));
    for (const o of q.options) {
      if (!packIds.has(o.id)) throw new Error(`seed ${seed}: option ${o.id} is not from the pack`);
      if (OTHER_PACK.some((t) => t.id === o.id)) throw new Error(`seed ${seed}: option from another pack`);
    }
    if (q.options.some((o) => o.id === 'p-7')) throw new Error(`seed ${seed}: same-spelling term used`);
  }
});

check('distractors prefer the same part of speech when enough exist', () => {
  for (let seed = 0; seed < 50; seed++) {
    const q = buildClozeQuestion(PACK[0], PACK, seed);
    if (!q) throw new Error(`seed ${seed}: question is null`);
    const posById = new Map(PACK.map((t) => [t.id, t.pos]));
    for (const o of q.options) {
      expectEqual(posById.get(o.id), 'noun', `seed ${seed}: pos of ${o.term}`);
    }
  }
});

check('the same seed gives the same question; different seeds vary', () => {
  const a = JSON.stringify(buildClozeQuestion(PACK[0], PACK, 42));
  const b = JSON.stringify(buildClozeQuestion(PACK[0], PACK, 42));
  expectEqual(a, b, 'same seed');
  const variants = new Set<string>();
  for (let seed = 0; seed < 20; seed++) {
    variants.add(JSON.stringify(buildClozeQuestion(PACK[0], PACK, seed)?.options));
  }
  if (variants.size < 2) throw new Error('different seeds always produced the same options');
});

check('fewer than 3 usable distractors returns null', () => {
  const small = [PACK[0], card('p-2', 'refund'), card('p-7', 'invoice'), card('p-8', 'refund')];
  expectEqual(buildClozeQuestion(PACK[0], small, 1), null, 'too few distractors');
});

check('contractions with ASCII or smart apostrophes are not split at the apostrophe', () => {
  expectMasked(
    "They can't wait, so help if you can.",
    'can',
    `They can't wait, so help if you ${B}.`,
    'can',
  );
  expectMasked(
    'They can’t wait, so help if you can.',
    'can',
    `They can’t wait, so help if you ${B}.`,
    'can',
  );
  expectEqual(maskTermInSentence("They can't wait.", 'can'), null, 'contraction only');
});

check('Turkish uppercase İ and I normalize to i in masking and option deduplication', () => {
  expectMasked('İnvoice totals are due today.', 'invoice', `${B} totals are due today.`, 'İnvoice');
  expectMasked('Invoice totals are due today.', 'İnvoice', `${B} totals are due today.`, 'Invoice');
  const pool = [
    card('t-1', 'invoice'),
    card('t-2', 'İnvoice'),
    card('t-3', 'refund'),
    card('t-4', 'receipt'),
  ];
  expectEqual(buildChoiceOptions(pool[0], pool, 1), null, 'İnvoice deduplicated against invoice');
});

check('qu- onset counts as consonant for CVC doubling (equip, quiz)', () => {
  const equipForms = inflectedForms('equip');
  if (!equipForms.includes('equipped') || !equipForms.includes('equipping')) {
    throw new Error(`equip forms missing equipped/equipping: ${equipForms.join(',')}`);
  }
  const quizForms = inflectedForms('quiz');
  if (!quizForms.includes('quizzes') || !quizForms.includes('quizzed') || !quizForms.includes('quizzing')) {
    throw new Error(`quiz forms missing quizzes/quizzed/quizzing: ${quizForms.join(',')}`);
  }
  expectMasked('The lab is equipped with sensors.', 'equip', `The lab is ${B} with sensors.`, 'equipped');
  expectMasked('Short quizzes reinforce memory.', 'quiz', `Short ${B} reinforce memory.`, 'quizzes');
});

check('hyphenated terms inflect the final segment (follow-up → follow-ups)', () => {
  if (!termForms('follow-up').includes('follow-ups')) {
    throw new Error(`follow-up forms missing follow-ups: ${termForms('follow-up').join(',')}`);
  }
  expectMasked(
    'Schedule two follow-ups next week.',
    'follow-up',
    `Schedule two ${B} next week.`,
    'follow-ups',
  );
});

check('buildChoiceOptions enforces unique distractor IDs and rejects empty target term', () => {
  expectEqual(buildChoiceOptions(card('p-1', ''), PACK, 1), null, 'empty target term');
  expectEqual(buildChoiceOptions(card('p-1', '   '), PACK, 1), null, 'whitespace target term');
  const dupIdPool = [
    card('p-1', 'invoice', '', 'noun'),
    card('dup', 'refund', '', 'noun'),
    card('dup', 'reimburse', '', 'verb'),
    card('p-3', 'receipt', '', 'noun'),
  ];
  expectEqual(buildChoiceOptions(dupIdPool[0], dupIdPool, 1), null, 'duplicate distractor id skipped');
  const validPool = [...dupIdPool, card('p-4', 'budget', '', 'noun')];
  const choice = buildChoiceOptions(validPool[0], validPool, 1);
  if (!choice) throw new Error('expected valid choice options');
  expectEqual(new Set(choice.options.map((o) => o.id)).size, 4, '4 unique option ids');
});

console.log(`cloze-quiz: ${passed} checks passed`);
