import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import emailMock from '../../../mock/email.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import EmailTemplatesPage from './templates';
import {
  dialogsClosed,
  emailState,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from './testSetup';

// A page test fills and presses a lot; under a full run with many files in parallel the default 5 seconds is not enough.
vi.setConfig({ testTimeout: 30000 });

const backend = () => useMockBackend({ default: emailMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const codeOf = (tr: Element) => tr.querySelector('[data-kind="code"]')?.textContent ?? '';
const rowOf = async (code: string) => {
  await waitFor(() => expect(rows().some((tr) => cellsOf(tr)[0].startsWith(code))).toBe(true));
  return rows().find((tr) => cellsOf(tr)[0].startsWith(code)) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<EmailTemplatesPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const openEdit = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(within(await rowOf(code)).getByRole('button', { name: 'Edit' }));
  return within(await screen.findByRole('dialog'));
};
const setText = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const defaults = (code: string) => {
  const found = emailState.defaults.get(code);
  if (!found) throw new Error(`no template ${code}`);
  return found;
};

/** The list as the backend answers it, changed by `change` for the template `code`; the other calls go on to the mock backend. */
function answerWith(change: (items: Record<string, unknown>[]) => Record<string, unknown>[]) {
  const inner = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const response = await inner(input, init);
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname !== '/api/admin/email/templates' || (init.method ?? 'GET') !== 'GET')
        return response;
      const body = (await response.json()) as { data: { items: Record<string, unknown>[] } };
      body.data.items = change(body.data.items);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

describe('the list of e-mail templates', () => {
  it('shows the six templates in the order of the backend with subject, whether it was changed, who changed it and when', async () => {
    await load();
    expect(
      [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent),
    ).toEqual(['Template', 'Subject', 'Status', 'Last changed by', 'Last changed at', 'Actions']);
    expect(rows().map(codeOf)).toEqual([
      'DELETION_CONFIRM',
      'LIKENESS_COMPLAINT_RECEIVED',
      'LOGIN_METHOD_ADDED',
      'PASSWORD_CHANGED',
      'PASSWORD_RESET',
      'REGISTER_CODE',
    ]);
    const register = cellsOf(await rowOf('REGISTER_CODE'));
    expect(register[1]).toBe(defaults('REGISTER_CODE').subject);
    expect(register[2]).toBe('Default');
    expect(register[3]).toBe('—');
    expect(register[4]).toBe('—');
    expect(cellsOf(await rowOf('REGISTER_CODE'))[0]).toContain(
      'Verification code for registration',
    );
  });

  it('keeps the Actions column at the right edge, and does not let the description of a template stretch the table', async () => {
    await load();
    const header = [...document.querySelectorAll('.ant-table-thead th')].find(
      (th) => th.textContent === 'Actions',
    );
    expect(header?.className).toContain('ant-table-cell-fix-end');
    const description = document.querySelector('[data-kind="description"]') as HTMLElement;
    // A text that cannot wrap makes the table as wide as its longest sentence.
    expect(description.style.maxWidth).toBe('320px');
    expect(description.style.whiteSpace).toBe('normal');
  });

  it('describes the sixth template, the notice that a sign-in method was added, in the words of the language', async () => {
    await load();
    expect(cellsOf(await rowOf('LOGIN_METHOD_ADDED'))[0]).toContain(
      'Notice that a sign-in method was added',
    );
    expect(cellsOf(await rowOf('LOGIN_METHOD_ADDED'))[0]).toContain('Google');
  });

  it('describes the sixth template in Chinese when the interface is Chinese', async () => {
    backend();
    renderPage(<EmailTemplatesPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBe(6));
    expect(cellsOf(await rowOf('LOGIN_METHOD_ADDED'))[0]).toContain(
      '登录方式已添加通知（账号新增一种登录方式后发到账号邮箱：Google 自动绑定，或用户登录后自己添加 Google 登录）',
    );
  });

  it('says what the page is: one English text per e-mail, templates declared by the system', async () => {
    await load();
    expect(screen.getByText(/English only/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be added or deleted/)).toBeInTheDocument();
  });

  it('shows a template code that it has never heard of like any other, and lets it be edited', async () => {
    backend();
    answerWith((items) => [
      ...items,
      {
        templateCode: 'FUTURE_NOTICE',
        subject: 'Hello ไทย العربية 😀',
        body: 'Body {x}',
        defaultSubject: 'Hello',
        defaultBody: 'Body {x}',
        modified: false,
        updatedBy: null,
        updatedByUsername: null,
        updatedAt: null,
        placeholders: ['{x}'],
        requiredPlaceholders: ['{x}'],
      },
    ]);
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBe(7));
    const form = await openEdit(user, 'FUTURE_NOTICE');
    expect(form.getByRole('textbox', { name: 'Subject' })).toHaveValue('Hello ไทย العربية 😀');
    expect(form.getByText('{x}', { selector: '[data-kind="required"] *' })).toBeInTheDocument();
  });

  it('shows who changed a template and when, after it was changed, and "Changed" as its status', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    setText(form.getByRole('textbox', { name: 'Subject' }), 'Mine');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await dialogsClosed();
    await waitFor(() =>
      expect(
        cellsOf(rows().find((tr) => cellsOf(tr)[0].startsWith('REGISTER_CODE')) as Element)[2],
      ).toBe('Changed'),
    );
    const cells = cellsOf(await rowOf('REGISTER_CODE'));
    expect(cells[1]).toBe('Mine');
    expect(cells[3]).toBe('root');
    expect(cells[4]).toMatch(/\d{2}/);
  });

  it('shows the name of the administrator who has been deleted as the first characters of the id', async () => {
    backend();
    answerWith((items) =>
      items.map((i) =>
        i.templateCode === 'PASSWORD_RESET'
          ? {
              ...i,
              modified: true,
              updatedBy: '123456789012',
              updatedByUsername: null,
              updatedAt: '2026-10-25T08:00:00Z',
            }
          : i,
      ),
    );
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(cellsOf(await rowOf('PASSWORD_RESET'))[3]).toBe('12345678');
  });

  it('draws what it is given even when the values are not what the contract says', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/email/templates'
        ? jsonAnswer(200, '200', {
            items: [
              {
                templateCode: 'ODD',
                subject: 5,
                body: ['x'],
                modified: 'yes',
                placeholders: 'x',
                requiredPlaceholders: null,
                updatedAt: 9,
              },
              null,
              'text',
            ],
          })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'ODD');
    expect(form.getByRole('textbox', { name: 'Body' })).toBeInTheDocument();
  });

  it('says what went wrong in the words of the code, with a button to read again', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      fail && method === 'GET' && url.pathname === '/api/admin/email/templates'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBe(6));
  });

  it('shows the texts in Chinese when the interface is Chinese', async () => {
    backend();
    renderPage(<EmailTemplatesPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(
      [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent),
    ).toContain('主题');
    expect(document.body.textContent).not.toMatch(/email\.templates\./);
  });
});

