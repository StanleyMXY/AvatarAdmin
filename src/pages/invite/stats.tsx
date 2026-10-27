import { useIntl } from '@umijs/max';
import { Button, Flex, InputNumber, Tabs, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useAdminMeta } from '../../session/useSession';
import { trimSpec } from '../../utils/trimSpec';
import { lastNDaysUtc } from '../../utils/utcDay';
import { checkDepth, defaultDepth, depthLimit } from './chainRules';
import { type ChainForm, FissionTab } from './FissionTab';
import { InviteOverview, type StatsQuery } from './InviteOverview';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const isLimit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_LIMIT;

/**
 * 邀请统计 (`INVITE:VIEW`): the range and the ranking size are chosen once and used by both tabs,
 * the overview (numbers, trend, ranking) and the fission levels (depth numbers, invitation chain).
 * Nothing is read again until Search is pressed.
 */
export default function InviteStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const limit = depthLimit(meta.inviteChainMaxDepth);

  const [range, setRange] = useState<DayRange>(() => lastNDaysUtc(7));
  const [size, setSize] = useState<number | null>(DEFAULT_LIMIT);
  const [sizeWrong, setSizeWrong] = useState(false);
  const [query, setQuery] = useState<StatsQuery>(() => ({
    ...lastNDaysUtc(7),
    limit: DEFAULT_LIMIT,
  }));
  const [tab, setTab] = useState('overview');
  const [chain, setChain] = useState<ChainForm>(() => ({
    accountId: '',
    depth: defaultDepth(limit),
    applied: null,
  }));
  const nonce = useRef(0);

  const search = () => {
    if (!isLimit(size)) {
      setSizeWrong(true);
      return;
    }
    setSizeWrong(false);
    setQuery({ from: range.from, to: range.to, limit: size });
  };

  const apply = (form: ChainForm) =>
    setChain({
      ...form,
      applied: {
        accountId: trimSpec(form.accountId),
        maxDepth: form.depth as number,
        nonce: ++nonce.current,
      },
    });

  const viewFission = (accountId: string) => {
    const depth = checkDepth(chain.depth, limit) ? chain.depth : defaultDepth(limit);
    apply({ ...chain, accountId, depth });
    setTab('fission');
  };

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={range}
          onChange={setRange}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <UtcNotice />
      </Flex>
      <Flex gap={12} wrap align="center">
        <Typography.Text>{t('invite.stats.limitShort')}</Typography.Text>
        <InputNumber
          aria-label={t('invite.stats.limit')}
          value={size}
          status={sizeWrong ? 'error' : undefined}
          onChange={(value) => {
            setSizeWrong(false);
            setSize(typeof value === 'number' ? value : null);
          }}
        />
        <Button type="primary" onClick={search}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name="invite-stats"
          viewCode="INVITE:VIEW"
          params={{ from: query.from, to: query.to, limit: query.limit }}
        />
      </Flex>
      {sizeWrong ? (
        <Typography.Text type="danger">
          {t('invite.stats.limitError', { max: MAX_LIMIT })}
        </Typography.Text>
      ) : null}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: t('invite.stats.tab.overview'),
            children: <InviteOverview query={query} onViewFission={viewFission} />,
          },
          {
            key: 'fission',
            label: t('invite.stats.tab.fission'),
            children: (
              <FissionTab
                from={query.from}
                to={query.to}
                form={chain}
                limit={limit}
                onForm={setChain}
                onLoadChain={() => apply(chain)}
              />
            ),
          },
        ]}
      />
    </Flex>
  );
}
