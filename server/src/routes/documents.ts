import type { Express, Request, Response } from "express";
import { buildExportDocument } from "../modules/exports/index.js";
import { buildSnapshotDiff } from "../modules/history/diff.js";
import { createDocumentService } from "../modules/documents/service.js";
import { HttpError } from "../services/http-errors.js";
import { logger } from "../services/logger.js";
import { sendError, sendSuccess } from "../services/http-response.js";
import {
  validateDiffSnapshotId,
  validateDocId,
  validateExportFormat,
  validateName,
  validateOptionalTitle,
  validateSnapshotId,
  validateTitle
} from "../services/validation.js";
import { getDataAccess } from "../services/data-access.js";

const documentService = createDocumentService();

function handleRouteError(response: Response, error: unknown, context: Record<string, unknown>) {
  if (error instanceof HttpError) {
    if (error.statusCode === 400) {
      logger.warn("HTTP validation failed", {
        module: "http",
        ...context,
        error: error.message
      });
    } else {
      logger.warn("HTTP request failed", {
        module: "http",
        ...context,
        error: error.message
      });
    }

    return sendError(response, error.statusCode, error.message);
  }

  logger.error("HTTP request failed", {
    module: "http",
    ...context,
    error: error instanceof Error ? error.message : String(error)
  });

  return sendError(response, 500, "Internal server error.");
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

function buildContentDisposition(fileName: string, extension: string) {
  const safeFileName = `${sanitizeFileName(fileName)}.${extension}`;
  const encoded = encodeURIComponent(safeFileName);
  return `attachment; filename="export.${extension}"; filename*=UTF-8''${encoded}`;
}

export function registerDocumentRoutes(app: Express) {
  app.get("/api/documents", (_request: Request, response: Response) => {
    try {
      const documents = documentService.getAllDocuments();
      return sendSuccess(response, 200, documents);
    } catch (error) {
      return handleRouteError(response, error, {
        path: "GET /api/documents"
      });
    }
  });

  app.post("/api/documents", (request: Request, response: Response) => {
    try {
      const name = validateName(request.body?.name);
      const title = validateOptionalTitle(request.body?.title);
      const result = documentService.createDocument(name, title);
      return sendSuccess(response, 201, result);
    } catch (error) {
      return handleRouteError(response, error, {
        path: "POST /api/documents"
      });
    }
  });

  app.get("/api/documents/:docId", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const result = documentService.getDocumentDetail(docId);

      return sendSuccess(response, 200, {
        id: result.document.id,
        title: result.document.title,
        createdAt: result.document.createdAt,
        updatedAt: result.document.updatedAt,
        createdByName: result.document.createdByName,
        content: result.content,
        stateRevision: result.stateRevision,
        latestSnapshotVersion: result.latestSnapshotVersion,
        latestUpdatedAt: result.updatedAt
      });
    } catch (error) {
      return handleRouteError(response, error, {
        path: "GET /api/documents/:docId",
        docId: request.params.docId
      });
    }
  });

  app.post("/api/documents/:docId/save", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const name = validateName(request.body?.name);
      const title =
        request.body?.title === undefined
          ? undefined
          : validateTitle(request.body.title);

      const result = documentService.saveDocument({
        docId,
        name,
        title
      });

      return sendSuccess(response, 200, {
        snapshotId: result.snapshot.id,
        snapshotVersion: result.snapshot.snapshotVersion,
        title: result.title,
        stateRevision: result.stateRevision,
        updatedAt: result.updatedAt
      });
    } catch (error) {
      return handleRouteError(response, error, {
        path: "POST /api/documents/:docId/save",
        docId: request.params.docId
      });
    }
  });

  app.put("/api/documents/:docId/title", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const title = validateTitle(request.body?.title);
      const result = documentService.updateDocumentTitle(docId, title);
      return sendSuccess(response, 200, result);
    } catch (error) {
      return handleRouteError(response, error, {
        path: "PUT /api/documents/:docId/title",
        docId: request.params.docId
      });
    }
  });

  app.get("/api/documents/:docId/snapshots", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const dataAccess = getDataAccess();
      const document = dataAccess.documents.getDocumentById(docId);

      if (!document || document.isDeleted) {
        throw new HttpError(404, "Document not found.");
      }

      const snapshots = dataAccess.history.getSnapshotsByDocumentId(docId).map((snapshot) => ({
        id: snapshot.id,
        snapshotVersion: snapshot.snapshotVersion,
        savedByName: snapshot.savedByName,
        savedAt: snapshot.savedAt
      }));

      return sendSuccess(response, 200, snapshots);
    } catch (error) {
      return handleRouteError(response, error, {
        path: "GET /api/documents/:docId/snapshots",
        docId: request.params.docId
      });
    }
  });

  app.get(
    "/api/documents/:docId/snapshots/:snapshotId",
    (request: Request, response: Response) => {
      try {
        const docId = validateDocId(request.params.docId);
        const snapshotId = validateSnapshotId(request.params.snapshotId);
        const dataAccess = getDataAccess();
        const snapshot = dataAccess.history.getSnapshotById(docId, snapshotId);

        if (!snapshot) {
          throw new HttpError(404, "Snapshot not found.");
        }

        return sendSuccess(response, 200, snapshot);
      } catch (error) {
        return handleRouteError(response, error, {
          path: "GET /api/documents/:docId/snapshots/:snapshotId",
          docId: request.params.docId,
          snapshotId: request.params.snapshotId
        });
      }
    }
  );

  app.get("/api/documents/:docId/diff", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const from = validateDiffSnapshotId(request.query.from, "from");
      const to = validateDiffSnapshotId(request.query.to, "to");
      const dataAccess = getDataAccess();
      const fromSnapshot = dataAccess.history.getSnapshotById(docId, from);
      const toSnapshot = dataAccess.history.getSnapshotById(docId, to);

      if (!fromSnapshot || !toSnapshot) {
        throw new HttpError(404, "Snapshot not found.");
      }

      const diff = buildSnapshotDiff(fromSnapshot, toSnapshot);
      return sendSuccess(response, 200, diff);
    } catch (error) {
      return handleRouteError(response, error, {
        path: "GET /api/documents/:docId/diff",
        docId: request.params.docId,
        from: request.query.from,
        to: request.query.to
      });
    }
  });

  app.get("/api/documents/:docId/export", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const format = validateExportFormat(request.query.format);
      const exportTitle =
        typeof request.query.title === "string"
          ? request.query.title
          : undefined;
      const detail = documentService.getDocumentDetail(docId);
      const exported = buildExportDocument(
        format,
        exportTitle ?? detail.document.title,
        detail.content
      );

      response.setHeader("Content-Type", exported.contentType);
      response.setHeader(
        "Content-Disposition",
        buildContentDisposition(exportTitle ?? detail.document.title, exported.extension)
      );

      return response.status(200).send(exported.content);
    } catch (error) {
      return handleRouteError(response, error, {
        path: "GET /api/documents/:docId/export",
        docId: request.params.docId,
        format: request.query.format
      });
    }
  });

  app.get("/api/documents/:docId/chat", (request: Request, response: Response) => {
    try {
      const docId = validateDocId(request.params.docId);
      const dataAccess = getDataAccess();
      const document = dataAccess.documents.getDocumentById(docId);

      if (!document || document.isDeleted) {
        throw new HttpError(404, "Document not found.");
      }

      return sendSuccess(response, 200, dataAccess.chat.getRecentMessages(docId, 50));
    } catch (error) {
      return handleRouteError(response, error, {
        path: "GET /api/documents/:docId/chat",
        docId: request.params.docId
      });
    }
  });
}
