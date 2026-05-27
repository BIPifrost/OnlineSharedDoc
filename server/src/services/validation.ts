import type { ExportFormat } from "../types/domain.js";
import { HttpError } from "./http-errors.js";

const exportFormats = new Set<ExportFormat>(["markdown", "html", "txt", "media-zip"]);

function requireTrimmedText(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new HttpError(400, `${fieldName} cannot be empty.`);
  }

  return trimmed;
}

function optionalTrimmedText(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "必须提供有效的文本。");
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

export function validateName(value: unknown) {
  return requireTrimmedText(value, "name");
}

export function validateDocId(value: unknown) {
  return requireTrimmedText(value, "docId");
}

export function validateTitle(value: unknown) {
  return requireTrimmedText(value, "title");
}

export function validateOptionalTitle(value: unknown) {
  return optionalTrimmedText(value);
}

export function validateSnapshotId(value: unknown) {
  const text = requireTrimmedText(value, "snapshotId");
  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, "snapshotId must be a positive integer.");
  }

  return parsed;
}

export function validateDiffSnapshotId(value: unknown, fieldName: "from" | "to") {
  const text = requireTrimmedText(value, fieldName);
  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

export function validateExportFormat(value: unknown): ExportFormat {
  const text = requireTrimmedText(value, "format") as ExportFormat;

  if (!exportFormats.has(text)) {
    throw new HttpError(400, "format must be one of markdown, html, txt, or media-zip.");
  }

  return text;
}
