import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saved } from '../../../mock/_core/configStore';
import { moderationState } from '../../../mock/_core/moderationData';
import * as configMock from '../../../mock/config.mock';
import * as moderationMock from '../../../mock/moderation.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend as installMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RulesPage from './rules';
import { chooseOption, interceptFetch, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => vi.unstubAllGlobals());

const WIDE_SPACE = String.fromCodePoint(0x3000);
const NBSP = String.fromCharCode(0xa0);
const ZERO_WIDTH = String.fromCharCode(0x200b, 0x200d);
const puts = <T extends { method: string }>(calls: T[]) => calls.filter((c) => c.method === 'PUT');
const patternBox = (n: number) => screen.getByLabelText(`Match text ${n}`);
const noteBox = (n: number) => screen.getByLabelText(`Note ${n}`);

const openPage = async (before: () => void = () => {}) => {
  const calls = installMockBackend(moderationMock, configMock);
  before();
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

describe('the rule list', { timeout: 30000 }, () => {
  it('shows the saved rules in order with their mode, level and note, Thai and Arabic included', async () => {
    await openPage();
    const patterns = screen
      .getAllByLabelText(/^Match text \d+$/)
      .map((e) => (e as HTMLInputElement).value);
    expect(patterns).toEqual(moderationState.rules.map((r) => r.pattern));
    expect(patternBox(1)).toHaveValue('คำต้องห้าม');
    expect(patternBox(2)).toHaveValue('كلمة محظورة');
    expect(patternBox(1)).toHaveAttribute('dir', 'auto');
    expect(noteBox(1)).toHaveValue(moderationState.rules[0].note);
    expect(screen.getByText('8 rules')).toBeInTheDocument();
  });

  it('explains normalisation, the time budget of a regular expression, and that a block is not sent on', async () => {
    await openPage();
    const text = document.body.textContent as string;
    expect(text).toMatch(/letter case is ignored and zero-width characters are removed/);
    expect(text).toMatch(/regular expression has a running-time budget/);
    expect(text).toMatch(/matches a rule at "block" is not sent to the moderation service/);
    expect(text).toMatch(/Substring: matches when the text contains this string/);
    expect(text).toMatch(/Whole word/);
  });

  it('says that substring and whole-word rules also fold look-alike letters and a regular expression does not, with the two known side effects', async () => {
    await openPage();
    const text = document.body.textContent as string;
    expect(text).toMatch(/Substring: .*look-alike letters of another script are folded/s);
    expect(text).toMatch(/Whole word: .*look-alike letters of another script are folded/s);
    expect(text).toMatch(/Regular expression: .*look-alike letters are not folded/is);
    const note = screen.getByTestId('rules-folding-note');
    expect(note.textContent).toMatch(/сука/);
    expect(note.textContent).toMatch(/КОТ.*kot/s);
    expect(note.textContent).toMatch(/sik.*sık sık/s);
    expect(note.textContent).toMatch(/Regular expression rules are not folded/);
  });

  it('says the same in Chinese', async () => {
    installMockBackend(moderationMock, configMock);
    renderPage(<RulesPage />, 'zh-CN');
    const note = await screen.findByTestId('rules-folding-note');
    expect(note.textContent).toMatch(/形近字/);
    expect(note.textContent).toMatch(/КОТ.*kot/s);
    expect(note.textContent).toMatch(/sik.*sık sık/s);
    expect(note.textContent).toMatch(/正则规则不折叠/);
    expect(document.body.textContent).toMatch(/子串：.*形近字折叠/s);
    expect(document.body.textContent).toMatch(/正则：.*不做形近字折叠/s);
  });

  it('offers the three match modes and the two levels', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('combobox', { name: 'Match mode 1' }));
    const modes = (
      await screen.findAllByText(/.+/, { selector: '.ant-select-item-option-content' })
    ).map((o) => o.textContent);
    expect(modes).toEqual(['Substring', 'Whole word', 'Regular expression']);
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox', { name: 'Level 1' }));
    const levels = (
      await screen.findAllByText(/.+/, { selector: '.ant-select-item-option-content' })
    ).map((o) => o.textContent);
    expect(levels).toEqual(expect.arrayContaining(['Send to review', 'Block']));
  });
});

