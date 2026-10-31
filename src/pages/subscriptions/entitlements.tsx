import { useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import {
  createEntitlementDef,
  type EntitlementDef,
  type FeatureGate,
  type FeatureValue,
  listEntitlementDefs,
  listFeatureGates,
  saveEntitlementFeatures,
  updateEntitlementDef,
} from '../../services/subscriptions';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { FailureAlert } from './FailureAlert';
import { FeatureValueEditor } from './FeatureValueEditor';
import {
  allowUnlimitedFor,
  hiddenInEntitlement,
  sameValue,
  valueProblem,
  valuesOf,
} from './featureRules';
import { QuotaWarnings } from './QuotaWarnings';

/** The feature values of one entitlement, in a drawer: one row for each switch, three states each. */
function FeaturesDrawer({
  def,
  gates,
  canConfig,
  onClose,
  onSaved,
}: {
  def: EntitlementDef;
  gates: FeatureGate[];
  canConfig: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const initial = valuesOf(def);
  const [draft, setDraft] = useState<Record<string, FeatureValue>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);

  const rows = def.features
    .map((f) => gates.find((g) => g.key === f.featureKey))
    .filter((g): g is FeatureGate => g !== undefined && !hiddenInEntitlement(g.key));

  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    const changed = rows.filter((g) => !sameValue(draft[g.key], initial[g.key]));
    const found: Record<string, string> = {};
    for (const g of changed) {
      const value = draft[g.key];
      const problem = value?.mode === 'VALUE' ? valueProblem(g.kind, value.value) : null;
      if (problem) found[g.key] = t(`reason.${problem}`);
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (changed.length === 0) {
      message.info(t('subscriptions.nothingChanged'));
      return;
    }
    try {
      await saveEntitlementFeatures(
        def.key,
        changed.map((g) => ({ featureKey: g.key, value: draft[g.key] ?? { mode: 'UNSET' } })),
      );
    } catch (error) {
      const { fields } = describeFailure(intl, error);
      setErrors(Object.fromEntries(fields.map((f) => [f.ref, f.text])));
      setFailure(error);
      return;
    }
    message.success(t('subscriptions.saved'));
    onSaved();
  });

  return (
    <Drawer
      open
      size={760}
      destroyOnHidden
      onClose={onClose}
      title={t('subscriptions.entitlements.featuresTitle', { name: def.name })}
      footer={
        <Can code="SUBSCRIPTION:CONFIG">
          <Button type="primary" loading={pending} disabled={pending} onClick={() => void run()}>
            {t('subscriptions.save')}
          </Button>
        </Can>
      }
    >
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">
          {t('subscriptions.entitlements.featuresHint')}
        </Typography.Text>
        <QuotaWarnings values={draft} gates={gates} />
        {failure ? <FailureAlert error={failure} /> : null}
        {rows.map((gate) => (
          <div
            key={gate.key}
            data-testid={`feature-row-${gate.key}`}
            style={{ borderBottom: '1px solid var(--ant-color-split, #f0f0f0)', paddingBottom: 8 }}
          >
            <Flex gap={8} align="center" wrap>
              <Typography.Text code>{gate.key}</Typography.Text>
              <Tag>{t(`subscriptions.kind.${gate.kind}`)}</Tag>
            </Flex>
            <FeatureValueEditor
              type={gate.kind}
              value={draft[gate.key] ?? { mode: 'UNSET' }}
              allowUnset
              allowUnlimited={allowUnlimitedFor(gate)}
              disabled={!canConfig || pending}
              label={gate.key}
              onChange={(next) => {
                setDraft((previous) => ({ ...previous, [gate.key]: next }));
                setErrors((previous) => {
                  const { [gate.key]: _gone, ...rest } = previous;
                  return rest;
                });
              }}
            />
            {errors[gate.key] ? (
              <Typography.Text type="danger">{errors[gate.key]}</Typography.Text>
            ) : null}
          </div>
        ))}
      </Flex>
    </Drawer>
  );
}

type DefForm = { key: string; name: string; priority: number | null };

