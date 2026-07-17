# CLAUDE.md

Development guide for CV DOCX Studio — a Vite + TypeScript static app that converts a
strict HTML vocabulary into Word .docx files client-side via the `docx` npm package.

## Commands

- `npm run dev` — dev server on :5173
- `npm run check` — typecheck (run after every change; there are no unit tests)
- `npm run build` — production build
- `node scripts/fidelity-check.mjs <generated.docx> [reference.docx]` — structural
  diff of a generated file against a reference DOCX (page setup, heading borders,
  table grids, bullet numbering, tab stops, fonts)

## Architecture

Everything runs in the browser; there is no backend.

```
index.html            app shell (tabs, toolbar, editor/preview panes, prompt dialog)
TEMPLATE-CONTRACT.md  THE spec: the closed HTML vocabulary, written for LLM consumption;
                      bundled into the AI prompt at build time via ?raw import
src/
  main.ts             wiring: tabs ↔ editor ↔ preview ↔ validate ↔ export; localStorage per doc
  editor.ts           CodeMirror 6 HTML editor (debounced onChange)
  preview.ts          iframe srcdoc preview; converts data-tabs/data-widths to flex/grid inline styles
  preview.css         print-like page styling (approximate; the DOCX is ground truth)
  validate.ts         contract validator → readable Issue[] shown under the editor
  prompt-pack.ts      assembles the copy-paste AI prompt (contract + base HTML + JD inputs)
  templates/
    cv.html, cover-letter.html            blank placeholder templates (the "base")
    sample-cv.html, sample-cover-letter.html  fully written example documents
  converter/
    constants.ts      all twip/half-point values transcribed from the reference DOCX
    index.ts          DOMParser → handlers → docx Document → Packer.toBlob
    handlers.ts       one handler per block construct (header table, h2, entry, grid, ul, p)
    inline.ts         inline DOM → TextRun/ExternalHyperlink (whitespace-collapsing atoms)
  importer/
    index.ts          Import DOCX entry: fflate unzip → document.xml + hyperlink rels
    mapper.ts         heuristic inverse of handlers.ts: Word signals → contract HTML
scripts/fidelity-check.mjs
```

The importer is heuristic and best-effort: imported HTML always goes through
`validate.ts`, which reports anything the mapping couldn't classify. The forward
converter remains the ground truth for the vocabulary.

## The one invariant that matters

**TEMPLATE-CONTRACT.md, `validate.ts`, `handlers.ts`, and `preview.css`/`preview.ts`
describe the same vocabulary and must not drift.** Adding or changing a construct means
touching all four:

1. `converter/handlers.ts` — add the docx recipe + a dispatch rule in `RULES`
2. `validate.ts` — accept the construct and validate its attributes
3. `TEMPLATE-CONTRACT.md` — document it with a worked example (the LLM only knows what
   this file says)
4. `preview.css` / `preview.ts` — mirror it visually (approximation is fine)

## DOCX styling conventions

- All measurements are **twips** (1440/inch) or half-points, transcribed from the
  reference document into `converter/constants.ts`. Never invent values; extract them
  from a real DOCX (`unzip file.docx`, read `word/document.xml` / `styles.xml` /
  `numbering.xml`).
- Page: US Letter, 0.5" margins → printable width **10800 twips**. Calibri 11pt.
- Word quirk baked into the converter: paragraphs inside tables get
  `TABLE_SPACING` (after=0, line=240) because the reference's tables use the TableGrid
  style, which single-spaces its paragraphs. Body paragraphs use spacing after=0 with
  the default line (259).
- Entry lines use real Word tab stops (`data-tabs`, e.g. `4140,10800:right`), not
  spaces or table cells. A trailing `:right` stop right-aligns the last part.
- After converter changes, verify with the fidelity script; regenerate a DOCX from the
  running app (`convertToBase64` is importable in the browser console via
  `import('/src/converter/index.ts')`).

## Preview pane

The preview is a sandboxed iframe (`allow-same-origin`, **no scripts**) whose content
is post-processed by `preview.ts`: `data-widths` → `grid-template-columns`,
`data-tabs` → flex spans with min-widths at the tab positions. It approximates Word;
don't chase pixel equality there — chase it in the DOCX.

## Gotchas

- `?raw` imports (templates, contract, preview.css) are Vite features; keep
  `types: ["vite/client"]` in tsconfig.
- `validate.ts` must stay dependency-free from the converter (it runs on every
  keystroke) but must agree with it — when in doubt, the converter's dispatch rules in
  `handlers.ts` are the source of truth for what renders.
- User content is escaped before any `innerHTML` in `main.ts`; keep it that way.
- Sample templates contain the repo owner's real CV data — that's intentional (they use
  the app for themselves); placeholder templates are what new users start from.
