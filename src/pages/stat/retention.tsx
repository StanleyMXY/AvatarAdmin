import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Select, Spin, Table, Tabs, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import {
  PlatformChannelFilter,
  type PlatformChannelValue,
} from '../../components/stat/PlatformChannelFilter';
import { ReportHelper } from '../../components/stat/ReportHelper';
import { RetentionMatrix } from '../../components/stat/RetentionMatrix';
import { RetentionTrendChart } from '../../components/stat/RetentionTrendChart';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { getReactivation, getRetention } from '../../services/stats/reports';
import {
  RETENTION_DAYS,
  type ReactivationRow,
  type RetentionRow,
} from '../../services/stats/types';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { DASH, formatCount, formatPercent, safeRatio } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { CheckDayLandBar } from './CheckDayLandBar';
import { ReactivationCharts } from './ReactivationCharts';

type TabKey = 'active' | 'call' | 'reactivation';
type Filter = { range: DayRange } & PlatformChannelValue;
type Silence = 7 | 14 | 30;

const DEFAULT_DAYS = [1, 7, 30];
const SILENCE_DAYS: Silence[] = [7, 14, 30];
const initialFilter = (): Filter => ({ range: lastNDaysUtc(30), platform: 'ALL', channel: 'ALL' });

/**
 * 留存报表 (`STATS:VIEW`): account retention by sign-up day (active and call) and reactivation of
 * silent accounts. Cells of a day that has not come yet are dashes, not 0%.
 */
export default function RetentionReportPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [tab, setTab] = useState<TabKey>('active');
  // What is being edited, and what was asked for with Search (the report and the export).
  const [draft, setDraft] = useState<Filter>(initialFilter);
  const [applied, setApplied] = useState<Filter>(initialFilter);
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS);
  const [silenceDays, setSilenceDays] = useState<Silence>(7);
  const [retention, setRetention] = useState<RetentionRow[] | null>(null);
  const [reactivation, setReactivation] = useState<ReactivationRow[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);

  const load = useCallback(async () => {
    const mine = ++counter.current;
    setRetention(null);
    setReactivation(null);
    setFailure(null);
    const { from, to } = applied.range;
    try {
      if (tab === 'reactivation') {
        const { items } = await getReactivation({ from, to, silenceDays });
        if (mine === counter.current) setReactivation(items);
      } else {
        const { items } = await getRetention({
          from,
          to,
          type: tab === 'call' ? 'CALL' : 'ACTIVE',
          platform: applied.platform,
          channel: applied.channel,
        });
        if (mine === counter.current) setRetention(items);
      }
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intl, error).text);
    }
  }, [tab, applied, silenceDays, intl]);

  useEffect(() => {
    void load();
  }, [load]);

  const chosenDays = [...days].sort((a, b) => a - b);
  const { from, to } = applied.range;
  const exportParams =
    tab === 'reactivation'
      ? { from, to, silenceDays }
      : {
          from,
          to,
          type: tab === 'call' ? 'CALL' : 'ACTIVE',
          platform: applied.platform,
          channel: applied.channel,
        };

  const retentionView = retention ? (
    <>
      <Flex gap={16} wrap>
        {chosenDays.map((day) => (
          <div key={day} style={{ flex: '1 1 320px', minWidth: 0 }}>
            <Typography.Text strong>{t('stat.retention.chart', { n: day })}</Typography.Text>
            <RetentionTrendChart rows={retention} day={day} />
          </div>
        ))}
      </Flex>
      <RetentionMatrix rows={retention} days={chosenDays} />
    </>
  ) : null;

  const reactivationView = reactivation ? (
    <>
      <ReactivationCharts rows={reactivation} from={from} to={to} />
      <Table<ReactivationRow>
        size="small"
        rowKey="statDate"
        dataSource={reactivation}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: t('stat.reactivation.col.date'),
            dataIndex: 'statDate',
            fixed: 'left',
          },
          {
            title: t('stat.reactivation.col.silentUsers'),
            dataIndex: 'silentUsers',
            align: 'end',
            render: (n: number) => formatCount(n, intl.locale),
          },
          {
            title: t('stat.reactivation.col.reactivated'),
            dataIndex: 'reactivated',
            align: 'end',
            render: (n: number) => formatCount(n, intl.locale),
          },
          {
            title: t('stat.reactivation.col.rate'),
            key: 'rate',
            align: 'end',
            render: (_: unknown, row: ReactivationRow) => {
              const rate = safeRatio(row.reactivated, row.silentUsers);
              return rate === null ? DASH : formatPercent(rate, intl.locale);
            },
          },
        ]}
      />
    </>
  ) : null;

  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        items={[
          { key: 'active', label: t('stat.retention.tab.active') },
          { key: 'call', label: t('stat.retention.tab.call') },
          { key: 'reactivation', label: t('stat.retention.tab.reactivation') },
        ]}
      />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        {tab === 'reactivation' ? (
          <Select<Silence>
            style={{ minWidth: 120 }}
            aria-label={t('stat.retention.silenceDays')}
            value={silenceDays}
            options={SILENCE_DAYS.map((n) => ({
              value: n,
              label: t('stat.retention.silenceOption', { n }),
              title: t('stat.retention.silenceOption', { n }),
            }))}
            onChange={setSilenceDays}
          />
        ) : (
          <>
            <PlatformChannelFilter
              value={{ platform: draft.platform, channel: draft.channel }}
              onChange={(value) => setDraft((d) => ({ ...d, ...value }))}
            />
            <Select<number[]>
              mode="multiple"
              virtual={false}
              style={{ minWidth: 220 }}
              aria-label={t('stat.retention.days')}
              value={days}
              options={RETENTION_DAYS.map((n) => ({
                value: n,
                label: t('stat.retention.dayOption', { n }),
                title: t('stat.retention.dayOption', { n }),
              }))}
              onChange={setDays}
            />
          </>
        )}
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name={tab === 'reactivation' ? 'reactivation' : 'retention'}
          viewCode="STATS:VIEW"
          params={exportParams}
        />
      </Flex>
      {tab === 'reactivation' ? (
        <LandBar name="reactivation" onLanded={() => void load()} />
      ) : (
        <CheckDayLandBar name="retention" onLanded={() => void load()} />
      )}
      {/* the key draws the panel again on a tab of the other report: it reads its own closed state */}
      <ReportHelper
        key={tab === 'reactivation' ? 'reactivation' : 'retention'}
        pageKey={tab === 'reactivation' ? 'reactivation' : 'retention'}
      />
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {retention === null && reactivation === null && !failure ? <Spin /> : null}
      {tab === 'reactivation' ? reactivationView : retentionView}
    </Flex>
  );
}
