import { useIntl } from '@umijs/max';
import { Button, Flex, Input, Select, Typography } from 'antd';
import { useMemo } from 'react';
import { SURFACE_PLATFORMS, type SurfaceRow, surfaceProblems } from './surfaces';

type Props = {
  value?: SurfaceRow[];
  onChange?: (value: SurfaceRow[]) => void;
  disabled?: boolean;
};

const NONE: SurfaceRow[] = [];

/**
 * Where a unit is served (answers 39): rows of a platform and, optionally, one channel code of it.
 * No row is every platform and channel. It is a form field: `value` is the rows as they are being
 * edited, which `toSurfaces` turns into the request. Each row says what is wrong with it.
 */
export function SurfacesEditor({ value = NONE, onChange, disabled }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const problems = useMemo(() => surfaceProblems(value), [value]);
  const set = (index: number, patch: Partial<SurfaceRow>) =>
    onChange?.(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Flex vertical gap={8} data-testid="surfaces-editor">
      <Typography.Text type="secondary">{t('ads.units.surfaces.help')}</Typography.Text>
      {value.map((row, index) => (
        // The rows have no identity of their own; the position is the key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <Flex key={index} gap={8} align="flex-start" wrap>
          <Flex vertical gap={4}>
            <Select
              style={{ minWidth: 140 }}
              disabled={disabled}
              aria-label={t('ads.units.surfaces.platform')}
              placeholder={t('ads.units.surfaces.platform')}
              value={row.platform}
              status={problems[index]?.platform ? 'error' : undefined}
              options={SURFACE_PLATFORMS.map((p) => ({
                value: p,
                label: intl.messages[`stat.common.platform.${p}`]
                  ? intl.formatMessage({ id: `stat.common.platform.${p}` })
                  : p,
              }))}
              onChange={(platform) => set(index, { platform })}
            />
            {problems[index]?.platform ? (
              <Typography.Text type="danger" role="alert">
                {t('ads.units.surfaces.platformRequired')}
              </Typography.Text>
            ) : null}
          </Flex>
          <Flex vertical gap={4}>
            <Input
              style={{ width: 260 }}
              dir="ltr"
              disabled={disabled}
              aria-label={t('ads.units.surfaces.channel')}
              placeholder={t('ads.units.surfaces.channel')}
              value={row.channel}
              status={problems[index]?.channel ? 'error' : undefined}
              onChange={(e) => set(index, { channel: e.target.value })}
            />
            {problems[index]?.channel ? (
              <Typography.Text type="danger" role="alert">
                {t('ads.units.surfaces.channelFormat')}
              </Typography.Text>
            ) : null}
          </Flex>
          <Button
            disabled={disabled}
            aria-label={t('ads.units.surfaces.remove')}
            onClick={() => onChange?.(value.filter((_, i) => i !== index))}
          >
            {t('ads.common.delete')}
          </Button>
        </Flex>
      ))}
      <div>
        <Button
          disabled={disabled}
          onClick={() => onChange?.([...value, { platform: undefined, channel: '' }])}
        >
          {t('ads.units.surfaces.add')}
        </Button>
      </div>
    </Flex>
  );
}
