import { Request, Response } from "express";

export function nonExistantRoute(_request: Request, response: Response) {
  response.status(404).json({
    error: "Endpoint not existant",
  });
}
