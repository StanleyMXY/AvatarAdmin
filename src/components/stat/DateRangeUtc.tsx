import { useIntl } from '@umijs/max';
import { App, DatePicker, Flex } from 'antd';
import dayjs from 'dayjs';
import { daysBetween, lastNDaysUtc, pickedDay, todayUtc, yesterdayUtc } from '../../utils/utcDay';

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
 * A range of UTC calendar days. What the person picks on the calendar is sent exactly as picked;
 * the presets are computed in UTC ("today" is the UTC day, which can be yesterday where the person
 * is). A range longer than `maxDays` is refused with a message and `onChange` is not called.
 */
export function DateRangeUtc({ value, onChange, maxDays }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const accept = (range: DayRange) => {
    if (range.from > range.to) return;
    if (maxDays !== undefined && daysBetween(range.from, range.to).length > maxDays) {
      message.warning(t('stat.common.rangeTooLong', { days: maxDays }));
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
        allowClear={false}
        value={[asPickerDate(value.from), asPickerDate(value.to)]}
        presets={[
          preset(t('stat.common.today'), { from: todayUtc(), to: todayUtc() }),
          preset(t('stat.common.yesterday'), { from: yesterdayUtc(), to: yesterdayUtc() }),
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
