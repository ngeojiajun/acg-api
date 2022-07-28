import express, { Application, NextFunction, Request, Response } from "express";
import { IDatabase } from "../database/database";
import { AnimeEntry } from "../definitions/anime";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { Category, Character, People } from "../definitions/core";
import { tryParseInteger } from "../utils";
import { nonExistantRoute } from "./commonUtils";

export default class AnimeApi {
  #database: IDatabase;
  constructor(database: IDatabase) {
    this.#database = database;
  }
  asApplication(): Application {
    const app = express();
    app.get("/all", this.#getAnimes.bind(this));
    app.use("/:id/characters", this.#getAnimeCharactersById.bind(this));
    app.use("/:id", this.#getAnimeById.bind(this));
    app.use(nonExistantRoute);
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
      if (!id) {
        this.#sendEntryNotFound(response);
        return;
      } else {
        //search all characters related to the specified id
        let result: Character[] = [];
        let resolved_name: string | null = null;
        let iterator = this.#database.iterateKeys(
          "CHARACTER",
          (entry: Character) => {
            if (entry.presentOn.type !== "anime") {
              return false;
            }
            if (entry.presentOn.id === id) {
              //found
              if (resolved_name) {
                if (resolved_name !== entry.presentOn.name) {
                  console.warn(
                    `Inconsistency detected on the records. Expecting ${resolved_name} got ${entry.presentOn.name} for id ${id}`
                  );
                  return false;
                } else {
                  resolved_name = entry.presentOn.name;
                }
              }
              return true;
            } else {
              return false;
            }
          }
        );
        //add those into the result set
        for await (const entry of iterator) {
          let data = await this.#database.getData<Character>(
            "CHARACTER",
            entry
          );
          if (data) result.push(data);
        }
        //if the result empty check is the database weather the id is inexistant
        if (result.length > 0 || (await this.#database.getData("ANIME", id))) {
          response.status(200).type("json").json(result);
        } else {
          this.#sendEntryNotFound(response);
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
