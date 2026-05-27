import { useState, useEffect, useCallback } from "react";

type HelpPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ShortcutItem = {
  keys: string[];
  description: string;
};

type MarkdownGuideSection = {
  title: string;
  items: Array<{ syntax: string; description: string }>;
};

const SHORTCUTS: ShortcutItem[] = [
  { keys: ["Ctrl", "S"], description: "保存文档" },
  { keys: ["Ctrl", "/"], description: "显示/隐藏帮助面板" },
  { keys: ["Ctrl", "M"], description: "切换 Markdown 预览" },
  { keys: ["Ctrl", "B"], description: "切换左侧边栏" },
  { keys: ["Ctrl", "P"], description: "切换右侧面板" },
  { keys: ["Ctrl", "E"], description: "切换导出面板" },
  { keys: ["F11"], description: "编辑器全屏切换" },
  { keys: ["Ctrl", "F11"], description: "预览区全屏切换" },
];

const MARKDOWN_GUIDE: MarkdownGuideSection[] = [
  {
    title: "标题",
    items: [
      { syntax: "# 一级标题", description: "最大标题" },
      { syntax: "## 二级标题", description: "次级标题" },
      { syntax: "### 三级标题", description: "小标题" },
    ],
  },
  {
    title: "文本样式",
    items: [
      { syntax: "**粗体文本**", description: "加粗文字" },
      { syntax: "*斜体文本*", description: "倾斜文字" },
      { syntax: "***粗斜体***", description: "粗体加斜体" },
      { syntax: "~~删除线~~", description: "删除线文字" },
    ],
  },
  {
    title: "列表",
    items: [
      { syntax: "- 无序项", description: "无序列表项" },
      { syntax: "1. 有序项", description: "有序列表项" },
      { syntax: "  - 嵌套项", description: "嵌套列表（缩进）" },
    ],
  },
  {
    title: "代码",
    items: [
      { syntax: "`行内代码`", description: "单行代码" },
      {
        syntax: "```js\n代码块\n```",
        description: "多行代码块",
      },
    ],
  },
  {
    title: "链接与图片",
    items: [
      { syntax: "[链接文字](URL)", description: "超链接" },
      { syntax: "![描述](图片URL)", description: "插入图片" },
    ],
  },
  {
    title: "引用",
    items: [
      { syntax: "> 引用文本", description: "引用块" },
      { syntax: ">> 嵌套引用", description: "嵌套引用" },
    ],
  },
  {
    title: "表格",
    items: [
      {
        syntax: "| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |",
        description: "Markdown 表格",
      },
    ],
  },
  {
    title: "其他",
    items: [
      { syntax: "---", description: "水平分割线" },
      { syntax: "[ ] 未完成任务", description: "任务列表" },
      { syntax: "[x] 已完成任务", description: "已完成任务" },
    ],
  },
];

type TabType = "shortcuts" | "markdown";

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("shortcuts");

  const handleEscKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [handleEscKey]);

  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  function formatKey(key: string): string {
    if (isMac && key === "Ctrl") return "\u2318";
    return key;
  }

  return (
    <div className="help-panel-overlay" onClick={onClose}>
      <div
        className="help-panel-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-panel-header">
          <h2 className="help-panel-title">帮助文档</h2>
          <button
            className="help-panel-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="help-panel-tabs">
          <button
            className={`help-panel-tab${activeTab === "shortcuts" ? " help-panel-tab--active" : ""}`}
            onClick={() => setActiveTab("shortcuts")}
          >
            快捷键
          </button>
          <button
            className={`help-panel-tab${activeTab === "markdown" ? " help-panel-tab--active" : ""}`}
            onClick={() => setActiveTab("markdown")}
          >
            Markdown 语法
          </button>
        </div>

        <div className="help-panel-content">
          {activeTab === "shortcuts" && (
            <div className="help-panel-shortcuts">
              <p className="help-panel-platform">
                当前系统: {isMac ? "macOS" : "Windows / Linux"}
              </p>
              <div className="help-shortcut-list">
                {SHORTCUTS.map((shortcut, index) => (
                  <div key={index} className="help-shortcut-item">
                    <div className="help-shortcut-keys">
                      {shortcut.keys.map((key, i) => (
                        <kbd key={i} className="help-shortcut-key">
                          {formatKey(key)}
                        </kbd>
                      ))}
                    </div>
                    <span className="help-shortcut-description">
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "markdown" && (
            <div className="help-panel-markdown">
              {MARKDOWN_GUIDE.map((section, index) => (
                <section key={index} className="help-markdown-section">
                  <h4 className="help-markdown-section-title">
                    {section.title}
                  </h4>
                  <div className="help-markdown-items">
                    {section.items.map((item, i) => (
                      <div key={i} className="help-markdown-item">
                        <code className="help-markdown-syntax">
                          {item.syntax}
                        </code>
                        <span className="help-markdown-description">
                          {item.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
