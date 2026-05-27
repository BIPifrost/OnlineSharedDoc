import type { Express, Request, Response } from "express";
import { getDataAccess } from "../services/data-access.js";
import { HttpError } from "../services/http-errors.js";
import { sendError, sendSuccess } from "../services/http-response.js";
import { validateSnapshotId } from "../services/validation.js";

function handleSnapshotRouteError(
  response: Response,
  error: unknown,
  context: Record<string, unknown>
) {
  if (error instanceof HttpError) {
    return sendError(response, error.statusCode, error.message);
  }

  return sendError(
    response,
    500,
    `Snapshot request failed: ${JSON.stringify(context)}`
  );
}

export function registerSnapshotRoutes(app: Express) {
  app.get("/api/snapshots", (_request: Request, response: Response) => {
    try {
      return sendSuccess(response, 200, getDataAccess().history.getAllSnapshots());
    } catch (error) {
      return handleSnapshotRouteError(response, error, {
        path: "GET /api/snapshots"
      });
    }
  });

  app.get("/api/snapshots/:snapshotId", (request: Request, response: Response) => {
    try {
      const snapshotId = validateSnapshotId(request.params.snapshotId);
      const snapshot = getDataAccess().history.getSnapshotByGlobalId(snapshotId);

      if (!snapshot) {
        throw new HttpError(404, "Snapshot not found.");
      }

      return sendSuccess(response, 200, snapshot);
    } catch (error) {
      return handleSnapshotRouteError(response, error, {
        path: "GET /api/snapshots/:snapshotId",
        snapshotId: request.params.snapshotId
      });
    }
  });
}
