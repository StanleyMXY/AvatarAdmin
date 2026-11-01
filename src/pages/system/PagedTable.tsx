import { useIntl } from '@umijs/max';
import { Alert, Button, Table, type TableColumnsType } from 'antd';
import { type MutableRefObject, type ReactNode, useCallback, useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import type { Page } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import { useRead } from './useRead';

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
 * it has no filter). Page sizes 10, 20, 50, 100; the answer of the newest read is the one shown; a
 * failure is said in words with a retry, and the rows of the page being left stay until the next one
 * arrives.
 */
export function PagedTable<T extends object>({
  rowKey,
  columns,
  load,
  toolbar,
  reloadRef,
}: Props<T>) {
  const intl = useIntl();
  const [paging, setPaging] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const fetcher = useCallback(() => load(paging), [load, paging]);
  const { state, reload } = useRead(fetcher, `${paging.page}:${paging.pageSize}`);
  reloadRef.current = reload;
  // The last row of the last page was deleted: that page is empty now while the rows before it are
  // not, so the table goes to the last page that has rows instead of showing "no data".
  useEffect(() => {
    if (state.status !== 'ok' || state.data.items.length > 0) return;
    const total = Number.isFinite(state.data.total) ? state.data.total : 0;
    if (paging.page <= 1 || total <= 0) return;
    const last = Math.max(1, Math.ceil(total / paging.pageSize));
    if (last < paging.page) setPaging((now) => ({ ...now, page: last }));
  }, [state, paging.page, paging.pageSize]);
  return (
    <div>
      {state.status === 'failed' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={intl.formatMessage(
            { id: 'pages.common.loadFailed' },
            { message: describeFailure(intl, state.error).text },
          )}
          action={
            <Button size="small" onClick={reload}>
              {intl.formatMessage({ id: 'pages.common.retry' })}
            </Button>
          }
        />
      ) : null}
      {toolbar ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          {toolbar}
        </div>
      ) : null}
      <Table<T>
        rowKey={rowKey}
        columns={columns}
        dataSource={state.data?.items ?? []}
        loading={state.status === 'loading'}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: paging.page,
          pageSize: paging.pageSize,
          total: state.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (page, pageSize) =>
            setPaging({ page: pageSize === paging.pageSize ? page : 1, pageSize }),
        }}
      />
    </div>
  );
}
