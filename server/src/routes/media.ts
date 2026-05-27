import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import express, { type Express, type Request, type Response } from "express";
import { DATA_DIRECTORY } from "../db/index.js";
import { getDataAccess } from "../services/data-access.js";
import { HttpError } from "../services/http-errors.js";
import { sendError, sendSuccess } from "../services/http-response.js";
import { logger } from "../services/logger.js";
import { validateName } from "../services/validation.js";
import type { MediaAsset } from "../types/domain.js";

const UPLOAD_DIRECTORY = path.join(DATA_DIRECTORY, "media");
const PENDING_UPLOAD_DIRECTORY = path.join(UPLOAD_DIRECTORY, ".pending");
const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_CHUNKED_MEDIA_SIZE_BYTES = 1024 * 1024 * 1024;
const MEDIA_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES: Record<string, { mediaType: MediaAsset["mediaType"]; extension: string }> = {
  "image/jpeg": { mediaType: "image", extension: ".jpg" },
  "image/png": { mediaType: "image", extension: ".png" },
  "image/gif": { mediaType: "image", extension: ".gif" },
  "image/webp": { mediaType: "image", extension: ".webp" },
  "video/mp4": { mediaType: "video", extension: ".mp4" },
  "video/webm": { mediaType: "video", extension: ".webm" },
  "video/ogg": { mediaType: "video", extension: ".ogv" }
};

type PendingUpload = {
  id: string;
  assetId: string;
  originalName: string;
  mediaType: MediaAsset["mediaType"];
  mimeType: string;
  sizeBytes: number;
  storageName: string;
  uploadedByName: string;
  createdAt: string;
  chunkCount: number;
};

function requireText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  return value.trim();
}

function requireUploadId(value: unknown) {
  const id = requireText(value, "uploadId");
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new HttpError(400, "Invalid uploadId.");
  }
  return id;
}

function pendingManifestPath(uploadId: string) {
  return path.join(PENDING_UPLOAD_DIRECTORY, `${uploadId}.json`);
}

function pendingChunkDirectory(uploadId: string) {
  return path.join(PENDING_UPLOAD_DIRECTORY, uploadId);
}

function readPendingUpload(uploadId: string) {
  const manifestPath = pendingManifestPath(uploadId);
  if (!existsSync(manifestPath)) {
    throw new HttpError(404, "Upload session not found.");
  }
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PendingUpload;
}

function getUploadedChunks(upload: PendingUpload) {
  const chunkDirectory = pendingChunkDirectory(upload.id);
  return Array.from({ length: upload.chunkCount }, (_value, index) => index).filter((index) =>
    existsSync(path.join(chunkDirectory, `${index}.part`))
  );
}

function toUploadStatus(upload: PendingUpload) {
  return {
    uploadId: upload.id,
    chunkSizeBytes: MEDIA_CHUNK_SIZE_BYTES,
    chunkCount: upload.chunkCount,
    uploadedChunks: getUploadedChunks(upload)
  };
}

function toClientAsset(asset: MediaAsset) {
  return {
    id: asset.id,
    originalName: asset.originalName,
    mediaType: asset.mediaType,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    uploadedByName: asset.uploadedByName,
    createdAt: asset.createdAt,
    url: `/api/media/${encodeURIComponent(asset.id)}/content`
  };
}

function handleMediaError(response: Response, error: unknown, pathName: string) {
  if (error instanceof HttpError) {
    return sendError(response, error.statusCode, error.message);
  }

  logger.error("Media request failed", {
    module: "media",
    path: pathName,
    error: error instanceof Error ? error.message : String(error)
  });
  return sendError(response, 500, "媒体资源操作失败，请稍后重试。");
}

