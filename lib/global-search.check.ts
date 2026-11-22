// Run with: npx tsx lib/global-search.check.ts

import {
  GLOBAL_SEARCH_LIMIT,
  GLOBAL_SEARCH_MIN_PACK_LOAD_CHARS,
  GLOBAL_SEARCH_PACK_BATCH_SIZE,
  chunkPackIds,
  getUnloadedPackIds,
  loadSearchPacksInBatches,
  normalizeSearchBox,
  scoreTermMatch,
  searchGlobalTerms,
  shouldLoadPacksForQuery,
  type GlobalSearchTerm,
  type GlobalSearchProgressMap,
  type GlobalSearchSource,
} from './global-search';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`global-search check failed: ${message}`);
  }
}

function makeTerm(
  id: string,
  term: string,
  trDef: string,
  enDef: string,
  opts: { order?: number; rank?: number; tags?: string[] } = {}
): GlobalSearchTerm {
  return {
    id,
    term,
    translations: {
      tr: { definition: trDef },
      en: { definition: enDef },
    },
    order: opts.order ?? 1,
    rank: opts.rank,
    tags: opts.tags ?? ['software-dev'],
  };
}

let passed = 0;

// 1. Merges IT terms and loaded pack terms with source metadata and normalized Leitner box
{
  const itTerms = [
    makeTerm('it-firewall', 'Firewall', 'Ağ güvenlik duvarı', 'Network security barrier', {
      order: 2,
      tags: ['cybersecurity', 'blue-team'],
    }),
  ];
  const packTerms = [
    makeTerm('ngsl-0010', 'network', 'Ağ ve bağlantı sistemi', 'Connected group or system', {
      order: 10,
      rank: 10,
      tags: ['ngsl', 'english'],
    }),
    makeTerm('bsl-0005', 'networking', 'İş ağı kurma', 'Building professional relationships', {
      order: 5,
      rank: 5,
      tags: ['bsl', 'english'],
    }),
  ];
  const progress: GlobalSearchProgressMap = {
    'it-firewall': { box: 4, timesSeen: 5, timesCorrect: 4 },
    'bsl-0005': { box: 99, timesSeen: 1, timesCorrect: 0 }, // out-of-range -> 1
  };

  const res = searchGlobalTerms(
    [
      { packId: null, terms: itTerms },
      { packId: 'ngsl-1', label: 'General English 1–1000', terms: packTerms.slice(0, 1) },
      { packId: 'bsl-1', label: 'Business English 1–1000', terms: packTerms.slice(1) },
    ],
    progress,
    'network'
  );

  assert(res.totalMatches === 3, `expected 3 matches, got ${res.totalMatches}`);
  assert(res.hasMore === false && res.hiddenCount === 0, 'expected hasMore=false');
  assert(res.items[0].term.id === 'ngsl-0010', `expected exact match first, got ${res.items[0].term.id}`);
  assert(res.items[0].packId === 'ngsl-1', 'expected packId ngsl-1');
  assert(res.items[0].sourceKey === 'ngsl-1', 'expected sourceKey ngsl-1');
  assert(res.items[0].sourceLabel === 'General English 1–1000', 'expected pack sourceLabel');
  assert(res.items[0].box === null, 'expected unseen term box to be null');

  assert(res.items[1].term.id === 'bsl-0005', `expected prefix match second, got ${res.items[1].term.id}`);
  assert(res.items[1].box === 1, `expected out-of-range box to normalize to 1, got ${res.items[1].box}`);

  assert(res.items[2].term.id === 'it-firewall', `expected definition match third, got ${res.items[2].term.id}`);
  assert(res.items[2].packId === null, 'expected IT term packId to be null');
  assert(res.items[2].sourceKey === 'cybersecurity', `expected IT primary tag, got ${res.items[2].sourceKey}`);
  assert(res.items[2].box === 4, `expected box 4, got ${res.items[2].box}`);
  passed += 1;
}

