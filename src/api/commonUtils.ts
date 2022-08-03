import { NextFunction, Request, Response } from "express";

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
