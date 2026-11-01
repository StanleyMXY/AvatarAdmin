import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { supportStore } from '../../../mock/_core/supportData';
import * as supportMock from '../../../mock/support.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { FeedbackDrawer } from './FeedbackDrawer';
import { signIn } from './testSetup';

beforeEach(() => signIn('reviewer', ['SUPPORT:VIEW']));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the support pages follow the language', () => {
  it('the feedback that could not be read', async () => {
    useMockBackend(supportMock);
    failRequests(/GET .*support\/feedback\/\w+/);
    const view = renderWithLocaleSwitch(
      <FeedbackDrawer id={supportStore.rows[0].id} onClose={() => {}} />,
    );
    await expectFailureFollowsLanguage(view);
  });
});
