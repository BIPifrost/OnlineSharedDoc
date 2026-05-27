import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { ExportFormat } from "../../api";

type ExportPanelProps = {
  isOpen: boolean;
  exportingFormat: ExportFormat | null;
  exportError: string;
  currentTitle: string;
  onExport: (format: ExportFormat, exportFileName?: string) => void;
  onClose: () => void;
};

const EXPORT_OPTIONS: Array<{
  format: ExportFormat;
  title: string;
  description: string;
}> = [
  {
    format: "markdown",
    title: "导出 Markdown",
    description: "下载最新的 Markdown 源代码为 .md 文件。"
  },
  {
    format: "html",
    title: "导出 HTML",
    description: "将最新内容渲染为基本 HTML 文档。"
  },
  {
    format: "txt",
    title: "导出 TXT",
    description: "下载最新内容为纯文本。"
  },
  {
    format: "media-zip",
    title: "导出媒体压缩包",
    description: "下载 Markdown 文档及其引用的图片和视频，解压后可通过相对路径预览媒体。"
  }
];

export function ExportPanel({
  isOpen,
  exportingFormat,
  exportError,
  currentTitle,
  onExport,
  onClose
}: ExportPanelProps) {
  const [exportFileName, setExportFileName] = useState(currentTitle);

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

  function handleSubmit(format: ExportFormat, event?: FormEvent) {
    event?.preventDefault();
    onExport(format, exportFileName.trim() || undefined);
  }

  return createPortal((
    <div className="workspace-modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="workspace-modal workspace-modal--export workspace-panel workspace-panel--export"
        id="document-export-panel"
        role="dialog"
        aria-modal="true"
        aria-label="导出文档"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="workspace-panel__header workspace-modal__header">
          <div>
            <p className="workspace-panel__eyebrow">导出</p>
            <h2>导出面板</h2>
          </div>
          <div className="workspace-modal__header-actions">
            <span className="workspace-panel__meta">4 种格式</span>
            <button type="button" className="workspace-modal__close" onClick={onClose} aria-label="关闭导出窗口">
              ×
            </button>
          </div>
        </div>

        <div className="workspace-modal__content">
          <label className="field">
            <span className="field__label">导出文件名（可选）</span>
            <input
              value={exportFileName}
              onChange={(event) => setExportFileName(event.target.value)}
              placeholder="留空则使用文档标题"
            />
          </label>

          <div className="export-option-list">
            {EXPORT_OPTIONS.map((option) => {
              const isExporting = exportingFormat === option.format;

              return (
                <article key={option.format} className="export-option-card">
                  <div className="export-option-card__copy">
                    <strong>{option.title}</strong>
                    <p>{option.description}</p>
                  </div>
                  <button
                    type="button"
                    className="toolbar-button toolbar-button--primary"
                    disabled={Boolean(exportingFormat)}
                    onClick={(event) => handleSubmit(option.format, event)}
                  >
                    {isExporting ? "导出中..." : "开始导出"}
                  </button>
                </article>
              );
            })}
          </div>

          {exportError ? (
            <div className="workspace-feedback workspace-feedback--error">
              <strong>导出失败</strong>
              <p>{exportError}</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  ), document.body);
}
