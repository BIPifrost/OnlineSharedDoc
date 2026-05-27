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

export async function uploadMediaAsset(file: File, uploadedByName: string) {
  const name = validateGuestName(uploadedByName);

  try {
    const response = await fetch(
      `/api/media?name=${encodeURIComponent(file.name)}&uploadedBy=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type
        },
        body: file
      }
    );

    return await readJson<MediaAsset>(response);
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
