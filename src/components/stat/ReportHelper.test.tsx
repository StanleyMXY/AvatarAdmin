import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportHelper } from './ReportHelper';

const messages = {
  'stat.daily.helper.title': 'About this report',
  'stat.daily.helper.content': 'DAU counts accounts.',
};
const mount = (pageKey = 'daily') =>
  render(
    <IntlProvider locale="en-US" messages={messages} onError={() => {}}>
      <ReportHelper pageKey={pageKey} />
    </IntlProvider>,
  );

beforeEach(() => localStorage.clear());

describe('ReportHelper', () => {
  it('shows the title and the content', () => {
    mount();
    expect(screen.getByText('About this report')).toBeInTheDocument();
    expect(screen.getByText('DAU counts accounts.')).toBeInTheDocument();
  });

  it('stays closed after it is closed and the page is shown again', () => {
    const { unmount } = mount();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(localStorage.getItem('reportHelper:daily')).toBe('1');
    unmount();
    mount();
    expect(screen.queryByText('About this report')).toBeNull();
  });

  it('keeps the helpers of other pages apart', () => {
    localStorage.setItem('reportHelper:retention', '1');
    mount('daily');
    expect(screen.getByText('About this report')).toBeInTheDocument();
  });

  it('reads the closed state of the new page when the page changes on the same panel', () => {
    localStorage.setItem('reportHelper:daily', '1');
    const both = { ...messages, 'stat.retention.helper.title': 'About retention' };
    const view = (pageKey: string) => (
      <IntlProvider locale="en-US" messages={both} onError={() => {}}>
        <ReportHelper pageKey={pageKey} />
      </IntlProvider>
    );
    const { rerender } = render(view('daily'));
    expect(screen.queryByText('About this report')).toBeNull(); // daily was closed
    rerender(view('retention'));
    expect(screen.getByText('About retention')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    rerender(view('daily'));
    expect(screen.queryByText('About this report')).toBeNull(); // daily is still closed
    localStorage.removeItem('reportHelper:daily');
    rerender(view('retention'));
    expect(screen.queryByText('About retention')).toBeNull(); // and retention stays closed
    rerender(view('daily'));
    expect(screen.getByText('About this report')).toBeInTheDocument();
  });

  it('is shown every time, and does not crash, when storage cannot be used', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    mount();
    expect(screen.getByText('About this report')).toBeInTheDocument();
    // An exception inside a React event handler does not fail a test by itself: it is reported to the
    // window, so it is collected here and must be none.
    const uncaught: unknown[] = [];
    const collect = (event: ErrorEvent) => {
      uncaught.push(event.error ?? event.message);
      event.preventDefault();
    };
    window.addEventListener('error', collect);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
    });
    window.removeEventListener('error', collect);
    expect(uncaught).toEqual([]);
    expect(screen.queryByText('About this report')).toBeNull(); // closed for this page view
    vi.restoreAllMocks();
  });

  it('shows nothing for a page without texts', () => {
    const { container } = mount('unknown');
    expect(container.textContent).toBe('');
  });
});
