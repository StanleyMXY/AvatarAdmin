import { useIntl } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import { useCallback } from 'react';
import { listUserSessions, type UserSession } from '../../services/users';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Cell } from './Cell';
import { ServerTable } from './ServerTable';
import { formatSeconds, labelOf } from './text';

/** The sessions of the account, newest first, a page at a time (`GET /users/{id}/sessions`). */
export function SessionsTab({ accountId }: { accountId: string }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const load = useCallback(
    (paging: { page: number; pageSize: number }) => listUserSessions(accountId, paging),
    [accountId],
  );
  const when = (value: unknown) => {
    const text = plainText(value);
    return text === '' ? DASH : formatInstant(text, intl.locale);
  };
  const columns: TableColumnsType<UserSession> = [
    { title: t('users.sessions.requestedAt'), render: (_, row) => when(row.requestedAt) },
    { title: t('users.sessions.startedAt'), render: (_, row) => when(row.startedAt) },
    { title: t('users.sessions.endedAt'), render: (_, row) => when(row.endedAt) },
    {
      title: t('users.sessions.duration'),
      align: 'right',
      render: (_, row) =>
        row.endedAt === null && row.durationSeconds === null && row.startedAt
          ? t('users.sessions.ongoing')
          : formatSeconds(row.durationSeconds, t),
    },
    { title: t('users.sessions.tier'), render: (_, row) => <Cell value={row.modelTier} /> },
    { title: t('users.sessions.language'), render: (_, row) => <Cell value={row.language} /> },
    {
      title: t('users.sessions.endReason'),
      render: (_, row) => labelOf(intl, 'users.endReason', row.endReason),
    },
  ];
  return (
    <ServerTable<UserSession> testId="sessions-table" rowKey="id" columns={columns} load={load} />
  );
}
