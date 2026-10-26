import { useIntl } from '@umijs/max';
import { Collapse, Flex, Typography } from 'antd';

const LAYERS = [1, 2, 3, 4, 5] as const;

/**
 * 投放检查清单, at the top of every ad page and folded away with one click: an ad reaches the app
 * only when five layers are all in order, and "set up but no ad" is the commonest question about
 * them. The layers are listed in the order to check them; below are the two other reasons to see
 * no ad (an entitlement that removes ads, a reward limit used up) and what a guest can get.
 */
export function Checklist() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <Collapse
      size="small"
      defaultActiveKey={['checklist']}
      data-testid="ads-checklist"
      items={[
        {
          key: 'checklist',
          label: t('ads.checklist.title'),
          children: (
            <Flex vertical gap={8}>
              <Typography.Text>{t('ads.checklist.intro')}</Typography.Text>
              <ol style={{ margin: 0, paddingInlineStart: 24 }} data-testid="ads-checklist-layers">
                {LAYERS.map((n) => (
                  <li key={n}>{t(`ads.checklist.layer${n}`)}</li>
                ))}
              </ol>
              <Typography.Text>{t('ads.checklist.otherReasons')}</Typography.Text>
              <Typography.Text data-testid="ads-checklist-guest">
                {t('ads.checklist.guest')}
              </Typography.Text>
            </Flex>
          ),
        },
      ]}
    />
  );
}
