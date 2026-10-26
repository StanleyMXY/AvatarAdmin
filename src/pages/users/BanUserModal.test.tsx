import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { BanUserModal } from './BanUserModal';
import { openDialog, signIn } from './testSetup';

beforeEach(() => signIn('support'));
afterEach(() => vi.unstubAllGlobals());

const bans = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === 'POST' && c.url.endsWith('/ban'));

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Ban' }));
  return openDialog();
};

describe('the ban button', { timeout: 30000 }, () => {
  it('is not drawn for an administrator without USER:BAN', () => {
    signIn('support', { codes: ['USER:VIEW'] });
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Ban' })).toBeNull();
  });

  it('is usable for an active account', () => {
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ban' })).toBeEnabled();
  });

  it.each(['PENDING_DELETION', 'DELETING', 'BANNED'])(
    'is disabled for an account in the state %s',
    (status) => {
      renderPage(<BanUserModal accountId={USER.negative} status={status} onDone={() => {}} />);
      expect(screen.getByRole('button', { name: 'Ban' })).toBeDisabled();
    },
  );
});

describe('the ban dialog', { timeout: 30000 }, () => {
  it('says that the reason is shown to the user in one language, and what a ban does and does not do', async () => {
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await open(userEvent.setup());
    expect(within(dialog).getByText(enUS['users.ban.hint'])).toBeInTheDocument();
    expect(within(dialog).getByText(enUS['users.ban.consequence'])).toBeInTheDocument();
  });

  it('says it in the words of the spec in Chinese', async () => {
    renderPage(
      <BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />,
      'zh-CN',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /封\s*禁/ }));
    const dialog = await openDialog();
    expect(within(dialog).getByText('这是写给用户看的文字，只有一种语言。')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '封禁会立即结束该账号进行中的通话，不作废登录令牌，解封后原令牌继续可用。',
      ),
    ).toBeInTheDocument();
    expect(zhCN['users.ban.hint']).toContain('只有一种语言');
  });

  it('refuses an empty reason and one over 500 code points without sending anything', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a reason')).toBeInTheDocument();
    const box = within(dialog).getByRole('textbox');
    await user.click(box);
    await user.paste('😀'.repeat(501));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The reason needs 1 to 500 characters'),
    ).toBeInTheDocument();
    expect(bans(calls)).toHaveLength(0);
  });

  it('takes 500 code points (emoji count once), sends the reason trimmed, once, and tells the page', async () => {
    const calls = useMockBackend(usersMock);
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={onDone} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste(`  ${'😀'.repeat(500)}  `);
    const ok = within(dialog).getByRole('button', { name: 'Submit' });
    await user.dblClick(ok);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(bans(calls)).toHaveLength(1);
    expect(calls.find((c) => c.url.endsWith('/ban'))?.body).toEqual({ reason: '😀'.repeat(500) });
    expect(usersState.users.find((u) => u.id === USER.negative)?.status).toBe('BANNED');
  });

  it.each([
    ['Thai', 'สแปมลิงก์โฆษณาซ้ำๆ'],
    ['Arabic', 'روابط إعلانية متكررة'],
    ['Indonesian', 'Tautan iklan berulang'],
    ['Vietnamese', 'Liên kết quảng cáo lặp lại'],
    ['Spanish', 'Enlaces publicitarios repetidos'],
    ['Chinese', '重复的广告链接'],
  ])('sends a reason in %s as it is', async (_name, reason) => {
    const calls = useMockBackend(usersMock);
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={onDone} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste(reason);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((c) => c.url.endsWith('/ban'))?.body).toEqual({ reason });
  });

  it('refuses 5000 characters without spaces', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Q'.repeat(5000));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The reason needs 1 to 500 characters'),
    ).toBeInTheDocument();
    expect(bans(calls)).toHaveLength(0);
  });

  it('shows the state in words when the account changed under the administrator, keeps the dialog open and asks the page to read again', async () => {
    useMockBackend(usersMock);
    // the page still thinks the account is active, the backend has banned it meanwhile
    const account = usersState.users.find((u) => u.id === USER.negative);
    if (account) account.status = 'BANNED';
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={onDone} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Spam');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(`${enUS['error.INVALID_STATE']} The account is now: Banned.`),
    ).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByText(/backend/)).toBeNull();
  });

  it('shows only the translated text of a known error code, never the backend message', async () => {
    stubFetch(async () =>
      jsonResponse(403, envelope('ACCOUNT_DELETING', null, 'the backend message')),
    );
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Spam');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText(enUS['error.ACCOUNT_DELETING'])).toBeInTheDocument();
    expect(within(dialog).queryByText(/the backend message/)).toBeNull();
  });

  it('does not repeat the request when the token expires during it', async () => {
    const calls = stubFetch(async () =>
      jsonResponse(401, envelope('ADMIN_INVALID_TOKEN', null, 'expired')),
    );
    const user = userEvent.setup();
    renderPage(<BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Spam');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.url.endsWith('/ban'))).toHaveLength(1);
  });
});
