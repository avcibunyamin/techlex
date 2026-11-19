// Pure helpers for the cloze (fill-the-blank) quiz mode.
// No React/store imports, so it can be checked with `npx tsx lib/cloze-quiz.check.ts`.

export const CLOZE_BLANK = '_____';
export const CLOZE_DISTRACTOR_COUNT = 3;

/** Minimal shape needed to build a multiple-choice question (cloze and listen modes). */
export interface ChoiceTerm {
  id: string;
  term: string;
  pos?: string;
}

export interface ClozeTerm extends ChoiceTerm {
  translations: { en: { example: string } };
}

export interface ChoiceOptions {
  options: ClozeOption[];
  correctIndex: number;
}

export interface ClozeMask {
  masked: string;
  /** Surface form of the first match as written in the sentence, e.g. "Invoices". */
  answerForm: string;
}

export interface ClozeOption {
  id: string;
  term: string;
}

export interface ClozeQuestion {
  termId: string;
  masked: string;
  answerForm: string;
  options: ClozeOption[];
  correctIndex: number;
}

const VOWELS = 'aeiou';

// Lowercases one UTF-16 unit without changing the string length.
function normalizeUnit(unit: string): string {
  if (unit === '’' || unit === '‘') return "'";
  if (unit === 'İ' || unit === 'I') return 'i';
  const lower = unit.toLowerCase();
  return lower.length === 1 ? lower : unit;
}

function normalize(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += normalizeUnit(text[i]);
  return out;
}

function isLetter(unit: string | undefined): boolean {
  if (!unit) return false;
  return unit.toLowerCase() !== unit.toUpperCase();
}

function isWordChar(unit: string | undefined, nextUnit?: string): boolean {
  if (!unit) return false;
  if (unit >= '0' && unit <= '9') return true;
  if ((unit === "'" || unit === '’' || unit === '‘') && isLetter(nextUnit)) return true;
  return isLetter(unit);
}

function inflectWord(word: string, minLength: number): string[] {
  const w = normalize(word.trim());
  const forms = new Set<string>([w]);
  // Very short or non-ASCII words are matched only in their base form to avoid false hits ("be" → "bed").
  if (w.length < minLength || !/^[a-z]+$/.test(w)) return [...forms];

  const last = w[w.length - 1];
  const prev = w[w.length - 2];

  if (/(s|x|z|ch|sh)$/.test(w)) forms.add(`${w}es`);
  else forms.add(`${w}s`);
  if (last === 'o') forms.add(`${w}es`);

  if (last === 'y' && !VOWELS.includes(prev)) {
    const stem = w.slice(0, -1);
    forms.add(`${stem}ies`);
    forms.add(`${stem}ied`);
    forms.add(`${w}ing`);
  } else if (last === 'e') {
    forms.add(`${w}d`);
    if (w.endsWith('ie')) forms.add(`${w.slice(0, -2)}ying`);
    else if (w.endsWith('ee')) forms.add(`${w}ing`);
    else forms.add(`${w.slice(0, -1)}ing`);
  } else {
    forms.add(`${w}ed`);
    forms.add(`${w}ing`);
    // Consonant-vowel-consonant ending: stop → stopped, stopping; "qu" counts as a consonant onset.
    const beforePrev = w[w.length - 3];
    const isConsonantBeforeVowel =
      beforePrev !== undefined &&
      (!VOWELS.includes(beforePrev) || (beforePrev === 'u' && w[w.length - 4] === 'q'));
    if (!VOWELS.includes(last) && !'wxy'.includes(last) && VOWELS.includes(prev) && isConsonantBeforeVowel) {
      forms.add(`${w}${last}ed`);
      forms.add(`${w}${last}ing`);
      if (last === 'z' || last === 's') forms.add(`${w}${last}es`);
    }
  }
  return [...forms];
}

/** Base form plus simple regular inflections (s/es/ies, d/ed/ied, ing, e-drop, CVC doubling). */
export function inflectedForms(word: string): string[] {
  return inflectWord(word, 3);
}

