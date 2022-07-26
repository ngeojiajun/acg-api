import { KeyedEntry } from "../definitions/core";
import { computeHashForObject } from "./hashing";

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
  /**
   * Is it is mutated
   */
  mutated: boolean;
  /**
   * Object which hold the hashes for the ids
   */
  hashes: {
    [key: KeyedEntry["id"]]: string;
  };
};

/**
 * A quick function to build the cached object
 * @param values the main array
 * @param fresh weather the array itself is a fresh
 * @returns the built array
 * @throws Error if the values id are not unique
 */
export function makeCached<T extends KeyedEntry>(
  values: T[],
  fresh: boolean
): Cached<T> | never {
  if (new Set<number>(values.map((g) => g.id)).size !== values.length) {
    throw new Error("Array content is not unique");
  }
  return {
    mutated: fresh,
    entries: values,
    cache: {},
    hashes: {},
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
  let { cache, entries, hashes } = object;
  let index = cache[id];
  if (index !== undefined) {
    hashes[id] = hashes[id] ?? computeHashForObject(entries[index]);
    return entries[index];
  }
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].id === id) {
      cache[id] = i;
      hashes[id] = computeHashForObject(entries[i]);
      return entries[i];
    }
  }
  return null;
}

/**
 * Add an entry into the table
 * @param table the table where it is saved
 * @param data the object to be saved
 * @returns the new id off the entry added
 */
export function addEntry<T extends KeyedEntry>(
  table: Cached<T>,
  data: T
): KeyedEntry["id"] {
  table.mutated = true;
  let lastIdx = (table.entries.length ?? 0) - 1;
  let id = lastIdx > 0 ? table.entries[lastIdx].id : 1;
  while (findEntry(table, id)) {
    id++; //if clash try next
  }
  let copy = { ...data };
  //overwrite ids
  copy.id = id;
  //finally push this
  let tableIdx = table.entries.push(copy) - 1;
  table.cache[id] = tableIdx;
  //with its hash along
  table.hashes[id] = computeHashForObject(copy);
  return id;
}

/**
 * Internal API: adjust all indexes after the removal
 * @param table the table
 * @param id the original index of the removed entry
 */
function recalculateIndexes<T extends KeyedEntry>(
  table: Cached<T>,
  id: number
): Cached<T>["cache"] {
  let ret = { ...table.cache };
  for (const key of Object.keys(ret)) {
    const keyId = parseInt(key);
    if (keyId === id) {
      delete ret[keyId];
    } else if (keyId > id) {
      //adjust them back but substract it by one
      ret[keyId]--;
    }
  }
  return ret;
}

/**
 * Remove an entry from the table
 * @param table
 * @param id
 * @returns
 */
export function removeEntryById<T extends KeyedEntry>(
  table: Cached<T>,
  id: KeyedEntry["id"]
): boolean {
  let { cache, entries, hashes } = table;
  //nuke of the hashes
  delete hashes[id];
  let index = cache[id];
  if (index !== undefined) {
    //use the index to remove the stuffs
    entries.splice(index, 1);
    //update the cache table
    table.cache = recalculateIndexes(table, index);
    table.mutated = true;
    return true;
  }
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].id === id) {
      entries.splice(i, 1);
      table.mutated = true;
      //update the cache table
      table.cache = recalculateIndexes(table, index);
      return true;
    }
  }
  return false;
}

/**
 * Ask the engine to drop the hash cache for the certain entry identified by its id
 * @param table Table which the entry resides
 * @param id the id of the entry for its hashes cache to be nuked
 */
export function dropHashesOf<T extends KeyedEntry>(
  table: Cached<T>,
  id: KeyedEntry["id"]
): void {
  delete table.hashes[id];
}

/**
 * Obtain (or compute if not present) the cache of the entry identified by its id
 * @param table Table which the entry resides
 * @param id the id of the entry which its hash should be obtained
 * @returns the hash or null if it is not exist
 */
export function getHashOf<T extends KeyedEntry>(
  table: Cached<T>,
  id: KeyedEntry["id"]
): string | null {
  if (table.hashes[id]) {
    return table.hashes[id];
  }
  if (!findEntry(table, id)) {
    return null;
  }
  return table.hashes[id];
}
