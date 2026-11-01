import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { MEMORY_ACCOUNT_IDS, memoryStore } from '../../../mock/_core/memoryData';
import configMock from '../../../mock/config.mock';
import * as memoryMock from '../../../mock/memory.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import AccountMemoryTab from './AccountMemoryTab';
import ModelsPage from './models';
import { signIn } from './testSetup';
import TiersPage from './tiers';

beforeEach(() => {
  resetConfigStore();
  signIn('reviewer', [
    'MEMORY:VIEW',
    'MEMORY:TIER_CONFIG',
    'MEMORY:MODEL_REGISTER',
    'MEMORY:MODEL_ASSIGN',
  ]);
});
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the memory pages follow the language', { timeout: 60000 }, () => {
  it('the tiers that could not be listed', async () => {
    useMockBackend(memoryMock);
    failRequests(/GET .*memory\/tiers$/);
    const view = renderWithLocaleSwitch(<TiersPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the settings of a tier that could not be read for the edit', async () => {
    useMockBackend(memoryMock);
    failRequests(/GET .*memory\/tiers\/premium/);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<TiersPage />);
    const row = (await screen.findByText('premium', { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the tier that could not be saved', async () => {
    useMockBackend(memoryMock);
    failRequests((path, method) => method === 'PUT' && path.includes('memory/tiers'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<TiersPage />);
    const row = (await screen.findByText('premium', { selector: 'td' })).closest(
      'tr',
    ) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const topK = await within(dialog).findByLabelText('Results (topK)');
    await waitFor(() => expect(topK).toHaveValue('10'));
    fireEvent.change(topK, { target: { value: '12' } });
    await user.click(within(dialog).getByRole('button', { name: /OK|Submit|Save/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the models that could not be listed', async () => {
    useMockBackend(memoryMock, { default: configMock });
    failRequests(/GET .*embedding-models/);
    const view = renderWithLocaleSwitch(<ModelsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the model that could not be registered', async () => {
    useMockBackend(memoryMock, { default: configMock });
    failRequests((path, method) => method === 'PUT' && path.includes('embedding-models'));
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
    await expectFailureFollowsLanguage(view);
  });

  it('the memory of an account that could not be read', async () => {
    useMockBackend(memoryMock);
    failRequests(/GET .*accounts\/[^/]+\/memory$/);
    const view = renderWithLocaleSwitch(
      <AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />,
    );
    await expectFailureFollowsLanguage(view);
  });

  it('the model that could not be assigned', async () => {
    memoryStore.models.set('e5-base', {
      modelName: 'e5-base',
      teiBaseUrl: 'https://tei.internal.example',
      dimensions: 768,
    });
    useMockBackend(memoryMock);
    failRequests((path, method) => method === 'PUT' && path.includes('embedding-model'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <AccountMemoryTab accountId={MEMORY_ACCOUNT_IDS.active} accountStatus="ACTIVE" />,
    );
    await user.click(await screen.findByRole('combobox', { name: 'Choose a model' }));
    const options = await screen.findAllByText('e5-base', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Assign model' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await expectFailureFollowsLanguage(view);
  });
});
