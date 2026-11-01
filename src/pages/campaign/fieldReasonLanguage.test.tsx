import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import campaignMock from '../../../mock/campaign.mock';
import configMock from '../../../mock/config.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import type { AttributionCampaign, AttributionCost } from '../../services/campaign';
import { CampaignModal } from './CampaignModal';
import { CostModal } from './CostModal';
import { signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const campaign = (): AttributionCampaign =>
  ({
    ...campaignState.campaigns[0],
    facebookPixelId: '123456789',
  }) as unknown as AttributionCampaign;
const noop = () => {};

describe('the reasons under the fields of the campaign dialogs follow the language', () => {
  it('the campaign whose name and remark the backend refused', async () => {
    useMockBackend({ default: campaignMock }, { default: configMock });
    refuseRequests(
      (path, method) => method !== 'GET' && path.includes('campaigns'),
      [
        { ref: 'name', reason: 'TOO_LONG' },
        { ref: 'remark', reason: 'TOO_LONG' },
      ],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <CampaignModal campaign={campaign()} existingCodes={[]} onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 2 });
  });

  it('the cost whose remark the backend refused', async () => {
    useMockBackend({ default: campaignMock }, { default: configMock });
    refuseRequests(
      (path, method) => method !== 'GET' && path.includes('costs'),
      [{ ref: 'remark', reason: 'TOO_LONG' }],
    );
    const user = userEvent.setup();
    const cost = {
      id: '1',
      campaignId: campaign().id,
      statDate: '2026-10-20',
      amount: 12.5,
      currency: 'USD',
      remark: 'ขอบคุณ',
    } as unknown as AttributionCost;
    const view = renderWithLocaleSwitch(
      <CostModal
        cost={cost}
        campaigns={[campaign()]}
        currency="USD"
        onClose={noop}
        onSaved={noop}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });
});
