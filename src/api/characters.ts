import express, { Application, NextFunction, Request, Response } from "express";
import { Condition, IDatabase } from "../database/database";
import { asCharacter } from "../definitions/converters";
import { Character } from "../definitions/core";
import { tryParseInteger } from "../utils";
import { errorHandler, nonExistantRoute } from "./commonUtils";

export default class CharacterApi {
  #database: IDatabase;
  constructor(database: IDatabase) {
    this.#database = database;
  }
  asApplication(): Application {
    const app = express();
    app.disable("x-powered-by");
    app.get("/all", this.#getCharacters.bind(this));
    app.get("/search", this.#searchCharacters.bind(this));
    app.get("/:id", this.#getCharactersById.bind(this));
    app.use(nonExistantRoute);
    app.use(errorHandler);
    return app;
  }
  async #dbGetCharacterById(id: number): Promise<Character | null> {
    let value = await this.#database.getData("CHARACTER", id, asCharacter);
    if (!value) {
      return null;
    }
    //add some data for it
    for (const entry of value.presentOn) {
      //resolve the stuffs
      switch (entry.type) {
        case "anime": {
          let resolved = await this.#database.getData("ANIME", entry.id);
          if (!resolved) {
            console.error(`Cannot resolve dependency at CHARACTER id=${id}`);
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
    }
    return value;
  }
  /**
   * Get all characters
   * @route /all
   */
  async #getCharacters(
    _request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let response_json = [];
      for await (const key of this.#database.iterateKeys("CHARACTER")) {
        //get every single character entry
        //note this one always success because the validation done
        let entry = await this.#dbGetCharacterById(key);
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
   * Get character by id
   * @route /:id
   */
  async #getCharactersById(
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
        let result = await this.#dbGetCharacterById(id);
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
   * Get search character
   * @route /search
   */
  async #searchCharacters(
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
        ] as Condition<Character, "INCLUDES_INSENSITIVE">[],
        "OR"
      )) {
        //get every single anime entry
        //note this one always success because the validation done
        let entry = await this.#dbGetCharacterById(key);
        if (entry) {
          response_json.push(entry);
        }
      }
      response.status(200).type("json").json(response_json).end();
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
