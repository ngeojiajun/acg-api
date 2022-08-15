import { IDatabase } from "../database/database";
import {
  checkRemoteReferencesAnimeEntry,
  checkRemoteReferencesCharacter,
} from "../database/integrityTestUtils";
import JsonDatabase from "../database/jsonDatabase";
import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Character } from "../definitions/core";
import { assertSuccess, fail } from "./common_utils";

export async function IntegrityTest() {
  let db: IDatabase = new JsonDatabase("./data/");
  console.log("Database is initializing");
  await db.init();
  try {
    console.log("Database is initialized");
    //test every single pointer from anime
    console.log("Checking anime table....");
    for await (const k of db.iterateKeys("ANIME")) {
      let a = await db.getData<AnimeEntryInternal>("ANIME", k);
      if (!a)
        fail(
          "Key returned from iterator must be resolvable but it is not in fact"
        );
      assertSuccess(await checkRemoteReferencesAnimeEntry(db, a));
    }
    console.log("Anime table contain no dangling pointers");
    console.log("Checking...... characters table");
    for await (const k of db.iterateKeys("CHARACTER")) {
      let a = await db.getData<Character>("CHARACTER", k);
      if (!a) {
        fail(
          "Key returned from iterator must be resolvable but it is not in fact"
        );
      }
      assertSuccess(await checkRemoteReferencesCharacter(db, a));
    }
    console.log("Characters table checked");
  } finally {
    await db.close();
  }
}
