/**
 * This file contains the core migration codes for the tables resides inside the
 * database
 */

import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../../definitions/anime.internal";
import {
  asArrayOf,
  asBilingualKeyEntry,
  asCategory,
  asCharacter,
  asCharacterPresence,
  asEnumeration,
  asPeople,
} from "../../definitions/converters";
import {
  BilingualKeyedEntry,
  Category,
  Character,
  CharacterPresence,
  Gender,
  People,
} from "../../definitions/core";
import { NDJsonInfo } from "../../utilities/ndjson";
import { DatabaseTypes, DatabaseTypesMapping } from "../database";

//
// The highest table version that it can supports
//

export const ANIME_TABLE_VERSION = 1;
export const CATEGORY_TABLE_VERSION = 1;
export const CHARACTER_TABLE_VERSION = 2;
export const PERSON_TABLE_VERSION = 1;

/**
 * The compatibility status of the table
 */
export enum TABLE_COMPATIBILITY_STATE {
  /**
   * The table version are at its latest version or there are no breaking changes between the version.
   * Non-breaking changes means that the parsing function works without migration of the
   * dataset.
   * But this gives no gurantee that it passes the verification by the conversion
   */
  OK,
  /**
   * The table data is invalid for the given version, nor can be migrated to the latest version
   */
  INVALID,
  /**
   * The table data is invalid for current version but can be migrated to support the latest version
   */
  NEEDS_MIGRATION,
}

/**
 * Query the validaty of the given data based on its metadata
 * @param data
 * @param type the type of the table which it is checked against
 * @returns
 */
export function queryDataValidityStatus(
  data: NDJsonInfo,
  type: DatabaseTypes
): TABLE_COMPATIBILITY_STATE {
  switch (type) {
    case "ANIME":
    case "CATEGORY":
    case "PERSON":
      return data.version === ANIME_TABLE_VERSION
        ? TABLE_COMPATIBILITY_STATE.OK
        : TABLE_COMPATIBILITY_STATE.INVALID;
    case "CHARACTER": {
      //CHARACTER table v2: added the description mandatory field on it and changes the presence into an array
      if (data.version > CHARACTER_TABLE_VERSION) {
        return TABLE_COMPATIBILITY_STATE.INVALID;
      } else if (data.version == CHARACTER_TABLE_VERSION - 1) {
        return TABLE_COMPATIBILITY_STATE.NEEDS_MIGRATION;
      } else {
        return TABLE_COMPATIBILITY_STATE.OK;
      }
    }
  }
}

/**
 * Migrate the stuffs
 * @param data
 * @param type
 */
export function migrate<
  T extends DatabaseTypes,
  D extends DatabaseTypesMapping[T]
>(data: NDJsonInfo, type: T): D[] | null {
  switch (type) {
    case "ANIME":
      return migrateAnimeTable(data) as D[] | null; //definitely castable
    case "CATEGORY":
      return migrateCategoryTable(data) as D[] | null;
    case "CHARACTER":
      return migrateCharacterTable(data) as D[] | null;
    case "PERSON":
      return migratePersonTable(data) as D[] | null;
  }
  throw new Error("Unimplemented");
}

export function migrateAnimeTable(
  data: NDJsonInfo
): AnimeEntryInternal[] | null {
  const status = queryDataValidityStatus(data, "ANIME");
  if (status === TABLE_COMPATIBILITY_STATE.INVALID) {
    return null;
  } else if (status === TABLE_COMPATIBILITY_STATE.OK) {
    return asArrayOf<AnimeEntryInternal>(data.payload, asAnimeEntryInternal);
  } else {
    throw Error("Unimplemented"); //never happen for now
  }
}

export function migrateCategoryTable(data: NDJsonInfo): Category[] | null {
  const status = queryDataValidityStatus(data, "CATEGORY");
  if (status === TABLE_COMPATIBILITY_STATE.INVALID) {
    return null;
  } else if (status === TABLE_COMPATIBILITY_STATE.OK) {
    return asArrayOf<Category>(data.payload, asCategory);
  } else {
    throw Error("Unimplemented"); //never happen for now
  }
}

export function migrateCharacterTable(data: NDJsonInfo): Character[] | null {
  const status = queryDataValidityStatus(data, "CHARACTER");
  if (status === TABLE_COMPATIBILITY_STATE.INVALID) {
    return null;
  } else if (status === TABLE_COMPATIBILITY_STATE.OK) {
    return asArrayOf<Character>(data.payload, asCharacter);
  } else {
    switch (data.version) {
      case 1:
        {
          //original implementation from the converter.ts and the core.d.ts
          type _Character = BilingualKeyedEntry & {
            gender: Gender;
            presentOn: CharacterPresence;
          };
          function asCharacter_orig(table: any): _Character | null {
            if (!asBilingualKeyEntry(table)) {
              return null;
            }
            if (
              typeof table.gender !== "string" ||
              !asEnumeration<Gender>(table.gender, ["male", "female"])
            ) {
              return null;
            }
            if (!asCharacterPresence(table.presentOn)) {
              return null;
            }
            return table;
          }
          //try to restore the original representation of the stuffs
          let original = asArrayOf<_Character>(data.payload, asCharacter_orig);
          if (!original) {
            throw new Error(
              `Migration failed! Cannot parse the payload as CHARACTER v${data.version}`
            );
          }
          //map it into the new version of the stuffs
          let return_value: Character[] = original.map((z) => {
            // set the description to unknown and wrap the original presentOn in array
            return { ...z, description: "<unknown>", presentOn: [z.presentOn] };
          });
          return return_value;
        }
        break;
    }
    throw new Error(`Unsupported version ${data.version}`);
  }
}

export function migratePersonTable(data: NDJsonInfo): People[] | null {
  const status = queryDataValidityStatus(data, "PERSON");
  if (status === TABLE_COMPATIBILITY_STATE.INVALID) {
    return null;
  } else if (status === TABLE_COMPATIBILITY_STATE.OK) {
    return asArrayOf<People>(data.payload, asPeople);
  } else {
    throw Error("Unimplemented"); //never happen for now
  }
}
