import { NextFunction, Request, Response } from "express";
import { AuthProvider } from "./auth_provider";

export default function Middleware(
  provider: AuthProvider
): (request: Request, response: Response, next: NextFunction) => void {
  return function (
    request: Request,
    response: Response,
    next: NextFunction
  ): void {
    let header = request.get("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      response
        .status(401)
        .json({
          error: "Unauthorized",
        })
        .end();
      return;
    }
    //test the token
    let token = header.split(" ")[1];
    provider.verify(token).then((result) => {
      if (result) {
        next();
      } else {
        response
          .status(401)
          .json({
            error: "Unauthorized",
          })
          .end();
      }
    }, next);
  };
}
