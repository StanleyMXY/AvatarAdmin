import { useAccess, useIntl } from '@umijs/max';
import { Col, Empty, Flex, Row, Typography } from 'antd';
import { useAdminMeta } from '../../session/useSession';
import { DASH, formatCount, formatPercent } from '../../utils/ratio';
import { formatDuration } from '../moderation/duration';
import {
  type CardChange,
  type ChangeKind,
  computeCardChange,
  type DailyMetric,
  dailySeries,
  latestCohortWithD1,
  retentionD1Series,
  shiftDay,
} from './cardChange';
import { describeChange } from './changeText';
import {
  type DailyData,
  loadDaily,
  loadOldestPending,
  loadOpenAlertCount,
  loadPlatformDau,
  loadRetention,
  type RetentionData,
} from './dashboardSources';
import { OverviewCard } from './OverviewCard';
import { PlatformRing } from './PlatformRing';
import { QUICK_LINKS, QuickLinks } from './QuickLinks';
import { TrendSection } from './TrendSection';
import { useSource } from './useSource';

type Access = { canAccess: (code?: string) => boolean };

/** The five cards that read a metric of the daily report, in the order of the spec (5.1). */
const DAILY_CARDS: ReadonlyArray<{ id: DailyMetric; titleKey: string }> = [
  { id: 'newAccounts', titleKey: 'dashboard.metric.newAccounts' },
  { id: 'dau', titleKey: 'dashboard.metric.dau' },
];
const DAILY_CARDS_AFTER_D1: ReadonlyArray<{ id: DailyMetric; titleKey: string }> = [
  { id: 'callMinutes', titleKey: 'dashboard.metric.callMinutes' },
  { id: 'newSubscriptions', titleKey: 'dashboard.card.newSubscriptions' },
  { id: 'guestConverted', titleKey: 'dashboard.card.guestConverted' },
];

const validMinutes = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const colProps = { xs: 24, sm: 12, lg: 8, xl: 6 } as const;

/**
 * 总览 (spec 5.1): open to every signed-in administrator; each card, the chart, the ring and the
 * quick entries appear only for the permission that their data and target pages ask for. Every
 * request has its own state, so a failing card shows its own failure and the others carry on.
 */
