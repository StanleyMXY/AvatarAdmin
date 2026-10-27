import { Link, useAccess, useIntl, useLocation } from '@umijs/max';
import { Alert, App, Button, Card, Descriptions, Flex, Space, Spin } from 'antd';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { StatusTag } from '../../components/StatusTag';
import { ApiError } from '../../request/errors';
import {
  decideModeration,
  getModerationRecord,
  type ModerationDecision,
  type ModerationRecord,
} from '../../services/moderation';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { ContentPanel } from './ContentPanel';
import { DecisionModal } from './DecisionModal';
import { formatDuration, secondsSince } from './duration';
import { labelOf, statusOptions } from './options';

type Access = { canAccess: (code?: string) => boolean };

type Load =
  | { phase: 'loading' }
  | { phase: 'ready'; record: ModerationRecord }
  | { phase: 'failed'; notFound: boolean; text: string };

/** The id in `/moderation/<id>`, or null when the path is not that. */
export function recordIdFromPath(pathname: string): string | null {
  const match = /^\/moderation\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

const cell = { overflowWrap: 'anywhere', minWidth: 0 } as const;

/**
 * 审核详情 (`MODERATION:VIEW`): the record's fields; the content area and the decision buttons
 * only for an administrator who holds `MODERATION:REVIEW`.
 */
export default function ModerationDetailPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const canReview = access.canAccess('MODERATION:REVIEW');
  const { pathname } = useLocation();
  const id = recordIdFromPath(pathname);
  const [state, setState] = useState<Load>({ phase: 'loading' });
  const [deciding, setDeciding] = useState<ModerationDecision | null>(null);
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const counter = useRef(0);

  const load = useCallback(async () => {
    if (id === null) return;
    const mine = ++counter.current;
    try {
      const record = await getModerationRecord(id);
      if (mine === counter.current) setState({ phase: 'ready', record });
    } catch (error) {
      if (mine !== counter.current) return;
      const described = describeFailure(intlRef.current, error);
      setState({
        phase: 'failed',
        notFound: described.error.code === 'RESOURCE_NOT_FOUND',
        text: described.text,
      });
    }
  }, [id]);

  useEffect(() => {
    setState({ phase: 'loading' });
    void load();
    return () => {
      counter.current += 1;
    };
  }, [load]);

  const back = <Link to="/moderation/queue">{t('moderation.detail.back')}</Link>;

  if (id === null) {
    return (
      <Flex vertical gap={12}>
        <Alert type="error" showIcon title={t('moderation.detail.invalidAddress')} />
        {back}
      </Flex>
    );
  }
  if (state.phase === 'loading') return <Spin />;
  if (state.phase === 'failed') {
    return (
      <Flex vertical gap={12}>
        <Alert
          type="error"
          showIcon
          title={
            state.notFound
              ? t('moderation.detail.notFound')
              : t('moderation.detail.loadFailed', { message: state.text })
          }
          action={
            state.notFound ? undefined : (
              <Button
                size="small"
                onClick={() => {
                  setState({ phase: 'loading' });
                  void load();
                }}
              >
                {t('pages.common.retry')}
              </Button>
            )
          }
        />
        {back}
      </Flex>
    );
  }

  const { record } = state;
  const pending = record.status === 'PENDING_REVIEW';
  const reported =
    record.source === 'REPORT' || record.reporterReason !== null || record.reporterDetail !== null;
  const waiting = pending ? formatDuration(secondsSince(record.createdAt), t, intl.locale) : DASH;

  const item = (key: string, label: string, children: ReactNode) => ({
    key,
    label,
    children: <span style={cell}>{children}</span>,
  });

  const recordItems = [
    item('id', t('moderation.field.id'), record.id),
    item(
      'accountId',
      t('moderation.field.accountId'),
      record.accountId ?? t('moderation.field.deletedAccount'),
    ),
    item(
      'contentType',
      t('moderation.field.contentType'),
      labelOf(t, intl.messages, 'moderation.contentType', record.contentType),
    ),
    item('contentRef', t('moderation.field.contentRef'), record.contentRef),
    item(
      'source',
      t('moderation.field.source'),
      labelOf(t, intl.messages, 'moderation.source', record.source),
    ),
    item(
      'status',
      t('moderation.field.status'),
      <StatusTag status={record.status} options={statusOptions(t)} />,
    ),
    item(
      'autoLevel',
      t('moderation.field.autoLevel'),
      labelOf(t, intl.messages, 'moderation.autoLevel', record.autoLevel),
    ),
    item(
      'categories',
      t('moderation.field.categories'),
      <EllipsisPopoverText text={record.categories?.join(', ') || null} width={360} />,
    ),
    item(
      'score',
      t('moderation.field.score'),
      record.score === null || record.score === undefined
        ? DASH
        : new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 3 }).format(record.score),
    ),
    item('providerRef', t('moderation.field.providerRef'), record.providerRef ?? DASH),
    item(
      'createdAt',
      t('moderation.field.createdAt'),
      formatInstant(record.createdAt, intl.locale),
    ),
    item('waiting', t('moderation.field.waiting'), waiting),
  ];

  const reportItems = [
    item(
      'reporterReason',
      t('moderation.field.reporterReason'),
      labelOf(t, intl.messages, 'moderation.reporterReason', record.reporterReason),
    ),
    item(
      'reporterDetail',
      t('moderation.field.reporterDetail'),
      <EllipsisPopoverText text={record.reporterDetail} lines={4} width={480} />,
    ),
  ];

  const handled = record.reviewedBy !== null || record.reviewedAt !== null;
  const reviewItems = [
    item(
      'reviewedBy',
      t('moderation.field.reviewedBy'),
      record.reviewedBy === null
        ? DASH
        : (record.reviewedByUsername ?? record.reviewedBy.slice(0, 8)),
    ),
    item(
      'reviewedAt',
      t('moderation.field.reviewedAt'),
      record.reviewedAt ? formatInstant(record.reviewedAt, intl.locale) : DASH,
    ),
    item(
      'note',
      t('moderation.field.note'),
      <EllipsisPopoverText text={record.note} lines={4} width={480} />,
    ),
  ];

  const decide = async (decision: ModerationDecision, note: string) => {
    try {
      await decideModeration(record.id, { decision, note });
    } catch (error) {
      // The record is no longer what this page showed: show it again, and let the dialog say why.
      if (error instanceof ApiError && error.code === 'INVALID_STATE') void load();
      throw error;
    }
    message.success(
      decision === 'APPROVE'
        ? t('moderation.decision.approved')
        : t('moderation.decision.rejected'),
    );
    setDeciding(null);
    void load();
  };

  return (
    <Flex vertical gap={16}>
      {back}
      <Card size="small" title={t('moderation.detail.record')}>
        <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} items={recordItems} />
      </Card>
      {reported ? (
        <Card size="small" title={t('moderation.detail.report')}>
          <Descriptions bordered size="small" column={1} items={reportItems} />
        </Card>
      ) : null}
      {handled ? (
        <Card size="small" title={t('moderation.detail.review')}>
          <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} items={reviewItems} />
        </Card>
      ) : null}
      <ContentPanel key={record.id} record={record} canReview={canReview} />
      {canReview && pending ? (
        <Space wrap>
          <Button type="primary" onClick={() => setDeciding('APPROVE')}>
            {t('moderation.decision.approve')}
          </Button>
          <Button danger onClick={() => setDeciding('REJECT')}>
            {t('moderation.decision.reject')}
          </Button>
        </Space>
      ) : null}
      <DecisionModal
        record={record}
        decision={deciding}
        onSubmit={decide}
        onClose={() => setDeciding(null)}
      />
    </Flex>
  );
}
