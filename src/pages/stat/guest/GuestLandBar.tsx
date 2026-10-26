import { useAccess, useIntl } from '@umijs/max';
import { App, Button, DatePicker, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useSingleFlight } from '../../../hooks/useSingleFlight';
import { landStat } from '../../../services/stats/land';
import type { LandName } from '../../../services/stats/types';
import { describeFailure } from '../../../session/describe';
import { pickedDay, yesterdayUtc } from '../../../utils/utcDay';

type Access = { canAccess: (code?: string) => boolean };

/** What the one landing bar of the guest tabs recomputes: the day, the conversion cells and the retention cells. */
const GUEST_LAND_NAMES: LandName[] = ['daily-business', 'guest-cohort', 'guest-retention'];

/**
 * The landing bar of the guest daily report, the conversion cohorts and the guest retention (spec
 * 5.4): one date, the three summaries one after the other, and it stops at the first that fails.
 * For the two cohort tables the date is the check day: landing fills the cells of each N that fall
 * on that day, it does not recompute a whole row. Only for `STATS:LAND`; default yesterday in UTC;
 * one run at a time; whatever was landed before a failure is read again.
 */
export function GuestLandBar({ onLanded }: { onLanded: () => void }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [day, setDay] = useState<string>(() => yesterdayUtc());

  const { run, pending } = useSingleFlight(async () => {
    let landed = 0;
    try {
      for (const name of GUEST_LAND_NAMES) {
        await landStat(name, day);
        landed += 1;
      }
      message.success(intl.formatMessage({ id: 'stat.common.land.done' }, { date: day }));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    } finally {
      if (landed > 0) onLanded();
    }
  });

  if (!access.canAccess('STATS:LAND')) return null;
  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'stat.guest.land.date' })}
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
        {intl.formatMessage({ id: 'stat.guest.land.hint' })}
      </Typography.Text>
    </Flex>
  );
}
