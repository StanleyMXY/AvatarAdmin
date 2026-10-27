import { Funnel } from '@ant-design/plots';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Card, Flex, Form, InputNumber, Select, Table, Tag, Typography } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import {
  createSavedFunnel,
  deleteSavedFunnel,
  type FunnelStepResult,
  getEventNames,
  getFunnel,
  listSavedFunnels,
  type SavedFunnel,
  updateSavedFunnel,
} from '../../services/analytics';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { formatCount, formatPercent } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { FunnelNameModal } from './FunnelNameModal';
import {
  DEFAULT_WINDOW_HOURS,
  type FunnelProblem,
  funnelProblems,
  normalizeSteps,
} from './funnelRules';
import { ReadState } from './ReadState';
import { useRead } from './useRead';

const PROBLEM_TEXT: Record<FunnelProblem, string> = {
  tooFewSteps: 'analytics.funnel.problem.stepCount',
  tooManySteps: 'analytics.funnel.problem.stepCount',
  commaInStep: 'analytics.funnel.problem.comma',
  emptyStep: 'analytics.funnel.problem.empty',
  windowInvalid: 'analytics.funnel.problem.window',
};

type Dialog = 'saveAs' | 'edit' | null;

/**
 * 埋点管理 · 漏斗分析 (`ANALYTICS:VIEW`): how many accounts get through a list of events in order.
 * The steps and the window come from the form or from a saved funnel; saving, changing and deleting
 * saved funnels need `ANALYTICS:FUNNEL_MANAGE`, and a preset can only be copied. The conversion of
 * each step is the number the backend sent; nothing is worked out here.
 */
