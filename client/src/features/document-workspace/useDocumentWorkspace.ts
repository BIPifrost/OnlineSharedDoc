import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  downloadDocumentExport,
  getAllImportSnapshots,
  getDocumentChatMessages,
  getDocumentDetail,
  getDocumentDiff,
  getImportSnapshotDetail,
  getDocumentSnapshotDetail,
  getDocumentSnapshots,
  saveDocumentSnapshot,
  updateDocumentTitle,
  type ChatMessage,
  type DocumentDetail,
  type DocumentDiffResult,
  type DocumentSnapshotDetail,
  type DocumentSnapshotSummary,
  type ExportFormat,
  type ImportSnapshotSummary
} from "../../api";
import { getRealtimeServerHttpOrigin } from "../../app/runtime-origin";
import {
  GUEST_NAME_STORAGE_KEY,
  getPreferredGuestName,
  getReadableErrorMessage
} from "../auth-guest/home-flow";
import type { ConnectionStatus } from "../document-editor";
import { getEditorActivityLabel } from "./status";
import type {
  PresenceUser,
  WorkspaceAsyncState,
  WorkspaceLoadState,
  WorkspaceSaveStatus,
  WorkspaceSystemMessage
} from "./types";

type RoomJoinPayload = {
  docId: string;
  name: string;
};

type DocumentSavedPayload = {
  docId: string;
  name: string;
  snapshotVersion: number;
};

type RoomJoinedPayload = {
  docId: string;
  users: PresenceUser[];
};

type RealtimeChatMessage = ChatMessage;

type RealtimeSystemEvent = {
  id: number;
  docId: string;
  eventType: "user_joined" | "user_left" | "document_saved" | "reconnected";
  payloadJson: string;
  createdAt: string;
};

type SocketServerToClientEvents = {
  "presence:update": (users: PresenceUser[]) => void;
  "chat:new": (message: RealtimeChatMessage) => void;
  "system:new": (event: RealtimeSystemEvent) => void;
  "document:saved:broadcast": (payload: DocumentSavedPayload) => void;
  "room:joined": (payload: RoomJoinedPayload) => void;
};

type SocketClientToServerEvents = {
  "room:join": (payload: RoomJoinPayload) => void;
  "room:leave": (payload: RoomJoinPayload) => void;
  "chat:send": (payload: { docId: string; name: string; message: string }) => void;
  "document:saved": (payload: DocumentSavedPayload) => void;
  "client:reconnect-ready": (payload: RoomJoinPayload) => void;
};

const FALLBACK_GUEST_NAME = "Guest";
const FALLBACK_REMOTE_USER_NAME = "Collaborator";
const FALLBACK_USER_COLOR = "#0ea5e9";
const MAX_SYSTEM_MESSAGES = 12;
const MAX_CHAT_MESSAGES = 50;

function createSystemMessage(
  text: string,
  tone: WorkspaceSystemMessage["tone"],
  createdAt = new Date().toISOString()
): WorkspaceSystemMessage {
  return {
    id: `${createdAt}-${text}`,
    text,
    tone,
    createdAt
  };
}

