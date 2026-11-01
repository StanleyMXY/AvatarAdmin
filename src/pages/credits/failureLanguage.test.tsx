import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { ACCOUNT, creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { ApiError } from '../../request/errors';
import { AccountCreditsPanel } from './AccountCreditsPanel';
import { AdjustRequestModal } from './AdjustRequestModal';
import { ApproveModal } from './ApproveModal';
import { ProductModal } from './ProductModal';
import StatsPage from './stats';
import { signIn } from './testSetup';

beforeEach(() => signIn('finance'));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the credit pages follow the language', () => {
  it('the statistics whose read failed', async () => {
    useMockBackend(creditsMock);
    failRequests(/GET .*credits\/stats/);
    const view = renderWithLocaleSwitch(<StatsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the ledger of an account that could not be read', async () => {
    useMockBackend(creditsMock);
    failRequests(/GET .*accounts\/[^/]+\/credits/);
    const view = renderWithLocaleSwitch(<AccountCreditsPanel accountId={ACCOUNT.active} />);
    await expectFailureFollowsLanguage(view);
  });

  it('the approval that was refused', async () => {
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <ApproveModal
        open
        onSubmit={async () => {
          throw new ApiError({
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            message: 'raw backend words',
            data: null,
          });
        }}
        onClose={() => {}}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the pack that could not be saved', async () => {
    useMockBackend(creditsMock);
    failRequests((path, method) => method === 'PUT' && path.includes('credit-products'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <ProductModal
        open
        pack={creditsState.products[0] as unknown as Parameters<typeof ProductModal>[0]['pack']}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the adjustment request that could not be made', async () => {
    useMockBackend(creditsMock);
    failRequests((path, method) => method === 'POST' && path.includes('credit-adjust-requests'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <AdjustRequestModal
        open
        accountId={ACCOUNT.active}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '5' } });
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'ขอบคุณ' } });
    await user.click(within(dialog).getByRole('button', { name: /Submit/ }));
    await expectFailureFollowsLanguage(view);
  });
});