describe('saving the list', { timeout: 30000 }, () => {
  it('adds a Thai and an Arabic rule and shows them again after the save, in the order they were put', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'ห้ามพูดคำนี้');
    const n = await addRule(user, 'ممنوع تماما');
    await chooseOption(user, `Level ${n}`, 'Block');
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const sent = (puts(calls)[0].body as { items: Record<string, unknown>[] }).items;
    expect(sent).toHaveLength(10);
    expect(sent[0]).toHaveProperty('id', moderationState.rules[0].id);
    expect(sent[8]).toEqual({
      pattern: 'ห้ามพูดคำนี้',
      matchMode: 'SUBSTRING',
      level: 'REVIEW',
      note: '',
    });
    expect(sent[9]).toEqual({
      pattern: 'ممنوع تماما',
      matchMode: 'SUBSTRING',
      level: 'BLOCK',
      note: '',
    });
    await screen.findByText('The list is saved');
    expect(patternBox(9)).toHaveValue('ห้ามพูดคำนี้');
    expect(patternBox(10)).toHaveValue('ممنوع تماما');
    expect(moderationState.rules.map((r) => r.pattern).slice(8)).toEqual([
      'ห้ามพูดคำนี้',
      'ممنوع تماما',
    ]);
    expect(screen.queryByText('There are unsaved changes')).toBeNull();
  });

  it('sends the ends of the texts trimmed with the contract set, and keeps the inside', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, `${WIDE_SPACE} สอง  คำ ${NBSP}`);
    fireEvent.change(noteBox(9), { target: { value: `  หมายเหตุ${WIDE_SPACE}` } });
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const sent = (puts(calls)[0].body as { items: { pattern: string; note: string }[] }).items;
    expect(sent[8].pattern).toBe('สอง  คำ');
    expect(sent[8].note).toBe('หมายเหตุ');
  });

  it('does not delete a rule until the list is saved, and then leaves it out of the list', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const first = moderationState.rules[0].pattern;
    const row = patternBox(1).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.getAllByLabelText(/^Match text \d+$/)).toHaveLength(7));
    expect(puts(calls)).toHaveLength(0);
    expect(moderationState.rules.map((r) => r.pattern)).toContain(first);
    expect(screen.getByText('There are unsaved changes')).toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const sent = (puts(calls)[0].body as { items: { pattern: string }[] }).items;
    expect(sent.map((r) => r.pattern)).not.toContain(first);
    expect(moderationState.rules).toHaveLength(7);
  });

  it('can save an empty list, and says that the list is empty', async () => {
    const user = userEvent.setup();
    await openPage();
    for (let i = 0; i < 8; i += 1) {
      await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
      await user.click(await screen.findByRole('button', { name: 'OK' }));
      await waitFor(() =>
        expect(screen.queryAllByLabelText(/^Match text \d+$/)).toHaveLength(7 - i),
      );
    }
    expect(screen.getByText('The list is empty, so there is no rule layer.')).toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(moderationState.rules).toHaveLength(0));
    // Eight confirmed removals plus the save take about 30 s on a loaded machine, as long as the
    // whole describe's limit; 60 s is the limit the slowest form tests of the project use.
  }, 60000);

  it('puts the changes back on "Discard changes"', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, 'temporary');
    expect(screen.getAllByLabelText(/^Match text \d+$/)).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getAllByLabelText(/^Match text \d+$/)).toHaveLength(8);
    expect(puts(calls)).toHaveLength(0);
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['an ideographic space', WIDE_SPACE],
  ])('does not send a rule whose text is %s, and points at the row', async (_, text) => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, text);
    await save(user);
    expect(
      await screen.findByText(
        'The match text needs 1 to 200 characters (without the white space at its ends)',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 rows need to be corrected first; nothing was saved.'),
    ).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
    expect(patternBox(9)).toHaveValue(text);
  });

  it('counts the length of the text in code points: 200 emoji are fine, 201 are not; and the note has the same 200', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    await addRule(user, '😀'.repeat(201));
    fireEvent.change(noteBox(9), { target: { value: 'ก'.repeat(201) } });
    await save(user);
    expect(await screen.findByText(/The match text needs 1 to 200/)).toBeInTheDocument();
    expect(screen.getByText('The note can have at most 200 characters')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
    fireEvent.change(patternBox(9), { target: { value: '😀'.repeat(200) } });
    fireEvent.change(noteBox(9), { target: { value: 'ก'.repeat(200) } });
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
  });

  it('gives a hint, and does not block the save, for a regular expression this browser cannot compile', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const n = await addRule(user, '(');
    expect(screen.queryByText(/cannot compile this regular expression/)).toBeNull();
    await chooseOption(user, `Match mode ${n}`, 'Regular expression');
    expect(
      await screen.findByText(/This browser cannot compile this regular expression/),
    ).toBeInTheDocument();
    fireEvent.change(patternBox(n), { target: { value: '(?:ok)' } });
    expect(screen.queryByText(/cannot compile this regular expression/)).toBeNull();
    fireEvent.change(patternBox(n), { target: { value: '(' } });
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
  });

  it('puts the backend refusal on the row it names by index, keeps everything typed, and saves nothing', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const n = await addRule(user, '(');
    await chooseOption(user, `Match mode ${n}`, 'Regular expression');
    const good = await addRule(user, 'ก็ก็ก็ก็');
    fireEvent.change(noteBox(good), { target: { value: 'my note' } });
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const row = patternBox(n).closest('tr') as HTMLElement;
    expect(
      await within(row).findByText('The regular expression cannot be compiled.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 rows need to be corrected first; nothing was saved.'),
    ).toBeInTheDocument();
    const other = patternBox(good).closest('tr') as HTMLElement;
    expect(within(other).queryByText('The regular expression cannot be compiled.')).toBeNull();
    expect(patternBox(n)).toHaveValue('(');
    expect(patternBox(good)).toHaveValue('ก็ก็ก็ก็');
    expect(noteBox(good)).toHaveValue('my note');
    expect(moderationState.rules).toHaveLength(8);
    // Editing the row takes its refusal away.
    fireEvent.change(patternBox(n), { target: { value: 'fixed' } });
    expect(within(row).queryByText('The regular expression cannot be compiled.')).toBeNull();
  });

  it('says on the row that a text of zero-width characters only is empty after normalising, although it is not blank', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const n = await addRule(user, `${ZERO_WIDTH}${ZERO_WIDTH}`);
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const row = patternBox(n).closest('tr') as HTMLElement;
    expect(await within(row).findByText(/is empty once it is normalised/)).toBeInTheDocument();
    expect(within(row).queryByText('It must not be empty.')).toBeNull();
    expect(moderationState.rules).toHaveLength(8);
  });

  it('keeps "must not be empty" for a text that is blank, which is stopped before it is sent', async () => {
    const user = userEvent.setup();
    const calls = await openPage();
    const n = await addRule(user, '   ');
    await save(user);
    expect(puts(calls)).toHaveLength(0);
    expect(patternBox(n)).toBeInTheDocument();
  });

  it('names several rows at once, each with its own reason', async () => {
    const user = userEvent.setup();
    await openPage();
    const long = await addRule(user, 'x'.repeat(10));
    // The page lets 200 through; the backend limit is the same, so make the backend refuse a mode the page offers.
    interceptFetch((_, init) =>
      (init.method ?? 'GET') === 'PUT'
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', {
              details: [
                { ref: '0', reason: 'TOO_LONG' },
                { ref: String(long - 1), reason: 'OUT_OF_RANGE' },
                { ref: String(long - 1), reason: 'INVALID_PATTERN' },
              ],
            }),
          )
        : undefined,
    );
    await save(user);
    const first = patternBox(1).closest('tr') as HTMLElement;
    expect(await within(first).findByText('The value is too long.')).toBeInTheDocument();
    const last = patternBox(long).closest('tr') as HTMLElement;
    expect(within(last).getByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(
      within(last).getByText('The regular expression cannot be compiled.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('2 rows need to be corrected first; nothing was saved.'),
    ).toBeInTheDocument();
  });

  it('shows too many rules on the whole table, not on a row', async () => {
    const user = userEvent.setup();
    const calls = await openPage(() =>
      saved.set('moderation.text_rules_max', {
        value: 8,
        updatedAt: new Date().toISOString(),
        updatedBy: '1001',
        updatedByUsername: 'root',
      }),
    );
    await addRule(user, 'one too many');
    await save(user);
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(await screen.findByTestId('moderation-rules-table-error')).toHaveTextContent(
      'The value is outside the allowed range.',
    );
    expect(screen.queryByText(/rows need to be corrected/)).toBeNull();
    expect(patternBox(9)).toHaveValue('one too many');
    expect(moderationState.rules).toHaveLength(8);
  });

  it('shows the translated text of any other refusal and keeps the edits', async () => {
    const user = userEvent.setup();
    await openPage(() =>
      interceptFetch((_, init) =>
        (init.method ?? 'GET') === 'PUT'
          ? jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend words'))
          : undefined,
      ),
    );
    await addRule(user, 'kept');
    await save(user);
    expect(await screen.findByText(/You do not have permission to do this/)).toBeInTheDocument();
    expect(screen.queryByText(/raw backend words/)).toBeNull();
    expect(patternBox(9)).toHaveValue('kept');
  });

  it('sends one request for a double press', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = await openPage(() =>
      interceptFetch(async (_, init) => {
        if ((init.method ?? 'GET') === 'PUT') {
          attempts += 1;
          await gate;
        }
        return undefined;
      }),
    );
    await addRule(user, 'once');
    const button = screen.getByRole('button', { name: /Save the list/ });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await new Promise((r) => setTimeout(r, 100));
    release();
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(attempts).toBe(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    await openPage(() =>
      interceptFetch((_, init) => {
        if ((init.method ?? 'GET') !== 'PUT') return undefined;
        attempts += 1;
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      }),
    );
    await addRule(user, 'once');
    await save(user);
    await waitFor(() => expect(attempts).toBe(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(attempts).toBe(1);
  });
});

