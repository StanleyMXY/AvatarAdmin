import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import * as monitorMock from '../../../mock/monitor.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import PipelinePage from './pipeline';
import { signIn } from './testSetup';

beforeEach(() => signIn('reviewer', ['MONITOR:VIEW']));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the monitor pages follow the language', () => {
  it('the pipeline whose read failed', async () => {
    useMockBackend(monitorMock);
    failRequests(/GET .*monitor\/pipeline/);
    const view = renderWithLocaleSwitch(<PipelinePage />);
    await expectFailureFollowsLanguage(view);
  });
});
