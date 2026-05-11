export const DAUB_STYLES = `
:host {
  --accent: oklch(0.72 0.18 45);
  --accent-soft: oklch(0.72 0.18 45 / 0.14);
  --accent-line: oklch(0.72 0.18 45 / 0.4);
  --w-bg: #16140f;
  --w-bg-2: #1f1c16;
  --w-bg-3: #2a2620;
  --w-line: #2e2a22;
  --w-line-2: #3a3528;
  --w-ink: #f5efe0;
  --w-ink-2: #b4ad9a;
  --w-ink-3: #6f6a5b;
  --w-accent: oklch(0.74 0.18 45);
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --surface: #ffffff;
  --ink: #1a1816;
  --ink-2: #524e47;
  --ink-3: #8a857c;
  --line: #e7e3d9;
}

*, *::before, *::after { box-sizing: border-box; }

@keyframes daub-fadein {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes daub-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 87, 0.5); }
  50%      { box-shadow: 0 0 0 10px rgba(217, 119, 87, 0); }
}
@keyframes daub-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes daub-toast-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(8px); }
}

.daub-root {
  position: absolute;
  z-index: 200;
  font-family: var(--font-sans);
  color: var(--w-ink);
}

/* --- TRIGGER --- */
.daub-trigger {
  position: fixed;
  right: 16px;
  bottom: 16px;
  pointer-events: auto;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--w-bg);
  border: 1px solid var(--w-line-2);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 6px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--w-ink-2);
  transition: all 0.18s ease;
  cursor: default;
  user-select: none;
}
.daub-trigger:hover { border-color: var(--w-accent); color: var(--w-ink); }
.daub-trigger-main {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 9px 4px 6px;
  border-radius: 5px;
}
.daub-trigger-main:hover { background: var(--w-bg-2); }
.daub-trigger-mark {
  width: 16px; height: 16px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.daub-trigger-mark::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--w-accent) 0%, oklch(0.62 0.16 30) 100%);
}
.daub-trigger-mark::after {
  content: '';
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--w-bg);
  right: 1px; bottom: 1px;
}
.daub-trigger-label { font-weight: 500; color: var(--w-ink); }
.daub-trigger-kbd {
  font-size: 10px;
  color: var(--w-ink-3);
  padding: 1px 5px;
  border: 1px solid var(--w-line-2);
  border-radius: 3px;
  font-family: var(--font-mono);
  line-height: 1.2;
}
.daub-trigger-sep { width: 1px; height: 14px; background: var(--w-line); margin: 0 2px; }
.daub-trigger-action {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--w-ink-3);
  font-family: inherit;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 5px;
  cursor: default;
  display: flex;
  align-items: center;
  gap: 4px;
}
.daub-trigger-action:hover { background: var(--w-bg-2); color: var(--w-ink); }
.daub-trigger.compact { padding: 0; border-radius: 12px; }
.daub-trigger.compact .daub-trigger-main { padding: 8px; border-radius: 11px; }
.daub-trigger.compact .daub-trigger-mark { width: 20px; height: 20px; }
.daub-trigger.compact .daub-trigger-label,
.daub-trigger.compact .daub-trigger-kbd,
.daub-trigger.compact .daub-trigger-sep,
.daub-trigger.compact .daub-trigger-action { display: none; }
.daub-trigger.selecting { border-color: var(--w-accent); background: var(--w-bg); }
.daub-trigger.selecting .daub-trigger-mark::before {
  animation: daub-pulse 1.6s ease-in-out infinite;
}

/* --- PANEL --- */
.daub-panel {
  position: fixed;
  z-index: 2147483646;
  right: 16px;
  bottom: 16px;
  pointer-events: auto;
  width: 520px;
  height: 600px;
  max-width: calc(100% - 32px);
  max-height: calc(100% - 32px);
  background: var(--w-bg);
  border: 1px solid var(--w-line-2);
  border-radius: 12px;
  box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 20px 60px -10px rgba(0,0,0,0.65), 0 6px 20px -4px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: daub-fadein 0.18s ease-out;
  color: var(--w-ink);
  font-size: 13px;
}
.daub-panel.minimized { height: auto; }
.daub-panel.minimized .daub-tabs,
.daub-panel.minimized .daub-body,
.daub-panel.minimized .daub-foot { display: none; }
.daub-resize-handle {
  position: absolute;
  z-index: 1;
}
.daub-resize-handle[data-edge="top"] { top: -3px; left: 8px; right: 8px; height: 6px; cursor: n-resize; }
.daub-resize-handle[data-edge="left"] { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: w-resize; }
.daub-resize-handle[data-edge="top-left"] { top: -4px; left: -4px; width: 12px; height: 12px; cursor: nw-resize; }
.daub-resize-handle[data-edge="top-left"]::after {
  content: '';
  position: absolute;
  bottom: -5px;
  right: -5px;
  width: 6px;
  height: 6px;
  border-left: 1.5px solid var(--w-ink-3);
  border-top: 1.5px solid var(--w-ink-3);
  opacity: 0.5;
}
.daub-panel-grip {
  height: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
  flex-shrink: 0;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
}
.daub-panel-grip::after {
  content: '';
  width: 32px;
  height: 3px;
  border-radius: 2px;
  background: var(--w-line-2);
}
.daub-panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--w-line);
  flex-shrink: 0;
}
.daub-panel-mark {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--w-accent), oklch(0.62 0.16 30));
  position: relative;
  flex-shrink: 0;
}
.daub-panel-mark::after {
  content: '';
  position: absolute;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--w-bg);
  right: 1px; bottom: 1px;
}
.daub-panel-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.daub-panel-name {
  font-weight: 600;
  font-size: 12.5px;
  color: var(--w-ink);
  display: flex;
  align-items: center;
  gap: 6px;
}
.daub-panel-name-sep { color: var(--w-ink-3); font-weight: 400; }
.daub-panel-name-target {
  color: var(--w-accent);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 12px;
}
.daub-panel-source {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--w-ink-3);
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daub-panel-source-line { color: var(--w-ink-2); }
.daub-head-actions { display: flex; gap: 2px; align-items: center; }
.daub-icon-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--w-ink-3);
  width: 26px; height: 26px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  font-size: 14px;
  line-height: 1;
}
.daub-icon-btn:hover { background: var(--w-bg-2); color: var(--w-ink); }
.daub-icon-btn[data-active="true"] { background: var(--w-bg-3); color: var(--w-ink); }

/* --- TABS --- */
.daub-tabs {
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 2px;
  border-bottom: 1px solid var(--w-line);
  background: linear-gradient(180deg, var(--w-bg-2) 0%, var(--w-bg) 100%);
  flex-shrink: 0;
  height: 36px;
}
.daub-tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--w-ink-3);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 0 10px;
  height: 28px;
  border-radius: 6px;
  cursor: default;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  position: relative;
}
.daub-tab:hover { color: var(--w-ink-2); background: var(--w-bg-2); }
.daub-tab[data-active="true"] { color: var(--w-ink); background: var(--w-bg-3); }
.daub-tab-num {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--w-ink-3);
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255,255,255,0.04);
  min-width: 14px;
  text-align: center;
}
.daub-tab[data-active="true"] .daub-tab-num { background: var(--accent-soft); color: var(--w-accent); }
.daub-tab-grow { flex: 1; }
.daub-tab-status {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--w-ink-3);
  padding: 0 6px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.daub-tab-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #5b8a4f;
  box-shadow: 0 0 0 2px rgba(91,138,79,0.18);
}

/* --- BODY & FOOTER --- */
.daub-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.daub-foot {
  border-top: 1px solid var(--w-line);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  background: var(--w-bg);
}
.daub-foot-hint {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--w-ink-3);
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--w-line-2);
  border-radius: 3px;
  color: var(--w-ink-2);
  background: var(--w-bg-2);
  line-height: 1.3;
}

/* --- BUTTONS --- */
.daub-btn {
  appearance: none;
  border: 1px solid var(--w-line-2);
  background: var(--w-bg-2);
  color: var(--w-ink);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 11px;
  border-radius: 6px;
  cursor: default;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.daub-btn:hover { background: var(--w-bg-3); border-color: #4a4438; }
.daub-btn-primary { background: var(--w-accent); border-color: var(--w-accent); color: #1a1108; }
.daub-btn-primary:hover { background: oklch(0.78 0.18 45); border-color: oklch(0.78 0.18 45); }
.daub-btn-ghost { background: transparent; border-color: transparent; color: var(--w-ink-2); }
.daub-btn-ghost:hover { background: var(--w-bg-2); color: var(--w-ink); }

/* --- ANNOTATE TAB --- */
.daub-annotate {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.daub-annotate-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--w-line);
  background: var(--w-bg-2);
}
.daub-tool-group {
  display: flex;
  align-items: center;
  gap: 1px;
  background: var(--w-bg);
  border: 1px solid var(--w-line);
  border-radius: 6px;
  padding: 2px;
}
.daub-tool {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--w-ink-2);
  width: 26px; height: 24px;
  border-radius: 4px;
  cursor: default;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.daub-tool:hover { background: var(--w-bg-2); color: var(--w-ink); }
.daub-tool[data-active="true"] {
  background: var(--w-bg-3);
  color: var(--w-accent);
  box-shadow: 0 0 0 1px var(--w-accent) inset;
}
.daub-tool svg { display: block; }
.daub-tool-sep { width: 1px; height: 16px; background: var(--w-line); margin: 0 4px; }
.daub-color-row { display: flex; gap: 4px; align-items: center; padding: 0 4px; }
.daub-color {
  width: 16px; height: 16px;
  border-radius: 50%;
  cursor: default;
  position: relative;
  border: 1.5px solid transparent;
  appearance: none;
  padding: 0;
}
.daub-color[data-active="true"] { border-color: var(--w-ink); transform: scale(1.05); }
.daub-canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  background: repeating-conic-gradient(#1a1814 0% 25%, #16140f 25% 50%) 0 0 / 16px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 24px;
}
.daub-canvas-img {
  position: relative;
  background: var(--surface);
  border-radius: 4px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  width: 86%;
  max-width: 420px;
  flex-shrink: 0;
}
.daub-canvas-img-content {
  background: var(--surface);
  color: var(--ink);
  padding: 18px 22px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.daub-canvas-svg { position: absolute; inset: 0; pointer-events: none; }
.daub-canvas-stats {
  position: absolute;
  bottom: 10px; left: 12px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--w-ink-3);
  background: rgba(15, 14, 12, 0.7);
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid var(--w-line);
  letter-spacing: 0.02em;
}
.daub-annot-label {
  position: absolute;
  background: var(--w-bg);
  color: var(--w-ink);
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--accent-line);
  white-space: nowrap;
  pointer-events: auto;
}

/* --- EDIT TAB --- */
.daub-edit {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  container-name: daub-edit;
  container-type: inline-size;
}
.daub-edit-nav {
  padding: 10px 12px;
  border-bottom: 1px solid var(--w-line);
  flex-shrink: 0;
}
.daub-edit-nav-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.daub-edit-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-family: var(--font-mono);
  color: var(--w-ink-3);
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}
.daub-edit-breadcrumb-item {
  cursor: default;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}
.daub-edit-breadcrumb-item:hover { background: var(--w-bg-2); color: var(--w-ink); }
.daub-edit-breadcrumb-item.active { color: var(--w-accent); }
.daub-edit-breadcrumb-sep { opacity: 0.4; }
.daub-edit-children {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.daub-edit-child {
  appearance: none;
  border: 1px solid var(--w-line);
  background: var(--w-bg-2);
  color: var(--w-ink-2);
  font: inherit;
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border-radius: 5px;
  cursor: default;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daub-edit-child:hover { border-color: var(--w-line-2); color: var(--w-ink); }
.daub-edit-child.active { border-color: var(--w-accent); color: var(--w-accent); }
.daub-edit-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  background: var(--w-bg-2);
  border: 1px solid var(--w-line);
  border-radius: 6px;
  padding: 2px;
}
.daub-edit-toggle-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--w-ink-3);
  font: inherit;
  font-size: 10.5px;
  font-family: var(--font-mono);
  padding: 3px 10px;
  border-radius: 5px;
  cursor: default;
}
.daub-edit-toggle-btn[data-active="true"] { background: var(--w-bg-3); color: var(--w-ink); }
.daub-edit-toggle-label {
  font-size: 10.5px;
  color: var(--w-ink-3);
  margin-left: 4px;
  padding-right: 4px;
  font-family: var(--font-mono);
}
.daub-edit-controls {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 12px;
  display: flex;
  flex-wrap: wrap;
}
.daub-edit-controls > .daub-edit-section {
  width: 100%;
}
@container daub-edit (min-width: 500px) {
  .daub-edit-controls > .daub-edit-section { width: 50%; }
}
.daub-edit-section {
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--w-line);
}
.daub-edit-section:last-child { border-bottom: 0; }
.daub-edit-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--w-ink-3);
  margin-bottom: 8px;
}
.daub-edit-section-head span { display: flex; align-items: center; gap: 5px; }
.daub-edit-section-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--w-accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.daub-edit-row {
  display: grid;
  grid-template-columns: 60px 1fr 44px;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.daub-edit-row-label { font-size: 11.5px; color: var(--w-ink-2); }
.daub-edit-row-value {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--w-ink-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.daub-edit-row-value.changed { color: var(--w-accent); }
.daub-slider {
  appearance: none;
  width: 100%; height: 4px;
  background: var(--w-bg-3);
  border-radius: 2px;
  outline: 0;
}
.daub-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px; height: 12px;
  background: var(--w-ink);
  border-radius: 50%;
  cursor: default;
  border: 2px solid var(--w-bg);
  box-shadow: 0 0 0 1px var(--w-line-2);
}
.daub-slider.changed::-webkit-slider-thumb { background: var(--w-accent); }
.daub-slider::-moz-range-thumb {
  width: 12px; height: 12px;
  background: var(--w-ink);
  border-radius: 50%;
  border: 2px solid var(--w-bg);
  box-shadow: 0 0 0 1px var(--w-line-2);
}
.daub-edit-swatch-row { display: flex; gap: 5px; flex-wrap: wrap; padding-top: 4px; }
.daub-edit-swatch {
  width: 20px; height: 20px;
  border-radius: 5px;
  cursor: default;
  border: 1.5px solid transparent;
  position: relative;
  appearance: none;
}
.daub-edit-swatch[data-active="true"] { border-color: var(--w-ink); }
.daub-edit-seg {
  display: flex;
  background: var(--w-bg-2);
  border: 1px solid var(--w-line);
  border-radius: 5px;
  padding: 1px;
  grid-column: 2 / -1;
}
.daub-edit-seg-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--w-ink-3);
  font: inherit;
  font-size: 10.5px;
  font-family: var(--font-mono);
  padding: 3px 5px;
  border-radius: 3px;
  flex: 1;
  cursor: default;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.daub-edit-seg-btn[data-active="true"] { background: var(--w-bg-3); color: var(--w-ink); }

/* --- OUTPUT TAB --- */
.daub-output {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.daub-output-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.daub-output-card {
  background: var(--w-bg-2);
  border: 1px solid var(--w-line);
  border-radius: 8px;
  overflow: hidden;
}
.daub-output-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-bottom: 1px solid var(--w-line);
  font-size: 10.5px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--w-ink-3);
}
.daub-output-card-tag {
  font-size: 9.5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--w-bg-3);
  color: var(--w-ink-2);
}
.daub-output-card-tag.before { background: rgba(150, 100, 80, 0.18); color: #d49a82; }
.daub-output-card-tag.after { background: var(--accent-soft); color: var(--w-accent); }
.daub-output-thumb {
  aspect-ratio: 4 / 3;
  background: repeating-conic-gradient(#1a1814 0% 25%, #16140f 25% 50%) 0 0 / 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}
.daub-output-thumb-content {
  background: var(--surface);
  color: var(--ink);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}
.daub-output-thumb img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 4px;
  object-fit: contain;
  cursor: pointer;
}
.daub-output-summary {
  background: var(--w-bg-2);
  border: 1px solid var(--w-line);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--w-ink-2);
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.daub-output-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-bottom: 1px solid var(--w-line);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--w-ink-3);
}
.daub-output-summary-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.55;
  font-size: 11.5px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.daub-output-summary-body .k { color: var(--w-ink-3); }
.daub-output-summary-body .v { color: var(--w-ink); }
.daub-output-summary-body .diff-add { color: #8fbf75; }
.daub-output-summary-body .diff-del { color: #d48275; text-decoration: line-through; opacity: 0.7; }
.daub-output-summary-body .comment { color: var(--w-ink-3); }
.daub-output-includes { display: flex; gap: 6px; flex-wrap: wrap; }
.daub-output-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  background: var(--w-bg-2);
  border: 1px solid var(--w-line);
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--w-ink-2);
  cursor: default;
  appearance: none;
}
.daub-output-chip:hover { border-color: var(--w-line-2); color: var(--w-ink); }
.daub-output-chip-check {
  width: 12px; height: 12px;
  border-radius: 3px;
  background: var(--w-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1a1108;
  font-size: 9px;
  font-weight: 700;
}
.daub-output-chip.off .daub-output-chip-check {
  background: transparent;
  border: 1px solid var(--w-line-2);
}

/* --- HISTORY TAB --- */
.daub-history {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.daub-history-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--w-line);
}
.daub-history-search {
  flex: 1;
  background: var(--w-bg-2);
  border: 1px solid var(--w-line);
  border-radius: 6px;
  padding: 4px 9px;
  color: var(--w-ink);
  font: inherit;
  font-size: 11.5px;
  font-family: var(--font-mono);
  outline: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.daub-history-search input {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  flex: 1;
  outline: 0;
}
.daub-history-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.daub-history-item {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--w-line);
  cursor: default;
}
.daub-history-item:hover { background: var(--w-bg-2); }
.daub-history-thumb {
  width: 36px; height: 28px;
  border-radius: 4px;
  background: var(--w-bg-3);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.daub-history-thumb-bar { height: 4px; border-radius: 1px; background: var(--w-ink-2); }
.daub-history-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.daub-history-title {
  font-size: 12px;
  color: var(--w-ink);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.daub-history-meta {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--w-ink-3);
  display: flex;
  align-items: center;
  gap: 7px;
}
.daub-history-meta .dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--w-ink-3);
}
.daub-history-side {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--w-ink-3);
  display: flex;
  align-items: center;
  gap: 6px;
}
.daub-history-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(143, 191, 117, 0.14);
  color: #8fbf75;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.daub-history-status.pending { background: rgba(217, 184, 87, 0.14); color: #d9b857; }

/* --- TOAST --- */
.daub-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--w-bg-2);
  border: 1px solid var(--w-line-2);
  color: var(--w-ink);
  font-family: var(--font-sans);
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 300;
  animation: daub-toast-in 0.2s ease-out;
  pointer-events: auto;
}
.daub-toast.success { border-color: rgba(91,138,79,0.4); }
.daub-toast.error { border-color: rgba(212,130,117,0.4); }
.daub-toast.warning { border-color: rgba(217,184,87,0.4); }

/* --- SELECT MODE --- */
.daub-select-cursor-info {
  position: absolute;
  pointer-events: none;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--w-ink);
  background: var(--w-bg);
  border: 1px solid var(--w-line-2);
  border-radius: 5px;
  padding: 3px 7px;
  white-space: nowrap;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  z-index: 101;
}
.daub-select-cursor-info .ck { color: var(--w-accent); }

/* --- LIGHTBOX --- */
.daub-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.daub-lightbox img {
  max-width: 90%;
  max-height: 90%;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
`;

export function applyStyles(shadow: ShadowRoot): void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(DAUB_STYLES);
  shadow.adoptedStyleSheets = [sheet];
}
