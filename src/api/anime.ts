import express, { Application, NextFunction, Request, Response } from "express";
import { IDatabase } from "../database/database";
import { AnimeEntry } from "../definitions/anime";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { Character, People } from "../definitions/core";
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
  #decodeAnimeEntry(entry: any): AnimeEntry | null {
    //first check is it decodable as AnimeEntryInternal
    let decoded: AnimeEntryInternal | null = asAnimeEntryInternal(entry);
    if (!decoded) {
      return null;
    }
    //build a copied version of the entry
    let return_value: AnimeEntry = {
      ...decoded,
      author: [],
      publisher: [],
    };
    //now try to resolve the pointer at author
    for (const key of decoded.author) {
      //search the db for it
      let resolved = this.#database.getData<People>("PERSON", key);
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
    //now publisher's turn
    for (const key of decoded.publisher) {
      //search the db for it
      let resolved = this.#database.getData<People>("PERSON", key);
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
    return return_value;
  }

  #dbGetAnimeById(id: number): AnimeEntry | null {
    return this.#database.getData(
      "ANIME",
      id,
      this.#decodeAnimeEntry.bind(this)
    );
  }

  /**
   * Get all animes
   * @route /
   */
  #getAnimes(_request: Request, response: Response, next: NextFunction) {
    try {
      let response_json = [];
      for (const key of this.#database.iterateKeys("ANIME")) {
        //get every single anime entry
        //note this one always success because the validation done
        let entry = this.#dbGetAnimeById(key);
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
  #getAnimeById(request: Request, response: Response, next: NextFunction) {
    try {
      //try to get the id
      let { id } = request.params;
      if (!id || !/^\d+$/.test(id)) {
        this.#sendEntryNotFound(response);
        return;
      } else {
        //ask the db
        let result = this.#dbGetAnimeById(parseInt(id));
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
  #getAnimeCharactersById(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      //try to get the id
      let { id } = request.params;
      if (!id || !/^\d+$/.test(id)) {
        this.#sendEntryNotFound(response);
        return;
      } else {
        let parsed_id = parseInt(id);
        //search all characters related to the specified id
        let result: Character[] = [];
        let resolved_name: string | null = null;
        let iterator = this.#database.iterateKeys(
          "CHARACTER",
          (entry: Character) => {
            if (entry.presentOn.type !== "anime") {
              return false;
            }
            if (entry.presentOn.id === parsed_id) {
              //found
              if (resolved_name) {
                if (resolved_name !== entry.presentOn.name) {
                  console.warn(
                    `Inconsistency detected on the records. Expecting ${resolved_name} got ${entry.presentOn.name} for id ${parsed_id}`
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
        for (const entry of iterator) {
          let data = this.#database.getData<Character>("CHARACTER", entry);
          if (data) result.push(data);
        }
        //if the result empty check is the database weather the id is inexistant
        if (result.length > 0 || this.#database.getData("ANIME", parsed_id)) {
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
