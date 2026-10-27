import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { NegativeBalance } from './NegativeBalance';

const NOTE =
  'A negative balance cannot be spent, and credits bought later are used to pay it off first.';

describe('NegativeBalance', () => {
  it('shows a negative balance with the warning colour and says what it means', () => {
    renderPage(<NegativeBalance value={-1200} withNote />);
    const value = screen.getByTestId('balance');
    expect(value).toHaveTextContent('-1,200');
    expect(value.getAttribute('data-negative')).toBe('true');
    expect(value.className).toMatch(/danger/);
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('shows a balance of zero or more plainly, without the warning and without the note', () => {
    for (const n of [0, 5, 1000000]) {
      const { unmount } = renderPage(<NegativeBalance value={n} withNote />);
      const value = screen.getByTestId('balance');
      expect(value.getAttribute('data-negative')).toBe('false');
      expect(value.className).not.toMatch(/danger/);
      expect(screen.queryByText(NOTE)).toBeNull();
      unmount();
    }
  });

  it('keeps the note out of the table rows (no withNote), but puts it in the tooltip text of a negative value', () => {
    renderPage(<NegativeBalance value={-1} />);
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(screen.getByTestId('balance').getAttribute('title')).toBe(NOTE);
  });

  it('shows a dash for a value that is not known, never 0, NaN or null', () => {
    for (const v of [null, undefined, Number.NaN]) {
      const { unmount } = renderPage(<NegativeBalance value={v as number | null} />);
      expect(screen.getByTestId('balance')).toHaveTextContent('—');
      expect(screen.getByTestId('balance').getAttribute('data-negative')).toBe('false');
      unmount();
    }
  });

  it('follows the language', () => {
    renderPage(<NegativeBalance value={-3} withNote />, 'zh-CN');
    expect(screen.getByText('为负时不能消费，新购买的额度会先抵扣')).toBeInTheDocument();
  });
});
