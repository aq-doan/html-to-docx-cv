/**
 * Live preview: renders the vocabulary HTML into a sandboxed iframe with a
 * print-like stylesheet. Grid column proportions are injected from data-widths
 * (CSS alone cannot read attributes into grid-template-columns).
 */
import previewCss from './preview.css?raw';
import { parseTabs } from './tabs';

/** Full printable width in twips (must match converter constants). */
const CONTENT_TWIPS = 10800;

function withGridColumns(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Entry lines: lay spans out on a grid whose column edges are the real tab stops.
  for (const entry of doc.querySelectorAll('p.entry[data-tabs]')) {
    const stops = (parseTabs(entry.getAttribute('data-tabs') ?? '') ?? []).filter((s) => s.pos > 0);
    const spans = [...entry.children].filter((c) => c.tagName === 'SPAN') as HTMLElement[];
    if (stops.length === 0 || spans.length !== stops.length + 1) continue;
    // Common Word pattern "middle part centered, last part flush right"
    // (data-tabs="5400:center,10800:right"): equal flex on the outer spans centers
    // the middle one at the page midpoint, exactly like the DOCX center tab stop.
    if (spans.length === 3 && stops[0].align === 'center' && stops[1].align === 'right') {
      (entry as HTMLElement).style.display = 'flex';
      spans[0].style.flex = '1 1 0';
      spans[1].style.flex = 'none';
      spans[1].style.textAlign = 'center';
      spans[2].style.flex = '1 1 0';
      spans[2].style.textAlign = 'right';
      continue;
    }
    // Flex model: each left stop fixes the width of the span before it; a trailing
    // right stop means the last span ends at that position (right-aligned), with
    // the span before it absorbing the remaining space.
    const lastRight = stops[stops.length - 1].align === 'right';
    const fixedStops = lastRight ? stops.slice(0, -1) : stops;
    (entry as HTMLElement).style.display = 'flex';
    let prev = 0;
    spans.forEach((span, i) => {
      if (i < fixedStops.length) {
        span.style.minWidth = `${((fixedStops[i].pos - prev) / CONTENT_TWIPS) * 100}%`;
        span.style.flex = 'none';
        span.style.paddingRight = '0.06in';
        prev = fixedStops[i].pos;
      } else if (lastRight && i === spans.length - 1) {
        span.style.flex = 'none';
        span.style.textAlign = 'right';
      } else {
        span.style.flex = '1';
      }
    });
  }
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

/** Scale the fixed 8.5in page to fit the pane width; call once and on resize. */
export function fitPreview(iframe: HTMLIFrameElement, pane: HTMLElement): void {
  const PAGE_PX = 8.5 * 96 + 24; // page width + shadow allowance
  const apply = () => {
    const scale = Math.min(1, pane.clientWidth / PAGE_PX);
    iframe.style.width = `${PAGE_PX}px`;
    iframe.style.height = `${pane.clientHeight / scale}px`;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top left';
    iframe.style.flex = 'none';
  };
  apply();
  new ResizeObserver(apply).observe(pane);
}
