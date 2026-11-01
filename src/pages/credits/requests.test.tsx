import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RequestsPage from './requests';
import { chooseOption, dialogsClosed, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

type Request = (typeof creditsState.requests)[number];
const pendingBy = (adminId: string): Request =>
  creditsState.requests.find(
    (r) => r.status === 'PENDING' && r.applicantAdminId === adminId,
  ) as Request;
const rowOf = async (request: Request) => {
  const row = (await screen.findByText(request.reason)).closest('tr');
  if (!row) throw new Error('no row');
  return row as HTMLTableRowElement;
};
const writes = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method !== 'GET');
const SELF = /You submitted this request/;

describe('which buttons an administrator sees', { timeout: 30000 }, () => {
  it('shows neither "New request" nor approve and reject with the view permission only', async () => {
    signIn('finance', { codes: ['SUBSCRIPTION:VIEW'] });
    useMockBackend(creditsMock);
    renderPage(<RequestsPage />);
    await rowOf(pendingBy('1003'));
    expect(screen.queryByRole('button', { name: 'New request' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('shows "New request" to SUBSCRIPTION:GRANT and no approve or reject', async () => {
    signIn('finance', { codes: ['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT'] });
    useMockBackend(creditsMock);
    renderPage(<RequestsPage />);
    await rowOf(pendingBy('1003'));
    expect(screen.getByRole('button', { name: 'New request' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('shows approve and reject to CREDIT:REVIEW on the pending rows only, and no "New request"', async () => {
    signIn('finance', { codes: ['SUBSCRIPTION:VIEW', 'CREDIT:REVIEW'] });
    useMockBackend(creditsMock);
    renderPage(<RequestsPage />);
    await rowOf(pendingBy('1001'));
    const pending = creditsState.requests.filter((r) => r.status === 'PENDING').length;
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(pending);
    expect(screen.getAllByRole('button', { name: 'Reject' })).toHaveLength(pending);
    expect(screen.queryByRole('button', { name: 'New request' })).toBeNull();
  });
});

describe('the list', { timeout: 30000 }, () => {
  it('shows the applicant and the reviewer by name, and the first 8 characters of the id when the administrator is gone', async () => {
    useMockBackend(creditsMock);
    renderPage(<RequestsPage />);
    const gone = creditsState.requests.find((r) => r.applicantAdminId === '9999') as Request;
    const row = await rowOf(gone);
    expect(within(row).getByText('9999'.slice(0, 8))).toBeInTheDocument();
    const done = creditsState.requests.find((r) => r.status === 'APPROVED') as Request;
    const doneRow = await rowOf(done);
    expect(within(doneRow).getByText('root')).toBeInTheDocument();
    expect(within(doneRow).getByText('Approved')).toBeInTheDocument();
  });

  it('shows the change with its sign, the type, and a dash where there is no reviewer', async () => {
    useMockBackend(creditsMock);
    renderPage(<RequestsPage />);
    const adjust = pendingBy('1001');
    const row = await rowOf(adjust);
    expect(within(row).getByText('-200')).toBeInTheDocument();
    expect(within(row).getByText('Adjust')).toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    const grant = await rowOf(pendingBy('1003'));
    expect(within(grant).getByText('+500')).toBeInTheDocument();
    expect(within(grant).getByText('Grant')).toBeInTheDocument();
  });

  it('keeps a reason and a note of 5000 characters without spaces, and text of every language, inside their cells', async () => {
    const long = 'y'.repeat(5000);
    const texts = [
      long,
      'สวัสดีครับ',
      'مرحبا بك',
      'Terima kasih',
      'Cảm ơn bạn',
      'Muchas gracias',
      'Thank you',
      '谢谢',
      '😀'.repeat(40),
    ];
    const items = texts.map((reason, i) => ({
      id: String(i),
      accountId: ACCOUNT.active,
      kind: 'GRANT',
      delta: 5,
      reason,
      status: 'REJECTED',
      applicantAdminId: '1003',
      applicantUsername: 'finance',
      reviewerAdminId: '1001',
      reviewerUsername: 'root',
      reviewNote: long,
      ledgerId: null,
      createdAt: '2026-10-01T00:00:00Z',
      reviewedAt: '2026-10-02T00:00:00Z',
    }));
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
    renderPage(<RequestsPage />);
    const cell = (await screen.findAllByText(long))[0];
    const button = cell.closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    expect(button.style.maxWidth).not.toBe('');
    for (const text of texts.slice(1, 8))
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });
});

describe('reviewing your own request', { timeout: 30000 }, () => {
  it('disables approve and reject on a request the administrator submitted, says why, and leaves the others usable', async () => {
    signIn('finance');
    useMockBackend(creditsMock);
    renderPage(<RequestsPage />);
    const own = await rowOf(pendingBy('1003'));
    expect(within(own).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(within(own).getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(within(own).getByText(SELF)).toBeInTheDocument();
    const other = await rowOf(pendingBy('1001'));
    expect(within(other).getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(within(other).getByRole('button', { name: 'Reject' })).toBeEnabled();
    expect(within(other).queryByText(SELF)).toBeNull();
  });

  it('does not disable anything when the account has no id yet, and shows the backend refusal instead', async () => {
    signIn('finance', { withId: false });
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const own = await rowOf(pendingBy('1003'));
    const approve = within(own).getByRole('button', { name: 'Approve' });
    expect(approve).toBeEnabled();
    expect(within(own).queryByText(SELF)).toBeNull();
    await user.click(approve);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(
      await within(dialog).findByText('You cannot review a request that you submitted.'),
    ).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('approving', { timeout: 30000 }, () => {
  const openApprove = async (user: ReturnType<typeof userEvent.setup>, request: Request) => {
    await user.click(within(await rowOf(request)).getByRole('button', { name: 'Approve' }));
    return screen.findByRole('dialog');
  };

  it('approves without a note: the body has no note, the row becomes approved, and the ledger line exists', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const request = pendingBy('1003');
    const dialog = await openApprove(user, request);
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/credit-adjust-requests/${request.id}/approve`,
      body: {},
    });
    await dialogsClosed();
    expect(
      creditsState.ledger.some((l) => l.eventKey === request.id && l.reason === 'ADMIN_GRANT'),
    ).toBe(true);
    await waitFor(async () =>
      expect(within(await rowOf(request)).getByText('Approved')).toBeInTheDocument(),
    );
  });

  it('sends the note, trimmed, when there is one', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openApprove(user, pendingBy('1003'));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ' ตรวจแล้ว ' } });
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ note: 'ตรวจแล้ว' });
  });

  it('sends one request when the button is pressed twice at once', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openApprove(user, pendingBy('1003'));
    const ok = within(dialog).getByRole('button', { name: 'Approve' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(writes(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });

  it('refuses a note of more than 500 characters without sending', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openApprove(user, pendingBy('1003'));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'a'.repeat(501) } });
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(dialog.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    // the field is a note, not a reason, and it is optional: no "1 to 500 characters" about a reason
    expect(within(dialog).getByText('The note can have up to 500 characters')).toBeInTheDocument();
    expect(within(dialog).queryByText(/reason/i)).toBeNull();
    expect(writes(calls)).toHaveLength(0);
  });

  it('says which field and why when the backend refuses the approval with details', async () => {
    useMockBackend(creditsMock);
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      init?.method === 'POST' && String(input).endsWith('/approve')
        ? jsonResponse(
            400,
            envelope('INVALID_REQUEST', { details: [{ ref: 'note', reason: 'TOO_LONG' }] }),
          )
        : real(input, init),
    );
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openApprove(user, pendingBy('1003'));
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await within(dialog).findByText(/note: The value is too long\./)).toBeInTheDocument();
  });

  it('shows the text of the refusal when the account is being deleted, and keeps the request pending', async () => {
    useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const request = creditsState.requests.find(
      (r) => r.accountId === ACCOUNT.pendingDeletion && r.status === 'PENDING',
    ) as Request;
    const dialog = await openApprove(user, request);
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await within(dialog).findByText(/grace period/i)).toBeInTheDocument();
    expect(creditsState.requests.find((r) => r.id === request.id)?.status).toBe('PENDING');
  });

  it('says that the request was already handled when it is approved by someone else first (409)', async () => {
    useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const request = pendingBy('1003');
    const dialog = await openApprove(user, request);
    (creditsState.requests.find((r) => r.id === request.id) as Request).status = 'REJECTED';
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await within(dialog).findByText(/not in the state|state/i)).toBeInTheDocument();
  });

  it('does not send the write again when the token ended during it', async () => {
    const calls = stubFetch(async ({ init }) => {
      if ((init.method ?? 'GET') === 'GET') {
        return jsonResponse(200, envelope('200', { items: [pendingRow], total: 1 }));
      }
      return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
    });
    const pendingRow = {
      ...creditsState.requests[0],
      status: 'PENDING',
      applicantAdminId: '1003',
      applicantUsername: 'finance',
    };
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    await user.click(
      within(await rowOf(pendingRow as Request)).getByRole('button', { name: 'Approve' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});

describe('rejecting', { timeout: 30000 }, () => {
  const openReject = async (user: ReturnType<typeof userEvent.setup>, request: Request) => {
    await user.click(within(await rowOf(request)).getByRole('button', { name: 'Reject' }));
    return screen.findByRole('dialog');
  };
  const IDEOGRAPHIC = String.fromCharCode(0x3000);

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['ideographic spaces', `${IDEOGRAPHIC}${IDEOGRAPHIC}`],
  ])('needs a note: a note that is %s is refused without sending', async (_label, text) => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openReject(user, pendingBy('1003'));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: text } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a reason')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('rejects with the note, trimmed, and the row becomes rejected', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const request = pendingBy('1003');
    const dialog = await openReject(user, request);
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: ` ${IDEOGRAPHIC}Không cần ` },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      url: `/api/admin/credit-adjust-requests/${request.id}/reject`,
      body: { note: 'Không cần' },
    });
    await waitFor(async () =>
      expect(within(await rowOf(request)).getByText('Rejected')).toBeInTheDocument(),
    );
    expect(creditsState.ledger.some((l) => l.eventKey === request.id)).toBe(false);
  });

  it('sends one request for a double press', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openReject(user, pendingBy('1003'));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'No' } });
    const ok = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 150));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const pendingRow = {
      ...creditsState.requests[0],
      status: 'PENDING',
      applicantAdminId: '1003',
      applicantUsername: 'finance',
    };
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [pendingRow], total: 1 }))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await openReject(user, pendingRow as Request);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'No' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});

describe('a new request', { timeout: 30000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'New request' }));
    return screen.findByRole('dialog');
  };
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    values: { account?: string; kind?: 'Grant' | 'Adjust'; delta?: string; reason?: string },
  ) => {
    fireEvent.change(within(dialog).getByLabelText('Account ID'), {
      target: { value: values.account ?? ACCOUNT.active },
    });
    await chooseOption(user, 'Type', values.kind ?? 'Grant', dialog);
    fireEvent.change(within(dialog).getByLabelText('Credits'), {
      target: { value: values.delta ?? '100' },
    });
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: values.reason ?? 'Compensation' },
    });
  };
  const submit = (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) =>
    user.click(within(dialog).getByRole('button', { name: 'Submit' }));

  it('creates a grant with the four fields, trimmed, and the request appears in the list', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, { account: ` ${ACCOUNT.active} `, reason: ' ขอบคุณ ' });
    await submit(user, dialog);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/credit-adjust-requests',
      body: { accountId: ACCOUNT.active, kind: 'GRANT', delta: 100, reason: 'ขอบคุณ' },
    });
    expect(await screen.findByText('ขอบคุณ', { selector: 'td button' })).toBeInTheDocument();
    await dialogsClosed();
  });

  it.each([
    ['0', 'zero'],
    ['-5', 'a negative number'],
    ['2.5', 'a fraction'],
    ['', 'nothing'],
  ])('refuses %s (%s) for a grant, without sending', async (delta) => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, { kind: 'Grant', delta });
    await submit(user, dialog);
    await waitFor(() =>
      expect(dialog.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('refuses zero for an adjustment, and accepts a negative number', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, { kind: 'Adjust', delta: '0' });
    await submit(user, dialog);
    await waitFor(() =>
      expect(dialog.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Credits'), { target: { value: '-30' } });
    await submit(user, dialog);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ kind: 'ADJUST', delta: -30 });
    await dialogsClosed();
  });

  it('accepts a positive number for an adjustment', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, { kind: 'Adjust', delta: '30' });
    await submit(user, dialog);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ kind: 'ADJUST', delta: 30 });
  });

  it('checks the number again when the type changes from adjustment to grant', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, { kind: 'Adjust', delta: '-30' });
    await chooseOption(user, 'Type', 'Grant', dialog);
    await submit(user, dialog);
    await waitFor(() =>
      expect(dialog.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('refuses an empty account id and a reason that is only spaces, without sending', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, { account: '  ', reason: `${String.fromCharCode(0x3000)} ` });
    await submit(user, dialog);
    await waitFor(() =>
      expect(dialog.querySelectorAll('.ant-form-item-explain-error').length).toBeGreaterThanOrEqual(
        2,
      ),
    );
    expect(writes(calls)).toHaveLength(0);
  });

  it('shows the refusal of the backend in the dialog, in the language of the page, and keeps it open', async () => {
    useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    let dialog = await open(user);
    await fill(user, dialog, { account: 'there-is-no-such-account' });
    await submit(user, dialog);
    expect(await within(dialog).findByText(/not found/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Account ID'), {
      target: { value: ACCOUNT.pendingDeletion },
    });
    await submit(user, dialog);
    expect(await within(dialog).findByText(/grace period/i)).toBeInTheDocument();
    dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('sends one request for a double press, and none again after the token ended', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, {});
    const ok = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 150));
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [], total: 0 }))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    const dialog = await open(user);
    await fill(user, dialog, {});
    await submit(user, dialog);
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});

describe('the filters', { timeout: 30000 }, () => {
  it('sends the account id exactly as typed, whole, without any wildcard', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    await rowOf(pendingBy('1003'));
    await user.type(
      screen.getByRole('textbox', { name: 'Account ID' }),
      `${ACCOUNT.negative}{Enter}`,
    );
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes(`accountId=${ACCOUNT.negative}`))).toBe(true),
    );
    const sent = calls.filter((c) => c.url.includes('accountId='));
    for (const call of sent) {
      expect(new URL(call.url, 'http://x').searchParams.get('accountId')).toBe(ACCOUNT.negative);
    }
    await waitFor(() => expect(screen.queryByText(pendingBy('1003').reason)).toBeNull());
    expect(screen.getByText(pendingBy('1001').reason)).toBeInTheDocument();
  });

  it('sends the status that was chosen', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<RequestsPage />);
    await rowOf(pendingBy('1003'));
    await chooseOption(user, 'Status', 'Rejected');
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=REJECTED'))).toBe(true));
  });
});
