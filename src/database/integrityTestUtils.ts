/**
 * Common utility to test database integrity
 */

import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Character, People, Status } from "../definitions/core";
import { IDatabase } from "./database";

export function constructStatus(success: boolean, message?: any): Status {
  return { success, message };
}

/**
 * Perform integrity check on remote references
 * @param db Database handle
 * @param entry Entry to test
 * @returns Check result
 */
export async function checkRemoteReferencesAnimeEntry(
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
        `Failed to resolve pointer PERSON{id=${k}} at ANIME{id=${entry.id}}`
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
          `Failed to resolve pointer CATEGORY{id=${key}} at ANIME{id=${entry.id}}`
        );
      }
    }
  }
  return constructStatus(true);
}

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
  switch (entry.presentOn.type) {
    case "anime":
      {
        let data: AnimeEntryInternal | null = await db.getData(
          "ANIME",
          entry.presentOn.id
        );
        if (!data) {
          return constructStatus(
            false,
            `Failed to resolve pointer ANIME{id=${entry.presentOn.id}} at CHARACTER{id=${entry.id}}`
          );
        }
        if (data.name !== entry.presentOn.name) {
          return constructStatus(
            false,
            `Inconsistant value detected!! At ANIME {id=${entry.id}} name=${data.name} but inside CHARACTER it was ${entry.presentOn.name}`
          );
        }
      }
      break;
    default:
      return constructStatus(false, "Unimplemented checks");
  }
  return constructStatus(true);
}
