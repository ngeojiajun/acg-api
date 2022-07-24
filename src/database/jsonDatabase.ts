import { readFileSync } from "fs";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import { asArrayOf, asPeople } from "../definitions/converters";
import { KeyedEntry, People } from "../definitions/core";
import { Cached, findEntry, makeCached } from "../utilities/cached";
import { allowIfNotProd } from "../utils";
import { DatabaseTypes, IDatabase } from "./database";

/**
 * Internal variable holding the locally parsed stuff
 */
type InternalParsedMap = {
  /**
   * the anime table
   */
  anime?: Cached<AnimeEntryInternal>;
  /**
   * The person table - this is unrelated to the characters in animes
   */
  person?: Cached<People>;
};

/**
 * This database returns the data from the local json file
 */
export default class JsonDatabase implements IDatabase {
  /**
   * The name of file that the database should load from
   */
  filename: string;
  #database: InternalParsedMap;
  constructor(filename: string) {
    console.warn("This class contains schema which is under heavy development");
    this.filename = filename;
    this.#database = {};
  }
  init() {
    let data: any = JSON.parse(
      readFileSync(this.filename, {
        encoding: "utf8",
      })
    );
    //quick check to see weather the stuffs is there
    const required_key: string[] = ["anime", "person"];
    for (const key of required_key) {
      if (!data[key]) {
        throw new Error(
          `Cannot parse the JSON as valid database as it missing the key ${key}`
        );
      }
    }
    //validate and register the stuffs
    this.#validateTable(data["anime"], "ANIME");
    this.#validateTable(data["person"], "PERSON");
  }
  getData<T>(
    type: DatabaseTypes,
    id: number,
    converter?: ((data: any, db: IDatabase) => T | null) | undefined
  ): T | null {
    if (!converter) {
      converter = (data: any) => data as T;
    }
    let data: Cached<KeyedEntry> | null = this.#getTable(type);
    if (!data) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    let entry = findEntry(data, id);
    if (entry) {
      return converter(entry, this);
    }
    return null;
  }
  *iterateKeys(type: DatabaseTypes): Generator<number> {
    let data: Cached<KeyedEntry> | null = this.#getTable(type);
    if (!data) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    /**
     * Iterate the objects and remember the relationship of the id:index
     */
    for (let i = 0; i < data.entries.length; i++) {
      let id = data.entries[i].id;
      data.cache[id] = i;
      yield id;
    }
  }
  /**
   * Internal use only: get the internal table
   * @param type the database type where the internal table should be obtained
   */
  #getTable(type: DatabaseTypes): Cached<KeyedEntry> | null {
    switch (type) {
      case "ANIME":
        if (!this.#database.anime) {
          return null;
        }
        return this.#database.anime;
      case "PERSON":
        if (!this.#database.person) {
          return null;
        }
        return this.#database.person;
      case "CHARACTER":
        allowIfNotProd("Not implemented yet");
        break;
    }
    return null;
  }
  /**
   * Validate and register the data as compatible with certain schema
   * @param table the table data
   * @param validate_as the target database to register to
   */
  #validateTable(table: any, validate_as: DatabaseTypes) {
    console.log("JSONDatabase: registering table " + validate_as);
    if (this.#getTable(validate_as)) {
      allowIfNotProd(`Overwriting table ${validate_as}. bug?`);
    }
    switch (validate_as) {
      case "ANIME":
        {
          let parsed: AnimeEntryInternal[] | null =
            asArrayOf<AnimeEntryInternal>(table, asAnimeEntryInternal);
          if (!parsed) {
            throw new Error(
              `JSONDatabase: detected schema violation when parsing table for inclusion into ANIME`
            );
          }
          //construct the stuffs
          this.#database.anime = makeCached(parsed);
        }
        break;
      case "PERSON":
        {
          let parsed: People[] | null = asArrayOf<People>(table, asPeople);
          if (!parsed) {
            throw new Error(
              `JSONDatabase: detected schema violation when parsing table for inclusion into PERSON`
            );
          }
          //construct the stuffs
          this.#database.person = makeCached(parsed);
        }
        break;
      case "CHARACTER":
        allowIfNotProd("Not implemented yet");
        break;
    }
  }
}
