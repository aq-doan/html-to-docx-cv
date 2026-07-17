/**
 * Styling constants transcribed from the reference DOCX
 * (Anh Quan Doan_CV_MyStateBank.docx — word/document.xml, styles.xml, numbering.xml).
 * All positions/widths in twips (1440/inch), font sizes in half-points.
 */

export const PAGE = {
  WIDTH: 12240, // US Letter 8.5in
  HEIGHT: 15840, // 11in
  MARGIN: 720, // 0.5in on all sides (header/footer too)
} as const;

/** Printable width between margins: 12240 - 2*720 */
export const CONTENT_WIDTH = PAGE.WIDTH - 2 * PAGE.MARGIN; // 10800

export const FONT = {
  BODY: 'Calibri',
  BULLET: 'Symbol',
} as const;

export const SIZE = {
  NAME: 56, // 28pt
  HEADING: 24, // 12pt
  BODY: 22, // 11pt
} as const;

/** Word docDefaults from the reference: spacing after 160, line 259 auto. */
export const DEFAULT_SPACING = { AFTER: 160, LINE: 259 } as const;

/** Section heading underline rule: <w:bottom w:val="single" w:sz="4" w:space="1"/> */
export const HEADING_BORDER = { SIZE: 4, SPACE: 1 } as const;

/** Header layout: 2-col borderless table, 5395/5395, cell margins 0. */
export const HEADER_COLS = [5395, 5395] as const;

/** Bullet list geometry (numbering.xml abstract level 0 + paragraph override). */
export const LIST = {
  NUM_LEFT: 720, // numbering-level indent
  NUM_HANGING: 360,
  PARA_LEFT: 360, // paragraph-level override → bullet at 0, text at 0.25in
  BULLET_CHAR: '', // Symbol-font bullet
} as const;

export const HYPERLINK_COLOR = '0563C1';
