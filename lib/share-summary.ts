// Pure progress summary text for sharing. No React, no i18next, no store:
// the share text is plain data, so its phrases live here (one table per app language)
// and the function stays deterministic and checkable with `npx tsx`.

import type { Language } from '../types';

export const SHARE_SUMMARY_MAX_LENGTH = 280;
export const SHARE_SUMMARY_TOP_PACKS = 3;

export interface ShareSummaryPack {
  id: string;
  title: string;
  learned: number;
  total: number;
}

export interface ShareSummaryInput {
  language: Language | string;
  learnedCount: number;
  streak: number;
  xp: number;
  badgeCount: number;
  packs: ShareSummaryPack[];
}

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

interface SummaryPhrases {
  header: string;
  learned: PluralForms;
  streak: PluralForms;
  xp: string;
  badges: PluralForms;
  topPacks: string;
  starter: string;
  sep: string;
  end: string;
}

// Minimal CLDR cardinal rules for integers; Hermes has no Intl.PluralRules.
function pluralCategory(language: Language, n: number): PluralCategory {
  const mod10 = n % 10;
  const mod100 = n % 100;
  switch (language) {
    case 'en':
    case 'de':
    case 'es':
      return n === 1 ? 'one' : 'other';
    case 'fr':
    case 'pt':
      return n === 0 || n === 1 ? 'one' : 'other';
    case 'ru':
      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
      return 'many';
    case 'ar':
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      if (mod100 >= 3 && mod100 <= 10) return 'few';
      if (mod100 >= 11 && mod100 <= 99) return 'many';
      return 'other';
    default:
      return 'other';
  }
}

const PHRASES: Record<Language, SummaryPhrases> = {
  en: {
    header: 'My TechLex progress:',
    learned: { one: '{n} word learned', other: '{n} words learned' },
    streak: { other: '{n}-day streak' },
    xp: '{n} XP',
    badges: { one: '{n} badge', other: '{n} badges' },
    topPacks: 'Top packs:',
    starter: 'I just started learning words with TechLex.',
    sep: ', ',
    end: '.',
  },
  tr: {
    header: 'TechLex ilerlemem:',
    learned: { other: '{n} kelime öğrendim' },
    streak: { other: '{n} günlük seri' },
    xp: '{n} XP',
    badges: { other: '{n} rozet' },
    topPacks: 'En çok ilerlediğim paketler:',
    starter: 'TechLex ile kelime öğrenmeye yeni başladım.',
    sep: ', ',
    end: '.',
  },
  de: {
    header: 'Mein TechLex-Fortschritt:',
    learned: { one: '{n} Wort gelernt', other: '{n} Wörter gelernt' },
    streak: { one: '{n} Tag in Folge', other: '{n} Tage in Folge' },
    xp: '{n} XP',
    badges: { other: '{n} Abzeichen' },
    topPacks: 'Top-Pakete:',
    starter: 'Ich habe gerade angefangen, mit TechLex Wörter zu lernen.',
    sep: ', ',
    end: '.',
  },
  es: {
    header: 'Mi progreso en TechLex:',
    learned: { one: '{n} palabra aprendida', other: '{n} palabras aprendidas' },
    streak: { one: 'racha de {n} día', other: 'racha de {n} días' },
    xp: '{n} XP',
    badges: { one: '{n} insignia', other: '{n} insignias' },
    topPacks: 'Paquetes destacados:',
    starter: 'Acabo de empezar a aprender palabras con TechLex.',
    sep: ', ',
    end: '.',
  },
  fr: {
    header: 'Ma progression sur TechLex :',
    learned: { one: '{n} mot appris', other: '{n} mots appris' },
    streak: { one: 'série de {n} jour', other: 'série de {n} jours' },
    xp: '{n} XP',
    badges: { one: '{n} badge', other: '{n} badges' },
    topPacks: 'Meilleurs packs :',
    starter: 'Je viens de commencer à apprendre des mots avec TechLex.',
    sep: ', ',
    end: '.',
  },
  pt: {
    header: 'Meu progresso no TechLex:',
    learned: { one: '{n} palavra aprendida', other: '{n} palavras aprendidas' },
    streak: { one: 'sequência de {n} dia', other: 'sequência de {n} dias' },
    xp: '{n} XP',
    badges: { one: '{n} medalha', other: '{n} medalhas' },
    topPacks: 'Pacotes em destaque:',
    starter: 'Acabei de começar a aprender palavras com o TechLex.',
    sep: ', ',
    end: '.',
  },
  ru: {
    header: 'Мой прогресс в TechLex:',
    learned: { one: 'выучено {n} слово', few: 'выучено {n} слова', other: 'выучено {n} слов' },
    streak: { one: 'серия {n} день', few: 'серия {n} дня', other: 'серия {n} дней' },
    xp: '{n} XP',
    badges: { one: '{n} значок', few: '{n} значка', other: '{n} значков' },
    topPacks: 'Лучшие наборы:',
    starter: 'Только начинаю учить слова с TechLex.',
    sep: ', ',
    end: '.',
  },
  // "Label: number" wording avoids Arabic noun-number agreement.
  ar: {
    header: 'تقدمي في TechLex:',
    learned: { other: 'الكلمات المتعلَّمة: {n}' },
    streak: { other: 'أيام السلسلة: {n}' },
    xp: '{n} XP',
    badges: { other: 'الشارات: {n}' },
    topPacks: 'أكثر الحزم تقدمًا:',
    starter: 'بدأت للتو تعلّم الكلمات مع TechLex.',
    sep: '، ',
    end: '.',
  },
  ja: {
    header: 'TechLexの学習状況：',
    learned: { other: '覚えた単語{n}語' },
    streak: { other: '{n}日連続' },
    xp: '{n} XP',
    badges: { other: 'バッジ{n}個' },
    topPacks: '進んでいるパック：',
    starter: 'TechLexで単語の学習を始めたばかりです。',
    sep: '、',
    end: '。',
  },
  ko: {
    header: '나의 TechLex 학습 현황:',
    learned: { other: '외운 단어 {n}개' },
    streak: { other: '{n}일 연속' },
    xp: '{n} XP',
    badges: { other: '배지 {n}개' },
    topPacks: '가장 많이 진행한 팩:',
    starter: 'TechLex로 단어 공부를 막 시작했어요.',
    sep: ', ',
    end: '.',
  },
};

