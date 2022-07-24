import { KeyedEntry } from "../definitions/core";

/**
 * Cached - A simple caching system which storing the id:index mapped at another array along side with the main array
 */
export type Cached<T extends KeyedEntry> = {
  /**
   * The entries
   */
  entries: T[];
  /**
   * The id index map
   */
  cache: {
    [key: KeyedEntry["id"]]: number;
  };
};

/**
 * A quick function to build the cached object
 * @param values the main array
 * @returns the built array
 */
export function makeCached<T extends KeyedEntry>(values: T[]): Cached<T> {
  return {
    entries: values,
    cache: {},
  };
}

/**
 * Find and return the entry which array the said `id`
 * @param object the object to search from
 * @param id the id of the entry to find
 * @returns the object or null if it is not exists
 */
export function findEntry<T extends KeyedEntry>(
  object: Cached<T>,
  id: KeyedEntry["id"]
): T | null {
  let { cache, entries } = object;
  let index = cache[id];
  if (index !== undefined) {
    return entries[index];
  }
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].id === id) {
      cache[id] = i;
      return entries[i];
    }
  }
  return null;
}
