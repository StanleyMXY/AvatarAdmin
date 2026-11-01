import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import { saved } from '../../../mock/_core/configStore';
import campaignMock from '../../../mock/campaign.mock';
import channelsMock from '../../../mock/channels.mock';
import configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import AccountsPage from './accounts';
import {
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  signIn,
  writesOf,
} from './testSetup';

const backend = () =>
  useMockBackend({ default: campaignMock }, { default: configMock }, { default: channelsMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const rowOf = async (code: string) => {
  await waitFor(() => expect(screen.getByText(code)).toBeInTheDocument());
  return screen.getByText(code).closest('tr') as HTMLTableRowElement;
};
const campaignOf = (code: string) => {
  const found = campaignState.campaigns.find((c) => c.code === code);
  if (!found) throw new Error(`no campaign ${code}`);
  return found;
};
const dialog = () => screen.findByRole('dialog');
const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(await dialog()).getByRole('button', { name: 'Submit' }));
};

const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<AccountsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};

describe('the campaign list', () => {
  it('has the columns of the spec in its order', async () => {
    await load();
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      'Campaign ID',
      'Display name',
      'Channel packages',
      'Facebook pixel',
      'Google pixel',
      'TikTok pixel',
      'Status',
      'Created at',
      'Actions',
    ]);
  });

  it('shows the code, the name in any language, the channel packages as tags, the pixels, the state and the actions of each campaign', async () => {
    await load();
    const th = campaignOf('spring_th');
    const row = await rowOf('spring_th');
    const cells = cellsOf(row);
    expect(cells[1]).toBe(th.name);
    expect(cells[2]).toBe('playdirect');
    // a pixel is "Set" with the number in the hover, a missing one is a dash
    expect(cells[3]).toBe('Set');
    expect(cells[4]).toBe('—');
    expect(cells[5]).toBe('—');
    expect(within(row).getByRole('switch')).toBeChecked();
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Generate link' })).toBeInTheDocument();
    for (const campaign of campaignState.campaigns) {
      expect(document.body.textContent).toContain(campaign.name);
    }
    expect((await rowOf('summer_vn')).querySelector('[role="switch"]')).not.toBeChecked();
  });

  it('shows the number of a pixel when the pointer is over it', async () => {
    const { user } = await load();
    const row = await rowOf('spring_th');
    await user.hover(within(row).getByText('Set'));
    expect(await screen.findByText('FB-1000')).toBeInTheDocument();
  });

  it('has a copy button for the code', async () => {
    await load();
    const row = await rowOf('spring_th');
    expect(row.querySelector('.ant-typography-copy, [aria-label="copy"]')).not.toBeNull();
  });

  it('has no button to delete a campaign anywhere', async () => {
    await load();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bDelete\b/);
  });

  it('keeps a name of 5000 characters, an Arabic name and an emoji remark inside the table', async () => {
    backend();
    const first = campaignState.campaigns[0];
    first.name = 'ا'.repeat(5000);
    campaignState.campaigns[1].name = `Promo ${'🎉'.repeat(30)}`;
    renderPage(<AccountsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const buttons = [...document.querySelectorAll('.ant-table-tbody button[data-lines]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect((button as HTMLElement).style.overflowWrap).toBe('anywhere');
    }
  });

  it('does not show the token even when the backend sends it by mistake', async () => {
    backend();
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/attribution/campaigns') return undefined;
      const items = campaignState.campaigns.map((c) => ({
        ...c,
        facebookAccessTokenSet: true,
        facebookAccessToken: 'LEAKED-TOKEN-999',
        createdByUsername: 'root',
      }));
      return jsonAnswer(200, '200', { items, total: items.length });
    });
    renderPage(<AccountsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(document.body.textContent).not.toContain('LEAKED-TOKEN-999');
    expect(document.body.innerHTML).not.toContain('LEAKED-TOKEN-999');
  });

  it('is written in Chinese too', async () => {
    backend();
    renderPage(<AccountsPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      '投放 ID',
      '显示名称',
      '关联渠道包',
      'Facebook 像素',
      'Google 像素',
      'TikTok 像素',
      '状态',
      '创建时间',
      '操作',
    ]);
  });
});

