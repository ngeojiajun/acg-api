import { describe, expect, it, afterAll, beforeAll } from "@jest/globals";
import { mkdtempSync, rmSync } from "fs";
import { DatabaseTypes, IDatabase } from "../database/database";
import JsonDatabase from "../database/jsonDatabase";
import { AnimeEntryInternal } from "../definitions/anime.internal";
import { Category, Character, People, Status } from "../definitions/core";
//required for the inline includesIgnoreCase and equalsIgnoreCase
import "../utilities/prototype_patch";
import { MangaEntryInternal } from "../definitions/manga.internal";
import { computeHashForObject } from "../utilities/hashing";
import path from "path";
import os from "os";
import { expectFail, expectSuccess } from "./common_utils";

/**
 * Static data for the test suite
 */
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

const testManga1: MangaEntryInternal = {
  id: 1,
  name: "chicken",
  nameInJapanese: "鶏",
  year: 2000,
  description: "yo",
  isFinished: false,
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
  presentOn: [
    { id: 1, type: "anime" },
    { id: 1, type: "manga" },
  ],
};

const testPerson: People = {
  id: 0,
  name: "hana",
  nameInJapanese: "ハナ",
};

/**
 * The temporary folder for the test
 */
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "acg-api"));

describe("jsonDatabase engine", () => {
  const database: IDatabase = new JsonDatabase(tmpDir + "/jsonDB");
  beforeAll(() =>
    database.init().then(() => {
      console.log("Database initialized");
    })
  );
  afterAll(async () => {
    //close the database
    await database.close();
    //nuke the test directory
    rmSync(tmpDir, { recursive: true });
  });
  it("The data with dangling reference should fails", async () => {
    expectFail(await database.addData("ANIME", testAnime1));
    expectFail(await database.addData("MANGA", testManga1));
    expectFail(await database.addData("CHARACTER", testCharacter));
  });
  it("The adding process shall suceeded if there is no dangling references", async () => {
    expectSuccess(await database.addData("PERSON", testPerson));
    expectSuccess(await database.addData("CATEGORY", testCategory1));
    expectSuccess(await database.addData("ANIME", testAnime1));
    expectSuccess(await database.addData("MANGA", testManga1));
    expectSuccess(await database.addData("CHARACTER", testCharacter));
  });
  it("The attempt to add the duplicated should end up with failure", async () => {
    expectFail(await database.addData("PERSON", testPerson));
    expectFail(await database.addData("CATEGORY", testCategory1));
    expectFail(await database.addData("ANIME", testAnime1));
    expectFail(await database.addData("MANGA", testManga1));
    expectFail(await database.addData("CHARACTER", testCharacter));
  });
  it("Another add test where the data is definitely not exists", async () => {
    testPerson.name = "123311";
    testCategory1.name = "123311";
    testCharacter.name = "123311";
    testAnime1.name = "123311";
    testManga1.name = "12334";
    expectSuccess(await database.addData("PERSON", testPerson));
    expect(await database.getHash("PERSON", 2)).toBe(
      computeHashForObject({ ...testPerson, id: 2 })
    );
    expectSuccess(await database.addData("CATEGORY", testCategory1));
    expect(await database.getHash("CATEGORY", 2)).toBe(
      computeHashForObject({ ...testCategory1, id: 2 })
    );
    expectSuccess(await database.addData("ANIME", testAnime1));
    expect(await database.getHash("ANIME", 2)).toBe(
      computeHashForObject({ ...testAnime1, id: 2 })
    );
    expectSuccess(await database.addData("MANGA", testManga1));
    expect(await database.getHash("MANGA", 2)).toBe(
      computeHashForObject({ ...testManga1, id: 2 })
    );
    expectSuccess(await database.addData("CHARACTER", testCharacter));
    expect(await database.getHash("CHARACTER", 2)).toBe(
      computeHashForObject({ ...testCharacter, id: 2 })
    );
  });
  it("Attempt to update it so become similar to other rows should fails", async () => {
    //undoing the changes
    testAnime1.name = "chicken";
    testManga1.name = "chicken";
    testCategory1.name = "fish";
    testCharacter.name = "Haruka";
    testPerson.name = "hana";
    expectFail(await database.updateData("ANIME", 2, testAnime1));
    expectFail(await database.updateData("MANGA", 2, testManga1));
    expectFail(await database.updateData("CATEGORY", 2, testCategory1));
    expectFail(await database.updateData("CHARACTER", 2, testCharacter));
    expectFail(await database.updateData("PERSON", 2, testPerson));
  });
  it("Attempt to remove entries still refered by other entries should fails", async () => {
    expectFail(await database.removeData("MANGA", 1));
    expectFail(await database.removeData("ANIME", 1));
    expectFail(await database.removeData("CATEGORY", 1));
    expectFail(await database.removeData("PERSON", 1));
  });
  it("Normal delete should works", async () => {
    const types: DatabaseTypes[] = [
      "CHARACTER",
      "ANIME",
      "MANGA",
      "PERSON",
      "CATEGORY",
    ];
    for (const type of types) {
      for (let i = 1; i < 3; i++) {
        expectSuccess(await database.removeData(type, i));
      }
    }
  });
});
