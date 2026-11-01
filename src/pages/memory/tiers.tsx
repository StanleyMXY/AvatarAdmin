import { useAccess, useIntl } from '@umijs/max';
import { Alert, Button, Descriptions, Drawer, Flex, Spin, Table } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { useFailure } from '../../hooks/useFailure';
import { getTier, listTiers, type MemoryTier } from '../../services/memory';
import { TierForm } from './TierForm';

type Dialog = { name: string | null } | null;

/** 记忆服务 · 档位: the tiers and what each one does; changing one reaches every account on it. */
export default function TiersPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canEdit = access.canAccess('MEMORY:TIER_CONFIG');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [tiers, setTiers] = useState<MemoryTier[] | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [drawer, setDrawer] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await listTiers();
      setTiers(items);
      clear();
    } catch (error) {
      fail(error);
    }
  }, [fail, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={t('pages.common.loadFailed', { message: failure })}
        action={
          <Button size="small" onClick={() => void load()}>
            {t('pages.common.retry')}
          </Button>
        }
      />
    );
  }
  if (!tiers) return <Spin />;

  const yesNo = (value: boolean) => t(value ? 'memory.common.yes' : 'memory.common.no');
  const starting = tiers.find((tier) => tier.tierName === 'default') ?? null;

  return (
    <Flex vertical gap={12}>
      {canEdit ? (
        <Flex justify="flex-end">
          <Button type="primary" onClick={() => setDialog({ name: null })}>
            {t('memory.tier.create')}
          </Button>
        </Flex>
      ) : null}
      <Table<MemoryTier>
        rowKey="tierName"
        dataSource={tiers}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('memory.tier.empty') }}
        columns={[
          { title: t('memory.tier.col.name'), dataIndex: 'tierName' },
          { title: t('memory.tier.col.topK'), dataIndex: 'topK' },
          {
            title: t('memory.tier.col.recencyEnabled'),
            dataIndex: 'recencyChannelEnabled',
            render: yesNo,
          },
          { title: t('memory.tier.col.recencyCount'), dataIndex: 'recencyChannelCount' },
          {
            title: t('memory.tier.col.consolidationEnabled'),
            dataIndex: 'consolidationEnabled',
            render: yesNo,
          },
          {
            title: t('memory.tier.col.consolidationThreshold'),
            dataIndex: 'consolidationThreshold',
          },
          {
            ...ACTIONS_COLUMN,
            title: t('memory.tier.col.actions'),
            key: 'actions',
            render: (_, row) => (
              <Flex gap={4}>
                <Button type="link" size="small" onClick={() => setDrawer(row.tierName)}>
                  {t('memory.tier.detail')}
                </Button>
                {canEdit ? (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setDialog({ name: row.tierName })}
                  >
                    {t('memory.tier.edit')}
                  </Button>
                ) : null}
              </Flex>
            ),
          },
        ]}
      />
      <TierForm
        open={dialog !== null}
        tierName={dialog?.name ?? null}
        existing={tiers.map((tier) => tier.tierName)}
        starting={starting}
        onClose={() => setDialog(null)}
        onSaved={() => {
          setDialog(null);
          void load();
        }}
      />
      <TierDrawer name={drawer} onClose={() => setDrawer(null)} />
    </Flex>
  );
}

function TierDrawer({ name, onClose }: { name: string | null; onClose: () => void }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [tier, setTier] = useState<MemoryTier | null>(null);
  const { text: failure, fail, clear } = useFailure();

  useEffect(() => {
    if (name === null) return;
    let live = true;
    setTier(null);
    clear();
    getTier(name)
      .then((row) => {
        if (live) setTier(row);
      })
      .catch((error) => {
        if (live) fail(error);
      });
    return () => {
      live = false;
    };
  }, [name, fail, clear]);

  const yesNo = (value: boolean) => t(value ? 'memory.common.yes' : 'memory.common.no');
  return (
    <Drawer
      open={name !== null}
      onClose={onClose}
      size="default"
      title={t('memory.tier.detailTitle', { name: name ?? '' })}
      destroyOnHidden
    >
      {failure ? (
        <Alert type="error" showIcon title={t('pages.common.loadFailed', { message: failure })} />
      ) : null}
      {!tier && !failure ? <Spin /> : null}
      {tier ? (
        <Descriptions
          column={1}
          items={[
            { key: 'name', label: t('memory.tier.col.name'), children: tier.tierName },
            { key: 'topK', label: t('memory.tier.col.topK'), children: tier.topK },
            {
              key: 'recencyEnabled',
              label: t('memory.tier.col.recencyEnabled'),
              children: yesNo(tier.recencyChannelEnabled),
            },
            {
              key: 'recencyCount',
              label: t('memory.tier.col.recencyCount'),
              children: tier.recencyChannelCount,
            },
            {
              key: 'consolidationEnabled',
              label: t('memory.tier.col.consolidationEnabled'),
              children: yesNo(tier.consolidationEnabled),
            },
            {
              key: 'threshold',
              label: t('memory.tier.col.consolidationThreshold'),
              children: tier.consolidationThreshold,
            },
          ]}
        />
      ) : null}
    </Drawer>
  );
}
