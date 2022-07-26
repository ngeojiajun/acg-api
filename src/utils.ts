/**
 * A utility function to trap development only behavior
 * @param message Error message to throw when it is triggered in production mode
 */
export function allowIfNotProd(
  message: string = "Operation not allowed in production mode"
): void | never {
  if (process.env.PRODUCTION) {
    throw new NotAllowedInProductionError(message);
  } else {
    console.warn("Warning: this behavior is only allowed in development");
    console.warn(`From caller: ${message}`);
  }
}

/**
 * Try parse the incoming string as integer
 * @param str String to parse
 * @returns the parsed number or null on failure
 */
export function tryParseInteger(str: string): number | null {
  if (!str || !/^\d+$/.test(str)) {
    return null;
  } else {
    return parseInt(str);
  }
}

//Never meant to be exported
class NotAllowedInProductionError extends Error {}
