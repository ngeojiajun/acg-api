import { mkdtempSync, PathLike, rmSync } from "fs";
import path from "path";
import os from "os";
import { CachedTests } from "./cached";
import { IntegrityTest } from "./integrity_test";
import { JsonDatabaseTests } from "./jsonDatabase";

/**
 * The test engine for the project
 */
const tests: ((_tmp: PathLike) => Promise<void>)[] = [
  IntegrityTest,
  CachedTests,
  JsonDatabaseTests,
];

async function main() {
  //make the tmp dir
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "acg-api"));
  console.log(`Test started on ${new Date()}`);
  console.log(`The temparory files are produced at ${tmpDir}`);
  for (const test of tests) {
    const name = test.name;
    try {
      console.log(`Running test ${name}`);
      await test(tmpDir);
      console.log(`Test ${name} completed`);
    } catch (e) {
      console.log(e);
      console.log(`Test ${name} failed`);
      //free the directory
      rmSync(tmpDir, { recursive: true });
      process.exit(-1);
    }
  }
  //free the directory
  rmSync(tmpDir, { recursive: true });
}

const t = setInterval(() => {}, 1000);
main().finally(() => clearInterval(t));
