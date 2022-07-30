/**
 * Core type declarations
 */

export declare type Status = {
  success: boolean;
  message: any | undefined;
};

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

export declare type Gender = "male" | "female";
export declare type CharacterPresence = KeyedEntry & {
  type: "anime" | "game" | "comic";
};

export declare type Character = BilingualKeyedEntry & {
  gender: Gender;
  presentOn: CharacterPresence;
};