// 2. Turkish letters (İ/I/ı/i, ğ, ş, ç, ö, ü) and accents are matched insensitively
{
  const terms = [
    makeTerm('bsl-0200', 'invoice', 'Ticari işletme faturası ve ödeme belgesi', 'Commercial bill for goods', {
      rank: 200,
    }),
    makeTerm('tsl-0026', 'résumé', 'İş başvurusu için özgeçmiş', 'Summary of work experience', {
      rank: 26,
    }),
  ];

  const trUpper = searchGlobalTerms([{ packId: 'bsl-1', terms }], {}, 'İŞLETME');
  const trAscii = searchGlobalTerms([{ packId: 'bsl-1', terms }], {}, 'isletme');
  const dottedTerm = searchGlobalTerms([{ packId: 'bsl-1', terms }], {}, 'İnvoice');
  const dotlessTerm = searchGlobalTerms([{ packId: 'bsl-1', terms }], {}, 'INVOICE');
  const unaccented = searchGlobalTerms([{ packId: 'tsl-1', terms }], {}, 'resume ozgecmis');

  assert(trUpper.totalMatches === 1 && trUpper.items[0].term.id === 'bsl-0200', 'İŞLETME should match işletme');
  assert(trAscii.totalMatches === 1 && trAscii.items[0].term.id === 'bsl-0200', 'isletme should match işletme');
  assert(dottedTerm.totalMatches === 1 && dottedTerm.items[0].term.id === 'bsl-0200', 'İnvoice should match invoice');
  assert(dotlessTerm.totalMatches === 1 && dotlessTerm.items[0].term.id === 'bsl-0200', 'INVOICE should match invoice');
  assert(unaccented.totalMatches === 1 && unaccented.items[0].term.id === 'tsl-0026', 'resume ozgecmis should match résumé');
  passed += 1;
}

// 3. Ranking order: exact term (0) > prefix term (1) > substring term (2) > definition match (3), then rank/order/id
{
  const terms = [
    makeTerm('t-def', 'warehouse', 'Büyük veri deposu', 'Central repository for data analysis', {
      rank: 1,
      order: 1,
    }),
    makeTerm('t-sub', 'metadata', 'Üst veri bilgisi', 'Information describing other information', {
      rank: 2,
      order: 2,
    }),
    makeTerm('t-pre-b', 'database', 'Veritabanı sistemi', 'Organized collection of records', {
      rank: 20,
      order: 20,
    }),
    makeTerm('t-pre-a', 'dataset', 'Veri kümesi', 'Structured collection of values', {
      rank: 5,
      order: 5,
    }),
    makeTerm('t-exact', 'data', 'Ham veri', 'Facts and statistics collected together', {
      rank: 50,
      order: 50,
    }),
  ];

  assert(scoreTermMatch(terms[4], 'data', ['data']) === 0, 'exact tier should be 0');
  assert(scoreTermMatch(terms[3], 'data', ['data']) === 1, 'prefix tier should be 1');
  assert(scoreTermMatch(terms[1], 'data', ['data']) === 2, 'substring tier should be 2');
  assert(scoreTermMatch(terms[0], 'data', ['data']) === 3, 'definition tier should be 3');

  const res = searchGlobalTerms([{ packId: 'ngsl-1', terms }], {}, 'data');
  const ids = res.items.map((item) => item.term.id);
  assert(
    ids.join(',') === 't-exact,t-pre-a,t-pre-b,t-sub,t-def',
    `unexpected ranking order: ${ids.join(',')}`
  );
  passed += 1;
}

