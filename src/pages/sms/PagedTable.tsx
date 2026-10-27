import { Flex, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import { FailureBar } from './FailureBar';
import type { ServerPage } from './useServerPage';

type Props<T> = {
  state: ServerPage<T>;
  columns: ColumnsType<T>;
  rowKey: (row: T) => string;
  emptyText: string;
};

/** A table of a `useServerPage` list: paging, the failure with its retry, the empty text. Nothing makes it wider than its box: it scrolls. */
export function PagedTable<T extends object>({ state, columns, rowKey, emptyText }: Props<T>) {
  return (
    <Flex vertical gap={12}>
      {state.failure ? <FailureBar failure={state.failure} onRetry={state.reload} /> : null}
      <Table<T>
        size="small"
        rowKey={rowKey}
        columns={columns}
        dataSource={state.rows}
        loading={state.loading}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText }}
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
