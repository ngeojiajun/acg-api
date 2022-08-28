import { NextFunction, Request, Response } from "express";
import { DatabaseTypes, IDatabase } from "../database/database";
import { allowIfNotProd, tryParseInteger } from "../utils";

export function nonExistantRoute(_request: Request, response: Response) {
  response.status(404).json({
    error: "Endpoint not existant",
  });
}
export function errorHandler(
  _error: Error | any,
  _request: Request,
  response: Response,
  next: NextFunction
) {
  console.error(_error);
  //we cannot intercept it
  if (response.headersSent) {
    return next(_error);
  }
  if (_error.status == 400 && _error.type == "entity.parse.failed") {
    response
      .status(400)
      .json({ error: "Invalid request", additionalDetails: _error.message })
      .end();
  } else {
    response.status(500).json({ error: "Internal error happened" }).end();
  }
}

export function neverCache(
  _resquest: Request,
  response: Response,
  next: NextFunction
) {
  //dont store the response at all
  response.setHeader("Cache-Control", "no-store");
  next();
}

function parseEtags(etag: string): string[] {
  let etags = etag.split(",");
  const etag_regex = /^(?:\s*)"([^"]+)"(?:\s*)$/;
  //extract the etags and drop the weak etags
  etags = etags.map((z) => z.match(etag_regex)?.[1] ?? "").filter((z) => !!z);
  return etags;
}

/**
 * Middleware to check the etag of the request and issue 304 when it is matches
 * @param db Database handle
 * @param table the table to check
 * @param request request object
 * @param response response object
 * @param next next
 */
export async function sendNotModified(
  db: IDatabase,
  table: DatabaseTypes,
  request: Request,
  response: Response,
  next: NextFunction
) {
  //first check the presence of the if-none-match
  let etag = request.get("if-none-match");
  //then test for the presence of the id
  let id = tryParseInteger(request.params.id);
  if (!etag || id === null) {
    if (id === null) {
      allowIfNotProd(
        `sendNotModified middleware is invoked but it has no information to work with!!!! Faulting route=${request.route}`
      );
    }
    next();
    return;
  }
  //if there try to parse it
  let etags = parseEtags(etag);
  if (etags.length) {
    //ask the backend for the information
    let hash = await db.getHash(table, id);
    for (const remote_etag of etags) {
      if (hash === remote_etag) {
        //send not modified response
        response.status(304).end();
        return;
      }
    }
  }
  next();
}

/**
 * Middleware to check the etag of the request and fail if the version mismatch
 * @param db Database handle
 * @param table the table to check
 * @param request request object
 * @param response response object
 * @param next next
 */
export async function enforceEntryVersion(
  db: IDatabase,
  table: DatabaseTypes,
  request: Request,
  response: Response,
  next: NextFunction
) {
  //first check the presence of the if-none-match
  let etag = request.get("if-match");
  //then test for the presence of the id
  let id = tryParseInteger(request.params.id);
  if (!etag || id === null) {
    if (id === null) {
      allowIfNotProd(
        `sendNotModified middleware is invoked but it has no information to work with!!!! Faulting route=${request.route}`
      );
    }
    next();
    return;
  }
  //if there try to parse it
  let etags = parseEtags(etag);
  if (!etags.length) {
    next();
    return;
  }
  //ask the backend for the information
  let hash = await db.getHash(table, id);
  for (const remote_etag of etags) {
    if (hash === remote_etag) {
      next();
      return;
    }
  }
  response.status(412).end();
  return;
}
