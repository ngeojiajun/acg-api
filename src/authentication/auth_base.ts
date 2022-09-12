import { AuthProvider } from "./auth_provider";
import * as Crypto from "crypto";
import * as Logger from "../utilities/logging";

type TokenInfo = {
  token: string;
  exp: number;
};

function randomString(): string {
  let buf: Buffer = Buffer.alloc(10, 0);
  Crypto.randomFillSync(buf);
  return buf.toString("hex");
}

/**
 * Basic authentication engine
 */
export default class BasicAuthenticationProider implements AuthProvider {
  #mainPassword = "";
  #tokens: TokenInfo[] = [];
  init() {
    //try to initialize the authentication engine using the ADMIN_PASS environment variable
    if (process.env.ADMIN_PASS) {
      this.#mainPassword = process.env.ADMIN_PASS;
      Logger.log("Enabling authentication backend");
    }
  }
  async login(user: string, password: string) {
    if (!this.#mainPassword || user !== "admin") {
      return null;
    }
    if (password !== this.#mainPassword) {
      return null;
    }
    let token = randomString();
    this.#tokens.push({
      token,
      exp: new Date().getTime() + 120000,
    });
    return token;
  }
  async verify(token: string) {
    if (!token || !this.#mainPassword) return false;
    this.#tokens = this.#tokens.filter((z) => new Date().getTime() - z.exp < 0);
    for (const tokenInfo of this.#tokens) {
      //touch its expiry date
      tokenInfo.exp = new Date().getTime() + 360000;
      if (token === tokenInfo.token) {
        return true;
      }
    }
    return false;
  }
  async query(_token: string, _key: string) {
    throw new Error("Unimplemented");
  }
  canPerformAuth(): boolean {
    return this.#mainPassword.length > 0;
  }
}
