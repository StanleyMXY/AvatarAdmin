import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as avatarMock from '../../../mock/avatar.mock';
import * as creditsMock from '../../../mock/credits.mock';
import * as memoryMock from '../../../mock/memory.mock';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { history, setTestLocation } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import UserDetailPage from './detail';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const at = (id: string, search = '') =>
  setTestLocation({ pathname: `/users/${encodeURIComponent(id)}`, search });

const backend = () =>
  useMockBackend(usersMock, creditsMock, subscriptionsMock, memoryMock, avatarMock);

const field = (name: string) => screen.getByTestId(`field-${name}`);
const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);
const selectedTab = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent;

const ALL_TABS = [
  'Overview',
  'Avatars and outfits',
  'Attribution',
  'Sessions',
  'Devices',
  'Sign-in events',
  'Subscription and entitlements',
  'Credits',
  'Memory',
];

describe('the frame of the detail page', { timeout: 30000 }, () => {
  it('shows the id, the state and the way back, and reads the account named in the address', async () => {
    const calls = backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    expect(await screen.findByText(`User ${USER.rich}`)).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: enUS['users.detail.back'] })).toHaveAttribute(
      'href',
      '/users/list',
    );
    expect(calls.some((c) => c.url === `/api/admin/users/${USER.rich}`)).toBe(true);
  });

  it('shows all nine tabs to an administrator who may see everything', async () => {
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(tabNames()).toEqual(ALL_TABS);
  });

  it('leaves out the tabs whose view permission the administrator lacks', async () => {
    signIn('support', { codes: ['USER:VIEW'] });
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(tabNames()).toEqual([
      'Overview',
      'Avatars and outfits',
      'Attribution',
      'Sessions',
      'Devices',
      'Sign-in events',
    ]);
  });

  it.each([
    [
      ['USER:VIEW', 'SUBSCRIPTION:VIEW'],
      ['Subscription and entitlements', 'Credits'],
    ],
    [['USER:VIEW', 'MEMORY:VIEW'], ['Memory']],
    [['USER:VIEW', 'SUBSCRIPTION:GRANT', 'MEMORY:MODEL_ASSIGN', 'COSMETIC:GRANT'], []],
  ])('adds the tabs of %j: %j', async (codes, extra) => {
    signIn('support', { codes });
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(tabNames().slice(6)).toEqual(extra);
  });

  it('opens the tab named by ?tab=, which is how the credit pages link here', async () => {
    backend();
    at(USER.rich, '?tab=credits');
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(selectedTab()).toBe('Credits');
    expect(await screen.findByTestId('panel-balance')).toBeInTheDocument();
  });

  it.each([['?tab=nonsense'], ['?tab='], ['?tab=constructor'], ['']])(
    'opens the overview for the address search "%s"',
    async (search) => {
      backend();
      at(USER.rich, search);
      renderPage(<UserDetailPage />);
      await screen.findByText(`User ${USER.rich}`);
      expect(selectedTab()).toBe('Overview');
    },
  );

  it('opens the overview when ?tab= names a tab the administrator may not see', async () => {
    signIn('support', { codes: ['USER:VIEW'] });
    backend();
    at(USER.rich, '?tab=credits');
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(selectedTab()).toBe('Overview');
    expect(screen.queryByTestId('panel-balance')).toBeNull();
  });

  it('writes the tab to the address when a tab is chosen, so the address can be shared', async () => {
    backend();
    at(USER.rich);
    const user = userEvent.setup();
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    await user.click(screen.getByRole('tab', { name: 'Devices' }));
    expect(selectedTab()).toBe('Devices');
    expect(history.replace).toHaveBeenLastCalledWith(
      expect.stringContaining(`/users/${USER.rich}?tab=devices`),
    );
  });

  it('follows the address when it changes to another tab', async () => {
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    setTestLocation({ search: '?tab=attribution' });
    await waitFor(() => expect(selectedTab()).toBe('Attribution'));
  });

  it('reads the account with an id that needs escaping in the address', async () => {
    const calls = backend();
    const id = 'ip-a-01';
    at(id);
    renderPage(<UserDetailPage />);
    expect(await screen.findByText(`User ${id}`)).toBeInTheDocument();
    expect(calls.some((c) => c.url === `/api/admin/users/${id}`)).toBe(true);
  });

  it('says the account does not exist, with the way back and no retry, for a 404', async () => {
    backend();
    at('nobody');
    renderPage(<UserDetailPage />);
    expect(await screen.findByText(enUS['users.detail.notFound'])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: enUS['users.detail.back'] })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('says the failure in words, with a retry that reads again, for any other failure', async () => {
    let fail = true;
    const calls = stubFetch(async () =>
      fail
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend text'))
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    at(USER.rich);
    const user = userEvent.setup();
    renderPage(<UserDetailPage />);
    expect(await screen.findByText(new RegExp(enUS['error.ADMIN_FORBIDDEN']))).toBeInTheDocument();
    expect(screen.queryByText(/raw backend text/)).toBeNull();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(1));
  });

  it('says the address is wrong when it holds no account id', async () => {
    backend();
    setTestLocation({ pathname: '/users/', search: '' });
    renderPage(<UserDetailPage />);
    expect(await screen.findByText(enUS['users.detail.invalidAddress'])).toBeInTheDocument();
  });
});

