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
  Switch,
  Table,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type EntitlementDef,
  type FeatureGate,
  listEntitlementDefs,
  listFeatureGates,
  listSubscriptionProducts,
  type SubscriptionProduct,
  saveSubscriptionProduct,
} from '../../services/subscriptions';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { FailureAlert } from './FailureAlert';
import { valuesOf } from './featureRules';
import { QuotaWarnings } from './QuotaWarnings';

// Contract 15.3: the stores are Apple and Google today; the list of stores can grow, so a store
// that is not one of these is still shown as it is.
const STORES = ['APPLE', 'GOOGLE'];

const keyOf = (p: SubscriptionProduct) => `${p.store}|${p.productId}`;

type Loaded = {
  products: SubscriptionProduct[];
  defs: EntitlementDef[];
  gates: FeatureGate[];
};

type ProductForm = {
  store: string | null;
  productId: string;
  entitlementKey: string | null;
  enabled: boolean;
  sortOrder: number | null;
};

/** The dialog that adds a mapping, or changes the entitlement, the sale switch and the sort order of one. */
function ProductDialog({
  product,
  loaded,
  onClose,
  onSaved,
}: {
  product: SubscriptionProduct | null;
  loaded: Loaded;
  onClose: () => void;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<ProductForm>();
  const [failure, setFailure] = useState<unknown>(null);
  const chosen = Form.useWatch('entitlementKey', form);
  const def = loaded.defs.find((d) => d.key === chosen);

  const required = async (_: unknown, value: unknown) => {
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && countCodePoints(trimSpec(value)) === 0);
    if (empty) throw new Error(t('reason.EMPTY_NOT_ALLOWED'));
  };

  const { run, pending } = useSingleFlight(async (values: ProductForm) => {
    setFailure(null);
    const store = values.store as string;
    const productId = trimSpec(values.productId);
    if (
      product === null &&
      loaded.products.some((p) => p.store === store && p.productId === productId)
    ) {
      form.setFields([{ name: 'productId', errors: [t('subscriptions.products.exists')] }]);
      return;
    }
    try {
      await saveSubscriptionProduct({
        store,
        productId,
        entitlementKey: values.entitlementKey as string,
        enabled: values.enabled,
        sortOrder: values.sortOrder as number,
        // the surfaces are not edited here: a mapping that has some keeps them
        surfaces: product?.surfaces ?? [],
      });
    } catch (error) {
      const { fields } = describeFailure(intl, error);
      const known = fields.filter((f) =>
        ['store', 'productId', 'entitlementKey', 'enabled', 'sortOrder'].includes(f.ref),
      );
      if (known.length > 0)
        form.setFields(known.map((f) => ({ name: f.ref as keyof ProductForm, errors: [f.text] })));
      else setFailure(error);
      return;
    }
    message.success(t('subscriptions.saved'));
    onSaved();
  });

  return (
    <Modal
      open
      destroyOnHidden
      title={t(product ? 'subscriptions.products.editTitle' : 'subscriptions.products.newTitle')}
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
          store: product?.store ?? null,
          productId: product?.productId ?? '',
          entitlementKey: product?.entitlementKey ?? null,
          enabled: product?.enabled ?? true,
          sortOrder: product?.sortOrder ?? null,
        }}
        onFinish={(values) => run(values)}
      >
        <Form.Item
          name="store"
          label={t('subscriptions.products.store')}
          rules={[{ validator: required }]}
        >
          <Select
            disabled={product !== null}
            options={[
              ...STORES.map((store) => ({ value: store, label: store, title: store })),
              ...(product && !STORES.includes(product.store)
                ? [{ value: product.store, label: product.store, title: product.store }]
                : []),
            ]}
          />
        </Form.Item>
        <Form.Item
          name="productId"
          label={t('subscriptions.products.productId')}
          extra={t('subscriptions.products.productIdHint')}
          rules={[{ validator: required }]}
        >
          <Input disabled={product !== null} dir="auto" />
        </Form.Item>
        <Form.Item
          name="entitlementKey"
          label={t('subscriptions.products.entitlement')}
          rules={[{ validator: required }]}
        >
          <Select
            showSearch={{ optionFilterProp: 'title' }}
            options={[
              ...loaded.defs.map((d) => {
                const label = `${d.name} (${d.key})`;
                return { value: d.key, label, title: label };
              }),
              ...(product && !loaded.defs.some((d) => d.key === product.entitlementKey)
                ? [
                    {
                      value: product.entitlementKey,
                      label: product.entitlementKey,
                      title: product.entitlementKey,
                    },
                  ]
                : []),
            ]}
          />
        </Form.Item>
        <Form.Item
          name="enabled"
          label={t('subscriptions.products.enabled')}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="sortOrder"
          label={t('subscriptions.products.sortOrder')}
          rules={[{ validator: required }]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        {def ? <QuotaWarnings values={valuesOf(def)} gates={loaded.gates} /> : null}
        {failure ? <FailureAlert error={failure} /> : null}
      </Form>
    </Modal>
  );
}

