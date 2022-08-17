/**
 * This file contain the main entry point of the server
 * Avoid adding unneeded stuffs here.
 * Instead, put those into separated directory
 */
import express, { Application, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import AdminApi from "./api/admin";
import AnimeApi from "./api/anime";
import CharacterApi from "./api/characters";
import { errorHandler } from "./api/commonUtils";
import BasicAuthenticationProider from "./authentication/auth_base";
import { LoginRoute } from "./authentication/routes";
import JsonDatabase from "./database/jsonDatabase";
/**
 * This file export nothing but instead patches the Vanila stuffs
 */
import "./utilities/prototype_patch";

//load the data
let db: JsonDatabase = new JsonDatabase("./data/");

//Check environment variables and disable saving when empheral flag is passed
if (process.env.JSON_DB_EMPHERAL) {
  console.warn(
    "Warning: opening database in empheral mode. Changes will not be saved"
  );
  db.shouldSaveWhenClose = false;
}

//init the authorization provider
let auth: BasicAuthenticationProider = new BasicAuthenticationProider();
auth.init();

const app: Application = express();
const PORT = process.env.PORT || 8000;
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.disable("x-powered-by");

app.use(apiLimiter);

app.use(express.json());

app.use("/anime", new AnimeApi(db).asApplication());
app.use("/character", new CharacterApi(db).asApplication());

app.get("/", (_req: Request, res: Response): void => {
  res.send("Hello Typescript with Node.js!");
});

app.use("/admin", new AdminApi(db, auth).asApplication());

//use a separated limiter for this
app.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    message: "Too much login attempts, please try again later",
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  LoginRoute(auth)
);

const initStart = performance.now();
db.init().then(() => {
  console.log(`Initialization done in ${performance.now() - initStart} ms`);
  app.listen(PORT, (): void => {
    console.log(`Server Running here 👉 http://localhost:${PORT}`);
  });
});

app.use(errorHandler);

/**
 * This call is not relavant later on when deployed to Heroku
 * Only placed here to ensure the data is flushed before it is taken down
 */
process.on("SIGINT", () => {
  db.close().then(() => process.exit(0));
});
