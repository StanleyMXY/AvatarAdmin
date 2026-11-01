import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Popconfirm, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type ChannelPackage,
  listChannelPackages,
  updateChannelPackage,
} from '../../services/channelPackages';
import { describeFailure } from '../../session/describe';
import { DASH } from '../../utils/ratio';
import { FailureBar } from '../appVersions/FailureBar';
import { codeText, instantText } from '../appVersions/texts';
import { useLatestRead } from '../appVersions/useLatestRead';
import { ChannelModal } from './ChannelModal';

/**
 * The switch of a channel package. Switching on happens at once; switching off asks first, because
 * the channel stops prompting users to update and takes no new version until it is on again. The
 * switch always shows what the list says, so a refusal leaves it where it was.
 */
function EnabledSwitch({
  row,
  disabled,
  onChanged,
}: {
  row: ChannelPackage;
  disabled: boolean;
  onChanged: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { run, pending } = useSingleFlight(async (next: boolean) => {
    try {
      await updateChannelPackage(row.code, {
        name: row.name,
        packageName: row.packageName,
        enabled: next,
      });
      message.success(t('channels.saved'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    onChanged();
  });
  const label = t('channels.enabledOf', { name: row.name || row.code });
  if (!row.enabled) {
    return (
      <Switch
        checked={false}
        loading={pending}
        disabled={disabled}
        aria-label={label}
        onChange={() => void run(true).catch(() => {})}
      />
    );
  }
  return (
    <Popconfirm
      title={
        <span style={{ display: 'block', maxWidth: 'min(320px, 80vw)', overflowWrap: 'anywhere' }}>
          {t('channels.disableAsk', { name: row.name || row.code })}
        </span>
      }
      okText={t('channels.disableConfirm')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ danger: true, loading: pending, disabled: pending }}
      disabled={disabled || pending}
      onConfirm={async () => {
        await run(false).catch(() => {});
      }}
    >
      <Switch checked loading={pending} disabled={disabled} aria-label={label} />
    </Popconfirm>
  );
}

/**
 * 渠道包: the channel packages, which scope the versions, the statistics and the campaigns. There
 * is no delete, only the switch. The list is readable by any signed-in administrator; this page,
 * which writes, is opened and written with CHANNEL:MANAGE.
 */
export default function ChannelsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('CHANNEL:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [editing, setEditing] = useState<ChannelPackage | 'new' | null>(null);
  const read = useLatestRead(listChannelPackages, { keepWhileReading: true });
  const rows = read.data ?? [];

  const columns: ColumnsType<ChannelPackage> = [
    {
      key: 'code',
      title: t('channels.col.code'),
      render: (_, row) => <span style={{ overflowWrap: 'anywhere' }}>{row.code}</span>,
    },
    {
      key: 'name',
      title: t('channels.col.name'),
      render: (_, row) => <EllipsisPopoverText text={row.name} lines={2} width={220} />,
    },
    {
      key: 'platform',
      title: t('channels.col.platform'),
      render: (_, row) => codeText(intl, 'channels.platform', row.platform) || DASH,
    },
    {
      key: 'distribution',
      title: t('channels.col.distribution'),
      render: (_, row) => codeText(intl, 'channels.distribution', row.distribution) || DASH,
    },
    {
      key: 'packageName',
      title: t('channels.col.packageName'),
      render: (_, row) => <EllipsisPopoverText text={row.packageName} lines={2} width={220} />,
    },
    {
      key: 'enabled',
      title: t('channels.col.enabled'),
      render: (_, row) => <EnabledSwitch row={row} disabled={!canWrite} onChanged={read.reload} />,
    },
    {
      key: 'createdAt',
      title: t('channels.col.createdAt'),
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    {
      key: 'actions',
      title: t('channels.col.actions'),
      // Stays in sight when the table is wider than its box and scrolls.
      fixed: 'right',
      render: (_, row) =>
        canWrite ? (
          <Button type="link" size="small" onClick={() => setEditing(row)}>
            {t('channels.action.edit')}
          </Button>
        ) : (
          DASH
        ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('channels.note')} />
      {canWrite ? (
        <Flex>
          <Button type="primary" onClick={() => setEditing('new')}>
            {t('channels.new')}
          </Button>
        </Flex>
      ) : null}
      {read.failure ? <FailureBar failure={read.failure} onRetry={read.reload} /> : null}
      <Table<ChannelPackage>
        size="small"
        rowKey="code"
        columns={columns}
        dataSource={rows}
        loading={read.data === null && read.failure === null}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('channels.empty') }}
      />
      {/* Mounted only while it is open: a dialog that stayed mounted would keep what was typed in it for the next one. */}
      {editing !== null ? (
        <ChannelModal
          channel={editing === 'new' ? null : editing}
          existing={rows.map((c) => c.code)}
          onClose={() => setEditing(null)}
          onSaved={read.reload}
        />
      ) : null}
    </Flex>
  );
}
