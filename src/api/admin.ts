import express, { Application, NextFunction, Request, Response } from "express";
import { AuthProvider } from "../authentication/auth_provider";
import ProtectedRoute from "../authentication/middlewares";
import { IDatabase } from "../database/database";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { asCharacter, asPeople } from "../definitions/converters";
import { People, Status, Character, Category } from "../definitions/core";
import { nonExistantRoute } from "./commonUtils";

/**
 * Contain routes for the administration use
 */
export default class AdminApi {
  #database: IDatabase;
  #authProvider: AuthProvider;
  constructor(database: IDatabase, authProvider: AuthProvider) {
    this.#database = database;
    this.#authProvider = authProvider;
  }
  asApplication(): Application {
    const app = express();
    if (this.#authProvider.canPerformAuth() && !process.env.DISABLE_ADMIN) {
      app.use(ProtectedRoute(this.#authProvider));
      app.post("/anime", this.addAnimeEntry.bind(this));
      app.post("/person", this.addPeopleEntry.bind(this));
      app.post("/character", this.addCharacterEntry.bind(this));
      app.post("/category", this.addCategoryEntry.bind(this));
    } else {
      console.warn(
        "The admin API is disabled as either the provider reported that the authentication is impossible"
      );
      console.warn(
        "or it is disabled through DISABLE_ADMIN environment variable"
      );
    }
    app.use(nonExistantRoute);
    return app;
  }
  /**
   * Add anime body in body
   * @route /anime POST
   */
  async addAnimeEntry(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      if (!request.body) {
        this.#send400(response);
        return;
      }
      let body: AnimeEntryInternal | null = asAnimeEntryInternal(request.body);
      if (!body) {
        this.#send400(response);
        return;
      }
      let result: Status = await this.#database.addData("ANIME", body);
      if (!result.success) {
        response.status(409).json({ error: result.message });
      } else {
        response.status(201).json({ id: result.message });
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * Add person in body
   * @route /person POST
   */
  async addPeopleEntry(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      if (!request.body) {
        this.#send400(response);
        return;
      }
      let body: People | null = asPeople(request.body);
      if (!body) {
        this.#send400(response);
        return;
      }
      let result: Status = await this.#database.addData("PERSON", body);
      if (!result.success) {
        response.status(409).json({ error: result.message });
      } else {
        response.status(201).json({ id: result.message });
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * Add character in body
   * @route /character POST
   */
  async addCharacterEntry(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      if (!request.body) {
        this.#send400(response);
        return;
      }
      let body: Character | null = asCharacter(request.body);
      if (!body) {
        this.#send400(response);
        return;
      }
      let result: Status = await this.#database.addData("CHARACTER", body);
      if (!result.success) {
        response.status(409).json({ error: result.message });
      } else {
        response.status(201).json({ id: result.message });
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * Add category in body
   * @route /category POST
   */
  async addCategoryEntry(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      if (!request.body) {
        this.#send400(response);
        return;
      }
      let body: Category | null = asCharacter(request.body);
      if (!body) {
        this.#send400(response);
        return;
      }
      let result: Status = await this.#database.addData("CATEGORY", body);
      if (!result.success) {
        response.status(409).json({ error: result.message });
      } else {
        response.status(201).json({ id: result.message });
      }
    } catch (e) {
      next(e);
    }
  }
  #send400(response: Response) {
    response.status(400).json({ error: "Missing params" }).end();
  }
}