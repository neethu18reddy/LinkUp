import { z } from 'zod';
export const runResultSchema = z.object({
  status: z.enum(['success', 'error', 'timeout']),
  stdout: z.string().max(24000),
  stderr: z.string().max(24000),
  durationMs: z.number().min(0).max(120000),
});
export type RunResult = z.infer<typeof runResultSchema>;
export interface PracticeRunner {
  supports(language: string): boolean;
  run(language: string, code: string, preview?: HTMLElement): Promise<RunResult>;
}
export async function runSandbox(
  language: string,
  code: string,
  preview?: HTMLElement,
): Promise<RunResult> {
  if (language === 'typescript') {
    const { transform } = await import('sucrase');
    code = transform(code, { transforms: ['typescript'], disableESTransforms: true }).code;
    language = 'javascript';
  }
  return new Promise((resolve) => {
    const id = crypto.randomUUID(),
      frame = document.createElement('iframe');
    frame.src = '/studio-runner.html';
    frame.sandbox.add('allow-scripts');
    frame.title = 'Isolated code practice';
    frame.className = 'studio-code-preview';
    frame.referrerPolicy = 'no-referrer';
    const visual = language === 'html' || language === 'css';
    if (!visual) frame.style.display = 'none';
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      if (!visual) frame.remove();
    };
    const finish = (result: RunResult) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (result.status === 'timeout') frame.remove();
      resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.id !== id) return;
      if (event.data.type === 'studio-ready') {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            finish({
              status: 'timeout',
              stdout: '',
              stderr: 'Run stopped after 5 seconds. Try a smaller example.',
              durationMs: 5000,
            }),
          5000,
        );
      }
      if (event.data.type === 'studio-result') {
        const parsed = runResultSchema.safeParse(event.data);
        if (parsed.success) finish(parsed.data);
      }
    };
    window.addEventListener('message', receive);
    timer = setTimeout(
      () =>
        finish({
          status: 'timeout',
          stdout: '',
          stderr: 'Practice runtime did not load in time. Check your connection and try again.',
          durationMs: language === 'python' ? 45000 : 10000,
        }),
      language === 'python' ? 45000 : 10000,
    );
    frame.onload = () =>
      frame.contentWindow?.postMessage({ type: 'studio-run', id, language, code }, '*');
    if (visual && preview) {
      preview.replaceChildren(frame);
    } else document.body.append(frame);
  });
}
export const browserRunner: PracticeRunner = {
  supports: (language) => ['javascript', 'typescript', 'python', 'html', 'css'].includes(language),
  run: runSandbox,
};