describe('the editor', () => {
  it('is filled with the text in force and shows the placeholders as the backend gave them, with their braces', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    expect(form.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      defaults('REGISTER_CODE').subject,
    );
    expect(form.getByRole('textbox', { name: 'Body' })).toHaveValue(defaults('REGISTER_CODE').body);
    const dialog = screen.getByRole('dialog');
    const available = dialog.querySelector('[data-kind="placeholders"]') as HTMLElement;
    expect([...available.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      '{code}',
      '{minutes}',
      '{appName}',
    ]);
    const required = dialog.querySelector('[data-kind="required"]') as HTMLElement;
    expect([...required.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['{code}']);
  });

  it('says what a placeholder stands for where it knows the name, and that {subscriptionNotice} cannot be removed', async () => {
    const { user } = await load();
    await openEdit(user, 'DELETION_CONFIRM');
    const panel = screen
      .getByRole('dialog')
      .querySelector('[data-kind="placeholders"]') as HTMLElement;
    expect(panel.textContent).toMatch(/\{subscriptionNotice\}.*cannot be removed/s);
    expect(panel.textContent).toMatch(/\{confirmLink\}.*link to confirm the deletion/s);
  });

  it('takes the placeholders and the required ones of the sixth template from the backend and says what {method} stands for', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'LOGIN_METHOD_ADDED');
    const dialog = screen.getByRole('dialog');
    const available = dialog.querySelector('[data-kind="placeholders"]') as HTMLElement;
    expect([...available.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      '{method}',
      '{time}',
      '{appName}',
    ]);
    const required = dialog.querySelector('[data-kind="required"]') as HTMLElement;
    expect([...required.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      '{method}',
      '{time}',
    ]);
    expect(available.textContent).toMatch(/\{method\}.*sign-in method/s);
    setText(form.getByRole('textbox', { name: 'Body' }), 'Added {method}');
    expect(await form.findByText(/The body is missing \{time\}/)).toBeInTheDocument();
  });

  it('says nothing about a placeholder it does not know, and still lists it with its braces', async () => {
    backend();
    answerWith((items) =>
      items.map((i) =>
        i.templateCode === 'REGISTER_CODE' ? { ...i, placeholders: ['{code}', '{brandNew}'] } : i,
      ),
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBe(6));
    await openEdit(user, 'REGISTER_CODE');
    const panel = screen
      .getByRole('dialog')
      .querySelector('[data-kind="placeholders"]') as HTMLElement;
    expect([...panel.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      '{code}',
      '{brandNew}',
    ]);
    expect(panel.querySelectorAll('[data-kind="explanation"]')).toHaveLength(1);
  });

  it('shows the default text of the template', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'PASSWORD_RESET');
    const box = screen.getByRole('dialog').querySelector('[data-kind="default"]') as HTMLElement;
    expect(box.textContent).toContain(defaults('PASSWORD_RESET').subject);
    expect(box.textContent).toContain(defaults('PASSWORD_RESET').body);
    expect(form.getByText('Default text')).toBeInTheDocument();
  });

  it('does not take the required placeholders from the code but from the backend', async () => {
    backend();
    answerWith((items) =>
      items.map((i) =>
        i.templateCode === 'REGISTER_CODE'
          ? {
              ...i,
              placeholders: ['{foo}', '{Bar}'],
              requiredPlaceholders: ['{foo}', '{Bar}'],
              body: 'has {foo} and {Bar}',
            }
          : i,
      ),
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBe(6));
    const form = await openEdit(user, 'REGISTER_CODE');
    expect(form.queryByText(/The body is missing/)).toBeNull();
    setText(form.getByRole('textbox', { name: 'Body' }), 'has {foo} and {bar}');
    expect(await form.findByText(/The body is missing \{Bar\}/)).toBeInTheDocument();
    setText(form.getByRole('textbox', { name: 'Body' }), 'has {code} only');
    expect(await form.findByText(/The body is missing \{foo\}, \{Bar\}/)).toBeInTheDocument();
  });
});

