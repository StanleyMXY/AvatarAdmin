import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, Button } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import {
  listRendererModels,
  type RendererModel,
  setRendererModelEnabled,
} from '../../services/avatar';
import { formatBytes, formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { EnabledSwitch } from './EnabledSwitch';
import { RendererModelModal } from './RendererModelModal';
import { codeText } from './texts';

/** 渲染模型 (`RENDERER:MANAGE`): the model files the apps download to draw an avatar on the phone. They go to every build, with no scope. */
export default function RendererModelsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canWrite = access.canAccess('RENDERER:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const reload = () => ref.current?.reload();

  const columns: ProColumns<RendererModel>[] = [
    {
      title: t('avatar.models.rendererKind'),
      dataIndex: 'rendererKind',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.rendererKind} lines={1} width={180} />,
    },
    {
      title: t('avatar.models.version'),
      dataIndex: 'version',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.version} lines={1} width={120} />,
    },
    {
      title: t('avatar.models.platform'),
      dataIndex: 'platform',
      search: false,
      render: (_, row) => codeText(intl, 'avatar.platform', row.platform),
    },
    { title: t('avatar.models.abi'), dataIndex: 'abi', search: false },
    {
      title: t('avatar.models.formatVersion'),
      dataIndex: 'rendererFormatVersion',
      search: false,
      align: 'right',
    },
    {
      title: t('avatar.models.minVersionCode'),
      dataIndex: 'minVersionCode',
      search: false,
      align: 'right',
    },
    {
      title: t('avatar.models.sizeBytes'),
      dataIndex: 'sizeBytes',
      search: false,
      align: 'right',
      render: (_, row) =>
        typeof row.sizeBytes === 'number' ? formatBytes(row.sizeBytes, intl.locale) : DASH,
    },
    {
      title: t('avatar.models.sha256'),
      dataIndex: 'sha256',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.sha256} lines={1} width={200} />,
    },
    {
      title: t('avatar.models.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => (row.createdAt ? formatInstant(row.createdAt, intl.locale) : DASH),
    },
    {
      title: t('avatar.col.enabled'),
      dataIndex: 'enabled',
      search: false,
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled}
          disabled={!canWrite}
          label={t('avatar.models.enabledOf', {
            version: row.version,
            platform: row.platform,
            abi: row.abi,
          })}
          onToggle={(next) => setRendererModelEnabled(row.id, next)}
          onDone={reload}
        />
      ),
    },
  ];

  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t('avatar.models.note')} />
      <PagedListTable<RendererModel>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize }) => listRendererModels({ page, pageSize })}
        toolbar={
          canWrite
            ? [
                <Button key="new" type="primary" onClick={() => setCreating(true)}>
                  {t('avatar.models.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <RendererModelModal open={creating} onClose={() => setCreating(false)} onSaved={reload} />
    </>
  );
}