describe('the search', { timeout: 30000 }, () => {
  const lastQuery = (calls: { method: string; url: string }[]) => {
    const reads = calls.filter((c) => c.url.startsWith('/api/admin/attribution/campaigns?'));
    return new URL(reads[reads.length - 1].url, 'http://x').searchParams;
  };

  it('asks for the keyword and the state that were typed, and nothing for what is empty', async () => {
    const { calls, user } = await load();
    expect(lastQuery(calls).has('keyword')).toBe(false);
    expect(lastQuery(calls).has('enabled')).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Keyword' }), 'SPRING{Enter}');
    await waitFor(() => expect(lastQuery(calls).get('keyword')).toBe('SPRING'));
    await waitFor(() => expect(rows().length).toBe(2));
  });

  it('filters by the state', async () => {
    const { calls, user } = await load();
    const select = screen.getByRole('combobox', { name: 'Status' });
    await user.click(select);
    const options = await screen.findAllByText('Disabled', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.type(screen.getByRole('textbox', { name: 'Keyword' }), '{Enter}');
    await waitFor(() => expect(lastQuery(calls).get('enabled')).toBe('false'));
    await waitFor(() => expect(rows().length).toBe(1));
  });
});

describe('the search and the page when the tab is left and opened again', {
  timeout: 60000,
}, () => {
  const campaignReads = (calls: { method: string; url: string }[]) =>
    calls
      .filter((c) => c.url.startsWith('/api/admin/attribution/campaigns?'))
      .map((c) => new URL(c.url, 'http://x').searchParams);

  const withManyCampaigns = async () => {
    const first = campaignState.campaigns[0];
    for (let i = 0; i < 45; i += 1) {
      campaignState.campaigns.push({
        ...first,
        id: String(100 + i),
        code: `bulk_${i}`,
        name: `ชุด ${i}`,
      });
    }
    return load();
  };

  it('shows the keyword and the page that were chosen, and asks for that page first, after another tab was opened and this one again', async () => {
    const { calls, user } = await withManyCampaigns();
    await user.type(screen.getByRole('textbox', { name: 'Keyword' }), 'bulk{Enter}');
    await waitFor(() => expect(campaignReads(calls).at(-1)?.get('keyword')).toBe('bulk'));
    await user.click(await screen.findByRole('listitem', { name: '2' }));
    await waitFor(() => expect(campaignReads(calls).at(-1)?.get('page')).toBe('2'));

    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Keyword' })).toBeNull());
    const before = campaignReads(calls).length;
    await user.click(await screen.findByRole('tab', { name: 'Campaigns' }));

    expect(await screen.findByRole('textbox', { name: 'Keyword' })).toHaveValue('bulk');
    await waitFor(() => expect(campaignReads(calls).length).toBeGreaterThan(before));
    const asked = campaignReads(calls).slice(before);
    expect(asked.every((q) => q.get('keyword') === 'bulk' && q.get('page') === '2')).toBe(true);
    expect(screen.getByRole('listitem', { name: '2' })).toHaveClass('ant-pagination-item-active');
  });

  it('starts empty again after the search was reset before the tab was left', async () => {
    const { calls, user } = await withManyCampaigns();
    await user.type(screen.getByRole('textbox', { name: 'Keyword' }), 'bulk{Enter}');
    await waitFor(() => expect(campaignReads(calls).at(-1)?.get('keyword')).toBe('bulk'));
    await user.click(screen.getByRole('button', { name: /^(Reset|重\s*置)$/ }));
    await waitFor(() => expect(campaignReads(calls).at(-1)?.has('keyword')).toBe(false));
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Keyword' })).toBeNull());
    await user.click(await screen.findByRole('tab', { name: 'Campaigns' }));
    expect(await screen.findByRole('textbox', { name: 'Keyword' })).toHaveValue('');
    await waitFor(() => expect(campaignReads(calls).at(-1)?.get('page')).toBe('1'));
    expect(campaignReads(calls).at(-1)?.has('keyword')).toBe(false);
  });
});

describe('the state switch', () => {
  it('sends the new state at once, with no question, and with the whole campaign but not the code and not the token', async () => {
    const { calls, user } = await load();
    const row = await rowOf('spring_th');
    await user.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write.method).toBe('PUT');
    expect(write.url).toBe(`/api/admin/attribution/campaigns/${campaignOf('spring_th').id}`);
    const body = write.body as Record<string, unknown>;
    expect(body.enabled).toBe(false);
    expect(body.name).toBe(campaignOf('spring_th').name);
    expect(body.channelCodes).toEqual(['play', 'direct']);
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('facebookAccessToken');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await waitFor(() => expect(within(row).getByRole('switch')).not.toBeChecked());
    expect(campaignOf('spring_th').enabled).toBe(false);
  });

  it('sends one request for two clicks while the first is on its way', async () => {
    const { calls } = await load();
    const hold = holdWrites();
    const row = await rowOf('spring_th');
    const toggle = within(row).getByRole('switch');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    hold.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(hold.started()).toBe(1);
  });

  it('shows the words of the error code when the backend refuses, and shows what the backend holds', async () => {
    const { user } = await load();
    overrideFetch(({ method }) =>
      method === 'PUT'
        ? jsonAnswer(404, 'RESOURCE_NOT_FOUND', null, 'raw backend words')
        : undefined,
    );
    const row = await rowOf('spring_th');
    await user.click(within(row).getByRole('switch'));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    await waitFor(() => expect(within(row).getByRole('switch')).toBeChecked());
  });

  it('is not offered to an administrator who cannot manage campaigns', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW'] });
    backend();
    renderPage(<AccountsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    for (const toggle of screen.getAllByRole('switch')) expect(toggle).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'New campaign' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate link' })).not.toBeInTheDocument();
  });
});

