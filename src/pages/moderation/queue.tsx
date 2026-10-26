import type { ProColumns } from '@ant-design/pro-components';
import { Link, useIntl } from '@umijs/max';
import { Alert, Button, Flex, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { StatusTag } from '../../components/StatusTag';
import {
  getModerationStats,
  listModerationRecords,
  type ModerationContentType,
  type ModerationRecord,
  type ModerationSource,
  type ModerationStatus,
} from '../../services/moderation';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { todayUtc } from '../../utils/utcDay';
import { formatDuration, secondsSince } from './duration';
import { contentTypeEnum, labelOf, sourceEnum, statusEnum, statusOptions } from './options';

type Filters = {
  status?: ModerationStatus;
  source?: ModerationSource;
  contentType?: ModerationContentType;
};

type Oldest =
  | { state: 'loading' }
  | { state: 'ready'; seconds: number | null }
  | { state: 'failed'; message: string };

/**
 * 审核队列 (`MODERATION:VIEW`): the records of the automatic check, of reports and of complaints.
 * The backend puts the ones that wait first, longest waiting at the top; the banner says how long
 * the oldest one has waited, because reports must really be handled.
 */
export default function ModerationQueuePage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [oldest, setOldest] = useState<Oldest>({ state: 'loading' });
  const counter = useRef(0);

  // `oldestPendingSeconds` is a current value, whatever the range; one UTC day is the smallest one the endpoint takes.
  const loadOldest = useCallback(async () => {
    const mine = ++counter.current;
    try {
      const day = todayUtc();
      const stats = await getModerationStats({ from: day, to: day });
      if (mine === counter.current)
        setOldest({ state: 'ready', seconds: stats.oldestPendingSeconds });
    } catch (error) {
      if (mine === counter.current) {
        setOldest({ state: 'failed', message: describeFailure(intl, error).text });
      }
    }
  }, [intl]);

  useEffect(() => {
    void loadOldest();
  }, [loadOldest]);

  const options = statusOptions(t);
  const now = Date.now();

  const columns: ProColumns<ModerationRecord>[] = [
    {
      title: t('moderation.field.id'),
      dataIndex: 'id',
      search: false,
      render: (_, row) => (
        <Link to={`/moderation/${encodeURIComponent(row.id)}`}>
          <EllipsisPopoverText text={row.id} width={140} lines={1} />
        </Link>
      ),
    },
    {
      title: t('moderation.field.contentType'),
      dataIndex: 'contentType',
      valueType: 'select',
      valueEnum: contentTypeEnum(t),
      render: (_, row) => labelOf(t, intl.messages, 'moderation.contentType', row.contentType),
    },
    {
      title: t('moderation.field.source'),
      dataIndex: 'source',
      valueType: 'select',
      valueEnum: sourceEnum(t),
      render: (_, row) => labelOf(t, intl.messages, 'moderation.source', row.source),
    },
    {
      title: t('moderation.field.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: statusEnum(t),
      render: (_, row) => <StatusTag status={row.status} options={options} />,
    },
    {
      title: t('moderation.field.waiting'),
      key: 'waiting',
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) =>
        row.status === 'PENDING_REVIEW'
          ? formatDuration(secondsSince(row.createdAt, now), t, intl.locale)
          : DASH,
    },
    {
      title: t('moderation.field.autoLevel'),
      dataIndex: 'autoLevel',
      search: false,
      render: (_, row) => labelOf(t, intl.messages, 'moderation.autoLevel', row.autoLevel),
    },
    {
      title: t('moderation.field.categories'),
      dataIndex: 'categories',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={row.categories?.join(', ') || null} width={200} />
      ),
    },
    {
      title: t('moderation.field.score'),
      dataIndex: 'score',
      search: false,
      align: 'right',
      render: (_, row) =>
        row.score === null || row.score === undefined
          ? DASH
          : new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 3 }).format(row.score),
    },
    {
      title: t('moderation.field.createdAt'),
      key: 'createdAt',
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => formatInstant(row.createdAt, intl.locale),
    },
    {
      title: t('moderation.queue.view'),
      valueType: 'option',
      search: false,
      render: (_, row) => (
        <Link to={`/moderation/${encodeURIComponent(row.id)}`}>{t('moderation.queue.view')}</Link>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      {oldest.state === 'failed' ? (
        <Alert
          type="warning"
          showIcon
          title={t('moderation.queue.oldestFailed', { message: oldest.message })}
          action={
            <Button size="small" onClick={() => void loadOldest()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : oldest.state === 'ready' ? (
        <Alert
          type={oldest.seconds === null ? 'success' : 'warning'}
          showIcon
          data-testid="moderation-oldest"
          title={
            oldest.seconds === null
              ? t('moderation.queue.oldestNone')
              : t('moderation.queue.oldest', {
                  duration: formatDuration(oldest.seconds, t, intl.locale),
                })
          }
        />
      ) : null}
      <Typography.Text type="secondary">{t('moderation.queue.note')}</Typography.Text>
      <PagedListTable<ModerationRecord, Filters>
        rowKey="id"
        columns={columns}
        request={({ page, pageSize, status, source, contentType }) => {
          void loadOldest();
          return listModerationRecords({
            page,
            pageSize,
            ...(status ? { status } : {}),
            ...(source ? { source } : {}),
            ...(contentType ? { contentType } : {}),
          });
        }}
      />
    </Flex>
  );
}
