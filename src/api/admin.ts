import express, { Application, NextFunction, Request, Response } from "express";
import { AuthProvider } from "../authentication/auth_provider";
import ProtectedRoute from "../authentication/middlewares";
import { ERROR_ENTRY_NOT_FOUND, IDatabase } from "../database/database";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { asCategory, asCharacter, asPeople } from "../definitions/converters";
import { People, Status, Character, Category } from "../definitions/core";
import { doesPatchEffects, propsPersent } from "../utilities/sanitise";
import { tryParseInteger } from "../utils";
import { errorHandler, nonExistantRoute } from "./commonUtils";

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
    app.disable("x-powered-by");
    if (this.#authProvider.canPerformAuth() && !process.env.DISABLE_ADMIN) {
      app.use(ProtectedRoute(this.#authProvider));
      app.post("/anime", this.addAnimeEntry.bind(this));
      app.post("/person", this.addPeopleEntry.bind(this));
      app.post("/character", this.addCharacterEntry.bind(this));
      app.post("/category", this.addCategoryEntry.bind(this));
      app.patch("/anime/:id", this.updateAnimeEntry.bind(this));
      app.use(errorHandler);
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
      //lets make a quick test on the request
      if (
        !propsPersent(request.body, asAnimeEntryInternal, [
          "id",
          "category",
          "author",
          "publisher",
        ])
      ) {
        //the required stuffs are missing, it wll definitely failed the conversion
        this.#send400(response);
        return;
      }
      //patch the request body so it is convertable by the original converter
      request.body.id = 0;
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
  async updateAnimeEntry(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      //first try to validate the request body
      if (!request.body) {
        this.#send400(response);
        return;
      }
      const id = tryParseInteger(request.params.id);
      //check the id itself
      if (!id) {
        response.status(404).json({ error: "Entry not found" }).end();
        return;
      }
      //check the patch and ensure it is valid
      if (!doesPatchEffects(request.body, asAnimeEntryInternal, ["id"])) {
        //the body is valid but the it brings no effect when applied to the internal object
        this.#send400(response);
        return;
      }
      let status: Status = await this.#database.updateData(
        "ANIME",
        id,
        request.body
      );
      if (!status.success) {
        if (status.code === ERROR_ENTRY_NOT_FOUND) {
          response.status(404).json({ error: "Entry not found" }).end();
          return;
        } else {
          this.#send400(response);
          return;
        }
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
      let body: Category | null = asCategory(request.body);
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
