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

type Props = {
  name: LandName | LandName[];
  onLanded: () => void;
};

/**
 * "Re-land this day": recomputes the summary of one UTC day (default: yesterday in UTC). Drawn only
 * for an administrator with `STATS:LAND`. With several names they are run one after the other and
 * it stops at the first one that fails.
 */
export function LandBar({ name, onLanded }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [day, setDay] = useState<string>(() => yesterdayUtc());

  const { run, pending } = useSingleFlight(async () => {
    let landed = 0;
    try {
      for (const one of Array.isArray(name) ? name : [name]) {
        await landStat(one, day);
        landed += 1;
      }
      message.success(intl.formatMessage({ id: 'stat.common.land.done' }, { date: day }));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    } finally {
      // Whatever was re-landed before a failure is already in the table: the page reads it again.
      if (landed > 0) onLanded();
    }
  });

  if (!access.canAccess('STATS:LAND')) return null;
  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'stat.common.land.date' })}
      </Typography.Text>
      <DatePicker
        allowClear={false}
        value={dayjs(`${day}T00:00:00`)}
        onChange={(picked) => picked && setDay(pickedDay(picked))}
      />
      <Button onClick={() => void run()} loading={pending} disabled={pending}>
        {intl.formatMessage({ id: 'stat.common.land.button' })}
      </Button>
    </Flex>
  );
}
