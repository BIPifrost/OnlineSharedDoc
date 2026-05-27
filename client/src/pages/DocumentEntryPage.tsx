import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CollaborativeEditor } from "../features/document-editor";
import { DocumentHistoryPanel } from "../features/document-history";
import { DocumentSidebarLeft } from "../features/document-workspace/DocumentSidebarLeft";
import { DocumentSidebarRight } from "../features/document-workspace/DocumentSidebarRight";
import { DocumentToolbar } from "../features/document-workspace/DocumentToolbar";
import { HelpPanel } from "../features/document-workspace/HelpPanel";
import { ImportSnapshotModal } from "../features/document-workspace/ImportSnapshotModal";
import { MarkdownPreview } from "../features/document-workspace/MarkdownPreview";
import { MediaLibraryPanel } from "../features/document-workspace/MediaLibraryPanel";
import { ResizableSplitPane } from "../features/document-workspace/ResizableSplitPane";
import { SidebarDrawer } from "../features/document-workspace/SidebarDrawer";
import { formatDateTime } from "../features/document-workspace/status";
import { useDocumentWorkspace } from "../features/document-workspace/useDocumentWorkspace";
import { ExportPanel } from "../features/export-panel";

const FALLBACK_EDITOR_COLOR = "#0ea5e9";

export function DocumentEntryPage() {
  const { docId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const workspace = useDocumentWorkspace(docId, searchParams.get("name"));
  const [insertRequest, setInsertRequest] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

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
    (workspace.loadState === "loading" ? "正在加载文档..." : "文档工作区");

  function handleHistoryClick() {
    setIsHistoryPanelOpen((previous) => !previous);
  }

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    const currentWorkspace = workspaceRef.current;

    if (modKey && event.key === "s") {
      event.preventDefault();
      currentWorkspace.handleSave();
      return;
    }

    if (modKey && event.key === "/") {
      event.preventDefault();
      currentWorkspace.toggleHelpPanel();
      return;
    }

    if (modKey && event.key === "b") {
      event.preventDefault();
      currentWorkspace.toggleLeftPanel();
      return;
    }

    if (modKey && event.key === "p") {
      event.preventDefault();
      currentWorkspace.toggleRightPanel();
      return;
    }

    if (modKey && event.key === "e") {
      event.preventDefault();
      currentWorkspace.handleExportClick();
      return;
    }

    if (event.key === "F11" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      currentWorkspace.toggleEditorFullscreen();
      return;
    }

    if (modKey && event.key === "F11") {
      event.preventDefault();
      currentWorkspace.togglePreviewFullscreen();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

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
        hasUnreadMessages={workspace.hasUnreadMessages}
        editorFullscreen={workspace.editorFullscreen}
        previewFullscreen={workspace.previewFullscreen}
        helpPanelOpen={workspace.helpPanelOpen}
        mediaPanelOpen={workspace.mediaPanelOpen}
        onSave={workspace.handleSave}
        onExportClick={workspace.handleExportClick}
        onImportClick={workspace.openImportModal}
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

        <SidebarDrawer
          isOpen={workspace.rightPanelOpen}
          position="right"
          onClose={workspace.toggleRightPanel}
          width="400px"
        >
          {rightDrawerContent}
        </SidebarDrawer>

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

        <ImportSnapshotModal
          isOpen={workspace.isImportModalOpen}
          listState={workspace.importListState}
          listError={workspace.importListError}
          snapshots={workspace.importSnapshots}
          selectedSnapshotId={workspace.selectedImportSnapshotId}
          selectedSnapshotDetail={workspace.selectedImportSnapshotDetail}
          detailState={workspace.importDetailState}
          detailError={workspace.importDetailError}
          isConfirmingOverwrite={workspace.isImportConfirmOpen}
          onClose={workspace.closeImportModal}
          onSelectSnapshot={workspace.selectImportSnapshot}
          onRequestImport={workspace.requestImportSnapshot}
          onConfirmImport={workspace.confirmImportSnapshot}
          onCancelConfirm={workspace.cancelImportConfirmation}
        />

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
                        {workspace.editorFullscreen ? "◱" : "◰"}
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
                      setInsertRequest((current) =>
                        current?.id === id ? null : current
                      );
                    }}
                    replaceRequest={workspace.replaceRequest}
                    onReplaceApplied={workspace.handleReplaceApplied}
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
                        {workspace.previewFullscreen ? "◱" : "◰"}
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

          <ExportPanel
            isOpen={workspace.isExportPanelOpen}
            exportingFormat={workspace.exportingFormat}
            exportError={workspace.exportError}
            currentTitle={workspace.detail?.title ?? ""}
            onExport={workspace.handleExportDownload}
            onClose={workspace.handleExportClick}
          />

          <DocumentHistoryPanel
            isOpen={isHistoryPanelOpen}
            snapshots={workspace.snapshots}
            selectedSnapshotIds={workspace.selectedSnapshotIds}
            snapshotDetail={workspace.snapshotDetail}
            snapshotDetailState={workspace.snapshotDetailState}
            snapshotDetailError={workspace.snapshotDetailError}
            diffResult={workspace.diffResult}
            diffState={workspace.diffState}
            diffError={workspace.diffError}
            onClearSelection={workspace.handleClearSnapshotSelection}
            onClose={() => setIsHistoryPanelOpen(false)}
          />
        </section>
      </section>
    </main>
  );
}
