import type { ProColumns } from '@ant-design/pro-components';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { ApiError } from '../request/errors';
import { markServiceUnavailable, resetServiceStatus } from '../request/serviceStatus';
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
  it('draws no search area when no column can be searched (an empty card with two buttons does nothing)', async () => {
    const plain: ProColumns<Row>[] = [
      { title: 'Name', dataIndex: 'name', search: false },
      { title: 'Hidden', dataIndex: 'q', hideInTable: true, search: false },
      { title: 'Actions', valueType: 'option', render: () => null },
    ];
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={plain}
        request={async () => ({ items: [{ id: '1', name: 'Only row' }], total: 1 })}
      />,
    );
    expect(await screen.findByText('Only row')).toBeInTheDocument();
    expect(document.querySelector('.ant-pro-table-search')).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Query|Reset|Search)$/ })).toBeNull();
  });

  it('keeps the search area when at least one column can be searched', async () => {
    renderPage(
      <PagedListTable<Row, { q?: string }>
        rowKey="id"
        columns={columns}
        request={async () => ({ items: [], total: 0 })}
      />,
    );
    expect(await screen.findByLabelText('Keyword')).toBeInTheDocument();
    expect(document.querySelector('.ant-pro-table-search')).not.toBeNull();
  });

  it('shows every filter at once when defaultCollapsed is false, and folds them by default', async () => {
    const many: ProColumns<Row>[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({
      title: `Filter ${key}`,
      dataIndex: key,
      hideInTable: true,
    }));
    const { unmount } = renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={many}
        request={async () => ({ items: [], total: 0 })}
      />,
    );
    await waitFor(() => expect(document.querySelector('.ant-pro-table-search')).not.toBeNull());
    expect(screen.getByLabelText('Filter f')).not.toBeVisible();
    unmount();
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={many}
        defaultCollapsed={false}
        request={async () => ({ items: [], total: 0 })}
      />,
    );
    await waitFor(() => expect(document.querySelector('.ant-pro-table-search')).not.toBeNull());
    expect(screen.getByLabelText('Filter f')).toBeVisible();
  });
});

