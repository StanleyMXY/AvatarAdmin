import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Link, useAccess, useIntl } from '@umijs/max';
import { App } from 'antd';
import { useRef } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  type AdminAlert,
  ALERT_TYPES,
  alertDetailKey,
  alertTypeKey,
  isKnownAlertType,
  listAlerts,
  resolveAlert,
} from '../../services/monitor';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

type Filters = { status?: 'OPEN' | 'RESOLVED'; type?: string };

/** 系统监控 · 告警: background alerts of the backend; "Close" needs MONITOR:MANAGE. */
export default function AlertsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canClose = access.canAccess('MONITOR:MANAGE');
  const ref = useRef<ActionType | undefined>(undefined);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const typeText = (type: string) => (isKnownAlertType(type) ? t(alertTypeKey(type)) : type);

  // A fixed detail the backend writes for the type is shown in words with its code beside it;
  // anything else (an error code, an exception class, an object) is shown as it comes.
  const detailText = (row: AdminAlert): string | null => {
    const raw = plainText(row.detail);
    const key = alertDetailKey(row.type, raw);
    return key ? t('monitor.alert.detailWithCode', { text: t(key), code: raw }) : raw || null;
  };

  const close = async (alert: AdminAlert) => {
    try {
      await resolveAlert(alert.id);
      message.success(t('monitor.alert.closed'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    // Either way the list is read again: after a refusal the state is not what the row showed.
    ref.current?.reload();
  };

  const columns: ProColumns<AdminAlert>[] = [
    {
      title: t('monitor.alert.col.type'),
      dataIndex: 'type',
      valueType: 'select',
      fieldProps: { showSearch: true, optionFilterProp: 'label' },
      valueEnum: Object.fromEntries(
        ALERT_TYPES.map((type) => [type, { text: t(alertTypeKey(type)) }]),
      ),
      render: (_, row) => typeText(row.type),
    },
    {
      title: t('monitor.alert.col.account'),
      dataIndex: 'accountId',
      search: false,
      render: (_, row) =>
        row.accountId ? (
          <Link to={`/users/${encodeURIComponent(row.accountId)}`}>{row.accountId}</Link>
        ) : (
          DASH
        ),
    },
    {
      title: t('monitor.alert.col.ref'),
      search: false,
      render: (_, row) =>
        row.refType || row.refId ? (
          <EllipsisPopoverText
            text={`${plainText(row.refType) || DASH}: ${plainText(row.refId) || DASH}`}
            width={260}
          />
        ) : (
          DASH
        ),
    },
    {
      title: t('monitor.alert.col.detail'),
      dataIndex: 'detail',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={detailText(row)} width={320} />,
    },
    {
      title: t('monitor.alert.col.status'),
      dataIndex: 'status',
      valueType: 'select',
      initialValue: 'OPEN',
      valueEnum: {
        OPEN: { text: t('monitor.alert.status.OPEN') },
        RESOLVED: { text: t('monitor.alert.status.RESOLVED') },
      },
      render: (_, row) => (
        <StatusTag
          status={row.status}
          options={{
            OPEN: { label: t('monitor.alert.status.OPEN'), color: 'orange' },
            RESOLVED: { label: t('monitor.alert.status.RESOLVED'), color: 'green' },
          }}
        />
      ),
    },
    {
      title: t('monitor.alert.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => formatInstant(row.createdAt, intl.locale),
    },
    {
      title: t('monitor.alert.col.resolvedAt'),
      dataIndex: 'resolvedAt',
      search: false,
      render: (_, row) => (row.resolvedAt ? formatInstant(row.resolvedAt, intl.locale) : DASH),
    },
    ...(canClose
      ? [
          {
            ...ACTIONS_COLUMN,
            title: t('monitor.alert.col.actions'),
            key: 'actions',
            search: false,
            render: (_: unknown, row: AdminAlert) =>
              row.status === 'OPEN' ? (
                <RowActions
                  actions={[
                    {
                      key: 'close',
                      label: t('monitor.alert.close'),
                      confirmText: t(
                        row.type === 'LOOK_PACKAGE_PREPARE_FAILED'
                          ? 'monitor.alert.closeConfirmLookPackage'
                          : 'monitor.alert.closeConfirm',
                      ),
                      onClick: () => close(row),
                    },
                  ]}
                />
              ) : null,
          } satisfies ProColumns<AdminAlert>,
        ]
      : []),
  ];

  return (
    <PagedListTable<AdminAlert, Filters>
      rowKey="id"
      columns={columns}
      actionRef={ref}
      request={async ({ page, pageSize, status, type }) =>
        listAlerts({
          page,
          pageSize,
          status: status || undefined,
          type: type || undefined,
        })
      }
    />
  );
}
