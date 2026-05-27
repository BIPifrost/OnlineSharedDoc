import { getReadableErrorMessage, validateGuestName } from "../features/auth-guest/home-flow";

export type MediaAsset = {
  id: string;
  originalName: string;
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: string;
  url: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type MediaUploadStatus = {
  uploadId: string;
  chunkSizeBytes: number;
  chunkCount: number;
  uploadedChunks: number[];
};

function getUploadStorageKey(file: File) {
  return `media-upload:${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? "资源操作失败，请重试。");
  }
  return payload.data;
}

export async function getMediaAssets() {
  const response = await fetch("/api/media");
  return readJson<MediaAsset[]>(response);
}

export async function uploadMediaAsset(
  file: File,
  uploadedByName: string,
  onProgress?: (progress: number, resumed: boolean) => void
) {
  const name = validateGuestName(uploadedByName);
  const storageKey = getUploadStorageKey(file);

  try {
    let status: MediaUploadStatus | null = null;
    const savedUploadId = window.localStorage.getItem(storageKey);
    if (savedUploadId) {
      const response = await fetch(`/api/media/uploads/${encodeURIComponent(savedUploadId)}`);
      if (response.ok) {
        status = await readJson<MediaUploadStatus>(response);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    }

    if (!status) {
      const response = await fetch("/api/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedBy: name
        })
      });
      status = await readJson<MediaUploadStatus>(response);
      window.localStorage.setItem(storageKey, status.uploadId);
    }

    const completed = new Set(status.uploadedChunks);
    const resumed = completed.size > 0;
    onProgress?.(Math.round((completed.size / status.chunkCount) * 100), resumed);

    for (let index = 0; index < status.chunkCount; index += 1) {
      if (completed.has(index)) {
        continue;
      }
      const start = index * status.chunkSizeBytes;
      const chunk = file.slice(start, Math.min(file.size, start + status.chunkSizeBytes));
      const response = await fetch(
        `/api/media/uploads/${encodeURIComponent(status.uploadId)}/chunks/${index}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: chunk
        }
      );
      await readJson<MediaUploadStatus>(response);
      completed.add(index);
      onProgress?.(Math.round((completed.size / status.chunkCount) * 100), resumed);
    }

    const response = await fetch(
      `/api/media/uploads/${encodeURIComponent(status.uploadId)}/complete`,
      { method: "POST" }
    );
    const asset = await readJson<MediaAsset>(response);
    window.localStorage.removeItem(storageKey);
    return asset;
  } catch (error) {
    throw new Error(getReadableErrorMessage(error, "媒体上传失败，请重试。"));
  }
}

export async function deleteMediaAsset(assetId: string, docId: string, requestedByName: string) {
  const name = validateGuestName(requestedByName);
  const response = await fetch(
    `/api/media/${encodeURIComponent(assetId)}?docId=${encodeURIComponent(docId)}&requestedBy=${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );

  return readJson<{ id: string }>(response);
}
