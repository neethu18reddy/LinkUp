import { Fragment, type ReactNode } from 'react';

// A deliberately small text formatter: provider output never becomes raw HTML.
function inline(text: string): ReactNode {
  return text
    .split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)
    .map((part, index) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code key={index}>{part.slice(1, -1)}</code>
      ) : part.startsWith('**') && part.endsWith('**') ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

export function MentorMessage({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split('\n');
  for (let index = 0; index < lines.length;) {
    const line = lines[index]!;
    const key = index;
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index]!.startsWith('```')) code.push(lines[index++]!);
      if (index < lines.length) index++;
      blocks.push(
        <div className="mentor-code" key={key}>
          <span>{language || 'Code'}</span>
          <pre>
            <code>{code.join('\n')}</code>
          </pre>
        </div>,
      );
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push(<h3 key={key}>{inline(line.replace(/^#{1,6}\s+/, ''))}</h3>);
      index++;
    } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      const items: ReactNode[] = [];
      while (index < lines.length && pattern.test(lines[index]!)) {
        items.push(<li key={index}>{inline(lines[index++]!.replace(pattern, ''))}</li>);
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    } else {
      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index]!.trim() &&
        !/^(?:```|#{1,6}\s|\s*(?:[-*]|\d+\.)\s)/.test(lines[index]!)
      )
        paragraph.push(lines[index++]!);
      if (paragraph.length) blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
      else index++;
    }
  }
  return <div className="mentor-prose">{blocks}</div>;
}
