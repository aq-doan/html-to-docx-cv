/**
 * Block-level construct handlers: one function per template-vocabulary construct.
 * Each returns docx block children (Paragraphs/Tables) for one HTML element.
 *
 * Adding a new section format = add a handler here, register it in HANDLERS,
 * document it in TEMPLATE-CONTRACT.md, and (optionally) mirror it in preview.css.
 */
import {
  AlignmentType,
  BorderStyle,
  LineRuleType,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  type ISpacingProperties,
  type ParagraphChild,
} from 'docx';
import { CONTENT_WIDTH, HEADER_COLS, HEADING_BORDER, LIST, SIZE, TABLE_SPACING } from './constants';
import { inlineRuns } from './inline';

export type Block = Paragraph | Table;

/** spacing after=0; optional exact line via data-line (e.g. 240 = single). */
function tightSpacing(el: Element): ISpacingProperties {
  const spacing: { after: number; line?: number; lineRule?: (typeof LineRuleType)[keyof typeof LineRuleType] } = {
    after: 0,
  };
  const line = el.getAttribute('data-line');
  if (line && /^\d+$/.test(line)) {
    spacing.line = parseInt(line, 10);
    spacing.lineRule = LineRuleType.AUTO;
  }
  return spacing;
}

export interface TabSpec {
  position: number;
  type: (typeof TabStopType)[keyof typeof TabStopType];
}

/** Parse data-tabs="4230,10800:right" → tab stop specs. */
export function parseTabs(attr: string): TabSpec[] {
  return attr
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [pos, align] = part.split(':');
      const type =
        align === 'right' ? TabStopType.RIGHT : align === 'center' ? TabStopType.CENTER : TabStopType.LEFT;
      return { position: parseInt(pos, 10), type };
    });
}

/** <header class="cv-header"> → 2-col borderless table: 28pt name | right-aligned contacts. */
function handleHeader(el: Element): Block[] {
  const h1 = el.querySelector('h1');
  const contactPs = el.querySelectorAll('.contact p');

  // Table paragraphs take the TableGrid-style spacing (after 0, single line).
  const tableSpacing = { after: TABLE_SPACING.AFTER, line: TABLE_SPACING.LINE, lineRule: LineRuleType.AUTO };

  const namePara = new Paragraph({
    children: h1 ? inlineRuns(h1, { size: SIZE.NAME }) : [],
    spacing: tableSpacing,
  });

  const contactParas = [...contactPs].map(
    (p) =>
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: inlineRuns(p),
        spacing: tableSpacing,
      }),
  );

  return [
    new Table({
      borders: TableBorders.NONE,
      width: { size: HEADER_COLS[0] + HEADER_COLS[1], type: WidthType.DXA },
      columnWidths: [...HEADER_COLS],
      margins: { left: 0, right: 0 },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: HEADER_COLS[0], type: WidthType.DXA },
              children: [namePara],
            }),
            new TableCell({
              width: { size: HEADER_COLS[1], type: WidthType.DXA },
              children: contactParas,
            }),
          ],
        }),
      ],
    }),
  ];
}

/** <h2> → bold 12pt with single sz-4 bottom border (the section rule). */
function handleH2(el: Element): Block[] {
  return [
    new Paragraph({
      children: inlineRuns(el, { bold: true, size: SIZE.HEADING }),
      spacing: tightSpacing(el),
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: HEADING_BORDER.SIZE,
          space: HEADING_BORDER.SPACE,
          color: 'auto',
        },
      },
    }),
  ];
}

/**
 * <p class="entry" data-tabs="4230,10800:right"> with N+1 <span> children →
 * one bold paragraph whose spans are separated by tab characters at the given stops.
 * Without data-tabs: a plain bold line (e.g. a grouping label).
 */
