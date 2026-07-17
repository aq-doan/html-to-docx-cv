/** App wiring: tabs ↔ editor ↔ preview ↔ validation ↔ export ↔ prompt pack. */
import cvTemplate from './templates/cv.html?raw';
import coverLetterTemplate from './templates/cover-letter.html?raw';
import sampleCv from './templates/sample-cv.html?raw';
import sampleCoverLetter from './templates/sample-cover-letter.html?raw';
import { createEditor, type Editor } from './editor';
import { fitPreview, renderPreview } from './preview';
import { validate } from './validate';
import { downloadDocx } from './converter';
import { importDocx } from './importer';
import { buildPrompt } from './prompt-pack';
import { escapeHtml } from './escape-html';

type DocId = 'cv' | 'cover-letter';

const DOCS: Record<DocId, { label: string; template: string; sample: string; suffix: string }> = {
  cv: { label: 'CV', template: cvTemplate, sample: sampleCv, suffix: 'CV' },
  'cover-letter': { label: 'Cover Letter', template: coverLetterTemplate, sample: sampleCoverLetter, suffix: 'Cover Letter' },
};

/** Download filename from the document's <h1> name, e.g. "Jane Doe_CV.docx". */
function docxFilename(html: string, suffix: string): string {
  const name = new DOMParser().parseFromString(html, 'text/html').querySelector('h1')?.textContent?.trim();
  return `${name ? `${name}_` : ''}${suffix}.docx`;
}

const storageKey = (id: DocId) => `cv-docx-studio:${id}`;
const load = (id: DocId) => localStorage.getItem(storageKey(id)) ?? DOCS[id].template;
const save = (id: DocId, html: string) => localStorage.setItem(storageKey(id), html);

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const preview = $<HTMLIFrameElement>('#preview');
const status = $('#status');
const tabButtons: Record<DocId, HTMLButtonElement> = {
  cv: $('#tab-cv'),
  'cover-letter': $('#tab-cover-letter'),
};

let active: DocId = 'cv';
let editor: Editor;

function refresh(html: string): void {
  save(active, html);
  renderPreview(preview, html);
  const issues = validate(html);
  if (issues.length === 0) {
    status.innerHTML = '<span class="ok">✓ Contract-clean — ready to export.</span>';
  } else {
    status.innerHTML = issues
      .map((i) => `<span class="issue ${i.severity}">${i.severity === 'error' ? '✕' : '⚠'} ${escapeHtml(i.message)}</span>`)
      .join('');
  }
}

/** Confirm replacing the active document's content; `what` completes the sentence. */
function confirmReplace(what: string): boolean {
  return confirm(`Replace the current ${DOCS[active].label} with ${what}? Your edits will be lost.`);
}

function switchTo(id: DocId): void {
  if (editor) save(active, editor.getValue());
  active = id;
  for (const [docId, btn] of Object.entries(tabButtons)) {
    btn.classList.toggle('active', docId === id);
  }
  editor.setValue(load(id));
}

editor = createEditor($('#editor-host'), load(active), refresh);
fitPreview(preview, $('#preview-pane'));
refresh(editor.getValue());

tabButtons.cv.addEventListener('click', () => switchTo('cv'));
tabButtons['cover-letter'].addEventListener('click', () => switchTo('cover-letter'));

$('#btn-download').addEventListener('click', async () => {
  const html = editor.getValue();
  const errors = validate(html).filter((i) => i.severity === 'error');
  if (errors.length > 0 && !confirm(`${errors.length} contract error(s) — unknown constructs are dropped from the export. Download anyway?`)) {
    return;
  }
  await downloadDocx(html, docxFilename(html, DOCS[active].suffix));
});

$('#btn-reset').addEventListener('click', () => {
  if (confirmReplace('the blank placeholder template')) {
    editor.setValue(DOCS[active].template);
  }
});

$('#btn-sample').addEventListener('click', () => {
  if (confirmReplace('the filled-in sample document')) {
    editor.setValue(DOCS[active].sample);
  }
});

const importInput = $<HTMLInputElement>('#import-file');
$('#btn-import').addEventListener('click', () => importInput.click());

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (!file) return;
  if (!confirmReplace(`the imported contents of "${file.name}"`)) {
    return;
  }
  try {
    const { html, skipped } = await importDocx(file);
    editor.setValue(html);
    flashStatus(
      `✓ Imported ${file.name}${skipped > 0 ? ` — ${skipped} block(s) could not be mapped and were skipped` : ''}. Review the validation results below, then use Copy AI Prompt to tailor it.`,
    );
  } catch (err) {
    flashStatus(`✕ Import failed: ${err instanceof Error ? err.message : String(err)}`, true);
  }
});

const dialog = $<HTMLDialogElement>('#prompt-dialog');
$('#btn-prompt').addEventListener('click', () => dialog.showModal());

dialog.addEventListener('close', async () => {
  if (dialog.returnValue !== 'copy') return;
  const prompt = buildPrompt({
    docType: active,
    baseHtml: editor.getValue(),
    jobUrl: $<HTMLInputElement>('#jd-url').value.trim() || undefined,
    jobText: $<HTMLTextAreaElement>('#jd-text').value.trim() || undefined,
    companyUrl: $<HTMLInputElement>('#company-url').value.trim() || undefined,
    notes: $<HTMLTextAreaElement>('#notes').value.trim() || undefined,
  });
  try {
    await navigator.clipboard.writeText(prompt);
    flashStatus(`✓ AI prompt copied to clipboard (${prompt.length.toLocaleString()} chars). Paste it into Claude or any chat LLM.`);
  } catch {
    flashStatus('✕ Clipboard blocked by the browser — prompt not copied. Click the page first, then retry.', true);
  }
});

let flashTimer: number | undefined;

function flashStatus(message: string, isError = false): void {
  status.innerHTML = `<span class="${isError ? 'issue error' : 'ok'}">${escapeHtml(message)}</span>`;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => refresh(editor.getValue()), 4000);
}
