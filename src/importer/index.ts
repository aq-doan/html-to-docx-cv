/**
 * DOCX → contract HTML import, fully client-side.
 * Unzips the .docx with fflate, parses word/document.xml (+ hyperlink rels)
 * with DOMParser in XML mode, and maps blocks via mapper.ts.
 */
import { unzipSync } from 'fflate';
import { mapDocument, type ImportResult, type RelMap } from './mapper';

export type { ImportResult } from './mapper';

function parseXml(source: string, what: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`Could not parse ${what} — the file may be corrupted.`);
  }
  return doc;
}

export async function importDocx(file: File): Promise<ImportResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(`"${file.name}" is not a valid .docx file (not a zip archive).`);
  }

  const documentXml = entries['word/document.xml'];
  if (!documentXml) {
    throw new Error(`"${file.name}" contains no word/document.xml — not a Word document.`);
  }

  const decoder = new TextDecoder();
  const doc = parseXml(decoder.decode(documentXml), 'word/document.xml');

  const rels: RelMap = new Map();
  const relsXml = entries['word/_rels/document.xml.rels'];
  if (relsXml) {
    const relsDoc = parseXml(decoder.decode(relsXml), 'document.xml.rels');
    for (const rel of relsDoc.getElementsByTagName('Relationship')) {
      const type = rel.getAttribute('Type') ?? '';
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (type.endsWith('/hyperlink') && id && target) rels.set(id, target);
    }
  }

  const body = [...doc.documentElement.children].find((c) => c.localName === 'body');
  if (!body) {
    throw new Error(`"${file.name}" has no document body.`);
  }
  return mapDocument(body, rels);
}