function handleEntry(el: Element): Block[] {
  const tabsAttr = el.getAttribute('data-tabs');
  const spans = [...el.children].filter((c) => c.tagName === 'SPAN');

  if (!tabsAttr || spans.length === 0) {
    return [
      new Paragraph({
        children: inlineRuns(el, { bold: true }),
        spacing: tightSpacing(el),
      }),
    ];
  }

  const tabs = parseTabs(tabsAttr);
  const children: ParagraphChild[] = [];
  spans.forEach((span, i) => {
    if (i > 0) children.push(new TextRun({ children: ['\t'] }));
    children.push(...inlineRuns(span, { bold: true }));
  });

  return [
    new Paragraph({
      tabStops: tabs.map((t) => ({ type: t.type, position: t.position })),
      children,
      spacing: tightSpacing(el),
    }),
  ];
}

/** <li> → ListParagraph bullet (Symbol •, text at 0.25in, spacing after 0). */
function bulletParagraph(li: Element, listEl: Element, inTable = false): Paragraph {
  return new Paragraph({
    style: 'ListParagraph',
    numbering: { reference: 'cv-bullet', level: 0 },
    indent: { left: LIST.PARA_LEFT },
    spacing: inTable
      ? { after: TABLE_SPACING.AFTER, line: TABLE_SPACING.LINE, lineRule: LineRuleType.AUTO }
      : tightSpacing(listEl),
    children: inlineRuns(li),
  });
}

/** <ul> → sequence of bullet paragraphs. */
function handleUl(el: Element, inTable = false): Block[] {
  return [...el.children].filter((c) => c.tagName === 'LI').map((li) => bulletParagraph(li, el, inTable));
}

/**
 * <div class="grid" data-widths="5400,5390"> with one <ul> per column →
 * borderless fixed-width table, each cell holding that column's bullets.
 */
function handleGrid(el: Element): Block[] {
  const uls = [...el.children].filter((c) => c.tagName === 'UL');
  const widthsAttr = el.getAttribute('data-widths');
  let widths: number[];
  if (widthsAttr) {
    widths = widthsAttr.split(',').map((w) => parseInt(w.trim(), 10));
  } else {
    const per = Math.floor(CONTENT_WIDTH / Math.max(uls.length, 1));
    widths = uls.map(() => per);
  }

  return [
    new Table({
      borders: TableBorders.NONE,
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: widths,
      margins: { left: 0, right: 0 },
      rows: [
        new TableRow({
          children: uls.map(
            (ul, i) =>
              new TableCell({
                width: { size: widths[i] ?? widths[widths.length - 1], type: WidthType.DXA },
                children: handleUl(ul, true) as Paragraph[],
              }),
          ),
        }),
      ],
    }),
  ];
}

/** <p> (plain, .tech-stack, .spacer, .right) → normal tight paragraph. */
function handleP(el: Element): Block[] {
  const cls = el.classList;
  return [
    new Paragraph({
      children: cls.contains('spacer') ? [] : inlineRuns(el),
      alignment: cls.contains('right') ? AlignmentType.RIGHT : undefined,
      spacing: tightSpacing(el),
    }),
  ];
}

type Handler = (el: Element) => Block[];

/** Dispatch: first matching rule wins. */
const RULES: Array<{ match: (el: Element) => boolean; handle: Handler }> = [
  { match: (el) => el.tagName === 'HEADER' && el.classList.contains('cv-header'), handle: handleHeader },
  { match: (el) => el.tagName === 'H2', handle: handleH2 },
  { match: (el) => el.tagName === 'P' && el.classList.contains('entry'), handle: handleEntry },
  { match: (el) => el.tagName === 'DIV' && el.classList.contains('grid'), handle: handleGrid },
  { match: (el) => el.tagName === 'UL', handle: handleUl },
  { match: (el) => el.tagName === 'P', handle: handleP },
];

/** Convert one top-level element; unknown elements yield no output (validator reports them). */
export function convertElement(el: Element): Block[] {
  for (const rule of RULES) {
    if (rule.match(el)) return rule.handle(el);
  }
  return [];
}
