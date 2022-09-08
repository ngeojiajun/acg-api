import { Status } from "../definitions/core";
import { expect } from "@jest/globals";

export function fail(message: string = "Assertion failed"): never {
  throw new Error(message);
}

export function assertSuccess(result: Status) {
  if (!result.success) {
    fail(result.message);
  }
}

export function assertFail(result: Status, tag: string = "unknown") {
  if (result.success) {
    fail(
      `The operation with tag=${tag} are completed with succeeded even it is not supposed to be`
    );
  }
}

export async function assertThrow(
  f: () => void | Promise<void>,
  tag: string = "Unknown"
) {
  try {
    await f();
  } catch (e) {
    return;
  }
  fail(`The ${tag} didnt throw`);
}

export function assertMatch<T>(value: T, expected: T) {
  if (value !== expected) {
    fail(`Values didnt match! Expecting ${expected} but got ${value}`);
  }
}

export function assertNotMatch<T>(value: T, rhs: T) {
  if (value === rhs) {
    fail(`Values does match while it is not supposed to be! Value= ${value}`);
  }
}

/**
 * Expect the result of an query is failed
 * @param status The status reported by the backend
 */
export function expectFail(status: Status): void {
  expect(status.success).toBe(false);
}

/**
 * Expect the result of an query is succeeded
 * @param status The status reported by the backend
 */
export function expectSuccess(status: Status): void {
  expect(status.success).toBe(true);
}
