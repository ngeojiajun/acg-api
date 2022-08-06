import express, { Application, NextFunction, Request, Response } from "express";
import { Condition, IDatabase } from "../database/database";
import { AnimeEntry } from "../definitions/anime";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { asCategory } from "../definitions/converters";
import {
  Category,
  Character,
  CharacterPresence,
  People,
} from "../definitions/core";
import { tryParseInteger } from "../utils";
import { errorHandler, nonExistantRoute } from "./commonUtils";

export default class AnimeApi {
  #database: IDatabase;
  constructor(database: IDatabase) {
    this.#database = database;
  }
  asApplication(): Application {
    const app = express();
    app.disable("x-powered-by");
    app.get("/all", this.#getAnimes.bind(this));
    app.get("/search", this.#searchAnimes.bind(this));
    app.get("/categories", this.#listCategories.bind(this));
    app.get("/category/:id", this.#getAnimesByCategory.bind(this));
    app.get("/:id/characters", this.#getAnimeCharactersById.bind(this));
    app.get("/:id", this.#getAnimeById.bind(this));
    app.use(nonExistantRoute);
    app.use(errorHandler);
    return app;
  }

  /**
   * Converter function to decode the internal representation of anime into the full response
   * @param entry the entry
   * @returns the decoded entry if all pointers are resolvable
   */
  async #decodeAnimeEntry(entry: any): Promise<AnimeEntry | null> {
    //first check is it decodable as AnimeEntryInternal
    let decoded: AnimeEntryInternal | null = asAnimeEntryInternal(entry);
    if (!decoded) {
      return null;
    }
    //build a copied version of the entry
    let return_value: AnimeEntry = {
      ...decoded,
      category: [],
      author: [],
      publisher: [],
    };
    //now try to resolve the pointer at author
    if (decoded.author) {
      for (const key of decoded.author) {
        //search the db for it
        let resolved = await this.#database.getData<People>("PERSON", key);
        if (!resolved) {
          console.error(
            "Refusing to convert to AnimeEntry because of the dangling pointer"
          );
          console.error(`Cannot find entry which resolves the id=${key}`);
          return null;
        } else {
          return_value.author?.push(resolved);
        }
      }
    }
    if (decoded.publisher) {
      //now publisher's turn
      for (const key of decoded.publisher) {
        //search the db for it
        let resolved = await this.#database.getData<People>("PERSON", key);
        if (!resolved) {
          console.error(
            "Refusing to convert to AnimeEntry because of the dangling pointer"
          );
          console.error(`Cannot find entry which resolves the id=${key}`);
          return null;
        } else {
          return_value.publisher?.push(resolved);
        }
      }
    }
    //finally try resolve the categories
    if (decoded.category) {
      for (const key of decoded.category) {
        //search the db for it
        let resolved = await this.#database.getData<Category>("CATEGORY", key);
        if (!resolved) {
          console.error(
            "Refusing to convert to AnimeEntry because of the dangling pointer"
          );
          console.error(`Cannot find entry which resolves the id=${key}`);
          return null;
        } else {
          return_value.category?.push(resolved);
        }
      }
    }
    return return_value;
  }

  #dbGetAnimeById(id: number): Promise<AnimeEntry | null> {
    return this.#database.getData<AnimeEntry>(
      "ANIME",
      id,
      this.#decodeAnimeEntry.bind(this)
    );
  }

  /**
   * Get all categories
   * @route /categories
   */
  async #listCategories(
    _request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let response_json: Category[] = [];
      for await (const key of this.#database.iterateKeys("CATEGORY")) {
        //note this one always success because the validation done
        let entry = await this.#database.getData("CATEGORY", key, asCategory);
        if (entry) {
          response_json.push(entry);
        }
      }
      response.status(200).type("json").json(response_json).end();
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get all animes
   * @route /all
   */
  async #getAnimes(_request: Request, response: Response, next: NextFunction) {
    try {
      let response_json = [];
      for await (const key of this.#database.iterateKeys("ANIME")) {
        //get every single anime entry
        //note this one always success because the validation done
        let entry = await this.#dbGetAnimeById(key);
        if (entry) {
          response_json.push(entry);
        }
      }
      response.status(200).type("json").json(response_json).end();
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get search animes
   * @route /search
   */
  async #searchAnimes(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let { q } = request.query;
      if (!q || typeof q !== "string" || q.trim().length === 0) {
        response.status(400).json({ error: "Missing query string" }).end();
        return;
      }
      let response_json = [];
      for await (const key of this.#database.iterateKeysIf(
        "ANIME",
        null,
        [
          { key: "name", op: "INCLUDES_INSENSITIVE", rhs: q },
          { key: "nameInJapanese", op: "INCLUDES_INSENSITIVE", rhs: q },
        ] as Condition<AnimeEntryInternal, "INCLUDES_INSENSITIVE">[],
        "OR"
      )) {
        //get every single anime entry
        //note this one always success because the validation done
        let entry = await this.#dbGetAnimeById(key);
        if (entry) {
          response_json.push(entry);
        }
      }
      response.status(200).type("json").json(response_json).end();
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get search animes
   * @route /category/:id
   */
  async #getAnimesByCategory(
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
      } else if (!(await this.#database.getData("CATEGORY", id, asCategory))) {
        //return 404 when the category id itself is not existant
        this.#sendEntryNotFound(response);
        return;
      } else {
        //search all animes related to the specified id
        let result: AnimeEntry[] = [];
        let iterator = this.#database.iterateKeysIf<"ANIME">("ANIME", null, [
          { key: "category", op: "INCLUDES_SET", rhs: [id] },
        ]);
        //add those into the result set
        for await (const key of iterator) {
          let data = await this.#dbGetAnimeById(key);
          if (data) result.push(data);
        }
        response.status(200).type("json").json(result);
      }
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get all animes
   * @route /:id
   */
  async #getAnimeById(
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
        let result = await this.#dbGetAnimeById(id);
        if (!result) {
          this.#sendEntryNotFound(response);
          return;
        } else {
          response.status(200).type("json").json(result).end();
        }
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * Get all animes
   * @route /:id/characters
   */
  async #getAnimeCharactersById(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      //try to get the id
      let id = tryParseInteger(request.params.id);
      if (!id || !(await this.#database.getData("ANIME", id))) {
        this.#sendEntryNotFound(response);
        return;
      } else {
        //search all characters related to the specified id
        let result: Character[] = [];
        let iterator = this.#database.iterateKeysIf<"CHARACTER">(
          "CHARACTER",
          undefined,
          [
            {
              key: "presentOn",
              op: "EVAL_JS", //note that EVAL_JS has very high performance penalty so use with care
              rhs: (entry: CharacterPresence) => {
                if (entry.type !== "anime") {
                  return false;
                }
                if (entry.id === id) {
                  return true;
                } else {
                  return false;
                }
              },
            },
          ]
        );
        //add those into the result set
        for await (const entry of iterator) {
          let data = await this.#database.getData<Character>(
            "CHARACTER",
            entry
          );
          if (data) result.push(data);
        }
        response.status(200).type("json").json(result);
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
