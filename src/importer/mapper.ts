/**
 * word/document.xml DOM → contract HTML. The heuristic inverse of
 * converter/handlers.ts: recognises the Word signals the converter emits
 * (heading bottom borders, tab stops, numPr bullets, borderless tables) and
 * maps them back onto the closed template vocabulary. Output always goes
 * through validate.ts, which is the ground truth for what survived.
 */

export interface ImportResult {
  html: string;
  /** Count of body blocks that matched no mapping rule and were dropped. */
  skipped: number;
}

/** rId → hyperlink target, from word/_rels/document.xml.rels. */
export type RelMap = Map<string, string>;

/** Runs at/above this half-point size mark the header-name table. */
const NAME_SIZE_MIN = 40;

// ---------------------------------------------------------------------------
// Namespace-agnostic XML helpers (match by localName; prefixes vary).
// ---------------------------------------------------------------------------

const kids = (el: Element, name: string): Element[] =>
  [...el.children].filter((c) => c.localName === name);
const kid = (el: Element, name: string): Element | undefined => kids(el, name)[0];

function attr(el: Element, name: string): string | null {
  for (const a of el.attributes) {
    if (a.localName === name) return a.value;
  }
  return null;
}

function descendants(el: Element, name: string): Element[] {
  const out: Element[] = [];
  for (const c of el.children) {
    if (c.localName === name) out.push(c);
    out.push(...descendants(c, name));
  }
  return out;
}

/** <w:b/>-style toggles: present means on unless val is 0/false/none. */
function toggleOn(rPr: Element | undefined, name: string): boolean {
  const el = rPr && kid(rPr, name);
  if (!el) return false;
  const val = attr(el, 'val');
  return val === null || !['0', 'false', 'none'].includes(val);
}

// ---------------------------------------------------------------------------
// Inline: runs → styled atoms → contract inline HTML.
// ---------------------------------------------------------------------------

