import { Flex, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { HTMLAttributes, ReactNode } from 'react';
import type { ServerPage } from '../hooks/useServerPage';
import { FailureBar } from './FailureBar';
import { PAGE_SIZE_OPTIONS } from './PagedListTable';

type Props<T> = {
  state: ServerPage<T>;
  columns: ColumnsType<T>;
  rowKey: string | ((row: T) => string);
  /** The text of an empty table; without it, the table's own. */
  emptyText?: string;
  onRow?: (row: T) => HTMLAttributes<HTMLElement>;
  /** Buttons above the table, on the right. */
  toolbar?: ReactNode;
  /** The height of the rows; small unless the page says otherwise (`large` is the table's own). */
  size?: 'small' | 'middle' | 'large';
};

/** A table of a `useServerPage` list: paging, the failure with its retry, the empty text. Nothing makes it wider than its box: it scrolls. */
export function PagedTable<T extends object>({
  state,
  columns,
  rowKey,
  emptyText,
  onRow,
  toolbar,
  size = 'small',
}: Props<T>) {
  return (
    <Flex vertical gap={12}>
      {state.failure ? <FailureBar failure={state.failure} onRetry={state.reload} /> : null}
      {toolbar ? <Flex justify="flex-end">{toolbar}</Flex> : null}
      <Table<T>
        size={size}
        rowKey={rowKey}
        columns={columns}
        dataSource={state.rows}
        loading={state.loading}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText }}
        onRow={onRow}
        pagination={{
          current: state.page,
          pageSize: state.pageSize,
          total: state.total,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: state.setPaging,
        }}
      />
    </Flex>
  );
}
