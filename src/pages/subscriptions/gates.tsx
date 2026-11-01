import { useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useLatestCall } from '../../hooks/useLatestCall';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type FeatureGate,
  type FeatureValue,
  listFeatureGates,
  saveGateCreditCost,
  saveGateDefault,
} from '../../services/subscriptions';
import { describeFailure } from '../../session/describe';
import { failureLine } from '../../session/failureLine';
import { ConfigForm } from '../config/ConfigForm';
import { FailureAlert } from './FailureAlert';
import { FeatureValueEditor } from './FeatureValueEditor';
import { FeatureValueText } from './FeatureValueText';
import {
  allowUnlimitedFor,
  allowUnsetForDefault,
  creditCostEditable,
  LIFETIME_KEY,
  quotaBanners,
  valueProblem,
} from './featureRules';

const defaultValueOf = (gate: FeatureGate): FeatureValue =>
  gate.defaultMode === 'VALUE'
    ? { mode: 'VALUE', value: gate.defaultValue }
    : { mode: gate.defaultMode };

/** The dialog that changes the default value of one switch (what a user without an entitlement gets). */
function DefaultDialog({
  gate,
  onClose,
  onSaved,
}: {
  gate: FeatureGate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [value, setValue] = useState<FeatureValue>(defaultValueOf(gate));
  const [failure, setFailure] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    const found = value.mode === 'VALUE' ? valueProblem(gate.kind, value.value) : null;
    setProblem(found);
    if (found) return;
    try {
      await saveGateDefault(gate.key, value);
    } catch (error) {
      setFailure(error);
      return;
    }
    message.success(t('subscriptions.saved'));
    onSaved();
  });

  return (
    <Modal
      open
      destroyOnHidden
      title={t('subscriptions.gates.defaultTitle', { key: gate.key })}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('subscriptions.save')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => void run()}
    >
      <Flex vertical gap={12}>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {t('subscriptions.gates.defaultHint')}
        </Typography.Paragraph>
        <FeatureValueEditor
          type={gate.kind}
          value={value}
          allowUnset={allowUnsetForDefault(gate.key)}
          allowUnlimited={allowUnlimitedFor(gate)}
          label={gate.key}
          onChange={(next) => {
            setValue(next);
            setProblem(null);
          }}
        />
        {problem ? <Typography.Text type="danger">{t(`reason.${problem}`)}</Typography.Text> : null}
        {failure ? <FailureAlert error={failure} /> : null}
      </Flex>
    </Modal>
  );
}

/** The credit price of one switch: an input that can be changed only where a price makes sense. */
function CreditCostCell({
  gate,
  canEdit,
  onSaved,
}: {
  gate: FeatureGate;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const editable = canEdit && creditCostEditable(gate);
  const [draft, setDraft] = useState<number | null>(gate.creditCost);
  useEffect(() => setDraft(gate.creditCost), [gate.creditCost]);
  const changed = draft !== gate.creditCost;

  const { run, pending } = useSingleFlight(async () => {
    try {
      await saveGateCreditCost(gate.key, draft);
    } catch (error) {
      message.error(failureLine(intl, error));
      return;
    }
    message.success(t('subscriptions.saved'));
    onSaved();
  });

  return (
    <Space size={4}>
      <InputNumber
        aria-label={t('subscriptions.gates.creditCostOf', { key: gate.key })}
        min={0}
        precision={0}
        style={{ width: 110 }}
        placeholder="—"
        disabled={!editable || pending}
        value={draft}
        onChange={(next) => setDraft(next)}
      />
      {editable && changed ? (
        <Button size="small" type="primary" loading={pending} onClick={() => void run()}>
          {t('subscriptions.gates.savePrice')}
        </Button>
      ) : null}
    </Space>
  );
}

/** 功能开关: the switches the code declares, their defaults and credit prices, and the red bars for the quota defaults. */
export default function GatesPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [gates, setGates] = useState<FeatureGate[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState<FeatureGate | null>(null);

  const begin = useLatestCall();

  const load = useCallback(async () => {
    // Only the newest read counts: after two quick changes the first reload may arrive last.
    const isCurrent = begin();
    try {
      const { items } = await listFeatureGates();
      if (!isCurrent()) return;
      setGates(items);
      setFailure(null);
    } catch (error) {
      if (isCurrent()) setFailure(describeFailure(intl, error).text);
    }
  }, [intl, begin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure)
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
  if (!gates) return <Spin />;

  const banners = quotaBanners(gates);

  const table = (canConfig: boolean) => (
    <Table<FeatureGate>
      rowKey="key"
      size="small"
      pagination={false}
      dataSource={gates}
      scroll={{ x: 'max-content' }}
      columns={[
        {
          title: t('subscriptions.gates.key'),
          dataIndex: 'key',
          render: (key: string) => <Typography.Text code>{key}</Typography.Text>,
        },
        {
          title: t('subscriptions.gates.kind'),
          dataIndex: 'kind',
          render: (kind: string) => t(`subscriptions.kind.${kind}`),
        },
        {
          title: t('subscriptions.gates.scope'),
          dataIndex: 'limitScope',
          render: (scope: string | null) => (scope ? t(`subscriptions.scope.${scope}`) : '—'),
        },
        {
          title: t('subscriptions.gates.default'),
          render: (_, gate) => (
            <Space>
              <FeatureValueText
                kind={gate.kind}
                mode={gate.defaultMode}
                value={gate.defaultValue}
              />
              {canConfig ? (
                <Button type="link" size="small" onClick={() => setEditing(gate)}>
                  {t('subscriptions.gates.editDefault')}
                </Button>
              ) : null}
            </Space>
          ),
        },
        {
          title: t('subscriptions.gates.creditCost'),
          render: (_, gate) => (
            <CreditCostCell gate={gate} canEdit={canConfig} onSaved={() => void load()} />
          ),
        },
        {
          title: t('subscriptions.gates.description'),
          render: (_, gate) => (
            <Flex vertical gap={4}>
              <EllipsisPopoverText text={gate.description} lines={2} width={320} />
              {gate.key === LIFETIME_KEY ? (
                <Typography.Text
                  type="secondary"
                  style={{ maxWidth: 360, overflowWrap: 'anywhere' }}
                >
                  {t('subscriptions.gates.lifetimeNote')}
                </Typography.Text>
              ) : null}
            </Flex>
          ),
        },
      ]}
    />
  );

  return (
    <Flex vertical gap={16}>
      {banners.call ? (
        <Alert type="error" showIcon banner title={t('subscriptions.gates.callUnset')} />
      ) : null}
      {banners.chat ? (
        <Alert type="error" showIcon banner title={t('subscriptions.gates.chatUnset')} />
      ) : null}
      <Typography.Text type="secondary">{t('subscriptions.gates.intro')}</Typography.Text>
      <Can code="SUBSCRIPTION:CONFIG" fallback={table(false)}>
        {table(true)}
      </Can>
      {editing ? (
        <DefaultDialog
          gate={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
      <Can code="SUBSCRIPTION:CONFIG">
        <Card size="small" title={t('subscriptions.gates.params')}>
          <ConfigForm editPermission="SUBSCRIPTION:CONFIG" />
        </Card>
      </Can>
    </Flex>
  );
}
