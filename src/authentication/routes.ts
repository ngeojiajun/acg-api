import { Request, Response } from "express";
import { AuthProvider } from "./auth_provider";

export function LoginRoute(
  provider: AuthProvider
): (request: Request, response: Response) => void {
  return function (request: Request, response: Response): void {
    if (!request.body) {
      response.status(400).json({
        error: "missing params",
      });
      return;
    }
    let { username, password } = request.body;
    if (!username || !password) {
      response.status(400).json({
        error: "missing params",
      });
      return;
    }
    provider.login(username, password).then((result) => {
      if (!result) {
        response
          .status(401)
          .json({
            error: "Wrong credential",
          })
          .end();
      } else {
        response
          .status(200)
          .json({
            token: result,
          })
          .end();
      }
    });
  };
}