describe('the check of the required placeholders', () => {
  it.each([
    ['the bare word', 'Your code is code'],
    ['capitals', 'Your code is {CODE}'],
    ['spaces inside the braces', 'Your code is { code }'],
    ['a capital first letter', 'Your code is {Code}'],
    ['nothing', 'Your code is coming'],
  ])('does not accept %s as {code}, names {code}, and sends nothing', async (_name, text) => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    setText(form.getByRole('textbox', { name: 'Body' }), text);
    expect(await form.findByText(/The body is missing \{code\}/)).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('accepts {code} exactly, at once, and sends the text', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    setText(form.getByRole('textbox', { name: 'Body' }), 'no placeholder');
    expect(await form.findByText(/The body is missing \{code\}/)).toBeInTheDocument();
    setText(form.getByRole('textbox', { name: 'Body' }), 'Use {code} within {minutes} minutes ไทย');
    await waitFor(() => expect(form.queryByText(/The body is missing/)).toBeNull());
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/email/templates/REGISTER_CODE',
      body: {
        subject: defaults('REGISTER_CODE').subject,
        body: 'Use {code} within {minutes} minutes ไทย',
      },
    });
  });

  it('names only the placeholder that is missing when the template needs two', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'DELETION_CONFIRM');
    setText(form.getByRole('textbox', { name: 'Body' }), 'Open {confirmLink} now');
    expect(
      await form.findByText(/The body is missing \{subscriptionNotice\}\./),
    ).toBeInTheDocument();
    expect(form.queryByText(/missing \{confirmLink\}/)).toBeNull();
  });

  it('asks for nothing but a body for a template with no required placeholder', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'LIKENESS_COMPLAINT_RECEIVED');
    setText(form.getByRole('textbox', { name: 'Body' }), 'Plain words only');
    expect(form.queryByText(/The body is missing/)).toBeNull();
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('does not take an empty body, even for a template with no required placeholder', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'LIKENESS_COMPLAINT_RECEIVED');
    setText(form.getByRole('textbox', { name: 'Body' }), '  ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter the body')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('the subject', () => {
  it('is 1 to 200 characters, counted in characters of the text and not in code units', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    const subject = form.getByRole('textbox', { name: 'Subject' });
    setText(subject, '   ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The subject must be 1 to 200 characters')).toBeInTheDocument();
    setText(subject, 'ก'.repeat(201));
    expect(await form.findByText('201 / 200')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
    setText(subject, '😀'.repeat(200));
    expect(await form.findByText('200 / 200')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { subject: string }).subject).toBe('😀'.repeat(200));
  });

  it('is sent without the blanks around it', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    setText(form.getByRole('textbox', { name: 'Subject' }), '  رمز التحقق  ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { subject: string }).subject).toBe('رمز التحقق');
  });
});