function resolveLanguage(language: string): Language {
  return (Object.prototype.hasOwnProperty.call(PHRASES, language) ? language : 'en') as Language;
}

function count(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function plural(language: Language, forms: PluralForms, n: number): string {
  const template = forms[pluralCategory(language, n)] ?? forms.other;
  return template.replace('{n}', String(n));
}

/** Packs with at least one learned word: most learned first, then highest share, then id. */
export function rankSharePacks(packs: ShareSummaryPack[], limit = SHARE_SUMMARY_TOP_PACKS): ShareSummaryPack[] {
  const learnedOf = (p: ShareSummaryPack) => count(p.learned);
  const ratio = (p: ShareSummaryPack) => {
    const total = count(p.total);
    return total > 0 ? learnedOf(p) / total : 0;
  };
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : SHARE_SUMMARY_TOP_PACKS;
  return packs
    .filter((p) => learnedOf(p) > 0)
    .slice()
    .sort((a, b) => learnedOf(b) - learnedOf(a) || ratio(b) - ratio(a) || a.id.localeCompare(b.id))
    .slice(0, cap);
}

/**
 * Short, emoji-free summary in the selected language. Never longer than `maxLength`:
 * packs are dropped from the end first, and only then is the text cut with an ellipsis.
 */
export function buildShareSummary(input: ShareSummaryInput, maxLength = SHARE_SUMMARY_MAX_LENGTH): string {
  const language = resolveLanguage(input.language);
  const p = PHRASES[language];
  const learned = count(input.learnedCount);
  const streak = count(input.streak);
  const xp = count(input.xp);
  const badges = count(input.badgeCount);
  const rankedPacks = rankSharePacks(input.packs);

  let text: string;
  if (learned === 0 && xp === 0 && streak === 0 && badges === 0 && rankedPacks.length === 0) {
    text = p.starter;
  } else {
    const stats = [plural(language, p.learned, learned)];
    if (streak > 0) stats.push(plural(language, p.streak, streak));
    stats.push(p.xp.replace('{n}', String(xp)));
    if (badges > 0) stats.push(plural(language, p.badges, badges));
    const head = `${p.header} ${stats.join(p.sep)}${p.end}`;

    const packParts = rankedPacks.map((pk) => `${pk.title} ${count(pk.learned)}/${count(pk.total)}`);
    text = head;
    for (let n = packParts.length; n > 0; n--) {
      const candidate = `${head} ${p.topPacks} ${packParts.slice(0, n).join(p.sep)}${p.end}`;
      if (candidate.length <= maxLength) {
        text = candidate;
        break;
      }
    }
  }

  if (text.length > maxLength) {
    text = maxLength > 1 ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text.slice(0, Math.max(0, maxLength));
  }
  return text;
}
