/**
 * HTML (template vocabulary) → DOCX, fully client-side.
 * Parses with DOMParser, maps constructs via handlers, packs with docx.
 */
import {
  AlignmentType,
  Document,
  LevelFormat,
  LineRuleType,
  Packer,
  UnderlineType,
} from 'docx';
import { DEFAULT_SPACING, FONT, HYPERLINK_COLOR, LIST, PAGE, SIZE } from './constants';
import { convertElement, type Block } from './handlers';

export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  for (const el of doc.body.children) {
    blocks.push(...convertElement(el));
  }
  return blocks;
}

export function buildDocument(html: string): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT.BODY, size: SIZE.BODY },
          paragraph: {
            spacing: {
              after: DEFAULT_SPACING.AFTER,
              line: DEFAULT_SPACING.LINE,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
        hyperlink: {
          run: {
            color: HYPERLINK_COLOR,
            underline: { type: UnderlineType.SINGLE },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'ListParagraph',
          name: 'List Paragraph',
          basedOn: 'Normal',
          quickFormat: true,
          paragraph: {
            indent: { left: LIST.NUM_LEFT },
            contextualSpacing: true,
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'cv-bullet',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: LIST.BULLET_CHAR,
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: FONT.BULLET },
                paragraph: {
                  indent: { left: LIST.NUM_LEFT, hanging: LIST.NUM_HANGING },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.WIDTH, height: PAGE.HEIGHT },
            margin: {
              top: PAGE.MARGIN,
              right: PAGE.MARGIN,
              bottom: PAGE.MARGIN,
              left: PAGE.MARGIN,
              header: PAGE.MARGIN,
              footer: PAGE.MARGIN,
              gutter: 0,
            },
          },
        },
        children: htmlToBlocks(html),
      },
    ],
  });
}

export async function convertToBlob(html: string): Promise<Blob> {
  return Packer.toBlob(buildDocument(html));
}

export async function convertToBase64(html: string): Promise<string> {
  return Packer.toBase64String(buildDocument(html));
}

/** Trigger a browser download of the generated .docx. */
export async function downloadDocx(html: string, filename: string): Promise<void> {
  const blob = await convertToBlob(html);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
