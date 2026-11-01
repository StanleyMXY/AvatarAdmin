import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import configMock from '../../../mock/config.mock';
import smsMock from '../../../mock/sms.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import ChannelsPage from './channels';
import TemplatesPage from './templates';
import { signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const backend = () => useMockBackend({ default: smsMock }, { default: configMock });
const rowOf = async (code: string) => {
  const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
  await waitFor(() =>
    expect(rows().some((tr) => tr.querySelector('td')?.textContent === code)).toBe(true),
  );
  return rows().find((tr) => tr.querySelector('td')?.textContent === code) as HTMLElement;
};

describe('the failures of the SMS pages follow the language', { timeout: 60000 }, () => {
  it('the channel that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && /sms\/channels\/\w+$/.test(path));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ChannelsPage />);
    await user.click(within(await rowOf('gw_th_otp')).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Renamed channel' },
    });
    await user.click(within(dialog).getByRole('button', { name: /^(loading )?Submit$/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the template that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && /sms\/templates\/\w+$/.test(path));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<TemplatesPage />);
    await user.click(within(await rowOf('otp_th')).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Renamed template' },
    });
    await user.click(within(dialog).getByRole('button', { name: /^(loading )?Submit$/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the test message that could not be sent', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.endsWith('/test'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ChannelsPage />);
    await user.click(within(await rowOf('gw_th_otp')).getByRole('button', { name: 'Test send' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/Test messages left today/);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Phone number' }), {
      target: { value: '+66812345678' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await expectFailureFollowsLanguage(view);
  });
});
