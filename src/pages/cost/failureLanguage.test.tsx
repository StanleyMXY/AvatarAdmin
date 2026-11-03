import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import costMock from '../../../mock/cost.mock';
import {
  expectFailureFollowsLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { ApiError } from '../../request/errors';
import { ActionModal } from './ActionModal';
import { ManualTab } from './ManualTab';
import { signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the cost pages follow the language', () => {
  it('the action that was refused', async () => {
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <ActionModal
        open
        title="Approve"
        okText="Go"
        onSubmit={async () => {
          throw new ApiError({
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            message: 'raw backend words',
            data: null,
          });
        }}
        onClose={() => {}}
      >
        Body
      </ActionModal>,
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Go' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the hints under the fields of the price the backend refused (the form keeps the failure, not its words)', async () => {
    signIn('root', { codes: ['COST:VIEW', 'COST:PRICE'] });
    useMockBackend({ default: costMock });
    refuseRequests(
      (path, method) => method === 'POST' && path === '/api/admin/usage/prices',
      [
        { ref: 'bands[0].inputPrice', reason: 'OUT_OF_RANGE' },
        { ref: 'model', reason: 'TOO_LONG' },
        { ref: 'bands[9].outputPrice', reason: 'EMPTY_NOT_ALLOWED' },
      ],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <ManualTab allowedCurrencies={['USD']} onSaved={() => {}} kept={{ current: {} }} />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Provider' }), 'ผู้ให้บริการ');
    await user.type(screen.getByRole('textbox', { name: 'Model' }), 'نموذج-٢');
    await user.type(screen.getByRole('textbox', { name: 'Band 1: input price' }), '1');
    await user.type(screen.getByRole('textbox', { name: 'Band 1: output price' }), '1');
    await user.click(screen.getByRole('button', { name: 'Save the price' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save the price' }));
    const above = await screen.findByTestId('manual-refused');
    const hintsNow = () =>
      ['bands[0].inputPrice', 'model'].map(
        (ref) => screen.getByTestId(`refusal-${ref}`).textContent,
      );
    expect(hintsNow()).toEqual([
      'The value is outside the allowed range.',
      'The value is too long.',
    ]);
    expect(above.textContent).toContain('It must not be empty.');
    let requests = 0;
    const inner = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        requests += 1;
        return inner(...args);
      }),
    );
    await view.switchTo('zh-CN');
    await waitFor(() => expect(hintsNow()).toEqual(['超出允许的范围', '内容过长']));
    expect(screen.getByTestId('manual-refused').textContent).toContain('不能为空');
    expect(screen.getByTestId('manual-refused').textContent).not.toMatch(/[A-Za-z]/);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requests, 'the switch of the language made a request').toBe(0);
    // what was typed is still in the boxes
    expect((screen.getByRole('textbox', { name: '模型' }) as HTMLInputElement).value).toBe(
      'نموذج-٢',
    );
  });
});