const fill = async (user: ReturnType<typeof userEvent.setup>, values: Record<string, string>) => {
  const box = within(await dialog());
  for (const [label, text] of Object.entries(values)) {
    const field = box.getByLabelText(label) as HTMLInputElement;
    await user.clear(field);
    await user.type(field, text);
  }
};

describe('making a campaign', { timeout: 30000 }, () => {
  const open = async () => {
    const result = await load();
    await result.user.click(screen.getByRole('button', { name: 'New campaign' }));
    await dialog();
    return result;
  };

  it('has three sections, and the code can be typed', async () => {
    await open();
    const box = within(await dialog());
    for (const title of ['Basic information', 'Pixels', 'Channel packages']) {
      expect(
        box.getByText(title, { selector: '.ant-divider-inner-text, .ant-typography' }),
      ).toBeInTheDocument();
    }
    expect(box.getByLabelText('Campaign ID')).not.toBeDisabled();
    expect(box.getByLabelText('UTM medium')).toHaveValue('cpc');
    expect(box.getByLabelText('Facebook access token')).toHaveValue('');
    expect((await dialog()).closest('.ant-modal')?.getAttribute('style') ?? '').toContain('640');
  });

  it('does not send a code that does not fit 3 to 32 of a-z, 0-9, - and _, and says so', async () => {
    const { calls, user } = await open();
    for (const code of ['ab', 'Upper', 'with space', 'a'.repeat(33), 'ünï']) {
      await fill(user, {
        'Campaign ID': code,
        'Display name': 'N',
        'Media source': 'facebook',
        'Campaign name': 'c',
      });
      await submit(user);
      expect(
        await within(await dialog()).findByText(
          'Use 3 to 32 lowercase letters, digits, "-" or "_".',
        ),
        code,
      ).toBeInTheDocument();
      expect(writesOf(calls), code).toHaveLength(0);
    }
  });

  it('asks for the name, the media source, the campaign name and the medium', async () => {
    const { calls, user } = await open();
    await fill(user, { 'Campaign ID': 'new_one' });
    await user.clear(within(await dialog()).getByLabelText('UTM medium'));
    await submit(user);
    const box = within(await dialog());
    await waitFor(() => expect(box.getAllByText('This is required.')).toHaveLength(4));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('makes the campaign with what was typed, switched on, and without a token field when none was typed', async () => {
    const { calls, user } = await open();
    await fill(user, {
      'Campaign ID': 'new_one',
      'Display name': 'โปรโมชั่นใหม่ ปีใหม่ 🎉',
      'Media source': 'facebook',
      'Campaign name': 'new_one',
      'Ad group': 'مجموعة',
      'Facebook pixel ID': '  FB-77  ',
    });
    // 5000 characters are pasted: typing them one by one takes minutes
    await user.click(within(await dialog()).getByLabelText('Remark'));
    await user.paste('x'.repeat(5000));
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write.method).toBe('POST');
    expect(write.url).toBe('/api/admin/attribution/campaigns');
    expect(write.body).toEqual({
      code: 'new_one',
      name: 'โปรโมชั่นใหม่ ปีใหม่ 🎉',
      mediaSource: 'facebook',
      campaign: 'new_one',
      utmMedium: 'cpc',
      adset: 'مجموعة',
      ad: null,
      facebookPixelId: 'FB-77',
      googlePixelId: null,
      tiktokPixelId: null,
      channelCodes: [],
      remark: 'x'.repeat(5000),
      enabled: true,
    });
    await dialogsClosed();
    expect(await screen.findByText('new_one')).toBeInTheDocument();
  });

  it('sends the token when one was typed, never shows it again and never puts it in the list', async () => {
    const { calls, user } = await open();
    await fill(user, {
      'Campaign ID': 'with_token',
      'Display name': 'T',
      'Media source': 'facebook',
      'Campaign name': 't',
      'Facebook access token': 'EAAB-secret-1',
    });
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as Record<string, unknown>).facebookAccessToken).toBe(
      'EAAB-secret-1',
    );
    await dialogsClosed();
    expect(document.body.textContent).not.toContain('EAAB-secret-1');
  });

  it('keeps the channel packages that were ticked', async () => {
    const { calls, user } = await open();
    await fill(user, {
      'Campaign ID': 'with_channels',
      'Display name': 'C',
      'Media source': 'facebook',
      'Campaign name': 'c',
    });
    const box = within(await dialog());
    await user.click(await box.findByRole('checkbox', { name: /play/ }));
    await user.click(box.getByRole('checkbox', { name: /appstore/ }));
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as Record<string, unknown>).channelCodes).toEqual([
      'play',
      'appstore',
    ]);
  });

  it('says the code exists already, and sends nothing, when the list has it', async () => {
    const { calls, user } = await open();
    await fill(user, {
      'Campaign ID': 'spring_th',
      'Display name': 'N',
      'Media source': 'facebook',
      'Campaign name': 'c',
    });
    await submit(user);
    expect(
      await within(await dialog()).findByText(
        'A campaign with this ID exists already. Edit that one instead.',
      ),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('keeps the dialog open with the words of the error code when the backend says the code exists (409)', async () => {
    const { user } = await open();
    overrideFetch(({ method }) =>
      method === 'POST'
        ? jsonAnswer(409, 'DUPLICATE_RESOURCE', { field: 'code' }, 'raw backend words')
        : undefined,
    );
    await fill(user, {
      'Campaign ID': 'brand_new',
      'Display name': 'N',
      'Media source': 'facebook',
      'Campaign name': 'c',
    });
    await submit(user);
    expect(
      await within(await dialog()).findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    expect(within(await dialog()).getByLabelText('Display name')).toHaveValue('N');
  });

  it('shows the reason of a field under the field, in words of the language', async () => {
    const { user } = await open();
    overrideFetch(({ method }) =>
      method === 'POST'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'name', reason: 'TOO_LONG' }] },
            'raw backend words',
          )
        : undefined,
    );
    await fill(user, {
      'Campaign ID': 'brand_new',
      'Display name': 'N',
      'Media source': 'facebook',
      'Campaign name': 'c',
    });
    await submit(user);
    expect(await within(await dialog()).findByText('The value is too long.')).toBeInTheDocument();
  });

  it('sends one request when the button is pressed twice while the first is on its way', async () => {
    const { calls, user } = await open();
    await fill(user, {
      'Campaign ID': 'only_once',
      'Display name': 'N',
      'Media source': 'facebook',
      'Campaign name': 'c',
    });
    const hold = holdWrites();
    const button = within(await dialog()).getByRole('button', { name: 'Submit' });
    fireEvent.click(button);
    await waitFor(() => expect(hold.started()).toBe(1));
    // the second press comes after the form was checked and while the request is on its way: Enter in a field
    fireEvent.submit((await dialog()).querySelector('form') as HTMLFormElement);
    fireEvent.click(button);
    await new Promise((resolve) => setTimeout(resolve, 100));
    hold.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(hold.started()).toBe(1);
  });

  it('leaves the form and the list unchanged when it is cancelled', async () => {
    const { calls, user } = await open();
    await fill(user, { 'Campaign ID': 'cancelled' });
    await user.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('changing a campaign', { timeout: 30000 }, () => {
  const open = async (code = 'spring_th') => {
    const result = await load();
    const row = await rowOf(code);
    await result.user.click(within(row).getByRole('button', { name: 'Edit' }));
    await dialog();
    return result;
  };

  it('opens for a campaign whose channel packages are missing (null) instead of a blank page', async () => {
    (campaignOf('spring_th') as unknown as { channelCodes: unknown }).channelCodes = null;
    await open();
    expect(within(await dialog()).getByLabelText('Display name')).toBeInTheDocument();
  });

  it('is filled with the campaign, the code cannot be typed, and the token box is empty and says that a token is set', async () => {
    await open();
    const box = within(await dialog());
    const th = campaignOf('spring_th');
    expect(box.getByLabelText('Display name')).toHaveValue(th.name);
    expect(box.getByLabelText('Media source')).toHaveValue('facebook');
    expect(box.getByLabelText('Facebook pixel ID')).toHaveValue('FB-1000');
    expect(box.getByLabelText('Facebook access token')).toHaveValue('');
    expect(box.getByText('Set', { selector: '[data-testid="token-state"]' })).toBeInTheDocument();
    expect(box.queryByRole('textbox', { name: 'Campaign ID' })).not.toBeInTheDocument();
    expect(box.getByText('spring_th')).toBeInTheDocument();
    expect(box.getByText('The campaign ID cannot be changed.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('mock-token-1');
  });

  it('says that no token is set for a campaign that has none', async () => {
    await open('ramadan_ar');
    const box = within(await dialog());
    expect(
      box.getByText('Not set', { selector: '[data-testid="token-state"]' }),
    ).toBeInTheDocument();
  });

  it('sends the changes without the code and, when the token box was left empty, without the token', async () => {
    const { calls, user } = await open();
    await fill(user, { 'Display name': 'Renamed ก ع 中' });
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write.method).toBe('PUT');
    const body = write.body as Record<string, unknown>;
    expect(body.name).toBe('Renamed ก ع 中');
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('facebookAccessToken');
    expect(body.enabled).toBe(true);
    await dialogsClosed();
    expect(await screen.findByText('Renamed ก ع 中')).toBeInTheDocument();
    expect(campaignOf('spring_th').facebookAccessToken).toBe('mock-token-1');
  });

  it('sends a new token when one was typed, and keeps the box empty when the dialog is opened again', async () => {
    const { calls, user } = await open();
    await fill(user, { 'Facebook access token': 'EAAB-new' });
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as Record<string, unknown>).facebookAccessToken).toBe(
      'EAAB-new',
    );
    await dialogsClosed();
    const row = await rowOf('spring_th');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    expect(within(await dialog()).getByLabelText('Facebook access token')).toHaveValue('');
    expect(document.body.textContent).not.toContain('EAAB-new');
  });

  it('does not show a token the backend sent by mistake, in the form either', async () => {
    backend();
    overrideFetch(({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/attribution/campaigns') return undefined;
      const items = campaignState.campaigns.map((c) => ({
        ...c,
        facebookAccessTokenSet: true,
        facebookAccessToken: 'LEAKED-TOKEN-999',
        createdByUsername: 'root',
      }));
      return jsonAnswer(200, '200', { items, total: items.length });
    });
    const user = userEvent.setup();
    renderPage(<AccountsPage />);
    const row = await rowOf('spring_th');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const box = within(await dialog());
    expect(box.getByLabelText('Facebook access token')).toHaveValue('');
    expect(document.body.innerHTML).not.toContain('LEAKED-TOKEN-999');
  });

  it('keeps the channel package that is linked and disabled ticked, and does not let a disabled one be ticked anew', async () => {
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/channels'
        ? jsonAnswer(200, '200', {
            items: [
              {
                channelCode: 'play',
                name: 'Store',
                platform: 'ANDROID',
                distribution: 'STORE',
                packageName: null,
                enabled: false,
                createdAt: null,
              },
              {
                channelCode: 'direct',
                name: 'Direct',
                platform: 'ANDROID',
                distribution: 'DIRECT',
                packageName: null,
                enabled: true,
                createdAt: null,
              },
              {
                channelCode: 'appstore',
                name: 'iOS',
                platform: 'IOS',
                distribution: 'STORE',
                packageName: null,
                enabled: false,
                createdAt: null,
              },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<AccountsPage />);
    const row = await rowOf('spring_th');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const box = within(await dialog());
    const play = await box.findByRole('checkbox', { name: /play/ });
    expect(play).toBeChecked();
    expect(play).not.toBeDisabled();
    expect(box.getByRole('checkbox', { name: /direct/ })).toBeChecked();
    const appstore = box.getByRole('checkbox', { name: /appstore/ });
    expect(appstore).not.toBeChecked();
    expect(appstore).toBeDisabled();
    expect(box.getAllByText(/\(disabled\)/).length).toBe(2);
  });

  it('says that the channel packages could not be read, and keeps the links the campaign has', async () => {
    const { calls, user } = (() => ({ calls: backend(), user: userEvent.setup() }))();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/channels' ? jsonAnswer(500, 'INTERNAL_ERROR') : undefined,
    );
    renderPage(<AccountsPage />);
    const row = await rowOf('spring_th');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const box = within(await dialog());
    expect(await box.findByText('The channel packages could not be read.')).toBeInTheDocument();
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as Record<string, unknown>).channelCodes).toEqual([
      'play',
      'direct',
    ]);
  });
});

describe('the link dialog', { timeout: 30000 }, () => {
  const baseUrl = (value: string | null) =>
    saved.set('attribution.link_base_url', {
      value,
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });

  const open = async (code = 'spring_th') => {
    const result = await load();
    const row = await rowOf(code);
    await result.user.click(within(row).getByRole('button', { name: 'Generate link' }));
    await dialog();
    return result;
  };
  const linkCalls = (calls: { url: string }[]) => calls.filter((c) => /\/link\?/.test(c.url));

  it('has the platform choice, the three UTM fields, and starts with the platform name as the source', async () => {
    baseUrl('https://go.example');
    await open();
    const box = within(await dialog());
    expect(box.getByRole('radio', { name: 'Facebook' })).toBeChecked();
    expect(box.getByRole('radio', { name: 'Google' })).not.toBeChecked();
    expect(box.getByRole('radio', { name: 'TikTok' })).not.toBeChecked();
    expect(box.getByLabelText('UTM source')).toHaveValue('facebook');
    expect(box.getByLabelText('UTM medium')).toHaveAttribute('placeholder', 'cpc');
    expect(box.getByLabelText('UTM campaign')).toBeInTheDocument();
    expect((await dialog()).closest('.ant-modal')?.getAttribute('style') ?? '').toContain('640');
  });

  it('makes the source the name of the platform when a platform is chosen', async () => {
    baseUrl('https://go.example');
    const { user } = await open();
    const box = within(await dialog());
    await user.click(box.getByRole('radio', { name: 'TikTok' }));
    expect(box.getByLabelText('UTM source')).toHaveValue('tiktok');
    await user.click(box.getByRole('radio', { name: 'Google' }));
    expect(box.getByLabelText('UTM source')).toHaveValue('google');
  });

  it('says the pixel is missing and sends no request when the campaign has no pixel number for the platform', async () => {
    baseUrl('https://go.example');
    const { calls, user } = await open();
    const box = within(await dialog());
    await user.click(box.getByRole('radio', { name: 'Google' }));
    await user.click(box.getByRole('button', { name: 'Generate' }));
    expect(
      await box.findByText('Configure the pixel ID of this platform first.'),
    ).toBeInTheDocument();
    expect(linkCalls(calls)).toHaveLength(0);
  });

  it('asks for the link with the platform and the UTM values, then shows it with a copy button and the interface of the landing page', async () => {
    baseUrl('https://go.example');
    const { calls, user } = await open();
    // after the user-event setup, which puts a clipboard of its own in place
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const box = within(await dialog());
    await user.type(box.getByLabelText('UTM campaign'), 'spring_2026');
    await user.click(box.getByRole('button', { name: 'Generate' }));
    const link = await box.findByTestId('campaign-link');
    expect(link.textContent).toBe(
      'https://go.example/go/spring_th?utm_source=facebook&utm_medium=cpc&utm_campaign=spring_2026',
    );
    const query = new URL(linkCalls(calls)[0].url, 'http://x').searchParams;
    expect(query.get('platform')).toBe('FACEBOOK');
    expect(query.get('utmSource')).toBe('facebook');
    expect(query.get('utmCampaign')).toBe('spring_2026');
    expect(query.has('utmMedium')).toBe(false);
    await user.click(box.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link.textContent));
    expect(box.getByTestId('landing-address').textContent).toBe(
      'POST https://go.example/api/attribution/click',
    );
    expect(box.getByText(/the code "spring_th"/)).toBeInTheDocument();
  });

  it('sends one request when Generate is pressed twice', async () => {
    baseUrl('https://go.example');
    const { calls } = await open();
    const box = within(await dialog());
    const hold = (() => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      overrideFetch(async ({ url }) => {
        if (!/\/link$/.test(url.pathname)) return undefined;
        await gate;
        return undefined;
      });
      return release;
    })();
    const button = box.getByRole('button', { name: 'Generate' });
    fireEvent.click(button);
    fireEvent.click(button);
    hold();
    await waitFor(() => expect(linkCalls(calls)).toHaveLength(1));
  });

  it('does not show a link that was asked for with fields that were changed while it was on its way', async () => {
    baseUrl('https://go.example');
    const { user } = await open();
    const box = within(await dialog());
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let asked = false;
    overrideFetch(async ({ url }) => {
      if (!/\/link$/.test(url.pathname)) return undefined;
      asked = true;
      await gate;
      return undefined;
    });
    await user.click(box.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(asked).toBe(true));
    await user.type(box.getByLabelText('UTM campaign'), 'changed');
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(box.queryByTestId('campaign-link')).not.toBeInTheDocument();
  });

  it('takes the link away when the platform or a UTM value is changed after it was made', async () => {
    baseUrl('https://go.example');
    const { user } = await open();
    const box = within(await dialog());
    await user.click(box.getByRole('button', { name: 'Generate' }));
    await box.findByTestId('campaign-link');
    await user.type(box.getByLabelText('UTM campaign'), 'x');
    expect(box.queryByTestId('campaign-link')).not.toBeInTheDocument();
  });

  it('says the link root is not configured, links to the parameters, makes no request, and still names the interface by its path', async () => {
    const { calls } = await open();
    const box = within(await dialog());
    expect(
      box.getByText('The link root is not configured, so no link can be made.'),
    ).toBeInTheDocument();
    expect(box.getByRole('link', { name: 'Open the attribution parameters' })).toHaveAttribute(
      'href',
      '/campaign/settings',
    );
    expect(box.getByRole('button', { name: 'Generate' })).toBeDisabled();
    expect(linkCalls(calls)).toHaveLength(0);
    expect(box.getByTestId('landing-address').textContent).toBe('POST /api/attribution/click');
  });

  it('shows the words of the error code, not the backend words, when the backend refuses the link', async () => {
    baseUrl('https://go.example');
    const { user } = await open();
    overrideFetch(({ url }) =>
      /\/link$/.test(url.pathname)
        ? jsonAnswer(400, 'INVALID_REQUEST', null, 'raw backend words')
        : undefined,
    );
    const box = within(await dialog());
    await user.click(box.getByRole('button', { name: 'Generate' }));
    expect(
      await box.findByText('Some input is not valid. Please check the fields and try again.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});
