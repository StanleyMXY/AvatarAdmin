import { screen, waitFor } from '@testing-library/react';
import type { ColumnsType } from 'antd/es/table';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { PagedTable as SharedTable } from '../components/PagedTable';
import { PagedTable as SystemTable } from './system/PagedTable';
import { ServerTable as UsersTable } from './users/ServerTable';

// Spec section 12: every list page shows a loading state, and an empty state when there is nothing.
// The shared table has its own test; these are the tables that some page folders draw themselves.
type Row = { id: string; name: string };
const columns: ColumnsType<Row> = [{ title: 'Name', dataIndex: 'name' }];

const state = (loading: boolean, rows: Row[] = []) => ({
  rows,
  total: rows.length,
  page: 1,
  pageSize: 20,
  loading,
  failure: null,
  setPaging: () => {},
  search: () => {},
  reload: () => {},
});

const spinning = () => document.querySelector('.ant-spin-spinning') !== null;

describe.each([
  ['shared (ads, application versions, notifications, SMS, campaign)', SharedTable],
] as const)('the %s table of a server-paged list', (_name, Table) => {
  it('shows the loading state while the page is read', () => {
    renderPage(
      <Table state={state(true)} columns={columns} rowKey={(r) => r.id} emptyText="Nothing here" />,
    );
    expect(spinning()).toBe(true);
  });

  it('shows the rows and no loading state when the page is there', () => {
    renderPage(
      <Table
        state={state(false, [{ id: '1', name: 'Alice' }])}
        columns={columns}
        rowKey={(r) => r.id}
        emptyText="Nothing here"
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(spinning()).toBe(false);
  });

  it('says in its own words that there is nothing to show', () => {
    renderPage(
      <Table
        state={state(false)}
        columns={columns}
        rowKey={(r) => r.id}
        emptyText="Nothing here"
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe.each([
  [
    'system',
    (load: () => Promise<{ items: Row[]; total: number }>) => (
      <SystemTable<Row> rowKey="id" columns={columns} load={load} reloadRef={{ current: null }} />
    ),
  ],
  [
    'users',
    (load: () => Promise<{ items: Row[]; total: number }>) => (
      <UsersTable<Row> rowKey="id" columns={columns} load={load} />
    ),
  ],
] as const)('the %s table that reads its own pages', (_name, draw) => {
  it('shows the loading state until the page arrives, then the rows', async () => {
    let answer: (page: { items: Row[]; total: number }) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<{ items: Row[]; total: number }>((resolve) => {
          answer = resolve;
        }),
    );
    renderPage(draw(load));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(spinning()).toBe(true));
    answer({ items: [{ id: '1', name: 'Alice' }], total: 1 });
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    await waitFor(() => expect(spinning()).toBe(false));
  });

  it('shows the empty state when the page has no rows', async () => {
    renderPage(draw(async () => ({ items: [], total: 0 })));
    await waitFor(() => expect(document.querySelector('.ant-empty')).not.toBeNull());
  });
});
