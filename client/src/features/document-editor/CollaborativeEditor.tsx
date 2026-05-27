import { useEffect, useRef, useState, startTransition } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab } from "y-codemirror.next";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { getRealtimeServerWebSocketOrigin } from "../../app/runtime-origin";
import "./collaborative-editor.css";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type CollaborativeEditorProps = {
  docId: string;
  userName: string;
  userColor: string;
  className?: string;
  websocketPath?: string;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onSyncStateChange?: (isSynced: boolean) => void;
  onContentChange?: (content: string) => void;
  insertRequest?: { id: number; text: string } | null;
  onInsertApplied?: (id: number) => void;
  replaceRequest?: { id: number; text: string } | null;
  onReplaceApplied?: (id: number) => void;
};

function createColorLight(color: string) {
  return `${color}33`;
}

function buildWebsocketServerUrl(websocketPath: string) {
  if (websocketPath.startsWith("ws://") || websocketPath.startsWith("wss://")) {
    return websocketPath.replace(/\/$/, "");
  }

  const resolved = new URL(websocketPath, getRealtimeServerWebSocketOrigin());

  return resolved.toString().replace(/\/$/, "");
}

export function CollaborativeEditor({
  docId,
  userName,
  userColor,
  className,
  websocketPath = "/yjs",
  onConnectionStatusChange,
  onSyncStateChange,
  onContentChange,
  insertRequest,
  onInsertApplied,
  replaceRequest,
  onReplaceApplied
}: CollaborativeEditorProps) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const connectionStatusCallbackRef = useRef(onConnectionStatusChange);
  const syncStateCallbackRef = useRef(onSyncStateChange);
  const contentChangeCallbackRef = useRef(onContentChange);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    connectionStatusCallbackRef.current = onConnectionStatusChange;
    syncStateCallbackRef.current = onSyncStateChange;
    contentChangeCallbackRef.current = onContentChange;
  }, [onConnectionStatusChange, onContentChange, onSyncStateChange]);

  useEffect(() => {
    const hostElement = editorHostRef.current;
    if (!hostElement) {
      return;
    }

    hostElement.replaceChildren();

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      buildWebsocketServerUrl(websocketPath),
      docId,
      ydoc
    );
    const ytext = ydoc.getText("content");
    const undoManager = new Y.UndoManager(ytext);

    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
      colorLight: createColorLight(userColor)
    });

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return;
          }

          contentChangeCallbackRef.current?.(update.state.doc.toString());
        }),
        yCollab(ytext, provider.awareness, {
          undoManager
        })
      ]
    });

    const view = new EditorView({
      state,
      parent: hostElement
    });
    editorViewRef.current = view;

    const handleStatus = (event: { status: ConnectionStatus }) => {
      startTransition(() => {
        setConnectionStatus(event.status);
      });
      connectionStatusCallbackRef.current?.(event.status);
    };

    const handleSync = (synced: boolean) => {
      startTransition(() => {
        setIsSynced(synced);
      });
      syncStateCallbackRef.current?.(synced);
      contentChangeCallbackRef.current?.(view.state.doc.toString());
    };

    provider.on("status", handleStatus);
    provider.on("sync", handleSync);
    contentChangeCallbackRef.current?.(view.state.doc.toString());

    return () => {
      provider.off("status", handleStatus);
      provider.off("sync", handleSync);
      provider.destroy();
      undoManager.destroy();
      view.destroy();
      editorViewRef.current = null;
      ydoc.destroy();
    };
  }, [
    docId,
    userColor,
    userName,
    websocketPath
  ]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view || !insertRequest) {
      return;
    }

    const from = view.state.selection.main.head;
    const prefix = from > 0 ? "\n\n" : "";
    const insertedText = `${prefix}${insertRequest.text}\n\n`;
    view.dispatch({
      changes: { from, insert: insertedText },
      selection: { anchor: from + insertedText.length }
    });
    view.focus();
    onInsertApplied?.(insertRequest.id);
  }, [insertRequest, onInsertApplied]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view || !replaceRequest) {
      return;
    }

    const currentText = view.state.doc.toString();
    view.dispatch({
      changes: {
        from: 0,
        to: currentText.length,
        insert: replaceRequest.text
      },
      selection: { anchor: 0 }
    });
    view.focus();
    onReplaceApplied?.(replaceRequest.id);
  }, [replaceRequest, onReplaceApplied]);

  return (
    <section className={`collaborative-editor ${className ?? ""}`.trim()}>
      <header className="collaborative-editor__status">
        <span className="collaborative-editor__badge">
          Socket: {connectionStatus === "connected" ? "已连接" : connectionStatus === "connecting" ? "连接中" : "已断开"}
        </span>
        <span className="collaborative-editor__badge">
          Yjs: {isSynced ? "已同步" : "同步中"}
        </span>
      </header>
      <div className="collaborative-editor__surface" ref={editorHostRef} />
    </section>
  );
}
