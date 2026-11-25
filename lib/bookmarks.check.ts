import {
  MAX_BOOKMARKS,
  SAVED_WORDS_PREVIEW_LIMIT,
  buildSavedWordsView,
  getUnloadedBookmarkPackIds,
  normalizeBookmarkIds,
  toggleBookmarkIds,
} from './bookmarks';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 1. Adding new bookmark IDs prepends to the front and does not mutate the input array.
{
  const initial: string[] = ['ngsl-0002', 'ngsl-0001'];
  const snapshot = [...initial];
  const next = toggleBookmarkIds(initial, 'ngsl-0003');
  assert(
    next.join(',') === 'ngsl-0003,ngsl-0002,ngsl-0001',
    'new bookmark should be prepended to the start of the list'
  );
  assert(
    initial.join(',') === snapshot.join(','),
    'toggleBookmarkIds must not mutate the input array'
  );
}

// 2. Toggling an existing bookmark ID removes it while preserving relative order of remaining IDs.
{
  const initial = ['ngsl-0003', 'ngsl-0002', 'ngsl-0001'];
  const removedMiddle = toggleBookmarkIds(initial, 'ngsl-0002');
  assert(
    removedMiddle.join(',') === 'ngsl-0003,ngsl-0001',
    'existing middle bookmark should be removed'
  );
  const removedFirst = toggleBookmarkIds(removedMiddle, 'ngsl-0003');
  assert(
    removedFirst.join(',') === 'ngsl-0001',
    'existing front bookmark should be removed'
  );
  const removedLast = toggleBookmarkIds(removedFirst, 'ngsl-0001');
  assert(removedLast.length === 0, 'removing the only bookmark should yield an empty array');
}

// 3. Exceeding max drops the oldest bookmark(s) from the tail and respects default MAX_BOOKMARKS (500).
{
  const capped = toggleBookmarkIds(['id-3', 'id-2', 'id-1'], 'id-4', 3);
  assert(
    capped.join(',') === 'id-4,id-3,id-2',
    'adding beyond max=3 should drop the oldest item at the tail (id-1)'
  );

  const fiveHundred = Array.from({ length: MAX_BOOKMARKS }, (_, i) => `term-${i + 1}`);
  const afterOverflow = toggleBookmarkIds(fiveHundred, 'term-newest');
  assert(
    afterOverflow.length === MAX_BOOKMARKS,
    'default max should cap bookmarks at 500 entries'
  );
  assert(
    afterOverflow[0] === 'term-newest' && afterOverflow[afterOverflow.length - 1] === 'term-499',
    'newest item should be at index 0 and oldest item (term-500) should be dropped'
  );
}

// 4. normalizeBookmarkIds returns [] for non-array values.
{
  assert(normalizeBookmarkIds(null).length === 0, 'null should normalize to []');
  assert(normalizeBookmarkIds(undefined).length === 0, 'undefined should normalize to []');
  assert(normalizeBookmarkIds('ngsl-0001').length === 0, 'string should normalize to []');
  assert(normalizeBookmarkIds(42).length === 0, 'number should normalize to []');
  assert(normalizeBookmarkIds({ id: 'ngsl-0001' }).length === 0, 'object should normalize to []');
}

// 5. normalizeBookmarkIds strips empty/whitespace strings, non-strings, and duplicates, and caps at max.
{
  const dirty = ['  ngsl-0001 ', '', '   ', null, 123, 'ngsl-0002', 'ngsl-0001', 'ngsl-0003', 'ngsl-0004'];
  const cleaned = normalizeBookmarkIds(dirty, 3);
  assert(
    cleaned.join(',') === 'ngsl-0001,ngsl-0002,ngsl-0003',
    'normalizeBookmarkIds should trim, drop invalid/empty/duplicate entries, and cap at max=3'
  );
}

// 6. Toggling with blank/whitespace ID does not insert an empty entry and still normalizes the array.
{
  const res = toggleBookmarkIds(['a', 'a', 'b'], '   ', 5);
  assert(res.join(',') === 'a,b', 'blank toggle target should return normalized existing list');
}

// 7. getUnloadedBookmarkPackIds resolves deduplicated unloaded pack IDs once and skips loaded/requested packs.
{
  const loadedTerms = new Map<string, { id: string }>([['it-api', { id: 'it-api' }]]);
  const loadedPacks = new Set<string>(['nawl-1']);
  const requestedPacks = new Set<string>();
  const fakePackIdOfTerm = (id: string): string | undefined => {
    if (id.startsWith('ngsl-')) return 'ngsl-1';
    if (id.startsWith('nawl-')) return 'nawl-1';
    if (id.startsWith('bsl-')) return 'bsl-1';
    return undefined;
  };

  const firstPass = getUnloadedBookmarkPackIds(
    ['it-api', 'ngsl-0001', 'ngsl-0002', 'nawl-0999', 'bsl-0010', 'unknown-id'],
    {
      getTermById: (id) => loadedTerms.get(id),
      packIdOfTerm: fakePackIdOfTerm,
      isPackLoaded: (packId) => loadedPacks.has(packId),
      requestedPackIds: requestedPacks,
    }
  );
  assert(
    firstPass.join(',') === 'ngsl-1,bsl-1',
    'should only return unloaded, unrequested pack IDs in order without duplicates'
  );

  for (const packId of firstPass) {
    requestedPacks.add(packId);
  }
  const secondPass = getUnloadedBookmarkPackIds(
    ['it-api', 'ngsl-0001', 'ngsl-0002', 'nawl-0999', 'bsl-0010', 'unknown-id'],
    {
      getTermById: (id) => loadedTerms.get(id),
      packIdOfTerm: fakePackIdOfTerm,
      isPackLoaded: (packId) => loadedPacks.has(packId),
      requestedPackIds: requestedPacks,
    }
  );
  assert(secondPass.length === 0, 'already requested pack IDs must not be requested again');
}

// 8. buildSavedWordsView omits unfound IDs, caps preview to 5 items, and expands when showAll is true.
{
  const catalog = new Map<string, { id: string; term: string }>([
    ['w1', { id: 'w1', term: 'one' }],
    ['w2', { id: 'w2', term: 'two' }],
    ['w3', { id: 'w3', term: 'three' }],
    ['w4', { id: 'w4', term: 'four' }],
    ['w5', { id: 'w5', term: 'five' }],
    ['w6', { id: 'w6', term: 'six' }],
  ]);

  const idsWithMissing = ['w1', 'missing-1', 'w2', 'w3', 'w4', 'w5', 'missing-2', 'w6'];
  const preview = buildSavedWordsView(idsWithMissing, (id) => catalog.get(id), false);
  assert(preview.totalCount === 6, 'totalCount should count only found terms');
  assert(
    preview.visibleTerms.length === SAVED_WORDS_PREVIEW_LIMIT,
    'preview should cap visibleTerms at SAVED_WORDS_PREVIEW_LIMIT (5)'
  );
  assert(
    preview.visibleTerms.map((t) => t.id).join(',') === 'w1,w2,w3,w4,w5',
    'preview should keep bookmark order and exclude missing IDs'
  );
  assert(preview.hasMore === true, 'hasMore should be true when totalCount exceeds preview limit');

  const expanded = buildSavedWordsView(idsWithMissing, (id) => catalog.get(id), true);
  assert(expanded.visibleTerms.length === 6, 'showAll=true should return all found terms');
  assert(expanded.hasMore === false, 'hasMore should be false when showAll is true');
}

console.log('bookmarks: 8 checks passed');
