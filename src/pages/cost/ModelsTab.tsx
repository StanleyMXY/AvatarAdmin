import { useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Flex,
  Input,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { type Kept, useKeptState } from '../../hooks/useKeptState';
import { useLatestRead } from '../../hooks/useLatestRead';
import {
  listUsageModels,
  loadAllPages,
  RESOURCE_TYPES,
  SYNC_ADAPTERS,
  type UsageModel,
  updateUsageModel,
} from '../../services/cost';
import { countCodePoints } from '../../utils/codePoints';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { ActionModal } from './ActionModal';
import { labelOf } from './labels';
import { WrapText } from './WrapText';

type Access = { canAccess: (code?: string) => boolean };
const NONE = '';

/** The registration of one model: the sync adapter (LLM only) and the model name the sync reads. */
function EditModel({
  model,
  onClose,
  onSaved,
}: {
  model: UsageModel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const isLlm = model.resourceType === 'LLM';
  const [adapter, setAdapter] = useState<string>(model.syncAdapter ?? NONE);
  const [name, setName] = useState(plainText(model.syncModelId) || plainText(model.model));
  const [attempted, setAttempted] = useState(false);
  const length = countCodePoints(trimSpec(name));
  const nameProblem = length < 1 || length > 128;

  return (
    <ActionModal
      open
      title={t('cost.models.editTitle', {
        model:
          plainText(model.model).length > 60
            ? `${[...plainText(model.model)].slice(0, 60).join('')}…`
            : plainText(model.model),
      })}
      okText={t('cost.models.save')}
      onClose={onClose}
      onSubmit={async () => {
        if (nameProblem) {
          setAttempted(true);
          return;
        }
        await updateUsageModel(model.id, {
          syncAdapter: adapter === NONE ? null : adapter,
          syncModelId: trimSpec(name),
        });
        message.success(t('cost.models.saved'));
        onSaved();
      }}
    >
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">{t('cost.models.editHint')}</Typography.Text>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.models.adapter')}</Typography.Text>
          <Select
            aria-label={t('cost.models.adapter')}
            disabled={!isLlm}
            value={adapter}
            onChange={setAdapter}
            options={[
              { value: NONE, label: t('cost.models.adapterEmpty') },
              ...SYNC_ADAPTERS.map((a) => ({ value: a as string, label: a as string })),
            ]}
          />
          {!isLlm ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('cost.models.adapterLlmOnly')}
            </Typography.Text>
          ) : null}
        </Flex>
        <Flex vertical gap={4}>
          <Typography.Text>{t('cost.models.syncModelId')}</Typography.Text>
          <Input
            aria-label={t('cost.models.syncModelId')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {attempted && nameProblem ? (
            <Typography.Text type="danger">{t('cost.models.syncModelIdInvalid')}</Typography.Text>
          ) : null}
        </Flex>
      </Flex>
    </ActionModal>
  );
}

/**
 * 模型: the models that have reported usage, with whether a price is in force (a model without one is
 * red and can be filtered), the sync adapter and the model name the sync reads. The registration is
 * edited with `COST:PRICE`; the adapter can only be set for an LLM model.
 */
export function ModelsTab({
  onlyUnpricedInitially,
  kept,
}: {
  onlyUnpricedInitially: boolean;
  /**
   * The filters are kept here for when the tab is opened again (the tab is drawn again each time).
   * Without a box the tab keeps nothing beyond its own life.
   */
  kept?: Kept;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { token } = theme.useToken();
  const access = useAccess() as unknown as Access;
  const canPrice = access.canAccess('COST:PRICE');
  const fetcher = useCallback(() => loadAllPages(listUsageModels), []);
  const { data, failure, reload } = useLatestRead(fetcher);
  const ownBox = useRef<Kept['current']>({}) as Kept;
  const box = kept ?? ownBox;
  const [onlyUnpriced, setOnlyUnpriced] = useKeptState(
    box,
    'models.onlyUnpriced',
    onlyUnpricedInitially,
  );
  const [type, setType] = useKeptState<string | undefined>(box, 'models.type', undefined);
  const [editing, setEditing] = useState<UsageModel | null>(null);

  const rows = useMemo(
    () =>
      (data?.items ?? []).filter(
        (m) => (!onlyUnpriced || m.hasActivePrice !== true) && (!type || m.resourceType === type),
      ),
    [data, onlyUnpriced, type],
  );

  const columns: ColumnsType<UsageModel> = [
    {
      key: 'type',
      title: t('cost.models.col.resourceType'),
      render: (_, m) => labelOf(intl, 'cost.resourceType', m.resourceType),
    },
    {
      key: 'provider',
      title: t('cost.models.col.provider'),
      render: (_, m) => <WrapText value={m.provider} lines={2} style={{ maxWidth: 220 }} />,
    },
    {
      key: 'model',
      title: t('cost.models.col.model'),
      render: (_, m) => (
        <WrapText value={m.model} testId="models-model" lines={3} style={{ maxWidth: 320 }} />
      ),
    },
    {
      key: 'price',
      title: t('cost.models.col.hasPrice'),
      render: (_, m) =>
        m.hasActivePrice === true ? (
          <Tag color="green">{t('cost.models.hasPrice.yes')}</Tag>
        ) : (
          <Tag color="red">{t('cost.models.hasPrice.no')}</Tag>
        ),
    },
    {
      key: 'adapter',
      title: t('cost.models.col.syncAdapter'),
      render: (_, m) =>
        m.syncAdapter ? (
          <WrapText value={m.syncAdapter} />
        ) : (
          <Typography.Text type="secondary">{t('cost.models.byHand')}</Typography.Text>
        ),
    },
    {
      key: 'syncModel',
      title: t('cost.models.col.syncModelId'),
      render: (_, m) => <WrapText value={m.syncModelId} lines={2} style={{ maxWidth: 220 }} />,
    },
    {
      key: 'first',
      title: t('cost.models.col.firstSeen'),
      render: (_, m) => (m.firstSeenAt ? formatInstant(m.firstSeenAt, intl.locale) : DASH),
    },
    {
      key: 'last',
      title: t('cost.models.col.lastSeen'),
      render: (_, m) => (m.lastSeenAt ? formatInstant(m.lastSeenAt, intl.locale) : DASH),
    },
    ...(canPrice
      ? [
          {
            ...ACTIONS_COLUMN,
            key: 'actions',
            title: t('cost.common.actions'),
            render: (_: unknown, m: UsageModel) => (
              <Button size="small" onClick={() => setEditing(m)}>
                {t('cost.models.edit')}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">{t('cost.models.note')}</Typography.Text>
      <Flex gap={16} wrap align="center">
        <Checkbox checked={onlyUnpriced} onChange={(e) => setOnlyUnpriced(e.target.checked)}>
          {t('cost.models.onlyUnpriced')}
        </Checkbox>
        <Select
          aria-label={t('cost.models.filterType')}
          placeholder={t('cost.models.filterType')}
          allowClear
          style={{ minWidth: 200 }}
          value={type}
          onChange={setType}
          options={RESOURCE_TYPES.map((r) => ({
            value: r,
            label: labelOf(intl, 'cost.resourceType', r),
          }))}
        />
      </Flex>
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={reload}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {data === null && !failure ? <Spin /> : null}
      {data && !data.complete ? (
        <Alert
          type="warning"
          showIcon
          title={t('cost.common.truncated', { shown: data.items.length, total: data.total })}
        />
      ) : null}
      {data ? (
        <Table<UsageModel>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('cost.models.empty') }}
          onRow={(m) =>
            ({
              'data-unpriced': m.hasActivePrice === true ? 'false' : 'true',
              style: m.hasActivePrice === true ? undefined : { background: token.colorErrorBg },
            }) as React.HTMLAttributes<HTMLElement>
          }
        />
      ) : null}
      {editing ? (
        <EditModel
          key={editing.id}
          model={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </Flex>
  );
}
