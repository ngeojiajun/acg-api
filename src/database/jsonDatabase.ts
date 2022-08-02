import { readFile, writeFile } from "fs/promises";
import path from "path";
import {
  AnimeEntryInternal,
  asAnimeEntryInternal,
} from "../definitions/anime.internal";
import {
  asArrayOf,
  asCategory,
  asCharacter,
  asPeople,
} from "../definitions/converters";
import {
  Category,
  Character,
  KeyedEntry,
  People,
  Status,
} from "../definitions/core";
import { addEntry, Cached, findEntry, makeCached } from "../utilities/cached";
import Mutex from "../utilities/mutex";
import { castAndStripObject } from "../utilities/sanitise";
import { allowIfNotProd } from "../utils";
import {
  DatabaseTypes,
  DatabaseTypesMapping,
  IDatabase,
  ReturnType,
} from "./database";
import {
  checkRemoteReferencesAnimeEntry,
  checkRemoteReferencesCharacter,
  constructStatus,
} from "./integrityTestUtils";

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
  characters?: Cached<Character>;
  categories?: Cached<Category>;
};

/**
 * This database returns the data from the local json file
 */
export default class JsonDatabase implements IDatabase {
  /**
   * The name of directory that the database should load from
   */
  directory: string;
  #database: InternalParsedMap;
  #mutex: Mutex;
  constructor(directory: string) {
    console.warn("This class contains schema which is under heavy development");
    this.directory = directory;
    this.#database = {};
    //The read only function only modify the cache which are not critical
    this.#mutex = new Mutex(true);
  }

  async addData<T extends DatabaseTypes>(
    type: T,
    data: DatabaseTypesMapping[T]
  ): Promise<Status> {
    let table: Cached<KeyedEntry> | null = this.#getTable(type);
    if (!table) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    let mutex_release = await this.#mutex.tryLock();
    try {
      switch (type) {
        case "ANIME": {
          let cast = castAndStripObject(data, asAnimeEntryInternal);
          if (!cast) {
            return constructStatus(false, "Invalid data");
          }
          //ensure the data is not clashing with current one
          let iterator = this.iterateKeys(
            type,
            (data: AnimeEntryInternal) =>
              data.name === cast?.name &&
              data.nameInJapanese === cast.nameInJapanese
          );
          if (!(await iterator.next()).done) {
            //there are conflicts
            return constructStatus(
              false,
              "The data might be already in database"
            );
          } else {
            //then perform external reference integrity
            let status = await checkRemoteReferencesAnimeEntry(this, cast);
            if (status.success) {
              //it is ok now lets perform final preparation
              let id = addEntry(table, data);
              //done
              return constructStatus(true, id);
            } else {
              return status;
            }
          }
        }
        case "CATEGORY": {
          //try cast to category
          let cast = castAndStripObject(data, asCategory);
          if (!cast) {
            return constructStatus(false, "Invalid data");
          }
          //ensure the data is not clashing with current one
          let iterator = this.iterateKeys(
            type,
            (data: Category) => data.name === cast?.name
          );
          if (!(await iterator.next()).done) {
            //there are conflicts
            return constructStatus(
              false,
              "The data might be already in database"
            );
          }
          //it is ok now lets perform final preparation
          let id = addEntry(table, data);
          //done
          return constructStatus(true, id);
        }
        case "CHARACTER": {
          let cast = castAndStripObject(data, asCharacter);
          if (!cast) {
            return constructStatus(false, "Invalid data");
          }
          //ensure the data is not clashing with current one
          let iterator = this.iterateKeys(
            type,
            (data: Character) =>
              data.name === cast?.name &&
              data.nameInJapanese === cast.nameInJapanese &&
              data.gender === cast.gender
          );
          if (!(await iterator.next()).done) {
            //there are conflicts
            return constructStatus(
              false,
              "The data might be already in database"
            );
          }
          //check integrity
          //then perform external reference integrity
          let status = await checkRemoteReferencesCharacter(this, cast);
          if (status.success) {
            //it is ok now lets perform final preparation
            let id = addEntry(table, data);
            //done
            return constructStatus(true, id);
          } else {
            return status;
          }
        }
        case "PERSON": {
          let cast = castAndStripObject(data, asPeople);
          if (!cast) {
            return constructStatus(false, "Invalid data");
          }
          //ensure the data is not clashing with current one
          let iterator = this.iterateKeys(
            type,
            (data: People) =>
              data.name === cast?.name &&
              data.nameInJapanese === cast.nameInJapanese
          );
          if (!(await iterator.next()).done) {
            //there are conflicts
            return constructStatus(
              false,
              "The data might be already in database"
            );
          }
          //it is ok now lets perform final preparation
          let id = addEntry(table, data);
          //done
          return constructStatus(true, id);
        }
      }
    } finally {
      mutex_release();
    }
    return constructStatus(false, "Unimplemented");
  }

