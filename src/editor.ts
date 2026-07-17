/** CodeMirror 6 HTML editor with a debounced change callback. */
import { EditorView, basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';

export interface Editor {
  view: EditorView;
  getValue(): string;
  setValue(value: string): void;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (value: string) => void,
  debounceMs = 300,
): Editor {
  let timer: number | undefined;
  const view = new EditorView({
    parent,
    doc: initial,
    extensions: [
      basicSetup,
      html(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => onChange(view.state.doc.toString()), debounceMs);
        }
      }),
    ],
  });
  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (value: string) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      onChange(value);
    },
  };
}