/** The dialog that creates an entitlement, or changes the name and the priority of one (the key stays). */
function DefDialog({
  def,
  onClose,
  onSaved,
}: {
  def: EntitlementDef | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<DefForm>();
  const [failure, setFailure] = useState<unknown>(null);

  const required = async (_: unknown, value: unknown) => {
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && countCodePoints(trimSpec(value)) === 0);
    if (empty) throw new Error(t('reason.EMPTY_NOT_ALLOWED'));
  };

  const { run, pending } = useSingleFlight(async (values: DefForm) => {
    setFailure(null);
    const input = { name: trimSpec(values.name), priority: values.priority as number };
    try {
      if (def) await updateEntitlementDef(def.key, input);
      else await createEntitlementDef({ key: trimSpec(values.key), ...input });
    } catch (error) {
      const { fields } = describeFailure(intl, error);
      const duplicate =
        error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE'
          ? (error.data as { field?: unknown } | null)?.field
          : undefined;
      if (typeof duplicate === 'string') {
        form.setFields([
          { name: duplicate as keyof DefForm, errors: [t('error.DUPLICATE_RESOURCE')] },
        ]);
      } else if (fields.length > 0) {
        form.setFields(fields.map((f) => ({ name: f.ref as keyof DefForm, errors: [f.text] })));
      } else {
        setFailure(error);
      }
      return;
    }
    message.success(t('subscriptions.saved'));
    onSaved();
  });

  return (
    <Modal
      open
      destroyOnHidden
      title={t(
        def ? 'subscriptions.entitlements.editTitle' : 'subscriptions.entitlements.newTitle',
      )}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('subscriptions.save')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          key: def?.key ?? '',
          name: def?.name ?? '',
          priority: def?.priority ?? null,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="key"
          label={t('subscriptions.entitlements.key')}
          rules={[{ validator: required }]}
        >
          <Input disabled={def !== null} dir="auto" />
        </Form.Item>
        <Form.Item
          name="name"
          label={t('subscriptions.entitlements.name')}
          rules={[{ validator: required }]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="priority"
          label={t('subscriptions.entitlements.priority')}
          extra={t('subscriptions.entitlements.priorityHint')}
          rules={[{ validator: required }]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        {failure ? <FailureAlert error={failure} /> : null}
      </Form>
    </Modal>
  );
}

/** 权益定义与功能值: the entitlements by priority, and the feature value editor of each. */
export default function EntitlementsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [defs, setDefs] = useState<EntitlementDef[] | null>(null);
  const [gates, setGates] = useState<FeatureGate[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [features, setFeatures] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ def: EntitlementDef | null } | null>(null);
  const canConfig = access.canAccess('SUBSCRIPTION:CONFIG');

  const load = useCallback(async () => {
    try {
      const [defList, gateList] = await Promise.all([listEntitlementDefs(), listFeatureGates()]);
      setDefs(defList.items);
      setGates(gateList.items);
      setFailure(null);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
    }
  }, [intl]);

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
  if (!defs || !gates) return <Spin />;

  const current = defs.find((d) => d.key === features);

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Typography.Text type="secondary">{t('subscriptions.entitlements.intro')}</Typography.Text>
        <Can code="SUBSCRIPTION:CONFIG">
          <Button type="primary" onClick={() => setDialog({ def: null })}>
            {t('subscriptions.entitlements.new')}
          </Button>
        </Can>
      </Flex>
      <Table<EntitlementDef>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={defs}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: t('subscriptions.entitlements.key'),
            dataIndex: 'key',
            render: (key: string) => <Typography.Text code>{key}</Typography.Text>,
          },
          {
            title: t('subscriptions.entitlements.name'),
            dataIndex: 'name',
            render: (name: string) => <EllipsisPopoverText text={name} lines={2} width={280} />,
          },
          { title: t('subscriptions.entitlements.priority'), dataIndex: 'priority' },
          {
            title: t('subscriptions.list.actions'),
            render: (_, def) => (
              <Space size={0}>
                <Button type="link" size="small" onClick={() => setFeatures(def.key)}>
                  {t('subscriptions.entitlements.featureValues')}
                </Button>
                {canConfig ? (
                  <Button type="link" size="small" onClick={() => setDialog({ def })}>
                    {t('subscriptions.entitlements.edit')}
                  </Button>
                ) : null}
              </Space>
            ),
          },
        ]}
      />
      {current ? (
        <FeaturesDrawer
          key={current.key}
          def={current}
          gates={gates}
          canConfig={canConfig}
          onClose={() => setFeatures(null)}
          onSaved={() => {
            setFeatures(null);
            void load();
          }}
        />
      ) : null}
      {dialog ? (
        <DefDialog
          def={dialog.def}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void load();
          }}
        />
      ) : null}
    </Flex>
  );
}
