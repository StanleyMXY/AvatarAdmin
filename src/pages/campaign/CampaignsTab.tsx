import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Button, Flex, Tag, Tooltip, Typography } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { RowActions } from '../../components/RowActions';
import {
  type AttributionCampaign,
  type CampaignFields,
  listCampaigns,
  updateCampaign,
} from '../../services/campaign';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { CampaignModal } from './CampaignModal';
import { LinkModal } from './LinkModal';
import { StatusSwitch } from './StatusSwitch';
import { instantText } from './texts';
import type { CampaignList } from './useCampaigns';

type Props = {
  /** Every campaign, for the check of a new code; read again after a save. */
  campaigns: CampaignList;
  /** `attribution.link_base_url`: a text, null when it is not configured, undefined while it is not known. */
  linkBase: string | null | undefined;
};

const DASH = '—';
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** The campaign as it is saved: every field as it is now, the state changed; no code and no token. */
function fieldsOf(row: AttributionCampaign, enabled: boolean): CampaignFields {
  return {
    name: plainText(row.name),
    mediaSource: plainText(row.mediaSource),
    campaign: plainText(row.campaign),
    utmMedium: plainText(row.utmMedium),
    adset: textOrNull(row.adset),
    ad: textOrNull(row.ad),
    facebookPixelId: textOrNull(row.facebookPixelId),
    googlePixelId: textOrNull(row.googlePixelId),
    tiktokPixelId: textOrNull(row.tiktokPixelId),
    channelCodes: Array.isArray(row.channelCodes)
      ? row.channelCodes.filter((c): c is string => typeof c === 'string')
      : [],
    remark: textOrNull(row.remark),
    enabled,
  };
}

/** A pixel: "Set" with the number when the pointer is over it, or a dash. */
function PixelCell({ id, label }: { id: unknown; label: string }) {
  const number = plainText(id);
  if (number === '') return <span>{DASH}</span>;
  return (
    <Tooltip title={number}>
      <Tag style={{ marginInlineEnd: 0 }}>{label}</Tag>
    </Tooltip>
  );
}

/**
 * 投放账户: the list with the search (keyword in the code or the name, and the state), the state
 * switch (sent at once), and the dialogs to make, change and generate a link. There is no delete:
 * a campaign is only switched off.
 */
export function CampaignsTab({ campaigns, linkBase }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('ATTRIBUTION:MANAGE');
  const ref = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<AttributionCampaign | 'new' | null>(null);
  const [linking, setLinking] = useState<AttributionCampaign | null>(null);

  const reload = () => {
    ref.current?.reload();
    campaigns.reload();
  };

  const columns: ProColumns<AttributionCampaign>[] = [
    {
      title: t('campaign.campaigns.col.code'),
      dataIndex: 'code',
      search: false,
      render: (_, row) => (
        <Typography.Text
          copyable={{ text: plainText(row.code) }}
          style={{ overflowWrap: 'anywhere' }}
        >
          {plainText(row.code)}
        </Typography.Text>
      ),
    },
    {
      title: t('campaign.campaigns.search.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('campaign.campaigns.search.keywordPlaceholder') },
    },
    {
      title: t('campaign.campaigns.col.name'),
      dataIndex: 'name',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={220} />,
    },
    {
      title: t('campaign.campaigns.col.channels'),
      dataIndex: 'channelCodes',
      search: false,
      render: (_, row) =>
        Array.isArray(row.channelCodes) && row.channelCodes.length > 0 ? (
          <Flex gap={4} wrap>
            {row.channelCodes.map((code) => (
              <Tag key={plainText(code)} style={{ marginInlineEnd: 0 }}>
                {plainText(code)}
              </Tag>
            ))}
          </Flex>
        ) : (
          DASH
        ),
    },
    {
      title: t('campaign.campaigns.col.facebook'),
      dataIndex: 'facebookPixelId',
      search: false,
      render: (_, row) => (
        <PixelCell id={row.facebookPixelId} label={t('campaign.campaigns.pixelSet')} />
      ),
    },
    {
      title: t('campaign.campaigns.col.google'),
      dataIndex: 'googlePixelId',
      search: false,
      render: (_, row) => (
        <PixelCell id={row.googlePixelId} label={t('campaign.campaigns.pixelSet')} />
      ),
    },
    {
      title: t('campaign.campaigns.col.tiktok'),
      dataIndex: 'tiktokPixelId',
      search: false,
      render: (_, row) => (
        <PixelCell id={row.tiktokPixelId} label={t('campaign.campaigns.pixelSet')} />
      ),
    },
    {
      title: t('campaign.campaigns.col.status'),
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: {
        true: { text: t('campaign.campaigns.status.enabled') },
        false: { text: t('campaign.campaigns.status.disabled') },
      },
      render: (_, row) => (
        <StatusSwitch
          checked={row.enabled === true}
          disabled={!canManage}
          label={t('campaign.campaigns.switchOf', { code: plainText(row.code) })}
          onToggle={(next) => updateCampaign(row.id, fieldsOf(row, next))}
          onDone={reload}
        />
      ),
    },
    {
      title: t('campaign.campaigns.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
    {
      title: t('campaign.campaigns.col.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, row) =>
        canManage ? (
          <RowActions
            actions={[
              { key: 'edit', label: t('campaign.campaigns.edit'), onClick: () => setEditing(row) },
              { key: 'link', label: t('campaign.campaigns.link'), onClick: () => setLinking(row) },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('campaign.campaigns.note')}
      </Typography.Paragraph>
      <PagedListTable<AttributionCampaign, { keyword?: string; enabled?: string }>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize, keyword, enabled }) =>
          listCampaigns({
            keyword: trimSpec(typeof keyword === 'string' ? keyword : '') || undefined,
            enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
            page,
            pageSize,
          })
        }
        toolbar={
          canManage
            ? [
                <Button key="new" type="primary" onClick={() => setEditing('new')}>
                  {t('campaign.campaigns.new')}
                </Button>,
              ]
            : undefined
        }
      />
      {editing !== null ? (
        <CampaignModal
          campaign={editing === 'new' ? null : editing}
          existingCodes={campaigns.rows.map((c) => c.code)}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      ) : null}
      {linking !== null ? (
        <LinkModal campaign={linking} linkBase={linkBase} onClose={() => setLinking(null)} />
      ) : null}
    </Flex>
  );
}
