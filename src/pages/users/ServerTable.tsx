import { useIntl } from '@umijs/max';
import { Alert, Button, Table, type TableColumnsType } from 'antd';
import { type MutableRefObject, type ReactNode, useCallback, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import { useLatestRead } from '../../hooks/useLatestRead';
import type { Page } from '../../request/errors';

type Props<T> = {
  /** A test id for the wrapper (the tabs are found by it). */
  testId?: string;
  rowKey: string | ((row: T) => string);
  columns: TableColumnsType<T>;
  /** Asks for one page (`page` starts at 1). Give a stable function (`useCallback` over what is asked): a new one makes the table read again. */
  load: (paging: { page: number; pageSize: number }) => Promise<Page<T>>;
  /** Below each row, for a table whose rows open (the abuse clusters). */
  expandedRowRender?: (row: T) => ReactNode;
  size?: 'small' | 'middle';
  /** Receives a function that reads the page again (after a write in a row). */
  reloadRef?: MutableRefObject<(() => void) | null>;
};

/**
 * A table read from the server a page at a time, with the page sizes 10, 20, 50 and 100. The answer
 * of an older request never replaces the newer one; a failure is said in words above the table, with
 * a retry; the rows of the page being left stay until the next page arrives.
 */
export function ServerTable<T extends object>({
  testId,
  rowKey,
  columns,
  load,
  expandedRowRender,
  size = 'small',
  reloadRef,
}: Props<T>) {
  const intl = useIntl();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const fetcher = useCallback(() => load({ page, pageSize }), [load, page, pageSize]);
  const { data, failure, loading, reload } = useLatestRead(fetcher, { keepWhileReading: true });
  if (reloadRef) reloadRef.current = reload;

  return (
    <div data-testid={testId}>
      {failure ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure })}
          action={
            <Button size="small" onClick={reload}>
              {intl.formatMessage({ id: 'pages.common.retry' })}
            </Button>
          }
        />
      ) : null}
      <Table<T>
        size={size}
        rowKey={rowKey}
        columns={columns}
        dataSource={data?.items ?? []}
        loading={loading}
        scroll={{ x: 'max-content' }}
        expandable={expandedRowRender ? { expandedRowRender } : undefined}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />
    </div>
  );
}
