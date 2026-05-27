import {
  getReadableErrorMessage,
  validateDocIdInput,
  validateGuestName
} from "../features/auth-guest/home-flow";

export type ExportFormat = "markdown" | "html" | "txt";

export type DocumentSummary = {
  id: string;
  title: string;
  createdByName: string;
};

export type DocumentDetail = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  content: string;
  stateRevision: number;
  latestSnapshotVersion: number;
  latestUpdatedAt: string;
};

export type DocumentSnapshotSummary = {
  id: number;
  snapshotVersion: number;
  savedByName: string;
  savedAt: string;
};

export type DocumentSnapshotDetail = {
  id: number;
  docId: string;
  snapshotVersion: number;
  title: string;
  content: string;
  savedByName: string;
  savedAt: string;
};

export type DocumentDiffResult = {
  fromSnapshot: DocumentSnapshotDetail;
  toSnapshot: DocumentSnapshotDetail;
  diffHtml: string;
  diffTextSummary: string;
};

export type ChatMessage = {
  id: number;
  docId: string;
  senderName: string;
  message: string;
  sentAt: string;
};

export type SaveDocumentResult = {
  snapshotId: number;
  snapshotVersion: number;
  title: string;
  stateRevision: number;
  updatedAt: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function parseFileNameFromDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = value.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] ?? null;
}

async function readJson<T>(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The API did not return JSON. Confirm that the frontend is connected to the backend server."
    );
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? "Request failed. Please try again.");
  }

  return payload.data;
}

async function readBlobResponse(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiEnvelope<unknown>;
      throw new Error(payload.error ?? fallbackMessage);
    }

    throw new Error(fallbackMessage);
  }

  return {
    blob: await response.blob(),
    fileName: parseFileNameFromDisposition(response.headers.get("content-disposition"))
  };
}

export async function getAllDocuments() {
  try {
    const response = await fetch("/api/documents");
    return await readJson<DocumentSummary[]>(response);
  } catch (error) {
    throw new Error(
      getReadableErrorMessage(error, "获取文档列表失败，请重试。")
    );
  }
}

export async function createDocument(name: string, title?: string) {
  const guestName = validateGuestName(name);

  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: guestName,
        title: title?.trim() || undefined
      })
    });

    return await readJson<DocumentSummary>(response);
  } catch (error) {
    throw new Error(
      getReadableErrorMessage(error, "创建文档失败，请重试。")
    );
  }
}

export async function getDocumentDetail(docId: string) {
  const normalizedDocId = validateDocIdInput(docId);

  try {
    const response = await fetch(
      `/api/documents/${encodeURIComponent(normalizedDocId)}`
    );

    return await readJson<DocumentDetail>(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Document not found.") {
      throw new Error("Document not found. Please verify the document ID.");
    }

    throw new Error(
      getReadableErrorMessage(
        error,
        "Failed to load the document. Please verify the document ID."
      )
    );
  }
}

export async function getDocumentSnapshots(docId: string) {
  const normalizedDocId = validateDocIdInput(docId);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/snapshots`
  );

  return await readJson<DocumentSnapshotSummary[]>(response);
}

export async function getDocumentSnapshotDetail(docId: string, snapshotId: number) {
  const normalizedDocId = validateDocIdInput(docId);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/snapshots/${snapshotId}`
  );

  return await readJson<DocumentSnapshotDetail>(response);
}

export async function getDocumentDiff(
  docId: string,
  fromSnapshotId: number,
  toSnapshotId: number
) {
  const normalizedDocId = validateDocIdInput(docId);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/diff?from=${fromSnapshotId}&to=${toSnapshotId}`
  );

  return await readJson<DocumentDiffResult>(response);
}

export async function getDocumentChatMessages(docId: string) {
  const normalizedDocId = validateDocIdInput(docId);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/chat`
  );

  return await readJson<ChatMessage[]>(response);
}

export async function saveDocumentSnapshot(input: {
  docId: string;
  name: string;
  title?: string;
}) {
  const normalizedDocId = validateDocIdInput(input.docId);
  const guestName = validateGuestName(input.name);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: guestName,
        title: input.title
      })
    }
  );

  return await readJson<SaveDocumentResult>(response);
}

export async function downloadDocumentExport(input: {
  docId: string;
  format: ExportFormat;
  fallbackTitle: string;
  exportFileName?: string;
}) {
  const normalizedDocId = validateDocIdInput(input.docId);
  const exportTitle = input.exportFileName ?? input.fallbackTitle;
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/export?format=${input.format}&title=${encodeURIComponent(exportTitle)}`
  );
  const file = await readBlobResponse(
    response,
    "导出失败，请重试。"
  );
  const fallbackExtension = input.format === "markdown" ? "md" : input.format;
  const fileName =
    file.fileName ?? `${input.fallbackTitle || "document"}.${fallbackExtension}`;
  const objectUrl = window.URL.createObjectURL(file.blob);

  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }

  return {
    fileName
  };
}

export async function updateDocumentTitle(input: {
  docId: string;
  title: string;
}) {
  const normalizedDocId = validateDocIdInput(input.docId);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(normalizedDocId)}/title`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: input.title
      })
    }
  );

  return await readJson<{ id: string; title: string; updatedAt: string }>(response);
}
