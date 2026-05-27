import type { Express, Request, Response } from "express";
import { registerDocumentRoutes } from "./documents.js";
import { registerMediaRoutes } from "./media.js";
import { registerSnapshotRoutes } from "./snapshots.js";

export function registerRoutes(app: Express) {
  app.get("/api/health", (_request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      data: {
        status: "ok",
        service: "online-shared-doc-server"
      }
    });
  });

  app.get("/api/scaffold", (_request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      data: {
        task: "Task1",
        frontend: "client",
        backend: "server",
        shared: "shared/types",
        docs: "docs"
      }
    });
  });

  registerDocumentRoutes(app);
  registerSnapshotRoutes(app);
  registerMediaRoutes(app);
}
