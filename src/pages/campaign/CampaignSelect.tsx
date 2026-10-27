import { useIntl } from '@umijs/max';
import { Button, Flex, Select, Typography } from 'antd';
import { plainText } from '../../utils/plainText';
import type { CampaignList } from './useCampaigns';

type Props = {
  list: CampaignList;
  /** The id of the campaign, or `undefined` for all of them. */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** The permission the list needs, for the words when the administrator may not read it. */
  neededCode?: 'ATTRIBUTION:MANAGE' | 'ATTRIBUTION:VIEW';
};

/**
 * The campaign filter. Without the permission to read the list it is disabled and says which
 * permission is missing; when the list cannot be read it says so and offers to read it again.
 */
export function CampaignSelect({
  list,
  value,
  onChange,
  neededCode = 'ATTRIBUTION:MANAGE',
}: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const label = t('campaign.select.label');
  const permission = intl.messages[`permission.${neededCode}`]
    ? t(`permission.${neededCode}`)
    : neededCode;
  return (
    <Flex gap={8} align="center" wrap>
      <Typography.Text>{label}</Typography.Text>
      <Select
        allowClear
        showSearch
        style={{ minWidth: 240, maxWidth: 360 }}
        aria-label={label}
        placeholder={t('campaign.select.all')}
        disabled={list.status === 'forbidden'}
        loading={list.status === 'loading'}
        value={value}
        onChange={(id) => onChange(id ?? undefined)}
        optionFilterProp="label"
        options={list.rows.map((row) => ({
          value: row.id,
          label: `${plainText(row.code)} · ${plainText(row.name)}`,
        }))}
      />
      {list.status === 'forbidden' ? (
        <Typography.Text type="secondary" data-testid="campaign-select-forbidden">
          {t('campaign.select.forbidden', { permission })}
        </Typography.Text>
      ) : null}
      {list.status === 'failed' ? (
        <>
          <Typography.Text type="danger">{t('campaign.select.failed')}</Typography.Text>
          <Button size="small" onClick={list.reload}>
            {t('pages.common.retry')}
          </Button>
        </>
      ) : null}
    </Flex>
  );
}
