import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Form, Input, Modal, Select } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import { type CosmeticItem, grantCosmetic, listAllCosmetics } from '../../services/avatar';
import { describeFailure } from '../../session/describe';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';
import { pickText } from './localized';
import { codeText } from './texts';

const REASON_MAX = 500;

type Props = {
  accountId: string;
  open: boolean;
  /** Items the account owns already: they are in the list but cannot be chosen. */
  ownedItemIds?: readonly string[];
  onClose: () => void;
  onGranted: () => void;
};

type Values = { itemId: string | undefined; reason: string };

/**
 * Give an account a cosmetic for good. The items come from `GET /cosmetics`, which the backend
 * opens to `COSMETIC:GRANT`; if it still answers 403 the choice is disabled and says which
 * permission lists the items. A reason is required.
 */
export function GrantCosmeticModal({
  accountId,
  open,
  ownedItemIds = [],
  onClose,
  onGranted,
}: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [items, setItems] = useState<CosmeticItem[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailure(null);
    setForbidden(false);
    try {
      setItems(await listAllCosmetics());
    } catch (error) {
      if (error instanceof ApiError && error.httpStatus === 403) setForbidden(true);
      else setLoadFailure(describeFailure(intl, error).text);
    }
  }, [intl]);

  // The catalog is read again each time the dialog opens: the addresses and the list change.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    try {
      await grantCosmetic(accountId, {
        itemId: values.itemId as string,
        reason: trimSpec(values.reason),
      });
    } catch (error) {
      setFailure(failureToForm(intl, form, error, ['itemId', 'reason']).text);
      return;
    }
    message.success(t('avatar.grant.done'));
    onGranted();
    onClose();
  });

  const options = (items ?? []).map((item) => ({
    value: item.id,
    disabled: ownedItemIds.includes(item.id),
    label: `${pickText(item.names, intl.locale) ?? item.key} · ${item.key} · ${codeText(intl, 'avatar.cosmetics.kind', item.kind)}${item.enabled ? '' : ` · ${t('avatar.cosmetics.offShelf')}`}`,
  }));

  return (
    <Modal
      open={open}
      title={t('avatar.grant.title')}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || forbidden }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="grantCosmetic"
        layout="vertical"
        requiredMark={false}
        initialValues={{ itemId: undefined, reason: '' }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {forbidden ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={t('avatar.grant.forbidden')}
          />
        ) : null}
        {loadFailure ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            title={t('pages.common.loadFailed', { message: loadFailure })}
            action={
              <Button size="small" onClick={() => void load()}>
                {t('pages.common.retry')}
              </Button>
            }
          />
        ) : null}
        <Form.Item
          name="itemId"
          label={t('avatar.grant.item')}
          rules={[{ required: true, message: t('avatar.grant.itemRequired') }]}
        >
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            disabled={forbidden}
            loading={items === null && !forbidden && !loadFailure}
            options={options}
            aria-label={t('avatar.grant.item')}
          />
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('avatar.grant.reason')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const length = countCodePoints(trimSpec(value ?? ''));
                if (length === 0) throw new Error(t('pages.common.reasonRequired'));
                if (length > REASON_MAX) {
                  throw new Error(t('pages.common.reasonLength', { min: 1, max: REASON_MAX }));
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={3} dir="auto" />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}

type ButtonProps = Omit<Props, 'open' | 'onClose'> & { disabled?: boolean };

/** The "give a cosmetic" button of the user detail page: shown only to `COSMETIC:GRANT`, and it opens the dialog above. */
export function GrantCosmeticButton({ disabled, ...rest }: ButtonProps) {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const [open, setOpen] = useState(false);
  if (!access.canAccess('COSMETIC:GRANT')) return null;
  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        {intl.formatMessage({ id: 'avatar.grant.button' })}
      </Button>
      <GrantCosmeticModal {...rest} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
