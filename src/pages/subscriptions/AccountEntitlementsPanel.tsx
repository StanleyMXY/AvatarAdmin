import { useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { RowActions } from '../../components/RowActions';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AccountEntitlement,
  type AccountEntitlements,
  type EffectiveFeature,
  type EntitlementDef,
  getAccountEntitlements,
  grantPromoEntitlement,
  listEntitlementDefs,
  revokePromoEntitlement,
} from '../../services/subscriptions';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { FailureAlert } from './FailureAlert';
import { FeatureValueText } from './FeatureValueText';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  EXPIRED: 'default',
  REVOKED: 'red',
};

type GrantForm = { entitlementKey: string | null; durationDays: number | null; reason: string };

/** The dialog that grants a limited-time entitlement: the entitlement, the days and a reason (1 to 500 characters). */
function GrantDialog({
  accountId,
  onClose,
  onGranted,
}: {
  accountId: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<GrantForm>();
  const [defs, setDefs] = useState<EntitlementDef[] | null>(null);
  const [loadFailure, setLoadFailure] = useState<unknown>(null);
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    listEntitlementDefs().then(
      (answer) => setDefs(answer.items),
      (error) => setLoadFailure(error),
    );
  }, []);

  const required = async (_: unknown, value: unknown) => {
    if (value === null || value === undefined || value === '')
      throw new Error(t('reason.EMPTY_NOT_ALLOWED'));
  };
  const days = async (_: unknown, value: unknown) => {
    await required(_, value);
    if (typeof value !== 'number' || !Number.isInteger(value))
      throw new Error(t('reason.NOT_AN_INTEGER'));
    if (value < 1) throw new Error(t('reason.OUT_OF_RANGE'));
  };
  const reason = async (_: unknown, value: string | undefined) => {
    const length = countCodePoints(trimSpec(value ?? ''));
    if (length === 0) throw new Error(t('pages.common.reasonRequired'));
    if (length > 500) throw new Error(t('pages.common.reasonLength', { min: 1, max: 500 }));
  };

  const { run, pending } = useSingleFlight(async (values: GrantForm) => {
    setFailure(null);
    try {
      await grantPromoEntitlement(accountId, {
        entitlementKey: values.entitlementKey as string,
        durationDays: values.durationDays as number,
        reason: trimSpec(values.reason),
      });
    } catch (error) {
      const { fields } = describeFailure(intl, error);
      const known = fields.filter((f) =>
        ['entitlementKey', 'durationDays', 'reason'].includes(f.ref),
      );
      if (known.length > 0)
        form.setFields(known.map((f) => ({ name: f.ref as keyof GrantForm, errors: [f.text] })));
      else setFailure(error);
      return;
    }
    message.success(t('subscriptions.account.granted'));
    onGranted();
  });

  return (
    <Modal
      open
      destroyOnHidden
      title={t('subscriptions.account.grant')}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ entitlementKey: null, durationDays: null, reason: '' }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="entitlementKey"
          label={t('subscriptions.account.entitlement')}
          rules={[{ validator: required }]}
        >
          <Select
            loading={defs === null && loadFailure === null}
            showSearch={{ optionFilterProp: 'title' }}
            options={(defs ?? []).map((d) => {
              const label = `${d.name} (${d.key})`;
              return { value: d.key, label, title: label };
            })}
          />
        </Form.Item>
        <Form.Item
          name="durationDays"
          label={t('subscriptions.account.days')}
          extra={t('subscriptions.account.daysHint')}
          rules={[{ validator: days }]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('pages.common.reasonLabel')}
          rules={[{ validator: reason }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
        {loadFailure ? <FailureAlert error={loadFailure} /> : null}
        {failure ? <FailureAlert error={failure} /> : null}
      </Form>
    </Modal>
  );
}

/**
 * The entitlements tab of the user detail: the value in force for every switch with where it comes
 * from, and every entitlement row of the account. A limited-time grant that is still active can be
 * revoked, and a new one granted, by an administrator who holds `SUBSCRIPTION:GRANT`.
 */
