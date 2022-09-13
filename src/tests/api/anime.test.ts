import { KeyedEntry } from "../../definitions/core";
import { describe, it, afterAll, beforeAll } from "@jest/globals";
import { DatabaseTypes, IDatabase } from "../../database/database";
import { Application } from "express";
import request from "supertest";
import { Server } from "http";

/**
 * Tests on the test API so the data all endpoints success
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
  afterAll(() =>
    Promise.all([db.close(), new Promise((_) => server.close(_))])
  );
  it("Invalid anime id", async () => {
    await request(app).get("/anime/-1").expect(404);
  });
  it("Valid anime id", async () => {
    await request(app).get("/anime/1").expect(200);
  });
  it("Valid anime id with their own characters", async () => {
    await request(app).get("/anime/1/characters").expect(200);
  });
  it("All animes", async () => {
    await request(app).get("/anime/all").expect(200);
  });
  it("Search", async () => {
    await request(app).get("/anime/search?q=a").expect(200);
  });
  it("Categories", async () => {
    await request(app).get("/anime/categories").expect(200);
  });
  it("Person", async () => {
    await request(app).get("/anime/persons").expect(200);
  });
  it("Person with specific id", async () => {
    await request(app).get("/anime/person/1").expect(200);
  });
});
