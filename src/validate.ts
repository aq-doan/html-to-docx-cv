/**
 * Contract validator — checks editor HTML against TEMPLATE-CONTRACT.md so that
 * LLM-generated documents fail loudly (readable issues) instead of silently
 * dropping content in the DOCX export.
 */

import { parseTabs } from './tabs';

export interface Issue {
  severity: 'error' | 'warning';
  message: string;
}

const P_CLASSES = new Set(['entry', 'tech-stack', 'spacer', 'right']);
const INLINE_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'A', 'BR', 'SPAN']);

function describe(el: Element): string {
  const cls = el.getAttribute('class');
  const text = (el.textContent ?? '').trim().slice(0, 40);
  return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}>${text ? ` "${text}…"` : ''}`;
}

function checkInline(el: Element, issues: Issue[], allowSpan: boolean): void {
  for (const child of el.querySelectorAll('*')) {
    const tag = child.tagName;
    if (!INLINE_TAGS.has(tag)) {
      issues.push({ severity: 'error', message: `Unknown inline element ${describe(child)} inside ${describe(el)} — allowed: strong, em, u, a, br.` });
    }
    if (tag === 'SPAN' && !allowSpan) {
      issues.push({ severity: 'error', message: `<span> is only allowed inside <p class="entry" data-tabs>; found in ${describe(el)}.` });
    }
    if (tag === 'A' && !child.getAttribute('href')) {
      issues.push({ severity: 'error', message: `<a> without href in ${describe(el)}.` });
    }
  }
}

function checkNoStyle(root: Element | Document, issues: Issue[]): void {
  for (const el of root.querySelectorAll('[style]')) {
    issues.push({ severity: 'error', message: `Inline style attribute on ${describe(el)} — the contract forbids inline CSS.` });
  }
  for (const el of root.querySelectorAll('style, script, img, table, iframe')) {
    issues.push({ severity: 'error', message: `Forbidden element ${describe(el)} — not part of the template vocabulary.` });
  }
}

function validateEntry(el: Element, issues: Issue[]): void {
  const tabsAttr = el.getAttribute('data-tabs');
  const spans = [...el.children].filter((c) => c.tagName === 'SPAN');
  if (tabsAttr) {
    const stops = parseTabs(tabsAttr);
    if (!stops) {
      issues.push({ severity: 'error', message: `Malformed data-tabs="${tabsAttr}" on ${describe(el)} — expected e.g. "4140,10800:right" (twips).` });
      return;
    }
    if (spans.length !== stops.length + 1) {
      issues.push({ severity: 'error', message: `${describe(el)} has ${stops.length} tab stop(s) but ${spans.length} <span>(s) — need exactly ${stops.length + 1} spans (N stops separate N+1 parts).` });
    }
    for (const stop of stops) {
      if (stop.pos > 10800) issues.push({ severity: 'warning', message: `Tab stop ${stop.pos} on ${describe(el)} is beyond the 10800-twip printable width.` });
    }
  } else if (spans.length > 1) {
    issues.push({ severity: 'error', message: `${describe(el)} has multiple <span>s but no data-tabs attribute.` });
  }
  checkInline(el, issues, true);
}

function validateGrid(el: Element, issues: Issue[]): void {
  const children = [...el.children];
  const uls = children.filter((c) => c.tagName === 'UL');
  const others = children.filter((c) => c.tagName !== 'UL');
  for (const o of others) {
    issues.push({ severity: 'error', message: `${describe(el)} may only contain <ul> columns; found ${describe(o)}.` });
  }
  if (uls.length === 0) {
    issues.push({ severity: 'error', message: `${describe(el)} has no <ul> columns.` });
  }
  const widthsAttr = el.getAttribute('data-widths');
  if (widthsAttr) {
    const widths = widthsAttr.split(',').map((w) => parseInt(w.trim(), 10));
    if (widths.some((w) => !Number.isFinite(w) || w <= 0)) {
      issues.push({ severity: 'error', message: `Malformed data-widths="${widthsAttr}" on ${describe(el)} — comma-separated twip widths, e.g. "5400,5390".` });
    } else {
      if (widths.length !== uls.length) {
        issues.push({ severity: 'error', message: `${describe(el)} declares ${widths.length} column width(s) but has ${uls.length} <ul> column(s).` });
      }
      const total = widths.reduce((a, b) => a + b, 0);
      if (total > 10800) issues.push({ severity: 'warning', message: `Column widths on ${describe(el)} sum to ${total} twips — wider than the 10800 printable width.` });
    }
  } else {
    issues.push({ severity: 'warning', message: `${describe(el)} has no data-widths — columns default to equal widths.` });
  }
  for (const ul of uls) validateUl(ul, issues);
}

function validateUl(el: Element, issues: Issue[]): void {
  for (const child of el.children) {
    if (child.tagName !== 'LI') {
      issues.push({ severity: 'error', message: `Only <li> allowed inside <ul>; found ${describe(child)}.` });
    } else {
      checkInline(child, issues, false);
    }
  }
}

function validateHeader(el: Element, issues: Issue[]): void {
  if (!el.querySelector('h1')) {
    issues.push({ severity: 'error', message: `<header class="cv-header"> is missing its <h1> name.` });
  }
  const contact = el.querySelector('.contact');
  if (!contact) {
    issues.push({ severity: 'error', message: `<header class="cv-header"> is missing <div class="contact"> with <p> lines.` });
  } else if (!contact.querySelector('p')) {
    issues.push({ severity: 'error', message: `<div class="contact"> has no <p> contact lines.` });
  }
}

/** Validate a full document's HTML; returns readable issues (empty = contract-clean). */
export function validate(html: string): Issue[] {
  const issues: Issue[] = [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  checkNoStyle(doc, issues);

  const top = [...doc.body.children];
  if (top.length === 0) {
    issues.push({ severity: 'error', message: 'Document is empty.' });
    return issues;
  }

  let headers = 0;
  for (const el of top) {
    const tag = el.tagName;
    if (tag === 'HEADER' && el.classList.contains('cv-header')) {
      headers++;
      validateHeader(el, issues);
    } else if (tag === 'H2') {
      checkInline(el, issues, false);
    } else if (tag === 'P') {
      const unknown = [...el.classList].filter((c) => !P_CLASSES.has(c));
      for (const c of unknown) {
        issues.push({ severity: 'error', message: `Unknown class "${c}" on ${describe(el)} — allowed: entry, tech-stack, spacer, right.` });
      }
      if (el.classList.contains('entry')) validateEntry(el, issues);
      else checkInline(el, issues, false);
    } else if (tag === 'DIV' && el.classList.contains('grid')) {
      validateGrid(el, issues);
    } else if (tag === 'UL') {
      validateUl(el, issues);
    } else {
      issues.push({ severity: 'error', message: `Unknown top-level element ${describe(el)} — see TEMPLATE-CONTRACT.md for the allowed constructs.` });
    }
  }
  if (headers === 0) issues.push({ severity: 'warning', message: 'No <header class="cv-header"> found — the document will have no name/contact block.' });
  if (headers > 1) issues.push({ severity: 'error', message: 'Multiple <header class="cv-header"> blocks — only one is allowed.' });

  return issues;
}
