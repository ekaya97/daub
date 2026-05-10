export const DAUB_STYLES = `
  :host {
    --daub-bg: #18181b;
    --daub-bg-surface: #27272a;
    --daub-border: #3f3f46;
    --daub-text: #e4e4e7;
    --daub-text-muted: #a1a1aa;
    --daub-accent: #6366f1;
    --daub-accent-hover: #818cf8;
    --daub-danger: #ef4444;
    --daub-success: #22c55e;
    --daub-warning: #eab308;
  }

  /* Trigger button */
  .daub-trigger {
    position: fixed;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--daub-bg);
    border: 1.5px solid var(--daub-border);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
  }

  .daub-trigger:hover {
    transform: scale(1.08);
    background: var(--daub-bg-surface);
  }

  .daub-trigger:active {
    transform: scale(0.95);
  }

  .daub-trigger.active {
    background: var(--daub-accent);
  }

  .daub-trigger svg {
    width: 20px;
    height: 20px;
  }

  /* Panel */
  .daub-panel {
    position: fixed;
    top: 0;
    width: 420px;
    height: 100vh;
    background: var(--daub-bg);
    color: var(--daub-text);
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    z-index: 2147483647;
    overflow: hidden;
    transition: transform 0.2s ease-out;
  }

  .daub-panel.right {
    right: 0;
    border-left: 1px solid var(--daub-border);
    transform: translateX(0);
  }

  .daub-panel.left {
    left: 0;
    border-right: 1px solid var(--daub-border);
    transform: translateX(0);
  }

  .daub-panel.slide-out-right {
    transform: translateX(100%);
  }

  .daub-panel.slide-out-left {
    transform: translateX(-100%);
  }

  @media (max-width: 639px) {
    .daub-panel {
      width: 100%;
      height: 60vh;
      bottom: 0;
      top: auto;
      border-left: none;
      border-right: none;
      border-top: 1px solid var(--daub-border);
    }
  }

  /* Panel header */
  .daub-panel-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--daub-border);
    gap: 8px;
  }

  .daub-panel-brand {
    font-weight: 700;
    font-size: 14px;
    color: var(--daub-accent);
  }

  .daub-panel-info {
    flex: 1;
    font-size: 12px;
    color: var(--daub-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .daub-panel-close,
  .daub-panel-swap {
    background: none;
    border: none;
    color: var(--daub-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .daub-panel-close:hover,
  .daub-panel-swap:hover {
    color: var(--daub-text);
    background: var(--daub-bg-surface);
  }

  /* Tab bar */
  .daub-tabs {
    display: flex;
    flex-direction: row;
    border-bottom: 1px solid var(--daub-border);
  }

  .daub-tab {
    flex: 1;
    padding: 8px 12px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--daub-text-muted);
    cursor: pointer;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .daub-tab:hover {
    color: var(--daub-text);
  }

  .daub-tab.active {
    color: var(--daub-accent);
    border-bottom-color: var(--daub-accent);
  }

  /* Tab content */
  .daub-tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Panel footer */
  .daub-panel-footer {
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--daub-border);
  }

  .daub-btn-primary {
    flex: 1;
    padding: 8px 16px;
    background: var(--daub-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .daub-btn-primary:hover {
    background: var(--daub-accent-hover);
  }

  .daub-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .daub-btn-secondary {
    padding: 8px 12px;
    background: none;
    border: 1px solid var(--daub-border);
    color: var(--daub-text-muted);
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .daub-btn-secondary:hover {
    color: var(--daub-text);
    border-color: var(--daub-text-muted);
  }

  /* Annotate toolbar */
  .daub-annotate-toolbar {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 0;
    margin-bottom: 8px;
  }

  .daub-tool-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: none;
    border: 1px solid var(--daub-border);
    color: var(--daub-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .daub-tool-btn:hover {
    background: var(--daub-bg-surface);
    color: var(--daub-text);
  }

  .daub-tool-btn.active {
    background: var(--daub-bg-surface);
    color: var(--daub-accent);
    border-color: var(--daub-accent);
  }

  .daub-color-input {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }

  /* Canvas container */
  .daub-canvas-container {
    position: relative;
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid var(--daub-border);
  }

  .daub-canvas-container img {
    display: block;
    width: 100%;
  }

  .daub-canvas-container canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
  }

  /* Toast */
  .daub-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--daub-bg);
    font-size: 13px;
    font-family: system-ui;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    z-index: 2147483647;
    animation: slideUp 0.2s ease-out;
  }

  .daub-toast.success {
    border: 1px solid var(--daub-success);
    color: var(--daub-success);
  }

  .daub-toast.error {
    border: 1px solid var(--daub-danger);
    color: var(--daub-danger);
  }

  .daub-toast.warning {
    border: 1px solid var(--daub-warning);
    color: var(--daub-warning);
  }

  /* Keyframes */
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* Resize handle */
  .daub-resize-handle {
    position: absolute;
    top: 0;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    background: transparent;
  }

  .daub-resize-handle:hover {
    background: var(--daub-border);
  }

  .daub-panel.right .daub-resize-handle {
    left: 0;
  }

  .daub-panel.left .daub-resize-handle {
    right: 0;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--daub-border);
    border-radius: 3px;
  }
`;

export function applyStyles(shadow: ShadowRoot): void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(DAUB_STYLES);
  shadow.adoptedStyleSheets = [sheet];
}