describe('PagedListTable: a page size is chosen from the four, and the rows follow the newest answer', () => {
  it('lists 10, 20, 50 and 100 to choose from and asks again with the one chosen, from page 1', async () => {
    const request = vi.fn(async (p: { page: number; pageSize: number }) => ({
      items: [{ id: `${p.page}-${p.pageSize}`, name: `page ${p.page} of ${p.pageSize}` }],
      total: 500,
    }));
    const user = userEvent.setup();
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await screen.findByText('page 1 of 20');
    await user.click(screen.getByRole('listitem', { name: '3' }));
    await screen.findByText('page 3 of 20');
    await user.click(document.querySelector('.ant-pagination .ant-select') as HTMLElement);
    const options = [...document.querySelectorAll('.ant-select-item-option')].map((o) =>
      o.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(options.map((o) => Number.parseInt(o ?? '', 10))).toEqual([10, 20, 50, 100]);
    await user.click(
      screen.getAllByText(/^50\b/, { selector: '.ant-select-item-option-content' })[0],
    );
    expect(await screen.findByText('page 1 of 50')).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }));
  });

  it('shows no error from an older request that fails after the newest one worked', async () => {
    const answers: Record<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }> =
      {};
    const request = vi.fn(
      (p: { page: number }) =>
        new Promise<{ items: Row[]; total: number }>((resolve, reject) => {
          answers[p.page] = { resolve: resolve as never, reject };
        }),
    );
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    answers[1].resolve({ items: [{ id: '1', name: 'first' }], total: 100 });
    await screen.findByText('first');
    fireEvent.click(screen.getByRole('listitem', { name: '2' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('listitem', { name: '3' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    answers[3].resolve({ items: [{ id: '3', name: 'newest' }], total: 100 });
    await screen.findByText('newest');
    answers[2].reject(
      new ApiError({ code: 'INTERNAL_ERROR', message: 'late', httpStatus: 500, data: null }),
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('newest')).toBeInTheDocument();
  });

  it('keeps the error of the newest request when an older one answers well after it', async () => {
    const answers: Record<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }> =
      {};
    const request = vi.fn(
      (p: { page: number }) =>
        new Promise<{ items: Row[]; total: number }>((resolve, reject) => {
          answers[p.page] = { resolve: resolve as never, reject };
        }),
    );
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    answers[1].resolve({ items: [{ id: '1', name: 'first' }], total: 100 });
    await screen.findByText('first');
    fireEvent.click(screen.getByRole('listitem', { name: '2' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('listitem', { name: '3' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    answers[3].reject(
      new ApiError({ code: 'INTERNAL_ERROR', message: 'bad', httpStatus: 500, data: null }),
    );
    await screen.findByRole('alert');
    answers[2].resolve({ items: [{ id: '2', name: 'older but fine' }], total: 100 });
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not leave the rows of the last good answer beside the error of the next one', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: '1', name: 'Alice' }], total: 100 })
      .mockRejectedValueOnce(
        new ApiError({ code: 'INTERNAL_ERROR', message: 'x', httpStatus: 500, data: null }),
      );
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await screen.findByText('Alice');
    fireEvent.click(screen.getByRole('listitem', { name: '2' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('Alice')).toBeNull(); // they belong to another page, or other filters
  });
});

describe('PagedListTable: the date range of a search form reaches the request as the page names it', () => {
  it('as the two days of a transform, written YYYY-MM-DD', async () => {
    const withRange: ProColumns<Row>[] = [
      { title: 'Name', dataIndex: 'name' },
      {
        title: 'Day',
        dataIndex: 'range',
        hideInTable: true,
        valueType: 'dateRange',
        search: {
          transform: (value: [string, string]) => ({ fromDay: value[0], toDay: value[1] }),
        },
      },
    ];
    const request = vi.fn(async () => ({ items: [], total: 0 }));
    const user = userEvent.setup();
    renderPage(
      <PagedListTable<Row, { fromDay?: string; toDay?: string }>
        rowKey="id"
        columns={withRange}
        request={request}
      />,
    );
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-picker-input input')).toHaveLength(2),
    );
    const [start, end] = [
      ...document.querySelectorAll<HTMLInputElement>('.ant-picker-input input'),
    ];
    await user.type(start, '2026-10-01{Enter}');
    await user.type(end, '2026-10-05{Enter}');
    await user.click(screen.getByRole('button', { name: /^(Query|Search|查\s*询)$/ }));
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ fromDay: '2026-10-01', toDay: '2026-10-05', page: 1 }),
      ),
    );
  });
});

describe('PagedListTable: skeleton, column settings and the gateway notice', () => {
  it('shows a skeleton in the body while the first page is being read, and never again', async () => {
    let answer: (page: { items: Row[]; total: number }) => void = () => {};
    const request = vi.fn(
      () =>
        new Promise<{ items: Row[]; total: number }>((resolve) => {
          answer = resolve;
        }),
    );
    renderPage(<PagedListTable<Row> rowKey="id" columns={columns} request={request} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.ant-table-tbody .ant-skeleton')).not.toBeNull();
    answer({ items: [{ id: '1', name: 'Alice' }], total: 100 });
    await screen.findByText('Alice');
    expect(document.querySelector('.ant-skeleton')).toBeNull();
    // the next page: the rows stay, no skeleton comes back
    fireEvent.click(screen.getByRole('listitem', { name: '2' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(document.querySelector('.ant-skeleton')).toBeNull();
  });

  it('shows the empty state, not the skeleton, once an empty page has come', async () => {
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        request={async () => ({ items: [], total: 0 })}
      />,
    );
    await waitFor(() => expect(document.querySelector('.ant-empty')).not.toBeNull());
    expect(document.querySelector('.ant-skeleton')).toBeNull();
  });

  it('puts the column settings in the toolbar, next to the page buttons', async () => {
    const user = userEvent.setup();
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        toolbar={[
          <button key="new" type="button">
            New
          </button>,
        ]}
        request={async () => ({ items: [{ id: '1', name: 'Alice' }], total: 1 })}
      />,
    );
    await screen.findByText('Alice');
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    const setting = document.querySelector('.ant-pro-table-list-toolbar .anticon-setting');
    expect(setting).not.toBeNull();
    // no reload, density or full-screen buttons: only what the specification asks for
    expect(document.querySelector('.ant-pro-table-list-toolbar .anticon-reload')).toBeNull();
    expect(document.querySelector('.ant-pro-table-list-toolbar .anticon-column-height')).toBeNull();
    await user.click(setting as Element);
    expect(
      await screen.findByText('Name', { selector: '.ant-tree-title *, .ant-tree-title' }),
    ).toBeInTheDocument();
  });

  it('has the column settings when there are no page buttons too', async () => {
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        request={async () => ({ items: [{ id: '1', name: 'Alice' }], total: 1 })}
      />,
    );
    await screen.findByText('Alice');
    expect(document.querySelector('.anticon-setting')).not.toBeNull();
  });

  it('leaves the gateway message to the notice of the shell while it is up: one text, one retry', async () => {
    const gateway = () =>
      new ApiError({ code: 'GATEWAY_UNAVAILABLE', httpStatus: 504, message: 'x', data: null });
    markServiceUnavailable('GET /users');
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        request={async () => {
          throw gateway();
        }}
      />,
    );
    await waitFor(() => expect(document.querySelector('.ant-table-tbody')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    resetServiceStatus();
  });

  it('shows its own error with a retry for the gateway message when the notice of the shell is not up', async () => {
    resetServiceStatus();
    renderPage(
      <PagedListTable<Row>
        rowKey="id"
        columns={columns}
        request={async () => {
          throw new ApiError({
            code: 'GATEWAY_UNAVAILABLE',
            httpStatus: 504,
            message: 'x',
            data: null,
          });
        }}
      />,
    );
    expect(await screen.findByText(/temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
