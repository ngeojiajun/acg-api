import { Status } from "../definitions/core";

export function fail(message: string = "Assertion failed"): never {
  throw new Error(message);
}

export function assertSuccess(result: Status) {
  if (!result.success) {
    fail(result.message);
  }
}
