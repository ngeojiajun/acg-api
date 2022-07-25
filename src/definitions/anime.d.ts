/**
 * This file contain the data structure returned by the endpoint
 */
import { BilingualKeyedEntry, Category, People } from "./core";
/**
 * Describe an anime entry
 */
export declare type AnimeEntry = BilingualKeyedEntry & {
  description: string;
  category?: Category[];
  publisher?: People[];
  author?: People[];
};
