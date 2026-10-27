import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MentorMessage } from './MentorMessage';

describe('Mentor reply formatting', () => {
  it('formats explanations, steps and incomplete streaming code without executing HTML', () => {
    const { container } = render(
      <MentorMessage
        content={
          '## Try a loop\n\nUse **Python** and `range`.\n\n1. Start small\n2. Check the result\n\n```python\nprint("<script>alert(1)</script>")'
        }
      />,
    );
    expect(screen.getByRole('heading', { name: 'Try a loop' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('strong')).toHaveTextContent('Python');
    expect(container.querySelector('pre code')).toHaveTextContent('<script>alert(1)</script>');
    expect(container.querySelector('script')).toBeNull();
  });
});