// 4. Enforces 30-item default limit and computes hasMore / hiddenCount accurately
{
  const manyTerms: GlobalSearchTerm[] = [];
  for (let i = 1; i <= 35; i += 1) {
    const padded = String(i).padStart(4, '0');
    manyTerms.push(
      makeTerm(`ngsl-${padded}`, `concept-${padded}`, `Kavram ${i}`, `Shared concept ${i}`, {
        rank: i,
        order: i,
      })
    );
  }

  const capped = searchGlobalTerms([{ packId: 'ngsl-1', terms: manyTerms }], {}, 'concept');
  assert(capped.items.length === GLOBAL_SEARCH_LIMIT, `expected ${GLOBAL_SEARCH_LIMIT} items, got ${capped.items.length}`);
  assert(capped.totalMatches === 35, `expected totalMatches=35, got ${capped.totalMatches}`);
  assert(capped.hasMore === true, 'expected hasMore=true when totalMatches > 30');
  assert(capped.hiddenCount === 5, `expected hiddenCount=5, got ${capped.hiddenCount}`);
  assert(capped.items[0].term.id === 'ngsl-0001', 'expected rank 1 first');
  assert(capped.items[29].term.id === 'ngsl-0030', 'expected rank 30 at index 29');

  const exact30 = searchGlobalTerms([{ packId: 'ngsl-1', terms: manyTerms.slice(0, 30) }], {}, 'concept');
  assert(exact30.items.length === 30 && exact30.hasMore === false && exact30.hiddenCount === 0, 'exact 30 should have hasMore=false');
  passed += 1;
}

// 5. Empty/whitespace query returns empty result and duplicate term IDs across sources are deduplicated
{
  const termA = makeTerm('dup-1', 'protocol', 'İletişim protokolü', 'Communication rules', {
    rank: 1,
    tags: ['networking'],
  });
  const termADuplicate = makeTerm('dup-1', 'protocol', 'İletişim protokolü', 'Communication rules', {
    rank: 1,
    tags: ['ngsl'],
  });

  const emptyRes = searchGlobalTerms([{ packId: null, terms: [termA] }], {}, '   ');
  assert(
    emptyRes.items.length === 0 && emptyRes.totalMatches === 0 && !emptyRes.hasMore && emptyRes.hiddenCount === 0,
    'whitespace query must return empty result'
  );

  const dedupRes = searchGlobalTerms(
    [
      { packId: null, terms: [termA] },
      { packId: 'ngsl-1', terms: [termADuplicate] },
    ],
    {},
    'protocol'
  );
  assert(dedupRes.totalMatches === 1 && dedupRes.items.length === 1, 'duplicate term.id must be deduplicated');
  assert(dedupRes.items[0].packId === null, 'first occurrence should win');
  passed += 1;
}

// 6. Edge cases: non-finite limit falls back to GLOBAL_SEARCH_LIMIT, normalizeSearchBox handles invalid boxes
{
  const terms = [makeTerm('t-1', 'algorithm', 'Algoritma', 'Step-by-step procedure')];
  const nanLimitRes = searchGlobalTerms([{ packId: null, terms }], {}, 'algorithm', Number.NaN);
  assert(nanLimitRes.items.length === 1 && !nanLimitRes.hasMore, 'NaN limit should fallback to default limit');

  const zeroLimitRes = searchGlobalTerms([{ packId: null, terms }], {}, 'algorithm', 0);
  assert(
    zeroLimitRes.items.length === 0 &&
      zeroLimitRes.totalMatches === 1 &&
      zeroLimitRes.hasMore === true &&
      zeroLimitRes.hiddenCount === 1,
    'zero limit should return 0 items with hasMore=true'
  );

  assert(normalizeSearchBox(undefined) === null, 'undefined progress -> null');
  assert(normalizeSearchBox({ box: Number.NaN }) === 1, 'NaN box -> 1');
  assert(normalizeSearchBox({ box: 0 }) === 1, 'box 0 -> 1');
  assert(normalizeSearchBox({ box: 3.8 }) === 3, 'decimal box 3.8 -> 3');
  passed += 1;
}

