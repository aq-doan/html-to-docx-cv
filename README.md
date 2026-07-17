# CV DOCX Studio

Author your CV and cover letter as strict semantic HTML, preview them live, and export
a Word .docx that matches the reference document's styling exactly — fully client-side,
no server, no API keys.

## Run

```bash
npm install
npm run dev        # → http://localhost:5173
```

Other scripts: `npm run check` (typecheck), `npm run build`,
`node scripts/fidelity-check.mjs <generated.docx> [reference.docx]`.

## How it works

- **Editor (left)** — the document as HTML in the template vocabulary defined by
  [TEMPLATE-CONTRACT.md](TEMPLATE-CONTRACT.md). Saved to localStorage per document tab.
- **Preview (right)** — approximate print preview. The DOCX export is the ground truth
  (tab stops are simulated with flex in the preview).
- **Validation (below the editor)** — every change is checked against the contract;
  errors list exactly what an LLM (or you) got wrong.
- **Download DOCX** — converts the HTML through a custom mapper to the
  [`docx`](https://docx.js.org) library and downloads the file. All measurements
  (tab stops, table columns, indents, borders) are twips transcribed from the
  reference document (`src/converter/constants.ts`).

## AI tailoring workflow

1. Open the tab you want to tailor (CV or Cover Letter) and click **Copy AI Prompt**.
2. Fill in the job ad URL and/or paste the job description, optionally the company
   site and notes → **Copy prompt**.
3. Paste the prompt into Claude (or any chat LLM). It replies with one fenced
   `html` block.
4. Paste that HTML back into the editor. Fix anything the validator flags
   (usually nothing), check the preview, then **Download DOCX**.

The prompt embeds the full template contract plus your current document, and forbids
the model from inventing facts — it may only reweight, reorder, and reword.

## Extending the vocabulary

A new section format = one new handler in `src/converter/handlers.ts`, a matching rule
in `src/validate.ts`, a section in `TEMPLATE-CONTRACT.md`, and (optionally) preview CSS.

## Fidelity check

```bash
node scripts/fidelity-check.mjs ~/Downloads/generated.docx
```

Compares page setup, heading borders, table grids, bullet numbering, tab stops, fonts,
and hyperlink styling against the reference CV
(`~/Downloads/Anh Quan Doan_CV_MyStateBank.docx` by default).
