import { useEffect, useState, type ChangeEvent } from "react";
import {
  getMediaAssets,
  uploadMediaAsset,
  type MediaAsset
} from "../../api";

type MediaLibraryPanelProps = {
  isOpen: boolean;
  guestName: string;
  onClose: () => void;
  onInsert: (snippet: string) => void;
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function escapeLabel(value: string) {
  return value.replace(/[\[\]]/g, "");
}

function buildMediaSnippet(asset: MediaAsset) {
  const label = escapeLabel(asset.originalName);
  return asset.mediaType === "image"
    ? `![${label}](${asset.url})`
    : `!video[${label}](${asset.url})`;
}

export function MediaLibraryPanel({
  isOpen,
  guestName,
  onClose,
  onInsert
}: MediaLibraryPanelProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsLoading(true);
    setError("");
    void getMediaAssets()
      .then(setAssets)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "资源库加载失败。");
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setIsUploading(true);
    setError("");
    try {
      const asset = await uploadMediaAsset(file, guestName);
      setAssets((previous) => [asset, ...previous]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "媒体上传失败。");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="media-library-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="media-library-modal"
        role="dialog"
        aria-modal="true"
        aria-label="公共资源库"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="media-library-header">
          <div>
            <h2>公共资源库</h2>
            <p>上传图片或视频，并将它们插入到协作文档中。</p>
          </div>
          <button type="button" className="media-library-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="media-library-actions">
          <label className={`media-upload-button${isUploading ? " media-upload-button--busy" : ""}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {isUploading ? "上传中..." : "上传图片或视频"}
          </label>
          <span>资源对所有参与编辑的用户可见，单文件不超过 100 MB。</span>
        </div>

        {error ? <p className="media-library-error">{error}</p> : null}

        <div className="media-library-content">
          {isLoading ? <p className="media-library-empty">正在加载资源...</p> : null}
          {!isLoading && assets.length === 0 ? (
            <p className="media-library-empty">资源库为空，上传第一张图片或第一个视频。</p>
          ) : null}
          {assets.map((asset) => (
            <article key={asset.id} className="media-card">
              <div className="media-card__preview">
                {asset.mediaType === "image" ? (
                  <img src={asset.url} alt={asset.originalName} loading="lazy" />
                ) : (
                  <video src={asset.url} controls preload="metadata" />
                )}
              </div>
              <div className="media-card__details">
                <strong title={asset.originalName}>{asset.originalName}</strong>
                <span>
                  {asset.mediaType === "image" ? "图片" : "视频"} · {formatFileSize(asset.sizeBytes)}
                </span>
                <span>上传者: {asset.uploadedByName}</span>
              </div>
              <button
                type="button"
                className="toolbar-button toolbar-button--primary"
                onClick={() => {
                  onInsert(buildMediaSnippet(asset));
                  onClose();
                }}
              >
                插入文档
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
