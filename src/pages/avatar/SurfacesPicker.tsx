import { useIntl } from '@umijs/max';
import { Flex, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { loadChannels } from '../../components/ChannelSelect';
import { PLATFORMS, type Platform, type Surface } from '../../services/avatar';
import type { ChannelRow } from '../../services/channels/getChannels';
import { ALL_CHANNELS, applyChange, toSelections, toSurfaces } from './surfaces';
import { codeText } from './texts';

type Props = {
  /** The stored list (contract 3.7). An empty list means every end. */
  value?: Surface[];
  onChange?: (value: Surface[]) => void;
  disabled?: boolean;
};

/**
 * The ends a catalog item is shown on: for each platform a box of channels (from `GET /channels`)
 * with "all channels of the platform" as one of the choices. Nothing chosen means every end, and
 * the value is then the empty list. Fits an Ant Design form item (`value` and `onChange`).
 */
export function SurfacesPicker({ value, onChange, disabled }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
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

  const list = value ?? [];
  const selections = toSelections(list);

  const optionsOf = (platform: Platform) => {
    const known = channels.filter((c) => c.platform === platform);
    // A channel the item already names but the list no longer has stays visible, by its code.
    const named = selections[platform].filter(
      (code) => code !== ALL_CHANNELS && !known.some((c) => c.channelCode === code),
    );
    return [
      { value: ALL_CHANNELS, label: t('avatar.surfaces.allChannels') },
      ...known.map((c) => ({ value: c.channelCode, label: `${c.channelCode} · ${c.name}` })),
      ...named.map((code) => ({ value: code, label: code })),
    ];
  };

  return (
    <Flex vertical gap={8} data-testid="surfaces-picker">
      {PLATFORMS.map((platform) => (
        <Flex key={platform} gap={8} align="center" wrap>
          <Typography.Text style={{ minWidth: 64 }}>
            {codeText(intl, 'avatar.platform', platform)}
          </Typography.Text>
          <Select
            mode="multiple"
            allowClear
            disabled={disabled}
            style={{ flex: 1, minWidth: 240 }}
            aria-label={codeText(intl, 'avatar.platform', platform)}
            placeholder={t('avatar.surfaces.none')}
            value={selections[platform]}
            options={optionsOf(platform)}
            onChange={(next: string[]) =>
              onChange?.(
                toSurfaces({ ...selections, [platform]: applyChange(selections[platform], next) }),
              )
            }
          />
        </Flex>
      ))}
      <Typography.Text type="secondary">
        {list.length === 0 ? t('avatar.surfaces.allNote') : t('avatar.surfaces.someNote')}
      </Typography.Text>
    </Flex>
  );
}
