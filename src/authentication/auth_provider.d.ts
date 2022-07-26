/**
 * Define the base interface for an Authentication Provider
 */
export interface AuthProvider {
  /**
   * Initialize the provider
   */
  init: () => void;
  /**
   * Perform the login
   * @param user The username
   * @param pass Password
   * @returns The auth token or NULL if failed
   */
  login: (user: string, pass: string) => Promise<any>;
  /**
   * Verify the token weather it is valid or not
   */
  verify: (token: any) => Promise<boolean>;
  /**
   * Query the properties of authenticated user
   */
  query: (token: any, key: string) => Promise<any>;
}
