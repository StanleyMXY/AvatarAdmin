import { useIntl } from '@umijs/max';
import { Flex, type TableColumnsType, Typography } from 'antd';
import { useCallback } from 'react';
import { type AuthEvent, listAuthEvents } from '../../services/users';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Cell } from './Cell';
import { ServerTable } from './ServerTable';
import { labelOf } from './text';

type Row = AuthEvent & { rowId: string };

const hash = (value: unknown) => {
  const text = plainText(value);
  return text === '' ? DASH : <Typography.Text code>{text}</Typography.Text>;
};

/**
 * The authentication log of the account, newest first, a page at a time (`GET /users/{id}/auth-events`).
 * The backend keeps only the first eight characters of the device and IP hashes; they are shown as
 * they are, a dash where there is none.
 */
export function AuthEventsTab({ accountId }: { accountId: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  // Two events can be equal in every field, so each row gets a key of its place.
  const load = useCallback(
    async (paging: { page: number; pageSize: number }) => {
      const answer = await listAuthEvents(accountId, paging);
      return {
        ...answer,
        items: answer.items.map((event, i) => ({
          ...event,
          rowId: `${paging.page}-${paging.pageSize}-${i}`,
        })),
      };
    },
    [accountId],
  );
  const columns: TableColumnsType<Row> = [
    {
      title: t('users.authEvents.at'),
      render: (_, row) => formatInstant(plainText(row.at), intl.locale) || DASH,
    },
    {
      title: t('users.authEvents.type'),
      render: (_, row) => labelOf(intl, 'users.authEvent', row.type),
    },
    { title: t('users.authEvents.reason'), render: (_, row) => <Cell value={row.reason} /> },
    { title: t('users.authEvents.device'), render: (_, row) => hash(row.deviceIdHashPrefix) },
    { title: t('users.authEvents.ip'), render: (_, row) => hash(row.ipHashPrefix) },
  ];
  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">{t('users.authEvents.note')}</Typography.Text>
      <ServerTable<Row> testId="auth-events-table" rowKey="rowId" columns={columns} load={load} />
    </Flex>
  );
}
