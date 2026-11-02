import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
export default function StudioCodeEditor({
  language,
  value,
  onChange,
}: {
  language: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const extensions =
    language === 'css'
      ? [css()]
      : language === 'python'
        ? [python()]
        : language === 'html'
          ? [html()]
          : language === 'javascript' || language === 'typescript'
            ? [javascript({ typescript: language === 'typescript' })]
            : [];
  return (
    <CodeMirror
      aria-label="Practice code editor"
      value={value}
      height="280px"
      extensions={extensions}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: true, tabSize: 2 }}
    />
  );
}