describe('saving', () => {
  it('sends the body without the blanks and lines around it, like the subject', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    setText(form.getByRole('textbox', { name: 'Body' }), '\n  Tu código es {code}  \n');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { body: string }).body).toBe('Tu código es {code}');
  });

  it('lists a refusal that the form cannot place once, however many details say it, and with no warning about repeated keys', async () => {
    const complaints: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      complaints.push(args.map(String).join(' '));
    });
    backend();
    overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(400, 'INVALID_REQUEST', {
            details: [
              { ref: 'one', reason: 'NO_TEXT_FOR_THIS_1' },
              { ref: 'two', reason: 'NO_TEXT_FOR_THIS_2' },
              { ref: 'three', reason: 'NO_TEXT_FOR_THIS_3' },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'REGISTER_CODE');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(document.querySelector('.ant-modal .ant-alert')).not.toBeNull());
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-modal .ant-alert li')).toHaveLength(1),
    );
    expect(complaints.filter((line) => /same key|unique "key"/i.test(line))).toEqual([]);
    errorSpy.mockRestore();
  });

  it('shows the words of the code, and not the backend message, when the backend refuses, and keeps the dialog open', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            null,
            'SECRET BACKEND WORDS: the body must contain {code}',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'REGISTER_CODE');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Some input is not valid. Please check the fields and try again.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    const gate = holdWrites();
    const submit = form.getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settled();
    expect(gate.started()).toBe(1);
    fireEvent.submit(document.querySelector('.ant-modal form') as Element);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows that the session has ended and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ method }) =>
      method === 'PUT'
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'REGISTER_CODE');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
  });

  it('shows what is edited, not what was typed in a dialog that was closed before', async () => {
    const { user } = await load();
    let form = await openEdit(user, 'REGISTER_CODE');
    setText(form.getByRole('textbox', { name: 'Subject' }), 'Typed and abandoned');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    form = await openEdit(user, 'PASSWORD_RESET');
    expect(form.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      defaults('PASSWORD_RESET').subject,
    );
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    form = await openEdit(user, 'REGISTER_CODE');
    expect(form.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      defaults('REGISTER_CODE').subject,
    );
  });

  it('keeps a template code of 5000 letters without a space inside its column', async () => {
    backend();
    answerWith((items) => [{ ...items[0], templateCode: 'K'.repeat(5000) }, ...items.slice(1)]);
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const long = screen.getByText('K'.repeat(5000));
    expect((long.closest('button') as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('lays out a subject and a body of 5000 letters without a space', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'LIKENESS_COMPLAINT_RECEIVED');
    setText(form.getByRole('textbox', { name: 'Body' }), 'ก'.repeat(5000));
    expect((form.getByRole('textbox', { name: 'Body' }) as HTMLTextAreaElement).value).toHaveLength(
      5000,
    );
  });
});

