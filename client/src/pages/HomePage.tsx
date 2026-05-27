import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const navLinks = ["产品", "解决方案", "开发者"] as const;

const footerLinks = ["隐私政策", "服务条款", "GitHub", "联系我们"] as const;

const REPOSITORY_URL = "https://github.com/BIPifrost/Online-Shared-Doc.git";

const navPopoverContent = {
  产品:
    "在线共享文档工作区是一款面向轻量文档共创场景的实时协同编辑产品。用户无需注册登录，只需输入昵称即可快速创建或加入文档，在同一页面内完成多人编辑、实时预览、版本保存、差异对比与内容导出。",
  解决方案:
    "通过匿名快速进入降低使用成本，借助实时协同编辑保证多人内容同步，通过快照保存和版本 diff 支持过程留痕与回溯，同时提供导出能力，方便文档沉淀、分享和后续使用。"
} as const;

const developers = [
  {
    name: "BIPifrost",
    avatar: "https://github.com/BIPifrost.png"
  },
  {
    name: "wwwaker",
    avatar: "https://github.com/wwwaker.png"
  },
  {
    name: "wolt59",
    avatar: "https://github.com/wolt59.png"
  },
  {
    name: "guiyijuanyou",
    avatar: "https://github.com/guiyijuanyou.png"
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
    <div className="home-page">
      <header className="home-topbar">
        <div className="home-topbar__inner">
          <div className="home-topbar__brand-group">
            <a className="home-topbar__brand" href="/">
              {HOME_PAGE_TITLE}
            </a>

            <nav className="home-topbar__nav" aria-label="首页导航">
              {navLinks.map((link) => (
                <div key={link} className="home-topbar__nav-item">
                  <a href="#" className="home-topbar__nav-link">
                    {link}
                  </a>

                  {link === "开发者" ? (
                    <div className="home-popover home-popover--developers" role="presentation">
                      <div className="home-popover__developer-list">
                        {developers.map((developer) => (
                          <div
                            key={developer.name}
                            className="home-popover__developer-item"
                          >
                            <img
                              className="home-popover__developer-avatar"
                              src={developer.avatar}
                              alt={`${developer.name} GitHub avatar`}
                            />
                            <span>{developer.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="home-popover" role="presentation">
                      <p>{navPopoverContent[link]}</p>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>

          <a
            className="home-topbar__cta"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            立即加入
          </a>
        </div>
      </header>

      <main className="home-shell">
        <section className="home-hero">
          <div className="home-hero__copy">
            <h1>{HOME_PAGE_TITLE}</h1>
            <p>
              这是多人共享文档实验系统的统一入口页。输入昵称后，你可以创建新的协作文档，
              也可以凭已有文档编号直接加入同一份文档。
            </p>
          </div>
        </section>

        <section className="home-prismatic home-surface-hover" aria-hidden="true">
          <div className="home-prismatic__halo home-prismatic__halo--left" />
          <div className="home-prismatic__halo home-prismatic__halo--center" />
          <div className="home-prismatic__halo home-prismatic__halo--right" />
          <div className="home-prismatic__copy">
            <h2>免除登录，立即进入</h2>
            <p>提供方便快捷的共享文档方案</p>
          </div>
        </section>

        <section className="home-entry-grid" id="home-entry-cards">
          <article className="home-entry-card home-surface-hover">
            <h2>创建文档</h2>

            <label className="field field--minimal">
              <span className="field__label">你的昵称</span>
              <input
                value={guestName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setGuestName(nextName);
                  persistGuestName(nextName);
                }}
                placeholder="输入昵称"
              />
            </label>

            <label className="field field--minimal">
              <span className="field__label">文档名称 (可选)</span>
              <input
                value={docTitle}
                onChange={(event) => {
                  setDocTitle(event.target.value);
                }}
                placeholder="例如：项目需求文档"
              />
            </label>

            <button
              type="button"
              className="home-entry-card__button home-entry-card__button--primary"
              onClick={handleCreate}
              disabled={isCreating || isJoining}
            >
              {isCreating ? "正在创建..." : "创建文档"}
            </button>
          </article>

          <article className="home-entry-card home-surface-hover">
            <h2>加入文档</h2>

            <label className="field field--minimal">
              <span className="field__label">文档 ID</span>
              <input
                value={docIdInput}
                onChange={(event) => {
                  setDocIdInput(event.target.value);
                }}
                placeholder="输入已有文档 ID"
              />
            </label>

            <div className="home-entry-card__spacer" />

            <button
              type="button"
              className="home-entry-card__button home-entry-card__button--secondary"
              onClick={handleJoin}
              disabled={isCreating || isJoining}
            >
              {isJoining ? "正在验证..." : "加入文档"}
            </button>
          </article>
        </section>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <section className="home-notes">
          <div className="home-notes__header">
            <span className="home-notes__eyebrow">工作原理</span>
            <h2>首页负责完成匿名进入闭环</h2>
          </div>

          <div className="home-notes__grid">
            {featureNotes.map((note) => (
              <article key={note.title} className="note-card home-surface-hover">
                <h3>{note.title}</h3>
                <p>{note.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__brand">
            © 2026 在线共享文档工作区. Built for speed.
          </div>

          <nav className="home-footer__nav" aria-label="页脚链接">
            {footerLinks.map((link) => (
              link === "联系我们" ? (
                <div key={link} className="home-footer__item">
                  <a href="#" className="home-footer__link">
                    {link}
                  </a>
                  <div className="home-popover home-popover--contact" role="presentation">
                    <p>📞: 15111357285</p>
                    <p>🏠: Central South University</p>
                  </div>
                </div>
              ) : (
                <a
                  key={link}
                  href={link === "GitHub" ? REPOSITORY_URL : "#"}
                  className="home-footer__link"
                  target={link === "GitHub" ? "_blank" : undefined}
                  rel={link === "GitHub" ? "noreferrer" : undefined}
                >
                  {link}
                </a>
              )
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
