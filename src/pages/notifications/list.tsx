import { Link, useAccess, useIntl } from '@umijs/max';
import { Alert, Button, DatePicker, Flex, Input, Select, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import {
  listNotifications,
  NOTIFICATION_CATEGORIES,
  type NotificationQuery,
  type NotificationRow,
} from '../../services/notifications';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { pickedDay, utcDayRangeToInstants } from '../../utils/utcDay';
import { NotificationDrawer } from './NotificationDrawer';
import { PagedTable } from './PagedTable';
import { SendModal } from './SendModal';
import { adminText, codeText, instantText } from './texts';
import { useServerPage } from './useServerPage';

type Range = { from: string; to: string } | null;
type Filters = {
  accountId: string;
  category: '' | 'ADMIN' | 'SYSTEM_EVENT';
  isRead: '' | 'true' | 'false';
  range: Range;
};

const initialFilters = (): Filters => ({ accountId: '', category: '', isRead: '', range: null });

const isRow = (row: unknown): row is NotificationRow => typeof row === 'object' && row !== null;

/** The filters that have a value, as the backend names them (the days become instants of the UTC days). */
function paramsOf(filters: Filters): Omit<NotificationQuery, 'page' | 'pageSize'> {
  const params: Omit<NotificationQuery, 'page' | 'pageSize'> = {};
  if (filters.accountId) params.accountId = filters.accountId;
  if (filters.category) params.category = filters.category;
  if (filters.isRead) params.isRead = filters.isRead === 'true';
  if (filters.range) {
    const { from, to } = utcDayRangeToInstants(filters.range.from, filters.range.to);
    params.from = from;
    params.to = to;
  }
  return params;
}

/**
 * 站内通知: the in-app notifications sent to accounts (NOTIFICATION:VIEW), newest first, with a
 * drawer for one and, for NOTIFICATION:SEND, a dialog to send to named accounts. The times of the
 * range are UTC days. Nothing here can message all users: that is the manual push task.
 */
export default function NotificationsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(draft);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const state = useServerPage<NotificationRow, Filters>((query) => {
    const { page, pageSize, ...filters } = query;
    return listNotifications({ page, pageSize, ...paramsOf(filters as Filters) });
  }, applied);

  const search = () => {
    setApplied({ ...draft, accountId: trimSpec(draft.accountId) });
    state.search();
  };
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const cell = { overflowWrap: 'anywhere' as const };
  const columns: ColumnsType<NotificationRow> = [
    {
      key: 'accountId',
      title: t('notifications.col.accountId'),
      render: (_, row) => (
        <span dir="ltr" style={cell}>
          {plainText(row.accountId) || DASH}
        </span>
      ),
    },
    {
      key: 'category',
      title: t('notifications.col.category'),
      render: (_, row) => codeText(intl, 'notifications.category', row.category) || DASH,
    },
    {
      key: 'title',
      title: t('notifications.col.title'),
      render: (_, row) => <EllipsisPopoverText text={plainText(row.title)} lines={2} width={280} />,
    },
    {
      key: 'isRead',
      title: t('notifications.col.isRead'),
      render: (_, row) =>
        row.isRead === true ? (
          <Tag color="green">{t('notifications.read.yes')}</Tag>
        ) : row.isRead === false ? (
          <Tag>{t('notifications.read.no')}</Tag>
        ) : (
          DASH
        ),
    },
    {
      key: 'sentBy',
      title: t('notifications.col.sentBy'),
      render: (_, row) =>
        row.category === 'SYSTEM_EVENT' && !row.sentBy && !row.sentByUsername ? (
          t('notifications.system')
        ) : (
          <span style={cell}>{adminText(row.sentByUsername, row.sentBy)}</span>
        ),
    },
    {
      key: 'createdAt',
      title: t('notifications.col.createdAt'),
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    {
      key: 'actions',
      title: t('notifications.col.actions'),
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setOpenId(plainText(row.id))}>
          {t('notifications.details')}
        </Button>
      ),
    },
  ];

  const shown = { ...state, rows: state.rows.filter(isRow) };
  const manualPush = access.canAccess('PUSH:SEND');

  return (
    <Flex vertical gap={16}>
      <Alert
        type="info"
        showIcon
        title={
          <span>
            {t('notifications.page.scope')}{' '}
            {manualPush ? <Link to="/push/tasks">{t('notifications.page.scopeLink')}</Link> : null}
          </span>
        }
      />
      <Flex gap={8} wrap align="center">
        <Input
          allowClear
          style={{ width: 220 }}
          dir="auto"
          aria-label={t('notifications.filter.accountId')}
          placeholder={t('notifications.filter.accountId')}
          value={draft.accountId}
          onChange={(event) => set('accountId', event.target.value)}
          onPressEnter={search}
        />
        <Select
          allowClear
          style={{ minWidth: 170 }}
          aria-label={t('notifications.filter.category')}
          placeholder={t('notifications.filter.category')}
          value={draft.category || undefined}
          options={NOTIFICATION_CATEGORIES.map((code) => ({
            value: code,
            label: t(`notifications.category.${code}`),
          }))}
          onChange={(value) => set('category', (value ?? '') as Filters['category'])}
        />
        <Select
          allowClear
          style={{ minWidth: 150 }}
          aria-label={t('notifications.filter.isRead')}
          placeholder={t('notifications.filter.isRead')}
          value={draft.isRead || undefined}
          options={[
            { value: 'true', label: t('notifications.read.yes') },
            { value: 'false', label: t('notifications.read.no') },
          ]}
          onChange={(value) => set('isRead', (value ?? '') as Filters['isRead'])}
        />
        <DatePicker.RangePicker
          allowClear
          aria-label={t('notifications.filter.range')}
          onChange={(range: [Dayjs | null, Dayjs | null] | null) =>
            set(
              'range',
              range?.[0] && range[1]
                ? { from: pickedDay(range[0]), to: pickedDay(range[1]) }
                : null,
            )
          }
        />
        <Button type="primary" onClick={search}>
          {t('notifications.filter.search')}
        </Button>
        <Can code="NOTIFICATION:SEND">
          <Button onClick={() => setComposing(true)}>{t('notifications.send.open')}</Button>
        </Can>
      </Flex>
      <Typography.Text type="secondary">{t('notifications.page.timeNote')}</Typography.Text>
      <PagedTable<NotificationRow>
        state={shown}
        columns={columns}
        rowKey={(row) => plainText(row.id)}
        emptyText={t('notifications.empty')}
        onRow={(row) => ({
          // A press on a button, or on the popover of a long text (it is drawn elsewhere in the page but its events come up through the row), is that control's own.
          onClick: (event) => {
            if ((event.target as HTMLElement).closest('button, .ant-popover')) return;
            setOpenId(plainText(row.id));
          },
          style: { cursor: 'pointer' },
        })}
      />
      {openId !== null ? <NotificationDrawer id={openId} onClose={() => setOpenId(null)} /> : null}
      {composing ? (
        <SendModal
          onClose={() => setComposing(false)}
          onSent={() => {
            state.search();
          }}
        />
      ) : null}
    </Flex>
  );
}