describe('restoring the default', () => {
  it('is not offered for a template that was never changed, and says why', async () => {
    const { user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    expect(form.getByText(/has not been changed/)).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Restore default' })).toBeDisabled();
  });

  it('shows the default text first, asks inline, and brings the default back with one request', async () => {
    const { calls, user } = await load();
    let form = await openEdit(user, 'PASSWORD_RESET');
    setText(form.getByRole('textbox', { name: 'Subject' }), 'Mine');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await dialogsClosed();
    await waitFor(() => expect(emailState.rows.has('PASSWORD_RESET')).toBe(true));
    await waitFor(() =>
      expect(
        cellsOf(rows().find((tr) => cellsOf(tr)[0].startsWith('PASSWORD_RESET')) as Element)[2],
      ).toBe('Changed'),
    );
    form = await openEdit(user, 'PASSWORD_RESET');
    const box = screen.getByRole('dialog').querySelector('[data-kind="default"]') as HTMLElement;
    expect(box.textContent).toContain(defaults('PASSWORD_RESET').subject);
    expect(box.textContent).toContain(defaults('PASSWORD_RESET').body);
    await user.click(form.getByRole('button', { name: 'Restore default' }));
    expect(await screen.findByText(/Restore the default text\?/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    const ok = await screen.findByRole('button', { name: 'OK' });
    const gate = holdWrites();
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await waitFor(() => expect(emailState.rows.has('PASSWORD_RESET')).toBe(false));
    expect(writesOf(calls).at(-1)).toMatchObject({
      method: 'POST',
      url: '/api/admin/email/templates/PASSWORD_RESET/reset',
    });
    await dialogsClosed();
    await waitFor(() =>
      expect(
        cellsOf(rows().find((tr) => cellsOf(tr)[0].startsWith('PASSWORD_RESET')) as Element)[2],
      ).toBe('Default'),
    );
    expect(cellsOf(await rowOf('PASSWORD_RESET'))[1]).toBe(defaults('PASSWORD_RESET').subject);
  });

  it('keeps Submit and Cancel off while the default is being brought back, so that no second write can follow it, and closes when it is done', async () => {
    emailState.rows.set('REGISTER_CODE', {
      subject: 'Mine',
      body: 'Mine {code}',
      updatedBy: '1',
      updatedAt: '2026-10-25T08:00:00Z',
    });
    const { calls, user } = await load();
    const form = await openEdit(user, 'REGISTER_CODE');
    await user.click(form.getByRole('button', { name: 'Restore default' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    const gate = holdWrites();
    fireEvent.click(ok);
    await waitFor(() => expect(gate.started()).toBe(1));
    expect(form.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(form.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(form.getByRole('button', { name: 'Submit' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    await settled();
    expect(gate.started()).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeNull();
    gate.release();
    await dialogsClosed();
    expect(writesOf(calls).map((c) => c.method)).toEqual(['POST']);
  });

  it('shows the words of the code when the backend refuses', async () => {
    emailState.rows.set('REGISTER_CODE', {
      subject: 'S',
      body: '{code}',
      updatedBy: '1',
      updatedAt: '2026-10-25T08:00:00Z',
    });
    backend();
    overrideFetch(async ({ method, url }) =>
      method === 'POST' && url.pathname.endsWith('/reset')
        ? jsonAnswer(404, 'RESOURCE_NOT_FOUND', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<EmailTemplatesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await openEdit(user, 'REGISTER_CODE');
    await user.click(form.getByRole('button', { name: 'Restore default' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});
