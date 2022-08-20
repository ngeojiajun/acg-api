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
import { MangaEntryInternal } from "../definitions/manga.internal";

export declare type DatabaseTypes =
  | "ANIME"
  | "CHARACTER"
  | "PERSON"
  | "CATEGORY"
  | "MANGA";

export declare type CompareOperations =
  | "EQUALS"
  | "GREATER"
  | "LESSER"
  | "EQUALS_INSENSITIVE"
  | "INCLUDES"
  | "INCLUDES_INSENSITIVE"
  | "INCLUDES_SET"
  | "EVAL_JS";

/**
 * Defines the valid operand type to compare explicitly
 */
export declare type CompareOperationOperand = {
  EQUALS: any;
  GREATER: number | string;
  LESSER: number | string;
  EQUALS_INSENSITIVE: string;
  INCLUDES: string;
  INCLUDES_INSENSITIVE: string;
  INCLUDES_SET: Array<any>;
  EVAL_JS: (lhs: any, rhs: any) => boolean;
};

/**
 * Defines how the conditions should be chained
 */
export declare type ConditionChaining = "AND" | "OR";

export declare type Condition<
  T extends KeyedEntry,
  OP extends CompareOperations = CompareOperations
> = {
  key: keyof T;
  op: OP;
  rhs?: CompareOperationOperand[OP];
};
/**
 * Only for putData
 */
export declare type DatabaseTypesMapping = {
  ANIME: AnimeEntryInternal;
  MANGA: MangaEntryInternal;
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
    another?: dataType | null,
    conditions?: Condition<dataType>[],
    chaining?: ConditionChaining
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
  /**
   * Update the data with id=`id` with the delta provided
   * @param type the table to which the data is pushed into
   * @param id the id of the entry with the patch will be applied against
   * @param delta the data to push into, the type check will be done once again to avoid hard cast
   * @returns result
   * @notes same as `addNotes()` all references will be synchronized, so it is an very expensive operation on
   * table that have multiple childs
   */
  updateData: <T extends DatabaseTypes>(
    type: T,
    id: KeyedEntry["id"],
    delta: Partial<Omit<DatabaseTypesMapping[T], "id">>
  ) => Promise<Status>;
  /**
   * Remove the entry from the table
   * @param type the table to data should be removed from
   * @param id the id of the entry
   * @returns the result
   */
  removeData: (type: DatabaseTypes, id: KeyedEntry["id"]) => Promise<Status>;
}
