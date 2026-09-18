/**
 * Row-index lookups for the dataView.
 *
 * Every list value records the row indexes it occupies. Building those lists naively -
 * one full scan of the column per distinct value, accumulating with array spread - is
 * O(distinct x rows) with a quadratic term, which is why a 30,000-row model with a
 * high-cardinality field (a date of joining, an employee code) used to freeze the
 * browser for about five seconds on every render.
 *
 * Instead each column is indexed once, in a single pass, and the results are memoised
 * against the column array itself so repeated calls within one update are free. The
 * arrays are keyed by identity, so the cache is discarded with the dataView.
 */

const indexCache = new WeakMap<object, Map<unknown, number[]>>();

function buildIndexMap(categoryValues: unknown[]): Map<unknown, number[]> {
  const map = new Map<unknown, number[]>();
  for (let rowIndex = 0; rowIndex < categoryValues.length; rowIndex++) {
    const value = categoryValues[rowIndex];
    const bucket = map.get(value);
    if (bucket) {
      bucket.push(rowIndex);
    } else {
      map.set(value, [rowIndex]);
    }
  }
  return map;
}

function getIndexMap(categoryValues: unknown[]): Map<unknown, number[]> {
  const cacheKey = categoryValues as unknown as object;
  let map = indexCache.get(cacheKey);
  if (!map) {
    map = buildIndexMap(categoryValues);
    indexCache.set(cacheKey, map);
  }
  return map;
}

/**
 * Rows where the column holds exactly this value.
 *
 * Matches the strict-equality semantics of the scan it replaces: Map keys use
 * SameValueZero, which differs from `===` only for NaN, so NaN is handled explicitly.
 * A copy is returned so callers can never mutate the shared cache.
 */
export function getAllIndexes(categoryValues: unknown[], uniqValue: unknown): number[] {
  if (typeof uniqValue === 'number' && isNaN(uniqValue)) {
    return [];
  }
  const bucket = getIndexMap(categoryValues).get(uniqValue);
  return bucket ? bucket.slice() : [];
}

/**
 * Rows whose combined values across `columns` equal `path`, where a path is the
 * pipe-joined string form a hierarchy node uses as its identity.
 *
 * The joined form of each row is built once per column set rather than once per node.
 */
const pathCache = new WeakMap<object, Map<string, Map<string, number[]>>>();

export function getHierarchyPathIndexes(rootColumn: unknown[], columnValues: unknown[][], path: string): number[] {
  const cacheKey = rootColumn as unknown as object;
  let byDepth = pathCache.get(cacheKey);
  if (!byDepth) {
    byDepth = new Map();
    pathCache.set(cacheKey, byDepth);
  }

  const depthKey = `${columnValues.length}`;
  let map = byDepth.get(depthKey);
  if (!map) {
    map = new Map<string, number[]>();
    const rowCount = columnValues[0] ? columnValues[0].length : 0;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      let key = '';
      for (let col = 0; col < columnValues.length; col++) {
        key += `|${columnValues[col][rowIndex]}`;
      }
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(rowIndex);
      } else {
        map.set(key, [rowIndex]);
      }
    }
    byDepth.set(depthKey, map);
  }

  const found = map.get(path);
  return found ? found.slice() : [];
}
