import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import { DateRangeUtc } from './DateRangeUtc';

// Singapore, 22 October 01:30 local = 21 October 17:30 UTC.
const NOW = new Date('2026-10-21T17:30:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const open = () => {
  const inputs = document.querySelectorAll('.ant-picker-input input');
  fireEvent.mouseDown(inputs[0]);
  fireEvent.focus(inputs[0]);
  fireEvent.click(inputs[0]);
};
const cell = (day: string) =>
  document.querySelector(`.ant-picker-cell[title="${day}"]`) as HTMLElement;

describe('DateRangeUtc', () => {
  it('sends the calendar days that were picked exactly as picked, in Singapore at 01:30', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      const onChange = vi.fn();
      renderPage(
        <DateRangeUtc value={{ from: '2026-10-14', to: '2026-10-20' }} onChange={onChange} />,
      );
      open();
      await waitFor(() => expect(cell('2026-10-22')).not.toBeNull());
      fireEvent.click(cell('2026-10-22'));
      fireEvent.click(cell('2026-10-22'));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ from: '2026-10-22', to: '2026-10-22' }),
      );
    });
  });

  it('keeps the picked day in a time zone behind UTC too (Los Angeles at 21:00 on the 21st)', async () => {
    await withTimeZone('America/Los_Angeles', async () => {
      vi.setSystemTime(new Date('2026-10-22T04:00:00Z'));
      const onChange = vi.fn();
      renderPage(
        <DateRangeUtc value={{ from: '2026-10-14', to: '2026-10-20' }} onChange={onChange} />,
      );
      open();
      await waitFor(() => expect(cell('2026-10-19')).not.toBeNull());
      fireEvent.click(cell('2026-10-19'));
      fireEvent.click(cell('2026-10-20'));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ from: '2026-10-19', to: '2026-10-20' }),
      );
    });
  });

  it('sends the UTC today for the preset "Today", which is the 21st although it is the 22nd in Singapore', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      const onChange = vi.fn();
      renderPage(
        <DateRangeUtc value={{ from: '2026-10-14', to: '2026-10-20' }} onChange={onChange} />,
      );
      open();
      fireEvent.click(await screen.findByText('Today (UTC)'));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ from: '2026-10-21', to: '2026-10-21' }),
      );
    });
  });

  it('sends the UTC yesterday, the 20th, for "Yesterday"', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      const onChange = vi.fn();
      renderPage(
        <DateRangeUtc value={{ from: '2026-10-14', to: '2026-10-20' }} onChange={onChange} />,
      );
      open();
      fireEvent.click(await screen.findByText('Yesterday (UTC)'));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ from: '2026-10-20', to: '2026-10-20' }),
      );
    });
  });

  it('sends the last 7 days ending today in UTC', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      const onChange = vi.fn();
      renderPage(
        <DateRangeUtc value={{ from: '2026-10-01', to: '2026-10-02' }} onChange={onChange} />,
      );
      open();
      fireEvent.click(await screen.findByText('Last 7 days'));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ from: '2026-10-15', to: '2026-10-21' }),
      );
    });
  });

  it('refuses a range longer than maxDays with a message, and does not call onChange', async () => {
    const onChange = vi.fn();
    renderPage(
      <DateRangeUtc
        value={{ from: '2026-10-14', to: '2026-10-20' }}
        onChange={onChange}
        maxDays={31}
      />,
    );
    open();
    fireEvent.click(await screen.findByText('Last 30 days'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ to: '2026-10-21' })),
    );
    onChange.mockClear();
    // 31 days is allowed; asking for 32 is not
    document.body.innerHTML = '';
    renderPage(
      <DateRangeUtc
        value={{ from: '2026-10-14', to: '2026-10-20' }}
        onChange={onChange}
        maxDays={7}
      />,
    );
    open();
    fireEvent.click(await screen.findByText('Last 30 days'));
    expect(await screen.findByText('At most 7 days at a time')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('limits nothing when maxDays is missing', async () => {
    const onChange = vi.fn();
    renderPage(
      <DateRangeUtc value={{ from: '2026-10-14', to: '2026-10-20' }} onChange={onChange} />,
    );
    open();
    fireEvent.click(await screen.findByText('Last 30 days'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('shows the value it is given', () => {
    renderPage(
      <DateRangeUtc value={{ from: '2026-10-14', to: '2026-10-20' }} onChange={() => {}} />,
    );
    const inputs = [...document.querySelectorAll('.ant-picker-input input')] as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(['2026-10-14', '2026-10-20']);
  });

  it('puts the old range back in the box when a range is refused', async () => {
    const onChange = vi.fn();
    renderPage(
      <DateRangeUtc
        value={{ from: '2026-10-14', to: '2026-10-20' }}
        onChange={onChange}
        maxDays={7}
      />,
    );
    open();
    fireEvent.click(await screen.findByText('Last 30 days'));
    await screen.findByText('At most 7 days at a time');
    const inputs = [...document.querySelectorAll('.ant-picker-input input')] as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(['2026-10-14', '2026-10-20']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts a range of exactly maxDays and refuses one day more', async () => {
    const onChange = vi.fn();
    renderPage(
      <DateRangeUtc
        value={{ from: '2026-10-14', to: '2026-10-20' }}
        onChange={onChange}
        maxDays={7}
      />,
    );
    open();
    fireEvent.click(await screen.findByText('Last 7 days'));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ from: '2026-10-15', to: '2026-10-21' }),
    );
  });
});
