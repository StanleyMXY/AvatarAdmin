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
 * The re-landing bar of the retention tabs. The shared bar calls its date "Date (UTC)", but for a
 * retention summary the date is the check day: landing it fills the cells of each N that fall on
 * that day, it does not recompute a whole row (spec 4.4). Same rules as the shared bar: only for
 * `STATS:LAND`, default yesterday in UTC, one run at a time, the page reads again after a success.
 */
export function CheckDayLandBar({ name, onLanded }: { name: LandName; onLanded: () => void }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [day, setDay] = useState<string>(() => yesterdayUtc());

  const { run, pending } = useSingleFlight(async () => {
    try {
      await landStat(name, day);
    } catch (error) {
      message.error(describeFailure(intl, error).text);
      return;
    }
    message.success(intl.formatMessage({ id: 'stat.common.land.done' }, { date: day }));
    onLanded();
  });

  if (!access.canAccess('STATS:LAND')) return null;
  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'stat.retention.land.date' })}
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
        {intl.formatMessage({ id: 'stat.retention.land.hint' })}
      </Typography.Text>
    </Flex>
  );
}
