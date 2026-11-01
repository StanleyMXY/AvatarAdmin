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
  /**
   * Language-file keys for the label of the date and for a hint under it, for a summary whose days
   * are not UTC days. Without them the date says "(UTC)" and there is no hint.
   */
  dateLabelId?: string;
  hintId?: string;
};

/**
 * "Re-land this day": recomputes the summary of one UTC day (default: yesterday in UTC; a summary of
 * local days names its own date label and hint, see `Props`). Drawn only
 * for an administrator with `STATS:LAND`. With several names they are run one after the other and
 * it stops at the first one that fails.
 */
export function LandBar({ name, onLanded, dateLabelId = 'stat.common.land.date', hintId }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [day, setDay] = useState<string>(() => yesterdayUtc());

  const { run, pending } = useSingleFlight(async () => {
    const names = Array.isArray(name) ? name : [name];
    let landed = 0;
    let nofillSkipped = false;
    try {
      for (const one of names) {
        const result = await landStat(one, day);
        if (result?.nofillSkipped) nofillSkipped = true;
        landed += 1;
      }
      message.success(intl.formatMessage({ id: 'stat.common.land.done' }, { date: day }));
      // The backend leaves the table of the reasons for no ad as it was for a day it no longer holds.
      if (nofillSkipped) message.info(intl.formatMessage({ id: 'stat.common.land.nofillSkipped' }));
    } catch (error) {
      const reason = describeFailure(intl, error).text;
      // With several names, say which ones went in before the one that failed.
      message.error(
        landed > 0
          ? intl.formatMessage(
              { id: 'stat.common.land.partial' },
              { done: names.slice(0, landed).join(', '), failed: names[landed], reason },
            )
          : reason,
      );
    } finally {
      // Whatever was re-landed before a failure is already in the table: the page reads it again.
      if (landed > 0) onLanded();
    }
  });

  if (!access.canAccess('STATS:LAND')) return null;
  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text type="secondary">{intl.formatMessage({ id: dateLabelId })}</Typography.Text>
      <DatePicker
        allowClear={false}
        value={dayjs(`${day}T00:00:00`)}
        onChange={(picked) => picked && setDay(pickedDay(picked))}
      />
      <Button onClick={() => void run()} loading={pending} disabled={pending}>
        {intl.formatMessage({ id: 'stat.common.land.button' })}
      </Button>
      {hintId ? (
        <Typography.Text type="secondary">{intl.formatMessage({ id: hintId })}</Typography.Text>
      ) : null}
    </Flex>
  );
}
