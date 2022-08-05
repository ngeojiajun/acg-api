/**
 * Not to be included directly
 * Contains patches toward the prototype of standard stuffs
 */
const collator = new Intl.Collator(undefined, { sensitivity: "accent" });
(String as any).prototype.includesIgnoreCase = function (rhs: string) {
  if (!this._lower) {
    this._lower = this.toLocaleLowerCase();
  }
  return this._lower.includes(rhs.toLocaleLowerCase());
};

(String as any).prototype.equalsIgnoreCase = function (rhs: string) {
  return collator.compare(this, rhs) === 0;
};
