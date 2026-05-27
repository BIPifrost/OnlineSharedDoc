import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
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
const MAX_MEDIA_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME_TYPES: Record<string, { mediaType: MediaAsset["mediaType"]; extension: string }> = {
  "image/jpeg": { mediaType: "image", extension: ".jpg" },
  "image/png": { mediaType: "image", extension: ".png" },
  "image/gif": { mediaType: "image", extension: ".gif" },
  "image/webp": { mediaType: "image", extension: ".webp" },
  "video/mp4": { mediaType: "video", extension: ".mp4" },
  "video/webm": { mediaType: "video", extension: ".webm" },
  "video/ogg": { mediaType: "video", extension: ".ogv" }
};

function requireText(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  return value.trim();
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
}
