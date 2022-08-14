import { IntegrityTest } from "./integrity_test";

/**
 * The test engine for the project
 */
const tests: (() => Promise<void>)[] = [IntegrityTest];

async function main() {
  console.log(`Test started on ${new Date()}`);
  for (const test of tests) {
    const name = test.name;
    try {
      console.log(`Running test ${name}`);
      await test();
      console.log(`Test ${name} completed`);
    } catch (e) {
      console.log(e);
      console.log(`Test ${name} failed`);
      process.exit(-1);
    }
  }
}

const t = setInterval(() => {}, 1000);
main().finally(() => clearInterval(t));
