import { AnimeEntry } from "./anime";
import { asArrayOf, asBilingualKeyEntry, asCategory } from "./converters";
import { KeyedEntry } from "./core";

/**
 * Internal representation of the database
 * DONT ship this to client
 */
export type AnimeEntryInternal = Omit<AnimeEntry, "author" | "publisher"> & {
  /**
   * Authors ids which correspond to Person table
   */
  author: number[];
  /**
   * Publisher ids which correspond to Person table
   */
  publisher: number[];
};

/**
 * @note For internal use only, try to parse the table as
 */
export function asAnimeEntryInternal(table: any): AnimeEntryInternal | null {
  //parse against parent type, if failed assume it failed
  if (!asBilingualKeyEntry(table)) {
    return null;
  }
  if (typeof table.description !== "string") {
    return null;
  }
  if (table.category && !asArrayOf<KeyedEntry>(table.category, asCategory)) {
    return null;
  }
  //parse the authors and publishers as array of integet
  const asNumber = (v: any): number | null => {
    return typeof v === "number" ? v : null;
  };
  if (table.publisher && !asArrayOf<number>(table.publisher, asNumber)) {
    return null;
  }

  if (table.author && !asArrayOf<number>(table.author, asNumber)) {
    return null;
  }
  return table;
}
