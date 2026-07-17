# CV/Cover-Letter HTML Template Contract

This document defines the **complete, closed vocabulary** of HTML constructs that the
converter maps to a pixel-exact Word (.docx) document. Any HTML you produce **must use
only these constructs** — nothing else renders, and the validator flags violations.

## Global rules

1. Emit **only** the elements, classes, and `data-*` attributes listed below. No `<div>`
   soup, no other tags, no other classes.
2. **Never** use inline `style="…"` attributes, `<style>` blocks, or `<script>`. All
   styling comes from the construct itself.
3. The document is a flat sequence of top-level blocks (no wrapper element). Order is
   free: sections can be reordered, added, or removed.
4. Measurements in `data-*` attributes are **twips** (1440 twips = 1 inch). The printable
   line width is **10800** twips (US Letter, 0.5" margins).
5. Escape `&` as `&amp;` and `<` as `&lt;` in text.

## Block constructs

### Document header — `<header class="cv-header">`

Exactly one, at the top. Renders as a two-column borderless table: 28pt name on the
left, right-aligned contact lines on the right.

```html
<header class="cv-header">
  <h1>Full Name</h1>
  <div class="contact">
    <p>+61 400 000 000</p>
    <p><a href="mailto:me@example.com">me@example.com</a></p>
    <p><a href="https://linkedin.com/in/…">https://linkedin.com/in/…</a></p>
    <p>City, State Postcode</p>
  </div>
</header>
```

Keep the contact block **verbatim from the base document** — never invent or alter
contact details.

### Section heading — `<h2>`

Bold 12pt CAPS with a thin full-width rule underneath (Word paragraph bottom border).

```html
<h2>EXPERIENCE</h2>
```

### Entry line — `<p class="entry" data-tabs="…">`

One bold line whose parts are separated by Word tab stops — used for
role / employer / dates lines and project-title / client lines.

- `data-tabs` is a comma-separated list of tab stops. Each stop is `position` or
  `position:right` (right-aligned stop). Positions are twips from the left margin.
- The paragraph must contain exactly **one more `<span>` than there are tab stops**
  (N stops separate N+1 spans).
- Use `10800:right` as the final stop when the last part (dates, client name) should be
  flush with the right margin.

```html
<p class="entry" data-tabs="4140,10800:right"><span>Role Title</span><span>Employer</span><span>May 2024 – Present</span></p>
<p class="entry" data-tabs="10800:right"><span>Project Name</span><span>Client</span></p>
```

Without `data-tabs` (and without spans) it is a plain bold label line; wrap the text in
`<u>` for a bold underlined grouping label:

```html
<p class="entry"><u>Intuit Technologies:</u></p>
```

### Bullet list — `<ul>` / `<li>`

Word `List Paragraph` bullets (Symbol • , text indented 0.25"). A leading
`<strong>Label</strong>:` inside an `<li>` renders as a bold lead-in.

```html
<ul>
  <li>Achievement or responsibility written as an outcome.</li>
  <li><strong>Azure</strong>: Logic Apps, App Service, Azure Functions</li>
</ul>
```

### Multi-column skill grid — `<div class="grid" data-widths="…">`

A borderless table whose cells each hold one bullet list. `data-widths` gives the DXA
(twip) width of each column and must have **exactly one width per `<ul>` child**.
Widths should sum to ≈10790–10800.

```html
<div class="grid" data-widths="5400,5390">
  <ul> …first column bullets… </ul>
  <ul> …second column bullets… </ul>
</div>
```

Three columns work the same way, e.g. `data-widths="3651,3857,3282"`.

### Plain paragraphs — `<p>` (and variants)

| Construct | Meaning |
|---|---|
| `<p>…</p>` | normal 11pt paragraph, no space after |
| `<p class="tech-stack">Tech Stack: …</p>` | tech-stack line under a project (same styling, semantic marker) |
| `<p class="right">…</p>` | right-aligned paragraph (e.g. cover-letter date) |
| `<p class="spacer"></p>` | intentionally empty paragraph = one blank line |

### Optional fine-tuning — `data-line`

Any paragraph construct may carry `data-line="240"` to force exact single line spacing
(240 = single, 259 = document default). Omit unless matching a specific original line.

## Inline vocabulary (inside any block)

- `<strong>` / `<b>` — bold
- `<em>` / `<i>` — italic
- `<u>` — underline
- `<a href="…">text</a>` — hyperlink (Word blue #0563C1, underlined). `href` required.
- `<br>` — line break within the same paragraph

Nothing else. No `<img>`, no nested block elements, no `<table>`.

## Output rules for AI-generated documents

1. Return **one fenced ```html code block** containing the full document and nothing else.
2. Use only the constructs above; copy the header contact block from the base document
   **verbatim**.
3. Do not invent employers, dates, projects, certifications, or metrics — only reweight,
   reorder, reword, or omit content from the base document to match the target role.
4. Keep section headings in CAPS. Keep the overall visual language of the base document.
5. Aim for the same total length as the base document (CV: ~2 pages, letter: 1 page).
