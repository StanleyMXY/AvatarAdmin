import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import campaignMock from '../../../mock/campaign.mock';
import configMock from '../../../mock/config.mock';
import statsMock from '../../../mock/stats.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import type { AttributionCampaign, AttributionCost } from '../../services/campaign';
import { BatchModal } from './BatchModal';
import { CampaignModal } from './CampaignModal';
import { CostModal } from './CostModal';
import { LinkModal } from './LinkModal';
import StatsPage from './stats';
import { signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () =>
  useMockBackend({ default: campaignMock }, { default: configMock }, { default: statsMock });
const campaign = (): AttributionCampaign =>
  ({
    ...campaignState.campaigns[0],
    facebookPixelId: '123456789',
  }) as unknown as AttributionCampaign;
const noop = () => {};

describe('the failures of the campaign pages follow the language', () => {
  it('the results page whose reads failed', async () => {
    const _calls = backend();
    failRequests(/GET .*attribution\/performance/);
    const view = renderWithLocaleSwitch(<StatsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the link that could not be made', async () => {
    const _calls = backend();
    failRequests(/GET .*campaigns\/.*\/link/);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <LinkModal campaign={campaign()} linkBase="https://go.example.com" onClose={noop} />,
    );
    await user.click(await screen.findByRole('button', { name: /Generate/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the link of a campaign without a pixel number (a failure of the page itself)', async () => {
    backend();
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <LinkModal
        campaign={{ ...campaign(), facebookPixelId: null }}
        linkBase="https://go.example.com"
        onClose={noop}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /Generate/ }));
    await screen.findByText(/pixel/i);
    await view.switchTo('zh-CN');
    await screen.findByText(/像素/);
  });

  it('the batch of costs that was refused', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.includes('costs'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <BatchModal
        settings={{ currency: 'USD', batchMax: 100, linkBaseUrl: null }}
        onClose={noop}
        onSaved={noop}
      />,
    );
    const box = await screen.findByRole('textbox');
    fireEvent.change(box, {
      target: {
        value: JSON.stringify([
          {
            campaignCode: campaign().code,
            statDate: '2026-10-20',
            amount: 12.5,
            currency: 'USD',
            remark: 'ก',
          },
        ]),
      },
    });
    await user.click(await screen.findByRole('button', { name: /Import/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the cost that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method !== 'GET' && path.includes('costs'));
    const user = userEvent.setup();
    const cost: AttributionCost = {
      id: '1',
      campaignId: campaign().id,
      statDate: '2026-10-20',
      amount: 12.5,
      currency: 'USD',
      remark: null,
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
    await expectFailureFollowsLanguage(view);
  });

  it('the campaign that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method !== 'GET' && path.includes('campaigns'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <CampaignModal campaign={campaign()} existingCodes={[]} onClose={noop} onSaved={noop} />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await within(dialog).findAllByRole('alert');
    await expectFailureFollowsLanguage(view);
  });
});
