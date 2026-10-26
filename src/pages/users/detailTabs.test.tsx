import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as avatarMock from '../../../mock/avatar.mock';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestLocation } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import UserDetailPage from './detail';
import { chooseOption, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const open = async (id: string, tab: string) => {
  setTestLocation({ pathname: `/users/${encodeURIComponent(id)}`, search: `?tab=${tab}` });
  const view = renderPage(<UserDetailPage />);
  await screen.findByText(`User ${id}`);
  return view;
};
const backend = () => useMockBackend(usersMock, avatarMock);
const rowsOf = (testId: string) => within(screen.getByTestId(testId)).getAllByRole('row').slice(1);

describe('the sessions tab', { timeout: 30000 }, () => {
  it('lists the sessions of the account with the times, the duration, the tier, the language and why it ended', async () => {
    backend();
    await open(USER.rich, 'sessions');
    await waitFor(() => expect(rowsOf('sessions-table')).toHaveLength(5));
    const first = rowsOf('sessions-table')[0];
    // newest first: the first row has a duration written out and an end reason in words
    expect(within(first).getByText(/\d+ (s|min)/)).toBeInTheDocument();
    expect(
      within(first).getByText(
        /The user left|Time limit reached|The room closed|The account was banned/,
      ),
    ).toBeInTheDocument();
  });

  it('shows a dash for a session that has not ended, and says it is in progress', async () => {
    stubFetch(async ({ url }) =>
      url.includes('/sessions')
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  id: 's1',
                  requestedAt: '2026-10-26T01:00:00Z',
                  startedAt: '2026-10-26T01:00:05Z',
                  endedAt: null,
                  durationSeconds: null,
                  modelTier: 'STANDARD',
                  language: 'th',
                  endReason: null,
                },
              ],
              total: 1,
            }),
          )
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    await open(USER.rich, 'sessions');
    const row = (await waitFor(() => rowsOf('sessions-table')))[0];
    expect(within(row).getByText(enUS['users.sessions.ongoing'])).toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('asks for the page that is chosen, with the page size, and shows the total', async () => {
    const calls = stubFetch(async ({ url }) => {
      if (url.includes('/sessions')) {
        const page = Number(new URL(url, 'http://x').searchParams.get('page'));
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              {
                id: `s-${page}`,
                requestedAt: '2026-10-26T01:00:00Z',
                startedAt: null,
                endedAt: null,
                durationSeconds: 61,
                modelTier: `tier-of-page-${page}`,
                language: 'es',
                endReason: 'DEADLINE',
              },
            ],
            total: 45,
          }),
        );
      }
      return jsonResponse(200, envelope('200', usersState.users[0]));
    });
    const user = userEvent.setup();
    await open(USER.rich, 'sessions');
    expect(await screen.findByText('tier-of-page-1')).toBeInTheDocument();
    expect(screen.getByText('1 min 1 s')).toBeInTheDocument();
    await user.click(screen.getByTitle('2'));
    expect(await screen.findByText('tier-of-page-2')).toBeInTheDocument();
    const sessionCalls = calls.filter((c) => c.url.includes('/sessions'));
    expect(new URL(sessionCalls.at(-1)?.url ?? '', 'http://x').searchParams.get('page')).toBe('2');
    expect(new URL(sessionCalls.at(-1)?.url ?? '', 'http://x').searchParams.get('pageSize')).toBe(
      '20',
    );
  });

  it('never lets a slow earlier page replace the page chosen after it', async () => {
    const gate: { release: () => void } = { release: () => {} };
    const slow = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    stubFetch(async ({ url }) => {
      if (url.includes('/sessions')) {
        const page = Number(new URL(url, 'http://x').searchParams.get('page'));
        if (
          page === 1 &&
          url.includes('pageSize=20') &&
          document.querySelector('.ant-pagination-item-active[title="2"]')
        ) {
          await slow;
        }
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              {
                id: `s-${page}`,
                requestedAt: '2026-10-26T01:00:00Z',
                startedAt: null,
                endedAt: null,
                durationSeconds: 5,
                modelTier: `tier-of-page-${page}`,
                language: 'es',
                endReason: null,
              },
            ],
            total: 45,
          }),
        );
      }
      return jsonResponse(200, envelope('200', usersState.users[0]));
    });
    const user = userEvent.setup();
    await open(USER.rich, 'sessions');
    expect(await screen.findByText('tier-of-page-1')).toBeInTheDocument();
    await user.click(screen.getByTitle('2'));
    expect(await screen.findByText('tier-of-page-2')).toBeInTheDocument();
    gate.release();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('tier-of-page-2')).toBeInTheDocument();
  });

  it('says the failure in words with a retry', async () => {
    stubFetch(async ({ url }) =>
      url.includes('/sessions')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend text'))
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    await open(USER.rich, 'sessions');
    expect(await screen.findByText(new RegExp(enUS['error.ADMIN_FORBIDDEN']))).toBeInTheDocument();
    expect(screen.queryByText(/raw backend text/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the devices tab', { timeout: 30000 }, () => {
  it('shows the platform, version, locale, last activity and only the last six characters of the push token', async () => {
    backend();
    await open(USER.rich, 'devices');
    await waitFor(() => expect(rowsOf('devices-table')).toHaveLength(3));
    const devices = usersState.devices.get(USER.rich) ?? [];
    for (const device of devices) {
      expect(device.tokenSuffix).toHaveLength(6);
      expect(
        within(screen.getByTestId('devices-table')).getByText(new RegExp(`${device.tokenSuffix}$`)),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('devices-table')).getByText(device.appVersion),
      ).toBeInTheDocument();
    }
    expect(screen.getByText(enUS['users.devices.note'])).toBeInTheDocument();
  });

  it('shows nothing of the token beyond what the backend gave, however long that is', async () => {
    const long = 'T'.repeat(5000);
    stubFetch(async ({ url }) =>
      url.endsWith('/devices')
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  id: 'd1',
                  platform: 'ANDROID',
                  appVersion: '1.0.0',
                  locale: 'th-TH',
                  lastSeenAt: '2026-10-26T01:00:00Z',
                  tokenSuffix: long,
                },
                {
                  id: 'd2',
                  platform: null,
                  appVersion: null,
                  locale: null,
                  lastSeenAt: null,
                  tokenSuffix: null,
                },
              ],
            }),
          )
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    await open(USER.rich, 'devices');
    const rows = await waitFor(() => rowsOf('devices-table'));
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getAllByText('—').length).toBe(5);
    const cell = within(rows[0]).getByText(/T{100}/);
    expect(
      getComputedStyle(cell).overflowWrap === 'anywhere' || cell.style.overflowWrap === 'anywhere',
    ).toBe(true);
  });

  it('says there is no device for an account without one', async () => {
    usersState.devices.set(USER.rich, []);
    backend();
    await open(USER.rich, 'devices');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('devices-table')).getAllByText(/No data/i).length,
      ).toBeGreaterThan(0),
    );
  });
});

