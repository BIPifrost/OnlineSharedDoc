import { createPortal } from "react-dom";
import { formatDateTime } from "./status";
import type { WorkspaceAsyncState } from "./types";
import type {
  DocumentSnapshotDetail,
  ImportSnapshotSummary
} from "../../api";

type ImportSnapshotModalProps = {
  isOpen: boolean;
  listState: WorkspaceAsyncState;
  listError: string;
  snapshots: ImportSnapshotSummary[];
  selectedSnapshotId: number | null;
  selectedSnapshotDetail: DocumentSnapshotDetail | null;
  detailState: WorkspaceAsyncState;
  detailError: string;
  isConfirmingOverwrite: boolean;
  onClose: () => void;
  onSelectSnapshot: (snapshotId: number) => void;
  onRequestImport: () => void;
  onConfirmImport: () => void;
  onCancelConfirm: () => void;
};

export function ImportSnapshotModal({
  isOpen,
  listState,
  listError,
  snapshots,
  selectedSnapshotId,
  selectedSnapshotDetail,
  detailState,
  detailError,
  isConfirmingOverwrite,
  onClose,
  onSelectSnapshot,
  onRequestImport,
  onConfirmImport,
  onCancelConfirm
}: ImportSnapshotModalProps) {
  if (!isOpen) {
    return null;
  }

  return createPortal((
    <div
      className="import-modal-overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="导入数据库保存文本"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="import-modal__header">
          <div>
            <p className="import-modal__eyebrow">导入保存文本</p>
            <h2>从数据库快照恢复内容</h2>
            <p className="import-modal__intro">
              选择数据库里任意一份已保存快照，预览后导入当前编辑区。
            </p>
          </div>
          <button
            type="button"
            className="import-modal__close"
            onClick={onClose}
            aria-label="关闭导入窗口"
          >
            ×
          </button>
        </header>

        <div className="import-modal__body">
          <section className="import-modal__list-panel">
            <div className="import-modal__section-title">
              <strong>保存记录</strong>
              <span>{snapshots.length} 条</span>
            </div>

            {listState === "loading" ? (
              <p className="import-modal__placeholder">正在加载保存记录...</p>
            ) : null}

            {listState === "error" ? (
              <p className="import-modal__error">{listError}</p>
            ) : null}

            {listState === "ready" && snapshots.length === 0 ? (
              <p className="import-modal__placeholder">
                数据库里还没有可导入的保存记录
              </p>
            ) : null}

            {listState === "ready" && snapshots.length > 0 ? (
              <div className="import-modal__list">
                {snapshots.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    type="button"
                    className={`import-modal__item${
                      selectedSnapshotId === snapshot.id
                        ? " import-modal__item--active"
                        : ""
                    }`}
                    onClick={() => onSelectSnapshot(snapshot.id)}
                  >
                    <div className="import-modal__item-topline">
                      <strong>{snapshot.title}</strong>
                      <span>v{snapshot.snapshotVersion}</span>
                    </div>
                    <div className="import-modal__item-meta">
                      <span>{snapshot.docId}</span>
                      <span>{snapshot.savedByName}</span>
                    </div>
                    <div className="import-modal__item-meta">
                      <span>{formatDateTime(snapshot.savedAt)}</span>
                    </div>
                    <p>{snapshot.contentPreview || "该快照内容为空。"}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="import-modal__preview-panel">
            <div className="import-modal__section-title">
              <strong>内容预览</strong>
              {selectedSnapshotDetail ? (
                <span>{selectedSnapshotDetail.docId}</span>
              ) : null}
            </div>

            {detailState === "idle" ? (
              <p className="import-modal__placeholder">
                选择左侧一条保存记录，查看完整内容预览。
              </p>
            ) : null}

            {detailState === "loading" ? (
              <p className="import-modal__placeholder">正在加载快照内容...</p>
            ) : null}

            {detailState === "error" ? (
              <p className="import-modal__error">{detailError}</p>
            ) : null}

            {detailState === "ready" && selectedSnapshotDetail ? (
              <div className="import-modal__preview-card">
                <div className="import-modal__preview-meta">
                  <div>
                    <strong>{selectedSnapshotDetail.title}</strong>
                    <span>
                      版本 v{selectedSnapshotDetail.snapshotVersion}
                    </span>
                  </div>
                  <div>
                    <span>保存人 {selectedSnapshotDetail.savedByName}</span>
                    <span>{formatDateTime(selectedSnapshotDetail.savedAt)}</span>
                  </div>
                </div>
                <pre className="import-modal__content">
                  {selectedSnapshotDetail.content}
                </pre>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="import-modal__footer">
          {isConfirmingOverwrite ? (
            <div className="import-modal__confirm">
              <p>当前编辑区存在未保存内容，确认覆盖并导入这份快照吗？</p>
              <div className="import-modal__confirm-actions">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={onCancelConfirm}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="toolbar-button toolbar-button--primary"
                  onClick={onConfirmImport}
                >
                  确认覆盖导入
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="toolbar-button"
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                className="toolbar-button toolbar-button--primary"
                onClick={onRequestImport}
                disabled={
                  detailState !== "ready" || selectedSnapshotDetail === null
                }
              >
                导入到编辑区
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  ), document.body);
}
