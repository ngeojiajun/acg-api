import { PathLike } from "fs";
import { IDatabase } from "../database/database";
import JsonDatabase from "../database/jsonDatabase";
import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Category, Character, People } from "../definitions/core";
import { assertFail, assertSuccess } from "./common_utils";

const testCategory1: Category = {
  id: 1,
  name: "fish",
};

const testAnime1: AnimeEntryInternal = {
  id: 1,
  name: "chicken",
  nameInJapanese: "鶏",
  year: 2000,
  description: "yo",
  author: [1],
  publisher: [1],
  category: [1],
};

const testCharacter: Character = {
  id: 0,
  name: "Haruka",
  nameInJapanese: "春華",
  description: "abv",
  gender: "female",
  presentOn: [{ id: 1, type: "anime" }],
};

const testPerson: People = {
  id: 0,
  name: "hana",
  nameInJapanese: "ハナ",
};

export async function JsonDatabaseTests(_temp: PathLike) {
  console.log("Initializing database");
  const database: IDatabase = new JsonDatabase(_temp + "/jsonDB");
  await database.init();
  console.log("Database initialized....");
  try {
    console.log("Filling with the test data");
    assertFail(
      await database.addData("ANIME", testAnime1),
      "Adding anime with dangling reference"
    );
    assertFail(
      await database.addData("CHARACTER", testCharacter),
      "Adding character with dangling reference"
    );
    assertSuccess(await database.addData("PERSON", testPerson));
    assertSuccess(await database.addData("CATEGORY", testCategory1));
    assertSuccess(await database.addData("ANIME", testAnime1));
    assertSuccess(await database.addData("CHARACTER", testCharacter));
  } finally {
    await database.close();
  }
}