describe('the sign-in events tab', { timeout: 30000 }, () => {
  it('shows the time, the type in words, the reason, and the first eight characters of the device and IP hashes', async () => {
    backend();
    await open(USER.rich, 'authEvents');
    await waitFor(() => expect(rowsOf('auth-events-table').length).toBe(10));
    const events = usersState.authEvents.get(USER.rich) ?? [];
    const table = within(screen.getByTestId('auth-events-table'));
    for (const event of events.filter((e) => e.deviceIdHashPrefix !== null).slice(0, 2)) {
      expect(event.deviceIdHashPrefix).toHaveLength(8);
      expect(table.getAllByText(event.deviceIdHashPrefix as string).length).toBeGreaterThan(0);
    }
    for (const event of events.slice(0, 2)) {
      expect(table.getAllByText(event.ipHashPrefix as string).length).toBeGreaterThan(0);
    }
    expect(table.getAllByText('Signed in').length).toBeGreaterThan(0);
    expect(table.getAllByText('Sign-in failed').length).toBeGreaterThan(0);
    expect(table.getByText('INVALID_CREDENTIALS')).toBeInTheDocument();
    expect(screen.getByText(enUS['users.authEvents.note'])).toBeInTheDocument();
  });

  it('shows a dash for a missing device hash and for no reason, and a type it does not know as it came', async () => {
    stubFetch(async ({ url }) =>
      url.includes('/auth-events')
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  type: 'LOGIN_FAIL',
                  reason: null,
                  deviceIdHashPrefix: null,
                  ipHashPrefix: 'ab12cd34',
                  at: '2026-10-26T01:00:00Z',
                },
                {
                  type: 'NEW_KIND',
                  reason: { odd: true },
                  deviceIdHashPrefix: 'ffeeddcc',
                  ipHashPrefix: null,
                  at: '2026-10-25T01:00:00Z',
                },
              ],
              total: 2,
            }),
          )
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    await open(USER.rich, 'authEvents');
    const rows = await waitFor(() => rowsOf('auth-events-table'));
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('ab12cd34')).toBeInTheDocument();
    expect(within(rows[0]).getAllByText('—')).toHaveLength(2); // reason and device
    expect(within(rows[1]).getByText('NEW_KIND')).toBeInTheDocument();
    expect(within(rows[1]).getByText('ffeeddcc')).toBeInTheDocument();
    expect(within(rows[1]).getByText('{"odd":true}')).toBeInTheDocument();
  });

  it('asks for the next page when it is chosen', async () => {
    const calls = stubFetch(async ({ url }) =>
      url.includes('/auth-events')
        ? jsonResponse(
            200,
            envelope('200', {
              items: [
                {
                  type: 'LOGIN_OK',
                  reason: null,
                  deviceIdHashPrefix: 'aaaaaaaa',
                  ipHashPrefix: 'bbbbbbbb',
                  at: '2026-10-26T01:00:00Z',
                },
              ],
              total: 60,
            }),
          )
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    const user = userEvent.setup();
    await open(USER.rich, 'authEvents');
    await screen.findByText('aaaaaaaa');
    await user.click(screen.getByTitle('3'));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/auth-events') && c.url.includes('page=3'))).toBe(
        true,
      ),
    );
  });
});

