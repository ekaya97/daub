const ICON_PATHS: Record<string, string> = {
  target: '<circle cx="7" cy="7" r="5.5"/><circle cx="7" cy="7" r="2"/><path d="M7 .5v2M7 11.5v2M.5 7h2M11.5 7h2"/>',
  cursor: '<path d="M2.5 2.5l3.2 9 1.6-3.7 3.7-1.6z"/>',
  pen: '<path d="M1.5 12.5L4 12l7-7-2.5-2.5-7 7z"/><path d="M8.5 3l2.5 2.5"/>',
  arrow: '<path d="M2 12L12 2"/><path d="M5 2h7v7"/>',
  rect: '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/>',
  text: '<path d="M3 3h8M7 3v9M5 12h4"/>',
  eraser: '<path d="M3 11l5-5 3 3-5 5h-3z"/><path d="M8 6l3-3 2 2-3 3"/>',
  undo: '<path d="M3 7h6a3 3 0 0 1 0 6H6"/><path d="M5 4L2 7l3 3"/>',
  redo: '<path d="M11 7H5a3 3 0 0 0 0 6h3"/><path d="M9 4l3 3-3 3"/>',
  close: '<path d="M3 3l8 8M11 3l-8 8"/>',
  min: '<path d="M3 7h8"/>',
  dock: '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M8 2.5v9"/>',
  file: '<path d="M3 1.5h5l3 3v8h-8z"/><path d="M8 1.5v3h3"/>',
  copy: '<rect x="4" y="4" width="8" height="8" rx="1"/><path d="M2 9V2h7"/>',
  check: '<path d="M2.5 7l3 3 6-6"/>',
  eye: '<path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/>',
  search: '<circle cx="6" cy="6" r="3.5"/><path d="M9 9l3 3"/>',
  play: '<path d="M3.5 2.5l8 4.5-8 4.5z"/>',
  diff: '<path d="M5 2.5v9M9 2.5v9M2 7h3M11 7h-3"/>',
  layers: '<path d="M7 1.5L1.5 4.5 7 7.5l5.5-3z"/><path d="M1.5 7.5L7 10.5l5.5-3M1.5 10.5L7 13.5l5.5-3"/>',
  spacing: '<path d="M1.5 1.5h11M1.5 12.5h11M3 4h8v6h-8z"/>',
  type: '<path d="M2 3h10M7 3v9M5 12h4"/>',
  palette: '<circle cx="7" cy="7" r="5.5"/><circle cx="5" cy="5" r=".8" fill="currentColor"/><circle cx="9" cy="5" r=".8" fill="currentColor"/><circle cx="10" cy="8" r=".8" fill="currentColor"/>',
  layout: '<rect x="1.5" y="1.5" width="11" height="11" rx="1"/><path d="M1.5 5h11M5 5v7.5"/>',
  zap: '<path d="M7.5 1L3 8h3l-.5 5L10 6H7z"/>',
};

export type IconName =
  | 'target'
  | 'cursor'
  | 'pen'
  | 'arrow'
  | 'rect'
  | 'text'
  | 'eraser'
  | 'undo'
  | 'redo'
  | 'close'
  | 'min'
  | 'dock'
  | 'file'
  | 'copy'
  | 'check'
  | 'eye'
  | 'search'
  | 'play'
  | 'diff'
  | 'layers'
  | 'spacing'
  | 'type'
  | 'palette'
  | 'layout'
  | 'zap';

export function createIcon(name: IconName, size: number = 14): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.innerHTML = ICON_PATHS[name] ?? '';
  return svg;
}
