import { PathLike } from "fs";
import { DatabaseTypes, IDatabase } from "../database/database";
import JsonDatabase from "../database/jsonDatabase";
import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Category, Character, People } from "../definitions/core";
import { assertFail, assertSuccess } from "./common_utils";
import "../utilities/prototype_patch";

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
    console.log("Testing illegal operations: addData");
    assertFail(
      await database.addData("PERSON", testPerson),
      "Adding duplicated data"
    );
    assertFail(
      await database.addData("CATEGORY", testCategory1),
      "Adding duplicated data"
    );
    assertFail(
      await database.addData("ANIME", testAnime1),
      "Adding duplicated data"
    );
    assertFail(
      await database.addData("CHARACTER", testCharacter),
      "Adding duplicated data"
    );
    //change the data a little bit
    testPerson.name = "123311";
    testCategory1.name = "123311";
    testCharacter.name = "123311";
    testAnime1.name = "123311";
    console.log("Adding another row");
    assertSuccess(await database.addData("PERSON", testPerson));
    assertSuccess(await database.addData("CATEGORY", testCategory1));
    assertSuccess(await database.addData("ANIME", testAnime1));
    assertSuccess(await database.addData("CHARACTER", testCharacter));
    console.log("Testing illegal operations: updateData");
    //undoing the changes
    testAnime1.name = "chicken";
    testCategory1.name = "fish";
    testCharacter.name = "Haruka";
    testPerson.name = "hana";
    //edit the second entry so it is similar to the first
    //but it should be fails
    assertFail(
      await database.updateData("ANIME", 2, testAnime1),
      "Update the data so it similar for another entry"
    );
    assertFail(
      await database.updateData("CATEGORY", 2, testCategory1),
      "Update the data so it similar for another entry"
    );
    assertFail(
      await database.updateData("CHARACTER", 2, testCharacter),
      "Update the data so it similar for another entry"
    );
    assertFail(
      await database.updateData("PERSON", 2, testPerson),
      "Update the data so it similar for another entry"
    );
    //test the delete
    console.log("Testing the delete operations");
    assertFail(
      await database.removeData("ANIME", 1),
      "Removing data which referred by others"
    );
    assertFail(
      await database.removeData("CATEGORY", 1),
      "Removing data which referred by others"
    );
    assertFail(
      await database.removeData("PERSON", 1),
      "Removing data which referred by others"
    );
    const types: DatabaseTypes[] = ["CHARACTER", "ANIME", "PERSON", "CATEGORY"];
    for (const type of types) {
      for (let i = 1; i < 3; i++) {
        assertSuccess(await database.removeData(type, i));
      }
    }
  } finally {
    await database.close();
  }
}
