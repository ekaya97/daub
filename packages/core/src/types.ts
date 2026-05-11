// --- Plugin options (user-facing, in vite.config.ts) ---

export interface DaubOptions {
  enabled?: boolean;
  outputDir?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  shortcut?: string;
  modifyGitignore?: boolean;
  triggerStyle?: 'pill' | 'compact';
}

// --- Runtime config (injected by plugin into window.__DAUB_CONFIG__) ---

export interface DaubConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  outputDir: string;
  projectRoot: string;
  writeEndpoint: string;
  token: string;
  shortcut: string;
  modifyGitignore: boolean;
  triggerStyle: 'pill' | 'compact';
}

// --- Source resolution ---

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  componentName: string;
  framework: 'react' | 'vue' | 'svelte' | 'unknown';
}

// --- Captured styles ---

export interface CapturedStyles {
  // Layout
  display: string;
  position: string;
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;

  // Box model
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  margin: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  // Flexbox
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignSelf: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;

  // Grid
  gridTemplateColumns: string;
  gridTemplateRows: string;

  // Visual
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  borderRadius: string;
  opacity: string;
  overflow: string;
  overflowX: string;
  overflowY: string;

  // Typography
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textOverflow: string;
  whiteSpace: string;
}

export interface CssDelta {
  property: string;
  before: string;
  after: string;
}

// --- Element context (the full capture payload) ---

export interface ElementContext {
  source: SourceLocation | null;

  tagName: string;
  domPath: string;
  classList: string[];
  htmlSubtree: string;

  computedStyles: CapturedStyles;
  tailwindClasses: string[];

  rect: { top: number; left: number; width: number; height: number };

  screenshotBefore: string;
  screenshotAfter: string | null;
  screenshotAnnotated: string | null;

  cssDelta: CssDelta[];

  capturedAt: number;
  notes: string;
}

// --- Session ---

export interface DaubSession {
  id: string;
  elementContext: ElementContext;
  outputMarkdown: string;
}
