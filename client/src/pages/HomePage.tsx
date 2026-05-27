import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createDocument, getDocumentDetail } from "../api";
import {
  buildDocumentUrl,
  GUEST_NAME_STORAGE_KEY,
  getReadableErrorMessage,
  getPreferredGuestName,
  HOME_PAGE_TITLE,
  validateDocIdInput,
  validateGuestName
} from "../features/auth-guest/home-flow";

const featureNotes = [
  {
    title: "匿名昵称进入",
    description: "不用注册登录，输入昵称后即可创建文档或凭文档编号加入。"
  },
  {
    title: "链接即入口",
    description: "文档页地址会携带昵称参数，方便课堂演示时直接分享。"
  },
  {
    title: "本地记忆昵称",
    description: "刷新首页后会恢复上一次使用的昵称，减少重复输入。"
  }
] as const;

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [guestName, setGuestName] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docIdInput, setDocIdInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const storedName =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(GUEST_NAME_STORAGE_KEY);
    const preferredName = getPreferredGuestName({
      queryName: searchParams.get("name"),
      storedName
    });

    setGuestName(preferredName);

    if (typeof window !== "undefined" && preferredName) {
      window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, preferredName);
    }
  }, [searchParams]);

  function persistGuestName(nextName: string) {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedName = nextName.trim();
    if (normalizedName) {
      window.localStorage.setItem(GUEST_NAME_STORAGE_KEY, normalizedName);
      return;
    }

    window.localStorage.removeItem(GUEST_NAME_STORAGE_KEY);
  }

  async function handleCreate() {
    try {
      const normalizedName = validateGuestName(guestName);
      setErrorMessage("");
      setIsCreating(true);

      const document = await createDocument(normalizedName, docTitle || undefined);
      navigate(buildDocumentUrl(document.id, normalizedName));
    } catch (error) {
      setErrorMessage(
        getReadableErrorMessage(error, "创建文档失败，请稍后再试。")
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoin() {
    try {
      const normalizedName = validateGuestName(guestName);
      const normalizedDocId = validateDocIdInput(docIdInput);

      setErrorMessage("");
      setIsJoining(true);

      await getDocumentDetail(normalizedDocId);
      navigate(buildDocumentUrl(normalizedDocId, normalizedName));
    } catch (error) {
      setErrorMessage(
        getReadableErrorMessage(error, "加入文档失败，请检查文档 ID。")
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="home-shell">
      <nav className="home-nav">
        <Link to="/documents" className="nav-link">
          📄 查看所有文档
        </Link>
      </nav>

      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="home-kicker">匿名协作文档入口</span>
          <h1>{HOME_PAGE_TITLE}</h1>
          <p>
            这是多人共享文档实验系统的统一入口页。输入昵称后，你可以创建新的协作文档，
            也可以凭已有文档编号直接加入同一份文档。
          </p>
        </div>

        <div className="home-hero__panel">
          <label className="field">
            <span className="field__label">你的昵称</span>
            <input
              value={guestName}
              onChange={(event) => {
                const nextName = event.target.value;
                setGuestName(nextName);
                persistGuestName(nextName);
              }}
              placeholder="例如：张三"
            />
          </label>

          <label className="field">
            <span className="field__label">文档名称（可选）</span>
            <input
              value={docTitle}
              onChange={(event) => {
                setDocTitle(event.target.value);
              }}
              placeholder="例如：项目需求文档"
            />
          </label>

          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={handleCreate}
              disabled={isCreating || isJoining}
            >
              {isCreating ? "正在创建..." : "创建文档"}
            </button>
          </div>

          <div className="divider">
            <span>或使用文档编号加入</span>
          </div>

          <label className="field">
            <span className="field__label">文档 ID</span>
            <input
              value={docIdInput}
              onChange={(event) => {
                setDocIdInput(event.target.value);
              }}
              placeholder="输入已有文档 ID"
            />
          </label>

          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={handleJoin}
              disabled={isCreating || isJoining}
            >
              {isJoining ? "正在验证..." : "加入文档"}
            </button>
          </div>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </div>
      </section>

      <section className="home-notes">
        <div className="home-notes__header">
          <span className="home-kicker">工作原理</span>
          <h2>首页负责完成匿名进入闭环</h2>
        </div>

        <div className="home-notes__grid">
          {featureNotes.map((note) => (
            <article key={note.title} className="note-card">
              <h3>{note.title}</h3>
              <p>{note.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
