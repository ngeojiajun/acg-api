/**
 * This contain the interface declaration for other components
 * This usaually sufficient for other users
 */

export declare type DatabaseTypes = "ANIME" | "CHARACTER" | "PERSON";

export declare interface IDatabase {
  /**
   * Initialize the database
   */
  init: () => void;
  /**
   * Get data from the database
   * @param type the type of the entry to get
   * @param id the id of the entry to obtain
   * @param converter (Optional) Converter to validate and convert the obtained data to the required type
   * it holds two parameters, first the entry then the database instance itself for performing additional calls
   * @returns The object or null if the conversion failed or the data is not existant
   */
  getData: <T = any>(
    type: DatabaseTypes,
    id: number,
    converter?: (data: any, self: IDatabase) => T | null
  ) => T | null;
  /**
   * Iterate every single possible valid keys
   */
  iterateKeys: (type: DatabaseTypes) => Generator<number>;
}
