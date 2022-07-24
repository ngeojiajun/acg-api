/**
 * Core type declarations
 */

/**
 * Common properties that the keyed entry needed to have
 */
export declare type KeyedEntry = {
  id: number;
  name: string;
};

export declare type Category = KeyedEntry;

export declare type BilingualKeyedEntry = KeyedEntry & {
  nameInJapanese: string;
};

export declare type People = BilingualKeyedEntry;

export declare enum Gender {
  MALE = "male",
  FEMALE = "female",
}

export declare type Character = BilingualKeyedEntry & {
  gender: Gender;
  presentOn: KeyedEntry & {
    /**
     * Type of the work he/she present
     */
    type: string;
  };
};
