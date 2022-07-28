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

app.use(ProtectedRoute(auth));

app.get("/auth", (_req: Request, res: Response): void => {
  res.send("Hello Typescript with Node.js! The authenticated version");
});

db.init().then(() => {
  app.listen(PORT, (): void => {
    console.log(`Server Running here 👉 http://localhost:${PORT}`);
  });
});

process.on("exit", () => {
  db.close();
});
process.on("SIGINT", () => {
  process.exit(0);
});
