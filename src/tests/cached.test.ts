import { describe, expect, it } from "@jest/globals";
import { KeyedEntry } from "../definitions/core";
import {
  addEntry,
  findEntry,
  getHashOf,
  makeCached,
  removeEntryById,
} from "../utilities/cached";
import { computeHashForObject } from "../utilities/hashing";

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
const toAdd: Example = {
  id: 0,
  name: "1",
  random: "3",
};
describe("Cached<T> indexed table subsystem", () => {
  //it is not bound to external resource so no need afterAll hook here
  let table = makeCached(data, false);
  let newid: undefined | number;
  it("The creation of the table with duplicated entry should fail", () => {
    expect(() => {
      const invalid = [...data, data[0]];
      makeCached(invalid, false);
    }).toThrow();
  });
  it("findEntry<T> shall returns the reference to the object", () => {
    /**
     * We dont use toEqual because the function is NOT supposed to return the copy of the object
     * it results in GC thrashing, the client are SUPPOSED to make a copy of the object when it is
     * needed
     */
    expect(findEntry(table, 2)).toBe(data[1]);
  });
  it("addEntry<T> shall add copy of the data into it", () => {
    newid = addEntry(table, toAdd);
    expect(findEntry(table, newid)).not.toBe(toAdd);
  });
  it("Same data must have same hash ignoring the object reference identity", () => {
    expect(getHashOf(table, newid!)).toEqual(
      computeHashForObject({ ...toAdd, id: newid })
    );
  });
  it("addEntry<T> shall set the mutated flag", () => {
    expect(table.mutated).toBe(true);
    table.mutated = false;
  });
  it("removeEntry<T> should mutate the table and drop the entry from the cache", () => {
    removeEntryById(table, 1);
    expect(table.cache[1]).toBeFalsy();
    expect(table.hashes[1]).toBeFalsy();
    expect(table.mutated).toBe(true);
  });
});
