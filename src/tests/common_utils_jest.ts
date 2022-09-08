/**
 * Jest utils
 */
import { expect } from "@jest/globals";
import { Status } from "../definitions/core";
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
