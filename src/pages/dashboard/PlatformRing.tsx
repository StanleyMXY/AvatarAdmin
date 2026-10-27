import { Pie } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Button, Card, Flex, Skeleton, Tag, Typography } from 'antd';
import { describeFailure } from '../../session/describe';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { DASH, formatCount, formatPercent, safeRatio } from '../../utils/ratio';
import type { PlatformDau } from './dashboardSources';
import type { Source } from './useSource';

type Props = { android: Source<PlatformDau>; ios: Source<PlatformDau> };

const PLATFORMS = ['ANDROID', 'IOS'] as const;

/**
 * The DAU of today for Android and iOS as a ring (spec 5.1). The two numbers come from two requests
 * of today only, so the ring has its own loading and failure; today's numbers are still counting.
 */
export function PlatformRing({ android, ios }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const sources = { ANDROID: android, IOS: ios };
  const failed = PLATFORMS.map((p) => sources[p]).filter((s) => s.status === 'failed');
  const ready = PLATFORMS.every((p) => sources[p].status === 'ready');

  const values = PLATFORMS.map((platform) => ({
    platform,
    label: t(`stat.common.platform.${platform}`),
    dau: sources[platform].data?.dau ?? null,
  }));
  const known = values.filter((v): v is typeof v & { dau: number } => v.dau !== null && v.dau > 0);
  const total = known.reduce((sum, v) => sum + v.dau, 0);

  return (
    <Card size="small" data-testid="dashboard-platform" title={t('dashboard.platform.title')}>
      {failed.length > 0 ? (
        <div data-testid="dashboard-error-platform">
          <Typography.Text type="danger">
            {t('dashboard.card.loadFailed', {
              message: describeFailure(intl, failed[0].error).text,
            })}
          </Typography.Text>{' '}
          <Button
            size="small"
            onClick={() => {
              for (const source of failed) source.reload();
            }}
          >
            {t('pages.common.retry')}
          </Button>
        </div>
      ) : !ready ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : known.length === 0 ? (
        <Typography.Text type="secondary" data-testid="dashboard-platform-empty">
          {t('dashboard.platform.empty')}
        </Typography.Text>
      ) : (
        <Flex vertical gap={8}>
          <Flex gap={8} align="center">
            <span data-testid="dashboard-temp-platform">
              <Tag color="warning">{t('dashboard.temp')}</Tag>
            </span>
          </Flex>
          <Pie
            data={known.map((v) => ({ platform: v.label, value: v.dau }))}
            angleField="value"
            colorField="platform"
            innerRadius={0.6}
            height={220}
            theme={theme.g2Theme}
            scale={{
              color: { domain: values.map((v) => v.label), range: theme.palette.slice(0, 2) },
            }}
            legend={{ color: { itemLabelFill: theme.textColor } }}
          />
          <Flex gap={16} wrap>
            {values.map((v) => (
              <Typography.Text key={v.platform} data-testid={`dashboard-platform-${v.platform}`}>
                {v.label}{' '}
                {v.dau === null
                  ? DASH
                  : `${formatCount(v.dau, intl.locale)} (${formatPercent(safeRatio(v.dau, total), intl.locale, 0)})`}
              </Typography.Text>
            ))}
          </Flex>
        </Flex>
      )}
    </Card>
  );
}
