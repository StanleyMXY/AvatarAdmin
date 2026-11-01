import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import configMock from '../../../mock/config.mock';
import * as memoryMock from '../../../mock/memory.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import ModelsPage from './models';
import { signIn } from './testSetup';

beforeEach(() => {
  resetConfigStore();
  signIn('reviewer', ['MEMORY:VIEW', 'MEMORY:MODEL_REGISTER']);
});
afterEach(() => vi.unstubAllGlobals());

describe('the reasons under the fields of the memory dialogs follow the language', {
  timeout: 60000,
}, () => {
  it('the model whose name and address the backend refused', async () => {
    useMockBackend(memoryMock, { default: configMock });
    refuseRequests(
      (path, method) => method === 'PUT' && path.includes('embedding-models'),
      [
        { ref: 'name', reason: 'TOO_LONG' },
        { ref: 'teiBaseUrl', reason: 'TOO_LONG' },
      ],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ModelsPage />);
    await user.click(await screen.findByRole('button', { name: 'Register a model' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Model name'), { target: { value: 'e5-base' } });
    fireEvent.change(within(dialog).getByLabelText('TEI address'), {
      target: { value: 'https://tei.internal.example/v2' },
    });
    fireEvent.change(within(dialog).getByLabelText('Dimensions'), { target: { value: '768' } });
    await user.click(within(dialog).getByRole('button', { name: 'Register' }));
    await expectFieldReasonsFollowLanguage(view, { fields: 2 });
  });
});