describe('loading the list', { timeout: 30000 }, () => {
  it('shows the translated text and a retry when the list cannot be read', async () => {
    installMockBackend(moderationMock, configMock);
    let failing = true;
    interceptFetch((url) =>
      failing && url.endsWith('/moderation/text-rules')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN'))
        : undefined,
    );
    renderPage(<RulesPage />);
    expect(
      await screen.findByText(/The list could not be loaded: You do not have permission/),
    ).toBeInTheDocument();
    failing = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Match text 1')).toBeInTheDocument();
  });
});

describe('the parameters section', { timeout: 30000 }, () => {
  it('shows the other moderation keys with the rule list key as a read-only link to this page', async () => {
    await openPage();
    const row = await screen.findByTestId('config-row-moderation.block_score');
    expect(row).toBeInTheDocument();
    const keys = [...document.querySelectorAll('[data-testid^="config-row-"]')].map((e) =>
      (e.getAttribute('data-testid') as string).replace('config-row-', ''),
    );
    expect(keys.filter((k) => k.startsWith('moderation.'))).toHaveLength(11);
    expect(keys.every((k) => k.startsWith('moderation.'))).toBe(true);
    const rules = screen.getByTestId('config-row-moderation.text_rules');
    expect(within(rules).getByRole('link', { name: '/moderation/rules' })).toBeInTheDocument();
    expect(within(rules).queryByRole('textbox')).toBeNull();
  });
});
