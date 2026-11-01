import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
  expectFailureFollowsLanguage,
  failEverything,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { resetChannelsCache } from '../../components/ChannelSelect';
import { resetSessionState, setToken } from '../../request/session';
import DailyPage from './daily';
import RetentionPage from './retention';

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  resetChannelsCache();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  setTestAccess(
    access({ me: { superAdmin: false, permissions: ['STATS:VIEW'] } }) as unknown as Record<
      string,
      unknown
    >,
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the statistics reports follow the language', () => {
  it('the daily report whose read failed', async () => {
    const _calls = failEverything();
    const view = renderWithLocaleSwitch(<DailyPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the retention report whose read failed', async () => {
    const _calls = failEverything();
    const view = renderWithLocaleSwitch(<RetentionPage />);
    await expectFailureFollowsLanguage(view);
  });
});
