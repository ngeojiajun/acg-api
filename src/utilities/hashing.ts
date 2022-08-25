import { createHash } from "crypto";
//Some internal APIs for the caching
export function computeHashForObject(o: any): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(o));
  return hash.digest("hex");
}
