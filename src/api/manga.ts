import express, { Application, NextFunction, Request, Response } from "express";
import { Condition, DatabaseTypes, IDatabase } from "../database/database";
import { asCategory, asPeople } from "../definitions/converters";
import {
  Category,
  Character,
  CharacterPresence,
  People,
} from "../definitions/core";
import { MangaEntry } from "../definitions/manga";
import {
  asMangaEntryInternal,
  MangaEntryInternal,
} from "../definitions/manga.internal";
import { tryParseInteger } from "../utils";
import { errorHandler, nonExistantRoute } from "./commonUtils";

export default class MangaApi {
  #database: IDatabase;
  constructor(database: IDatabase) {
    this.#database = database;
  }
  asApplication(): Application {
    const app = express();
    app.disable("x-powered-by");
    app.get("/all", this.#getMangas.bind(this));
    app.get("/search", this.#searchMangas.bind(this));
    app.get("/categories", this.#listCategories.bind(this));
    app.get("/persons", this.#listPersons.bind(this));
    app.get("/person/:id", this.#getMangasByPerson.bind(this));
    app.get("/category/:id", this.#getMangasByCategory.bind(this));
    app.get("/:id/characters", this.#getMangaCharactersById.bind(this));
    app.get("/:id", this.#getMangaById.bind(this));
    app.use(nonExistantRoute);
    app.use(errorHandler);
    return app;
  }

  /**
   * Converter function to decode the internal representation of manga into the full response
   * @param entry the entry
   * @returns the decoded entry if all pointers are resolvable
   */
  async #decodeMangaEntry(entry: any): Promise<MangaEntry | null> {
    //first check is it decodable as MangaEntryInternal
    let decoded: MangaEntryInternal | null = asMangaEntryInternal(entry);
    if (!decoded) {
      return null;
    }
    //build a copied version of the entry
    let return_value: MangaEntry = {
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
            "Refusing to convert to MangaEntry because of the dangling pointer"
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
            "Refusing to convert to MangaEntry because of the dangling pointer"
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
            "Refusing to convert to MangaEntry because of the dangling pointer"
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

  #dbGetMangaById(id: number): Promise<MangaEntry | null> {
    return this.#database.getData<MangaEntry>(
      "MANGA",
      id,
      this.#decodeMangaEntry.bind(this)
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
   * Get all persons
   * @route /persons
   */
  async #listPersons(
    _request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let response_json: People[] = [];
      for await (const key of this.#database.iterateKeys("PERSON")) {
        //note this one always success because the validation done
        let entry = await this.#database.getData("PERSON", key, asPeople);
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
   * Get all mangas
   * @route /all
   */
  async #getMangas(_request: Request, response: Response, next: NextFunction) {
    try {
      let response_json = [];
      for await (const key of this.#database.iterateKeys("MANGA")) {
        //get every single manga entry
        //note this one always success because the validation done
        let entry = await this.#dbGetMangaById(key);
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
   * Get search mangas
   * @route /search
   */
  async #searchMangas(
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
        "MANGA",
        null,
        [
          { key: "name", op: "INCLUDES_INSENSITIVE", rhs: q },
          { key: "nameInJapanese", op: "INCLUDES_INSENSITIVE", rhs: q },
        ] as Condition<MangaEntryInternal, "INCLUDES_INSENSITIVE">[],
        "OR"
      )) {
        //get every single manga entry
        //note this one always success because the validation done
        let entry = await this.#dbGetMangaById(key);
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
   * Get search manga
   * @route /category/:id
   */
  async #getMangasByCategory(
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
        //search all mangas related to the specified id
        let result: MangaEntry[] = [];
        let iterator = this.#database.iterateKeysIf<"MANGA">("MANGA", null, [
          { key: "category", op: "INCLUDES_SET", rhs: [id] },
        ]);
        //add those into the result set
        for await (const key of iterator) {
          let data = await this.#dbGetMangaById(key);
          if (data) result.push(data);
        }
        response.status(200).type("json").json(result);
      }
    } catch (e) {
      next(e);
    }
  }
  /**
   * Get search manga
   * @route /person/:id
   */
  async #getMangasByPerson(
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
      } else if (!(await this.#database.getData("PERSON", id, asPeople))) {
        //return 404 when the category id itself is not existant
        this.#sendEntryNotFound(response);
        return;
      } else {
        //search all mangas related to the specified id
        let result: MangaEntry[] = [];
        let iterator = this.#database.iterateKeysIf<"MANGA">(
          "MANGA",
          null,
          [
            { key: "author", op: "INCLUDES_SET", rhs: [id] },
            { key: "publisher", op: "INCLUDES_SET", rhs: [id] },
          ],
          "OR"
        );
        //add those into the result set
        for await (const key of iterator) {
          let data = await this.#dbGetMangaById(key);
          if (data) result.push(data);
        }
        response.status(200).type("json").json(result);
      }
    } catch (e) {
      next(e);
    }
  }

  /**
   * Get all mangas
   * @route /:id
   */
  async #getMangaById(
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
        let result = await this.#dbGetMangaById(id);
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
   * Get all mangas
   * @route /:id/characters
   */
  async #getMangaCharactersById(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      //try to get the id
      let id = tryParseInteger(request.params.id);
      let manga_data: MangaEntryInternal | null = null;
      if (!id || !(manga_data = await this.#database.getData("MANGA", id))) {
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
              rhs: (entries: CharacterPresence[]) => {
                for (const entry of entries) {
                  if (entry.type !== "manga") {
                    continue;
                  }
                  if (entry.id === id) {
                    return true;
                  }
                }
                return false;
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
          if (!data) {
            continue;
          }
          //add some data for it
          for (const entry of data.presentOn) {
            //resolve the stuffs
            switch (entry.type) {
              case "anime":
              case "manga": {
                let resolved = await this.#database.getData(
                  entry.type.toUpperCase() as DatabaseTypes,
                  entry.id
                );
                if (!resolved) {
                  console.error(
                    `Cannot resolve dependency at CHARACTER id=${id}`
                  );
                  return null;
                } else {
                  (entry as any).name = resolved.name;
                }
                break;
              }
              default:
                console.error(`Unimplemented type ${entry.type}`);
                return null;
            }
            result.push(data);
          }
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
