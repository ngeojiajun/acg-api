import { KeyedEntry } from "../../definitions/core";
import { describe, it, afterAll, beforeAll } from "@jest/globals";
import { DatabaseTypes, IDatabase } from "../../database/database";
import { Application } from "express";
import request from "supertest";
import { Server } from "http";

const endpoints: DatabaseTypes[] = [
  "ANIME",
  "CATEGORY",
  "CHARACTER",
  "MANGA",
  "PERSON",
];
/**
 * Tests on the raw API so the data responsed is exactly same with the endpoint
 */
//dont save anything to the filesystem
process.env.JSON_DB_EMPHERAL = "1";
describe("Raw Anime API", () => {
  let app: Application, db: IDatabase, server: Server;
  beforeAll(async () => {
    const _module = await import("../../index");
    app = _module.app;
    db = _module.db;
    server = await _module.initDone;
  });
  afterAll(() => {
    db.close().then(() => server.close());
  });
  // it("Manga", async () => {
  //   await request(app).get(list["MANGA"]).expect(200);
  //   await expectExactResult(app, db, "MANGA", 1);
  //   await expectExactResult(app, db, "MANGA", -1);
  // });
  // it("Anime", async () => {
  //   await request(app).get(list["ANIME"]).expect(200);
  //   await expectExactResult(app, db, "ANIME", 1);
  //   await expectExactResult(app, db, "ANIME", -1);
  // });
  for (const name of endpoints) {
    it(name.toLowerCase(), async () => {
      await request(app).get(list[name]).expect(200);
      await expectExactResult(app, db, name, 1);
      await expectExactResult(app, db, name, -1);
    });
  }
});

const list: {
  [key: string]: string;
} = {};
for (const name of endpoints) {
  list[name] = `/raw/${name.toLowerCase()}`;
}
/**
 * Check to ensure the express api and the backend returns same result
 */
async function expectExactResult<T extends DatabaseTypes>(
  app: Application,
  db: IDatabase,
  type: T,
  id: KeyedEntry["id"]
): Promise<void> {
  const endpoint = list[type];
  //get the stuffs from database
  const result = await db.getData(type, id);
  const _request = request(app).get(`${endpoint}/${id}`);
  //request
  if (result !== null) {
    await _request.expect(200, result);
  } else {
    await _request.expect(404);
  }
}
