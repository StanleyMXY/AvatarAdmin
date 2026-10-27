import { useIntl } from '@umijs/max';
import { Select } from 'antd';
import { useEffect, useState } from 'react';
import { type ChannelRow, getChannels } from '../services/channels/getChannels';

let cached: Promise<ChannelRow[]> | undefined;

/** Reads the channel list once per page load and shares it between every dropdown. */
export function loadChannels(): Promise<ChannelRow[]> {
  if (!cached) {
    cached = getChannels().catch(() => {
      cached = undefined; // try again next time
      return [] as ChannelRow[];
    });
  }
  return cached;
}

/** Forgets the shared list (a channel was added or changed, or between tests). */
export function resetChannelsCache(): void {
  cached = undefined;
}

type Props = {
  value?: string;
  onChange?: (code: string) => void;
  /** An "all" entry first; its value is `ALL`. */
  withAll?: boolean;
  /** An entry for the channel code `unknown` (ad reports show it). */
  withUnknown?: boolean;
  disabled?: boolean;
};

/** The channel package dropdown shared by the statistics pages, the catalogs and the ad accounts. */
export function ChannelSelect({ value, onChange, withAll = true, withUnknown, disabled }: Props) {
  const intl = useIntl();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  useEffect(() => {
    let live = true;
    void loadChannels().then((rows) => {
      if (live) setChannels(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const options = [
    ...(withAll
      ? [{ value: 'ALL', label: intl.formatMessage({ id: 'stat.common.channelAll' }) }]
      : []),
    ...channels.map((c) => ({ value: c.channelCode, label: `${c.channelCode} · ${c.name}` })),
    ...(withUnknown
      ? [{ value: 'unknown', label: intl.formatMessage({ id: 'stat.common.channelUnknown' }) }]
      : []),
  ];
  return (
    <Select
      style={{ minWidth: 160 }}
      value={value}
      options={options}
      disabled={disabled}
      aria-label={intl.formatMessage({ id: 'stat.common.channel' })}
      onChange={(code) => onChange?.(code)}
    />
  );
}
