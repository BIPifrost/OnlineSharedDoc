import { useState } from "react";
import type { ConnectionStatus } from "../document-editor";
import { getConnectionStatusMeta, getSaveStatusMeta } from "./status";
import type {
  WorkspaceLoadState,
  WorkspaceSaveStatus
} from "./types";

type DocumentToolbarProps = {
  title: string;
  docId: string;
  loadState: WorkspaceLoadState;
  connectionStatus: ConnectionStatus;
  saveStatus: WorkspaceSaveStatus;
  onlineCount: number;
  latestUpdatedAt: string;
  isExportPanelOpen: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  editorFullscreen: boolean;
  previewFullscreen: boolean;
  helpPanelOpen: boolean;
  mediaPanelOpen: boolean;
  onSave: () => void;
  onExportClick: () => void;
  onHistoryClick: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onToggleEditorFullscreen: () => void;
  onTogglePreviewFullscreen: () => void;
  onToggleHelpPanel: () => void;
  onToggleMediaPanel: () => void;
  onTitleUpdate?: (newTitle: string) => void;
};

export function DocumentToolbar({
  title,
  docId,
  loadState,
  connectionStatus,
  saveStatus,
  onlineCount,
  latestUpdatedAt,
  isExportPanelOpen,
  leftPanelOpen,
  rightPanelOpen,
  editorFullscreen: editorFullscreenHidden,
  previewFullscreen: previewFullscreenHidden,
  helpPanelOpen,
  mediaPanelOpen,
  onSave,
  onExportClick,
  onHistoryClick,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleHelpPanel,
  onToggleMediaPanel,
  onTitleUpdate
}: DocumentToolbarProps) {
  const connectionMeta = getConnectionStatusMeta(connectionStatus);
  const saveMeta = getSaveStatusMeta(saveStatus);
  const disabled = loadState !== "ready";
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);

  function handleCopyDocId() {
    navigator.clipboard.writeText(docId).then(() => {
      const tooltip = document.getElementById("docid-copy-tooltip");
      if (tooltip) {
        tooltip.style.display = "block";
        setTimeout(() => {
          tooltip.style.display = "none";
        }, 2000);
      }
    });
  }

  function handleTitleSubmit() {
    const newTitle = editingTitle.trim();
    if (newTitle && newTitle !== title) {
      onTitleUpdate?.(newTitle);
    } else {
      setEditingTitle(title);
    }
    setIsEditingTitle(false);
  }

  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleTitleSubmit();
    } else if (event.key === "Escape") {
      setEditingTitle(title);
      setIsEditingTitle(false);
    }
  }

  return (
    <header className="workspace-toolbar">
      <div className="workspace-toolbar__identity">
        <div>
          <p className="workspace-toolbar__eyebrow">文档工作区</p>
          {isEditingTitle ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleSubmit}
                autoFocus
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  padding: "4px 8px",
                  border: "2px solid #0ea5e9",
                  borderRadius: "4px",
                  outline: "none"
                }}
              />
            </div>
          ) : (
            <h1
              onClick={() => {
                if (disabled) return;
                setEditingTitle(title);
                setIsEditingTitle(true);
              }}
              style={{
                cursor: disabled ? "default" : "pointer",
                padding: "4px 8px",
                borderRadius: "4px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = "#f0f9ff";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title={disabled ? undefined : "点击修改文档标题"}
            >
              {title}
            </h1>
          )}
        </div>
        <p
          className="workspace-toolbar__doc-meta"
          onClick={handleCopyDocId}
          style={{
            cursor: "pointer",
            position: "relative",
            display: "inline-block"
          }}
          title="点击复制文档 ID"
        >
          文档 ID: {docId}
          <span
            id="docid-copy-tooltip"
            style={{
              display: "none",
              position: "absolute",
              left: "100%",
              marginLeft: "8px",
              padding: "4px 8px",
              backgroundColor: "#10b981",
              color: "white",
              borderRadius: "4px",
              fontSize: "12px",
              whiteSpace: "nowrap",
              zIndex: 1000
            }}
          >
            已复制
          </span>
        </p>
      </div>

      <div className="workspace-toolbar__status-row">
        <span
          className={`status-pill status-pill--${connectionMeta.tone}`}
          aria-label={`连接状态: ${connectionMeta.label}`}
        >
          连接 · {connectionMeta.label}
        </span>
        <span
          className={`status-pill status-pill--${saveMeta.tone}`}
          aria-label={`保存状态: ${saveMeta.label}`}
        >
          保存 · {saveMeta.label}
        </span>
        <span className="status-pill status-pill--neutral">
          在线 · {onlineCount}
        </span>
        <span className="status-pill status-pill--neutral">
          更新 · {latestUpdatedAt}
        </span>
      </div>

      <div className="workspace-toolbar__actions">
        <button
          type="button"
          className={`toolbar-button${leftPanelOpen ? " toolbar-button--active" : ""}`}
          onClick={onToggleLeftPanel}
          disabled={disabled || editorFullscreenHidden || previewFullscreenHidden}
          title="协作者和快照列表"
        >
          {leftPanelOpen ? "隐藏侧边栏" : "显示侧边栏"}
        </button>
        <button
          type="button"
          className={`toolbar-button${rightPanelOpen ? " toolbar-button--active" : ""}`}
          onClick={onToggleRightPanel}
          disabled={disabled || editorFullscreenHidden || previewFullscreenHidden}
          title="聊天和系统消息"
        >
          {rightPanelOpen ? "隐藏面板" : "显示面板"}
        </button>
        <button
          type="button"
          className={`toolbar-button${helpPanelOpen ? " toolbar-button--active" : ""}`}
          onClick={onToggleHelpPanel}
          disabled={disabled}
          title="帮助文档 (Ctrl+/)"
        >
          {helpPanelOpen ? "隐藏帮助" : "帮助"}
        </button>
        <button
          type="button"
          className={`toolbar-button toolbar-button--media${mediaPanelOpen ? " toolbar-button--active" : ""}`}
          onClick={onToggleMediaPanel}
          disabled={disabled}
          title="上传并插入图片或视频"
          aria-pressed={mediaPanelOpen}
        >
          资源库
        </button>
        <button
          type="button"
          className="toolbar-button toolbar-button--primary"
          onClick={onSave}
          disabled={disabled || saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          className={`toolbar-button toolbar-button--primary${
            isExportPanelOpen ? " toolbar-button--active" : ""
          }`}
          onClick={onExportClick}
          disabled={disabled}
        >
          {isExportPanelOpen ? "隐藏导出" : "导出"}
        </button>
        <button
          type="button"
          className="toolbar-button toolbar-button--primary"
          onClick={onHistoryClick}
          disabled={disabled}
        >
          历史
        </button>
      </div>
    </header>
  );
}
