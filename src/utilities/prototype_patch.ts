/**
 * Not to be included directly
 * Contains patches toward the prototype of standard stuffs
 */
import "./prototype_patch_def";
const collator = new Intl.Collator(undefined, { sensitivity: "accent" });
String.prototype.includesIgnoreCase = function (rhs: string) {
  if (!this._lower) {
    this._lower = this.toLocaleLowerCase();
  }
  return this._lower.includes(rhs.toLocaleLowerCase());
};

String.prototype.equalsIgnoreCase = function (rhs: string) {
  return collator.compare(this as string, rhs) === 0;
};