export function registerMediaRoutes(app: Express) {
  app.get("/api/media", (_request: Request, response: Response) => {
    try {
      return sendSuccess(
        response,
        200,
        getDataAccess().mediaAssets.getAssets().map(toClientAsset)
      );
    } catch (error) {
      return handleMediaError(response, error, "GET /api/media");
    }
  });

  app.post(
    "/api/media",
    express.raw({ type: ["image/*", "video/*"], limit: MAX_MEDIA_SIZE_BYTES }),
    (request: Request, response: Response) => {
      try {
        const mimeType = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
        const mediaConfig = ALLOWED_MIME_TYPES[mimeType];

        if (!mediaConfig) {
          throw new HttpError(400, "仅支持 JPG、PNG、GIF、WebP 图片，以及 MP4、WebM、Ogg 视频。");
        }

        if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
          throw new HttpError(400, "上传文件不能为空。");
        }

        const uploadedByName = validateName(request.query.uploadedBy);
        const originalName = requireText(request.query.name, "name");
        const id = nanoid();
        const storageName = `${id}${mediaConfig.extension}`;
        mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
        writeFileSync(path.join(UPLOAD_DIRECTORY, storageName), request.body);

        const asset: MediaAsset = {
          id,
          originalName,
          mediaType: mediaConfig.mediaType,
          mimeType,
          sizeBytes: request.body.byteLength,
          storageName,
          uploadedByName,
          createdAt: new Date().toISOString()
        };
        getDataAccess().mediaAssets.createAsset(asset);

        return sendSuccess(response, 201, toClientAsset(asset));
      } catch (error) {
        return handleMediaError(response, error, "POST /api/media");
      }
    }
  );

  app.post("/api/media/uploads", (request: Request, response: Response) => {
    try {
      const mimeType = requireText(request.body?.mimeType, "mimeType");
      const mediaConfig = ALLOWED_MIME_TYPES[mimeType];
      if (!mediaConfig) {
        throw new HttpError(400, "仅支持 JPG、PNG、GIF、WebP 图片，以及 MP4、WebM、Ogg 视频。");
      }

      const sizeBytes = Number(request.body?.sizeBytes);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_CHUNKED_MEDIA_SIZE_BYTES) {
        throw new HttpError(400, "媒体文件大小无效或超过 1 GB 限制。");
      }

      const id = nanoid();
      const assetId = nanoid();
      const upload: PendingUpload = {
        id,
        assetId,
        originalName: requireText(request.body?.name, "name"),
        mediaType: mediaConfig.mediaType,
        mimeType,
        sizeBytes,
        storageName: `${assetId}${mediaConfig.extension}`,
        uploadedByName: validateName(request.body?.uploadedBy),
        createdAt: new Date().toISOString(),
        chunkCount: Math.ceil(sizeBytes / MEDIA_CHUNK_SIZE_BYTES)
      };

      mkdirSync(pendingChunkDirectory(id), { recursive: true });
      writeFileSync(pendingManifestPath(id), JSON.stringify(upload));
      return sendSuccess(response, 201, toUploadStatus(upload));
    } catch (error) {
      return handleMediaError(response, error, "POST /api/media/uploads");
    }
  });

  app.get("/api/media/uploads/:uploadId", (request: Request, response: Response) => {
    try {
      const upload = readPendingUpload(requireUploadId(request.params.uploadId));
      return sendSuccess(response, 200, toUploadStatus(upload));
    } catch (error) {
      return handleMediaError(response, error, "GET /api/media/uploads/:uploadId");
    }
  });

  app.put(
    "/api/media/uploads/:uploadId/chunks/:chunkIndex",
    express.raw({ type: "application/octet-stream", limit: MEDIA_CHUNK_SIZE_BYTES + 1024 }),
    (request: Request, response: Response) => {
      try {
        const upload = readPendingUpload(requireUploadId(request.params.uploadId));
        const chunkIndex = Number(request.params.chunkIndex);
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.chunkCount) {
          throw new HttpError(400, "Invalid chunk index.");
        }
        if (!Buffer.isBuffer(request.body)) {
          throw new HttpError(400, "Chunk body is required.");
        }

        const expectedSize =
          chunkIndex === upload.chunkCount - 1
            ? upload.sizeBytes - chunkIndex * MEDIA_CHUNK_SIZE_BYTES
            : MEDIA_CHUNK_SIZE_BYTES;
        if (request.body.byteLength !== expectedSize) {
          throw new HttpError(400, "Chunk size does not match upload session.");
        }

        writeFileSync(path.join(pendingChunkDirectory(upload.id), `${chunkIndex}.part`), request.body);
        return sendSuccess(response, 200, toUploadStatus(upload));
      } catch (error) {
        return handleMediaError(response, error, "PUT /api/media/uploads/:uploadId/chunks/:chunkIndex");
      }
    }
  );

  app.post("/api/media/uploads/:uploadId/complete", (request: Request, response: Response) => {
    try {
      const upload = readPendingUpload(requireUploadId(request.params.uploadId));
      if (getUploadedChunks(upload).length !== upload.chunkCount) {
        throw new HttpError(409, "Upload is incomplete.");
      }

      mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
      const finalPath = path.join(UPLOAD_DIRECTORY, upload.storageName);
      writeFileSync(finalPath, Buffer.alloc(0));
      for (let index = 0; index < upload.chunkCount; index += 1) {
        appendFileSync(finalPath, readFileSync(path.join(pendingChunkDirectory(upload.id), `${index}.part`)));
      }

      const asset: MediaAsset = {
        id: upload.assetId,
        originalName: upload.originalName,
        mediaType: upload.mediaType,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        storageName: upload.storageName,
        uploadedByName: upload.uploadedByName,
        createdAt: upload.createdAt
      };
      getDataAccess().mediaAssets.createAsset(asset);
      rmSync(pendingChunkDirectory(upload.id), { recursive: true, force: true });
      unlinkSync(pendingManifestPath(upload.id));
      return sendSuccess(response, 201, toClientAsset(asset));
    } catch (error) {
      return handleMediaError(response, error, "POST /api/media/uploads/:uploadId/complete");
    }
  });

  app.get("/api/media/:assetId/content", (request: Request, response: Response) => {
    try {
      const assetId = requireText(request.params.assetId, "assetId");
      const asset = getDataAccess().mediaAssets.getAssetById(assetId);
      if (!asset) {
        throw new HttpError(404, "媒体资源不存在。");
      }

      const filePath = path.join(UPLOAD_DIRECTORY, asset.storageName);
      if (!existsSync(filePath)) {
        throw new HttpError(404, "媒体文件不存在。");
      }

      const size = statSync(filePath).size;
      const range = request.headers.range;
      response.setHeader("Content-Type", asset.mimeType);
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Cache-Control", "public, max-age=86400");

      if (!range) {
        response.setHeader("Content-Length", size);
        return createReadStream(filePath).pipe(response);
      }

      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : size - 1;
      if (!match || start > end || end >= size) {
        response.status(416).setHeader("Content-Range", `bytes */${size}`);
        return response.end();
      }

      response.status(206);
      response.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      response.setHeader("Content-Length", end - start + 1);
      return createReadStream(filePath, { start, end }).pipe(response);
    } catch (error) {
      return handleMediaError(response, error, "GET /api/media/:assetId/content");
    }
  });

  app.delete("/api/media/:assetId", (request: Request, response: Response) => {
    try {
      const assetId = requireText(request.params.assetId, "assetId");
      const docId = requireText(request.query.docId, "docId");
      const requestedBy = validateName(request.query.requestedBy);
      const dataAccess = getDataAccess();
      const document = dataAccess.documents.getDocumentById(docId);

      if (!document || document.isDeleted) {
        throw new HttpError(404, "Document not found.");
      }

      if (document.createdByName !== requestedBy) {
        throw new HttpError(403, "Only the document creator can delete resources.");
      }

      const asset = dataAccess.mediaAssets.getAssetById(assetId);
      if (!asset) {
        throw new HttpError(404, "Media asset not found.");
      }

      const filePath = path.join(UPLOAD_DIRECTORY, asset.storageName);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      dataAccess.mediaAssets.deleteAsset(asset.id);

      return sendSuccess(response, 200, { id: asset.id });
    } catch (error) {
      return handleMediaError(response, error, "DELETE /api/media/:assetId");
    }
  });
}
