/**
 * Inline content → docx runs.
 * Supported inline vocabulary: text, <strong>/<b>, <em>/<i>, <u>, <a href>, <br>.
 *
 * Strategy: flatten the DOM into styled text "atoms" first (so HTML whitespace
 * can be collapsed and edge-trimmed across element boundaries, the way a
 * browser renders it), then construct docx runs.
 */
import { ExternalHyperlink, TextRun, UnderlineType } from 'docx';

export interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  /** Half-points; omitted → document default (22 = 11pt). */
  size?: number;
}

interface Atom {
  kind: 'text' | 'break';
  text: string;
  style: RunStyle;
  /** Present when the atom sits inside <a href>. */
  link?: string;
}

type InlineChild = TextRun | ExternalHyperlink;

function collectAtoms(node: Node, style: RunStyle, link: string | undefined, out: Atom[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ');
    if (text !== '') out.push({ kind: 'text', text, style, link });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      style = { ...style, bold: true };
      break;
    case 'EM':
    case 'I':
      style = { ...style, italics: true };
      break;
    case 'U':
      style = { ...style, underline: true };
      break;
    case 'A':
      link = el.getAttribute('href') ?? '';
      break;
    case 'BR':
      out.push({ kind: 'break', text: '', style, link });
      return;
    default:
      // Unknown inline element: descend anyway (the validator reports it).
      break;
  }
  for (const child of el.childNodes) collectAtoms(child, style, link, out);
}

/**
 * Boundary half of browser-style whitespace normalization (collectAtoms
 * already collapses runs within a text node): trim the sequence edges, and
 * collapse whitespace that straddles atom boundaries (e.g.
 * "<strong>foo </strong> bar" is one space, not two) or follows a <br>.
 */
function normalizeAtoms(atoms: Atom[]): Atom[] {
  const result: Atom[] = [];
  let prevEndsInSpace = true; // sequence start counts as a boundary → leading trim
  for (const atom of atoms) {
    if (atom.kind === 'break') {
      result.push(atom);
      prevEndsInSpace = true;
      continue;
    }
    const text = prevEndsInSpace ? atom.text.replace(/^\s+/, '') : atom.text;
    if (text === '') continue; // all-whitespace atom: the boundary space carries over
    prevEndsInSpace = /\s$/.test(text);
    result.push({ ...atom, text });
  }
  for (let i = result.length - 1; i >= 0; i--) {
    const a = result[i];
    if (a.kind !== 'text') continue;
    a.text = a.text.replace(/\s+$/, '');
    if (a.text !== '') break;
    result.splice(i, 1);
  }
  return result;
}

function makeRun(atom: Atom): TextRun {
  if (atom.kind === 'break') return new TextRun({ break: 1 });
  return new TextRun({
    text: atom.text,
    bold: atom.style.bold || undefined,
    italics: atom.style.italics || undefined,
    underline: atom.style.underline ? { type: UnderlineType.SINGLE } : undefined,
    size: atom.style.size,
    // Hyperlink character style (blue + underline) comes from the document styles.
    style: atom.link !== undefined ? 'Hyperlink' : undefined,
  });
}

/**
 * Convert an element's inline children to docx runs.
 * Consecutive atoms sharing the same link collapse into one ExternalHyperlink.
 */
export function inlineRuns(el: Element, style: RunStyle = {}): InlineChild[] {
  const atoms: Atom[] = [];
  for (const child of el.childNodes) collectAtoms(child, style, undefined, atoms);

  const out: InlineChild[] = [];
  let pendingLink: { href: string; runs: TextRun[] } | null = null;

  const flushLink = () => {
    if (pendingLink) {
      out.push(new ExternalHyperlink({ link: pendingLink.href, children: pendingLink.runs }));
      pendingLink = null;
    }
  };

  for (const atom of normalizeAtoms(atoms)) {
    if (atom.link !== undefined) {
      if (!pendingLink || pendingLink.href !== atom.link) {
        flushLink();
        pendingLink = { href: atom.link, runs: [] };
      }
      pendingLink.runs.push(makeRun(atom));
    } else {
      flushLink();
      out.push(makeRun(atom));
    }
  }
  flushLink();
  return out;
}
