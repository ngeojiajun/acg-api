import express, { Application } from "express";
import { AuthProvider } from "../authentication/auth_provider";
import ProtectedRoute from "../authentication/middlewares";
import { IDatabase } from "../database/database";
import { nonExistantRoute } from "./commonUtils";

/**
 * Contain routes for the administration use
 */
export default class AdminApi {
  #database: IDatabase;
  #authProvider: AuthProvider;
  constructor(database: IDatabase, authProvider: AuthProvider) {
    this.#database = database;
    this.#authProvider = authProvider;
  }
  asApplication(): Application {
    const app = express();
    if (this.#authProvider.canPerformAuth() && !process.env.DISABLE_ADMIN) {
      app.use(ProtectedRoute(this.#authProvider));
    } else {
      console.warn(
        "The admin API is disable as either the provider reported that the authentication is impossible"
      );
      console.warn(
        "or it is disabled through DISABLE_ADMIN environment variable"
      );
    }
    app.use(nonExistantRoute);
    return app;
  }
}
