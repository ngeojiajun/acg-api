import express, { Application, NextFunction, Request, Response } from "express";
import { DatabaseTypes, IDatabase } from "../database/database";
import { tryParseInteger } from "../utils";
import { errorHandler, nonExistantRoute, sendNotModified } from "./commonUtils";

/**
 * Special class of routes that return raw data
 */
export default class RawDataApi {
  #database: IDatabase;
  constructor(database: IDatabase) {
    this.#database = database;
  }
  asApplication(): Application {
    const app = express();
    const tables: DatabaseTypes[] = [
      "ANIME",
      "CATEGORY",
      "CHARACTER",
      "MANGA",
      "PERSON",
    ];
    app.disable("x-powered-by");
    for (const table of tables) {
      console.log(table);
      app.get(`/${table.toLowerCase()}`, this.#listAllIds.bind(this, table));
      app.get(
        `/${table.toLowerCase()}/:id`,
        sendNotModified.bind(null, this.#database, table),
        this.#getByIds.bind(this, table)
      );
    }
    app.use(nonExistantRoute);
    app.use(errorHandler);
    return app;
  }
  /**
   * list all ids
   */
  async #listAllIds(
    table: DatabaseTypes,
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let response_json = [];
      for await (const key of this.#database.iterateKeys(table)) {
        response_json.push(key);
      }
      response.status(200).type("json").json(response_json).end();
    } catch (e) {
      next(e);
    }
  }
  async #getByIds(
    table: DatabaseTypes,
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      //try to get the id
      let id = tryParseInteger(request.params.id);
      if (!id) {
        this.#sendEntryNotFound(response);
        return;
      } else {
        //ask the db
        let result = await this.#database.getData(table, id);
        if (!result) {
          this.#sendEntryNotFound(response);
          return;
        } else {
          response.setHeader(
            "Etag",
            (await this.#database.getHash(table, id))!
          );
          response.status(200).type("json").json(result).end();
        }
      }
    } catch (e) {
      next(e);
    }
  }
  #sendEntryNotFound(response: Response) {
    response
      .status(404)
      .json({
        error: "Entry not found",
      })
      .end();
  }
}
