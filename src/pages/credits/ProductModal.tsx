import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useFailure } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  CREDIT_STORES,
  type CreditProduct,
  createCreditProduct,
  updateCreditProduct,
} from '../../services/credits';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { assertPackUnchanged, PackChangedError } from './freshPack';

type Values = {
  store: string;
  productId: string;
  credits: number | null;
  sortOrder: number | null;
  enabled: boolean;
};

type Props = {
  open: boolean;
  /** The pack being edited; none means a new pack. */
  pack: CreditProduct | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['store', 'productId', 'credits', 'sortOrder', 'enabled'] as const;

/** New or edit credit pack. The store and the product id identify a pack: they are fixed once it exists. */
export function ProductModal({ open, pack, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const { text: failure, fail, clear } = useFailure();
  const editing = pack !== null;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    clear();
    try {
      if (pack) {
        await assertPackUnchanged(pack);
        await updateCreditProduct(pack.id, {
          credits: values.credits as number,
          enabled: values.enabled,
          sortOrder: values.sortOrder as number,
          // The surfaces are not edited here; they go back as they came so that a save cannot clear them.
          ...(pack.surfaces ? { surfaces: pack.surfaces } : {}),
        });
      } else {
        await createCreditProduct({
          store: values.store,
          productId: trimSpec(values.productId),
          credits: values.credits as number,
          enabled: values.enabled,
          sortOrder: values.sortOrder as number,
        });
      }
    } catch (error) {
      if (error instanceof PackChangedError) {
        // Nothing was sent: the list is read again and the dialog closes, the person looks at the new values.
        message.warning(t('credits.products.changedMeanwhile'));
        onSaved();
        onClose();
        return;
      }
      const { fields } = describeFailure(intl, error);
      const mine = fields.filter((f) => (FIELDS as readonly string[]).includes(f.ref));
      if (mine.length > 0) {
        form.setFields(mine.map((f) => ({ name: f.ref as keyof Values, errors: [f.text] })));
      }
      fail(error);
      return;
    }
    message.success(t('credits.products.saved'));
    onSaved();
    onClose();
  });

  const whole = (min?: number) => async (_: unknown, value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(t('credits.form.deltaWhole'));
    }
    if (min !== undefined && value < min) throw new Error(t('credits.products.creditsPositive'));
  };

  return (
    <Modal
      open={open}
      title={t(editing ? 'credits.products.edit' : 'credits.products.new')}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        clear();
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="creditProduct"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          store: pack?.store ?? undefined,
          productId: pack?.productId ?? '',
          credits: pack?.credits ?? null,
          sortOrder: pack?.sortOrder ?? 0,
          enabled: pack?.enabled ?? false,
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="store"
          label={t('credits.products.store')}
          rules={[{ required: true, message: t('credits.products.storeRequired') }]}
        >
          <Select
            disabled={editing}
            options={[...new Set([...CREDIT_STORES, ...(pack ? [pack.store] : [])])].map(
              (store) => ({ value: store, label: store }),
            )}
          />
        </Form.Item>
        <Form.Item
          name="productId"
          label={t('credits.products.productId')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                // The length limit is the backend's: it answers a too long id on this field.
                if (countCodePoints(trimSpec(value ?? '')) === 0) {
                  throw new Error(t('credits.products.productIdRequired'));
                }
              },
            },
          ]}
        >
          <Input disabled={editing} />
        </Form.Item>
        <Form.Item
          name="credits"
          label={t('credits.products.credits')}
          rules={[{ validator: whole(1) }]}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        <Form.Item
          name="sortOrder"
          label={t('credits.products.sortOrder')}
          rules={[{ validator: whole() }]}
          extra={t('credits.products.sortOrderHint')}
        >
          <InputNumber style={{ width: '100%' }} step={1} />
        </Form.Item>
        <Form.Item name="enabled" label={t('credits.products.enabled')} valuePropName="checked">
          <Switch />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}
