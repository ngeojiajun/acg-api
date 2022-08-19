/**
 * Common utility to test database integrity
 */

import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Character, People, Status } from "../definitions/core";
import { IDatabase } from "./database";
import { ERROR_INTEGRITY_TEST_FAILED } from "./error_codes";

export function constructStatus(
  success: boolean,
  message?: any,
  code: number = 0
): Status {
  return { success, message, code };
}

/**
 * Perform integrity check on remote references
 * @param db Database handle
 * @param entry Entry to test
 * @returns Check result
 */
export async function checkRemoteReferencesACGEntry(
  db: IDatabase,
  entry: AnimeEntryInternal
): Promise<Status> {
  //merge the ptrs
  let ptrs = [...(entry.author ?? [])];
  entry.publisher?.forEach((v) => {
    if (!ptrs.includes(v)) {
      ptrs.push(v);
    }
  });
  for (const k of ptrs) {
    let data: People | null = await db.getData<People>("PERSON", k);
    if (!data) {
      return constructStatus(
        false,
        `Failed to resolve pointer PERSON{id=${k}} at ANIME{id=${entry.id}}`,
        ERROR_INTEGRITY_TEST_FAILED
      );
    }
  }
  //now test the categories
  if (entry.category) {
    for (const key of entry.category) {
      let data = await db.getData("CATEGORY", key);
      if (!data) {
        return constructStatus(
          false,
          `Failed to resolve pointer CATEGORY{id=${key}} at ANIME{id=${entry.id}}`,
          ERROR_INTEGRITY_TEST_FAILED
        );
      }
    }
  }
  return constructStatus(true);
}

export const checkRemoteReferencesAnimeEntry = checkRemoteReferencesACGEntry;
export const checkRemoteReferencesMangaEntry = checkRemoteReferencesACGEntry;

/**
 * Perform integrity check on remote references
 * @param db Database handle
 * @param entry Entry to test
 * @returns Check result
 */
export async function checkRemoteReferencesCharacter(
  db: IDatabase,
  entry: Character
): Promise<Status> {
  //check the remote referemces
  for (const presence of entry.presentOn) {
    switch (presence.type) {
      case "anime":
        {
          let data: AnimeEntryInternal | null = await db.getData(
            "ANIME",
            presence.id
          );
          if (!data) {
            return constructStatus(
              false,
              `Failed to resolve pointer ANIME{id=${presence.id}} at CHARACTER{id=${entry.id}}`,
              ERROR_INTEGRITY_TEST_FAILED
            );
          }
        }
        break;
      case "manga":
        {
          let data: AnimeEntryInternal | null = await db.getData(
            "MANGA",
            presence.id
          );
          if (!data) {
            return constructStatus(
              false,
              `Failed to resolve pointer MANGA{id=${presence.id}} at CHARACTER{id=${entry.id}}`,
              ERROR_INTEGRITY_TEST_FAILED
            );
          }
        }
        break;
      default:
        return constructStatus(false, "Unimplemented checks");
    }
  }
  return constructStatus(true);
}
