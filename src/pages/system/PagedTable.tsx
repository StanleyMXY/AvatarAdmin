import type { TableColumnsType } from 'antd';
import type { MutableRefObject, ReactNode } from 'react';
import { PagedTable as ServerPagedTable } from '../../components/PagedTable';
import { useServerPage } from '../../hooks/useServerPage';
import type { Page } from '../../request/errors';

type Props<T> = {
  rowKey: string;
  columns: TableColumnsType<T>;
  /** Asks the backend for one page (`page` starts at 1). */
  load: (paging: { page: number; pageSize: number }) => Promise<Page<T>>;
  /** Buttons above the table, on the right. */
  toolbar?: ReactNode;
  /** Receives a function that reads the page again (after a write). */
  reloadRef: MutableRefObject<(() => void) | null>;
};

/**
 * A server-paged table without a search form (the shared one always draws an empty search card when
 * it has no filter): the shared paged table over `useServerPage`, which goes back to the last page
 * that has rows when the last row of the last page was deleted. Its rows have the table's own height.
 */
export function PagedTable<T extends object>({
  rowKey,
  columns,
  load,
  toolbar,
  reloadRef,
}: Props<T>) {
  const state = useServerPage(load, {}, { backToLastPage: true });
  reloadRef.current = state.reload;
  return (
    <ServerPagedTable<T>
      state={state}
      columns={columns}
      rowKey={rowKey}
      toolbar={toolbar}
      size="large"
    />
  );
}
