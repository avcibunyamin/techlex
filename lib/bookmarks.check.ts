import { MAX_BOOKMARKS, normalizeBookmarkIds, toggleBookmarkIds } from './bookmarks';

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

console.log('bookmarks: 6 checks passed');
