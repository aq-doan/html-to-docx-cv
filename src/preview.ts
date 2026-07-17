/**
 * Live preview: renders the vocabulary HTML into a sandboxed iframe with a
 * print-like stylesheet. Grid column proportions are injected from data-widths
 * (CSS alone cannot read attributes into grid-template-columns).
 */
import previewCss from './preview.css?raw';

function withGridColumns(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const grid of doc.querySelectorAll('div.grid[data-widths]')) {
    const widths = (grid.getAttribute('data-widths') ?? '')
      .split(',')
      .map((w) => parseInt(w.trim(), 10))
      .filter((w) => Number.isFinite(w) && w > 0);
    if (widths.length > 0) {
      (grid as HTMLElement).style.gridTemplateColumns = widths.map((w) => `${w}fr`).join(' ');
    }
  }
  return doc.body.innerHTML;
}

export function renderPreview(iframe: HTMLIFrameElement, html: string): void {
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>${previewCss}</style></head><body>${withGridColumns(html)}</body></html>`;
}
