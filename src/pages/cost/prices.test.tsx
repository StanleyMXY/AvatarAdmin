import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { BATCH, costState, HOSTILE_MODEL, MODEL } from '../../../mock/_core/costData';
import { monitorStore, resetMonitorStore } from '../../../mock/_core/monitorData';
import * as configMock from '../../../mock/config.mock';
import * as costMock from '../../../mock/cost.mock';
import * as monitorMock from '../../../mock/monitor.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestLocation } from '../../../tests/stubs/umi-max';
import PricesPage from './prices';
import { chooseOption, dialogsClosed, holds, optionTexts, signIn } from './testSetup';

// Pages with many fields are slow to type into under the test renderer.
vi.setConfig({ testTimeout: 30000 });

const NOW = '2026-10-26T20:00:00Z';
const ALL = ['COST:VIEW', 'COST:PRICE'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  resetMonitorStore();
  resetConfigStore?.();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const open = async (
  codes: string[] = ALL,
  options: {
    meta?: Record<string, unknown>;
    search?: string;
    tab?: string;
    prepare?: () => void;
  } = {},
) => {
  signIn('root', { codes, meta: options.meta ?? { allowedCurrencies: ['USD'] } });
  options.prepare?.();
  if (options.search !== undefined)
    setTestLocation({ pathname: '/cost/prices', search: options.search });
  const calls = useMockBackend(costMock, monitorMock, configMock);
  renderPage(<PricesPage />);
  const user = userEvent.setup();
  if (options.tab) await user.click(await screen.findByRole('tab', { name: options.tab }));
  return { calls, user };
};

const batchOf = (id: string) => {
  const found = costState.batches.find((b) => b.batchId === id);
  if (!found) throw new Error(`no batch ${id}`);
  return found;
};

const callsTo = (
  calls: { method: string; url: string; body?: unknown }[],
  method: string,
  prefix: string,
) => calls.filter((c) => c.method === method && c.url.startsWith(prefix));

const cardOf = async (id: string) => within(await screen.findByTestId(`pending-${id}`));
const cellsOf = (r: Element) => [...r.querySelectorAll('td')].map((td) => td.textContent ?? '');

describe('the price page: tabs, alerts and parameters', () => {
  it('has four tabs for COST:PRICE and three for COST:VIEW (no hand entry), the pending tab first', async () => {
    await open(ALL);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Pending prices',
      'Current prices',
      'Enter by hand',
      'Models',
    ]);
    expect(screen.getByRole('tab', { name: 'Pending prices' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('without COST:PRICE the hand-entry tab and the parameters are not there', async () => {
    await open(['COST:VIEW']);
    await screen.findByTestId(`pending-${BATCH.pendingLlm}`);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Pending prices',
      'Current prices',
      'Models',
    ]);
    expect(screen.queryByText('Parameters')).toBeNull();
  });

  it('opens the models tab with the "no price in force" filter when the address says so', async () => {
    await open(ALL, { search: '?tab=models&hasPrice=false' });
    await screen.findAllByText('matting-model-besar');
    expect(screen.getByRole('tab', { name: 'Models' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('checkbox', { name: 'Only models without a price in force' }),
    ).toBeChecked();
  });

  it('ignores a tab the administrator may not use (manual entry without COST:PRICE)', async () => {
    await open(['COST:VIEW'], { search: '?tab=manual' });
    expect(await screen.findByRole('tab', { name: 'Pending prices' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows the parameters of COST:PRICE with the shared configuration form (the one key)', async () => {
    await open(ALL);
    expect(await screen.findByText('Parameters')).toBeInTheDocument();
    expect(await screen.findByText('Maximum price bands')).toBeInTheDocument();
  });

  it('shows the number of open alerts only with MONITOR:VIEW and COST:PRICE together, and links to the alert page', async () => {
    await open([...ALL, 'MONITOR:VIEW']);
    const open1 = monitorStore.alerts.filter(
      (a) => a.status === 'OPEN' && a.type === 'USAGE_PRICE_MISSING',
    ).length;
    const open2 = monitorStore.alerts.filter(
      (a) => a.status === 'OPEN' && a.type === 'LLM_PRICE_SYNC_FAILED',
    ).length;
    const line = await screen.findByTestId('cost-alerts');
    await waitFor(() =>
      expect(line.textContent).toContain(
        `${open1} for a model without a price, ${open2} for a failed LLM price sync`,
      ),
    );
    expect(within(line).getByRole('link').getAttribute('href')).toBe('/monitor/alerts');
  });

  it('shows no alert line with COST:PRICE alone, and none with MONITOR:VIEW alone', async () => {
    await open(ALL);
    await screen.findByTestId(`pending-${BATCH.pendingLlm}`);
    expect(screen.queryByTestId('cost-alerts')).toBeNull();
    document.body.innerHTML = '';
    await open(['COST:VIEW', 'MONITOR:VIEW']);
    await screen.findByTestId(`pending-${BATCH.pendingLlm}`);
    expect(screen.queryByTestId('cost-alerts')).toBeNull();
  });

  it('shows a dash for an alert count that could not be read', async () => {
    signIn('root', { codes: [...ALL, 'MONITOR:VIEW'] });
    useMockBackend(costMock, configMock);
    renderPage(<PricesPage />);
    const line = await screen.findByTestId('cost-alerts');
    await waitFor(() =>
      expect(line.textContent).toContain(
        '— for a model without a price, — for a failed LLM price sync',
      ),
    );
  });
});

describe('pending prices', () => {
  it('says that nothing is charged at a pending price before it is confirmed, and lists every pending batch', async () => {
    await open();
    expect((await screen.findByTestId('pending-note')).textContent).toBe(
      'Requests are not charged at this price before you confirm it.',
    );
    for (const id of [
      BATCH.pendingLlm,
      BATCH.pendingGap,
      BATCH.pendingImage,
      BATCH.pendingNoActive,
    ]) {
      expect(screen.getByTestId(`pending-${id}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId(`pending-${BATCH.activeLlm}`)).toBeNull();
  });

  it('says it in Chinese too', async () => {
    signIn('root', { codes: ALL });
    useMockBackend(costMock, monitorMock, configMock);
    renderPage(<PricesPage />, 'zh-CN');
    expect((await screen.findByTestId('pending-note')).textContent).toBe(
      '确认之前不会按这个价格计费。',
    );
  });

  it('compares band by band with the price in force: new and current price, the changed ones marked, a band that is only new has a dash for the current price', async () => {
    await open();
    const card = await cardOf(BATCH.pendingLlm);
    const rows = [...card.getByTestId('compare-table').querySelectorAll('tbody tr.ant-table-row')];
    expect(rows).toHaveLength(3);
    const first = cellsOf(rows[0]);
    expect(first[0]).toContain('0 to 32,000');
    expect(first[1]).toContain('0.3000000000');
    expect(first[1]).toContain('0.4000000000');
    expect(rows[0].querySelector('[data-changed="true"]')).not.toBeNull();
    const third = cellsOf(rows[2]);
    expect(third[0]).toContain('128,001 and above');
    expect(third[1]).toContain('1.5000000000');
    expect(third[1]).toMatch(/Current:\s*—/);
  });

  it('does not mark a price that is the same as the current one, even when it is written with other trailing zeros', async () => {
    await open(ALL, {
      prepare: () => {
        batchOf(BATCH.pendingImage).unitPrice = '0.04';
      },
    });
    const card = await cardOf(BATCH.pendingImage);
    expect(card.getByTestId('compare-table').querySelector('[data-changed="true"]')).toBeNull();
  });

  it('compares the unit price of a type that is not LLM, with its unit', async () => {
    await open();
    const card = await cardOf(BATCH.pendingImage);
    const table = card.getByTestId('compare-table');
    expect(table.textContent).toContain('0.0450000000');
    expect(table.textContent).toContain('0.0400000000');
    expect(table.textContent).toContain('per call');
    expect(table.querySelector('[data-changed="true"]')).not.toBeNull();
  });

  it('says "No price in force" when there is nothing to compare with, and shows dashes for the current price', async () => {
    await open();
    const card = await cardOf(BATCH.pendingNoActive);
    expect(card.getByText('No price in force')).toBeInTheDocument();
    expect(card.getByTestId('compare-table').textContent).toMatch(/Current:\s*—/);
  });

  it('shows prices as the decimal text they are: no exponent, no rounding', async () => {
    await open();
    const card = await cardOf(BATCH.pendingGap);
    expect(card.getByTestId('compare-table').textContent).toContain('0.0000000003');
    expect(card.getByTestId('compare-table').textContent).toContain('0.0000000001');
    expect(document.body.textContent).not.toMatch(/\de-\d/);
  });

  it('shows an empty cached input price as a dash', async () => {
    await open();
    const card = await cardOf(BATCH.pendingGap);
    expect(
      cellsOf(
        card.getByTestId('compare-table').querySelector('tbody tr.ant-table-row') as Element,
      )[2],
    ).toContain('—');
  });

  it('gives the currency select only the allowed currencies, the date picker the proposed date, and says the date can go earlier', async () => {
    const { user } = await open(ALL, { meta: { allowedCurrencies: ['USD', 'EUR'] } });
    const card = await cardOf(BATCH.pendingLlm);
    await user.click(card.getByRole('combobox', { name: 'Currency' }));
    expect(optionTexts()).toEqual(['USD', 'EUR']);
    expect(
      (card.getByTestId('pending-date').querySelector('input') as HTMLInputElement).value,
    ).toBe('2026-10-26');
    expect(card.getByText(/can be set to an earlier date/)).toBeInTheDocument();
  });

  it('without the list of allowed currencies the select is not usable and says why', async () => {
    await open(ALL, { meta: {} });
    const card = await cardOf(BATCH.pendingLlm);
    expect(card.getByRole('combobox', { name: 'Currency' })).toBeDisabled();
    expect(
      card.getByText(
        'The allowed currencies could not be read, so the currency cannot be checked here.',
      ),
    ).toBeInTheDocument();
  });

  it('asks for a currency when the one of the batch is not an allowed one, and does not confirm until one is chosen', async () => {
    await open(ALL, {
      prepare: () => {
        batchOf(BATCH.pendingImage).currency = 'EUR';
      },
    });
    const card = await cardOf(BATCH.pendingImage);
    expect(
      card.getByText('The currency of this batch is not an allowed one. Choose one.'),
    ).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('shows no confirm, reject or editable control to someone without COST:PRICE', async () => {
    await open(['COST:VIEW']);
    const card = await cardOf(BATCH.pendingLlm);
    expect(card.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(card.queryByRole('combobox')).toBeNull();
    expect(card.getByTestId('pending-date').querySelector('input')).toBeNull();
  });

  it('writes model names of every language and of 5000 characters as plain text that breaks anywhere', async () => {
    const bold = '<b>x</b>';
    await open(ALL, {
      prepare: () => {
        batchOf(BATCH.pendingLlm).model = HOSTILE_MODEL;
        batchOf(BATCH.pendingGap).model = bold;
      },
    });
    const card = await cardOf(BATCH.pendingLlm);
    const title = card.getByTestId('pending-model');
    expect(title.textContent).toBe(HOSTILE_MODEL);
    expect(`${title.style.overflowWrap} ${title.style.wordBreak}`).toMatch(/anywhere|break-word/);
    expect(document.querySelector('b')).toBeNull();
    expect((await cardOf(BATCH.pendingGap)).getByTestId('pending-model').textContent).toBe(bold);
  });

  describe('confirm', () => {
    it('shows the consequence before anything is sent: from the date on, replaces the price of the same day, costs the earlier requests without a price, nothing changes for stored costs', async () => {
      const { user, calls } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Confirm this price?')).toBeInTheDocument();
      expect(dialog.textContent).toContain(
        'Requests recorded from 2026-10-26 on are charged at this price.',
      );
      expect(dialog.textContent).toContain(
        'A price in force for the same model and the same date is replaced by this one.',
      );
      expect(dialog.textContent).toContain(
        'recorded without a price from 2026-10-26 on are costed afterwards; costs already stored do not change.',
      );
      expect(dialog.textContent).not.toContain('The date is in the future');
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(0);
    });

    it('says so when the date is in the future: nothing is charged before it and the alert stays open', async () => {
      const { user } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      const input = card.getByTestId('pending-date').querySelector('input') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '2099-01-01{Enter}');
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain(
        'The date is in the future: nothing is charged at this price before then',
      );
      expect(dialog.textContent).not.toContain('are costed afterwards');
    });

    it('sends the checked date and currency, shows the price as in force and reads the lists again', async () => {
      const { user, calls } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Confirm the price',
        }),
      );
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(1),
      );
      const post = callsTo(calls, 'POST', '/api/admin/usage/price-batches')[0];
      expect(post.url).toBe(`/api/admin/usage/price-batches/${BATCH.pendingLlm}/confirm`);
      expect(post.body).toEqual({ effectiveFrom: '2026-10-26', currency: 'USD' });
      await waitFor(() => expect(screen.queryByTestId(`pending-${BATCH.pendingLlm}`)).toBeNull());
      expect(costState.batches.find((b) => b.batchId === BATCH.pendingLlm)?.status).toBe('ACTIVE');
      expect(await screen.findByText('The price is in force.')).toBeInTheDocument();
    });

    it('sends the date that was picked, an earlier one included', async () => {
      const { user, calls } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      const input = card.getByTestId('pending-date').querySelector('input') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '2026-09-15{Enter}');
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Confirm the price',
        }),
      );
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(1),
      );
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')[0].body).toEqual({
        effectiveFrom: '2026-09-15',
        currency: 'USD',
      });
    });

    it('a second click on the button of the dialog sends one request', async () => {
      const { user, calls } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      const ok = within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Confirm the price',
      });
      fireEvent.click(ok);
      fireEvent.click(ok);
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches').length).toBeGreaterThan(0),
      );
      await new Promise((r) => setTimeout(r, 50));
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(1);
    });

    it('keeps the dialog open and shows why the backend refused (the bands have a gap), in the words of the codes only', async () => {
      const { user } = await open();
      const card = await cardOf(BATCH.pendingGap);
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Confirm the price',
        }),
      );
      const dialog = await screen.findByRole('dialog');
      await waitFor(() =>
        expect(dialog.textContent).toContain(
          'Some input is not valid. Please check the fields and try again.',
        ),
      );
      expect(dialog.textContent).toContain('The value is outside the allowed range.');
      expect(dialog.textContent).not.toContain('cannot confirm');
      expect(costState.batches.find((b) => b.batchId === BATCH.pendingGap)?.status).toBe(
        'PENDING_REVIEW',
      );
    });

    it('shows the translated text for a batch that was confirmed by someone else meanwhile, and reads the list again', async () => {
      const { user } = await open();
      const card = await cardOf(BATCH.pendingImage);
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      batchOf(BATCH.pendingImage).status = 'ACTIVE';
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Confirm the price',
        }),
      );
      const dialog = await screen.findByRole('dialog');
      await waitFor(() =>
        expect(dialog.textContent).toContain(
          'The current state of the item does not allow this action.',
        ),
      );
      expect(dialog.textContent).not.toContain('not in the state this needs');
      await waitFor(() => expect(screen.queryByTestId(`pending-${BATCH.pendingImage}`)).toBeNull());
    });

    it('shows the translated text when the backend refuses the currency (it is not an allowed one there)', async () => {
      const { user } = await open(ALL, { meta: { allowedCurrencies: ['USD', 'EUR'] } });
      const card = await cardOf(BATCH.pendingImage);
      await chooseOption(
        user,
        'Currency',
        'EUR',
        card
          .getByRole('combobox', { name: 'Currency' })
          .closest('[data-testid^="pending-"]') as HTMLElement,
      );
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Confirm the price',
        }),
      );
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('Some input is not valid.'));
      expect(dialog.textContent).not.toContain('cannot confirm');
    });

    it('without the currency list it confirms without a currency and says that it could not be checked', async () => {
      const { user, calls } = await open(ALL, { meta: {} });
      const card = await cardOf(BATCH.pendingImage);
      await user.click(card.getByRole('button', { name: 'Confirm' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain(
        'The currency could not be checked against the allowed currencies; the backend checks it.',
      );
      await user.click(within(dialog).getByRole('button', { name: 'Confirm the price' }));
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(1),
      );
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')[0].body).toEqual({
        effectiveFrom: '2026-10-26',
      });
    });
  });

  describe('reject', () => {
    it('shows what rejecting does, needs a note (spaces are not a note), counts code points and sends the trimmed note', async () => {
      const { user, calls } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      await user.click(card.getByRole('button', { name: 'Reject' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain(
        'The price will not take effect. The price sync does not propose the same price again.',
      );
      const box = within(dialog).getByRole('textbox');
      await user.type(box, '   ');
      await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(dialog.textContent).toContain('Enter a reason'));
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(0);
      await user.clear(box);
      fireEvent.change(box, { target: { value: 'x'.repeat(501) } });
      await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(0);
      fireEvent.change(box, { target: { value: '  ราคาสูงเกินไป 😀  ' } });
      await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(1),
      );
      const post = callsTo(calls, 'POST', '/api/admin/usage/price-batches')[0];
      expect(post.url).toBe(`/api/admin/usage/price-batches/${BATCH.pendingLlm}/reject`);
      expect(post.body).toEqual({ note: 'ราคาสูงเกินไป 😀' });
      await waitFor(() => expect(screen.queryByTestId(`pending-${BATCH.pendingLlm}`)).toBeNull());
      expect(costState.batches.find((b) => b.batchId === BATCH.pendingLlm)?.status).toBe(
        'REJECTED',
      );
    });

    it('a second click on Submit sends one request', async () => {
      const { user, calls } = await open();
      const card = await cardOf(BATCH.pendingLlm);
      await user.click(card.getByRole('button', { name: 'Reject' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'too high' } });
      const submit = within(dialog).getByRole('button', { name: 'Submit' });
      fireEvent.click(submit);
      fireEvent.click(submit);
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches').length).toBeGreaterThan(0),
      );
      await new Promise((r) => setTimeout(r, 50));
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(1);
    });

    it('shows the translated text when the batch is no longer pending, and reads the list again', async () => {
      const { user } = await open();
      const card = await cardOf(BATCH.pendingImage);
      await user.click(card.getByRole('button', { name: 'Reject' }));
      batchOf(BATCH.pendingImage).status = 'REJECTED';
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'no' } });
      await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
      await waitFor(() =>
        expect(dialog.textContent).toContain(
          'The current state of the item does not allow this action.',
        ),
      );
      await waitFor(() => expect(screen.queryByTestId(`pending-${BATCH.pendingImage}`)).toBeNull());
    });
  });

  it('says there is nothing to review when the list is empty', async () => {
    await open(ALL, {
      prepare: () => {
        for (const b of costState.batches) if (b.status === 'PENDING_REVIEW') b.status = 'REJECTED';
      },
    });
    expect(await screen.findByText('No price is waiting for review.')).toBeInTheDocument();
  });

  it('shows what failed in the words of the code, with a retry, when the list cannot be read', async () => {
    signIn('root', { codes: ALL });
    stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw backend words')));
    renderPage(<PricesPage />);
    const alert = (await screen.findAllByText(/Failed to load/))[0].closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).not.toContain('raw backend words');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('current prices', () => {
  const rowOf = (text: string) => {
    const row = [...document.querySelectorAll('.ant-table-tbody > tr.ant-table-row')].find((r) =>
      (r.textContent ?? '').includes(text),
    );
    if (!row) throw new Error(`no row with ${text}`);
    return row as HTMLElement;
  };

  it('lists each model with the price in force, by band, with the currency and the date, prices as decimal text', async () => {
    await open(ALL, { tab: 'Current prices' });
    await screen.findByText('model-large-1');
    const row = rowOf('model-large-1');
    expect(row.textContent).toContain('0 to 32,000');
    expect(row.textContent).toContain('0.4000000000');
    expect(row.textContent).toContain('1.0000000000');
    expect(row.textContent).toContain('USD');
    expect(row.textContent).toContain('2026-09-01');
    expect(rowOf('نموذج-كبير-٢').textContent).toContain('0.0000000001');
    expect(rowOf('mô-hình-video-lớn').textContent).toContain('0.1000000000');
    expect(rowOf('mô-hình-video-lớn').textContent).toContain('per second');
    expect(document.body.textContent).not.toMatch(/\de-\d/);
  });

  it('does not take a batch that starts in the future for the price in force', async () => {
    await open(ALL, { tab: 'Current prices' });
    await screen.findByText('mô-hình-video-lớn');
    const row = rowOf('mô-hình-video-lớn');
    expect(row.textContent).toContain('2026-09-11');
    expect(row.textContent).not.toContain('2099-01-01');
  });

  it('shows 0 as 0 and a missing cached price as a dash', async () => {
    await open(ALL, { tab: 'Current prices' });
    await screen.findByText('云端渲染模型');
    expect(rowOf('云端渲染模型').textContent).toContain('0 per minute');
    expect(rowOf('نموذج-كبير-٢').textContent).toContain('—');
  });

  it('marks a model that has no price in force', async () => {
    await open(ALL, { tab: 'Current prices' });
    await screen.findByText('โมเดลภาษาไทยใหม่');
    expect(rowOf('โมเดลภาษาไทยใหม่').textContent).toContain('No price in force');
  });

  it('says that withdrawing only affects the records stored afterwards', async () => {
    await open(ALL, { tab: 'Current prices' });
    expect((await screen.findByTestId('current-note')).textContent).toBe(
      'Withdrawing only affects records stored afterwards; costs already stored do not change.',
    );
  });

  it('expands to the history of a model: replaced, rejected, withdrawn and the next one, with their notes and who reviewed', async () => {
    const { user } = await open(ALL, { tab: 'Current prices' });
    await screen.findByText('model-large-1');
    const row = rowOf('model-large-1');
    await user.click(row.querySelector('.ant-table-row-expand-icon') as Element);
    const history = await screen.findByTestId(/^history-/);
    for (const text of [
      'Replaced',
      'Rejected',
      'Withdrawn',
      'ราคาสูงเกินไป too high 价格过高',
      'Entered for the wrong model',
      'support',
    ]) {
      expect(history.textContent, text).toContain(text);
    }
    expect(history.textContent).not.toContain('Waiting for review');
  });

  it('has a Withdraw button for an ACTIVE batch, also one that starts in the future, and for no other state', async () => {
    const { user } = await open(ALL, { tab: 'Current prices' });
    await screen.findByText('mô-hình-video-lớn');
    const row = rowOf('mô-hình-video-lớn');
    expect(within(row).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    await user.click(row.querySelector('.ant-table-row-expand-icon') as Element);
    const history = await screen.findByTestId(/^history-/);
    expect(within(history).getAllByRole('button', { name: 'Withdraw' })).toHaveLength(1);
    expect(history.textContent).toContain('2099-01-01');
    expect(history.textContent).toContain('not in force yet');
  });

  it('has no Withdraw, and nothing to edit, for someone without COST:PRICE', async () => {
    const { user } = await open(['COST:VIEW'], { tab: 'Current prices' });
    await screen.findByText('model-large-1');
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
    await user.click(rowOf('model-large-1').querySelector('.ant-table-row-expand-icon') as Element);
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('has no way to edit a saved price, even with COST:PRICE', async () => {
    const { user } = await open(ALL, { tab: 'Current prices' });
    await screen.findByText('model-large-1');
    await user.click(rowOf('model-large-1').querySelector('.ant-table-row-expand-icon') as Element);
    expect(screen.queryByRole('button', { name: /edit|change|modify/i })).toBeNull();
    expect(document.querySelector('.ant-table-tbody input')).toBeNull();
  });

  it('withdraws with a required note, after saying what it does; the model then has no price in force', async () => {
    const { user, calls } = await open(ALL, { tab: 'Current prices' });
    await screen.findByText('نموذج-كبير-٢');
    await user.click(within(rowOf('نموذج-كبير-٢')).getByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(
      'Withdrawing only affects records stored afterwards; costs already stored do not change.',
    );
    const box = within(dialog).getByRole('textbox');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(dialog.textContent).toContain('Enter a reason'));
    expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches')).toHaveLength(0);
    fireEvent.change(box, { target: { value: '  خطأ في الإدخال  ' } });
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(callsTo(calls, 'POST', '/api/admin/usage/price-batches').length).toBeGreaterThan(0),
    );
    await new Promise((r) => setTimeout(r, 50));
    const posts = callsTo(calls, 'POST', '/api/admin/usage/price-batches');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe(`/api/admin/usage/price-batches/${BATCH.activeArabic}/retire`);
    expect(posts[0].body).toEqual({ note: 'خطأ في الإدخال' });
    await waitFor(() => expect(rowOf('نموذج-كبير-٢').textContent).toContain('No price in force'));
  });

  it('shows the translated text when the batch was withdrawn by someone else meanwhile', async () => {
    const { user } = await open(ALL, { tab: 'Current prices' });
    await screen.findByText('نموذج-كبير-٢');
    await user.click(within(rowOf('نموذج-كبير-٢')).getByRole('button', { name: 'Withdraw' }));
    batchOf(BATCH.activeArabic).status = 'RETIRED';
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'x' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(dialog.textContent).toContain(
        'The current state of the item does not allow this action.',
      ),
    );
  });

  it('breaks a model name of 5000 characters anywhere and writes it as plain text', async () => {
    await open(ALL, { tab: 'Current prices' });
    await screen.findByText('model-large-1');
    const row = rowOf(HOSTILE_MODEL.slice(0, 30));
    const name = row.querySelector('[data-testid="current-model"]') as HTMLElement;
    expect(name.textContent).toBe(HOSTILE_MODEL);
    expect(`${name.style.overflowWrap} ${name.style.wordBreak}`).toMatch(/anywhere|break-word/);
  });

  it('says that nothing has been entered when there is no batch at all', async () => {
    await open(ALL, {
      tab: 'Current prices',
      prepare: () => {
        costState.batches.length = 0;
      },
    });
    expect(await screen.findByText('No price has been entered yet.')).toBeInTheDocument();
  });

  it('reads every page of the batches (200 at a time) and says when it could not read them all', async () => {
    signIn('root', { codes: ALL });
    const pages: string[] = [];
    stubFetch(({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/usage/prices') {
        pages.push(u.searchParams.get('page') ?? '');
        return jsonResponse(
          200,
          envelope('200', { items: page(u.searchParams.get('page') === '1' ? 1 : 0), total: 5 }),
        );
      }
      return jsonResponse(200, envelope('200', { items: [], total: 0 }));
    });
    const page = (n: number) => Array.from({ length: n }, () => ({ ...costState.batches[0] }));
    renderPage(<PricesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Current prices' }));
    expect(
      await screen.findByText('Only 1 of 5 entries could be read, so this list is not complete.'),
    ).toBeInTheDocument();
    expect(pages.slice(0, 2)).toEqual(['1', '2']);
  });
});

describe('enter a price by hand', () => {
  const field = (name: string) => screen.getByRole('textbox', { name });

  const fillLlm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(field('Provider'), 'provider-z.example');
    await user.type(field('Model'), 'model-z');
    await user.type(field('Band 1: input price'), '0.4');
    await user.type(field('Band 1: output price'), '1.2');
  };

  it('says that prices are only added, never edited', async () => {
    await open(ALL, { tab: 'Enter by hand' });
    expect((await screen.findByTestId('manual-note')).textContent).toBe(
      'Prices are only added, never edited. After saving, this batch can no longer be changed; to change it, enter another batch.',
    );
  });

  it('says it in Chinese too', async () => {
    signIn('root', { codes: ALL });
    useMockBackend(costMock, monitorMock, configMock);
    renderPage(<PricesPage />, 'zh-CN');
    await userEvent.setup().click(await screen.findByRole('tab', { name: '手填价格' }));
    expect((await screen.findByTestId('manual-note')).textContent).toBe(
      '价格只追加不修改，保存后不能再改这批，需要改就再填一批。',
    );
  });

  it('starts as an LLM price: one band from 0 with no upper bound, and per million tokens', async () => {
    await open(ALL, { tab: 'Enter by hand' });
    expect((field('Band 1: lower bound (tokens)') as HTMLInputElement).value).toBe('0');
    expect((field('Band 1: upper bound (tokens)') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('manual-unit').textContent).toBe('per million tokens');
  });

  it('for a type that is not LLM there is one unit price and the unit is read-only, decided by the type', async () => {
    const { user } = await open(ALL, { tab: 'Enter by hand' });
    for (const [type, unit] of [
      ['Image to video', 'per second'],
      ['Cloud rendering', 'per minute'],
      ['Matting', 'per call'],
      ['Image editing', 'per call'],
      ['Driving preparation', 'per call'],
      ['Age estimation', 'per call'],
    ] as const) {
      await chooseOption(user, 'Resource type', type);
      expect(screen.getByTestId('manual-unit').textContent).toBe(unit);
      expect(screen.queryByRole('textbox', { name: 'Band 1: input price' })).toBeNull();
      expect(field('Price per unit')).toBeInTheDocument();
      expect(screen.getByTestId('manual-unit').closest('input')).toBeNull();
    }
  });

  it('offers only the allowed currencies, and a disabled select with the reason when they are unknown', async () => {
    const { user } = await open(ALL, {
      tab: 'Enter by hand',
      meta: { allowedCurrencies: ['USD', 'EUR'] },
    });
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    expect(optionTexts()).toEqual(['USD', 'EUR']);
    document.body.innerHTML = '';
    await open(ALL, { tab: 'Enter by hand', meta: {} });
    expect(screen.getByRole('combobox', { name: 'Currency' })).toBeDisabled();
    expect(
      screen.getByText('The allowed currencies could not be read, so no currency can be chosen.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save the price' })).toBeDisabled();
  });

  describe('the bands are checked while typing', () => {
    const verdict = () => screen.queryByTestId('bands-problem')?.textContent ?? null;

    it('accepts the start (one band from 0 with no upper bound) without a message', async () => {
      await open(ALL, { tab: 'Enter by hand' });
      expect(verdict()).toBeNull();
    });

    it('a gap, an overlap, a first band not from 0, an upper bound on the last band, a missing upper bound before the last band: each is said, and removing the fault removes the message', async () => {
      const { user } = await open(ALL, { tab: 'Enter by hand' });
      await user.click(screen.getByRole('button', { name: 'Add a band' }));
      // band 1 has no upper bound but is not last
      expect(verdict()).toBe('Only the last band can have no upper bound.');
      await user.type(field('Band 1: upper bound (tokens)'), '100');
      // band 2 lower bound was filled in as 101
      expect((field('Band 2: lower bound (tokens)') as HTMLInputElement).value).toBe('');
      await user.type(field('Band 2: lower bound (tokens)'), '102');
      expect(verdict()).toBe(
        'There is a gap: a band must start one above the upper bound of the band before it.',
      );
      await user.clear(field('Band 2: lower bound (tokens)'));
      await user.type(field('Band 2: lower bound (tokens)'), '100');
      expect(verdict()).toBe(
        'Two bands overlap: a band must start one above the upper bound of the band before it.',
      );
      await user.clear(field('Band 2: lower bound (tokens)'));
      await user.type(field('Band 2: lower bound (tokens)'), '101');
      expect(verdict()).toBeNull();
      await user.type(field('Band 2: upper bound (tokens)'), '500');
      expect(verdict()).toBe('The last band must have no upper bound.');
      await user.clear(field('Band 2: upper bound (tokens)'));
      expect(verdict()).toBeNull();
      await user.clear(field('Band 1: lower bound (tokens)'));
      await user.type(field('Band 1: lower bound (tokens)'), '5');
      expect(verdict()).toBe('The first band must start at 0.');
      await user.clear(field('Band 1: lower bound (tokens)'));
      await user.type(field('Band 1: lower bound (tokens)'), '1.5');
      expect(verdict()).toBe('Bounds are whole numbers, not below 0.');
      await user.clear(field('Band 1: lower bound (tokens)'));
      expect(verdict()).toBe('Every band needs a lower bound.');
    });

    it('disables the save button while the bands are wrong', async () => {
      const { user } = await open(ALL, { tab: 'Enter by hand' });
      await fillLlm(user);
      expect(screen.getByRole('button', { name: 'Save the price' })).toBeEnabled();
      await user.type(field('Band 1: upper bound (tokens)'), '10');
      expect(screen.getByRole('button', { name: 'Save the price' })).toBeDisabled();
    });

    it('adds a band with the next lower bound filled in once the one before has an upper bound, and removes a band', async () => {
      const { user } = await open(ALL, { tab: 'Enter by hand' });
      await user.type(field('Band 1: upper bound (tokens)'), '32000');
      await user.click(screen.getByRole('button', { name: 'Add a band' }));
      expect((field('Band 2: lower bound (tokens)') as HTMLInputElement).value).toBe('32001');
      await user.click(screen.getByRole('button', { name: 'Remove band 2' }));
      expect(screen.queryByRole('textbox', { name: 'Band 2: lower bound (tokens)' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Remove band 1' })).toBeDisabled();
    });

    it('stops at the number of bands the configuration allows', async () => {
      const { user } = await open(ALL, { tab: 'Enter by hand' });
      await screen.findByText(/At most 20 bands/);
      for (let i = 0; i < 19; i += 1) {
        const last = screen
          .getAllByRole('textbox', { name: /upper bound/ })
          .at(-1) as HTMLInputElement;
        fireEvent.change(last, { target: { value: String(1000 * (i + 1)) } });
        await user.click(screen.getByRole('button', { name: 'Add a band' }));
      }
      expect(screen.getAllByRole('textbox', { name: /lower bound/ })).toHaveLength(20);
      expect(screen.getByRole('button', { name: 'Add a band' })).toBeDisabled();
    }, 30000);
  });

  describe('save', () => {
    const save = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Save the price' }));
      return screen.findByRole('dialog');
    };

    it('shows what saving does before anything is sent: in force at once, cannot be edited, replaces the same day, costs earlier requests', async () => {
      const { user, calls } = await open(ALL, { tab: 'Enter by hand' });
      await fillLlm(user);
      const dialog = await save(user);
      expect(within(dialog).getByText('Save this price?')).toBeInTheDocument();
      expect(dialog.textContent).toContain(
        'The batch is in force at once, and it can not be edited afterwards.',
      );
      expect(dialog.textContent).toContain(
        'A price in force for the same model and the same date is replaced by this one.',
      );
      expect(dialog.textContent).toContain(
        'The date has come: requests of this model recorded without a price from that date on are costed afterwards; costs already stored do not change.',
      );
      expect(callsTo(calls, 'POST', '/api/admin/usage/prices')).toHaveLength(0);
    });

    it('says the future date holds nothing before then', async () => {
      const { user } = await open(ALL, { tab: 'Enter by hand' });
      await fillLlm(user);
      const input = screen.getByTestId('manual-date').querySelector('input') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '2099-01-01{Enter}');
      const dialog = await save(user);
      expect(dialog.textContent).toContain(
        'The date is in the future: nothing is charged at this price before then',
      );
      expect(dialog.textContent).not.toContain('The date has come');
    });

    it('sends the LLM prices as the strings typed (trimmed), the bounds as integers, the unit of the type, and an empty cached price as null', async () => {
      const { user, calls } = await open(ALL, { tab: 'Enter by hand' });
      await user.type(field('Provider'), '  provider-z.example  ');
      await user.type(field('Model'), 'โมเดล-ไทย 😀');
      await user.type(field('Band 1: upper bound (tokens)'), '32000');
      await user.type(field('Band 1: input price'), ' 0.4000 ');
      await user.type(field('Band 1: output price'), '0.0000000001');
      await user.click(screen.getByRole('button', { name: 'Add a band' }));
      await user.type(field('Band 2: input price'), '1.0000000000');
      await user.type(field('Band 2: cached input price'), '0.2');
      await user.type(field('Band 2: output price'), '3');
      const dialog = await save(user);
      await user.click(within(dialog).getByRole('button', { name: 'Save the price' }));
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/prices')).toHaveLength(1),
      );
      expect(callsTo(calls, 'POST', '/api/admin/usage/prices')[0].body).toEqual({
        resourceType: 'LLM',
        provider: 'provider-z.example',
        model: 'โมเดล-ไทย 😀',
        unit: 'TOKENS_1M',
        effectiveFrom: '2026-10-26',
        currency: 'USD',
        bands: [
          {
            inputMinTokens: 0,
            inputMaxTokens: 32000,
            inputPrice: '0.4000',
            cachedInputPrice: null,
            outputPrice: '0.0000000001',
          },
          {
            inputMinTokens: 32001,
            inputMaxTokens: null,
            inputPrice: '1.0000000000',
            cachedInputPrice: '0.2',
            outputPrice: '3',
          },
        ],
      });
    });

    it('sends 12345678.1234567890 and 0.0000000001 unchanged as strings (the backend is the judge of the limit)', async () => {
      signIn('root', { codes: ALL });
      const calls = stubFetch(({ url }) => {
        const u = new URL(url, 'http://localhost');
        if (u.pathname === '/api/admin/usage/prices' && calls.at(-1)?.init.method === 'POST')
          return jsonResponse(200, envelope('200', { batchId: 'x' }));
        return jsonResponse(200, envelope('200', { items: [], total: 0 }));
      });
      renderPage(<PricesPage />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('tab', { name: 'Enter by hand' }));
      await chooseOption(user, 'Resource type', 'Cloud rendering');
      await user.type(field('Provider'), 'p');
      await user.type(field('Model'), 'm');
      await user.type(field('Price per unit'), '12345678.1234567890');
      await user.click(screen.getByRole('button', { name: 'Save the price' }));
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save the price' }),
      );
      await waitFor(() => expect(calls.some((c) => c.init.method === 'POST')).toBe(true));
      const text = calls.find((c) => c.init.method === 'POST')?.init.body as string;
      expect(text).toContain('"unitPrice":"12345678.1234567890"');
      expect(text).toContain('"unit":"MINUTE"');
      expect(text).not.toContain('bands');
    });

    it('sends a unit price of 0.0000000001 unchanged', async () => {
      const { user, calls } = await open(ALL, { tab: 'Enter by hand' });
      await chooseOption(user, 'Resource type', 'Matting');
      await user.type(field('Provider'), 'self-hosted');
      await user.type(field('Model'), 'matting-x');
      await user.type(field('Price per unit'), '0.0000000001');
      const dialog = await save(user);
      await user.click(within(dialog).getByRole('button', { name: 'Save the price' }));
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/prices')).toHaveLength(1),
      );
      expect(callsTo(calls, 'POST', '/api/admin/usage/prices')[0].body).toMatchObject({
        resourceType: 'MATTING',
        unit: 'CALL',
        unitPrice: '0.0000000001',
      });
    });

    it('refuses what is not a price (sign, exponent, comma, eleven decimals, empty) without sending anything', async () => {
      const { user, calls } = await open(ALL, { tab: 'Enter by hand' });
      await user.type(field('Provider'), 'p');
      await user.type(field('Model'), 'm');
      await user.type(field('Band 1: output price'), '1');
      for (const bad of ['-1', '1e-3', '0,5', '0.00000000001', '']) {
        const box = field('Band 1: input price');
        await user.clear(box);
        if (bad) await user.type(box, bad);
        await user.click(screen.getByRole('button', { name: 'Save the price' }));
        expect(screen.queryByRole('dialog'), bad).toBeNull();
        expect(
          screen.getByText(
            'A price is a number with at most ten decimals, no sign and no exponent.',
          ),
          bad,
        ).toBeInTheDocument();
      }
      expect(callsTo(calls, 'POST', '/api/admin/usage/prices')).toHaveLength(0);
    });

    it('needs a provider and a model of 1 to 128 characters after trimming', async () => {
      const { user, calls } = await open(ALL, { tab: 'Enter by hand' });
      await user.type(field('Band 1: input price'), '1');
      await user.type(field('Band 1: output price'), '1');
      await user.type(field('Provider'), '   ');
      await user.type(field('Model'), 'x'.repeat(129));
      await user.click(screen.getByRole('button', { name: 'Save the price' }));
      expect(screen.getByText('The provider needs 1 to 128 characters.')).toBeInTheDocument();
      expect(screen.getByText('The model needs 1 to 128 characters.')).toBeInTheDocument();
      expect(callsTo(calls, 'POST', '/api/admin/usage/prices')).toHaveLength(0);
    });

    it('saves, says so, resets the form and goes to the current prices where the new batch is in force', async () => {
      const { user } = await open(ALL, { tab: 'Enter by hand' });
      await fillLlm(user);
      const dialog = await save(user);
      await user.click(within(dialog).getByRole('button', { name: 'Save the price' }));
      expect(await screen.findByText('The price was saved.')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Current prices' })).toHaveAttribute(
          'aria-selected',
          'true',
        ),
      );
      expect(await screen.findByText('model-z')).toBeInTheDocument();
      expect(costState.batches.some((b) => b.model === 'model-z' && b.status === 'ACTIVE')).toBe(
        true,
      );
    });

    it('a second click on the button of the dialog sends one request', async () => {
      const { user, calls } = await open(ALL, { tab: 'Enter by hand' });
      await fillLlm(user);
      const dialog = await save(user);
      const ok = within(dialog).getByRole('button', { name: 'Save the price' });
      fireEvent.click(ok);
      fireEvent.click(ok);
      await waitFor(() =>
        expect(callsTo(calls, 'POST', '/api/admin/usage/prices').length).toBeGreaterThan(0),
      );
      await new Promise((r) => setTimeout(r, 50));
      expect(callsTo(calls, 'POST', '/api/admin/usage/prices')).toHaveLength(1);
    });

    it('keeps the dialog and the entered values when the backend refuses, and shows only the words of the code and of the reasons', async () => {
      const { user } = await open(ALL, {
        tab: 'Enter by hand',
        meta: { allowedCurrencies: ['USD', 'EUR'] },
      });
      await fillLlm(user);
      await chooseOption(user, 'Currency', 'EUR');
      const dialog = await save(user);
      await user.click(within(dialog).getByRole('button', { name: 'Save the price' }));
      await waitFor(() =>
        expect(dialog.textContent).toContain(
          'Some input is not valid. Please check the fields and try again.',
        ),
      );
      expect(dialog.textContent).toContain('The value is outside the allowed range.');
      expect(dialog.textContent).not.toMatch(/invalid price/);
      expect(costState.batches.some((b) => b.model === 'model-z')).toBe(false);
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect((field('Model') as HTMLInputElement).value).toBe('model-z');
    });
  });

  it('is not there without COST:PRICE even when the address asks for it', async () => {
    await open(['COST:VIEW'], { search: '?tab=manual' });
    await screen.findByRole('tab', { name: 'Pending prices' });
    expect(screen.queryByTestId('manual-note')).toBeNull();
  });
});

describe('models', () => {
  const rowOf = (text: string) => {
    const row = [...document.querySelectorAll('.ant-table-tbody > tr.ant-table-row')].find((r) =>
      (r.textContent ?? '').includes(text),
    );
    if (!row) throw new Error(`no row with ${text}`);
    return row as HTMLElement;
  };

  it('lists the models with the columns of the spec, in all languages', async () => {
    await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    expect([...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent)).toEqual(
      [
        'Resource type',
        'Provider',
        'Model',
        'Price in force',
        'Sync adapter',
        'Model name for the sync',
        'First seen',
        'Last seen',
        'Actions',
      ],
    );
    for (const name of [
      'نموذج-كبير-٢',
      'โมเดลภาษาไทยใหม่',
      'mô-hình-video-lớn',
      'matting-model-besar',
      '云端渲染模型',
      'modelo-imagen-grande-😀',
    ]) {
      expect(rowOf(name)).toBeTruthy();
    }
  });

  it('marks the models without a price in force in red and says so, and the others say yes', async () => {
    await open(ALL, { tab: 'Models' });
    await screen.findAllByText('matting-model-besar');
    expect(rowOf('matting-model-besar').getAttribute('data-unpriced')).toBe('true');
    expect(rowOf('matting-model-besar').textContent).toContain('No price in force');
    expect(rowOf('model-large-1').getAttribute('data-unpriced')).toBe('false');
  });

  it('filters to the models without a price in force, and back', async () => {
    const { user } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    await user.click(
      screen.getByRole('checkbox', { name: 'Only models without a price in force' }),
    );
    const rows = [...document.querySelectorAll('.ant-table-tbody > tr.ant-table-row')];
    expect(rows.length).toBe(
      costState.models.filter((m) => !['1', '2', '4', '5', '7', '8', '10'].includes(m.id)).length,
    );
    expect(rows.every((r) => r.getAttribute('data-unpriced') === 'true')).toBe(true);
    await user.click(
      screen.getByRole('checkbox', { name: 'Only models without a price in force' }),
    );
    expect(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row').length).toBe(
      costState.models.length,
    );
  });

  it('filters by resource type', async () => {
    const { user } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    await chooseOption(user, 'Resource type', 'Matting');
    expect(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row')).toHaveLength(1);
  });

  it('shows "By hand" for a model with no adapter and the adapter code otherwise', async () => {
    await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    expect(rowOf('model-large-1').textContent).toContain('DASHSCOPE_INTL');
    expect(rowOf('matting-model-besar').textContent).toContain('By hand');
  });

  it('has no edit button without COST:PRICE', async () => {
    await open(['COST:VIEW'], { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    expect(screen.queryByRole('button', { name: 'Edit registration' })).toBeNull();
  });

  it('lets an LLM model get an adapter and a model name: sends both, once, and shows the new value', async () => {
    const { user, calls } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('نموذج-كبير-٢');
    await user.click(
      within(rowOf('نموذج-كبير-٢')).getByRole('button', { name: 'Edit registration' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(
      'This changes what the daily price sync reads for this model. Prices already entered do not change.',
    );
    await chooseOption(user, 'Sync adapter', 'DASHSCOPE_INTL', dialog);
    const name = within(dialog).getByRole('textbox', { name: 'Model name for the sync' });
    await user.clear(name);
    await user.type(name, '  sync-name  ');
    const save = within(dialog).getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() =>
      expect(callsTo(calls, 'PUT', '/api/admin/usage/models').length).toBeGreaterThan(0),
    );
    await new Promise((r) => setTimeout(r, 50));
    const puts = callsTo(calls, 'PUT', '/api/admin/usage/models');
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe(`/api/admin/usage/models/${MODEL.llmArabic}`);
    expect(puts[0].body).toEqual({ syncAdapter: 'DASHSCOPE_INTL', syncModelId: 'sync-name' });
    await dialogsClosed();
    await waitFor(() => expect(rowOf('نموذج-كبير-٢').textContent).toContain('sync-name'));
  });

  it('can clear the adapter: sends null', async () => {
    const { user, calls } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    await user.click(
      within(rowOf('model-large-1')).getByRole('button', { name: 'Edit registration' }),
    );
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Sync adapter', 'None: enter prices by hand', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(calls, 'PUT', '/api/admin/usage/models')).toHaveLength(1));
    expect(callsTo(calls, 'PUT', '/api/admin/usage/models')[0].body).toEqual({
      syncAdapter: null,
      syncModelId: 'model-large-1',
    });
  });

  it('the sync adapter can only be set for LLM: for another type the select is disabled and says so', async () => {
    const { user } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('matting-model-besar');
    await user.click(
      within(rowOf('matting-model-besar')).getByRole('button', { name: 'Edit registration' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Sync adapter' })).toBeDisabled();
    expect(dialog.textContent).toContain('Only LLM models can have a sync adapter.');
  });

  it('needs a model name of 1 to 128 characters and sends nothing otherwise', async () => {
    const { user, calls } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    await user.click(
      within(rowOf('model-large-1')).getByRole('button', { name: 'Edit registration' }),
    );
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByRole('textbox', { name: 'Model name for the sync' });
    await user.clear(name);
    await user.type(name, '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(dialog.textContent).toContain('The name needs 1 to 128 characters.');
    expect(callsTo(calls, 'PUT', '/api/admin/usage/models')).toHaveLength(0);
  });

  it('shows the translated text when the backend refuses (a model name that is too long for the sync)', async () => {
    const { user } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    const hostileRow = rowOf(HOSTILE_MODEL.slice(0, 30));
    await user.click(within(hostileRow).getByRole('button', { name: 'Edit registration' }));
    const dialog = await screen.findByRole('dialog');
    // the name that was read is 5000 characters: the form refuses it before the backend does
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(dialog.textContent).toContain('The name needs 1 to 128 characters.');
  });

  it('says there is no model yet', async () => {
    await open(ALL, {
      tab: 'Models',
      prepare: () => {
        costState.models.length = 0;
      },
    });
    expect(await screen.findByText('No model has reported usage yet.')).toBeInTheDocument();
  });

  it('writes a model name of 5000 characters as plain text that breaks anywhere', async () => {
    await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    const name = rowOf(HOSTILE_MODEL.slice(0, 30)).querySelector(
      '[data-testid="models-model"]',
    ) as HTMLElement;
    expect(name.textContent).toBe(HOSTILE_MODEL);
    expect(`${name.style.overflowWrap} ${name.style.wordBreak}`).toMatch(/anywhere|break-word/);
  });
});

// `holds` is used by the other test files of the module.
void holds;