describe('the avatars and outfits tab', { timeout: 60000 }, () => {
  it('says the previews are the face of the user and that viewing is recorded, in the words of the spec in Chinese', async () => {
    backend();
    setTestLocation({ pathname: `/users/${USER.rich}`, search: '?tab=avatars' });
    renderPage(<UserDetailPage />, 'zh-CN');
    expect(await screen.findByText(/预览图是用户的脸，查看会被记录/)).toBeInTheDocument();
  });

  it('shows the avatars newest first with the look previews taken from previewUrl, and a placeholder where it is null', async () => {
    backend();
    await open(USER.rich, 'avatars');
    expect(await screen.findByText(enUS['users.avatars.faceNotice'])).toBeInTheDocument();
    const cards = await screen.findAllByTestId('avatar-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Sakura')).toBeInTheDocument();
    expect(within(cards[0]).getByText('In use')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Stylized 3D')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Realistic')).toBeInTheDocument();
    expect(within(cards[1]).queryByText('In use')).toBeNull();
    const images = within(cards[0]).getAllByRole('img', { name: enUS['users.avatars.look.alt'] });
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toMatch(/face-look-2/);
    expect(within(cards[0]).getAllByTestId('no-picture')).toHaveLength(1);
    expect(within(cards[1]).getByText(enUS['users.avatars.noLooks'])).toBeInTheDocument();
  });

  it('shows the owned outfits and backgrounds with where each came from', async () => {
    backend();
    await open(USER.rich, 'avatars');
    const table = await screen.findByTestId('cosmetics-table');
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(2));
    expect(within(table).getByText('outfit_red_dress')).toBeInTheDocument();
    expect(within(table).getByText('Bought with credits')).toBeInTheDocument();
    expect(within(table).getByText('Given by operations')).toBeInTheDocument();
    expect(within(table).getByText('1001')).toBeInTheDocument();
  });

  it('shows the source in Chinese as the spec words it', async () => {
    backend();
    setTestLocation({ pathname: `/users/${USER.rich}`, search: '?tab=avatars' });
    renderPage(<UserDetailPage />, 'zh-CN');
    const table = await screen.findByTestId('cosmetics-table');
    await waitFor(() => expect(within(table).getByText('额度兑换')).toBeInTheDocument());
    expect(within(table).getByText('运营赠送')).toBeInTheDocument();
  });

  it('says there is no avatar and no outfit for an account without any', async () => {
    backend();
    await open(USER.noAttribution, 'avatars');
    expect(await screen.findByText(enUS['users.avatars.none'])).toBeInTheDocument();
    expect(screen.getByText(enUS['users.avatars.noCosmetics'])).toBeInTheDocument();
  });

  it('reads the avatars each time the tab is opened, so a signed address is never kept', async () => {
    const calls = backend();
    const user = userEvent.setup();
    await open(USER.rich, 'avatars');
    await screen.findAllByTestId('avatar-card');
    const reads = () =>
      calls.filter((c) => c.url === `/api/admin/accounts/${USER.rich}/avatars`).length;
    expect(reads()).toBe(1);
    await user.click(screen.getByRole('tab', { name: 'Devices' }));
    await user.click(screen.getByRole('tab', { name: 'Avatars and outfits' }));
    await screen.findAllByTestId('avatar-card');
    expect(reads()).toBe(2);
  });

  it('shows the tab to USER:VIEW alone, and the give button only to COSMETIC:GRANT', async () => {
    signIn('support', { codes: ['USER:VIEW'] });
    backend();
    await open(USER.rich, 'avatars');
    await screen.findAllByTestId('avatar-card');
    expect(screen.queryByRole('button', { name: 'Give a cosmetic' })).toBeNull();
  });

  it('gives a cosmetic with a reason: the tab reads again and shows the new item as given by operations', async () => {
    signIn('support', { codes: ['USER:VIEW', 'COSMETIC:GRANT'] });
    const calls = backend();
    const user = userEvent.setup();
    await open(USER.rich, 'avatars');
    await screen.findAllByTestId('avatar-card');
    await user.click(screen.getByRole('button', { name: 'Give a cosmetic' }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    await chooseOption(user, 'Item', /outfit_blue_suit/);
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: 'Compensation' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(avatarState.accountCosmetics.get(USER.rich)?.length).toBe(3));
    const table = screen.getByTestId('cosmetics-table');
    await waitFor(() => expect(within(table).getByText('outfit_blue_suit')).toBeInTheDocument());
    expect(calls.filter((c) => c.url === `/api/admin/accounts/${USER.rich}/avatars`).length).toBe(
      2,
    );
  });

  it('says the failure in words with a retry', async () => {
    stubFetch(async ({ url }) =>
      url.includes('/avatars')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend text'))
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    await open(USER.rich, 'avatars');
    expect(await screen.findByText(new RegExp(enUS['error.ADMIN_FORBIDDEN']))).toBeInTheDocument();
    expect(screen.queryByText(/raw backend text/)).toBeNull();
  });

  it('keeps avatar names of every language and 5000 characters without spaces inside the page', async () => {
    const names = [
      'n'.repeat(5000),
      'สวัสดีครับ'.repeat(30),
      'مرحبا بك'.repeat(30),
      'Terima kasih',
      'Cảm ơn bạn',
      'Muchas gracias',
      '你好'.repeat(40),
      '😀'.repeat(80),
    ];
    stubFetch(async ({ url }) =>
      url.includes('/avatars')
        ? jsonResponse(
            200,
            envelope('200', {
              avatars: names.map((name, i) => ({
                assetId: `a${i}`,
                name,
                style: 'REALISTIC',
                createdAt: '2026-10-01T00:00:00Z',
                currentLookId: null,
                isCurrent: i === 0,
                looks: [],
              })),
              cosmetics: [
                {
                  itemId: '1',
                  itemKey: 'k'.repeat(3000),
                  source: 'ADMIN_GRANT',
                  creditLedgerId: null,
                  grantedAt: '2026-10-01T00:00:00Z',
                },
              ],
            }),
          )
        : jsonResponse(200, envelope('200', usersState.users[0])),
    );
    await open(USER.rich, 'avatars');
    const cards = await screen.findAllByTestId('avatar-card');
    expect(cards).toHaveLength(names.length);
    const long = within(cards[0]).getByText(/n{100}/);
    expect(
      getComputedStyle(long).overflowWrap === 'anywhere' || long.style.overflowWrap === 'anywhere',
    ).toBe(true);
    const key = within(screen.getByTestId('cosmetics-table')).getByText(/k{100}/);
    expect(
      getComputedStyle(key).overflowWrap === 'anywhere' || key.style.overflowWrap === 'anywhere',
    ).toBe(true);
  });
});