/** The sale switch of one mapping: it saves the mapping at once; a refusal leaves it as it was. */
function EnabledSwitch({
  product,
  canConfig,
  onSaved,
}: {
  product: SubscriptionProduct;
  canConfig: boolean;
  onSaved: () => void;
}) {
  const intl = useIntl();
  const { message } = App.useApp();
  const { run, pending } = useSingleFlight(async (enabled: boolean) => {
    try {
      await saveSubscriptionProduct({ ...product, enabled });
    } catch (error) {
      message.error(describeFailure(intl, error).text);
      return;
    }
    onSaved();
  });
  return (
    <Switch
      aria-label={intl.formatMessage(
        { id: 'subscriptions.products.enabledOf' },
        { productId: product.productId },
      )}
      checked={product.enabled}
      loading={pending}
      disabled={!canConfig}
      onChange={(enabled) => void run(enabled)}
    />
  );
}

/** 商品映射: which entitlement each store product gives, and whether the product is on sale. */
export default function ProductsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ product: SubscriptionProduct | null } | null>(null);
  const canConfig = access.canAccess('SUBSCRIPTION:CONFIG');

  const load = useCallback(async () => {
    try {
      const [products, defs, gates] = await Promise.all([
        listSubscriptionProducts(),
        listEntitlementDefs(),
        listFeatureGates(),
      ]);
      setLoaded({ products: products.items, defs: defs.items, gates: gates.items });
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
  if (!loaded) return <Spin />;

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Typography.Text type="secondary">{t('subscriptions.products.intro')}</Typography.Text>
        <Can code="SUBSCRIPTION:CONFIG">
          <Button type="primary" onClick={() => setDialog({ product: null })}>
            {t('subscriptions.products.new')}
          </Button>
        </Can>
      </Flex>
      <Table<SubscriptionProduct>
        rowKey={keyOf}
        size="small"
        pagination={false}
        dataSource={loaded.products}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: t('subscriptions.products.store'), dataIndex: 'store' },
          {
            title: t('subscriptions.products.productId'),
            dataIndex: 'productId',
            render: (productId: string) => (
              <EllipsisPopoverText text={productId} lines={1} width={260} />
            ),
          },
          {
            title: t('subscriptions.products.entitlement'),
            dataIndex: 'entitlementKey',
            render: (key: string) => {
              const def = loaded.defs.find((d) => d.key === key);
              return (
                <Flex vertical gap={2}>
                  {def ? <EllipsisPopoverText text={def.name} lines={1} width={240} /> : null}
                  <Typography.Text code>{key}</Typography.Text>
                </Flex>
              );
            },
          },
          {
            title: t('subscriptions.products.enabled'),
            render: (_, product) => (
              <EnabledSwitch product={product} canConfig={canConfig} onSaved={() => void load()} />
            ),
          },
          { title: t('subscriptions.products.sortOrder'), dataIndex: 'sortOrder' },
          {
            title: t('subscriptions.list.actions'),
            render: (_, product) =>
              canConfig ? (
                <Button type="link" size="small" onClick={() => setDialog({ product })}>
                  {t('subscriptions.products.edit')}
                </Button>
              ) : null,
          },
        ]}
      />
      {dialog ? (
        <ProductDialog
          product={dialog.product}
          loaded={loaded}
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
