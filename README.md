# CV DOCX Studio

Author your CV and cover letter as strict semantic HTML, preview them live in the
browser, and export a pixel-faithful Word **.docx** — fully client-side. No server,
no accounts, no API keys.

Built for an **AI-first workflow**: import your existing Word CV once, then for every
job application let Claude (or any chat LLM) tailor it — the app assembles the
complete prompt, validates what the AI returns, and exports a perfectly styled DOCX.

## Setup

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/aq-doan/html-to-docx-cv.git
cd html-to-docx-cv
npm install
npm run dev        # → http://localhost:3000
```

## The AI tailoring workflow

This is the main loop the app is built around: keep one base document, and have an
AI produce a tailored version for every job you apply to — without ever fighting
Word formatting by hand.

```
your CV.docx ──1 Import DOCX──▶ editor ──2 Copy AI Prompt──▶ Claude / any chat LLM
                                  ▲      (job URL + description + notes)   │
                                  └────────3 paste tailored HTML back──────┘
                                  4  validate → preview → Download DOCX
```

1. **Import your base Word document** — click **Import DOCX** and pick your current
   CV (or cover letter). The app transcribes it into the template vocabulary
   entirely in the browser; nothing is uploaded. No Word file yet? Start from
   **Load sample** or the blank placeholder template instead.
2. **Build the prompt** — click **Copy AI Prompt** and fill in the job ad URL, the
   pasted job description, the company website, and any notes for the AI. **Copy
   prompt** puts a complete, self-contained prompt on your clipboard: the template
   contract, your current document, and the job details.
3. **Let the AI tailor it** — paste the prompt into Claude or any chat LLM. The
   prompt instructs the model to reorder, reweight, and reword your real content for
   the target role — and forbids inventing employers, roles, dates, or metrics. It
   replies with a single fenced `html` block in the template vocabulary. Paste that
   back into the editor.
4. **Check and export** — the live preview shows the result and the validation bar
   flags anything that broke the contract. **Download DOCX** exports a Word file
   named after the `<h1>` in your document (e.g. `Jane Doe_CV.docx`).

Repeat steps 2–4 for every application; each tab (CV / Cover Letter) is edited and
saved independently in localStorage, so your base documents persist between visits.

## Editor basics

- **Tabs** — CV and Cover Letter are separate documents with separate saved state.
- **Live preview** — the right pane renders an approximate print view as you type.
  The DOCX export is the ground truth; the preview is for orientation.
- **Validation bar** — every change is checked against the template contract, and
  the bar under the editor lists exactly what's wrong (unknown tags, bad tab stops,
  inline CSS, …).
- **Load sample** replaces the editor with a fully written example document;
  **Reset template** restores the blank placeholder.

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
