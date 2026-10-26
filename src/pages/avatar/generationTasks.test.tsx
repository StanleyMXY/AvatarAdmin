import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import GenerationTasksPage from './generationTasks';
import { signIn } from './testSetup';

const backend = () => useMockBackend({ default: avatarMock });

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => signIn('root'));

describe('the generation task page', { timeout: 30000 }, () => {
  it('asks for failed tasks only, and shows system tasks as "System" and the others by account', async () => {
    const calls = backend();
    renderPage(<GenerationTasksPage />);
    await screen.findAllByText('System');
    expect(calls[0].url).toContain('status=FAILED');
    const rows = avatarState.generationTasks.filter((t) => t.status === 'FAILED').slice(0, 20);
    for (const task of rows) {
      expect(screen.getByText(task.id)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
    // The successful and the running task of the sample data are not listed.
    expect(
      screen.queryByText(avatarState.generationTasks.at(-1)?.id ?? 'x'),
    ).not.toBeInTheDocument();
  });

  it('writes the failure reasons in words, a dash where there is none', async () => {
    backend();
    renderPage(<GenerationTasksPage />);
    await screen.findAllByText('System');
    for (const text of [
      'Content rejected',
      'Generation failed',
      'The generation service took too long',
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    const none = avatarState.generationTasks.find(
      (t) => t.status === 'FAILED' && t.failureReason === null,
    );
    if (!none) throw new Error('the sample data has no task without a reason');
    const row = screen.getByText(none.id).closest('tr') as HTMLElement;
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('filters by type only: the five types are the choices and there is no time filter', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<GenerationTasksPage />);
    await screen.findAllByText('System');
    const form = document.querySelector('.ant-pro-table-search, form') as HTMLElement;
    expect(form).toBeTruthy();
    expect(within(form).queryByText(/Time|Date|From|To/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Type' }));
    for (const type of ['Avatar', 'Voice', 'Look', 'Look package', 'Action clip']) {
      expect(
        (await screen.findAllByText(type, { selector: '.ant-select-item-option-content' })).length,
      ).toBeGreaterThan(0);
    }
    const clipOptions = await screen.findAllByText('Action clip', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(clipOptions[clipOptions.length - 1]);
    await user.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.includes('status=FAILED') && c.url.includes('type=ACTION_CLIP')),
      ).toBe(true),
    );
    const clip = calls.filter((c) => c.url.includes('type=ACTION_CLIP')).at(-1);
    expect(new URL(clip?.url ?? '', 'http://x').searchParams.has('from')).toBe(false);
    expect(new URL(clip?.url ?? '', 'http://x').searchParams.has('to')).toBe(false);
  });

  it('pages the 27 failed tasks', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<GenerationTasksPage />);
    await screen.findAllByText('System');
    await user.click(await screen.findByTitle('2'));
    await waitFor(() => expect(calls.some((c) => c.url.includes('page=2'))).toBe(true));
  });
});
