import { useEffect } from "react";
import { createPortal } from "react-dom";
import type {
  DocumentDiffResult,
  DocumentSnapshotDetail,
  DocumentSnapshotSummary
} from "../../api";
import { formatDateTime } from "../document-workspace/status";
import type { WorkspaceAsyncState } from "../document-workspace/types";

type DocumentHistoryPanelProps = {
  isOpen: boolean;
  snapshots: DocumentSnapshotSummary[];
  selectedSnapshotIds: number[];
  snapshotDetail: DocumentSnapshotDetail | null;
  snapshotDetailState: WorkspaceAsyncState;
  snapshotDetailError: string;
  diffResult: DocumentDiffResult | null;
  diffState: WorkspaceAsyncState;
  diffError: string;
  onClearSelection: () => void;
  onClose: () => void;
};

function getSnapshotLabel(
  snapshots: DocumentSnapshotSummary[],
  snapshotId: number
) {
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  return snapshot ? `v${snapshot.snapshotVersion}` : `#${snapshotId}`;
}

export function DocumentHistoryPanel({
  isOpen,
  snapshots,
  selectedSnapshotIds,
  snapshotDetail,
  snapshotDetailState,
  snapshotDetailError,
  diffResult,
  diffState,
  diffError,
  onClearSelection,
  onClose
}: DocumentHistoryPanelProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const selectedLabels = selectedSnapshotIds.map((snapshotId) =>
    getSnapshotLabel(snapshots, snapshotId)
  );

  return createPortal((
    <div className="workspace-modal-overlay" role="presentation" onMouseDown={onClose}>
    <section
      className="workspace-modal workspace-modal--history workspace-panel workspace-panel--history-detail"
      role="dialog"
      aria-modal="true"
      aria-label="历史快照与差异"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="workspace-panel__header workspace-modal__header">
        <div>
          <p className="workspace-panel__eyebrow">版本比较</p>
          <h2>快照详情与差异</h2>
        </div>
        <div className="workspace-modal__header-actions">
          <span className="workspace-panel__meta">
            已选择 {selectedSnapshotIds.length} / 2
          </span>
          <button type="button" className="workspace-modal__close" onClick={onClose} aria-label="关闭历史窗口">
            ×
          </button>
        </div>
      </div>

      <div className="workspace-modal__content">
      <div className="history-selection-bar">
        <div className="history-selection-bar__chips">
          {selectedLabels.length > 0 ? (
            selectedLabels.map((label) => (
              <span key={label} className="history-chip">
                {label}
              </span>
            ))
          ) : (
            <span className="history-selection-bar__hint">
              选择一个快照查看详情，或选择两个快照进行差异对比。
            </span>
          )}
        </div>
        {selectedSnapshotIds.length > 0 ? (
          <button
            type="button"
            className="toolbar-button"
            onClick={onClearSelection}
          >
            清除选择
          </button>
        ) : null}
      </div>

      {selectedSnapshotIds.length === 0 ? (
        <div className="workspace-empty">
          <strong>历史面板已就绪</strong>
          <p>保存文档以创建快照，然后可以查看一个或比较两个快照。</p>
        </div>
      ) : null}

      {selectedSnapshotIds.length === 1 ? (
        <>
          {snapshotDetailState === "loading" ? (
            <div className="workspace-feedback">
              <strong>正在加载快照详情</strong>
              <p>正在获取选定的快照内容。</p>
            </div>
          ) : null}

          {snapshotDetailState === "error" ? (
            <div className="workspace-feedback workspace-feedback--error">
              <strong>快照详情加载失败</strong>
              <p>{snapshotDetailError}</p>
            </div>
          ) : null}

          {snapshotDetailState === "ready" && snapshotDetail ? (
            <div className="history-detail-card">
              <header className="history-detail-card__header">
                <div>
                  <strong>v{snapshotDetail.snapshotVersion}</strong>
                  <span>{snapshotDetail.title}</span>
                </div>
                <div className="history-detail-card__meta">
                  <span>保存者: {snapshotDetail.savedByName}</span>
                  <time dateTime={snapshotDetail.savedAt}>
                    {formatDateTime(snapshotDetail.savedAt)}
                  </time>
                </div>
              </header>
              <pre className="history-detail-card__content">
                {snapshotDetail.content}
              </pre>
            </div>
          ) : null}
        </>
      ) : null}

      {selectedSnapshotIds.length === 2 ? (
        <>
          {diffState === "loading" ? (
            <div className="workspace-feedback">
              <strong>正在加载版本差异</strong>
              <p>正在比较选定的两个快照。</p>
            </div>
          ) : null}

          {diffState === "error" ? (
            <div className="workspace-feedback workspace-feedback--error">
              <strong>版本差异加载失败</strong>
              <p>{diffError}</p>
            </div>
          ) : null}

          {diffState === "ready" && diffResult ? (
            <div className="diff-viewer">
              <div className="diff-viewer__summary">
                <strong>
                  v{diffResult.fromSnapshot.snapshotVersion} 与 v
                  {diffResult.toSnapshot.snapshotVersion} 对比
                </strong>
                <p>{diffResult.diffTextSummary}</p>
              </div>
              <iframe
                title="快照差异预览"
                className="diff-viewer__frame"
                sandbox=""
                srcDoc={diffResult.diffHtml}
              />
            </div>
          ) : null}
        </>
      ) : null}
      </div>
    </section>
    </div>
  ), document.body);
}
