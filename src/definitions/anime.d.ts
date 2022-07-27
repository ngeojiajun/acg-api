/**
 * This file contain the data structure returned by the endpoint
 */
import { BilingualKeyedEntry, Category, People } from "./core";
/**
 * Describe an base ACG entry
 */
export declare type ACGEntry = BilingualKeyedEntry & {
  year: number;
  description: string;
  category?: Category[];
  publisher?: People[];
  author?: People[];
};

export declare type AnimeEntry = ACGEntry;
