/**
 * Intergity test toward the database
 */

import { IDatabase } from "./database/database";
import {
  checkRemoteReferencesAnimeEntry,
  checkRemoteReferencesCharacter,
} from "./database/integrityTestUtils";
import JsonDatabase from "./database/jsonDatabase";
import { AnimeEntryInternal } from "./definitions/anime.internal";
import { Character, Status } from "./definitions/core";

function fail(message: string = "Assertion failed"): never {
  throw new Error(message);
}

function assertSuccess(result: Status) {
  if (!result.success) {
    fail(result.message);
  }
}

async function main() {
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
  } catch (E) {
    console.error(`Test failed!`);
    console.error(E);
  } finally {
    db.close();
  }
}

const t = setInterval(() => {}, 1000);
main().finally(() => clearInterval(t));
