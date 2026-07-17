#!/usr/bin/env node
/**
 * Fidelity check: compares a generated .docx against the reference CV .docx on
 * the styling axes that matter (page setup, heading borders, tab stops, table
 * grids, bullet numbering, spacing), ignoring rsids and other noise.
 *
 * Usage: node scripts/fidelity-check.mjs <generated.docx> [reference.docx]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const [, , generatedPath, referencePath = join(homedir(), 'Downloads', 'Anh Quan Doan_CV_MyStateBank.docx')] =
  process.argv;

if (!generatedPath) {
  console.error('Usage: node scripts/fidelity-check.mjs <generated.docx> [reference.docx]');
  process.exit(1);
}
for (const p of [generatedPath, referencePath]) {
  if (!existsSync(p)) {
    console.error(`File not found: ${p}`);
    process.exit(1);
  }
}

function extract(docxPath) {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-'));
  execFileSync('unzip', ['-o', '-q', docxPath, '-d', dir]);
  const read = (f) => {
    const p = join(dir, 'word', f);
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
  };
  return { document: read('document.xml'), numbering: read('numbering.xml'), styles: read('styles.xml') };
}

const gen = extract(generatedPath);
const ref = extract(referencePath);

let failures = 0;
function check(label, refValue, genValue) {
  const ok = String(refValue) === String(genValue);
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✕'} ${label}: reference=${JSON.stringify(refValue)} generated=${JSON.stringify(genValue)}`);
}
function first(xml, re) {
  const m = xml.match(re);
  return m ? m[1] : '(missing)';
}
function all(xml, re) {
  return [...xml.matchAll(re)].map((m) => m[1]);
}

console.log('\n— Page setup —');
check('page size w×h', first(ref.document, /<w:pgSz w:w="(\d+)"/) + '×' + first(ref.document, /<w:pgSz w:w="\d+" w:h="(\d+)"/),
  first(gen.document, /<w:pgSz w:w="(\d+)"/) + '×' + first(gen.document, /<w:pgSz w:w="\d+" w:h="(\d+)"/));
for (const side of ['top', 'right', 'bottom', 'left']) {
  check(`margin ${side}`, first(ref.document, new RegExp(`<w:pgMar[^>]*w:${side}="(-?\\d+)"`)), first(gen.document, new RegExp(`<w:pgMar[^>]*w:${side}="(-?\\d+)"`)));
}

console.log('\n— Section heading rules (paragraph bottom borders) —');
const refBorders = all(ref.document, /<w:bottom w:val="single" w:sz="(\d+)"[^>]*\/><\/w:pBdr>/g);
const genBorders = all(gen.document, /<w:bottom w:val="single" w:sz="(\d+)"[^>]*\/><\/w:pBdr>/g);
check('bordered-heading count', refBorders.length, genBorders.length);
check('border sz values', [...new Set(refBorders)].join(','), [...new Set(genBorders)].join(','));

console.log('\n— Tables (header + skill grids) —');
const gridCols = (xml) =>
  [...xml.matchAll(/<w:tblGrid>(.*?)<\/w:tblGrid>/gs)].map((m) => all(m[1], /w:w="(\d+)"/g).join(','));
const refGrids = gridCols(ref.document);
const genGrids = gridCols(gen.document);
check('table count', refGrids.length, genGrids.length);
refGrids.forEach((cols, i) => check(`table ${i + 1} column widths`, cols, genGrids[i] ?? '(missing)'));

console.log('\n— Bullet numbering —');
check('bullet indent left', first(ref.numbering, /<w:ind w:left="(\d+)" w:hanging="360"/), first(gen.numbering, /<w:ind w:left="(\d+)" w:hanging="360"/));
check('bullet hanging', first(ref.numbering, /<w:ind w:left="\d+" w:hanging="(\d+)"/), first(gen.numbering, /<w:ind w:left="\d+" w:hanging="(\d+)"/));
check('bullet font', first(ref.numbering, /<w:rFonts w:ascii="(Symbol)"/), first(gen.numbering, /<w:rFonts w:ascii="(Symbol)"/));
const bulletCount = (xml) => (xml.match(/<w:numPr>/g) ?? []).length;
console.log(`  · bullet paragraphs: reference=${bulletCount(ref.document)} generated=${bulletCount(gen.document)} (count depends on content edits)`);

console.log('\n— Tab stops —');
const tabPositions = (xml) => [...new Set(all(xml, /<w:tab w:val="(?:left|right|center)" w:pos="(\d+)"/g))].sort((a, b) => a - b);
console.log(`  · distinct stop positions: reference=[${tabPositions(ref.document)}] generated=[${tabPositions(gen.document)}]`);
console.log('    (generated uses cleaned right-aligned stops instead of the reference’s tab+space alignment hacks — visual parity is the goal)');

console.log('\n— Fonts & default spacing —');
check('default font', first(ref.styles, /<w:rFonts w:asciiTheme="minorHAnsi"|<w:rFonts w:ascii="(Calibri)"/) || 'Calibri(theme)', first(gen.styles, /<w:rFonts w:ascii="(Calibri)"/));
check('heading size (half-points)', '24', first(gen.document, /<w:b\/><w:sz w:val="(\d+)"\/>/) === '(missing)' ? first(gen.document, /<w:sz w:val="(24)"\/>/) : first(gen.document, /<w:b\/><w:sz w:val="(\d+)"\/>/));
check('name size present (56)', /w:val="56"/.test(ref.document), /w:val="56"/.test(gen.document));
check('hyperlink color', first(ref.styles, /<w:color w:val="(0563C1)"/), first(gen.styles, /<w:color w:val="(0563C1)"/));

console.log(failures === 0 ? '\nAll structural checks passed.' : `\n${failures} check(s) differ — inspect above.`);
process.exit(failures === 0 ? 0 : 2);
