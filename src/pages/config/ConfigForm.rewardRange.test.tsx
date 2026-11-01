import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetStore } from '../../../mock/_core/store';
import * as configMock from '../../../mock/config.mock';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { ConfigForm } from './ConfigForm';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  resetConfigStore();
});

const row = (key: string) => screen.findByTestId(`config-row-${key}`);
const KEYS = ['invite.reward_start_at', 'invite.reward_end_at'];

async function save(key: string, value: string) {
  const r = await row(key);
  fireEvent.change(within(r).getByRole('textbox'), { target: { value } });
  fireEvent.click(within(r).getByRole('button', { name: /^(Save|保\s?存)$/ }));
  return r;
}

describe('ConfigForm: the start of the invite reward must be earlier than its end', () => {
  it('says on both rows, in the words of the pair, that the start has to be earlier than the end', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={KEYS} />);
    await save('invite.reward_end_at', '2026-11-30T00:00:00Z');
    await waitFor(() =>
      expect(screen.getByTestId('config-row-invite.reward_end_at')).toHaveTextContent('Modified'),
    );
    const start = await save('invite.reward_start_at', '2026-12-01T00:00:00Z');
    await waitFor(() => expect(within(start).getByRole('alert')).toBeInTheDocument());
    const words = 'The start of the reward has to be earlier than its end.';
    expect(within(start).getByRole('alert')).toHaveTextContent(words);
    expect(
      within(screen.getByTestId('config-row-invite.reward_end_at')).getByRole('alert'),
    ).toHaveTextContent(words);
  });

  it('says it in Chinese too', async () => {
    signInAs('root');
    useMockBackend(configMock);
    renderPage(<ConfigForm keys={KEYS} />, 'zh-CN');
    await save('invite.reward_end_at', '2026-11-30T00:00:00Z');
    await waitFor(() =>
      expect(screen.getByTestId('config-row-invite.reward_end_at')).toHaveTextContent('已修改'),
    );
    const start = await save('invite.reward_start_at', '2026-12-01T00:00:00Z');
    await waitFor(() => expect(within(start).getByRole('alert')).toBeInTheDocument());
    expect(within(start).getByRole('alert')).toHaveTextContent('奖励的开始时间必须早于结束时间。');
  });
});
