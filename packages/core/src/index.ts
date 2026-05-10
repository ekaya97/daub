export type {
  DaubOptions,
  DaubConfig,
  SourceLocation,
  CapturedStyles,
  CssDelta,
  ElementContext,
  DaubSession,
} from './types.js';

export { serializeToMarkdown } from './serializer.js';
export { captureStyles, diffStyles, extractTailwindClasses } from './styles.js';
export { serializeDOM } from './dom-serializer.js';
