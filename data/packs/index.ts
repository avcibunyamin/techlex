import { Pack, PackSource } from '@/types';

const CC_BY_SA_4_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

const NGSL_SOURCE: PackSource = {
  name: 'New General Service List 1.2 — Browne, C., Culligan, B., and Phillips, J.',
  url: 'https://www.newgeneralservicelist.com/new-general-service-list',
  license: 'CC BY-SA 4.0',
  licenseUrl: CC_BY_SA_4_URL,
};

const NAWL_SOURCE: PackSource = {
  name: 'New Academic Word List 1.2 — Browne, C., Culligan, B., and Phillips, J.',
  url: 'https://www.newgeneralservicelist.com/nawl-new-academic-word-list',
  license: 'CC BY-SA 4.0',
  licenseUrl: CC_BY_SA_4_URL,
};

const BSL_SOURCE: PackSource = {
  name: 'Business Service List 1.20 — Browne, C. and Culligan, B.',
  url: 'https://www.newgeneralservicelist.com/bsl-business-service-list',
  license: 'CC BY-SA 4.0',
  licenseUrl: CC_BY_SA_4_URL,
};

const TSL_SOURCE: PackSource = {
  name: 'TOEIC Service List 1.2 — Browne, C. and Culligan, B.',
  url: 'https://www.newgeneralservicelist.com/toeic-list',
  license: 'CC BY-SA 4.0',
  licenseUrl: CC_BY_SA_4_URL,
};

export const PACKS: Pack[] = [
  {
    id: 'ngsl-1',
    title: {
      tr: 'Genel İngilizce 1–1000',
      en: 'General English 1–1000',
    },
    group: 'english',
    size: 1000,
    source: NGSL_SOURCE,
    file: 'ngsl-1.json',
    load: () => import('./ngsl-1.json'),
  },
  {
    id: 'ngsl-2',
    title: {
      tr: 'Genel İngilizce 1001–2000',
      en: 'General English 1001–2000',
    },
    group: 'english',
    size: 1000,
    source: NGSL_SOURCE,
    file: 'ngsl-2.json',
    load: () => import('./ngsl-2.json'),
  },
  {
    id: 'ngsl-3',
    title: {
      tr: 'Genel İngilizce 2001–2809',
      en: 'General English 2001–2809',
    },
    group: 'english',
    size: 809,
    source: NGSL_SOURCE,
    file: 'ngsl-3.json',
    load: () => import('./ngsl-3.json'),
  },
  {
    id: 'nawl',
    title: {
      tr: 'Akademik İngilizce (NAWL)',
      en: 'Academic English (NAWL)',
    },
    group: 'exam',
    size: 959,
    source: NAWL_SOURCE,
    file: 'nawl.json',
    load: () => import('./nawl.json'),
  },
  {
    id: 'bsl-1',
    title: {
      tr: 'İş İngilizcesi 1–1000',
      en: 'Business English 1–1000',
    },
    group: 'english',
    size: 1000,
    source: BSL_SOURCE,
    file: 'bsl-1.json',
    load: () => import('./bsl-1.json'),
  },
  {
    id: 'bsl-2',
    title: {
      tr: 'İş İngilizcesi 1001–1744',
      en: 'Business English 1001–1744',
    },
    group: 'english',
    size: 744,
    source: BSL_SOURCE,
    file: 'bsl-2.json',
    load: () => import('./bsl-2.json'),
  },
  {
    id: 'tsl-1',
    title: {
      tr: 'TOEIC İngilizcesi 1–1000',
      en: 'TOEIC Vocabulary 1–1000',
    },
    group: 'exam',
    size: 1000,
    source: TSL_SOURCE,
    file: 'tsl-1.json',
  },
  {
    id: 'tsl-2',
    title: {
      tr: 'TOEIC İngilizcesi 1001–1250',
      en: 'TOEIC Vocabulary 1001–1250',
    },
    group: 'exam',
    size: 250,
    source: TSL_SOURCE,
    file: 'tsl-2.json',
  },
];

export function findPackById(packId: string): Pack | undefined {
  return PACKS.find((pack) => pack.id === packId);
}

const PACK_RANGES_BY_PREFIX: Record<string, { packId: string; start: number; end: number }[]> = (() => {
  const grouped: Record<string, Pack[]> = {};
  for (const pack of PACKS) {
    const prefixMatch = /^([a-z]+)(?:-\d+)?$/.exec(pack.id);
    if (!prefixMatch) continue;
    const prefix = prefixMatch[1];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(pack);
  }
  const ranges: Record<string, { packId: string; start: number; end: number }[]> = {};
  for (const [prefix, groupPacks] of Object.entries(grouped)) {
    let cursor = 0;
    ranges[prefix] = groupPacks.map((pack) => {
      const start = cursor + 1;
      const end = cursor + pack.size;
      cursor = end;
      return { packId: pack.id, start, end };
    });
  }
  return ranges;
})();

export function packIdOfTerm(termId: string): string | undefined {
  const match = /^([a-z]+)-(\d+)$/.exec(termId);
  if (!match) return undefined;
  const prefix = match[1];
  const num = Number(match[2]);
  if (!Number.isInteger(num) || num < 1) return undefined;
  const ranges = PACK_RANGES_BY_PREFIX[prefix];
  if (!ranges) return undefined;
  for (const range of ranges) {
    if (num >= range.start && num <= range.end) {
      return range.packId;
    }
  }
  return undefined;
}
