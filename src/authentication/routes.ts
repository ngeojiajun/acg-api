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
    if (provider.canPerformAuth()) {
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
    } else {
      //fail the authentication immediately when the provider is not available
      response
        .status(401)
        .json({
          error: "Wrong credential",
        })
        .end();
    }
  };
}