// 7. shouldLoadPacksForQuery requires >= 2 letters/chars; getUnloadedPackIds and chunkPackIds batch unloaded packs
{
  assert(GLOBAL_SEARCH_MIN_PACK_LOAD_CHARS === 2, 'default min chars should be 2');
  assert(GLOBAL_SEARCH_PACK_BATCH_SIZE === 2, 'default batch size should be 2');
  assert(shouldLoadPacksForQuery('') === false, 'empty query must not load packs');
  assert(shouldLoadPacksForQuery('   ') === false, 'whitespace query must not load packs');
  assert(shouldLoadPacksForQuery('a') === false, '1-char query must not load packs');
  assert(shouldLoadPacksForQuery('  İ  ') === false, '1 Turkish char query must not load packs');
  assert(shouldLoadPacksForQuery('ab') === true, '2-char query should load packs');
  assert(shouldLoadPacksForQuery('İs') === true, '2 Turkish chars should load packs');
  assert(shouldLoadPacksForQuery('a b') === true, 'two 1-char tokens (2 chars total) should load packs');

  const loaded = new Set<string>(['ngsl-1']);
  const exhausted = new Set<string>(['bsl-2']);
  const unloaded = getUnloadedPackIds(
    ['ngsl-1', 'ngsl-2', 'ngsl-3', 'nawl-1', 'bsl-1', 'bsl-2', 'tsl-1', 'ngsl-2'],
    (id) => loaded.has(id),
    exhausted
  );
  assert(
    unloaded.join(',') === 'ngsl-2,ngsl-3,nawl-1,bsl-1,tsl-1',
    `unexpected unloaded list: ${unloaded.join(',')}`
  );

  const chunks = chunkPackIds(unloaded, 2);
  assert(chunks.length === 3, `expected 3 batches, got ${chunks.length}`);
  assert(chunks[0].join(',') === 'ngsl-2,ngsl-3', 'batch 1 mismatch');
  assert(chunks[1].join(',') === 'nawl-1,bsl-1', 'batch 2 mismatch');
  assert(chunks[2].join(',') === 'tsl-1', 'batch 3 mismatch');
  passed += 1;
}

