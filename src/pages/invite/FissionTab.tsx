import { QuestionCircleOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import {
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Statistic,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDepthStats, getInviteChain, type InviteChain } from '../../services/invite';
import { describeFailure } from '../../session/describe';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { formatInstant } from '../../utils/format';
import { DASH, formatCount } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { checkDepth } from './chainRules';
import { descendantsOf, levelsBelow, type TreeRow, treeRows } from './chainTree';
import { count } from './numbers';
import { ReadState } from './ReadState';
import { useRead } from './useRead';

/** What the chain form holds, and the query that was last sent (a new object for each press, so the same query can be sent again). */
export type ChainForm = {
  accountId: string;
  depth: number | null;
  applied: { accountId: string; maxDepth: number; nonce: number } | null;
};

type Props = {
  from: string;
  to: string;
  form: ChainForm;
  /** Null when the configured limit is not known. */
  limit: number | null;
  onForm: (form: ChainForm) => void;
  onLoadChain: () => void;
};

type ChainState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'failed'; text: string }
  | { kind: 'loaded'; chain: InviteChain };

type FormProblem = 'account' | 'depth' | null;

/** The second tab: the depth statistics of the range and the invitation chain of one account. */
export function FissionTab({ from, to, form, limit, onForm, onLoadChain }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const depthFetcher = useCallback(() => getDepthStats({ from, to }), [from, to]);
  const depth = useRead(depthFetcher);

  // ---- the chain ----
  const [state, setState] = useState<ChainState>({ kind: 'idle' });
  const [problem, setProblem] = useState<FormProblem>(null);
  const counter = useRef(0);
  const { applied } = form;
  useEffect(() => {
    if (!applied) return;
    const mine = ++counter.current;
    setState({ kind: 'loading' });
    getInviteChain({ rootAccountId: applied.accountId, maxDepth: applied.maxDepth }).then(
      (chain) => {
        if (mine === counter.current) setState({ kind: 'loaded', chain });
      },
      (error) => {
        if (mine === counter.current) {
          setState({ kind: 'failed', text: describeFailure(intl, error).text });
        }
      },
    );
  }, [applied, intl]);

  const submit = () => {
    if (trimSpec(form.accountId) === '') return setProblem('account');
    if (!checkDepth(form.depth, limit)) return setProblem('depth');
    setProblem(null);
    onLoadChain();
  };

  // ---- the depth numbers ----
  const stats = depth.data;
  const levels = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of stats?.depthDistribution ?? []) {
      const level = count(row.depth);
      const people = count(row.count);
      if (level !== null && people !== null && Number.isInteger(level) && level >= 1) {
        counts.set(level, (counts.get(level) ?? 0) + people);
      }
    }
    const deepest = Math.max(0, ...counts.keys());
    return Array.from({ length: deepest }, (_, i) => ({
      level: intl.formatMessage({ id: 'invite.fission.level' }, { depth: i + 1 }),
      people: counts.get(i + 1) ?? 0,
    }));
  }, [stats, intl]);

  const average = count(stats?.avgDepth);
  const numbers = stats
    ? [
        {
          name: 'avgDepth',
          title: t('invite.fission.avgDepth'),
          value:
            average === null
              ? DASH
              : new Intl.NumberFormat(intl.locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(average),
        },
        {
          name: 'maxDepth',
          title: t('invite.fission.maxDepth'),
          value: formatCount(count(stats.maxDepth), intl.locale),
        },
        {
          name: 'totalChains',
          title: t('invite.fission.totalChains'),
          value: formatCount(count(stats.totalChains), intl.locale),
          tip: t('invite.fission.totalChainsTip'),
        },
      ]
    : [];

  // ---- the tree ----
  const rows = useMemo<TreeRow[]>(
    () => (state.kind === 'loaded' ? treeRows(state.chain.root, state.chain.children) : []),
    [state],
  );
  const toNode = (row: TreeRow): { key: string; title: React.ReactNode; children: unknown[] } => ({
    key: row.key,
    title: (
      <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>
        <bdi dir="ltr">{row.label === '' ? DASH : row.label}</bdi>
        {row.time === '' ? null : (
          <Typography.Text type="secondary">
            {' '}
            {` · ${formatInstant(row.time, intl.locale)}`}
          </Typography.Text>
        )}
      </span>
    ),
    children: row.children.map(toNode),
  });

  const loadedChain = state.kind === 'loaded' ? state.chain : null;
  const total = loadedChain ? (count(loadedChain.totalDescendants) ?? descendantsOf(rows[0])) : 0;
  const reached = loadedChain ? (count(loadedChain.maxDepth) ?? levelsBelow(rows[0])) : 0;

  return (
    <Flex vertical gap={16}>
      <ReadState failure={depth.failure} loading={depth.loading} onRetry={depth.reload} />
      {stats ? (
        <>
          <Flex gap={16} wrap>
            {numbers.map((item) => (
              <Card
                key={item.name}
                size="small"
                style={{ minWidth: 180 }}
                data-testid={`invite-fission-${item.name}`}
              >
                <Statistic
                  title={
                    item.tip ? (
                      <Tooltip title={item.tip}>
                        <span>
                          {item.title}
                          <QuestionCircleOutlined aria-hidden style={{ marginInlineStart: 4 }} />
                        </span>
                      </Tooltip>
                    ) : (
                      item.title
                    )
                  }
                  value={item.value}
                />
              </Card>
            ))}
          </Flex>
          <Card size="small" title={t('invite.fission.distribution')} data-testid="invite-depth">
            {levels.length === 0 ? (
              <Empty description={t('invite.fission.noInvitees')} />
            ) : (
              <Column
                data={levels}
                xField="level"
                yField="people"
                theme={theme.g2Theme}
                scale={{ color: { range: theme.palette } }}
                axis={{
                  x: { labelFill: theme.textColor },
                  y: {
                    title: t('invite.fission.people'),
                    // people are whole numbers: no tick at 0.5
                    labelFormatter: (value: number) =>
                      Number.isInteger(value) ? String(value) : '',
                    labelFill: theme.textColor,
                    gridStroke: theme.gridColor,
                  },
                }}
                height={260}
              />
            )}
          </Card>
        </>
      ) : null}

      <Card size="small" title={t('invite.chain.title')}>
        <Form layout="inline" onFinish={submit} style={{ rowGap: 12 }}>
          <Form.Item
            label={t('invite.chain.accountId')}
            validateStatus={problem === 'account' ? 'error' : undefined}
            help={problem === 'account' ? t('invite.chain.accountRequired') : undefined}
          >
            <Input
              aria-label={t('invite.chain.accountId')}
              style={{ width: 360, maxWidth: '100%' }}
              value={form.accountId}
              onChange={(event) => {
                setProblem(null);
                onForm({ ...form, accountId: event.target.value });
              }}
            />
          </Form.Item>
          <Form.Item
            label={t('invite.chain.depth')}
            extra={
              limit === null
                ? t('invite.chain.depthHintOpen')
                : t('invite.chain.depthHint', { max: limit })
            }
            validateStatus={problem === 'depth' ? 'error' : undefined}
            help={
              problem === 'depth'
                ? limit === null
                  ? t('invite.chain.depthErrorOpen')
                  : t('invite.chain.depthError', { max: limit })
                : undefined
            }
          >
            <InputNumber
              aria-label={t('invite.chain.depth')}
              value={form.depth}
              onChange={(value) => {
                setProblem(null);
                onForm({ ...form, depth: typeof value === 'number' ? value : null });
              }}
              style={{ width: 120 }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {t('invite.chain.load')}
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16 }}>
          {state.kind === 'idle' ? (
            <Typography.Text type="secondary">{t('invite.chain.idle')}</Typography.Text>
          ) : null}
          <ReadState
            failure={state.kind === 'failed' ? state.text : null}
            loading={state.kind === 'loading'}
            onRetry={onLoadChain}
          />
          {loadedChain ? (
            <Flex vertical gap={8}>
              <Typography.Text strong data-testid="invite-chain-summary">
                {t('invite.chain.summary', { count: total, depth: reached })}
              </Typography.Text>
              <div data-testid="invite-chain-tree">
                <Tree
                  key={applied?.nonce}
                  selectable={false}
                  blockNode
                  defaultExpandAll
                  treeData={rows.map(toNode) as never}
                />
              </div>
            </Flex>
          ) : null}
        </div>
      </Card>
    </Flex>
  );
}
