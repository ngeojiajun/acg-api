import { createHash } from "crypto";
//Some internal APIs for the caching
export function computeHashForObject(o: any): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(o, null, 0));
  return hash.digest("hex");
}
