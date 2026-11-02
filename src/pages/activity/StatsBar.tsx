import { useIntl } from '@umijs/max';
import { Button, Flex, Typography } from 'antd';
import { type ReactNode, useState } from 'react';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { useAdminMeta } from '../../session/useSession';
import { defaultRange } from '../analytics/defaultRange';

/**
 * The range of a statistics page: what is being edited, and what was asked for with Query (the
 * report, the chart and the export all use the second). The default is the last 7 days.
 */
export function useAppliedRange() {
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<DayRange>(() => defaultRange(meta.statsMaxRangeDays, 7));
  const [applied, setApplied] = useState<DayRange>(draft);
  return { draft, setDraft, applied, apply: () => setApplied({ ...draft }) };
}

type Props = {
  draft: DayRange;
  onDraft: (range: DayRange) => void;
  onQuery: () => void;
  /** The export button (it knows its own permissions). */
  exportButton: ReactNode;
  /** The error of a read made with the range; a refusal of a date goes under the picker. */
  refused?: unknown;
};

/** The note that these days are local days of the users, then the range, Query and the export. */
export function StatsBar({ draft, onDraft, onQuery, exportButton, refused }: Props) {
  const intl = useIntl();
  const meta = useAdminMeta();
  return (
    <>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'activity.stats.localDayNotice' })}
      </Typography.Text>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={onDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
          refused={refused}
          localDays
        />
        <Button type="primary" onClick={onQuery}>
          {intl.formatMessage({ id: 'stat.common.query' })}
        </Button>
        {exportButton}
      </Flex>
    </>
  );
}