async function runAsyncChecks(): Promise<void> {
  // 8. loadSearchPacksInBatches loads unloaded packs in small batches and updates search results progressively
  {
    const packCatalog: Record<string, GlobalSearchTerm[]> = {
      'ngsl-1': [makeTerm('ngsl-0001', 'strategy', 'Strateji', 'Plan of action', { rank: 1 })],
      'ngsl-2': [makeTerm('ngsl-1001', 'strategic', 'Stratejik', 'Relating to strategy', { rank: 1001 })],
      'nawl-1': [makeTerm('nawl-0001', 'strategize', 'Strateji kurmak', 'Devise a strategy', { rank: 1 })],
      'bsl-1': [makeTerm('bsl-0001', 'strategist', 'Stratejist', 'Expert in strategy', { rank: 1 })],
    };
    const loadedPacks = new Set<string>(['ngsl-1']);
    const ensureCalls: string[][] = [];
    const matchCountsAfterEachBatch: number[] = [];

    const buildSources = (): GlobalSearchSource<GlobalSearchTerm>[] => {
      const sources: GlobalSearchSource<GlobalSearchTerm>[] = [];
      for (const id of Object.keys(packCatalog)) {
        if (loadedPacks.has(id)) {
          sources.push({ packId: id, terms: packCatalog[id] });
        }
      }
      return sources;
    };

    const result = await loadSearchPacksInBatches({
      packIds: ['ngsl-1', 'ngsl-2', 'nawl-1', 'bsl-1'],
      isPackLoaded: (id) => loadedPacks.has(id),
      batchSize: 2,
      ensurePacks: async (ids) => {
        ensureCalls.push([...ids]);
        for (const id of ids) {
          loadedPacks.add(id);
        }
        return true;
      },
      onBatchSettled: () => {
        const res = searchGlobalTerms(buildSources(), {}, 'strateg');
        matchCountsAfterEachBatch.push(res.totalMatches);
      },
    });

    assert(ensureCalls.length === 2, `expected 2 batch calls, got ${ensureCalls.length}`);
    assert(ensureCalls[0].join(',') === 'ngsl-2,nawl-1', `unexpected batch 1: ${ensureCalls[0].join(',')}`);
    assert(ensureCalls[1].join(',') === 'bsl-1', `unexpected batch 2: ${ensureCalls[1].join(',')}`);
    assert(
      matchCountsAfterEachBatch.join(',') === '3,4',
      `expected progressive match counts 3,4, got ${matchCountsAfterEachBatch.join(',')}`
    );
    assert(result.loadedIds.join(',') === 'ngsl-2,nawl-1,bsl-1', 'all 3 unloaded packs should load');
    assert(result.retriedIds.length === 0 && result.failedIds.length === 0, 'no retries or failures expected');
    passed += 1;
  }

  // 9. loadSearchPacksInBatches keeps existing results on error, retries failed packs once, and marks permanently failed packs in exhaustedPackIds
  {
    const loadedPacks = new Set<string>(['ngsl-1']);
    const exhausted = new Set<string>();
    const attemptsByPack: Record<string, number> = {};

    // 'ngsl-2' fails first time then succeeds on retry; 'bsl-1' fails both initial and retry.
    const firstRun = await loadSearchPacksInBatches({
      packIds: ['ngsl-1', 'ngsl-2', 'bsl-1', 'tsl-1'],
      isPackLoaded: (id) => loadedPacks.has(id),
      batchSize: 2,
      exhaustedPackIds: exhausted,
      ensurePacks: async (ids) => {
        let allOk = true;
        for (const id of ids) {
          attemptsByPack[id] = (attemptsByPack[id] ?? 0) + 1;
          if (id === 'ngsl-2' && attemptsByPack[id] === 1) {
            allOk = false;
            continue;
          }
          if (id === 'bsl-1') {
            allOk = false;
            continue;
          }
          loadedPacks.add(id);
        }
        return allOk;
      },
    });

    assert(attemptsByPack['ngsl-1'] === undefined, 'already loaded pack must not be requested');
    assert(attemptsByPack['ngsl-2'] === 2, `ngsl-2 should be tried twice (initial + 1 retry), got ${attemptsByPack['ngsl-2']}`);
    assert(attemptsByPack['bsl-1'] === 2, `bsl-1 should be tried twice (initial + 1 retry), got ${attemptsByPack['bsl-1']}`);
    assert(attemptsByPack['tsl-1'] === 1, `tsl-1 should succeed on first try, got ${attemptsByPack['tsl-1']}`);
    assert(firstRun.retriedIds.join(',') === 'ngsl-2,bsl-1', `unexpected retriedIds: ${firstRun.retriedIds.join(',')}`);
    assert(firstRun.loadedIds.join(',') === 'ngsl-2,tsl-1', `unexpected loadedIds: ${firstRun.loadedIds.join(',')}`);
    assert(firstRun.failedIds.join(',') === 'bsl-1', `unexpected failedIds: ${firstRun.failedIds.join(',')}`);
    assert(exhausted.has('bsl-1'), 'permanently failed pack must be added to exhaustedPackIds');

    // Second run must not retry exhausted 'bsl-1' or already loaded packs
    const secondRun = await loadSearchPacksInBatches({
      packIds: ['ngsl-1', 'ngsl-2', 'bsl-1', 'tsl-1'],
      isPackLoaded: (id) => loadedPacks.has(id),
      batchSize: 2,
      exhaustedPackIds: exhausted,
      ensurePacks: async () => {
        throw new Error('should not call ensurePacks when all packs are loaded or exhausted');
      },
    });
    assert(secondRun.attemptedIds.length === 0, 'second run should attempt 0 packs');
    passed += 1;
  }

  console.log(`global-search: ${passed} checks passed`);
}

void runAsyncChecks().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
