type MarkdownHelpPanelProps = {
  onClose: () => void;
};

const MARKDOWN_GUIDE = [
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
        syntax: "```js\\n代码块\\n```",
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
        syntax: "| 列1 | 列2 |\\n| --- | --- |\\n| 内容 | 内容 |",
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

export function MarkdownHelpPanel({ onClose }: MarkdownHelpPanelProps) {
  return (
    <div className="markdown-help-panel">
      <div className="markdown-help-panel__header">
        <h3>Markdown 语法指南</h3>
        <button
          onClick={onClose}
          className="markdown-help-panel__close"
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="markdown-help-panel__content">
        {MARKDOWN_GUIDE.map((section, index) => (
          <section key={index} className="markdown-help-section">
            <h4 className="markdown-help-section__title">{section.title}</h4>
            <div className="markdown-help-items">
              {section.items.map((item, i) => (
                <div key={i} className="markdown-help-item">
                  <code className="markdown-help-item__syntax">{item.syntax}</code>
                  <span className="markdown-help-item__desc">{item.description}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
