import { useAccess, useIntl } from '@umijs/max';
import { App, Button, DatePicker, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { landStat } from '../../services/stats/land';
import type { LandName } from '../../services/stats/types';
import { describeFailure } from '../../session/describe';
import { pickedDay, yesterdayUtc } from '../../utils/utcDay';

type Access = { canAccess: (code?: string) => boolean };

/**
 * "Re-land this day" for a summary whose days are the users' local days: it recomputes one day of
 * the table (default: yesterday). The shared landing bar says "(UTC)" on its date, which would be
 * wrong for these two summaries. Drawn only for `STATS:LAND`; one run at a time.
 */
export function LocalDayLandBar({ name, onLanded }: { name: LandName; onLanded: () => void }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [day, setDay] = useState<string>(() => yesterdayUtc());

  const { run, pending } = useSingleFlight(async () => {
    try {
      await landStat(name, day);
      message.success(intl.formatMessage({ id: 'stat.common.land.done' }, { date: day }));
      onLanded();
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    }
  });

  if (!access.canAccess('STATS:LAND')) return null;
  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'activity.stats.land.date' })}
      </Typography.Text>
      <DatePicker
        allowClear={false}
        value={dayjs(`${day}T00:00:00`)}
        onChange={(picked) => picked && setDay(pickedDay(picked))}
      />
      <Button onClick={() => void run()} loading={pending} disabled={pending}>
        {intl.formatMessage({ id: 'stat.common.land.button' })}
      </Button>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'activity.stats.land.hint' })}
      </Typography.Text>
    </Flex>
  );
}
