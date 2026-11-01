import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Alert, Button, Skeleton } from 'antd';
import { type ReactNode, useRef, useState, useSyncExternalStore } from 'react';
import type { Page } from '../request/errors';
import { isServiceUnavailable, subscribeServiceStatus } from '../request/serviceStatus';
import { describeFailure } from '../session/describe';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

// biome-ignore lint/suspicious/noExplicitAny: ProTable's own row constraint
type Props<T extends Record<string, any>, F extends Record<string, unknown>> = {
  rowKey: string | ((row: T) => string);
  columns: ProColumns<T>[];
  /** Asks the backend for one page. `page` starts at 1; the other fields are the search form's. */
  request: (params: { page: number; pageSize: number } & F) => Promise<Page<T>>;
  /** Buttons above the table, on the right. */
  toolbar?: ReactNode[];
  /**
   * The search form starts folded (the default), showing the first filters; `false` opens it, for a
   * list whose filters all matter at once.
   */
  defaultCollapsed?: boolean;
  /** Lets the page reload the table after a write. */
  actionRef?: React.MutableRefObject<ActionType | undefined>;
};

/** Whether ProTable would draw a filter for this column (the form is left out when none would be drawn). */
const hasFilter = (column: ProColumns<Record<string, unknown>>): boolean =>
  column.search !== false &&
  column.valueType !== 'option' &&
  column.valueType !== 'index' &&
  column.valueType !== 'indexBorder' &&
  (column.dataIndex !== undefined || column.key !== undefined);

/**
 * A server-paged list on ProTable: `Page<T>` in the backend's shape (`items`, `total`) becomes what
 * the table wants; the page sizes are 10, 20, 50 and 100 (20 by default). When two requests overlap
 * the answer of the newest one is what is shown, whichever arrives first. A failed request shows the
 * error above the table, with a retry, and the table does not break. When no column has a filter
 * there is no search area at all (it would be a card with two buttons that do nothing).
 */
export function PagedListTable<
  // biome-ignore lint/suspicious/noExplicitAny: ProTable's own row constraint, so that `interface` rows work
  T extends Record<string, any>,
  F extends Record<string, unknown> = Record<string, never>,
>({ rowKey, columns, request, toolbar, defaultCollapsed = true, actionRef }: Props<T, F>) {
  const intl = useIntl();
  const innerRef = useRef<ActionType | undefined>(undefined);
  const ref = actionRef ?? innerRef;
  const [failure, setFailure] = useState<{ text: string; code: string } | null>(null);
  // The rows are held here, so that a failed read can take them away: they belong to another page or
  // other filters than the ones that failed.
  const [rows, setRows] = useState<T[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const noticeUp = useSyncExternalStore(subscribeServiceStatus, isServiceUnavailable);
  const counter = useRef(0);

  // ProTable cancels the older of two overlapping requests itself; the counter only makes sure the
  // error shown is the error of the newest request.
  const load = async (params: Record<string, unknown>) => {
    const { current, pageSize, ...search } = params;
    const mine = ++counter.current;
    try {
      const page = await request({
        ...(search as Record<string, unknown>),
        page: Number(current ?? 1),
        pageSize: Number(pageSize ?? DEFAULT_PAGE_SIZE),
      } as { page: number; pageSize: number } & F);
      if (mine === counter.current) setFailure(null);
      return { data: page.items, total: page.total, success: true };
    } catch (error) {
      if (mine === counter.current) {
        const described = describeFailure(intl, error);
        setFailure({ text: described.text, code: described.error.code });
        setRows([]);
      }
      return { data: [] as T[], total: 0, success: false };
    } finally {
      setLoadedOnce(true);
    }
  };

  // The gateway's "unavailable" page is already said, with a retry, by the notice above the page:
  // the table does not say it a second time.
  const sayFailure = failure !== null && !(failure.code === 'GATEWAY_UNAVAILABLE' && noticeUp);

  return (
    <>
      {failure && sayFailure ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure.text })}
          action={
            <Button size="small" onClick={() => ref.current?.reload()}>
              {intl.formatMessage({ id: 'pages.common.retry' })}
            </Button>
          }
        />
      ) : null}
      <ProTable<T>
        rowKey={rowKey}
        columns={columns}
        actionRef={ref}
        request={load}
        search={
          columns.some((column) => hasFilter(column as ProColumns<Record<string, unknown>>))
            ? { defaultCollapsed, labelWidth: 'auto' }
            : false
        }
        dataSource={rows}
        onDataSourceChange={setRows}
        // The toolbar always has the column settings (spec 4.1); the page's own buttons come with it.
        toolBarRender={() => toolbar ?? []}
        options={{ setting: true, reload: false, density: false, fullScreen: false }}
        // Until the first page has come, the body shows lines of a skeleton instead of "no data".
        locale={{
          emptyText: loadedOnce ? undefined : (
            <Skeleton active title={false} paragraph={{ rows: 5 }} />
          ),
        }}
        scroll={{ x: 'max-content' }}
        pagination={{
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
        }}
      />
    </>
  );
}
