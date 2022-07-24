/**
 * This file contain the main entry point of the server
 * Avoid adding unneeded stuffs here.
 * Instead, put those into separated directory
 */
import express, { Application, Request, Response } from "express";
import AnimeApi from "./api/anime";
import { IDatabase } from "./database/database";
import JsonDatabase from "./database/jsonDatabase";

//load the data
let db: IDatabase = new JsonDatabase("./data/animes.json");
db.init();

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.disable("x-powered-by");

app.use("/anime", new AnimeApi(db).asApplication());

app.get("/", (req: Request, res: Response): void => {
  res.send("Hello Typescript with Node.js!");
});

app.listen(PORT, (): void => {
  console.log(`Server Running here 👉 http://localhost:${PORT}`);
});
