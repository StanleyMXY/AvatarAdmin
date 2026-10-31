import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationState, simulateOtherRuleListEdit } from '../../../mock/_core/moderationData';
import * as configMock from '../../../mock/config.mock';
import * as moderationMock from '../../../mock/moderation.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend as installMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RulesPage from './rules';
import { interceptFetch, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => vi.unstubAllGlobals());

const puts = <T extends { method: string }>(calls: T[]) => calls.filter((c) => c.method === 'PUT');
const gets = <T extends { method: string }>(calls: T[]) => calls.filter((c) => c.method === 'GET');
const patternBox = (n: number) => screen.getByLabelText(`Match text ${n}`);
const THEIRS = 'คำใหม่ของเพื่อน';
const THEIRS_AR = 'كلمة جديدة';

const openPage = async () => {
  const calls = installMockBackend(moderationMock, configMock);
  renderPage(<RulesPage />);
  await screen.findByLabelText('Match text 1');
  return calls;
};
const addRule = async (user: ReturnType<typeof userEvent.setup>, pattern: string) => {
  await user.click(screen.getByRole('button', { name: 'Add a rule' }));
  const n = screen.getAllByLabelText(/^Match text \d+$/).length;
  fireEvent.change(patternBox(n), { target: { value: pattern } });
  return n;
};
const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Save the list/ }));
const otherAddsTwoRules = () =>
  simulateOtherRuleListEdit((rules) => [
    ...rules,
    { id: 'theirs-1', pattern: THEIRS, matchMode: 'SUBSTRING', level: 'BLOCK', note: '' },
    { id: 'theirs-2', pattern: THEIRS_AR, matchMode: 'WORD', level: 'REVIEW', note: 'ar' },
  ]);

describe('saving the rule list after another administrator saved it', { timeout: 30000 }, () => {
  it('sends nothing, says it was changed by someone else, keeps what was typed, and leaves their list in place', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const mine = await addRule(user, 'my own rule');
    otherAddsTwoRules();
    await save(user);
    expect(await screen.findByText('Modified by someone else')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
    expect(patternBox(mine)).toHaveValue('my own rule');
    expect(moderationState.rules.map((r) => r.id)).toContain('theirs-2');
    expect(moderationState.rules).toHaveLength(10);
  });

  it('is a conflict also when the other administrator only removed a rule', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'mine');
    simulateOtherRuleListEdit((rules) => rules.slice(1));
    await save(user);
    expect(await screen.findByText('Modified by someone else')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });

  it('shows their list on Reload, drops what was typed, and the next save sends their rules along with the new one', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'my own rule');
    otherAddsTwoRules();
    await save(user);
    await user.click(await screen.findByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.queryByText('Modified by someone else')).toBeNull());
    expect(screen.getAllByLabelText(/^Match text \d+$/)).toHaveLength(10);
    expect(patternBox(9)).toHaveValue(THEIRS);
    expect(patternBox(10)).toHaveValue(THEIRS_AR);
    expect(screen.queryByDisplayValue('my own rule')).toBeNull();
    expect(screen.queryByText('There are unsaved changes')).toBeNull();
    await addRule(user, 'second try');
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const sent = (puts(calls)[0].body as { items: { id?: string; pattern: string }[] }).items;
    expect(sent).toHaveLength(11);
    expect(sent.map((r) => r.id).slice(8, 10)).toEqual(['theirs-1', 'theirs-2']);
    expect(sent[10]).toMatchObject({ pattern: 'second try' });
    expect(sent[10].id).toBeUndefined();
  });
});

describe('saving a rule list nobody else changed', { timeout: 30000 }, () => {
  it('reads the list again first and then sends the one write, with no notice of a conflict', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'mine');
    const before = calls.length;
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(calls.slice(before).map((c) => c.method)).toEqual(['GET', 'PUT']);
    expect(screen.queryByText('Modified by someone else')).toBeNull();
    expect(await screen.findByText('The list is saved')).toBeInTheDocument();
    expect(moderationState.rules).toHaveLength(9);
  });

  it('sends one check and one write for a triple press', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'mine');
    const before = gets(calls).length;
    const button = screen.getByRole('button', { name: /Save the list/ });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(puts(calls)).toHaveLength(1);
    expect(gets(calls).length - before).toBe(1);
  });

  it('does not count a note that the backend leaves out as a change', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'mine');
    // A reading that has no note for a rule is the same rule with an empty note.
    simulateOtherRuleListEdit((rules) =>
      rules.map((rule) => ({ ...rule, note: rule.note === '' ? (null as never) : rule.note })),
    );
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(screen.queryByText('Modified by someone else')).toBeNull();
  });
});

describe('when the list cannot be read again', { timeout: 30000 }, () => {
  it('sends nothing, shows the words of the error and keeps the edit', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const mine = await addRule(user, 'mine');
    interceptFetch((url, init) =>
      (init.method ?? 'GET') === 'GET' && url.endsWith('/moderation/text-rules')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw words'))
        : undefined,
    );
    await save(user);
    expect(await screen.findByText(/You do not have permission to do this/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw words');
    expect(puts(calls)).toHaveLength(0);
    expect(patternBox(mine)).toHaveValue('mine');
    expect(screen.queryByText('Modified by someone else')).toBeNull();
  });

  it('keeps the page and the edit when Reload cannot read the list', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const mine = await addRule(user, 'mine');
    otherAddsTwoRules();
    await save(user);
    const reload = await screen.findByRole('button', { name: 'Reload' });
    interceptFetch((url, init) =>
      (init.method ?? 'GET') === 'GET' && url.endsWith('/moderation/text-rules')
        ? jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw words'))
        : undefined,
    );
    await user.click(reload);
    await waitFor(() => expect(document.body.textContent).not.toContain('raw words'));
    expect(patternBox(mine)).toHaveValue('mine');
    expect(screen.getByText('Modified by someone else')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });
});
