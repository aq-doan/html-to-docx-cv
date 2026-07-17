/**
 * The single parser for the data-tabs grammar ("4140,10800:right").
 * Shared by the validator, the converter, and the preview so the three cannot
 * drift; deliberately dependency-free (the validator runs on every keystroke
 * and must not pull in the docx package).
 */

export interface TabStop {
  /** Position in twips from the left margin. */
  pos: number;
  align: 'left' | 'right' | 'center';
}

const STOP_RE = /^(\d+)(?::(right|center))?$/;

/** Parse a data-tabs attribute; returns null if any stop is malformed. */
export function parseTabs(attr: string): TabStop[] | null {
  const stops: TabStop[] = [];
  for (const part of attr.split(',')) {
    const m = STOP_RE.exec(part.trim());
    if (!m) return null;
    stops.push({ pos: parseInt(m[1], 10), align: (m[2] as 'right' | 'center' | undefined) ?? 'left' });
  }
  return stops;
}
