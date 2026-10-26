import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Popconfirm, Select, Spin, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AccountMemory,
  assignEmbeddingModel,
  DEFAULT_EMBEDDING_MODEL,
  type EmbeddingAssignment,
  type EmbeddingModel,
  getAccountMemory,
  listEmbeddingModels,
} from '../../services/memory';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';

type Props = {
  accountId: string;
  /** `User.status` of the account: PENDING_DELETION and DELETING cannot be given another model. */
  accountStatus?: string;
};

const BLOCKED = new Set(['PENDING_DELETION', 'DELETING']);

const Line = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Flex gap={8} wrap>
    <Typography.Text type="secondary">{label}</Typography.Text>
    <span>{children}</span>
  </Flex>
);

/**
 * The "memory" tab of an account (the user detail page puts it in): the tier it was given and how
 * the sync went, the embedding model it uses, the history of assignments, and, for an
 * administrator with MEMORY:MODEL_ASSIGN, the control that gives it another model. The tier itself
 * cannot be set by hand: it follows the entitlements.
 */
export default function AccountMemoryTab({ accountId, accountStatus }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canAssign = access.canAccess('MEMORY:MODEL_ASSIGN');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [memory, setMemory] = useState<AccountMemory | null>(null);
  const [models, setModels] = useState<EmbeddingModel[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const [assignFailure, setAssignFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMemory(await getAccountMemory(accountId));
      setFailure(null);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
    }
  }, [accountId, intl]);

  useEffect(() => {
    setMemory(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    let live = true;
    listEmbeddingModels()
      .then(({ items }) => {
        if (live) setModels(items);
      })
      .catch(() => {
        if (live) setModels([]);
      });
    return () => {
      live = false;
    };
  }, [canAssign]);

  const assign = useSingleFlight(async (modelName: string) => {
    setAssignFailure(null);
    try {
      await assignEmbeddingModel(accountId, modelName);
    } catch (error) {
      setAssignFailure(describeFailure(intl, error).text);
      return;
    }
    message.success(t('memory.account.assigned'));
    setChoice(undefined);
    await load();
  });

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
  if (!memory) return <Spin />;

  const history: EmbeddingAssignment[] = [...memory.embeddingAssignments].sort((a, b) =>
    a.assignedAt < b.assignedAt ? 1 : -1,
  );
  const current = history[0]?.modelName ?? null;
  const blocked = accountStatus !== undefined && BLOCKED.has(accountStatus);
  const { tier } = memory;
  const syncKey = `memory.account.syncStatus.${tier.syncStatus}`;

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={4}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('memory.account.tier')}
        </Typography.Title>
        <Line label={t('memory.account.tierName')}>
          {tier.tierName ?? t('memory.account.tierNone')}
        </Line>
        <Line label={t('memory.account.syncStatus')}>
          {intl.messages[syncKey] ? t(syncKey) : tier.syncStatus}
        </Line>
        <Line label={t('memory.account.assignedAt')}>
          {tier.assignedAt ? formatInstant(tier.assignedAt, intl.locale) : DASH}
        </Line>
        {tier.lastError ? (
          <Line label={t('memory.account.lastError')}>
            <EllipsisPopoverText text={tier.lastError} width={420} />
          </Line>
        ) : null}
        <Typography.Text type="secondary">{t('memory.account.tierNote')}</Typography.Text>
      </Flex>

      <Flex vertical gap={8}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('memory.account.model')}
        </Typography.Title>
        <Typography.Text>
          {current
            ? t('memory.account.currentModel', { name: current })
            : t('memory.account.defaultModel', { name: DEFAULT_EMBEDDING_MODEL })}
        </Typography.Text>
        {canAssign ? (
          <Flex vertical gap={8}>
            <Alert type="warning" showIcon title={t('memory.account.assignWarning')} />
            {blocked ? <Alert type="info" showIcon title={t('memory.account.blocked')} /> : null}
            <Flex gap={8} wrap>
              <Select
                aria-label={t('memory.account.chooseModel')}
                placeholder={t('memory.account.chooseModel')}
                style={{ minWidth: 220 }}
                disabled={blocked || assign.pending}
                value={choice}
                onChange={setChoice}
                options={models.map((m) => ({ value: m.modelName, label: m.modelName }))}
                notFoundContent={t('memory.account.noModels')}
              />
              <Popconfirm
                title={t('memory.account.assignConfirm', { name: choice ?? '' })}
                okText={t('pages.common.ok')}
                cancelText={t('pages.common.cancel')}
                okButtonProps={{ danger: true, loading: assign.pending, disabled: assign.pending }}
                disabled={blocked || !choice}
                onConfirm={async () => {
                  if (choice) await assign.run(choice);
                }}
              >
                <Button type="primary" disabled={blocked || !choice || assign.pending}>
                  {t('memory.account.assign')}
                </Button>
              </Popconfirm>
            </Flex>
            {assignFailure ? <Alert type="error" showIcon title={assignFailure} /> : null}
          </Flex>
        ) : null}
      </Flex>

      <Flex vertical gap={8}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('memory.account.history')}
        </Typography.Title>
        <div data-testid="assignment-history">
          <Table<EmbeddingAssignment>
            rowKey={(row) => `${row.modelName}|${row.assignedAt}`}
            dataSource={history}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            columns={[
              { title: t('memory.account.col.model'), dataIndex: 'modelName' },
              {
                title: t('memory.account.col.assignedBy'),
                render: (_, row) => row.assignedByUsername ?? row.assignedBy.slice(0, 8),
              },
              {
                title: t('memory.account.col.assignedAt'),
                dataIndex: 'assignedAt',
                render: (at: string) => formatInstant(at, intl.locale),
              },
            ]}
          />
        </div>
      </Flex>
    </Flex>
  );
}