export default function OverviewPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const access = useAccess() as unknown as Access;
  const meta = useAdminMeta();

  const canStats = access.canAccess('STATS:VIEW');
  const canModeration = access.canAccess('MODERATION:VIEW');
  const canMonitor = access.canAccess('MONITOR:VIEW');

  const daily = useSource<DailyData>(loadDaily, canStats);
  const retention = useSource<RetentionData>(loadRetention, canStats);
  const android = useSource(() => loadPlatformDau('ANDROID'), canStats);
  const ios = useSource(() => loadPlatformDau('IOS'), canStats);
  const oldestPending = useSource(loadOldestPending, canModeration);
  const openAlerts = useSource(loadOpenAlertCount, canMonitor);

  const pointUnit = t('stat.common.unit.percentPoint');
  const views = (change: CardChange, kind: ChangeKind) => ({
    yesterday: describeChange(change.vsYesterday, kind, intl.locale, pointUnit),
    weekAgo: describeChange(change.vs7DaysAgo, kind, intl.locale, pointUnit),
  });

  const dailyCard = ({ id, titleKey }: { id: DailyMetric; titleKey: string }) => {
    const data = daily.data;
    const change = data
      ? computeCardChange(dailySeries(data.rows, id), data.today)
      : { current: null, vsYesterday: null, vs7DaysAgo: null };
    const value =
      id === 'callMinutes'
        ? change.current === null
          ? DASH
          : new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 1 }).format(change.current)
        : formatCount(change.current, intl.locale);
    return (
      <Col key={id} {...colProps}>
        <OverviewCard
          id={id}
          title={t(titleKey)}
          status={daily.status}
          error={daily.error}
          onRetry={daily.reload}
          value={value}
          temporary={change.current !== null}
          changes={views(change, 'relative')}
        />
      </Col>
    );
  };

  const d1Card = () => {
    const data = retention.data;
    const cohort = data ? latestCohortWithD1(data.rows) : null;
    const change =
      data && cohort
        ? computeCardChange(retentionD1Series(data.rows), cohort.cohortDate, 'points')
        : { current: null, vsYesterday: null, vs7DaysAgo: null };
    return (
      <Col key="d1" {...colProps}>
        <OverviewCard
          id="d1"
          title={t('dashboard.metric.d1')}
          status={retention.status}
          error={retention.error}
          onRetry={retention.reload}
          value={formatPercent(change.current, intl.locale)}
          // The D1 of the cohort of yesterday is counted on today, so it is still being counted.
          temporary={
            data !== null && cohort !== null && shiftDay(cohort.cohortDate, 1) === data.today
          }
          caption={cohort ? t('dashboard.card.d1.cohort', { date: cohort.cohortDate }) : undefined}
          changes={views(change, 'points')}
        />
      </Col>
    );
  };

  const links = QUICK_LINKS.filter((link) => access.canAccess(link.code));
  const showsAnything = canStats || canModeration || canMonitor || links.length > 0;
  const interval = meta.landIntervalMinutes;

  return (
    <Flex vertical gap={16}>
      {canStats ? (
        <Flex vertical gap={4}>
          <Typography.Text type="secondary">{t('stat.common.utcNotice')}</Typography.Text>
          <Typography.Text type="secondary" data-testid="dashboard-explain">
            {validMinutes(interval)
              ? t('dashboard.explain.landInterval', { minutes: interval })
              : t('dashboard.explain.provisional')}
          </Typography.Text>
        </Flex>
      ) : null}

      {canStats || canModeration || canMonitor ? (
        <Row gutter={[16, 16]}>
          {canStats ? DAILY_CARDS.map(dailyCard) : null}
          {canStats ? d1Card() : null}
          {canStats ? DAILY_CARDS_AFTER_D1.map(dailyCard) : null}
          {canModeration ? (
            <Col {...colProps}>
              <OverviewCard
                id="moderation"
                title={t('dashboard.card.moderation')}
                status={oldestPending.status}
                error={oldestPending.error}
                onRetry={oldestPending.reload}
                value={formatDuration(oldestPending.data, t, intl.locale)}
                caption={
                  oldestPending.data === null
                    ? t('dashboard.card.moderation.none')
                    : t('dashboard.card.moderation.caption')
                }
                link={{ to: '/moderation/queue', label: t('dashboard.card.moderation.open') }}
              />
            </Col>
          ) : null}
          {canMonitor ? (
            <Col {...colProps}>
              <OverviewCard
                id="alerts"
                title={t('dashboard.card.alerts')}
                status={openAlerts.status}
                error={openAlerts.error}
                onRetry={openAlerts.reload}
                value={formatCount(openAlerts.data, intl.locale)}
                link={{ to: '/monitor/alerts', label: t('dashboard.card.alerts.open') }}
              />
            </Col>
          ) : null}
        </Row>
      ) : null}

      {canStats ? <TrendSection daily={daily} retention={retention} /> : null}

      {canStats || links.length > 0 ? (
        <Row gutter={[16, 16]}>
          {canStats ? (
            <Col xs={24} lg={12}>
              <PlatformRing android={android} ios={ios} />
            </Col>
          ) : null}
          {links.length > 0 ? (
            <Col xs={24} lg={canStats ? 12 : 24}>
              <QuickLinks canAccess={access.canAccess} />
            </Col>
          ) : null}
        </Row>
      ) : null}

      {showsAnything ? null : (
        <Empty data-testid="dashboard-empty" description={t('dashboard.empty')} />
      )}
    </Flex>
  );
}
