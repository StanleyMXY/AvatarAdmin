import { Line } from '@ant-design/plots';
import { ProTable } from '@ant-design/pro-components';
import { render, screen } from '@testing-library/react';
import { useIntl } from '@umijs/max';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeZone } from './withTimeZone';

const messages = {
  'smoke.title': 'Hello 你好 สวัสดี مرحبا',
  'smoke.column.name': 'Name',
};

function Sample() {
  const intl = useIntl();
  return (
    <div>
      <h1>{intl.formatMessage({ id: 'smoke.title' })}</h1>
      <ProTable<{ id: number; name: string }>
        rowKey="id"
        search={false}
        options={false}
        pagination={false}
        columns={[{ title: intl.formatMessage({ id: 'smoke.column.name' }), dataIndex: 'name' }]}
        dataSource={[{ id: 1, name: 'Selamat pagi' }]}
      />
      <Line data={[{ day: '2026-10-21', value: 3 }]} xField="day" yField="value" />
    </div>
  );
}

describe('stack smoke', () => {
  it('renders intl text, a ProTable row and the chart stand-in', async () => {
    render(
      <IntlProvider locale="en-US" messages={messages}>
        <Sample />
      </IntlProvider>,
    );
    expect(await screen.findByText('Hello 你好 สวัสดี مرحبا')).toBeInTheDocument();
    expect(await screen.findByText('Name')).toBeInTheDocument();
    expect(await screen.findByText('Selamat pagi')).toBeInTheDocument();
    expect(screen.getByTestId('chart-line')).toHaveTextContent('2026-10-21');
  });

  it('withTimeZone changes the zone for the callback and restores it afterwards', () => {
    const instant = '2026-10-21T17:30:00Z';
    const before = new Date(instant).getHours();
    const beforeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(withTimeZone('America/Los_Angeles', () => new Date(instant).getHours())).toBe(10);
    expect(withTimeZone('Asia/Singapore', () => new Date(instant).getHours())).toBe(1);

    expect(new Date(instant).getHours()).toBe(before);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(beforeZone);
  });

  it('withTimeZone restores the zone when the callback throws', () => {
    const instant = '2026-10-21T17:30:00Z';
    const before = new Date(instant).getHours();
    expect(() =>
      withTimeZone('Asia/Singapore', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(new Date(instant).getHours()).toBe(before);
  });
});

describe('browser storage in the test environment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const safeSet = (storage: Storage, key: string, value: string): boolean => {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  it('reads and writes localStorage and sessionStorage', () => {
    localStorage.setItem('k', 'v');
    sessionStorage.setItem('k', 'w');
    expect(localStorage.getItem('k')).toBe('v');
    expect(sessionStorage.getItem('k')).toBe('w');
    localStorage.removeItem('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('starts every test with empty storages', () => {
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('a throwing setItem (spy on Storage.prototype) can be caught, even after earlier use', () => {
    expect(safeSet(localStorage, 'before', '1')).toBe(true);
    expect(safeSet(sessionStorage, 'before', '1')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(safeSet(localStorage, 'k', 'v')).toBe(false);
    expect(safeSet(sessionStorage, 'k', 'v')).toBe(false);
  });

  it('the spy is gone again after restore', () => {
    expect(safeSet(localStorage, 'k', 'v')).toBe(true);
    expect(localStorage.getItem('k')).toBe('v');
  });
});
