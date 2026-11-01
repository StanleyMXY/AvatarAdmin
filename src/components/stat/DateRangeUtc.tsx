import { useIntl } from '@umijs/max';
import { App, DatePicker, Flex } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { daysBetween, lastNDaysUtc, pickedDay, todayUtc, yesterdayUtc } from '../../utils/utcDay';

export type DayRange = { from: string; to: string };

type Props = {
  value: DayRange;
  onChange: (value: DayRange) => void;
  /** The longest range the backend accepts, in days (from `GET /meta`); without it nothing is limited here. */
  maxDays?: number;
  /**
   * The days are the users' local days, not UTC days (a report whose summary is cut at each user's
   * local midnight). The two presets that name a UTC day, "Today (UTC)" and "Yesterday (UTC)", are
   * then left out; what is picked is still sent exactly as picked.
   */
  localDays?: boolean;
};

// A calendar day written `YYYY-MM-DD` becomes the picker's date with the same calendar fields.
const asPickerDate = (day: string) => dayjs(`${day}T00:00:00`);

/**
 * A range of UTC calendar days. What the person picks on the calendar is sent exactly as picked;
 * the presets are computed in UTC ("today" is the UTC day, which can be yesterday where the person
 * is). A range longer than `maxDays` is refused with a message and `onChange` is not called.
 */
export function DateRangeUtc({ value, onChange, maxDays, localDays }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  // A refused range is taken off the picker by drawing it again from `value`.
  const [version, setVersion] = useState(0);

  const accept = (range: DayRange) => {
    if (range.from > range.to) return;
    if (maxDays !== undefined && daysBetween(range.from, range.to).length > maxDays) {
      message.warning({
        key: 'range-too-long',
        content: t('stat.common.rangeTooLong', { days: maxDays }),
      });
      setVersion((v) => v + 1);
      return;
    }
    onChange(range);
  };

  const preset = (label: string, range: DayRange) => ({
    label,
    value: [asPickerDate(range.from), asPickerDate(range.to)] as [dayjs.Dayjs, dayjs.Dayjs],
  });

  return (
    <Flex gap={8} wrap align="center">
      <DatePicker.RangePicker
        key={version}
        allowClear={false}
        value={[asPickerDate(value.from), asPickerDate(value.to)]}
        presets={[
          ...(localDays
            ? []
            : [
                preset(t('stat.common.today'), { from: todayUtc(), to: todayUtc() }),
                preset(t('stat.common.yesterday'), { from: yesterdayUtc(), to: yesterdayUtc() }),
              ]),
          preset(t('stat.common.last7'), lastNDaysUtc(7)),
          preset(t('stat.common.last30'), lastNDaysUtc(30)),
        ]}
        onChange={(range) => {
          if (!range?.[0] || !range[1]) return;
          accept({ from: pickedDay(range[0]), to: pickedDay(range[1]) });
        }}
      />
    </Flex>
  );
}
