import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Button, Flex, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { EnabledSwitch } from '../../components/EnabledSwitch';
import { PagedListTable } from '../../components/PagedListTable';
import {
  AVATAR_STYLES,
  type AvatarStyle,
  COSMETIC_KINDS,
  type CosmeticItem,
  type CosmeticKind,
  listCosmetics,
  setCosmeticEnabled,
} from '../../services/avatar';
import { codeText } from '../../utils/displayText';
import { DASH, formatCount } from '../../utils/ratio';
import { CosmeticModal } from './CosmeticModal';
import { pickText } from './localized';
import { Thumb } from './Thumb';
import { describeSurfaces } from './texts';

type Filter = { kind?: CosmeticKind; enabled?: string; style?: AvatarStyle };

/** 服装与背景目录 (`COSMETIC:MANAGE`): the outfits and backgrounds users can wear, their prices and the ends they are shown on. */
export default function CosmeticsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('COSMETIC:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<CosmeticItem | null | 'new'>(null);
  const reload = () => ref.current?.reload();
  const yesNo = (value: boolean) => t(value ? 'avatar.yes' : 'avatar.no');

  const columns: ProColumns<CosmeticItem>[] = [
    {
      title: t('avatar.col.key'),
      dataIndex: 'key',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.key} lines={1} width={160} />,
    },
    {
      title: t('avatar.col.kind'),
      dataIndex: 'kind',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        COSMETIC_KINDS.map((kind) => [
          kind,
          { text: codeText(intl, 'avatar.cosmetics.kind', kind) },
        ]),
      ),
      render: (_, row) => codeText(intl, 'avatar.cosmetics.kind', row.kind),
    },
    {
      title: t('avatar.col.name'),
      dataIndex: 'names',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={pickText(row.names, intl.locale)} lines={2} width={200} />
      ),
    },
    {
      title: t('avatar.col.preview'),
      dataIndex: 'previewUrl',
      search: false,
      render: (_, row) => <Thumb url={row.previewUrl} alt={row.key} />,
    },
    {
      title: t('avatar.col.styles'),
      dataIndex: 'compatibleStyles',
      search: false,
      render: (_, row) => (
        <Flex gap={4} wrap>
          {row.compatibleStyles.map((style) => (
            <Tag key={style}>{codeText(intl, 'avatar.style', style)}</Tag>
          ))}
        </Flex>
      ),
    },
    {
      // Search only: the filter on the style an item fits.
      title: t('avatar.col.style'),
      dataIndex: 'style',
      hideInTable: true,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        AVATAR_STYLES.map((style) => [style, { text: codeText(intl, 'avatar.style', style) }]),
      ),
    },
    {
      title: t('avatar.col.surfaces'),
      dataIndex: 'surfaces',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={describeSurfaces(intl, row.surfaces)} lines={2} width={180} />
      ),
    },
    {
      title: t('avatar.col.creditPrice'),
      dataIndex: 'creditPrice',
      search: false,
      align: 'right',
      render: (_, row) =>
        row.creditPrice === null ? DASH : formatCount(row.creditPrice, intl.locale),
    },
    {
      title: t('avatar.col.isFree'),
      dataIndex: 'isFree',
      search: false,
      render: (_, row) => yesNo(row.isFree),
    },
    {
      title: t('avatar.col.isDefault'),
      dataIndex: 'isDefault',
      search: false,
      render: (_, row) => yesNo(row.isDefault),
    },
    {
      title: t('avatar.col.enabled'),
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: {
        true: { text: t('avatar.cosmetics.onShelf') },
        false: { text: t('avatar.cosmetics.offShelf') },
      },
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled}
          disabled={!canWrite}
          label={t('avatar.enabledOf', { key: row.key })}
          onToggle={(next) => setCosmeticEnabled(row.id, next)}
          onDone={reload}
        />
      ),
    },
    {
      title: t('avatar.col.sortOrder'),
      dataIndex: 'sortOrder',
      search: false,
      align: 'right',
    },
    {
      title: t('avatar.col.actions'),
      valueType: 'option',
      ...ACTIONS_COLUMN,
      render: (_, row) =>
        canWrite ? (
          <Button type="link" size="small" onClick={() => setEditing(row)}>
            {t('avatar.edit')}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Typography.Paragraph type="secondary">{t('avatar.cosmetics.note')}</Typography.Paragraph>
      <PagedListTable<CosmeticItem, Filter>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize, kind, enabled, style }) =>
          listCosmetics({
            page,
            pageSize,
            kind,
            style,
            enabled: enabled === undefined || enabled === '' ? undefined : enabled === 'true',
          })
        }
        toolbar={
          canWrite
            ? [
                <Button key="new" type="primary" onClick={() => setEditing('new')}>
                  {t('avatar.cosmetics.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <CosmeticModal
        open={editing !== null}
        item={editing === 'new' || editing === null ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  );
}
