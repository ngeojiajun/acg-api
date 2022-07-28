/**
 * Intergity test toward the database
 */

import { IDatabase } from "./database/database";
import { checkRemoteReferences } from "./database/integrityTestUtils";
import JsonDatabase from "./database/jsonDatabase";
import { AnimeEntryInternal } from "./definitions/anime.internal";
import { Character } from "./definitions/core";

function fail(message: string = "Assertion failed"): never {
  throw new Error(message);
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
      let { success, message } = checkRemoteReferences(db, a);
      if (!success) {
        fail(message);
      }
    }
    console.log("Anime table contain no dangling pointers");
    console.log("Testing characters table");
    for await (const k of db.iterateKeys("CHARACTER")) {
      let a = await db.getData<Character>("CHARACTER", k);
      if (!a) {
        fail(
          "Key returned from iterator must be resolvable but it is not in fact"
        );
      }
      //try to resolve the pointer
      let anime = await db.getData<AnimeEntryInternal>("ANIME", a.presentOn.id);
      if (!anime) {
        fail(
          `Failed to resolve pointer ANIME{id=${a.presentOn.id}} at CHARACTER{id=${k}}`
        );
      }
      //compare the ptrs
      if (a.presentOn.name !== anime.name) {
        fail(
          `Inconsistant value detected!! At ANIME name=${anime.name} but inside CHARACTER it was ${a.presentOn.name}`
        );
      }
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
