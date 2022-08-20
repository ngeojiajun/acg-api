import { defineVerifiedChain } from "../utilities/sanitise";
import { ACGEntryInternal, asACGEntryInternal } from "./acg.internal";

//define all the aliases
export type MangaEntryInternal = ACGEntryInternal & {
  isFinished: boolean;
};
export function asMangaEntryInternal(table: any): MangaEntryInternal | null {
  if (!asACGEntryInternal(table)) {
    return null;
  }
  if (typeof table.isFinished !== "boolean") {
    return null;
  }
  return table;
}
defineVerifiedChain(asMangaEntryInternal, asACGEntryInternal, "isFinished");
