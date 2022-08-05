/**
 * This contain the interface declaration for other components
 * This usaually sufficient for other users
 */

import { AnimeEntry } from "../definitions/anime";
import { AnimeEntryInternal } from "../definitions/anime.internal";
import {
  Category,
  Character,
  KeyedEntry,
  People,
  Status,
} from "../definitions/core";

export declare type DatabaseTypes =
  | "ANIME"
  | "CHARACTER"
  | "PERSON"
  | "CATEGORY";

export declare type CompareOperations =
  | "EQUALS"
  | "GREATER"
  | "LESSER"
  | "EQUALS_INSENSITIVE"
  | "INCLUDES"
  | "INCLUDES_INSENSITIVE";

export declare type Condition<T extends KeyedEntry> = {
  key: keyof T;
  op: CompareOperations;
};
/**
 * Only for putData
 */
export declare type DatabaseTypesMapping = {
  ANIME: AnimeEntryInternal;
  CHARACTER: Character;
  PERSON: People;
  CATEGORY: Category;
};
/**
 * Optional return type
 */
export declare type ReturnType<T> = T | null;
export declare interface IDatabase {
  /**
   * Initialize the database
   */
  init: () => Promise<void>;
  /**
   * Get data from the database
   * @param type the type of the entry to get
   * @param id the id of the entry to obtain
   * @param converter (Optional) Converter to validate and convert the obtained data to the required type
   * it holds two parameters, first the entry then the database instance itself for performing additional calls
   * @returns The object or null if the conversion failed or the data is not existant
   */
  getData: <
    T = AnimeEntry | AnimeEntryInternal | Character | Category | People
  >(
    type: DatabaseTypes,
    id: number,
    converter?: (
      data: any,
      self: IDatabase
    ) => ReturnType<T> | Promise<ReturnType<T>>
  ) => Promise<ReturnType<T>>;
  /**
   * Iterate every single possible valid keys
   */
  iterateKeys: (type: DatabaseTypes, extras?: any) => AsyncGenerator<number>;
  /**
   * Iterate every single possible valid if it fulfill the condition
   */
  iterateKeysIf: <
    T extends DatabaseTypes,
    dataType extends KeyedEntry = DatabaseTypesMapping[T]
  >(
    type: T,
    another?: dataType,
    conditions?: Condition<dataType>[]
  ) => AsyncGenerator<number>;
  /**
   * Shutdown the database
   */
  close(): Promise<void>;
  /**
   * Push data into it
   * @param type the table to which the data is pushed into
   * @param data the data to push into, the type check will be done once again to avoid hard cast
   * @returns weather the data is added into
   * @notes it will try to resolves any external references and bail if it cannot
   */
  addData: <T extends DatabaseTypes>(
    type: T,
    data: DatabaseTypesMapping[T]
  ) => Promise<Status>;
}
