/**
 * This file contain some functions which disables the console.log
 * calls when it is running in JEST to avoid spamming the
 * test log with something unneeded
 */

const in_test_env = process.env.JEST_WORKER_ID !== undefined;

function _stub(...any: any[]): void {}
/**
 * Internal marco to expand the declaration when it is not inside
 * test environment
 */
function _rewrap<T extends Function>(func: T) {
  return in_test_env ? _stub : func;
}
export const log = _rewrap(console.log);
export const warn = _rewrap(console.warn);
export const error = _rewrap(console.error);