interface Style {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface Atom {
  kind: 'text' | 'tab' | 'break';
  text: string;
  style: Style;
  link?: string;
}

function runAtoms(r: Element, link: string | undefined, out: Atom[]): void {
  const rPr = kid(r, 'rPr');
  const style: Style = {
    bold: toggleOn(rPr, 'b'),
    italic: toggleOn(rPr, 'i'),
    underline: toggleOn(rPr, 'u'),
  };
  for (const c of r.children) {
    switch (c.localName) {
      case 't':
        for (const [i, segment] of (c.textContent ?? '').split('\t').entries()) {
          if (i > 0) out.push({ kind: 'tab', text: '', style, link });
          if (segment !== '') out.push({ kind: 'text', text: segment, style, link });
        }
        break;
      case 'tab':
        out.push({ kind: 'tab', text: '', style, link });
        break;
      case 'br':
        out.push({ kind: 'break', text: '', style, link });
        break;
      case 'noBreakHyphen':
        out.push({ kind: 'text', text: '-', style, link });
        break;
    }
  }
}

/** Collect run atoms from a paragraph, resolving w:hyperlink wrappers via rels. */
function paragraphAtoms(p: Element, rels: RelMap, link?: string): Atom[] {
  const out: Atom[] = [];
  for (const c of p.children) {
    if (c.localName === 'pPr') continue;
    if (c.localName === 'r') {
      runAtoms(c, link, out);
    } else if (c.localName === 'hyperlink') {
      const id = attr(c, 'id');
      out.push(...paragraphAtoms(c, rels, (id && rels.get(id)) || link));
    } else {
      // smartTag / ins / sdt wrappers: descend and keep collecting runs.
      out.push(...paragraphAtoms(c, rels, link));
    }
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const plainText = (atoms: Atom[]): string => atoms.map((a) => a.text).join('');

const sameStyle = (a: Atom, b: Atom): boolean =>
  a.style.bold === b.style.bold && a.style.italic === b.style.italic && a.style.underline === b.style.underline;

/**
 * Atoms → inline HTML. `stripBold` drops <strong> wrappers for constructs the
 * exporter renders bold anyway (entry lines, the h1 name, h2 headings).
 */
function atomsToHtml(atoms: Atom[], stripBold = false): string {
  // Trim outer whitespace, then merge adjacent text atoms with identical style+link.
  const trimmed = [...atoms];
  while (trimmed[0]?.kind === 'text' && trimmed[0].text.trim() === '') trimmed.shift();
  while (trimmed.at(-1)?.kind === 'text' && trimmed.at(-1)!.text.trim() === '') trimmed.pop();
  if (trimmed[0]?.kind === 'text') trimmed[0] = { ...trimmed[0], text: trimmed[0].text.replace(/^\s+/, '') };
  const last = trimmed.at(-1);
  if (last?.kind === 'text') trimmed[trimmed.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };

  const merged: Atom[] = [];
  for (const a of trimmed) {
    const prev = merged.at(-1);
    if (a.kind === 'text' && prev?.kind === 'text' && sameStyle(prev, a) && prev.link === a.link) {
      prev.text += a.text;
    } else {
      merged.push({ ...a });
    }
  }

  const pieces: string[] = [];
  let openLink: string | undefined;
  let linkBuf: string[] = [];
  const flushLink = () => {
    if (openLink !== undefined) {
      pieces.push(`<a href="${esc(openLink)}">${linkBuf.join('')}</a>`);
      openLink = undefined;
      linkBuf = [];
    }
  };

  for (const a of merged) {
    if (a.kind === 'break') {
      flushLink();
      pieces.push('<br>');
      continue;
    }
    if (a.kind === 'tab') continue; // caller splits on tabs before calling
    let h = esc(a.text);
    if (a.style.underline && a.link === undefined) h = `<u>${h}</u>`; // links are underlined by style
    if (a.style.italic) h = `<em>${h}</em>`;
    if (a.style.bold && !stripBold) h = `<strong>${h}</strong>`;
    if (a.link !== undefined) {
      if (openLink !== a.link) flushLink();
      openLink = a.link;
      linkBuf.push(h);
    } else {
      flushLink();
      pieces.push(h);
    }
  }
  flushLink();
  return pieces.join('');
}

// ---------------------------------------------------------------------------
// Paragraph classification.
// ---------------------------------------------------------------------------

interface TabStop {
  pos: number;
  val: string | null;
}

function tabStops(pPr: Element | undefined): TabStop[] {
  const tabs = pPr && kid(pPr, 'tabs');
  if (!tabs) return [];
  return kids(tabs, 'tab')
    .filter((t) => attr(t, 'val') !== 'clear')
    .map((t) => ({ pos: parseInt(attr(t, 'pos') ?? '0', 10), val: attr(t, 'val') }));
}

const stopSuffix = (val: string | null): string =>
  val === 'right' || val === 'end' ? ':right' : val === 'center' ? ':center' : '';

/** Split atoms on tab atoms → the entry-line parts. */
function splitOnTabs(atoms: Atom[]): Atom[][] {
  const parts: Atom[][] = [[]];
  for (const a of atoms) {
    if (a.kind === 'tab') parts.push([]);
    else parts.at(-1)!.push(a);
  }
  return parts.filter((p) => plainText(p).trim() !== '');
}

function entryWithTabs(atoms: Atom[], stops: TabStop[]): string {
  let parts = splitOnTabs(atoms);
  // Contract: N stops separate N+1 parts. Reconcile real-world mismatches.
  if (parts.length - 1 < stops.length) {
    // Fewer parts than stops → keep the first parts-2 stops plus the final
    // (usually right-aligned) stop, preserving the flush-right last part.
    stops = parts.length >= 2 ? [...stops.slice(0, parts.length - 2), stops[stops.length - 1]] : [];
  } else if (parts.length - 1 > stops.length) {
    // More parts than stops → fold the extras into the last part.
    const keep = parts.slice(0, stops.length);
    const rest = parts.slice(stops.length).flat();
    parts = [...keep, rest];
  }
  const dataTabs = stops.map((s) => `${s.pos}${stopSuffix(s.val)}`).join(',');
  const spans = parts.map((p) => `<span>${atomsToHtml(p, true)}</span>`).join('');
  return `<p class="entry" data-tabs="${dataTabs}">${spans}</p>`;
}

type Mapped =
  | { type: 'li'; html: string }
  | { type: 'block'; html: string }
  | { type: 'skip' };

function mapParagraph(p: Element, rels: RelMap): Mapped {
  const pPr = kid(p, 'pPr');
  const atoms = paragraphAtoms(p, rels);
  const text = plainText(atoms).trim();

  if (pPr && kid(pPr, 'numPr')) {
    if (text === '') return { type: 'skip' };
    return { type: 'li', html: `<li>${atomsToHtml(atoms)}</li>` };
  }

  const pBdr = pPr && kid(pPr, 'pBdr');
  if (pBdr && kid(pBdr, 'bottom') && text !== '') {
    return { type: 'block', html: `<h2>${atomsToHtml(atoms, true)}</h2>` };
  }

  if (text === '') return { type: 'block', html: '<p class="spacer"></p>' };

  const stops = tabStops(pPr);
  if (stops.length > 0 && atoms.some((a) => a.kind === 'tab')) {
    return { type: 'block', html: entryWithTabs(atoms, stops) };
  }

  const textAtoms = atoms.filter((a) => a.kind === 'text' && a.text.trim() !== '');
  if (textAtoms.length > 0 && textAtoms.every((a) => a.style.bold)) {
    return { type: 'block', html: `<p class="entry">${atomsToHtml(atoms, true)}</p>` };
  }

  const jc = pPr && kid(pPr, 'jc');
  if (jc && ['right', 'end'].includes(attr(jc, 'val') ?? '')) {
    return { type: 'block', html: `<p class="right">${atomsToHtml(atoms)}</p>` };
  }

  const cls = /^tech stack\b/i.test(text) ? ' class="tech-stack"' : '';
  return { type: 'block', html: `<p${cls}>${atomsToHtml(atoms)}</p>` };
}

// ---------------------------------------------------------------------------
// Tables: header vs skill grid.
// ---------------------------------------------------------------------------

function cellParagraphs(tc: Element): Element[] {
  return kids(tc, 'p');
}

function isHeaderTable(tbl: Element): boolean {
  const firstRow = kid(tbl, 'tr');
  if (!firstRow || kids(firstRow, 'tc').length !== 2) return false;
  return descendants(tbl, 'sz').some((sz) => parseInt(attr(sz, 'val') ?? '0', 10) >= NAME_SIZE_MIN);
}

/** In the contact block, wrap bare emails/URLs so they survive as hyperlinks. */
function autoLink(html: string, raw: string): string {
  if (html.includes('<a ')) return html;
  const text = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `<a href="mailto:${esc(text)}">${html}</a>`;
  if (/^https?:\/\/\S+$/.test(text)) return `<a href="${esc(text)}">${html}</a>`;
  if (/^www\.\S+$/.test(text)) return `<a href="https://${esc(text)}">${html}</a>`;
  return html;
}

function mapHeaderTable(tbl: Element, rels: RelMap): string {
  const cells = kids(tbl, 'tr').flatMap((tr) => kids(tr, 'tc'));
  const [nameCell, ...rest] = cells;
  const nameAtoms = cellParagraphs(nameCell)
    .map((p) => paragraphAtoms(p, rels))
    .find((a) => plainText(a).trim() !== '');
  const name = nameAtoms ? atomsToHtml(nameAtoms, true) : '';

  const contactLines: string[] = [];
  for (const cell of rest) {
    for (const p of cellParagraphs(cell)) {
      const atoms = paragraphAtoms(p, rels);
      const raw = plainText(atoms).trim();
      if (raw === '') continue;
      contactLines.push(`    <p>${autoLink(atomsToHtml(atoms), raw)}</p>`);
    }
  }

  return [
    '<header class="cv-header">',
    `  <h1>${name}</h1>`,
    '  <div class="contact">',
    ...contactLines,
    '  </div>',
    '</header>',
  ].join('\n');
}

function mapGridTable(tbl: Element, rels: RelMap): Mapped {
  const grid = kid(tbl, 'tblGrid');
  const widths = grid ? kids(grid, 'gridCol').map((c) => parseInt(attr(c, 'w') ?? '0', 10)) : [];

  // Column-major: collect each column's paragraphs across all rows.
  const columns: string[][] = widths.map(() => []);
  for (const tr of kids(tbl, 'tr')) {
    kids(tr, 'tc').forEach((tc, i) => {
      if (!columns[i]) columns[i] = [];
      for (const p of cellParagraphs(tc)) {
        const atoms = paragraphAtoms(p, rels);
        if (plainText(atoms).trim() === '') continue;
        columns[i].push(`    <li>${atomsToHtml(atoms)}</li>`);
      }
    });
  }

  // Drop empty columns (and their widths) so widths count == <ul> count.
  const keep = columns.map((c, i) => ({ items: c, width: widths[i] })).filter((c) => c.items.length > 0);
  if (keep.length === 0) return { type: 'skip' };

  const dataWidths = keep.every((c) => Number.isFinite(c.width) && c.width > 0)
    ? ` data-widths="${keep.map((c) => c.width).join(',')}"`
    : '';
  const uls = keep.map((c) => ['  <ul>', ...c.items, '  </ul>'].join('\n')).join('\n');
  return { type: 'block', html: `<div class="grid"${dataWidths}>\n${uls}\n</div>` };
}

// ---------------------------------------------------------------------------
// Document walk.
// ---------------------------------------------------------------------------

export function mapDocument(body: Element, rels: RelMap): ImportResult {
  const blocks: string[] = [];
  let skipped = 0;
  let headerDone = false;

  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(['<ul>', ...listItems.map((li) => `  ${li}`), '</ul>'].join('\n'));
      listItems = [];
    }
  };

  for (const el of body.children) {
    if (el.localName === 'sectPr') continue;

    if (el.localName === 'tbl') {
      flushList();
      if (!headerDone && isHeaderTable(el)) {
        headerDone = true;
        blocks.push(mapHeaderTable(el, rels));
      } else {
        const mapped = mapGridTable(el, rels);
        if (mapped.type === 'block') blocks.push(mapped.html);
        else skipped++;
      }
      continue;
    }

    if (el.localName === 'p') {
      const mapped = mapParagraph(el, rels);
      if (mapped.type === 'li') {
        listItems.push(mapped.html);
      } else {
        flushList();
        if (mapped.type === 'block') blocks.push(mapped.html);
        else skipped++;
      }
      continue;
    }

    // bookmarkStart/End and friends are structural noise, not content.
    if (['bookmarkStart', 'bookmarkEnd', 'proofErr'].includes(el.localName)) continue;
    skipped++;
  }
  flushList();

  // Blank line before each section heading for readability.
  const html = blocks.map((b, i) => (i > 0 && b.startsWith('<h2>') ? `\n${b}` : b)).join('\n');
  return { html, skipped };
}
