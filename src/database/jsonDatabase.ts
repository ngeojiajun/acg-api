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
  CharacterPresence,
  KeyedEntry,
  People,
  Status,
} from "../definitions/core";
import {
  addEntry,
  Cached,
  findEntry,
  makeCached,
  removeEntryById,
} from "../utilities/cached";
import Mutex from "../utilities/mutex";
import { NDJsonInfo, parseNDJson, writeNDJson } from "../utilities/ndjson";
import { castAndStripObject, patchObjectSecure } from "../utilities/sanitise";
import { allowIfNotProd } from "../utils";
import {
  Condition,
  ConditionChaining,
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
import "../utilities/prototype_patch_def";
import {
  ANIME_TABLE_VERSION,
  CATEGORY_TABLE_VERSION,
  CHARACTER_TABLE_VERSION,
  migrate,
  PERSON_TABLE_VERSION,
  queryDataValidityStatus,
  TABLE_COMPATIBILITY_STATE,
} from "./migrations/jsonDatabase";
import {
  ERROR_DUPLICATE_ENTRY,
  ERROR_ENTRY_NOT_FOUND,
  ERROR_HAVING_REMOTE_DEPENCENCIES,
  ERROR_INTEGRITY_TEST_FAILED,
  ERROR_INVALID_DATA,
  ERROR_PATCH_FAILED,
} from "./error_codes";

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
  shouldSaveWhenClose: boolean = true;
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
    switch (type) {
      case "ANIME":
        return this.#addDataInternal<"ANIME", AnimeEntryInternal>(
          type,
          data as AnimeEntryInternal,
          [
            { key: "name", op: "EQUALS_INSENSITIVE" },
            { key: "nameInJapanese", op: "EQUALS_INSENSITIVE" },
          ],
          asAnimeEntryInternal,
          checkRemoteReferencesAnimeEntry
        );
      case "CATEGORY":
        return this.#addDataInternal<"CATEGORY", Category>(
          type,
          data,
          [{ key: "name", op: "EQUALS_INSENSITIVE" }],
          asCategory
        );
      case "CHARACTER":
        return this.#addDataInternal<"CHARACTER", Character>(
          type,
          data as Character,
          [
            { key: "name", op: "EQUALS_INSENSITIVE" },
            { key: "nameInJapanese", op: "EQUALS_INSENSITIVE" },
            { key: "gender", op: "EQUALS" },
          ],
          asCharacter,
          checkRemoteReferencesCharacter
        );
      case "PERSON":
        return this.#addDataInternal<"PERSON", People>(
          type,
          data as People,
          [
            { key: "name", op: "EQUALS_INSENSITIVE" },
            { key: "nameInJapanese", op: "EQUALS_INSENSITIVE" },
          ],
          asPeople
        );
    }
    return constructStatus(false, "Unimplemented");
  }

  async updateData<T extends DatabaseTypes>(
    type: T,
    id: KeyedEntry["id"],
    delta: Partial<Omit<DatabaseTypesMapping[T], "id">>
  ): Promise<Status> {
    //take a mutex
    const mutex_release = await this.#mutex.tryLock();
    try {
      switch (type) {
        case "ANIME": {
          //get an effective copy of it
          let data = await this.#getData(type, id, asAnimeEntryInternal, false);
          if (!data) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          }
          //try to perform patch on it
          let patched = patchObjectSecure(data, delta, asAnimeEntryInternal, [
            "id",
          ]);
          if (!patched) {
            return constructStatus(false, "Invalid patch", ERROR_PATCH_FAILED);
          }
          //now perform few checks
          //ensure the new data is valid for the table integrity
          let status: Status = await checkRemoteReferencesAnimeEntry(
            this,
            patched
          );
          if (!status.success) {
            return constructStatus(
              false,
              "Cannot patch the data as " + status.message,
              ERROR_INTEGRITY_TEST_FAILED
            );
          }
          //commit the changes
          this.#database.anime!.mutated = true;
          Object.assign(data, patched);
          return constructStatus(true);
        }
        case "CATEGORY": {
          //get an effective copy of it
          let data = await this.#getData(type, id, asAnimeEntryInternal, false);
          if (!data) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          }
          //try to perform patch on it
          let patched = patchObjectSecure(data, delta, asAnimeEntryInternal, [
            "id",
          ]);
          if (!patched) {
            return constructStatus(false, "Invalid patch", ERROR_PATCH_FAILED);
          }
          //no remote check needed for this
          //just patch it directly
          this.#database.categories!.mutated = true;
          Object.assign(data, patched);
          return constructStatus(true);
        }
        case "PERSON": {
          //get an effective copy of it
          let data = await this.#getData(type, id, asPeople, false);
          if (!data) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          }
          //try to perform patch on it
          let patched = patchObjectSecure(data, delta, asPeople, ["id"]);
          if (!patched) {
            return constructStatus(false, "Invalid patch", ERROR_PATCH_FAILED);
          }
          //no remote check needed for this
          //just patch it directly
          this.#database.person!.mutated = true;
          Object.assign(data, patched);
          return constructStatus(true);
        }
        case "CHARACTER": {
          //get an effective copy of it
          let data = await this.#getData(type, id, asCharacter, false);
          if (!data) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          }
          //try to perform patch on it
          let patched = patchObjectSecure(data, delta, asCharacter, ["id"]);
          if (!patched) {
            return constructStatus(false, "Invalid patch", ERROR_PATCH_FAILED);
          }
          //check for remote references
          //ensure the new data is valid for the table integrity
          let status: Status = await checkRemoteReferencesCharacter(
            this,
            patched
          );
          if (!status.success) {
            return constructStatus(
              false,
              "Cannot patch the data as " + status.message,
              ERROR_INTEGRITY_TEST_FAILED
            );
          }
          //just patch it directly
          this.#database.characters!.mutated = true;
          Object.assign(data, patched);
          return constructStatus(true);
        }
      }
      return constructStatus(false, "Unimplemented");
    } finally {
      mutex_release();
    }
  }

  /**
   * Internal version of addData
   * @param type the type of database to input into
   * @param data the data to add
   * @param equality the conditions for equality check
   * @param converter the converter function to use
   * @param verifier function to verify the data
   */
  async #addDataInternal<
    T extends DatabaseTypes,
    dataType extends KeyedEntry = DatabaseTypesMapping[T]
  >(
    type: T,
    data: dataType,
    equality: Condition<dataType>[],
    converter: (e: any) => dataType | null,
    verifier: (db: IDatabase, e: dataType) => Promise<Status> = async (_, __) =>
      constructStatus(true)
  ): Promise<Status> {
    let table: Cached<KeyedEntry> | null = this.#getTable(type);
    if (!table) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    let mutex_release = await this.#mutex.tryLock();
    try {
      let cast: dataType | null = castAndStripObject(data, converter);
      if (!cast) {
        return constructStatus(false, "Invalid data", ERROR_INVALID_DATA);
      }
      //ensure the data is not clashing with current one
      let iterator = this.iterateKeysIf(type, cast, equality);
      if (!(await iterator.next()).done) {
        //ask iterator to release the mutex immediately (NOP but good practise)
        //the mutex is not actually locked by iterator as the writing lock is owned
        iterator.next(true);
        //there are conflicts
        return constructStatus(
          false,
          "The data might be already in database",
          ERROR_DUPLICATE_ENTRY
        );
      }
      //check for the status
      let status = await verifier(this, cast);
      if (!status.success) {
        return status;
      }
      //it is ok now lets perform final preparation
      let id = addEntry(table, data);
      //done
      return constructStatus(true, id);
    } finally {
      mutex_release();
    }
  }

  async init() {
    let mutex_release = await this.#mutex.tryLock();
    try {
      await this.#loadAndRegister(
        path.join(this.directory, "animes.ndjson"),
        "ANIME"
      );
      await this.#loadAndRegister(
        path.join(this.directory, "persons.ndjson"),
        "PERSON"
      );
      await this.#loadAndRegister(
        path.join(this.directory, "characters.ndjson"),
        "CHARACTER"
      );
      await this.#loadAndRegister(
        path.join(this.directory, "categories.ndjson"),
        "CATEGORY"
      );
    } finally {
      mutex_release();
    }
  }
  getData<T>(
    type: DatabaseTypes,
    id: number,
    converter?:
      | ((data: any, db: IDatabase) => ReturnType<T> | Promise<ReturnType<T>>)
      | undefined
  ): Promise<ReturnType<T>> {
    //alias to the #getData(...,true)
    return this.#getData<T>(type, id, converter, true);
  }
  /**
   * Refer the getData for its original prototype
   * @param copy should the copy of the data be given or not
   */
  async #getData<T>(
    type: DatabaseTypes,
    id: number,
    converter?:
      | ((data: any, db: IDatabase) => ReturnType<T> | Promise<ReturnType<T>>)
      | undefined,
    copy: boolean = false
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
    if (copy) {
      return JSON.parse(JSON.stringify(entry)) as T;
    } else {
      return entry;
    }
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
  async *iterateKeysIf<
    T extends DatabaseTypes,
    dataType extends KeyedEntry = DatabaseTypesMapping[T]
  >(
    type: T,
    another?: dataType | null,
    conditions?: Condition<dataType>[],
    chaining: ConditionChaining = "AND"
  ): AsyncGenerator<number> {
    let data: Cached<dataType> | null = this.#getTable(
      type
    ) as Cached<dataType>;
    if (!data) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    //lock the table
    let mutex_release = await this.#mutex.tryLockRead();
    //construct the test function
    function check(data: dataType): boolean {
      if (!conditions) {
        return true;
      }
      if (conditions.length <= 0) {
        return true;
      }
      for (const condition of conditions) {
        if (!condition.rhs && !another) {
          return false;
        }
        const lhs = data[condition.key];
        const rhs = condition.rhs ?? another?.[condition.key];
        switch (condition.op) {
          case "EQUALS":
            {
              const result = lhs === rhs;
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "GREATER":
            {
              const result = lhs > rhs;
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "LESSER":
            {
              const result = lhs < rhs;
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "EQUALS_INSENSITIVE":
            {
              if (typeof lhs !== "string" || typeof rhs !== "string") {
                throw new Error(
                  "Cannot perform operation on non string object"
                );
              }
              const result = lhs.equalsIgnoreCase(rhs);
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "INCLUDES":
            {
              if (typeof lhs !== "string" || typeof rhs !== "string") {
                throw new Error(
                  "Cannot perform operation on non string object"
                );
              }
              const result = lhs.includes(rhs);
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "INCLUDES_INSENSITIVE":
            {
              if (typeof lhs !== "string" || typeof rhs !== "string") {
                throw new Error(
                  "Cannot perform operation on non string object"
                );
              }
              const result = lhs.includesIgnoreCase(rhs);
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "INCLUDES_SET":
            {
              //check weather the set in rhs included in lhs
              if (!Array.isArray(lhs) || !Array.isArray(rhs)) {
                throw new Error("Cannot perform operation on non array object");
              }
              let result = false;
              for (const g of rhs) {
                if (lhs.includes(g)) {
                  result = true;
                  break;
                }
              }
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
          case "EVAL_JS":
            {
              if (!condition.rhs) {
                throw new Error("Cannot eval null");
              }
              let _condition = condition as Condition<dataType, "EVAL_JS">;
              let result = _condition.rhs?.(lhs);
              if (!result && chaining === "AND") {
                return false;
              } else if (result && chaining === "OR") {
                return true;
              }
            }
            break;
        }
      }
      //the chaining ops are OR this return statement will only reach when all are not
      //fulfilled
      return chaining === "AND";
    }
    try {
      /**
       * Iterate the objects and remember the relationship of the id:index
       */
      for (let i = 0; i < data.entries.length; i++) {
        let id = data.entries[i].id;
        data.cache[id] = i;
        //check the data against another side
        if (conditions && !check(data.entries[i])) {
          continue;
        }
        let stop: boolean = (yield id) as boolean;
        if (stop) break;
      }
    } finally {
      mutex_release();
    }
  }
  async removeData(type: DatabaseTypes, id: number): Promise<Status> {
    const table = this.#getTable(type);
    if (!table) {
      throw new Error("Fatal error: table not registered yet. bug?");
    }
    const mutex_release = await this.#mutex.tryLock();
    try {
      switch (type) {
        case "ANIME": {
          let iterator = this.iterateKeysIf<"CHARACTER">("CHARACTER", null, [
            {
              key: "presentOn",
              op: "EVAL_JS", //note that EVAL_JS has very high performance penalty so use with care
              rhs: (entries: CharacterPresence[]) => {
                for (const entry of entries) {
                  if (entry.type !== "anime") {
                    continue;
                  }
                  if (entry.id === id) {
                    return true;
                  }
                }
                return false;
              },
            },
          ]);
          if (!(await iterator.next()).done) {
            iterator.next(true);
            return constructStatus(
              false,
              "Cannot delete the entry because it is referenced by entry in CHARACTER",
              ERROR_INTEGRITY_TEST_FAILED
            );
          }
          if (!removeEntryById(table, id)) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          } else {
            return constructStatus(true);
          }
        }
        case "CATEGORY": {
          let iterator = this.iterateKeysIf<"ANIME">("ANIME", null, [
            {
              key: "category",
              op: "INCLUDES_SET",
              rhs: id,
            },
          ]);
          if (!(await iterator.next()).done) {
            iterator.next(true);
            return constructStatus(
              false,
              "Cannot delete the entry because it is referenced by entry in ANIME",
              ERROR_HAVING_REMOTE_DEPENCENCIES
            );
          }
          if (!removeEntryById(table, id)) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          } else {
            return constructStatus(true);
          }
        }
        case "PERSON": {
          let iterator = this.iterateKeysIf<"ANIME">(
            "ANIME",
            null,
            [
              {
                key: "publisher",
                op: "INCLUDES_SET",
                rhs: id,
              },
              {
                key: "author",
                op: "INCLUDES_SET",
                rhs: id,
              },
            ],
            "OR"
          );
          if (!(await iterator.next()).done) {
            iterator.next(true);
            return constructStatus(
              false,
              "Cannot delete the entry because it is referenced by entry in ANIME",
              ERROR_HAVING_REMOTE_DEPENCENCIES
            );
          }
          if (!removeEntryById(table, id)) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          } else {
            return constructStatus(true);
          }
        }
        case "CHARACTER": {
          //no checks need as there are no tables from another table will make references to it
          if (!removeEntryById(table, id)) {
            return constructStatus(
              false,
              "Entry not found",
              ERROR_ENTRY_NOT_FOUND
            );
          } else {
            return constructStatus(true);
          }
        }
        default:
          return constructStatus(false, "Unimplemented");
      }
    } finally {
      mutex_release();
    }
  }

  async close(): Promise<void> {
    if (!this.shouldSaveWhenClose) return;
    let mutex_release = await this.#mutex.tryLock();
    try {
      console.log("Closing db");
      //check the tables for the mutation, if it is there sync to FS
      if (this.#database.anime && this.#database.anime.mutated) {
        console.log("Saving ANIME table.....");
        await this.#saveTable(
          this.#database.anime.entries,
          "animes.ndjson",
          ANIME_TABLE_VERSION
        );
        this.#database.anime.mutated = false;
      }
      if (this.#database.characters && this.#database.characters.mutated) {
        console.log("Saving CHARACTER table.....");
        await this.#saveTable(
          this.#database.characters.entries,
          "characters.ndjson",
          CHARACTER_TABLE_VERSION
        );
        this.#database.characters.mutated = false;
      }
      if (this.#database.categories && this.#database.categories.mutated) {
        console.log("Saving CATEGORY table.....");
        await this.#saveTable(
          this.#database.categories.entries,
          "categories.ndjson",
          CATEGORY_TABLE_VERSION
        );
        this.#database.categories.mutated = false;
      }
      if (this.#database.person && this.#database.person.mutated) {
        console.log("Saving PERSON table.....");
        await this.#saveTable(
          this.#database.person.entries,
          "persons.ndjson",
          PERSON_TABLE_VERSION
        );
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
  async #saveTable(table: KeyedEntry[], filename: string, version: number = 1) {
    await writeNDJson(path.join(this.directory, filename), table, version);
  }
  /**
   * Load and register the file data into the internal tables
   * @param filename the filename to JSON file where the data is located
   * @param type the type of the database it should be injected into
   */
  async #loadAndRegister(filename: string, type: DatabaseTypes) {
    //load the file
    let data: NDJsonInfo = await parseNDJson(filename);
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
  #validateTable(table: NDJsonInfo, validate_as: DatabaseTypes) {
    console.log(
      `JSONDatabase: registering table ${validate_as} with schema version ${table.version}`
    );
    if (this.#getTable(validate_as)) {
      allowIfNotProd(`Overwriting table ${validate_as}. bug?`);
    }
    //check the status of the table
    const status = queryDataValidityStatus(table, validate_as);
    if (status === TABLE_COMPATIBILITY_STATE.INVALID) {
      throw new Error(
        `JSONDatabase: Table version is incompatible with the application version. Decoding ${validate_as} v${table.version}`
      );
    } else if (status === TABLE_COMPATIBILITY_STATE.NEEDS_MIGRATION) {
      console.log(
        `JSONDatabase: performing migration for table ${validate_as}`
      );
      let parsed = migrate(table, validate_as);
      if (!parsed) {
        throw new Error("Migration failed");
      }
      switch (validate_as) {
        case "ANIME":
          console.log(`Migrated to version ${ANIME_TABLE_VERSION}`);
          this.#database.anime = makeCached(parsed as AnimeEntryInternal[]);
          this.#database.anime.mutated = true; //mark this as dirty to force the database engine to write it
          break;
        case "CATEGORY":
          console.log(`Migrated to version ${CATEGORY_TABLE_VERSION}`);
          this.#database.categories = makeCached(parsed as Category[]);
          this.#database.categories.mutated = true; //mark this as dirty to force the database engine to write it
          break;
        case "CHARACTER":
          console.log(`Migrated to version ${CHARACTER_TABLE_VERSION}`);
          this.#database.characters = makeCached(parsed as Character[]);
          this.#database.characters.mutated = true; //mark this as dirty to force the database engine to write it
          break;
        case "PERSON":
          console.log(`Migrated to version ${PERSON_TABLE_VERSION}`);
          this.#database.person = makeCached(parsed as People[]);
          this.#database.person.mutated = true; //mark this as dirty to force the database engine to write it
          break;
      }
      return;
    }
    switch (validate_as) {
      case "ANIME":
        {
          let parsed: AnimeEntryInternal[] | null =
            asArrayOf<AnimeEntryInternal>(table.payload, asAnimeEntryInternal);
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
          let parsed: People[] | null = asArrayOf<People>(
            table.payload,
            asPeople
          );
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
            table.payload,
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
            table.payload,
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
