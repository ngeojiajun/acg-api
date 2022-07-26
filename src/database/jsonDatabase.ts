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
  getHashOf,
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
  checkRemoteReferencesMangaEntry,
  constructStatus,
} from "./integrityTestUtils";
import "../utilities/prototype_patch_def";
import {
  ANIME_TABLE_VERSION,
  CATEGORY_TABLE_VERSION,
  CHARACTER_TABLE_VERSION,
  getMaximumSupportedVersion,
  MANGA_TABLE_VERSION,
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
import { existsSync } from "fs";
import {
  asMangaEntryInternal,
  MangaEntryInternal,
} from "../definitions/manga.internal";
import { ACGEntryInternal } from "../definitions/acg.internal";
import * as Logger from "../utilities/logging";

/**
 * Internal variable holding the locally parsed stuff
 */
type InternalParsedMap = {
  /**
   * the anime table
   */
  anime?: Cached<AnimeEntryInternal>;
  manga?: Cached<MangaEntryInternal>;
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
    Logger.warn("This class contains schema which is under heavy development");
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
          this.#getEqualityConditionForType("ANIME"),
          asAnimeEntryInternal,
          checkRemoteReferencesAnimeEntry
        );
      case "MANGA":
        return this.#addDataInternal<"MANGA", MangaEntryInternal>(
          type,
          data as MangaEntryInternal,
          this.#getEqualityConditionForType("MANGA"),
          asMangaEntryInternal,
          checkRemoteReferencesMangaEntry
        );
      case "CATEGORY":
        return this.#addDataInternal<"CATEGORY", Category>(
          type,
          data,
          this.#getEqualityConditionForType("CATEGORY"),
          asCategory
        );
      case "CHARACTER":
        return this.#addDataInternal<"CHARACTER", Character>(
          type,
          data as Character,
          this.#getEqualityConditionForType("CHARACTER"),
          asCharacter,
          checkRemoteReferencesCharacter
        );
      case "PERSON":
        return this.#addDataInternal<"PERSON", People>(
          type,
          data as People,
          this.#getEqualityConditionForType("PERSON"),
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
    switch (type) {
      case "ANIME": {
        return this.#updateDataInternal(
          "ANIME",
          id,
          delta,
          this.#getEqualityConditionForType("ANIME"),
          this.#database.anime!,
          asAnimeEntryInternal,
          checkRemoteReferencesAnimeEntry
        );
      }
      case "MANGA": {
        return this.#updateDataInternal(
          "MANGA",
          id,
          delta,
          this.#getEqualityConditionForType("MANGA"),
          this.#database.manga!,
          asMangaEntryInternal,
          checkRemoteReferencesMangaEntry
        );
      }
      case "CHARACTER": {
        return this.#updateDataInternal(
          "CHARACTER",
          id,
          delta,
          this.#getEqualityConditionForType("CHARACTER"),
          this.#database.characters!,
          asCharacter,
          checkRemoteReferencesCharacter
        );
      }
      case "PERSON": {
        return this.#updateDataInternal(
          "PERSON",
          id,
          delta,
          this.#getEqualityConditionForType("PERSON"),
          this.#database.person!,
          asPeople
        );
      }
      case "CATEGORY": {
        return this.#updateDataInternal(
          "CATEGORY",
          id,
          delta,
          this.#getEqualityConditionForType("CATEGORY"),
          this.#database.categories!,
          asCategory
        );
      }
    }
    return constructStatus(false, "Unimplemented");
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
      //check for the status
      let status = await this.#verifyDataForInclusion(
        type,
        cast,
        null,
        equality,
        verifier
      );
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

  async #updateDataInternal<T extends DatabaseTypes>(
    type: T,
    id: KeyedEntry["id"],
    delta: Partial<Omit<DatabaseTypesMapping[T], "id">>,
    equality: Condition<DatabaseTypesMapping[T]>[],
    handle: Cached<DatabaseTypesMapping[T]>,
    converter: (e: any) => DatabaseTypesMapping[T] | null,
    verifier: (
      db: IDatabase,
      e: DatabaseTypesMapping[T]
    ) => Promise<Status> = async (_, __) => constructStatus(true)
  ): Promise<Status> {
    let mutex_release = await this.#mutex.tryLock();
    try {
      //get an effective copy of it
      let data = await this.#getData(type, id, converter, false);
      if (!data) {
        return constructStatus(false, "Entry not found", ERROR_ENTRY_NOT_FOUND);
      }
      //try to perform patch on it
      let patched = patchObjectSecure(data, delta, converter, ["id"]);
      if (!patched) {
        return constructStatus(false, "Invalid patch", ERROR_PATCH_FAILED);
      }
      //now perform few checks
      //ensure it is not duplicated and also
      //ensure the new data is valid for the table integrity
      let status: Status = await this.#verifyDataForInclusion(
        type,
        patched,
        id,
        equality,
        verifier
      );
      if (!status.success) {
        return constructStatus(
          false,
          "Cannot patch the data as " + status.message,
          ERROR_INTEGRITY_TEST_FAILED
        );
      }
      //commit the changes
      handle.mutated = true;
      Object.assign(data, patched);
      return constructStatus(true);
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
        path.join(this.directory, "mangas.ndjson"),
        "MANGA"
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
  async getHash(type: DatabaseTypes, id: number): Promise<string | null> {
    const mutex_release = await this.#mutex.tryLockRead();
    try {
      let data: Cached<KeyedEntry> | null = this.#getTable(type);
      if (!data) {
        throw new Error("Fatal error: table not registered yet. bug?");
      }
      return getHashOf(data, id);
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
        //catch both null and undefined
        if (lhs == null || rhs == null) {
          //when it is absent eval as false
          if (chaining === "AND") {
            return false;
          }
          continue;
        }
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
              let result = _condition.rhs?.(lhs, another?.[condition.key]);
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
        case "ANIME":
        //HACK: the code is placed here just as a hack as the the code is put as the checking for both MANGA
        //ANIME tables are so similar
        case "MANGA": {
          let iterator = this.iterateKeysIf<"CHARACTER">("CHARACTER", null, [
            {
              key: "presentOn",
              op: "EVAL_JS", //note that EVAL_JS has very high performance penalty so use with care
              rhs: (entries: CharacterPresence[]) => {
                for (const entry of entries) {
                  if (entry.type !== type.toLowerCase()) {
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
          const types: DatabaseTypes[] = ["ANIME", "MANGA"];
          for (const type of types) {
            //the typing is made wide here because the possible mutation of the value is known
            let iterator = this.iterateKeysIf<DatabaseTypes, ACGEntryInternal>(
              type,
              null,
              [
                {
                  key: "category",
                  op: "INCLUDES_SET",
                  rhs: [id],
                },
              ]
            );
            if (!(await iterator.next()).done) {
              iterator.next(true);
              return constructStatus(
                false,
                "Cannot delete the entry because it is referenced by entry in ANIME",
                ERROR_HAVING_REMOTE_DEPENCENCIES
              );
            }
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
          const types: DatabaseTypes[] = ["ANIME", "MANGA"];
          for (const type of types) {
            //the typing is made wide here because the possible mutation of the value is known
            let iterator = this.iterateKeysIf<DatabaseTypes, ACGEntryInternal>(
              type,
              null,
              [
                {
                  key: "publisher",
                  op: "INCLUDES_SET",
                  rhs: [id],
                },
                {
                  key: "author",
                  op: "INCLUDES_SET",
                  rhs: [id],
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
      Logger.log("Closing db");
      //check the tables for the mutation, if it is there sync to FS
      if (this.#database.anime && this.#database.anime.mutated) {
        Logger.log("Saving ANIME table.....");
        await this.#saveTable(
          this.#database.anime.entries,
          "animes.ndjson",
          ANIME_TABLE_VERSION
        );
        this.#database.anime.mutated = false;
      }
      if (this.#database.manga && this.#database.manga.mutated) {
        Logger.log("Saving MANGA table.....");
        await this.#saveTable(
          this.#database.manga.entries,
          "mangas.ndjson",
          MANGA_TABLE_VERSION
        );
        this.#database.manga.mutated = false;
      }
      if (this.#database.characters && this.#database.characters.mutated) {
        Logger.log("Saving CHARACTER table.....");
        await this.#saveTable(
          this.#database.characters.entries,
          "characters.ndjson",
          CHARACTER_TABLE_VERSION
        );
        this.#database.characters.mutated = false;
      }
      if (this.#database.categories && this.#database.categories.mutated) {
        Logger.log("Saving CATEGORY table.....");
        await this.#saveTable(
          this.#database.categories.entries,
          "categories.ndjson",
          CATEGORY_TABLE_VERSION
        );
        this.#database.categories.mutated = false;
      }
      if (this.#database.person && this.#database.person.mutated) {
        Logger.log("Saving PERSON table.....");
        await this.#saveTable(
          this.#database.person.entries,
          "persons.ndjson",
          PERSON_TABLE_VERSION
        );
        this.#database.person.mutated = false;
      }
    } finally {
      Logger.log("Saved");
      mutex_release();
    }
  }

  /**
   * Verify the data using the verifiers provided so that the database's integrity will not be
   * compromised after the inclusion of this
   * @param type the database table type the data is checked against
   * @param data the data to check
   * @param id the data's original id (to ignore when checking for collision)
   * @param equality the list of checks for it to be qualify as equals
   * @param verifier function to check the remote references
   */
  async #verifyDataForInclusion<
    T extends DatabaseTypes,
    dataType extends KeyedEntry = DatabaseTypesMapping[T]
  >(
    type: T,
    data: dataType,
    id: KeyedEntry["id"] | null,
    equality: Condition<dataType>[],
    verifier: (db: IDatabase, e: dataType) => Promise<Status> = async (_, __) =>
      constructStatus(true)
  ): Promise<Status> {
    //ensure the data is not clashing with current one
    let iterator = this.iterateKeysIf(type, data, equality);
    let result = await iterator.next();
    if (!result.done) {
      //ask iterator to release the mutex immediately (NOP but good practise)
      //the mutex is not actually locked by iterator as the writing lock is owned
      iterator.next(true);
      //there are conflicts
      if (result.value != id) {
        return constructStatus(
          false,
          "The data might be already in database",
          ERROR_DUPLICATE_ENTRY
        );
      }
    }
    //check for the status
    let status = await verifier(this, data);
    if (!status.success) {
      return status;
    }
    return constructStatus(true);
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
    if (!existsSync(filename)) {
      Logger.warn(
        `${filename} not exists for initialization for ${type}! Initializing it as empty table instead!`
      );
      this.#validateTable(
        {
          payload: [],
          version: getMaximumSupportedVersion(type),
        },
        type,
        true
      );
      return;
    }
    //load the file
    let data: NDJsonInfo = await parseNDJson(filename);
    //load it into the database
    this.#validateTable(data, type);
  }
  #getEqualityConditionForType<T extends DatabaseTypes>(
    type: T
  ): Condition<DatabaseTypesMapping[T]>[] {
    switch (type) {
      case "ANIME":
      case "MANGA":
        return [
          { key: "name", op: "EQUALS_INSENSITIVE" },
          { key: "nameInJapanese", op: "EQUALS_INSENSITIVE" },
        ] as any;
      case "CHARACTER": {
        return [
          { key: "name", op: "EQUALS_INSENSITIVE" },
          { key: "nameInJapanese", op: "EQUALS_INSENSITIVE" },
          { key: "gender", op: "EQUALS" },
          {
            key: "presentOn",
            op: "EVAL_JS",
            rhs: (
              lhs: CharacterPresence[],
              rhs: CharacterPresence[]
            ): boolean => {
              //the presentOn contains the array of object which cannot be easily compared in JS
              //the only way to perform the comparism is to perform the check is checking its props
              //manually
              for (const entryRhs of rhs) {
                for (const entryLhs of lhs) {
                  if (
                    entryRhs.id === entryLhs.id &&
                    entryRhs.type === entryLhs.type
                  ) {
                    return true;
                  }
                }
              }
              return false;
            },
          },
        ] as Condition<any>[];
      }
      case "PERSON": {
        return [
          { key: "name", op: "EQUALS_INSENSITIVE" },
          { key: "nameInJapanese", op: "EQUALS_INSENSITIVE" },
        ] as any;
      }
      case "CATEGORY": {
        return [{ key: "name", op: "EQUALS_INSENSITIVE" }];
      }
    }
    throw new Error("Unimplemented types");
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
      case "MANGA":
        if (!this.#database.manga) {
          return null;
        }
        return this.#database.manga;
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
   * @param new_table whether the table provided is a entirely new table
   */
  #validateTable(
    table: NDJsonInfo,
    validate_as: DatabaseTypes,
    new_table: boolean = false
  ) {
    Logger.log(
      `JSONDatabase: registering table ${validate_as} with schema version ${table.version}`
    );
    if (this.#getTable(validate_as)) {
      allowIfNotProd(`Overwriting table ${validate_as}. bug?`);
    }
    //check the status of the table
    const status = queryDataValidityStatus(table, validate_as);
    if (status === TABLE_COMPATIBILITY_STATE.INVALID) {
      throw new Error(
        `JSONDatabase: Table version is incompatible with the application version (v${getMaximumSupportedVersion(
          validate_as
        )}). Decoding ${validate_as} v${table.version}`
      );
    } else if (status === TABLE_COMPATIBILITY_STATE.NEEDS_MIGRATION) {
      Logger.log(`JSONDatabase: performing migration for table ${validate_as}`);
      let parsed = migrate(table, validate_as);
      if (!parsed) {
        throw new Error("Migration failed");
      }
      switch (validate_as) {
        case "ANIME":
          Logger.log(`Migrated to version ${ANIME_TABLE_VERSION}`);
          this.#database.anime = makeCached(
            parsed as AnimeEntryInternal[],
            true
          );
          break;
        case "MANGA":
          Logger.log(`Migrated to version ${MANGA_TABLE_VERSION}`);
          this.#database.manga = makeCached(
            parsed as MangaEntryInternal[],
            true
          );
          break;
        case "CATEGORY":
          Logger.log(`Migrated to version ${CATEGORY_TABLE_VERSION}`);
          this.#database.categories = makeCached(parsed as Category[], true);
          break;
        case "CHARACTER":
          Logger.log(`Migrated to version ${CHARACTER_TABLE_VERSION}`);
          this.#database.characters = makeCached(parsed as Character[], true);
          break;
        case "PERSON":
          Logger.log(`Migrated to version ${PERSON_TABLE_VERSION}`);
          this.#database.person = makeCached(parsed as People[], true);
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
          this.#database.anime = makeCached(parsed, new_table);
        }
        break;
      case "MANGA":
        {
          let parsed: MangaEntryInternal[] | null =
            asArrayOf<MangaEntryInternal>(table.payload, asMangaEntryInternal);
          if (!parsed) {
            throw new Error(
              `JSONDatabase: detected schema violation when parsing table for inclusion into MANGA`
            );
          }
          //construct the stuffs
          this.#database.manga = makeCached(parsed, new_table);
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
          this.#database.person = makeCached(parsed, new_table);
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
          this.#database.characters = makeCached(parsed, new_table);
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
          this.#database.categories = makeCached(parsed, new_table);
        }
        break;
    }
  }
}
