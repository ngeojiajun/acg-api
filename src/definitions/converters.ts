/**
 * Serialization related to anime.d.ts
 */
import { defineVerifiedChain } from "../utilities/sanitise";
import { ACGEntry, AnimeEntry } from "./anime";
import {
  BilingualKeyedEntry,
  Category,
  Character,
  CharacterPresence,
  Gender,
  KeyedEntry,
  People,
} from "./core";

/**
 * Given the `table` try convert it into `KeyedEntry`
 * @param table table to decode
 */
export function asKeyedEntry(table: any): KeyedEntry | null {
  if (typeof table !== "object") {
    return null;
  }
  if (typeof table.id !== "number") {
    return null;
  }
  if (typeof table.name !== "string") {
    return null;
  }
  return table as KeyedEntry;
}
defineVerifiedChain(asKeyedEntry, "id", "name");

export function asBilingualKeyEntry(table: any): BilingualKeyedEntry | null {
  if (!asKeyedEntry(table)) {
    return null;
  }
  if (typeof table.nameInJapanese !== "string") {
    return null;
  }
  return table as BilingualKeyedEntry;
}
defineVerifiedChain(asBilingualKeyEntry, asKeyedEntry, "nameInJapanese");

/**
 * Given the `table` try convert it into `Category`
 * @param table table to decode
 */
export function asCategory(table: any): Category | null {
  return asKeyedEntry(table);
}
defineVerifiedChain(asCategory, asKeyedEntry);

export function asPeople(table: any): People | null {
  return asBilingualKeyEntry(table);
}
defineVerifiedChain(asPeople, asBilingualKeyEntry);

/**
 * Given the `table` try convert it into `ACGEntry`
 * @param table table to decode
 */
export function asACGEntry(table: any): ACGEntry | null {
  //try convert it into our superclass
  if (!asBilingualKeyEntry(table)) {
    return null;
  }

  //try check remaining fields

  if (typeof table.description !== "string") {
    return null;
  }

  if (typeof table.year !== "number") {
    return null;
  }

  if (table.category && !asArrayOf<KeyedEntry>(table.category, asCategory)) {
    return null;
  }

  if (table.publisher && !asArrayOf<People>(table.publisher, asPeople)) {
    return null;
  }

  if (table.author && !asArrayOf<People>(table.author, asPeople)) {
    return null;
  }

  return table;
}
defineVerifiedChain(
  asACGEntry,
  asBilingualKeyEntry,
  "description",
  "year",
  "category",
  "publisher",
  "author"
);

export function asAnimeEntry(table: any): AnimeEntry | null {
  return asACGEntry(table);
}
defineVerifiedChain(asAnimeEntry, asACGEntry);

export function asCharacterPresence(table: any): CharacterPresence | null {
  if (typeof table !== "object") {
    return null;
  }
  if (typeof table.id !== "number") {
    return null;
  }
  if (!asEnumeration(table.type, ["anime", "game", "comic"])) {
    return null;
  }
  return table as CharacterPresence;
}
defineVerifiedChain(asCharacterPresence, "id", "type");

export function asCharacter(table: any): Character | null {
  if (!asBilingualKeyEntry(table)) {
    return null;
  }
  if (
    typeof table.gender !== "string" ||
    !asEnumeration<Gender>(table.gender, ["male", "female"])
  ) {
    return null;
  }
  if (typeof table.description !== "string") {
    return null;
  }
  if (!asArrayOf<CharacterPresence>(table.presentOn, asCharacterPresence)) {
    return null;
  }
  return table;
}
defineVerifiedChain(
  asCharacter,
  asBilingualKeyEntry,
  "gender",
  "description",
  "presentOn"
);

/**
 * Try to parse the `table` as array of something
 * @param table data to parse
 * @param converter function to convert the element
 * @returns the converted array or null if failed
 */
export function asArrayOf<T>(
  table: any,
  converter: (data: any) => T | null
): T[] | null {
  if (!Array.isArray(table)) {
    return null;
  }
  let convertedArray: T[] = Array(table.length);
  for (let i = 0; i < table.length; i++) {
    let converted = converter(table[i]);
    if (converted !== null) {
      convertedArray[i] = converted;
    } else {
      return null;
    }
  }
  return convertedArray;
}

/**
 * Provided `value` test it against the `valid_vals`
 * @param value
 * @param valid_vals
 */
export function asEnumeration<T extends string>(
  value: string,
  valid_vals: T[]
): T | null {
  for (const element of valid_vals) {
    if (value === element) {
      return element;
    }
  }
  return null;
}
