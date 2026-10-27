import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import channelsMock from '../../../mock/channels.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import type { Surface } from '../../services/avatar';
import { SurfacesPicker } from './SurfacesPicker';
import { chooseOption, signIn } from './testSetup';

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  signIn('root');
  useMockBackend({ default: channelsMock });
});

/** The picker as a form would hold it: the value is kept and shown again. */
function Harness({ start = [], seen }: { start?: Surface[]; seen: (v: Surface[]) => void }) {
  const [value, setValue] = useState<Surface[]>(start);
  return (
    <SurfacesPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        seen(next);
      }}
    />
  );
}

describe('SurfacesPicker', () => {
  it('shows "All ends" when nothing is chosen, and the value stays the empty list', async () => {
    const seen = vi.fn();
    renderPage(<Harness seen={seen} />);
    expect(
      await screen.findByText('Nothing is chosen, so the item is shown on all ends.'),
    ).toBeInTheDocument();
    expect(seen).not.toHaveBeenCalled();
  });

  it('writes "all channels of a platform" as a null channel', async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    renderPage(<Harness seen={seen} />);
    await chooseOption(user, 'Android', 'All channels of the platform');
    expect(seen).toHaveBeenLastCalledWith([{ platform: 'ANDROID', channel: null }]);
    expect(
      screen.getByText('The item is shown only on the ends chosen above.'),
    ).toBeInTheDocument();
  });

  it('writes a chosen channel by its code, from the channels of that platform only', async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    renderPage(<Harness seen={seen} />);
    await chooseOption(user, 'Android', 'play · Android store');
    expect(seen).toHaveBeenLastCalledWith([{ platform: 'ANDROID', channel: 'play' }]);
    await chooseOption(user, 'iOS', 'appstore · iOS store');
    expect(seen).toHaveBeenLastCalledWith([
      { platform: 'ANDROID', channel: 'play' },
      { platform: 'IOS', channel: 'appstore' },
    ]);
    // The iOS box lists the iOS channels and not the Android ones.
    await userEvent.click(screen.getByRole('combobox', { name: 'iOS' }));
    // happy-dom never ends the closing animation of the Android box: take the one that is not closing.
    const dropdown = [...document.querySelectorAll('.ant-select-dropdown')].find(
      (box) => !/-leave|-hidden/.test(box.className),
    );
    expect(dropdown).toBeTruthy();
    const listed = within(dropdown as HTMLElement);
    expect(listed.queryAllByText('appstore · iOS store').length).toBeGreaterThan(0);
    expect(listed.queryAllByText('direct · Direct download')).toHaveLength(0);
    expect(listed.queryAllByText('play · Android store')).toHaveLength(0);
  });

  it('takes the single channels away when "all channels" is chosen, and the other way round', async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    renderPage(<Harness start={[{ platform: 'ANDROID', channel: 'play' }]} seen={seen} />);
    await chooseOption(user, 'Android', 'All channels of the platform');
    expect(seen).toHaveBeenLastCalledWith([{ platform: 'ANDROID', channel: null }]);
    await chooseOption(user, 'Android', 'direct · Direct download');
    expect(seen).toHaveBeenLastCalledWith([{ platform: 'ANDROID', channel: 'direct' }]);
  });

  it('shows what a stored list holds, also a channel that the channel list no longer has', async () => {
    renderPage(
      <Harness
        start={[
          { platform: 'ANDROID', channel: 'retired_channel' },
          { platform: 'IOS', channel: null },
        ]}
        seen={() => {}}
      />,
    );
    expect(await screen.findByText('retired_channel')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-select-selection-item')).toHaveLength(2),
    );
  });
});
