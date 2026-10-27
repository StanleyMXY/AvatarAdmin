import type { ProColumns } from '@ant-design/pro-components';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { ApiError } from '../request/errors';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedListTable } from './PagedListTable';

type Row = { id: string; name: string };
const columns: ProColumns<Row>[] = [
  { title: 'Name', dataIndex: 'name' },
  { title: 'Keyword', dataIndex: 'q', hideInTable: true },
];

describe('PagedListTable', () => {
  it('asks for page 1 with 20 rows, and shows the rows and the total', async () => {
    const request = vi.fn(async () => ({
      items: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'สมชาย' },
      ],
      total: 42,
    }));
    renderPage(
      <PagedListTable<Row, { q?: string }> rowKey="id" columns={columns} request={request} />,
    );
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('สมชาย')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
    expect(document.querySelector('.ant-pagination-total-text, .ant-pagination')).not.toBeNull();
    expect(screen.getByRole('listitem', { name: '3' })).toBeInTheDocument(); // 42 rows at 20 a page: 3 pages
  });

  it('uses the page sizes 10, 20, 50 and 100, 20 first', async () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        request={async () => ({ items: [], total: 500 })}
      />,
    );
    await waitFor(() => expect(document.querySelector('.ant-pagination')).not.toBeNull());
    expect(document.querySelector('.ant-pagination .ant-select-content')?.textContent).toMatch(
      /^20\b/,
    );
  });

  it('goes to page 2 with the same page size', async () => {
    const request = vi.fn(async (p: { page: number }) => ({
      items: [{ id: String(p.page), name: `row of page ${p.page}` }],
      total: 100,
    }));
    const user = userEvent.setup();
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await screen.findByText('row of page 1');
    await user.click(screen.getByRole('listitem', { name: '2' }));
    expect(await screen.findByText('row of page 2')).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 20 }));
  });

  it('shows the error above the table, with a retry, when the request fails; does not crash', async () => {
    let fail = true;
    const request = vi.fn(async () => {
      if (fail) {
        throw new ApiError({
          code: 'DEPENDENCY_UNAVAILABLE',
          httpStatus: 503,
          message: 'down',
          data: null,
        });
      }
      return { items: [{ id: '1', name: 'Recovered' }], total: 1 };
    });
    const user = userEvent.setup();
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Failed to load/)).toBeNull());
  });

  it('shows the loading state while a page is being read, and not after the rows came', async () => {
    let answer: (page: { items: Row[]; total: number }) => void = () => {};
    const request = vi.fn(
      () =>
        new Promise<{ items: Row[]; total: number }>((resolve) => {
          answer = resolve;
        }),
    );
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector('.ant-spin-spinning')).not.toBeNull());
    answer({ items: [{ id: '1', name: 'Alice' }], total: 1 });
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('.ant-spin-spinning')).toBeNull());
  });

  it('shows an empty state for no rows', async () => {
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        request={async () => ({ items: [], total: 0 })}
      />,
    );
    await waitFor(() => expect(document.querySelector('.ant-empty')).not.toBeNull());
  });

  it('shows the answer of the newest request when an older, slower one arrives later', async () => {
    const resolvers: Record<number, (v: { items: Row[]; total: number }) => void> = {};
    const request = vi.fn(
      (p: { page: number }) =>
        new Promise<{ items: Row[]; total: number }>((resolve) => {
          resolvers[p.page] = resolve;
        }),
    );
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    // page 1 is slow; the person asks for page 2 meanwhile
    resolvers[1]({ items: [{ id: 'x', name: 'first' }], total: 100 });
    await screen.findByText('first');
    fireEvent.click(screen.getByRole('listitem', { name: '2' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('listitem', { name: '3' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    resolvers[3]({ items: [{ id: '3', name: 'fast page 3' }], total: 100 });
    expect(await screen.findByText('fast page 3')).toBeInTheDocument();
    resolvers[2]({ items: [{ id: '2', name: 'slow page 2' }], total: 100 });
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByText('slow page 2')).toBeNull();
    expect(screen.getByText('fast page 3')).toBeInTheDocument();
  });

  it('passes the search form fields to the request', async () => {
    const request = vi.fn(async () => ({ items: [], total: 0 }));
    const user = userEvent.setup();
    renderPage(
      <PagedListTable<Row, { q?: string }> rowKey="id" columns={columns} request={request} />,
    );
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const box = await screen.findByLabelText('Keyword');
    await user.type(box, 'สม ชาย{Enter}');
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'สม ชาย', page: 1 })),
    );
  });
});
