import { useIntl } from '@umijs/max';
import { App, DatePicker, Flex } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { daysBetween, lastNDaysUtc, pickedDay } from '../../utils/utcDay';

export type DayRange = { from: string; to: string };

type Props = {
  value: DayRange;
  onChange: (value: DayRange) => void;
  /** The longest range the backend accepts, in days (from `GET /meta`); without it nothing is limited here. */
  maxDays?: number;
};

// A calendar day written `YYYY-MM-DD` becomes the picker's date with the same calendar fields.
const asPickerDate = (day: string) => dayjs(`${day}T00:00:00`);

/**
 * A range of calendar days for the two reports whose days are the users' local days, not UTC days
 * (the shared range picker names its presets "(UTC)", which would say the opposite here). What the
 * person picks is sent exactly as picked. A range longer than `maxDays` is refused with a message.
 */
export function LocalDayRange({ value, onChange, maxDays }: Props) {
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
