/**
 * Common utility to test database integrity
 */

import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Status } from "../definitions/core";
import { IDatabase } from "./database";

export function constructStatus(success: boolean, message?: string): Status {
  return { success, message };
}

export function checkRemoteReferences(
  db: IDatabase,
  entry: AnimeEntryInternal
): Status {
  //merge the ptrs
  let ptrs = [...(entry.author ?? [])];
  entry.publisher?.forEach((v) => {
    if (!ptrs.includes(v)) {
      ptrs.push(v);
    }
  });
  //test all ptrs
  ptrs.forEach((key) => {
    let data = db.getData("PERSON", key);
    if (!data) {
      constructStatus(
        false,
        `Failed to resolve pointer CHARACTER{id=${key}} at ANIME{id=${entry.id}}`
      );
    }
  });
  //now test the categories
  if (entry.category) {
    for (const key of entry.category) {
      let data = db.getData("CATEGORY", key);
      if (!data) {
        constructStatus(
          false,
          `Failed to resolve pointer CATEGORY{id=${key}} at ANIME{id=${entry.id}}`
        );
      }
    }
  }
  return constructStatus(true);
}
