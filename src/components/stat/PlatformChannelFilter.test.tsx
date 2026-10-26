import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetSessionState, setToken } from '../../request/session';
import { resetChannelsCache } from '../ChannelSelect';
import { PlatformChannelFilter } from './PlatformChannelFilter';

const channels = [
  {
    channelCode: 'play',
    name: 'Google Play',
    platform: 'ANDROID',
    distribution: 'STORE',
    packageName: 'a.b',
    enabled: true,
    createdAt: null,
  },
  {
    channelCode: 'direct',
    name: 'Direct',
    platform: 'ANDROID',
    distribution: 'DIRECT',
    packageName: 'a.c',
    enabled: true,
    createdAt: null,
  },
];

beforeEach(() => {
  resetChannelsCache();
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const options = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('combobox', { name: label }));
  return [...document.querySelectorAll('.ant-select-item-option')].map((o) =>
    o.getAttribute('title'),
  );
};

describe('PlatformChannelFilter', () => {
  it('offers All, Android and iOS for the platform', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: channels })));
    const user = userEvent.setup();
    renderPage(
      <PlatformChannelFilter value={{ platform: 'ALL', channel: 'ALL' }} onChange={() => {}} />,
    );
    expect(await options(user, 'Platform')).toEqual(['All', 'Android', 'iOS']);
  });

  it('offers All plus the channels from the backend for the channel, asking once', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: channels })));
    const user = userEvent.setup();
    renderPage(
      <PlatformChannelFilter value={{ platform: 'ALL', channel: 'ALL' }} onChange={() => {}} />,
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/admin/channels');
    await waitFor(async () => {
      expect(await options(user, 'Channel package')).toEqual([
        'All',
        'play · Google Play',
        'direct · Direct',
      ]);
    });
  });

  it('reports a change of platform with the channel kept', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: channels })));
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <PlatformChannelFilter
        value={{ platform: 'ANDROID', channel: 'play' }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('iOS'));
    expect(onChange).toHaveBeenLastCalledWith({ platform: 'IOS', channel: 'play' });
  });

  it('reports a change of channel with the platform kept', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: channels })));
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <PlatformChannelFilter value={{ platform: 'IOS', channel: 'ALL' }} onChange={onChange} />,
    );
    await waitFor(async () => {
      expect(await options(user, 'Channel package')).toContain('direct · Direct');
    });
    await user.click(await screen.findByTitle('direct · Direct'));
    expect(onChange).toHaveBeenLastCalledWith({ platform: 'IOS', channel: 'direct' });
  });

  it('has no platform dropdown when the report has no platform', () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: [] })));
    renderPage(
      <PlatformChannelFilter
        value={{ platform: 'ALL', channel: 'ALL' }}
        onChange={() => {}}
        withPlatform={false}
      />,
    );
    expect(screen.queryByRole('combobox', { name: 'Platform' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Channel package' })).toBeInTheDocument();
  });

  it('reads the channels once for several dropdowns, and still works when they cannot be read', async () => {
    const calls = stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR')));
    renderPage(
      <>
        <PlatformChannelFilter value={{ platform: 'ALL', channel: 'ALL' }} onChange={() => {}} />
        <PlatformChannelFilter value={{ platform: 'ALL', channel: 'ALL' }} onChange={() => {}} />
      </>,
    );
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls).toHaveLength(1);
    expect(screen.getAllByRole('combobox', { name: 'Channel package' })).toHaveLength(2);
  });
});
