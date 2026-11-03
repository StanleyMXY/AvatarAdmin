import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import TaskConfigPage from './taskConfig';
import { expandSearch, signIn } from './testSetup';

// The task types come from GET /meta (`taskTypes`, the list the backend code declares); the three the
// page held before are what it uses when meta could not be read.

afterEach(() => vi.unstubAllGlobals());

/** The options of the dropdown that is open now (an earlier one may still be in the page, hidden). */
const optionsOf = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  scope?: HTMLElement,
) => {
  const box = scope ? within(scope) : screen;
  await user.click(box.getByRole('combobox', { name: label }));
  const open = () =>
    [...document.querySelectorAll('.ant-select-dropdown')].filter(
      (d) => !d.className.includes('ant-select-dropdown-hidden'),
    );
  await waitFor(() => expect(open().length).toBeGreaterThan(0));
  return [...(open().at(-1) as Element).querySelectorAll('.ant-select-item-option-content')].map(
    (o) => o.textContent ?? '',
  );
};

describe('the task types of the task page', { timeout: 30000 }, () => {
  it('offers the types the backend lists in the search (a type this app has no label for is written as its code) and in the new-task dialog', async () => {
    signIn('root', { meta: { taskTypes: ['text_messages', 'share_app', 'call_seconds'] } });
    useMockBackend({ default: activityMock });
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await screen.findByText('Open the app 📱');
    await expandSearch(user);
    expect(await optionsOf(user, 'Task type')).toEqual([
      'Daily text messages',
      'share_app',
      'Daily call time',
    ]);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /New task/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await optionsOf(user, 'Task type', dialog)).toEqual([
      'Daily text messages',
      'share_app',
      'Daily call time',
    ]);
  });

  for (const meta of [{}, { taskTypes: [] }, { taskTypes: 'daily_login' }]) {
    it(`offers the three types the page held before when meta could not be read, or has no usable list: ${JSON.stringify(meta)}`, async () => {
      signIn('root', { meta });
      useMockBackend({ default: activityMock });
      const user = userEvent.setup();
      renderPage(<TaskConfigPage />);
      await screen.findByText('Open the app 📱');
      await expandSearch(user);
      expect(await optionsOf(user, 'Task type')).toEqual([
        'Daily login',
        'Daily call time',
        'Daily text messages',
      ]);
    });
  }

  it('keeps the type of an edited task although the list does not name it (it is shown, not blanked)', async () => {
    signIn('root', { meta: { taskTypes: ['text_messages'] } });
    useMockBackend({ default: activityMock });
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const row = (await screen.findByText('Open the app 📱')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /Edit/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Daily login')).toBeInTheDocument();
  });
});
