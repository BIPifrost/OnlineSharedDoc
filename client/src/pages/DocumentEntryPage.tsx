import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useCallback, useRef } from "react";
import { CollaborativeEditor } from "../features/document-editor";
import { DocumentHistoryPanel } from "../features/document-history";
import { DocumentSidebarLeft } from "../features/document-workspace/DocumentSidebarLeft";
import { DocumentSidebarRight } from "../features/document-workspace/DocumentSidebarRight";
import { MarkdownPreview } from "../features/document-workspace/MarkdownPreview";
import { DocumentToolbar } from "../features/document-workspace/DocumentToolbar";
import { ResizableSplitPane } from "../features/document-workspace/ResizableSplitPane";
import { SidebarDrawer } from "../features/document-workspace/SidebarDrawer";
import { HelpPanel } from "../features/document-workspace/HelpPanel";
import { MediaLibraryPanel } from "../features/document-workspace/MediaLibraryPanel";
import { formatDateTime } from "../features/document-workspace/status";
import { useDocumentWorkspace } from "../features/document-workspace/useDocumentWorkspace";
import { ExportPanel } from "../features/export-panel";
import { useState } from "react";

const FALLBACK_EDITOR_COLOR = "#0ea5e9";

export function DocumentEntryPage() {
  const { docId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const workspace = useDocumentWorkspace(docId, searchParams.get("name"));
  const [insertRequest, setInsertRequest] = useState<{ id: number; text: string } | null>(null);

  // Ref to prevent stale closures in keyboard handler
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const currentUser =
    workspace.presenceUsers.find((user) =>
      workspace.currentSocketId
        ? user.clientId === workspace.currentSocketId
        : user.name === workspace.guestName
    ) ?? workspace.presenceUsers[0];

  const editorUserColor = currentUser?.color ?? FALLBACK_EDITOR_COLOR;
  const toolbarTitle =
    workspace.detail?.title ??
    (workspace.loadState === "loading"
      ? "正在加载文档..."
      : "文档工作区");

  function handleHistoryClick() {
    document
      .getElementById("document-history-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    const currentWorkspace = workspaceRef.current;

    // Ctrl+S / Cmd+S: Save document
    if (modKey && event.key === "s") {
      event.preventDefault();
      currentWorkspace.handleSave();
      return;
    }

    // Ctrl+/ / Cmd+/: Toggle help panel
    if (modKey && event.key === "/") {
      event.preventDefault();
      currentWorkspace.toggleHelpPanel();
      return;
    }

    // Ctrl+B / Cmd+B: Toggle left panel
    if (modKey && event.key === "b") {
      event.preventDefault();
      currentWorkspace.toggleLeftPanel();
      return;
    }

    // Ctrl+P / Cmd+P: Toggle right panel
    if (modKey && event.key === "p") {
      event.preventDefault();
      currentWorkspace.toggleRightPanel();
      return;
    }

    // Ctrl+E / Cmd+E: Toggle export panel
    if (modKey && event.key === "e") {
      event.preventDefault();
      currentWorkspace.handleExportClick();
      return;
    }

    // F11: Toggle editor fullscreen
    if (event.key === "F11" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      currentWorkspace.toggleEditorFullscreen();
      return;
    }

    // Ctrl+F11 / Cmd+F11: Toggle preview fullscreen
    if ((modKey) && event.key === "F11") {
      event.preventDefault();
      currentWorkspace.togglePreviewFullscreen();
      return;
    }
  }, []);

  // Register keyboard shortcut listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Determine which drawer is open and what content to show
  const rightDrawerContent = (
    <DocumentSidebarRight
      chatMessages={workspace.chatMessages}
      chatDraft={workspace.chatDraft}
      canSendChat={workspace.canSendChat}
      onChatDraftChange={workspace.handleChatDraftChange}
      onChatSend={workspace.handleChatSend}
      systemMessages={workspace.systemMessages}
    />
  );

  return (
    <main className="workspace-shell workspace-shell--immersive">
      <DocumentToolbar
        title={toolbarTitle}
        docId={workspace.docId}
        loadState={workspace.loadState}
        connectionStatus={workspace.connectionStatus}
        saveStatus={workspace.saveStatus}
        onlineCount={workspace.onlineCount}
        latestUpdatedAt={
          workspace.detail?.latestUpdatedAt
            ? formatDateTime(workspace.detail.latestUpdatedAt)
            : "等待同步"
        }
        isExportPanelOpen={workspace.isExportPanelOpen}
        leftPanelOpen={workspace.leftPanelOpen}
        rightPanelOpen={workspace.rightPanelOpen}
        editorFullscreen={workspace.editorFullscreen}
        previewFullscreen={workspace.previewFullscreen}
        helpPanelOpen={workspace.helpPanelOpen}
        mediaPanelOpen={workspace.mediaPanelOpen}
        onSave={workspace.handleSave}
        onExportClick={workspace.handleExportClick}
        onHistoryClick={handleHistoryClick}
        onToggleLeftPanel={workspace.toggleLeftPanel}
        onToggleRightPanel={workspace.toggleRightPanel}
        onToggleEditorFullscreen={workspace.toggleEditorFullscreen}
        onTogglePreviewFullscreen={workspace.togglePreviewFullscreen}
        onToggleHelpPanel={workspace.toggleHelpPanel}
        onToggleMediaPanel={workspace.toggleMediaPanel}
        onTitleUpdate={workspace.handleTitleUpdate}
      />

      <section className="workspace-layout workspace-layout--immersive">
        {/* 左侧抽屉 - 协作者和快照 */}
        <SidebarDrawer
          isOpen={workspace.leftPanelOpen}
          position="left"
          onClose={workspace.toggleLeftPanel}
          width="320px"
        >
          <DocumentSidebarLeft
            guestName={workspace.guestName}
            currentSocketId={workspace.currentSocketId}
            users={workspace.presenceUsers}
            snapshots={workspace.snapshots}
            selectedSnapshotIds={workspace.selectedSnapshotIds}
            onSnapshotToggle={workspace.handleSnapshotToggle}
          />
        </SidebarDrawer>

        {/* 右侧抽屉 - 聊天/系统消息 */}
        <SidebarDrawer
          isOpen={workspace.rightPanelOpen}
          position="right"
          onClose={workspace.toggleRightPanel}
          width="400px"
        >
          {rightDrawerContent}
        </SidebarDrawer>

        {/* 统一帮助面板（模态框） */}
        <HelpPanel
          isOpen={workspace.helpPanelOpen}
          onClose={workspace.toggleHelpPanel}
        />

        <MediaLibraryPanel
          isOpen={workspace.mediaPanelOpen}
          docId={workspace.docId}
          guestName={workspace.guestName}
          canDeleteAssets={workspace.detail?.createdByName === workspace.guestName}
          onClose={workspace.toggleMediaPanel}
          onInsert={(text) => {
            setInsertRequest({ id: Date.now(), text });
          }}
        />

        {/* 主编辑区 - 双栏沉浸式布局 */}
        <section className="workspace-main workspace-main--immersive">
          {workspace.loadState === "loading" ? (
            <div className="workspace-feedback">
              <strong>加载中</strong>
              <p>正在获取文档数据并启动协同编辑器。</p>
            </div>
          ) : null}

          {workspace.loadState === "error" ? (
            <div className="workspace-feedback workspace-feedback--error">
              <strong>加载失败</strong>
              <p>{workspace.loadError}</p>
              <Link className="primary-link" to="/">
                返回首页
              </Link>
            </div>
          ) : null}

          {workspace.detail && workspace.loadState === "ready" ? (
            <ResizableSplitPane
              leftContent={
                <div className="immersive-editor-panel">
                  <div className="immersive-panel-header">
                    <div>
                      <p className="immersive-panel__eyebrow">编辑器</p>
                      <h2>Markdown 输入</h2>
                    </div>
                    <div className="immersive-panel-actions">
                      <button
                        type="button"
                        className="immersive-action-button"
                        onClick={workspace.toggleEditorFullscreen}
                        title={workspace.editorFullscreen ? "退出全屏" : "全屏显示"}
                      >
                        {workspace.editorFullscreen ? "⊡" : "⊞"}
                      </button>
                    </div>
                  </div>

                  <div className="immersive-editor-meta">
                    <span>当前用户: {workspace.guestName}</span>
                    <span>状态: {workspace.latestActivityLabel}</span>
                  </div>

                  <CollaborativeEditor
                    className="workspace-editor workspace-editor--immersive"
                    docId={workspace.docId}
                    userName={workspace.guestName}
                    userColor={editorUserColor}
                    onConnectionStatusChange={workspace.handleEditorConnectionChange}
                    onSyncStateChange={workspace.handleEditorSyncChange}
                    onContentChange={workspace.handleEditorContentChange}
                    insertRequest={insertRequest}
                    onInsertApplied={(id) => {
                      setInsertRequest((current) => current?.id === id ? null : current);
                    }}
                  />
                </div>
              }
              rightContent={
                <div className="immersive-preview-panel">
                  <div className="immersive-panel-header">
                    <div>
                      <p className="immersive-panel__eyebrow">预览</p>
                      <h2>Markdown 预览</h2>
                    </div>
                    <div className="immersive-panel-actions">
                      <button
                        type="button"
                        className="immersive-action-button"
                        onClick={workspace.togglePreviewFullscreen}
                        title={workspace.previewFullscreen ? "退出全屏" : "全屏显示"}
                      >
                        {workspace.previewFullscreen ? "⊡" : "⊞"}
                      </button>
                    </div>
                  </div>
                  <MarkdownPreview content={workspace.editorContent} />
                </div>
              }
              splitRatio={workspace.splitRatio}
              onSplitRatioChange={workspace.handleSplitRatioChange}
              leftFullscreen={workspace.editorFullscreen}
              rightFullscreen={workspace.previewFullscreen}
            />
          ) : null}

          {/* 导出面板和历史面板保持原位 */}
          <ExportPanel
            isOpen={workspace.isExportPanelOpen}
            exportingFormat={workspace.exportingFormat}
            exportError={workspace.exportError}
            currentTitle={workspace.detail?.title ?? ""}
            onExport={workspace.handleExportDownload}
          />

          <DocumentHistoryPanel
            snapshots={workspace.snapshots}
            selectedSnapshotIds={workspace.selectedSnapshotIds}
            snapshotDetail={workspace.snapshotDetail}
            snapshotDetailState={workspace.snapshotDetailState}
            snapshotDetailError={workspace.snapshotDetailError}
            diffResult={workspace.diffResult}
            diffState={workspace.diffState}
            diffError={workspace.diffError}
            onClearSelection={workspace.handleClearSnapshotSelection}
          />
        </section>
      </section>
    </main>
  );
}