export function AccountEntitlementsPanel({
  accountId,
  grantDisabled = false,
  revokeDisabled = false,
}: {
  accountId: string;
  /** The account is waiting for deletion or being deleted: the backend refuses a new grant (contract 17.4 state table). */
  grantDisabled?: boolean;
  /** The account is being deleted: the backend refuses even a revoke. */
  revokeDisabled?: boolean;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [data, setData] = useState<AccountEntitlements | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const [granting, setGranting] = useState(false);
  const canGrant = access.canAccess('SUBSCRIPTION:GRANT');
  const when = (iso: string | null) => (iso ? formatInstant(iso, intl.locale) : DASH);

  const begin = useLatestCall();

  const load = useCallback(async () => {
    // Only the newest read counts: an answer for the account shown before must not replace this one.
    const isCurrent = begin();
    try {
      const answer = await getAccountEntitlements(accountId);
      if (!isCurrent()) return;
      setData(answer);
      clear();
    } catch (error) {
      if (isCurrent()) fail(error);
    }
  }, [accountId, begin, fail, clear]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const revoke = (row: AccountEntitlement) => async () => {
    try {
      await revokePromoEntitlement(row.id);
      message.success(t('subscriptions.account.revoked'));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    } finally {
      void load();
    }
  };

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
  if (!data) return <Spin />;

  const nameOf = (key: string | null) =>
    key === null
      ? null
      : (data.entitlements.find((e) => e.entitlementKey === key)?.entitlementName ?? null);

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={5}>{t('subscriptions.account.effective')}</Typography.Title>
        <div data-testid="effective-table">
          <Table<EffectiveFeature>
            size="small"
            rowKey="featureKey"
            pagination={false}
            dataSource={data.effective}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('subscriptions.gates.key'),
                dataIndex: 'featureKey',
                render: (key: string) => <Typography.Text code>{key}</Typography.Text>,
              },
              {
                title: t('subscriptions.account.value'),
                render: (_, row) => (
                  <FeatureValueText kind={row.kind} mode={row.mode} value={row.value} />
                ),
              },
              {
                title: t('subscriptions.account.source'),
                render: (_, row) =>
                  row.source === 'ENTITLEMENT' ? (
                    <Flex vertical gap={2}>
                      <span>{t('subscriptions.source.ENTITLEMENT')}</span>
                      {nameOf(row.entitlementKey) ? (
                        <EllipsisPopoverText
                          text={nameOf(row.entitlementKey)}
                          lines={1}
                          width={220}
                        />
                      ) : null}
                      <Typography.Text code>{row.entitlementKey}</Typography.Text>
                    </Flex>
                  ) : (
                    t(`subscriptions.source.${row.source}`)
                  ),
              },
            ]}
          />
        </div>
      </div>
      <div>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('subscriptions.account.entitlements')}
          </Typography.Title>
          <Can code="SUBSCRIPTION:GRANT">
            <Button type="primary" disabled={grantDisabled} onClick={() => setGranting(true)}>
              {t('subscriptions.account.grant')}
            </Button>
          </Can>
        </Flex>
        <div data-testid="entitlement-table">
          <Table<AccountEntitlement>
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={data.entitlements}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('subscriptions.account.entitlement'),
                render: (_, row) => (
                  <Flex vertical gap={2}>
                    <EllipsisPopoverText text={row.entitlementName} lines={1} width={220} />
                    <Typography.Text code>{row.entitlementKey}</Typography.Text>
                  </Flex>
                ),
              },
              {
                title: t('subscriptions.account.source'),
                dataIndex: 'source',
                render: (source: string) => t(`subscriptions.account.source.${source}`),
              },
              {
                title: t('subscriptions.list.state'),
                dataIndex: 'status',
                render: (status: string) => (
                  <Tag color={STATUS_COLORS[status]}>
                    {t(`subscriptions.account.status.${status}`)}
                  </Tag>
                ),
              },
              {
                title: t('subscriptions.account.startsAt'),
                render: (_, row) => when(row.startsAt),
              },
              {
                title: t('subscriptions.account.expiresAt'),
                render: (_, row) => when(row.expiresAt),
              },
              {
                title: t('subscriptions.account.grantedBy'),
                render: (_, row) =>
                  row.grantedByUsername ?? (row.grantedBy ? row.grantedBy.slice(0, 8) : DASH),
              },
              {
                title: t('pages.common.reasonLabel'),
                render: (_, row) => <EllipsisPopoverText text={row.reason} lines={2} width={240} />,
              },
              {
                title: t('subscriptions.account.subscription'),
                render: (_, row) => row.subscriptionId ?? DASH,
              },
              {
                ...ACTIONS_COLUMN,
                title: t('subscriptions.list.actions'),
                render: (_, row) => (
                  <RowActions
                    actions={
                      canGrant && row.source === 'PROMO' && row.status === 'ACTIVE'
                        ? [
                            {
                              key: 'revoke',
                              label: t('subscriptions.account.revoke'),
                              disabled: revokeDisabled,
                              confirmText: t('subscriptions.account.revokeConfirm'),
                              onClick: revoke(row),
                            },
                          ]
                        : []
                    }
                  />
                ),
              },
            ]}
          />
        </div>
      </div>
      {granting ? (
        <GrantDialog
          accountId={accountId}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            void load();
          }}
        />
      ) : null}
    </Flex>
  );
}
