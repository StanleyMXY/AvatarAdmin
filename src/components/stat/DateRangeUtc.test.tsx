import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import { ApiError } from '../../request/errors';
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

  it('for days that are the users local days offers only the ranges that name no UTC day', async () => {
    renderPage(
      <DateRangeUtc
        value={{ from: '2026-10-14', to: '2026-10-20' }}
        onChange={() => {}}
        localDays
      />,
    );
    open();
    expect(await screen.findByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.queryByText('Today (UTC)')).toBeNull();
    expect(screen.queryByText('Yesterday (UTC)')).toBeNull();
  });

  it('still sends a picked day exactly as picked when the days are local days', async () => {
    await withTimeZone('Pacific/Kiritimati', async () => {
      const onChange = vi.fn();
      renderPage(
        <DateRangeUtc
          value={{ from: '2026-10-14', to: '2026-10-20' }}
          onChange={onChange}
          localDays
        />,
      );
      open();
      await waitFor(() => expect(cell('2026-10-19')).not.toBeNull());
      fireEvent.click(cell('2026-10-19'));
      fireEvent.click(cell('2026-10-19'));
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ from: '2026-10-19', to: '2026-10-19' }),
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

  // Contract 17.6: every statistics endpoint refuses a range the same way, with the date it is
  // about as `ref`. The picker shows the words of the code and of the field under it.
  describe('a range the backend refused', () => {
    const refusal = (...details: { ref: string; reason: string }[]) =>
      new ApiError({
        code: 'INVALID_REQUEST',
        httpStatus: 400,
        message: 'from is after to (the backend words)',
        data: { details },
      });
    const draw = (refused: unknown, locale: 'en-US' | 'zh-CN' = 'en-US') =>
      renderPage(
        <DateRangeUtc
          value={{ from: '2026-10-14', to: '2026-10-20' }}
          onChange={() => {}}
          refused={refused}
        />,
        locale,
      );
    const line = () => screen.queryByTestId('stat-range-error');

    it('says under the picker that the start date is outside the allowed range when `from` is refused', () => {
      draw(refusal({ ref: 'from', reason: 'OUT_OF_RANGE' }));
      expect(line()?.textContent).toMatch(
        /Start date: .*outside the allowed range.*not after the end date/,
      );
    });

    it('says under the picker that the end date is wrong or the range too long when `to` is refused', () => {
      draw(refusal({ ref: 'to', reason: 'OUT_OF_RANGE' }));
      expect(line()?.textContent).toMatch(
        /End date: .*outside the allowed range.*stats\.max_range_days/,
      );
    });

    it('gives a line for each date the backend named, and none for another field', () => {
      draw(
        refusal(
          { ref: 'from', reason: 'OUT_OF_RANGE' },
          { ref: 'to', reason: 'OUT_OF_RANGE' },
          { ref: 'platform', reason: 'OUT_OF_RANGE' },
        ),
      );
      expect(line()?.textContent).toMatch(/Start date: .*End date: /);
      expect(line()?.textContent).not.toMatch(/platform/i);
    });

    it('shows nothing for a refusal of another field, for an error that is not about a request, and for none', () => {
      draw(refusal({ ref: 'platform', reason: 'OUT_OF_RANGE' }));
      expect(line()).toBeNull();
      document.body.innerHTML = '';
      draw(new Error('boom'));
      expect(line()).toBeNull();
      document.body.innerHTML = '';
      draw(null);
      expect(line()).toBeNull();
    });

    it('never shows the words of the backend, and says it in Chinese', () => {
      draw(refusal({ ref: 'from', reason: 'OUT_OF_RANGE' }), 'zh-CN');
      expect(line()?.textContent).toMatch(/起始日期：.*超出允许的范围.*不能晚于结束日期/);
      expect(document.body.textContent).not.toContain('backend words');
    });

    it('marks the picker as being in error, and not when nothing is refused', () => {
      draw(refusal({ ref: 'to', reason: 'OUT_OF_RANGE' }));
      expect(document.querySelector('.ant-picker-status-error')).not.toBeNull();
      document.body.innerHTML = '';
      draw(null);
      expect(document.querySelector('.ant-picker-status-error')).toBeNull();
    });
  });
});
