import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import type { ServerPage } from '../hooks/useServerPage';
import { PagedTable } from './PagedTable';

type Row = { id: string; name: string };

const state = (patch: Partial<ServerPage<Row>> = {}): ServerPage<Row> => ({
  rows: [
    { id: 'a', name: 'สมชาย' },
    { id: 'b', name: 'مريم' },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
  loading: false,
  failure: null,
  setPaging: () => {},
  search: () => {},
  reload: () => {},
  ...patch,
});

/** Draws again from scratch: a re-render of the same root would lose the providers. */
const drawAgain = (ui: Parameters<typeof renderPage>[0]) => {
  cleanup();
  return renderPage(ui);
};

const columns = [{ title: 'Name', dataIndex: 'name' }];

describe('PagedTable', () => {
  it('draws the rows of the page', () => {
    renderPage(<PagedTable state={state()} columns={columns} rowKey="id" />);
    expect(screen.getByText('สมชาย')).toBeInTheDocument();
    expect(screen.getByText('مريم')).toBeInTheDocument();
  });

  it('takes the key of a row from a field name or from a function', () => {
    const { container } = renderPage(<PagedTable state={state()} columns={columns} rowKey="id" />);
    const keys = () =>
      [...container.querySelectorAll('tbody tr[data-row-key]')].map((tr) =>
        tr.getAttribute('data-row-key'),
      );
    expect(keys()).toEqual(['a', 'b']);
    const again = drawAgain(
      <PagedTable state={state()} columns={columns} rowKey={(row) => `k-${row.id}`} />,
    );
    expect(
      [...again.container.querySelectorAll('tbody tr[data-row-key]')].map((tr) =>
        tr.getAttribute('data-row-key'),
      ),
    ).toEqual(['k-a', 'k-b']);
  });

  it('says its own words, or the ones it is given, when there are no rows', () => {
    renderPage(<PagedTable state={state({ rows: [], total: 0 })} columns={columns} rowKey="id" />);
    expect(screen.queryByText('No rows here')).toBeNull();
    expect(document.querySelector('.ant-empty')).not.toBeNull();
    drawAgain(
      <PagedTable
        state={state({ rows: [], total: 0 })}
        columns={columns}
        rowKey="id"
        emptyText="No rows here"
      />,
    );
    expect(screen.getByText('No rows here')).toBeInTheDocument();
  });

  it('shows the failure with a retry that reads again, and no failure bar otherwise', async () => {
    const reload = vi.fn();
    renderPage(<PagedTable state={state()} columns={columns} rowKey="id" />);
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
    drawAgain(
      <PagedTable
        state={state({ rows: [], total: 0, failure: 'Server error.', reload })}
        columns={columns}
        rowKey="id"
      />,
    );
    expect(screen.getByText(/Server error\./)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Retry/ }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('draws the toolbar above the table, only when it is given', () => {
    renderPage(
      <PagedTable
        state={state()}
        columns={columns}
        rowKey="id"
        toolbar={<button type="button">Add</button>}
      />,
    );
    const add = screen.getByRole('button', { name: 'Add' });
    const table = document.querySelector('.ant-table') as HTMLElement;
    expect(add.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(table).queryByRole('button', { name: 'Add' })).toBeNull();
    drawAgain(<PagedTable state={state()} columns={columns} rowKey="id" />);
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  it('passes the attributes of a row on, and tells the page when the person changes the page or the size', async () => {
    const setPaging = vi.fn();
    renderPage(
      <PagedTable
        state={state({ total: 45, setPaging })}
        columns={columns}
        rowKey="id"
        onRow={(row) => ({ 'data-picked': row.id }) as never}
      />,
    );
    expect(document.querySelector('tbody tr[data-picked="b"]')).not.toBeNull();
    await userEvent.setup().click(screen.getByTitle('2'));
    expect(setPaging).toHaveBeenCalledWith(2, 20);
  });

  it('offers the page sizes even for a short list', () => {
    renderPage(<PagedTable state={state()} columns={columns} rowKey="id" />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows the loading state of the table while a page is read', () => {
    renderPage(<PagedTable state={state()} columns={columns} rowKey="id" />);
    expect(document.querySelector('.ant-spin[aria-busy="true"]')).toBeNull();
    drawAgain(<PagedTable state={state({ loading: true })} columns={columns} rowKey="id" />);
    expect(document.querySelector('.ant-spin[aria-busy="true"]')).not.toBeNull();
  });
});