export default function FunnelPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('ANALYTICS:FUNNEL_MANAGE');
  const meta = useAdminMeta();
  const [mode] = useThemeMode();
  const chartTheme = getChartTheme(mode);

  const [range, setRange] = useState<DayRange>(() => lastNDaysUtc(7));
  const [steps, setSteps] = useState<string[]>([]);
  const [windowHours, setWindowHours] = useState<number | null>(DEFAULT_WINDOW_HOURS);
  const [touched, setTouched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [dialog, setDialog] = useState<Dialog>(null);

  const savedFetcher = useCallback(() => listSavedFunnels(), []);
  const saved = useRead(savedFetcher, { keep: true });
  const savedList = saved.data ?? [];
  const selected = savedList.find((f) => f.id === selectedId);

  const namesFetcher = useCallback(() => getEventNames(range), [range]);
  const names = useRead(namesFetcher, { keep: true }).data?.items ?? [];
  const stepOptions = useMemo(() => names.map((value) => ({ value, label: value })), [names]);

  const problems = funnelProblems(steps, windowHours);
  const valid = problems.length === 0;
  const body = () => ({
    steps: normalizeSteps(steps),
    windowHours: windowHours as number,
  });

  // The query: the newest one is what is shown, whichever answer arrives first.
  const [result, setResult] = useState<FunnelStepResult[] | null>(null);
  const [queryFailure, setQueryFailure] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const counter = useRef(0);
  /** Asks for `asked` (the form as it is by default). */
  const query = async (asked: { steps: string[]; windowHours: number } = body()) => {
    const mine = ++counter.current;
    setQuerying(true);
    setQueryFailure(null);
    try {
      const answer = await getFunnel({ ...asked, ...range });
      if (mine === counter.current) setResult(answer.steps);
    } catch (error) {
      if (mine === counter.current) {
        setResult(null);
        setQueryFailure(describeFailure(intl, error).text);
      }
    } finally {
      if (mine === counter.current) setQuerying(false);
    }
  };

  /** The Query button and Retry: the form as it is, if it can be asked. */
  const ask = () => {
    if (valid) void query(body());
  };

  const choose = (id: string | undefined) => {
    setSelectedId(id);
    const funnel = savedList.find((f) => f.id === id);
    if (funnel) {
      setSteps(funnel.steps);
      setWindowHours(funnel.windowHours);
      setTouched(true);
      // A saved funnel is chosen to see its numbers: it is asked at once, if it can be asked.
      if (funnelProblems(funnel.steps, funnel.windowHours).length === 0) {
        void query({ steps: normalizeSteps(funnel.steps), windowHours: funnel.windowHours });
      }
    }
  };

  const saveAs = async (name: string) => {
    const created = await createSavedFunnel({ name, ...body() });
    message.success(t('analytics.funnel.savedOk'));
    setDialog(null);
    setSelectedId(created.id);
    saved.reload();
  };
  const edit = async (name: string) => {
    if (!selected) return;
    await updateSavedFunnel(selected.id, { name, ...body() });
    message.success(t('analytics.funnel.updatedOk'));
    setDialog(null);
    saved.reload();
  };
  const remove = async (funnel: SavedFunnel) => {
    try {
      await deleteSavedFunnel(funnel.id);
      message.success(t('analytics.funnel.deletedOk'));
      setSelectedId(undefined);
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
    // Either way the list is read again: after a refusal it is not what the page showed.
    saved.reload();
  };

  const optionLabel = (funnel: SavedFunnel) => (
    <Flex gap={8} align="center">
      <span
        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {funnel.name}
      </span>
      {funnel.isPreset ? (
        <Tag style={{ marginInlineEnd: 0 }}>{t('analytics.funnel.preset')}</Tag>
      ) : null}
    </Flex>
  );

  const rate = (step: FunnelStepResult, index: number) =>
    index === 0
      ? formatPercent(null, intl.locale)
      : formatPercent(step.conversionFromPrevious, intl.locale);
  const chartData = (result ?? []).map((step, index) => ({
    stage: step.eventName,
    value: step.count,
    caption: `${step.eventName}  ${formatCount(step.count, intl.locale)}${
      step.conversionFromPrevious === null ? '' : `  (${rate(step, index)})`
    }`,
  }));

  return (
    <Flex vertical gap={16}>
      <Form layout="vertical" style={{ maxWidth: 960 }}>
        <Form.Item label={t('analytics.funnel.saved')} htmlFor="analytics-funnel-saved">
          <Select
            id="analytics-funnel-saved"
            allowClear
            loading={saved.loading}
            style={{ width: '100%', maxWidth: 480 }}
            placeholder={t('analytics.funnel.savedPlaceholder')}
            value={selected?.id}
            onChange={(id) => choose(id)}
            onClear={() => choose(undefined)}
            options={savedList.map((funnel) => ({ value: funnel.id, label: optionLabel(funnel) }))}
          />
        </Form.Item>
        <Form.Item label={t('analytics.funnel.steps')} htmlFor="analytics-funnel-steps">
          <div data-testid="funnel-steps">
            <Select
              id="analytics-funnel-steps"
              mode="tags"
              style={{ width: '100%' }}
              placeholder={t('analytics.funnel.stepsPlaceholder')}
              value={steps}
              options={stepOptions}
              onChange={(values: string[]) => {
                setSteps(values);
                setTouched(true);
              }}
            />
          </div>
        </Form.Item>
        <Flex gap={24} wrap align="end">
          <Form.Item
            label={t('analytics.funnel.window')}
            htmlFor="analytics-funnel-window"
            tooltip={t('analytics.funnel.windowTip')}
          >
            <InputNumber
              id="analytics-funnel-window"
              value={windowHours}
              onChange={(value) => {
                setWindowHours(typeof value === 'number' ? value : null);
                setTouched(true);
              }}
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item>
            <Flex gap={12} wrap align="center">
              <DateRangeUtc
                value={range}
                onChange={setRange}
                maxDays={meta.analyticsLiveMaxRangeDays ?? undefined}
              />
              <UtcNotice />
            </Flex>
          </Form.Item>
        </Flex>
        {touched && !valid ? (
          <Flex vertical gap={2} style={{ marginBottom: 12 }} aria-live="polite">
            {[...new Set(problems.map((p) => PROBLEM_TEXT[p]))].map((id) => (
              <Typography.Text key={id} type="danger">
                {t(id)}
              </Typography.Text>
            ))}
          </Flex>
        ) : null}
        <Flex gap={8} wrap>
          <Button type="primary" disabled={!valid} onClick={ask}>
            {t('analytics.common.query')}
          </Button>
          {canManage ? (
            <Button disabled={!valid} onClick={() => setDialog('saveAs')}>
              {t('analytics.funnel.saveAs')}
            </Button>
          ) : null}
          {canManage && selected && !selected.isPreset ? (
            <>
              <Button disabled={!valid} onClick={() => setDialog('edit')}>
                {t('analytics.funnel.edit')}
              </Button>
              <DangerConfirmButton
                confirmText={t('analytics.funnel.deleteConfirm', { name: selected.name })}
                onConfirm={() => remove(selected)}
              >
                {t('analytics.funnel.delete')}
              </DangerConfirmButton>
            </>
          ) : null}
        </Flex>
      </Form>

      <ReadState failure={queryFailure} loading={querying} onRetry={ask} />
      {saved.failure ? (
        <ReadState failure={saved.failure} loading={false} onRetry={saved.reload} />
      ) : null}
      {result ? (
        <Card size="small" title={t('analytics.funnel.result.title')}>
          <Flex vertical gap={16}>
            <div>
              <Typography.Text strong>{t('analytics.funnel.result.chart')}</Typography.Text>
              <Funnel
                data={chartData}
                xField="stage"
                yField="value"
                theme={chartTheme.g2Theme}
                scale={{ color: { range: chartTheme.palette } }}
                legend={false}
                label={{
                  text: (d: { caption: string }) => d.caption,
                  style: { fill: chartTheme.textColor },
                }}
                height={Math.max(160, 56 * chartData.length)}
              />
            </div>
            <div data-testid="funnel-result">
              <Table<FunnelStepResult & { position: string }>
                size="small"
                pagination={false}
                rowKey="position"
                dataSource={result.map((step, index) => ({ ...step, position: String(index) }))}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: t('analytics.funnel.result.step'),
                    key: 'step',
                    render: (_, __, index) => index + 1,
                  },
                  {
                    title: t('analytics.common.eventName'),
                    dataIndex: 'eventName',
                    render: (value: string) => <EllipsisPopoverText text={value} width={260} />,
                  },
                  {
                    title: t('analytics.funnel.result.count'),
                    dataIndex: 'count',
                    align: 'right',
                    render: (value: number) => formatCount(value, intl.locale),
                  },
                  {
                    title: t('analytics.funnel.result.conversion'),
                    dataIndex: 'conversionFromPrevious',
                    align: 'right',
                    render: (_, row, index) => rate(row, index),
                  },
                ]}
              />
            </div>
          </Flex>
        </Card>
      ) : querying || queryFailure ? null : (
        <Typography.Text type="secondary">{t('analytics.funnel.result.empty')}</Typography.Text>
      )}

      <Card size="small" title={t('analytics.funnel.help.title')}>
        <Flex vertical gap={4}>
          <Typography.Text>{t('analytics.funnel.help.order')}</Typography.Text>
          <Typography.Text>{t('analytics.funnel.help.days')}</Typography.Text>
          <Typography.Text type="secondary">{t('analytics.funnel.help.anonymous')}</Typography.Text>
        </Flex>
      </Card>

      {dialog === 'saveAs' ? (
        <FunnelNameModal
          title={t('analytics.funnel.dialog.saveAs')}
          initialName=""
          onSubmit={saveAs}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'edit' && selected ? (
        <FunnelNameModal
          key={selected.id}
          title={t('analytics.funnel.dialog.edit')}
          initialName={selected.name}
          onSubmit={edit}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </Flex>
  );
}
