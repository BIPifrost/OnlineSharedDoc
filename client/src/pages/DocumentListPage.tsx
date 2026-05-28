import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteDocument, getAllDocuments } from "../api";
import type { DocumentSummary } from "../api/documents";

export function DocumentListPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");
      const docs = await getAllDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文档列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (deletingDocId) {
      return;
    }

    const confirmed = window.confirm("确定要删除此文档吗？此操作不可撤销。");
    if (!confirmed) {
      return;
    }

    setDeletingDocId(docId);

    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除文档失败，请重试。");
    } finally {
      setDeletingDocId(null);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return (
    <main className="document-list-page">
      <div className="document-list-header">
        <Link to="/" className="back-link">
          ← 返回首页
        </Link>
        <h1>所有文档</h1>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="refresh-button"
        >
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadDocuments}>重试</button>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="empty-state">
          <p>暂无文档</p>
          <Link to="/" className="create-link">
            创建第一个文档
          </Link>
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="document-list">
          {documents.map((doc) => (
            <article key={doc.id} className="document-card">
              <Link to={`/doc/${doc.id}`} className="document-card-link">
                <h2 className="document-title">{doc.title}</h2>
                <div className="document-meta">
                  <span className="document-author">
                    创建者: {doc.createdByName}
                  </span>
                  {doc.createdAt ? (
                    <span className="document-date">
                      {formatDate(doc.createdAt)}
                    </span>
                  ) : null}
                </div>
              </Link>
              <button
                type="button"
                className="document-delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc.id);
                }}
                disabled={deletingDocId === doc.id}
                title="删除此文档"
              >
                {deletingDocId === doc.id ? "删除中..." : "删除"}
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
