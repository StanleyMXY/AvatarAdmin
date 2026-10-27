import { useIntl } from '@umijs/max';
import { Alert, Button, Checkbox, Flex, Input, Select, Tag, TimePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { type ReactNode, useMemo } from 'react';
import {
  isOvernight,
  PLATFORMS,
  type TargetingForm,
  type TargetingKey,
  validateTargeting,
} from './targeting';

type Props = {
  value?: TargetingForm;
  onChange?: (value: TargetingForm) => void;
  /** `false`: the country field says that nothing set there will match. `null`/`undefined`: not known, nothing is said. */
  geoConfigured?: boolean | null;
  /** The faults the backend named, already in words, by field. */
  serverErrors?: Partial<Record<TargetingKey, string>>;
  disabled?: boolean;
};

const EMPTY: TargetingForm = {
  platforms: [],
  geo: [],
  osVersionMin: '',
  appVersionMin: '',
  languages: [],
  dayParts: [],
};

const toDayjs = (clock: string): Dayjs | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock);
  return match ? dayjs().hour(Number(match[1])).minute(Number(match[2])).second(0) : null;
};

const unique = (values: string[]) => [...new Set(values)];

/**
 * The targeting of a unit (contract 22.5): platforms, countries, the lowest system and app
 * versions, languages and a list of time ranges (in the local time of the user; a guest has no time
 * zone and gets UTC). It is a form field: `value` is the text and the lists as the person edits
 * them, which `toTargeting` turns into the request. Each field says what is wrong with it.
 */
export function TargetingEditor({
  value = EMPTY,
  onChange,
  geoConfigured,
  serverErrors,
  disabled,
}: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const faults = useMemo(() => validateTargeting(value), [value]);
  const set = (patch: Partial<TargetingForm>) => onChange?.({ ...value, ...patch });

  const errorOf = (key: TargetingKey): ReactNode => {
    const reason = faults[key];
    const text = reason ? t(`ads.targeting.error.${reason}`) : serverErrors?.[key];
    return text ? (
      <Typography.Text type="danger" role="alert">
        {text}
      </Typography.Text>
    ) : null;
  };

  const field = (label: string, control: ReactNode, key: TargetingKey, help?: string) => (
    <Flex vertical gap={4}>
      <Typography.Text strong>{label}</Typography.Text>
      {control}
      {help ? <Typography.Text type="secondary">{help}</Typography.Text> : null}
      {errorOf(key)}
    </Flex>
  );

  const setPart = (index: number, patch: Partial<{ start: string; end: string }>) =>
    set({
      dayParts: value.dayParts.map((part, i) => (i === index ? { ...part, ...patch } : part)),
    });

  return (
    <Flex vertical gap={16} data-testid="targeting-editor">
      {field(
        t('ads.targeting.platforms'),
        <Checkbox.Group
          disabled={disabled}
          value={value.platforms}
          options={PLATFORMS.map((p) => ({ value: p, label: t(`stat.common.platform.${p}`) }))}
          onChange={(platforms) => set({ platforms: platforms as string[] })}
        />,
        'platforms',
      )}
      {field(
        t('ads.targeting.geo'),
        <Flex vertical gap={8}>
          {geoConfigured === false ? (
            <Alert type="warning" showIcon title={t('ads.targeting.geoNotConfigured')} />
          ) : null}
          <Select
            mode="tags"
            disabled={disabled}
            style={{ width: '100%' }}
            aria-label={t('ads.targeting.geo')}
            placeholder={t('ads.targeting.geoPlaceholder')}
            tokenSeparators={[',', ' ']}
            open={false}
            value={value.geo}
            onChange={(geo: string[]) =>
              set({ geo: unique(geo.map((code) => code.trim().toUpperCase()).filter(Boolean)) })
            }
          />
        </Flex>,
        'geo',
        t('ads.targeting.geoHelp'),
      )}
      {field(
        t('ads.targeting.osVersionMin'),
        <Input
          disabled={disabled}
          aria-label={t('ads.targeting.osVersionMin')}
          style={{ maxWidth: 240 }}
          placeholder="13"
          value={value.osVersionMin}
          onChange={(e) => set({ osVersionMin: e.target.value })}
        />,
        'osVersionMin',
        t('ads.targeting.versionHelp'),
      )}
      {field(
        t('ads.targeting.appVersionMin'),
        <Input
          disabled={disabled}
          aria-label={t('ads.targeting.appVersionMin')}
          style={{ maxWidth: 240 }}
          placeholder="1.2.0"
          value={value.appVersionMin}
          onChange={(e) => set({ appVersionMin: e.target.value })}
        />,
        'appVersionMin',
        t('ads.targeting.versionHelp'),
      )}
      {field(
        t('ads.targeting.languages'),
        <Select
          mode="tags"
          disabled={disabled}
          style={{ width: '100%' }}
          aria-label={t('ads.targeting.languages')}
          placeholder={t('ads.targeting.languagesPlaceholder')}
          tokenSeparators={[',', ' ']}
          open={false}
          value={value.languages}
          onChange={(languages: string[]) =>
            set({ languages: unique(languages.map((tag) => tag.trim()).filter(Boolean)) })
          }
        />,
        'languages',
        t('ads.targeting.languagesHelp'),
      )}
      {field(
        t('ads.targeting.dayParts'),
        <Flex vertical gap={8}>
          {value.dayParts.map((part, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the rows have no identity but their place in the list
            <Flex key={index} gap={8} align="center" wrap>
              <TimePicker
                disabled={disabled}
                format="H:mm"
                needConfirm={false}
                showNow={false}
                placeholder={t('ads.targeting.start')}
                value={toDayjs(part.start)}
                onChange={(time) => setPart(index, { start: time ? time.format('H:mm') : '' })}
              />
              <span>–</span>
              <TimePicker
                disabled={disabled}
                format="H:mm"
                needConfirm={false}
                showNow={false}
                placeholder={t('ads.targeting.end')}
                value={toDayjs(part.end)}
                onChange={(time) => setPart(index, { end: time ? time.format('H:mm') : '' })}
              />
              {isOvernight(part) ? <Tag>{t('ads.targeting.overnight')}</Tag> : null}
              <Button
                type="link"
                size="small"
                disabled={disabled}
                onClick={() => set({ dayParts: value.dayParts.filter((_, i) => i !== index) })}
              >
                {t('ads.targeting.remove')}
              </Button>
            </Flex>
          ))}
          <div>
            <Button
              size="small"
              disabled={disabled}
              onClick={() => set({ dayParts: [...value.dayParts, { start: '', end: '' }] })}
            >
              {t('ads.targeting.addRange')}
            </Button>
          </div>
        </Flex>,
        'dayParts',
        t('ads.targeting.dayPartsHelp'),
      )}
    </Flex>
  );
}
