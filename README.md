# CV DOCX Studio

Author your CV and cover letter as strict semantic HTML, preview them live in the
browser, and export a pixel-faithful Word **.docx** — fully client-side. No server,
no accounts, no API keys.

Built for an **AI-first workflow**: one click assembles a complete prompt (template
contract + your document + the job description) for Claude or any chat LLM; paste the
returned HTML back and export a perfectly styled, tailored DOCX.

## Setup

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/aq-doan/html-to-docx-cv.git
cd html-to-docx-cv
npm install
npm run dev        # → http://localhost:3000
```

## Usage

1. **Pick a tab** — CV or Cover Letter. Each is edited and saved (localStorage)
   independently.
2. **Start writing** — the editor opens with a placeholder template
   (`Your Name`, `Company Name`, …). Replace the placeholders with your details,
   click **Load sample** to see a fully written example document first, or click
   **Import DOCX** to start from an existing Word CV (see below).
3. **Watch the preview** — the right pane renders an approximate print view as you
   type. The DOCX export is the ground truth; the preview is for orientation.
4. **Fix validation issues** — the bar under the editor checks every change against
   the template contract and lists exactly what's wrong (unknown tags, bad tab stops,
   inline CSS, …).
5. **Download DOCX** — exports a Word file named after the `<h1>` in your document
   (e.g. `Jane Doe_CV.docx`).

Buttons: **Load sample** replaces the editor with the example document;
**Reset template** restores the blank placeholder template.

### Importing an existing Word CV

Click **Import DOCX** and pick a `.docx` file. The app transcribes it into the
template vocabulary — entirely in the browser, nothing is uploaded — and replaces the
active tab's content (you are asked to confirm first). Word structures are recognised
by the same signals the exporter emits: headings with bottom borders become `<h2>`,
tab-stop lines become `<p class="entry" data-tabs="…">`, bulleted lists become
`<ul>`, borderless multi-column tables become skill grids, and the two-column name
block becomes the header.

The mapping is heuristic and best-effort:

- The validation bar reports anything that couldn't be classified — review it and fix
  by hand before exporting.
- Blocks with no equivalent in the vocabulary (images, decorated tables, …) are
  skipped; the status bar tells you how many.
- A round trip (Download DOCX → Import DOCX) of a contract-clean document is lossless.

Importing is the natural entry point for the AI workflow: import your current CV,
then use **Copy AI Prompt** to tailor it to a job description.

### Tailoring with AI

1. Click **Copy AI Prompt**, paste the job description (and optionally the job ad URL,
   company site, notes), then **Copy prompt**.
2. Paste the prompt into Claude (or any chat LLM). It replies with a single fenced
   `html` block.
3. Paste that HTML back into the editor. The validator flags any contract violations;
   the prompt forbids the model from inventing facts — it may only reweight, reorder,
   and reword your real content.
4. **Download DOCX.**

### Writing documents by hand

The editor accepts only the constructs defined in
[TEMPLATE-CONTRACT.md](TEMPLATE-CONTRACT.md) — headings with rules (`<h2>`),
tab-stop entry lines (`<p class="entry" data-tabs="…">`), multi-column skill grids
(`<div class="grid" data-widths="…">`), bullets, and a small set of paragraph and
inline styles. Read the contract once; the validator catches everything else.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | start the dev server |
| `npm run build` | production build to `dist/` |
| `npm run check` | TypeScript typecheck |
| `node scripts/fidelity-check.mjs <file.docx> [reference.docx]` | compare a generated DOCX's styling (page setup, borders, tables, numbering, fonts) against a reference document |

## License

MIT — see [LICENSE](LICENSE).