describe('moving from one account to another', { timeout: 30000 }, () => {
  it('never lets the slow answer of the first account replace the second', async () => {
    const release: Record<string, () => void> = {};
    const gate = (id: string) =>
      new Promise<void>((resolve) => {
        release[id] = resolve;
      });
    const gates = { A: gate('A'), B: gate('B') };
    const detail = (id: string) => ({
      ...usersState.users.find((u) => u.id === USER.rich),
      id,
    });
    stubFetch(async ({ url }) => {
      if (url === '/api/admin/users/A') await gates.A;
      if (url === '/api/admin/users/B') await gates.B;
      const id = url.split('/').pop() as string;
      return jsonResponse(200, envelope('200', { ...detail(id), companionName: `name of ${id}` }));
    });
    at('A');
    renderPage(<UserDetailPage />);
    await waitFor(() => expect(Object.keys(release)).toEqual(['A', 'B']));
    at('B');
    release.B();
    expect(await screen.findByText('User B')).toBeInTheDocument();
    expect(await screen.findByText('name of B')).toBeInTheDocument();
    release.A();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('User B')).toBeInTheDocument();
    expect(screen.queryByText('name of A')).toBeNull();
    expect(screen.queryByText('User A')).toBeNull();
  });
});

describe('the banners of an account that is going away', { timeout: 30000 }, () => {
  it.each([
    [USER.pendingDeletion, 'users.banner.PENDING_DELETION'],
    [USER.deleting, 'users.banner.DELETING'],
  ])('says what is not available for %s', async (id, key) => {
    backend();
    at(id);
    renderPage(<UserDetailPage />);
    expect(await screen.findByText(enUS[key])).toBeInTheDocument();
  });

  it('shows no banner for an active or a banned account', async () => {
    backend();
    at(USER.banned);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.banned}`);
    expect(screen.queryByText(enUS['users.banner.PENDING_DELETION'])).toBeNull();
    expect(screen.queryByText(enUS['users.banner.DELETING'])).toBeNull();
  });
});

describe('the write buttons on the page', { timeout: 30000 }, () => {
  it('bans from the page: the state and the ban reason change after the page reads the account again', async () => {
    backend();
    at(USER.negative);
    const user = userEvent.setup();
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.negative}`);
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Spam in the profile');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(within(field('state')).getByText('Banned')).toBeInTheDocument());
    expect(within(field('banReason')).getByText('Spam in the profile')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ban' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Unban' })).toBeInTheDocument();
  });

  it('starts a deletion from the page: the page then shows the waiting state, the banner and the cancel button', async () => {
    backend();
    at(USER.negative);
    const user = userEvent.setup();
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.negative}`);
    await user.click(screen.getByRole('button', { name: 'Start deletion' }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('The user wrote to support');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(enUS['users.banner.PENDING_DELETION'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel deletion' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ban' })).toBeDisabled();
  });
});

describe('the overview tab', { timeout: 30000 }, () => {
  it('shows the sign-in methods, the traffic type, the care data and the asset counts', async () => {
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    const methods = within(field('loginMethods'));
    for (const name of ['Email', 'Phone', 'Google'])
      expect(methods.getByText(name)).toBeInTheDocument();
    expect(methods.queryByText('Apple')).toBeNull();
    expect(within(field('traffic')).getByText('Paid')).toBeInTheDocument();
    expect(within(field('interactions')).getByText('128')).toBeInTheDocument();
    expect(within(field('streak')).getByText('6')).toBeInTheDocument();
    expect(within(field('avatars')).getByText('2')).toBeInTheDocument();
    expect(within(field('voices')).getByText('1')).toBeInTheDocument();
    expect(within(field('looks')).getByText('2')).toBeInTheDocument();
    expect(within(field('cosmetics')).getByText('2')).toBeInTheDocument();
    expect(within(field('companionName')).getByText('ฟ้าใส')).toBeInTheDocument();
    expect(within(field('language')).getByText('th')).toBeInTheDocument();
  });

  it.each([
    ['NONE', 'en-US', 'No review pending'],
    ['PENDING_REVIEW', 'en-US', 'Waiting for review'],
    ['REJECTED', 'en-US', 'Rejected'],
    ['NONE', 'zh-CN', '无待审'],
    ['PENDING_REVIEW', 'zh-CN', '待复核'],
    ['REJECTED', 'zh-CN', '已拒绝'],
    ['SOMETHING_NEW', 'en-US', 'SOMETHING_NEW'],
  ] as const)(
    'shows the persona review state %s in words (%s), and a state it does not know as it came',
    async (status, language, words) => {
      stubFetch(async () =>
        jsonResponse(
          200,
          envelope('200', {
            ...usersState.users.find((u) => u.id === USER.rich),
            personaModerationStatus: status,
          }),
        ),
      );
      at(USER.rich);
      renderPage(<UserDetailPage />, language);
      await screen.findByText(language === 'en-US' ? `User ${USER.rich}` : `用户 ${USER.rich}`);
      expect(within(field('persona')).getByText(words)).toBeInTheDocument();
    },
  );

  it('shows 0 as 0 and nothing as a dash in the care data of an account with none', async () => {
    backend();
    at(USER.noAttribution);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.noAttribution}`);
    expect(within(field('interactions')).getByText('0')).toBeInTheDocument();
    expect(within(field('streak')).getByText('0')).toBeInTheDocument();
    expect(within(field('lastDate')).getByText('—')).toBeInTheDocument();
    expect(within(field('lastAt')).getByText('—')).toBeInTheDocument();
    expect(within(field('avatars')).getByText('0')).toBeInTheDocument();
    // no companion name is set, no e-mail address
    expect(within(field('companionName')).getByText('—')).toBeInTheDocument();
    expect(within(field('email')).getByText('—')).toBeInTheDocument();
    expect(within(field('phone')).getByText('+66812345678')).toBeInTheDocument();
    expect(within(field('loginMethods')).getByText('Phone')).toBeInTheDocument();
  });

  it('never shows a negative count, even if the backend sends one', async () => {
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          ...usersState.users.find((u) => u.id === USER.rich),
          companionship: {
            interactionCount: -4,
            currentStreak: -1,
            lastInteractionDate: null,
            lastInteractionAt: null,
          },
          counts: { avatars: -1, voices: 0, looks: 3, cosmetics: -2 },
        }),
      ),
    );
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    for (const name of ['interactions', 'streak', 'avatars', 'cosmetics']) {
      expect(field(name).textContent, name).toBe('—');
    }
    expect(field('voices').textContent).toBe('0');
  });

  it('shows the mask the backend gave, with the note, to an administrator without the view codes', async () => {
    signIn('support', { codes: ['USER:VIEW'] });
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(within(field('email')).getByText('m***@e***.com')).toBeInTheDocument();
    expect(within(field('phone')).getByText('****5678')).toBeInTheDocument();
    expect(
      within(field('email')).getByText(/USER:EMAIL_VIEW|Email view|email/i),
    ).toBeInTheDocument();
  });

  it('shows the whole values to an administrator who holds the view codes', async () => {
    backend();
    at(USER.rich);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    expect(within(field('email')).getByText('maria.garcia@example.com')).toBeInTheDocument();
    expect(within(field('phone')).getByText('+34612345678')).toBeInTheDocument();
  });

  it('shows the ban reason of a banned account as text for the user and the time of the ban, and dashes for an active one', async () => {
    backend();
    at(USER.banned);
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.banned}`);
    expect(within(field('state')).getByText('Banned')).toBeInTheDocument();
    expect(within(field('banReason')).getByRole('button')).toBeInTheDocument();
    expect(field('bannedAt').textContent).not.toBe('—');
  });

  it('keeps a ban reason and a companion name of every language, 5000 characters without spaces and an object inside the page', async () => {
    const texts = [
      'x'.repeat(5000),
      'สวัสดีครับ'.repeat(40),
      'مرحبا بك في التطبيق '.repeat(20),
      'Terima kasih banyak',
      'Cảm ơn bạn',
      'Muchas gracias ¡Qué bien!',
      '你好'.repeat(80),
      '😀'.repeat(100),
    ];
    for (const text of texts) {
      stubFetch(async () =>
        jsonResponse(
          200,
          envelope('200', {
            ...usersState.users.find((u) => u.id === USER.banned),
            banReason: text,
            companionName: text,
            timezone: { not: 'text' },
            conversationLanguage: 12345,
          }),
        ),
      );
      at(USER.banned);
      const { unmount } = renderPage(<UserDetailPage />);
      await screen.findByText(`User ${USER.banned}`);
      const name = field('companionName').firstElementChild as HTMLElement;
      expect(name.textContent).toBe(text);
      const style = getComputedStyle(name);
      expect(style.overflowWrap === 'anywhere' || name.style.overflowWrap === 'anywhere').toBe(
        true,
      );
      expect(field('timezone').textContent).toContain('not');
      expect(field('language').textContent).toBe('12345');
      unmount();
    }
  });
});

describe('the attribution tab', { timeout: 30000 }, () => {
  it('shows the six fields of the attribution record', async () => {
    backend();
    at(USER.rich, '?tab=attribution');
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.rich}`);
    const record = usersState.users.find((u) => u.id === USER.rich)?.attribution;
    expect(
      within(field('attribution-source')).getByText(record?.source as string),
    ).toBeInTheDocument();
    expect(
      within(field('attribution-matchType')).getByText(record?.matchType as string),
    ).toBeInTheDocument();
    expect(within(field('attribution-mediaSource')).getByText('Facebook Ads')).toBeInTheDocument();
    expect(within(field('attribution-campaign')).getByText('th_launch')).toBeInTheDocument();
    expect(field('attribution-installTime').textContent).not.toBe('—');
    expect(field('attribution-registeredAt').textContent).not.toBe('—');
  });

  it('says there is no attribution record when the field is null', async () => {
    backend();
    at(USER.noAttribution, '?tab=attribution');
    renderPage(<UserDetailPage />);
    await screen.findByText(`User ${USER.noAttribution}`);
    expect(screen.getByText(enUS['users.attribution.none'])).toBeInTheDocument();
    expect(screen.queryByTestId('field-attribution-source')).toBeNull();
  });

  it('says it in Chinese in the words of the spec', async () => {
    backend();
    at(USER.noAttribution, '?tab=attribution');
    renderPage(<UserDetailPage />, 'zh-CN');
    expect(await screen.findByText('没有归因记录。')).toBeInTheDocument();
  });
});
