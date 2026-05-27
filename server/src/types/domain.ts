export type ExportFormat = "markdown" | "html" | "txt" | "media-zip";

export type SystemEventType =
  | "user_joined"
  | "user_left"
  | "document_saved"
  | "reconnected";

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type PresenceUser = {
  clientId: string;
  name: string;
  color: string;
  online: boolean;
  joinedAt: string;
};

export type RoomJoinPayload = {
  docId: string;
  name: string;
};

export type RoomLeavePayload = {
  docId: string;
  name: string;
};

export type ChatSendPayload = {
  docId: string;
  name: string;
  message: string;
};

export type DocumentSavedPayload = {
  docId: string;
  name: string;
  snapshotVersion: number;
};

export type ClientReconnectReadyPayload = {
  docId: string;
  name: string;
};

export type RoomJoinedPayload = {
  docId: string;
  users: PresenceUser[];
};

export type DocumentSavedBroadcastPayload = {
  docId: string;
  name: string;
  snapshotVersion: number;
};

export type SocketClientToServerEvents = {
  "room:join": (payload: RoomJoinPayload) => void;
  "room:leave": (payload: RoomLeavePayload) => void;
  "chat:send": (payload: ChatSendPayload) => void;
  "document:saved": (payload: DocumentSavedPayload) => void;
  "client:reconnect-ready": (payload: ClientReconnectReadyPayload) => void;
};

export type SocketServerToClientEvents = {
  "presence:update": (users: PresenceUser[]) => void;
  "chat:new": (message: ChatMessage) => void;
  "system:new": (event: SystemEvent) => void;
  "document:saved:broadcast": (payload: DocumentSavedBroadcastPayload) => void;
  "room:joined": (payload: RoomJoinedPayload) => void;
};

export type DocumentMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  isDeleted: boolean;
};

export type DocumentState = {
  docId: string;
  yjsState: Uint8Array;
  plainText: string;
  markdownText: string;
  stateRevision: number;
  updatedAt: string;
};

export type DocumentSnapshot = {
  id: number;
  docId: string;
  snapshotVersion: number;
  title: string;
  content: string;
  savedByName: string;
  savedAt: string;
};

export type DocumentSnapshotSummary = {
  id: number;
  docId: string;
  snapshotVersion: number;
  title: string;
  savedByName: string;
  savedAt: string;
  contentPreview: string;
};

export type ChatMessage = {
  id: number;
  docId: string;
  senderName: string;
  message: string;
  sentAt: string;
};

export type SystemEvent = {
  id: number;
  docId: string;
  eventType: SystemEventType;
  payloadJson: string;
  createdAt: string;
};

export type MediaAsset = {
  id: string;
  originalName: string;
  mediaType: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  storageName: string;
  uploadedByName: string;
  createdAt: string;
};
