import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { ACCOUNT, creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { AdjustRequestModal } from './AdjustRequestModal';
import { ProductModal } from './ProductModal';
import { signIn } from './testSetup';

beforeEach(() => signIn('finance'));
afterEach(() => vi.unstubAllGlobals());

describe('the reasons under the fields of the credit dialogs follow the language', () => {
  it('the pack whose credits the backend refused', async () => {
    useMockBackend(creditsMock);
    refuseRequests(
      (path, method) => method === 'PUT' && path.includes('credit-products'),
      [
        { ref: 'credits', reason: 'TOO_LONG' },
        { ref: 'sortOrder', reason: 'TOO_LONG' },
      ],
    );
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
    await expectFieldReasonsFollowLanguage(view, { fields: 2 });
  });

  it('the adjustment request whose reason the backend refused', async () => {
    useMockBackend(creditsMock);
    refuseRequests(
      (path, method) => method === 'POST' && path.includes('credit-adjust-requests'),
      [{ ref: 'reason', reason: 'TOO_LONG' }],
    );
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
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });
});
