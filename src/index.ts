/**
 * This file contain the main entry point of the server
 * Avoid adding unneeded stuffs here.
 * Instead, put those into separated directory
 */
import express, { Application, Request, Response } from "express";
import AnimeApi from "./api/anime";
import BasicAuthenticationProider from "./authentication/auth_base";
import ProtectedRoute from "./authentication/middlewares";
import { LoginRoute } from "./authentication/routes";
import { IDatabase } from "./database/database";
import JsonDatabase from "./database/jsonDatabase";

//load the data
let db: IDatabase = new JsonDatabase("./data/");

//init the authorization provider
let auth: BasicAuthenticationProider = new BasicAuthenticationProider();
auth.init();

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.disable("x-powered-by");

app.use(express.json());

app.use("/anime", new AnimeApi(db).asApplication());

app.get("/", (_req: Request, res: Response): void => {
  res.send("Hello Typescript with Node.js!");
});

app.post("/login", LoginRoute(auth));

app.get("/auth", ProtectedRoute(auth), (_req: Request, res: Response): void => {
  res.send("Hello Typescript with Node.js! The authenticated version");
});

const initStart = performance.now();
db.init().then(() => {
  console.log(`Initialization done in ${performance.now() - initStart} ms`);
  app.listen(PORT, (): void => {
    console.log(`Server Running here 👉 http://localhost:${PORT}`);
  });
});

/**
 * This call is not relavant later on when deployed to Heroku
 * Only placed here to ensure the data is flushed before it is taken down
 */
process.on("SIGINT", () => {
  db.close().then(() => process.exit(0));
});
