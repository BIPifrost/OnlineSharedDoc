type ShortcutHelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ShortcutItem = {
  keys: string[];
  description: string;
};

const SHORTCUTS: ShortcutItem[] = [
  { keys: ["Ctrl", "S"], description: "保存文档" },
  { keys: ["Ctrl", "/"], description: "显示/隐藏快捷键帮助" },
  { keys: ["Ctrl", "M"], description: "显示/隐藏 Markdown 指南" },
  { keys: ["Ctrl", "B"], description: "切换左侧边栏" },
  { keys: ["Ctrl", "P"], description: "切换右侧面板" },
  { keys: ["Ctrl", "E"], description: "切换导出面板" },
  { keys: ["F11"], description: "编辑器全屏切换" },
  { keys: ["Ctrl", "F11"], description: "预览区全屏切换" },
];

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  if (!isOpen) return null;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  function formatKey(key: string): string {
    if (isMac && key === "Ctrl") return "⌘";
    return key;
  }

  return (
    <div className="shortcut-modal-overlay" onClick={onClose}>
      <div className="shortcut-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-modal__header">
          <h2>快捷键帮助</h2>
          <button className="shortcut-modal__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="shortcut-modal__body">
          <p className="shortcut-modal__platform">
            {isMac ? "macOS" : "Windows / Linux"}
          </p>
          <div className="shortcut-list">
            {SHORTCUTS.map((shortcut, index) => (
              <div key={index} className="shortcut-item">
                <div className="shortcut-keys">
                  {shortcut.keys.map((key, i) => (
                    <kbd key={i} className="shortcut-key">
                      {formatKey(key)}
                    </kbd>
                  ))}
                </div>
                <span className="shortcut-description">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
