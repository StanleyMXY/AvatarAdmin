import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Table, type TableColumnsType, Typography } from 'antd';
import { useCallback } from 'react';
import { listDevices, type UserDevice } from '../../services/users';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Cell } from './Cell';
import { useRead } from './useRead';

/**
 * The push registrations of the account (`GET /users/{id}/devices`, not paged). The backend gives
 * only the last six characters of a push token; that is all that is shown, and nothing is copyable
 * as a token.
 */
export function DevicesTab({ accountId }: { accountId: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const fetcher = useCallback(() => listDevices(accountId), [accountId]);
  const { data, failure, loading, reload } = useRead(fetcher);

  const columns: TableColumnsType<UserDevice> = [
    { title: t('users.devices.platform'), render: (_, row) => <Cell value={row.platform} /> },
    { title: t('users.devices.appVersion'), render: (_, row) => <Cell value={row.appVersion} /> },
    { title: t('users.devices.locale'), render: (_, row) => <Cell value={row.locale} /> },
    {
      title: t('users.devices.lastSeenAt'),
      render: (_, row) => {
        const text = plainText(row.lastSeenAt);
        return text === '' ? DASH : formatInstant(text, intl.locale);
      },
    },
    {
      title: t('users.devices.tokenSuffix'),
      render: (_, row) => {
        const suffix = plainText(row.tokenSuffix);
        return suffix === '' ? (
          DASH
        ) : (
          <Typography.Text code>
            <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{`…${suffix}`}</span>
          </Typography.Text>
        );
      },
    },
  ];

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">{t('users.devices.note')}</Typography.Text>
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure })}
          action={
            <Button size="small" onClick={reload}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      <div data-testid="devices-table">
        <Table<UserDevice>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </Flex>
  );
}