function parseSystemPayload(payloadJson: string) {
  try {
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatRealtimeSystemMessage(event: RealtimeSystemEvent) {
  const payload = parseSystemPayload(event.payloadJson);
  const actor =
    typeof payload.name === "string" && payload.name.trim().length > 0
      ? payload.name
      : FALLBACK_REMOTE_USER_NAME;

  switch (event.eventType) {
    case "user_joined":
      return createSystemMessage(`${actor} joined the document.`, "info", event.createdAt);
    case "user_left":
      return createSystemMessage(`${actor} left the document.`, "warning", event.createdAt);
    case "reconnected":
      return createSystemMessage(`${actor} reconnected to the session.`, "success", event.createdAt);
    case "document_saved": {
      const version =
        typeof payload.snapshotVersion === "number"
          ? `v${payload.snapshotVersion}`
          : "a new snapshot";
      return createSystemMessage(
        `${actor} saved the document and created ${version}.`,
        "success",
        event.createdAt
      );
    }
    default:
      return createSystemMessage("A new system event was received.", "info", event.createdAt);
  }
}

function appendUniqueSystemMessage(
  previous: WorkspaceSystemMessage[],
  next: WorkspaceSystemMessage
) {
  if (previous.some((message) => message.id === next.id)) {
    return previous;
  }

  return [next, ...previous].slice(0, MAX_SYSTEM_MESSAGES);
}

function appendUniqueChatMessage(previous: ChatMessage[], next: ChatMessage) {
  if (previous.some((message) => message.id === next.id)) {
    return previous;
  }

  return [...previous, next].slice(-MAX_CHAT_MESSAGES);
}

function combineConnectionStatus(
  editorStatus: ConnectionStatus,
  socketStatus: ConnectionStatus
): ConnectionStatus {
  if (editorStatus === "disconnected" || socketStatus === "disconnected") {
    return "disconnected";
  }

  if (editorStatus === "connecting" || socketStatus === "connecting") {
    return "connecting";
  }

  return "connected";
}

function buildSnapshotSelection(previous: number[], snapshotId: number) {
  if (previous.includes(snapshotId)) {
    return previous.filter((item) => item !== snapshotId);
  }

  if (previous.length >= 2) {
    return [...previous.slice(1), snapshotId];
  }

  return [...previous, snapshotId];
}

export function useDocumentWorkspace(docId: string, queryName: string | null) {
  const storedName =
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(GUEST_NAME_STORAGE_KEY);
  const guestName =
    getPreferredGuestName({
      queryName,
      storedName
    }) || FALLBACK_GUEST_NAME;

  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loadState, setLoadState] = useState<WorkspaceLoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [editorConnectionStatus, setEditorConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [socketConnectionStatus, setSocketConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [isSynced, setIsSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState<WorkspaceSaveStatus>("saved");
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [currentSocketId, setCurrentSocketId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<DocumentSnapshotSummary[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<number[]>([]);
  const [snapshotDetail, setSnapshotDetail] =
    useState<DocumentSnapshotDetail | null>(null);
  const [snapshotDetailState, setSnapshotDetailState] =
    useState<WorkspaceAsyncState>("idle");
  const [snapshotDetailError, setSnapshotDetailError] = useState("");
  const [diffResult, setDiffResult] = useState<DocumentDiffResult | null>(null);
  const [diffState, setDiffState] = useState<WorkspaceAsyncState>("idle");
  const [diffError, setDiffError] = useState("");
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importListState, setImportListState] =
    useState<WorkspaceAsyncState>("idle");
  const [importListError, setImportListError] = useState("");
  const [importSnapshots, setImportSnapshots] = useState<ImportSnapshotSummary[]>([]);
  const [selectedImportSnapshotId, setSelectedImportSnapshotId] =
    useState<number | null>(null);
  const [selectedImportSnapshotDetail, setSelectedImportSnapshotDetail] =
    useState<DocumentSnapshotDetail | null>(null);
  const [importDetailState, setImportDetailState] =
    useState<WorkspaceAsyncState>("idle");
  const [importDetailError, setImportDetailError] = useState("");
  const [replaceRequest, setReplaceRequest] =
    useState<{ id: number; text: string } | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [systemMessages, setSystemMessages] = useState<WorkspaceSystemMessage[]>([]);
  
  // 布局状态管理
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // 左右分栏比例 (0-100)
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const contentRef = useRef("");
  const lastSavedContentRef = useRef("");
  const lastLocalSavedVersionRef = useRef<number | null>(null);
  const lastSyncStateRef = useRef(false);
  const pendingImportRef = useRef(false);
  const importedDirtyRef = useRef(false);
  const socketRef = useRef<
    Socket<SocketServerToClientEvents, SocketClientToServerEvents> | null
  >(null);

  const connectionStatus = useMemo(
    () => combineConnectionStatus(editorConnectionStatus, socketConnectionStatus),
    [editorConnectionStatus, socketConnectionStatus]
  );

  useEffect(() => {
    contentRef.current = editorContent;
  }, [editorContent]);

  useEffect(() => {
    if (typeof window === "undefined" || !guestName) {
      return;
    }

    window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, guestName);
  }, [guestName]);

  useEffect(() => {
    let cancelled = false;

    setDetail(null);
    setEditorContent("");
    setLoadState("loading");
    setLoadError("");
    setEditorConnectionStatus("connecting");
    setSocketConnectionStatus("connecting");
    setIsSynced(false);
    setSaveStatus("saved");
    setPresenceUsers([]);
    setCurrentSocketId(null);
    setSnapshots([]);
    setSelectedSnapshotIds([]);
    setSnapshotDetail(null);
    setSnapshotDetailState("idle");
    setSnapshotDetailError("");
    setDiffResult(null);
    setDiffState("idle");
    setDiffError("");
    setIsExportPanelOpen(false);
    setExportingFormat(null);
    setExportError("");
    setIsImportModalOpen(false);
    setImportListState("idle");
    setImportListError("");
    setImportSnapshots([]);
    setSelectedImportSnapshotId(null);
    setSelectedImportSnapshotDetail(null);
    setImportDetailState("idle");
    setImportDetailError("");
    setReplaceRequest(null);
    setIsImportConfirmOpen(false);
    setChatMessages([]);
    setChatDraft("");
    setSystemMessages([]);
    setLeftPanelOpen(false);
    setRightPanelOpen(false);
    setEditorFullscreen(false);
    setPreviewFullscreen(false);
    setSplitRatio(50);
    setHelpPanelOpen(false);
    setMediaPanelOpen(false);
    contentRef.current = "";
    lastSavedContentRef.current = "";
    lastLocalSavedVersionRef.current = null;
    lastSyncStateRef.current = false;
    pendingImportRef.current = false;
    importedDirtyRef.current = false;

    Promise.all([
      getDocumentDetail(docId),
      getDocumentSnapshots(docId),
      getDocumentChatMessages(docId)
    ])
      .then(([nextDetail, nextSnapshots, nextChatMessages]) => {
        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setEditorContent(nextDetail.content);
        contentRef.current = nextDetail.content;
        lastSavedContentRef.current = nextDetail.content;
        setSnapshots(nextSnapshots);
        setChatMessages(nextChatMessages);
        setLoadState("ready");
        setSystemMessages((previous) =>
          appendUniqueSystemMessage(
            previous,
            createSystemMessage("Document shell loaded. Realtime services are connecting.", "info")
          )
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message = getReadableErrorMessage(
          error,
          "Failed to load the document. Please try again."
        );
        setLoadError(message);
        setLoadState("error");
        setSystemMessages((previous) =>
          appendUniqueSystemMessage(previous, createSystemMessage(message, "error"))
        );
      });

    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    if (loadState !== "ready") {
      return;
    }

    const socket: Socket<SocketServerToClientEvents, SocketClientToServerEvents> = io(
      getRealtimeServerHttpOrigin(),
      {
        path: "/socket.io",
        reconnection: true
      }
    );

    socketRef.current = socket;

    const joinRoom = () => {
      setCurrentSocketId(socket.id ?? null);
      setSocketConnectionStatus("connected");
      socket.emit("room:join", {
        docId,
        name: guestName
      });
    };

    socket.on("connect", joinRoom);
    socket.on("disconnect", () => {
      setSocketConnectionStatus("disconnected");
      setPresenceUsers((previous) =>
        previous.map((user) => ({
          ...user,
          online: false
        }))
      );
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage("Realtime room connection lost. Automatic reconnect is in progress.", "warning")
        )
      );
    });
    socket.io.on("reconnect_attempt", () => {
      setSocketConnectionStatus("connecting");
    });
    socket.io.on("reconnect", () => {
      setCurrentSocketId(socket.id ?? null);
      setSocketConnectionStatus("connected");
      socket.emit("client:reconnect-ready", {
        docId,
        name: guestName
      });
    });
    socket.on("room:joined", (payload) => {
      setCurrentSocketId(socket.id ?? null);
      setSocketConnectionStatus("connected");
      setPresenceUsers(payload.users);
    });
    socket.on("presence:update", (users) => {
      setPresenceUsers(users);
    });
    socket.on("chat:new", (message) => {
      setChatMessages((previous) => appendUniqueChatMessage(previous, message));
    });
    socket.on("system:new", (event) => {
      const payload = parseSystemPayload(event.payloadJson);
      const snapshotVersion =
        typeof payload.snapshotVersion === "number"
          ? payload.snapshotVersion
          : null;
      const isOwnSaveEcho =
        event.eventType === "document_saved" &&
        typeof payload.name === "string" &&
        payload.name === guestName &&
        snapshotVersion !== null &&
        snapshotVersion === lastLocalSavedVersionRef.current;

      if (isOwnSaveEcho) {
        lastLocalSavedVersionRef.current = null;
        return;
      }

      setSystemMessages((previous) =>
        appendUniqueSystemMessage(previous, formatRealtimeSystemMessage(event))
      );
    });
    socket.on("document:saved:broadcast", (payload) => {
      const now = new Date().toISOString();

      void refreshSnapshots().catch(() => {
        // Keep the realtime session alive even if snapshot polling fails.
      });

      lastSavedContentRef.current = contentRef.current;
      pendingImportRef.current = false;
      importedDirtyRef.current = false;
      setSaveStatus("saved");
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              content: contentRef.current,
              latestSnapshotVersion: Math.max(
                previous.latestSnapshotVersion,
                payload.snapshotVersion
              ),
              updatedAt: now,
              latestUpdatedAt: now
            }
          : previous
      );
    });

    return () => {
      socket.emit("room:leave", {
        docId,
        name: guestName
      });
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [docId, guestName, loadState]);

  useEffect(() => {
    setSelectedSnapshotIds((previous) =>
      previous.filter((snapshotId) =>
        snapshots.some((snapshot) => snapshot.id === snapshotId)
      )
    );
  }, [snapshots]);

  useEffect(() => {
    let cancelled = false;

    if (selectedSnapshotIds.length === 0) {
      setSnapshotDetail(null);
      setSnapshotDetailState("idle");
      setSnapshotDetailError("");
      setDiffResult(null);
      setDiffState("idle");
      setDiffError("");
      return () => {
        cancelled = true;
      };
    }

    if (selectedSnapshotIds.length === 1) {
      const [snapshotId] = selectedSnapshotIds;

      setDiffResult(null);
      setDiffState("idle");
      setDiffError("");
      setSnapshotDetail(null);
      setSnapshotDetailState("loading");
      setSnapshotDetailError("");

      getDocumentSnapshotDetail(docId, snapshotId)
        .then((result) => {
          if (cancelled) {
            return;
          }

          setSnapshotDetail(result);
          setSnapshotDetailState("ready");
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }

          setSnapshotDetailState("error");
          setSnapshotDetailError(
            getReadableErrorMessage(
              error,
              "Failed to load snapshot detail. Please try again."
            )
          );
        });

      return () => {
        cancelled = true;
      };
    }

    const [fromSnapshotId, toSnapshotId] = selectedSnapshotIds;
    setSnapshotDetail(null);
    setSnapshotDetailState("idle");
    setSnapshotDetailError("");
    setDiffResult(null);
    setDiffState("loading");
    setDiffError("");

    getDocumentDiff(docId, fromSnapshotId, toSnapshotId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setDiffResult(result);
        setDiffState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setDiffState("error");
        setDiffError(
          getReadableErrorMessage(
            error,
            "Failed to load version diff. Please try again."
          )
        );
      });

    return () => {
      cancelled = true;
    };
  }, [docId, selectedSnapshotIds]);

  async function refreshSnapshots() {
    const nextSnapshots = await getDocumentSnapshots(docId);
    setSnapshots(nextSnapshots);
  }

  async function handleSave() {
    if (!detail) {
      return;
    }

    setSaveStatus("saving");

    try {
      const result = await saveDocumentSnapshot({
        docId,
        name: guestName,
        title: detail.title
      });

      await refreshSnapshots();

      lastSavedContentRef.current = contentRef.current;
      lastLocalSavedVersionRef.current = result.snapshotVersion;
      pendingImportRef.current = false;
      importedDirtyRef.current = false;
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              title: result.title,
              content: contentRef.current,
              stateRevision: result.stateRevision,
              latestSnapshotVersion: result.snapshotVersion,
              updatedAt: result.updatedAt,
              latestUpdatedAt: result.updatedAt
            }
          : previous
      );
      setSaveStatus("saved");
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage(
            `Save succeeded. Snapshot v${result.snapshotVersion} is now available.`,
            "success"
          )
        )
      );
      socketRef.current?.emit("document:saved", {
        docId,
        name: guestName,
        snapshotVersion: result.snapshotVersion
      });
    } catch (error) {
      const message = getReadableErrorMessage(
        error,
        "Save failed. Please try again."
      );
      setSaveStatus("unsaved");
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(previous, createSystemMessage(message, "error"))
      );
    }
  }

  function handleSnapshotToggle(snapshotId: number) {
    setSelectedSnapshotIds((previous) =>
      buildSnapshotSelection(previous, snapshotId)
    );
  }

  function handleClearSnapshotSelection() {
    setSelectedSnapshotIds([]);
  }

  function handleExportClick() {
    setIsExportPanelOpen((previous) => !previous);
    setExportError("");
  }

  async function openImportModal() {
    setIsImportModalOpen(true);
    setImportListState("loading");
    setImportListError("");
    setSelectedImportSnapshotId(null);
    setSelectedImportSnapshotDetail(null);
    setImportDetailState("idle");
    setImportDetailError("");
    setIsImportConfirmOpen(false);

    try {
      const result = await getAllImportSnapshots();
      setImportSnapshots(result);
      setImportListState("ready");
    } catch (error) {
      setImportListState("error");
      setImportListError(
        getReadableErrorMessage(error, "Failed to load import snapshots.")
      );
    }
  }

  function closeImportModal() {
    setIsImportModalOpen(false);
    setSelectedImportSnapshotId(null);
    setSelectedImportSnapshotDetail(null);
    setImportDetailState("idle");
    setImportDetailError("");
    setIsImportConfirmOpen(false);
  }

  async function selectImportSnapshot(snapshotId: number) {
    setSelectedImportSnapshotId(snapshotId);
    setSelectedImportSnapshotDetail(null);
    setImportDetailState("loading");
    setImportDetailError("");
    setIsImportConfirmOpen(false);

    try {
      const result = await getImportSnapshotDetail(snapshotId);
      setSelectedImportSnapshotDetail(result);
      setImportDetailState("ready");
    } catch (error) {
      setImportDetailState("error");
      setImportDetailError(
        getReadableErrorMessage(error, "Failed to load snapshot detail.")
      );
    }
  }

  function requestImportSnapshot() {
    if (!selectedImportSnapshotDetail) {
      return;
    }

    if (editorContent !== lastSavedContentRef.current) {
      setIsImportConfirmOpen(true);
      return;
    }

    pendingImportRef.current = true;
    setReplaceRequest({
      id: Date.now(),
      text: selectedImportSnapshotDetail.content
    });
  }

  function confirmImportSnapshot() {
    if (!selectedImportSnapshotDetail) {
      return;
    }

    setIsImportConfirmOpen(false);
    pendingImportRef.current = true;
    setReplaceRequest({
      id: Date.now(),
      text: selectedImportSnapshotDetail.content
    });
  }

  function cancelImportConfirmation() {
    setIsImportConfirmOpen(false);
  }

  function handleReplaceApplied(id: number) {
    importedDirtyRef.current = true;
    setReplaceRequest((current) => (current?.id === id ? null : current));
    closeImportModal();
  }

  async function handleExportDownload(format: ExportFormat, exportFileName?: string) {
    const fallbackTitle = detail?.title?.trim() || docId;

    setExportError("");
    setExportingFormat(format);

    try {
      const result = await downloadDocumentExport({
        docId,
        format,
        fallbackTitle,
        exportFileName
      });

      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage(`导出成功: ${result.fileName}`, "success")
        )
      );
    } catch (error) {
      const message = getReadableErrorMessage(
        error,
        "导出失败，请重试。"
      );
      setExportError(message);
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(previous, createSystemMessage(message, "error"))
      );
    } finally {
      setExportingFormat(null);
    }
  }

  function handleEditorConnectionChange(status: ConnectionStatus) {
    setEditorConnectionStatus(status);

    if (status === "disconnected") {
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage("Editor transport disconnected. Automatic reconnect is in progress.", "warning")
        )
      );
    }
  }

  function handleEditorSyncChange(nextSynced: boolean) {
    setIsSynced(nextSynced);

    if (nextSynced && !lastSyncStateRef.current) {
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage("Document state is back in sync.", "success")
        )
      );
    }

    lastSyncStateRef.current = nextSynced;
  }

  function handleEditorContentChange(nextContent: string) {
    setEditorContent(nextContent);
    contentRef.current = nextContent;

    if (loadState !== "ready") {
      return;
    }

    if (pendingImportRef.current) {
      pendingImportRef.current = false;
      importedDirtyRef.current = true;
      setSaveStatus("unsaved");
      return;
    }

    if (importedDirtyRef.current) {
      setSaveStatus("unsaved");
      return;
    }

    setSaveStatus(nextContent === lastSavedContentRef.current ? "saved" : "unsaved");
  }

  function handleChatDraftChange(value: string) {
    setChatDraft(value);
  }

  function handleChatSend() {
    const message = chatDraft.trim();

    if (!message) {
      return;
    }

    if (!socketRef.current?.connected) {
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage(
            "Realtime room is not ready, so the chat message could not be sent.",
            "warning"
          )
        )
      );
      return;
    }

    socketRef.current.emit("chat:send", {
      docId,
      name: guestName,
      message
    });
    setChatDraft("");
  }

  async function handleTitleUpdate(newTitle: string) {
    try {
      const result = await updateDocumentTitle({
        docId,
        title: newTitle
      });

      setDetail((previous) =>
        previous
          ? {
              ...previous,
              title: result.title,
              updatedAt: result.updatedAt
            }
          : previous
      );

      setSystemMessages((previous) =>
        appendUniqueSystemMessage(
          previous,
          createSystemMessage(`文档标题已更新为: ${result.title}`, "success")
        )
      );
    } catch (error) {
      const message = getReadableErrorMessage(
        error,
        "更新标题失败，请重试。"
      );
      setSystemMessages((previous) =>
        appendUniqueSystemMessage(previous, createSystemMessage(message, "error"))
      );
    }
  }

  // 布局控制函数
  function toggleLeftPanel() {
    setLeftPanelOpen((prev) => !prev);
    if (editorFullscreen || previewFullscreen) {
      setEditorFullscreen(false);
      setPreviewFullscreen(false);
    }
  }

  function toggleRightPanel() {
    setRightPanelOpen((prev) => !prev);
    if (editorFullscreen || previewFullscreen) {
      setEditorFullscreen(false);
      setPreviewFullscreen(false);
    }
  }

  function toggleEditorFullscreen() {
    setEditorFullscreen((prev) => !prev);
    if (!editorFullscreen) {
      setPreviewFullscreen(false);
    }
  }

  function togglePreviewFullscreen() {
    setPreviewFullscreen((prev) => !prev);
    if (!previewFullscreen) {
      setEditorFullscreen(false);
    }
  }

  function handleSplitRatioChange(newRatio: number) {
    setSplitRatio(Math.max(20, Math.min(80, newRatio)));
  }

  function toggleHelpPanel() {
    setHelpPanelOpen((prev) => !prev);
  }

  function toggleMediaPanel() {
    setMediaPanelOpen((previous) => !previous);
  }

  const visibleUsers =
    presenceUsers.length > 0
      ? presenceUsers
      : [
          {
            clientId: currentSocketId ?? "local-user",
            name: guestName,
            color: FALLBACK_USER_COLOR,
            online: connectionStatus !== "disconnected",
            joinedAt: detail?.createdAt ?? new Date().toISOString()
          }
        ];

  return {
    docId,
    guestName,
    detail,
    editorContent,
    loadState,
    loadError,
    connectionStatus,
    isSynced,
    saveStatus,
    presenceUsers: visibleUsers,
    currentSocketId,
    snapshots,
    selectedSnapshotIds,
    snapshotDetail,
    snapshotDetailState,
    snapshotDetailError,
    diffResult,
    diffState,
    diffError,
    isExportPanelOpen,
    exportingFormat,
    exportError,
    isImportModalOpen,
    importListState,
    importListError,
    importSnapshots,
    selectedImportSnapshotId,
    selectedImportSnapshotDetail,
    importDetailState,
    importDetailError,
    replaceRequest,
    isImportConfirmOpen,
    chatMessages,
    chatDraft,
    systemMessages,
    canSendChat: chatDraft.trim().length > 0,
    latestActivityLabel: getEditorActivityLabel({
      loadState,
      connectionStatus,
      saveStatus,
      isSynced
    }),
    onlineCount: visibleUsers.filter((user) => user.online).length,
    // 布局状态
    leftPanelOpen,
    rightPanelOpen,
    editorFullscreen,
    previewFullscreen,
    splitRatio,
    helpPanelOpen,
    mediaPanelOpen,
    // 布局控制函数
    toggleLeftPanel,
    toggleRightPanel,
    toggleEditorFullscreen,
    togglePreviewFullscreen,
    handleSplitRatioChange,
    toggleHelpPanel,
    toggleMediaPanel,
    handleEditorConnectionChange,
    handleEditorContentChange,
    handleEditorSyncChange,
    handleChatDraftChange,
    handleChatSend,
    handleExportClick,
    handleExportDownload,
    openImportModal,
    closeImportModal,
    selectImportSnapshot,
    requestImportSnapshot,
    confirmImportSnapshot,
    cancelImportConfirmation,
    handleReplaceApplied,
    handleSave,
    handleSnapshotToggle,
    handleClearSnapshotSelection,
    handleTitleUpdate
  };
}
