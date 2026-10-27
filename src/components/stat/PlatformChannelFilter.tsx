import { useIntl } from '@umijs/max';
import { Flex, Select } from 'antd';
import { ChannelSelect } from '../ChannelSelect';

export type PlatformChannelValue = { platform: string; channel: string };

type Props = {
  value: PlatformChannelValue;
  onChange: (value: PlatformChannelValue) => void;
  /** False for reports that have no platform dimension. */
  withPlatform?: boolean;
};

const PLATFORMS = ['ALL', 'ANDROID', 'IOS'] as const;

/** The platform and channel package filters that most statistics pages share. */
export function PlatformChannelFilter({ value, onChange, withPlatform = true }: Props) {
  const intl = useIntl();
  return (
    <Flex gap={8} wrap>
      {withPlatform ? (
        <Select
          style={{ minWidth: 120 }}
          aria-label={intl.formatMessage({ id: 'stat.common.platform' })}
          value={value.platform}
          options={PLATFORMS.map((p) => ({
            value: p,
            label: intl.formatMessage({ id: `stat.common.platform.${p}` }),
          }))}
          onChange={(platform) => onChange({ ...value, platform })}
        />
      ) : null}
      <ChannelSelect
        value={value.channel}
        onChange={(channel) => onChange({ ...value, channel })}
      />
    </Flex>
  );
}
