import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { env } from 'node:process';

// Functional assertions keep their normal deadline in CI. Local verification can
// allow slower jsdom scheduling without weakening application performance checks.
if (env.LINKUP_SLOW_TESTS === 'true') configure({ asyncUtilTimeout: 5000 });

afterEach(cleanup);
