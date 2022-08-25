import express, { Application, NextFunction, Request, Response } from "express";
import { AuthProvider } from "../authentication/auth_provider";
import ProtectedRoute from "../authentication/middlewares";
import { DatabaseTypes, IDatabase } from "../database/database";
import {
  ERROR_ENTRY_NOT_FOUND,
  ERROR_HAVING_REMOTE_DEPENCENCIES,
  ERROR_INTEGRITY_TEST_FAILED,
} from "../database/error_codes";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { asCategory, asCharacter, asPeople } from "../definitions/converters";
import { People, Status, Character, Category } from "../definitions/core";
import {
  asMangaEntryInternal,
  MangaEntryInternal,
} from "../definitions/manga.internal";
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
      app.post("/manga", this.addMangaEntry.bind(this));
      app.post("/person", this.addPeopleEntry.bind(this));
      app.post("/character", this.addCharacterEntry.bind(this));
      app.post("/category", this.addCategoryEntry.bind(this));
      app.patch("/anime/:id", this.updateAnimeEntry.bind(this));
      app.patch("/manga/:id", this.updateMangaEntry.bind(this));
      app.patch("/character/:id", this.updateCharacterEntry.bind(this));
      app.patch("/person/:id", this.updatePersonEntry.bind(this));
      app.patch("/category/:id", this.updateCategoryEntry.bind(this));
      app.delete("/anime/:id", this.#deleteEntry.bind(this, "ANIME"));
      app.delete("/manga/:id", this.#deleteEntry.bind(this, "MANGA"));
      app.delete("/character/:id", this.#deleteEntry.bind(this, "CHARACTER"));
      app.delete("/person/:id", this.#deleteEntry.bind(this, "PERSON"));
      app.delete("/category/:id", this.#deleteEntry.bind(this, "CATEGORY"));
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
  /**
   * update anime body in body
   * @route /anime/:id PATCH
   */
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
        } else if (status.code === ERROR_INTEGRITY_TEST_FAILED) {
          response.status(409).json({ error: status.message }).end();
          return;
        } else {
          this.#send400(response);
          return;
        }
      } else {
        response.status(201).json({ id }).end();
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * Add manga body in body
   * @route /manga POST
   */
  async addMangaEntry(
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
        !propsPersent(request.body, asMangaEntryInternal, [
          "id",
          "category",
          "author",
          "publisher",
          "isFinished",
        ])
      ) {
        //the required stuffs are missing, it wll definitely failed the conversion
        this.#send400(response);
        return;
      }
      //patch the request body so it is convertable by the original converter
      request.body.id = 0;
      let body: MangaEntryInternal | null = asMangaEntryInternal(request.body);
      if (!body) {
        this.#send400(response);
        return;
      }
      let result: Status = await this.#database.addData("MANGA", body);
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
   * update manga body in body
   * @route /manga/:id PATCH
   */
  async updateMangaEntry(
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
      if (!doesPatchEffects(request.body, asMangaEntryInternal, ["id"])) {
        //the body is valid but the it brings no effect when applied to the internal object
        this.#send400(response);
        return;
      }
      let status: Status = await this.#database.updateData(
        "MANGA",
        id,
        request.body
      );
      if (!status.success) {
        if (status.code === ERROR_ENTRY_NOT_FOUND) {
          response.status(404).json({ error: "Entry not found" }).end();
          return;
        } else if (status.code === ERROR_INTEGRITY_TEST_FAILED) {
          response.status(409).json({ error: status.message }).end();
          return;
        } else {
          this.#send400(response);
          return;
        }
      } else {
        response.status(201).json({ id }).end();
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
      //lets make a quick test on the request
      if (!propsPersent(request.body, asPeople, ["id"])) {
        //the required stuffs are missing, it wll definitely failed the conversion
        this.#send400(response);
        return;
      }
      //patch the request body so it is convertable by the original converter
      request.body.id = 0;
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
   * update character body in body
   * @route /person/:id PATCH
   */
  async updatePersonEntry(
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
      if (!doesPatchEffects(request.body, asPeople, ["id"])) {
        //the body is valid but the it brings no effect when applied to the internal object
        this.#send400(response);
        return;
      }
      let status: Status = await this.#database.updateData(
        "PERSON",
        id,
        request.body
      );
      if (!status.success) {
        if (status.code === ERROR_ENTRY_NOT_FOUND) {
          response.status(404).json({ error: "Entry not found" }).end();
          return;
        } else if (status.code === ERROR_INTEGRITY_TEST_FAILED) {
          response.status(409).json({ error: status.message }).end();
          return;
        } else {
          this.#send400(response);
          return;
        }
      } else {
        response.status(201).json({ id }).end();
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
      //lets make a quick test on the request
      if (!propsPersent(request.body, asCharacter, ["id"])) {
        //the required stuffs are missing, it wll definitely failed the conversion
        this.#send400(response);
        return;
      }
      //patch the request body so it is convertable by the original converter
      request.body.id = 0;
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
   * update character body in body
   * @route /character/:id PATCH
   */
  async updateCharacterEntry(
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
      if (!doesPatchEffects(request.body, asCharacter, ["id"])) {
        //the body is valid but the it brings no effect when applied to the internal object
        this.#send400(response);
        return;
      }
      let status: Status = await this.#database.updateData(
        "CHARACTER",
        id,
        request.body
      );
      if (!status.success) {
        if (status.code === ERROR_ENTRY_NOT_FOUND) {
          response.status(404).json({ error: "Entry not found" }).end();
          return;
        } else if (status.code === ERROR_INTEGRITY_TEST_FAILED) {
          response.status(409).json({ error: status.message }).end();
          return;
        } else {
          this.#send400(response);
          return;
        }
      } else {
        response.status(201).json({ id }).end();
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
      //lets make a quick test on the request
      if (!propsPersent(request.body, asCategory, ["id"])) {
        //the required stuffs are missing, it wll definitely failed the conversion
        this.#send400(response);
        return;
      }
      //patch the request body so it is convertable by the original converter
      request.body.id = 0;
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
  /**
   * update category body in body
   * @route /category/:id PATCH
   */
  async updateCategoryEntry(
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
      if (!doesPatchEffects(request.body, asCategory, ["id"])) {
        //the body is valid but the it brings no effect when applied to the internal object
        this.#send400(response);
        return;
      }
      let status: Status = await this.#database.updateData(
        "CATEGORY",
        id,
        request.body
      );
      if (!status.success) {
        if (status.code === ERROR_ENTRY_NOT_FOUND) {
          response.status(404).json({ error: "Entry not found" }).end();
          return;
        } else if (status.code === ERROR_INTEGRITY_TEST_FAILED) {
          response.status(409).json({ error: status.message }).end();
          return;
        } else {
          this.#send400(response);
          return;
        }
      } else {
        response.status(201).json({ id }).end();
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * delete something from the table
   * @route /<table>>/:id DELETE
   */
  async #deleteEntry(
    type: DatabaseTypes,
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
      let status: Status = await this.#database.removeData(type, id);
      if (!status.success) {
        if (status.code === ERROR_ENTRY_NOT_FOUND) {
          response.status(404).json({ error: "Entry not found" }).end();
          return;
        } else if (status.code === ERROR_HAVING_REMOTE_DEPENCENCIES) {
          response
            .status(409)
            .json({
              error:
                "Cannot remove the entry as it is refered by other entries",
            })
            .end();
          return;
        } else {
          response.status(500).json({ error: "Internal error happened" }).end();
        }
      } else {
        response.status(204).end();
      }
    } catch (e) {
      next(e);
    }
  }
  #send400(response: Response) {
    response.status(400).json({ error: "Missing params" }).end();
  }
}
