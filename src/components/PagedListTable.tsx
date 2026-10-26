import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Alert, Button } from 'antd';
import { type ReactNode, useRef, useState } from 'react';
import type { Page } from '../request/errors';
import { describeFailure } from '../session/describe';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

type Props<T extends Record<string, unknown>, F extends Record<string, unknown>> = {
  rowKey: string | ((row: T) => string);
  columns: ProColumns<T>[];
  /** Asks the backend for one page. `page` starts at 1; the other fields are the search form's. */
  request: (params: { page: number; pageSize: number } & F) => Promise<Page<T>>;
  /** Buttons above the table, on the right. */
  toolbar?: ReactNode[];
  /** The search form starts folded (the default). */
  defaultCollapsed?: true;
  /** Lets the page reload the table after a write. */
  actionRef?: React.MutableRefObject<ActionType | undefined>;
};

/**
 * A server-paged list on ProTable: `Page<T>` in the backend's shape (`items`, `total`) becomes what
 * the table wants; the page sizes are 10, 20, 50 and 100 (20 by default). When two requests overlap
 * the answer of the newest one is what is shown, whichever arrives first. A failed request shows the
 * error above the table, with a retry, and the table does not break.
 */
export function PagedListTable<
  T extends Record<string, unknown>,
  F extends Record<string, unknown> = Record<string, never>,
>({ rowKey, columns, request, toolbar, defaultCollapsed = true, actionRef }: Props<T, F>) {
  const intl = useIntl();
  const innerRef = useRef<ActionType | undefined>(undefined);
  const ref = actionRef ?? innerRef;
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);
  const newest = useRef<Promise<{ data: T[]; total: number; success: boolean }>>(
    Promise.resolve({ data: [], total: 0, success: true }),
  );

  const load = async (params: Record<string, unknown>) => {
    const { current, pageSize, ...search } = params;
    const mine = ++counter.current;
    const promise = (async () => {
      try {
        const page = await request({
          ...(search as Record<string, unknown>),
          page: Number(current ?? 1),
          pageSize: Number(pageSize ?? DEFAULT_PAGE_SIZE),
        } as { page: number; pageSize: number } & F);
        return { data: page.items, total: page.total, success: true };
      } catch (error) {
        if (mine === counter.current) setFailure(describeFailure(intl, error).text);
        return { data: [] as T[], total: 0, success: false };
      }
    })();
    newest.current = promise;
    const result = await promise;
    // An older request that finished after a newer one started shows the newer one's answer.
    if (mine !== counter.current) return newest.current;
    if (result.success) setFailure(null);
    return result;
  };

  return (
    <>
      {failure ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure })}
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
        search={{ defaultCollapsed, labelWidth: 'auto' }}
        toolBarRender={toolbar ? () => toolbar : false}
        options={false}
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