  async init() {
    let mutex_release = await this.#mutex.tryLock();
    try {
      await this.#loadAndRegister(
        path.join(this.directory, "animes.json"),
        "ANIME"
      );
      await this.#loadAndRegister(
        path.join(this.directory, "persons.json"),
        "PERSON"
      );
      await this.#loadAndRegister(
        path.join(this.directory, "characters.json"),
        "CHARACTER"
      );
      await this.#loadAndRegister(
        path.join(this.directory, "categories.json"),
        "CATEGORY"
      );
    } finally {
      mutex_release();
    }
  }
  async getData<T>(
    type: DatabaseTypes,
    id: number,
    converter?:
      | ((data: any, db: IDatabase) => ReturnType<T> | Promise<ReturnType<T>>)
      | undefined
  ): Promise<ReturnType<T>> {
    if (!converter) {
      converter = (data: any) => data as T;
    }
    let data: Cached<KeyedEntry> | null = this.#getTable(type);
    if (!data) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    let entry: T | KeyedEntry | null = null;
    let mutex_release = await this.#mutex.tryLockRead();
    try {
      entry = findEntry(data, id);
      if (entry) {
        entry = await converter(entry, this);
      }
    } finally {
      mutex_release();
    }
    if (!entry) {
      return null;
    }
    return { ...entry };
  }
  async *iterateKeys(
    type: DatabaseTypes,
    extras?: any
  ): AsyncGenerator<number> {
    let data: Cached<KeyedEntry> | null = this.#getTable(type);
    if (!data) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    //lock the table
    let mutex_release = await this.#mutex.tryLockRead();
    try {
      /**
       * Iterate the objects and remember the relationship of the id:index
       */
      for (let i = 0; i < data.entries.length; i++) {
        let id = data.entries[i].id;
        data.cache[id] = i;
        if (typeof extras === "function" && !extras(data.entries[i])) {
          continue;
        }
        yield id;
      }
    } finally {
      mutex_release();
    }
  }
  async close(): Promise<void> {
    let mutex_release = await this.#mutex.tryLock();
    try {
      console.log("Closing db");
      //check the tables for the mutation, if it is there sync to FS
      if (this.#database.anime && this.#database.anime.mutated) {
        console.log("Saving ANIME table.....");
        await this.#saveTable(this.#database.anime.entries, "animes.json");
        this.#database.anime.mutated = false;
      }
      if (this.#database.characters && this.#database.characters.mutated) {
        console.log("Saving CHARACTER table.....");
        await this.#saveTable(
          this.#database.characters.entries,
          "characters.json"
        );
        this.#database.characters.mutated = false;
      }
      if (this.#database.categories && this.#database.categories.mutated) {
        console.log("Saving CATEGORY table.....");
        await this.#saveTable(
          this.#database.categories.entries,
          "categories.json"
        );
        this.#database.categories.mutated = false;
      }
      if (this.#database.person && this.#database.person.mutated) {
        console.log("Saving PERSON table.....");
        await this.#saveTable(this.#database.person.entries, "persons.json");
        this.#database.person.mutated = false;
      }
    } finally {
      console.log("Saved");
      mutex_release();
    }
  }
  /**
   * Save the table as JSON into file
   * @param table table data
   * @param filename filename
   */
  async #saveTable(table: KeyedEntry[], filename: string) {
    await writeFile(
      path.join(this.directory, filename),
      JSON.stringify(table, null, 2)
    );
  }
  /**
   * Load and register the file data into the internal tables
   * @param filename the filename to JSON file where the data is located
   * @param type the type of the database it should be injected into
   */
  async #loadAndRegister(filename: string, type: DatabaseTypes) {
    //load the register
    let data: any = JSON.parse(await readFile(filename, "utf8"));
    //load it into the database
    this.#validateTable(data, type);
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
        if (!this.#database.characters) {
          return null;
        }
        return this.#database.characters;
      case "CATEGORY":
        if (!this.#database.categories) {
          return null;
        }
        return this.#database.categories;
    }
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
        {
          let parsed: Character[] | null = asArrayOf<Character>(
            table,
            asCharacter
          );
          if (!parsed) {
            throw new Error(
              `JSONDatabase: detected schema violation when parsing table for inclusion into CHARACTER`
            );
          }
          //construct the stuffs
          this.#database.characters = makeCached(parsed);
        }
        break;
      case "CATEGORY":
        {
          let parsed: Category[] | null = asArrayOf<Category>(
            table,
            asCategory
          );
          if (!parsed) {
            throw new Error(
              `JSONDatabase: detected schema violation when parsing table for inclusion into CATEGORY`
            );
          }
          //construct the stuffs
          this.#database.categories = makeCached(parsed);
        }
        break;
    }
  }
}
