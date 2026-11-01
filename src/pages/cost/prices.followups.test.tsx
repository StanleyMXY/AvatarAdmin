import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { BATCH, costState } from '../../../mock/_core/costData';
import { resetMonitorStore } from '../../../mock/_core/monitorData';
import * as configMock from '../../../mock/config.mock';
import * as costMock from '../../../mock/cost.mock';
import * as monitorMock from '../../../mock/monitor.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { history, setTestLocation } from '../../../tests/stubs/umi-max';
import PricesPage from './prices';
import { signIn } from './testSetup';

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

/** What `GET /meta` answers now (the session read it once at sign-in; the page reads it again). `'fail'` is an answer that cannot be used. */
let liveMeta: Record<string, unknown> | 'fail' = {};
const metaMock = {
  default: {
    'GET /api/admin/meta': (
      _req: unknown,
      res: { status: (c: number) => { json: (b: unknown) => void } },
    ) => {
      if (liveMeta === 'fail')
        res.status(500).json({ code: 'INTERNAL_ERROR', message: 'x', data: null });
      else res.status(200).json({ code: '200', message: 'success', data: liveMeta });
    },
  },
};
const open = async (
  codes: string[] = ALL,
  options: {
    meta?: Record<string, unknown>;
    search?: string;
    tab?: string;
    prepare?: () => void;
    locale?: 'zh-CN' | 'en-US';
  } = {},
) => {
  liveMeta = options.meta ?? { allowedCurrencies: ['USD'] };
  signIn('root', { codes, meta: options.meta ?? { allowedCurrencies: ['USD'] } });
  options.prepare?.();
  if (options.search !== undefined)
    setTestLocation({ pathname: '/cost/prices', search: options.search });
  const calls = useMockBackend(metaMock, costMock, monitorMock, configMock);
  renderPage(<PricesPage />, options.locale);
  const user = userEvent.setup();
  if (options.tab) await user.click(await screen.findByRole('tab', { name: options.tab }));
  return { calls, user };
};

const cardOf = async (id: string) => within(await screen.findByTestId(`pending-${id}`));

