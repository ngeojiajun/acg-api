/**
 * Intergity test toward the database
 */

import { IDatabase } from "./database/database";
import JsonDatabase from "./database/jsonDatabase";
import { AnimeEntryInternal } from "./definitions/anime.internal";
import { Character } from "./definitions/core";

function fail(message: string = "Assertion failed"): never {
  throw new Error(message);
}

function main() {
  let db: IDatabase = new JsonDatabase("./data/");
  console.log("Database is initializing");
  db.init();
  console.log("Database is initialized");
  //test every single pointer from anime
  console.log("Checking anime table....");
  for (const k of db.iterateKeys("ANIME")) {
    let a = db.getData<AnimeEntryInternal>("ANIME", k);
    if (!a)
      fail(
        "Key returned from iterator must be resolvable but it is not in fact"
      );
    //merge the ptrs
    let ptrs = [...(a.author ?? [])];
    a.publisher?.forEach((v) => {
      if (!ptrs.includes(v)) {
        ptrs.push(v);
      }
    });
    //test all ptrs
    ptrs.forEach((key) => {
      let data = db.getData("PERSON", key);
      if (!data) {
        fail(
          `Failed to resolve pointer CHARACTER{id=${key}} at ANIME{id=${k}}`
        );
      }
    });
    //now test the categories
    if (a.category) {
      for (const key of a.category) {
        let data = db.getData("CATEGORY", key);
        if (!data) {
          fail(
            `Failed to resolve pointer CATEGORY{id=${key}} at ANIME{id=${k}}`
          );
        }
      }
    }
  }
  console.log("Anime table contain no dangling pointers");
  console.log("Testing characters table");
  for (const k of db.iterateKeys("CHARACTER")) {
    let a = db.getData<Character>("CHARACTER", k);
    if (!a) {
      fail(
        "Key returned from iterator must be resolvable but it is not in fact"
      );
    }
    //try to resolve the pointer
    let anime = db.getData<AnimeEntryInternal>("ANIME", a.presentOn.id);
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
}

main();
