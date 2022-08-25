import { KeyedEntry } from "../definitions/core";
import {
  addEntry,
  findEntry,
  getHashOf,
  makeCached,
  removeEntryById,
} from "../utilities/cached";
import { computeHashForObject } from "../utilities/hashing";
import { assertMatch, assertNotMatch, assertThrow, fail } from "./common_utils";

/**
 * Tests against Cached<T>
 */
type Example = KeyedEntry & {
  random: String;
};

const data: Example[] = [
  {
    id: 1,
    name: "chicken",
    random: "222",
  },
  {
    id: 2,
    name: "chicken2",
    random: "2223",
  },
];

/**
 * Common tests against the Cached<T>
 */
export async function CachedTests() {
  console.log("Testing Cached<T> enforcement on uniqueness");
  //make a duplicated entry at the end
  const invalid = [...data, data[0]];
  await assertThrow(() => {
    makeCached(invalid, false);
  }, "makeCached with duplicate");
  console.log("Find entry from Cached should return reference to the object");
  let table = makeCached(data, false);
  assertMatch(findEntry(table, 2), data[1]);
  console.log("Add entry should add the copy of data into it");
  const toAdd: Example = {
    id: 0,
    name: "1",
    random: "3",
  };
  const newid: number = addEntry(table, toAdd);
  const hash: string = computeHashForObject({ ...toAdd, id: newid });
  assertNotMatch(findEntry(table, newid), toAdd);
  console.log(
    "The same data must have the same hash ignoring the object reference identity"
  );
  assertMatch(hash, getHashOf(table, newid));
  console.log("The mutated flag should be set after addEntry");
  if (!table.mutated) {
    fail("The mutated flag is not set!");
  }
  table.mutated = false;
  console.log(
    "The removeEntry should mutate the table and drop the entry from the cache"
  );
  removeEntryById(table, 1);
  if (table.cache[1]) {
    fail("The cache entry is not removed");
  }
  if (!table.mutated) {
    fail("The mutated flag is not set!");
  }
}
