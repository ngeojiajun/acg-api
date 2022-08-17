import express, { Application, NextFunction, Request, Response } from "express";
import { IDatabase } from "../database/database";
import { errorHandler, nonExistantRoute } from "./commonUtils";

export default class CharacterApi {
  #database: IDatabase;
  constructor(database: IDatabase) {
    this.#database = database;
  }
  asApplication(): Application {
    const app = express();
    app.disable("x-powered-by");
    app.use(nonExistantRoute);
    app.use(errorHandler);
    return app;
  }
}
