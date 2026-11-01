import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { analyticsStore } from '../../../mock/_core/analyticsData';
import * as analyticsMock from '../../../mock/analytics.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { ApiError } from '../../request/errors';
import { FunnelNameModal } from './FunnelNameModal';
import FunnelPage from './funnel';
import { MANAGE, signIn } from './testSetup';

beforeEach(() => signIn('support', { codes: MANAGE }));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the analytics pages follow the language', { timeout: 30000 }, () => {
  it('the funnel whose query failed', async () => {
    useMockBackend(analyticsMock);
    failRequests(/GET .*analytics\/funnel$/);
    analyticsStore.funnels.push({
      id: '900',
      name: 'Mine',
      steps: ['app_open', 'purchase'],
      windowHours: 24,
      isPreset: false,
      createdBy: '1001',
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<FunnelPage />);
    await user.click(await screen.findByRole('combobox', { name: 'Saved funnel' }));
    const options = await screen.findAllByText('Mine', {
      selector: '.ant-select-item-option-content *, .ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Query' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the name of a funnel that could not be saved', async () => {
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <FunnelNameModal
        title="Save as"
        initialName="ชื่อ"
        onSubmit={async () => {
          throw new ApiError({
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            message: 'raw backend words',
            data: null,
          });
        }}
        onCancel={() => {}}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await expectFailureFollowsLanguage(view);
  });
});