/** Forms of a (possibly multi-word or hyphenated) term; only the last part is inflected. */
export function termForms(term: string): string[] {
  const words = normalize(term.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const head = words.slice(0, -1).join(' ');
  const lastWord = words[words.length - 1];
  const hyphenIdx = lastWord.lastIndexOf('-');
  const lastWordForms =
    hyphenIdx > 0 && hyphenIdx < lastWord.length - 1
      ? inflectWord(lastWord.slice(hyphenIdx + 1), 2).map(
          (form) => `${lastWord.slice(0, hyphenIdx)}-${form}`,
        )
      : inflectedForms(lastWord);
  return lastWordForms
    .map((form) => (head ? `${head} ${form}` : form))
    .sort((a, b) => b.length - a.length);
}

/**
 * Replaces every occurrence of the term (or a simple inflected form) in the sentence with
 * CLOZE_BLANK. Case-insensitive and word-boundary aware ("cat" does not match "category").
 * Returns null when the term does not occur.
 */
export function maskTermInSentence(sentence: string, term: string): ClozeMask | null {
  if (!sentence || !term.trim()) return null;
  const forms = termForms(term);
  const lower = normalize(sentence);

  let masked = '';
  let answerForm: string | null = null;
  let i = 0;
  while (i < sentence.length) {
    let matched = '';
    if (!isWordChar(sentence[i - 1], sentence[i])) {
      for (const form of forms) {
        if (
          lower.startsWith(form, i) &&
          !isWordChar(sentence[i + form.length], sentence[i + form.length + 1])
        ) {
          matched = form;
          break;
        }
      }
    }
    if (matched) {
      if (answerForm === null) answerForm = sentence.slice(i, i + matched.length);
      masked += CLOZE_BLANK;
      i += matched.length;
    } else {
      masked += sentence[i];
      i += 1;
    }
  }
  return answerForm === null ? null : { masked, answerForm };
}

/** Deterministic PRNG (mulberry32) returning floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Builds 4 shuffled options: the target plus 3 distractors.
 * Distractors come only from `packTerms` (the target's own pack), have distinct spellings,
 * and prefer the target's part of speech. Returns null when the pack has fewer than 3
 * usable distractors.
 */
export function buildChoiceOptions(
  target: ChoiceTerm,
  packTerms: readonly ChoiceTerm[],
  seed: number,
): ChoiceOptions | null {
  const targetKey = normalize(target.term.trim());
  if (!targetKey) return null;
  const seenKeys = new Set<string>([targetKey]);
  const seenIds = new Set<string>([target.id]);
  const candidates: ChoiceTerm[] = [];
  for (const t of packTerms) {
    const key = normalize(t.term.trim());
    if (!t.id || seenIds.has(t.id) || !key || seenKeys.has(key)) continue;
    seenIds.add(t.id);
    seenKeys.add(key);
    candidates.push(t);
  }
  if (candidates.length < CLOZE_DISTRACTOR_COUNT) return null;

  const rng = createRng(seed);
  const shuffled = seededShuffle(candidates, rng);
  const samePos = target.pos ? shuffled.filter((t) => t.pos === target.pos) : [];
  const samePosIds = new Set(samePos.map((t) => t.id));
  const distractors = [...samePos, ...shuffled.filter((t) => !samePosIds.has(t.id))]
    .slice(0, CLOZE_DISTRACTOR_COUNT);

  const options = seededShuffle([target, ...distractors], rng)
    .map((t): ClozeOption => ({ id: t.id, term: t.term }));
  return { options, correctIndex: options.findIndex((o) => o.id === target.id) };
}

/**
 * Builds a 4-option cloze question from the term's English example (options from
 * `buildChoiceOptions`). Returns null when the example does not contain the term or the
 * pack has fewer than 3 usable distractors.
 */
export function buildClozeQuestion(
  target: ClozeTerm,
  packTerms: readonly ClozeTerm[],
  seed: number,
): ClozeQuestion | null {
  const mask = maskTermInSentence(target.translations?.en?.example ?? '', target.term);
  if (!mask) return null;
  const choice = buildChoiceOptions(target, packTerms, seed);
  if (!choice) return null;
  return { termId: target.id, masked: mask.masked, answerForm: mask.answerForm, ...choice };
}