describe('what the dialogs of a note say they are about', () => {
  it('names the model, the currency and the day of the price that is rejected, cut when the name is long', async () => {
    const { user } = await open(ALL, {
      prepare: () => {
        const batch = costState.batches.find((b) => b.batchId === BATCH.pendingLlm);
        if (batch) batch.model = `${'ก'.repeat(100)}-tail`;
      },
    });
    const pending = costState.batches.find((b) => b.batchId === BATCH.pendingLlm);
    if (!pending) throw new Error('no batch');
    const card = await cardOf(BATCH.pendingLlm);
    await user.click(card.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    const summary = within(dialog).getByTestId('batch-summary').textContent ?? '';
    expect(summary).toContain('Rejecting the price of ');
    expect(summary).toContain(`(${pending.currency})`);
    expect(summary).toContain(`starts on ${pending.effectiveFrom}`);
    expect(summary).toContain('ก'.repeat(60));
    expect(summary).not.toContain('ก'.repeat(61));
    expect(summary).not.toContain('-tail');
    expect(dialog.textContent).toContain('The price will not take effect.');
  });

  it('names the model, the currency and the day of the price that is withdrawn, so two dialogs are not alike', async () => {
    const { user } = await open(ALL, { tab: 'Current prices' });
    await screen.findByText('نموذج-كبير-٢');
    const active = costState.batches.find((b) => b.batchId === BATCH.activeArabic);
    if (!active) throw new Error('no batch');
    const row = [...document.querySelectorAll('.ant-table-tbody > tr.ant-table-row')].find((r) =>
      (r.textContent ?? '').includes('نموذج-كبير-٢'),
    ) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Withdraw' }));
    const dialog = await screen.findByRole('dialog');
    const summary = within(dialog).getByTestId('batch-summary').textContent ?? '';
    expect(summary).toContain('Withdrawing the price of نموذج-كبير-٢');
    expect(summary).toContain(`(${active.currency})`);
    expect(summary).toContain(`started on ${active.effectiveFrom}`);
  });

  it('says it in Chinese', async () => {
    const { user } = await open(ALL, { locale: 'zh-CN' });
    const card = await cardOf(BATCH.pendingLlm);
    await user.click(card.getByRole('button', { name: /驳\s*回/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('batch-summary').textContent).toMatch(
      /^驳回 .+（USD）从 .+ 起的价格。$/,
    );
  });
});

describe('long names do not widen the page', () => {
  it('lets the tag of a provider break its text, as any text of the page does', async () => {
    await open(ALL, {
      prepare: () => {
        const batch = costState.batches.find((b) => b.batchId === BATCH.pendingLlm);
        if (batch) batch.provider = 'ก'.repeat(128);
      },
    });
    const card = await cardOf(BATCH.pendingLlm);
    const tag = card.getByText('ก'.repeat(128)).closest('.ant-tag') as HTMLElement;
    expect(tag.style.whiteSpace).toBe('normal');
    expect(tag.style.maxWidth).toBe('100%');
  });

  it('gives the column of the review note a width, so that 500 characters are cut to four lines in it', async () => {
    const { user } = await open(ALL, {
      tab: 'Current prices',
      prepare: () => {
        const batch = costState.batches.find((b) => b.batchId === BATCH.rejectedLlm);
        if (batch) batch.reviewNote = 'ก'.repeat(500);
      },
    });
    await screen.findByText('نموذج-كبير-٢');
    const expanders = document.querySelectorAll('.ant-table-row-expand-icon');
    for (const expander of expanders) await user.click(expander);
    const note = await screen.findByText('ก'.repeat(500));
    const box = note.parentElement as HTMLElement;
    expect(box.style.maxWidth).toBe('320px');
  });
});

describe('the tab and what was typed are still there', () => {
  it('writes the tab that is opened into the address, so that a reload opens the same one', async () => {
    const { user } = await open();
    await user.click(await screen.findByRole('tab', { name: 'Models' }));
    expect(history.replace).toHaveBeenLastCalledWith({ search: '?tab=models' });
    await user.click(screen.getByRole('tab', { name: 'Current prices' }));
    expect(history.replace).toHaveBeenLastCalledWith({ search: '?tab=current' });
    await user.click(screen.getByRole('tab', { name: 'Enter by hand' }));
    expect(history.replace).toHaveBeenLastCalledWith({ search: '?tab=manual' });
  });

  it('keeps what was typed in the hand-entry form when another tab is opened and the tab is opened again', async () => {
    const { user } = await open(ALL, { tab: 'Enter by hand' });
    await user.type(screen.getByRole('textbox', { name: 'Provider' }), 'provider-kept');
    await user.type(screen.getByRole('textbox', { name: 'Model' }), 'model-kept');
    await user.type(screen.getByRole('textbox', { name: 'Band 1: input price' }), '0.4');
    await user.click(screen.getByRole('tab', { name: 'Current prices' }));
    await screen.findByText('نموذج-كبير-٢');
    await user.click(screen.getByRole('tab', { name: 'Enter by hand' }));
    expect(screen.getByRole('textbox', { name: 'Provider' })).toHaveValue('provider-kept');
    expect(screen.getByRole('textbox', { name: 'Model' })).toHaveValue('model-kept');
    expect(screen.getByRole('textbox', { name: 'Band 1: input price' })).toHaveValue('0.4');
  });

  it('starts the form empty again once a price was saved', async () => {
    const { user } = await open(ALL, { tab: 'Enter by hand' });
    await user.type(screen.getByRole('textbox', { name: 'Provider' }), 'provider-z.example');
    await user.type(screen.getByRole('textbox', { name: 'Model' }), 'model-z');
    await user.type(screen.getByRole('textbox', { name: 'Band 1: input price' }), '0.4');
    await user.type(screen.getByRole('textbox', { name: 'Band 1: output price' }), '1.2');
    await user.click(screen.getByRole('button', { name: 'Save the price' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save the price' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Current prices' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    await user.click(screen.getByRole('tab', { name: 'Enter by hand' }));
    expect(screen.getByRole('textbox', { name: 'Provider' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Model' })).toHaveValue('');
  });

  it('keeps the filters of the models when another tab is opened and the tab is opened again', async () => {
    const { user } = await open(ALL, { tab: 'Models' });
    await screen.findAllByText('model-large-1');
    await user.click(
      screen.getByRole('checkbox', { name: 'Only models without a price in force' }),
    );
    await user.click(screen.getByRole('tab', { name: 'Current prices' }));
    await screen.findByText('نموذج-كبير-٢');
    await user.click(screen.getByRole('tab', { name: 'Models' }));
    await screen.findAllByText('model-large-1').catch(() => []);
    expect(
      screen.getByRole('checkbox', { name: 'Only models without a price in force' }),
    ).toBeChecked();
    const rows = [...document.querySelectorAll('.ant-table-tbody > tr.ant-table-row')];
    expect(rows.every((r) => r.getAttribute('data-unpriced') === 'true')).toBe(true);
  });

  it('does not bring back the filter of the address once the person has unchecked it', async () => {
    const { user } = await open(ALL, { search: '?tab=models&hasPrice=false' });
    await screen.findAllByText('matting-model-besar');
    const box = screen.getByRole('checkbox', { name: 'Only models without a price in force' });
    expect(box).toBeChecked();
    await user.click(box);
    await user.click(screen.getByRole('tab', { name: 'Current prices' }));
    await screen.findByText('نموذج-كبير-٢');
    await user.click(screen.getByRole('tab', { name: 'Models' }));
    await screen.findAllByText('model-large-1');
    expect(
      screen.getByRole('checkbox', { name: 'Only models without a price in force' }),
    ).not.toBeChecked();
  });
});
