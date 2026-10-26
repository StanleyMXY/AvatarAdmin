import { useIntl } from '@umijs/max';
import { Alert, App, Flex, Form, Input, InputNumber, Modal, Spin, Switch } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { getTier, MEMORY_NAME_PATTERN, saveTier, type TierSettings } from '../../services/memory';
import { describeFailure } from '../../session/describe';
import { trimSpec } from '../../utils/trimSpec';

type Values = Partial<TierSettings> & { tierName?: string };

type Props = {
  open: boolean;
  /** An existing tier to edit (its values are read again when the dialog opens), or none to create one. */
  tierName: string | null;
  /** Names of the tiers there are now, to tell a new name from an old one. */
  existing: string[];
  /** Where a new tier starts: the values of the default tier. */
  starting: TierSettings | null;
  onClose: () => void;
  onSaved: () => void;
};

const FALLBACK: TierSettings = {
  topK: 5,
  recencyChannelEnabled: true,
  recencyChannelCount: 3,
  consolidationEnabled: false,
  consolidationThreshold: 200,
};

const RANGES = {
  topK: [1, 100],
  recencyChannelCount: [0, 100],
  consolidationThreshold: [1, 100000],
} as const;

/**
 * The form of a tier. Saving reaches every account on the tier at once, which the dialog says on
 * top. A name that is not in the list creates a tier that can never be deleted, so it is confirmed
 * first ("a new tier X will be created").
 */
export function TierForm({ open, tierName, existing, starting, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message, modal } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const creating = tierName === null;
  /** The settings of the tier as they were when the dialog opened; only what differs from them is sent. */
  const loaded = useRef<TierSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFailure(null);
    loaded.current = null;
    setReady(false);
    if (creating) {
      form.setFieldsValue({ tierName: '', ...(starting ?? FALLBACK) });
      setReady(true);
      return;
    }
    let live = true;
    setLoading(true);
    form.resetFields();
    getTier(tierName)
      .then(({ tierName: _name, ...settings }) => {
        if (!live) return;
        form.setFieldsValue(settings);
        loaded.current = settings;
        setReady(true);
      })
      .catch((error) => {
        if (live) setFailure(describeFailure(intl, error).text);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [open, tierName, creating, starting, form, intl]);

  const range = (field: keyof typeof RANGES) => {
    const [min, max] = RANGES[field];
    return {
      validator: async (_: unknown, value: unknown) => {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
          throw new Error(t('memory.tier.intInvalid', { min, max }));
        }
      },
    };
  };

  const send = useSingleFlight(
    async (name: string, values: Partial<TierSettings>, isNew: boolean) => {
      setFailure(null);
      try {
        await saveTier(name, values);
      } catch (error) {
        const { text, fields } = describeFailure(intl, error);
        setFailure([text, ...fields.map((f) => `${f.ref}: ${f.text}`)].join(' / '));
        return;
      }
      message.success(t(isNew ? 'memory.tier.created' : 'memory.tier.saved'));
      onSaved();
    },
  );

  const submit = async (values: Values) => {
    const name = creating ? trimSpec(values.tierName ?? '') : (tierName as string);
    const settings: TierSettings = {
      topK: values.topK as number,
      recencyChannelEnabled: Boolean(values.recencyChannelEnabled),
      recencyChannelCount: values.recencyChannelCount as number,
      consolidationEnabled: Boolean(values.consolidationEnabled),
      consolidationThreshold: values.consolidationThreshold as number,
    };
    const isNew = !existing.includes(name);
    if (!isNew && creating) {
      // The new-tier form holds all five settings, so a name that is already taken would silently
      // replace every setting of that tier (and change it for all its accounts): ask first.
      modal.confirm({
        title: t('memory.tier.confirmReplace', { name }),
        okText: t('pages.common.ok'),
        cancelText: t('pages.common.cancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          await send.run(name, settings, false);
        },
      });
      return;
    }
    if (!isNew) {
      // An existing tier is changed with what the person changed and nothing else: the backend keeps
      // the settings that are left out, so another administrator's change to another setting survives.
      const before = loaded.current;
      if (!creating && before) {
        const changed = Object.fromEntries(
          (Object.keys(settings) as (keyof TierSettings)[])
            .filter((key) => settings[key] !== before[key])
            .map((key) => [key, settings[key]]),
        ) as Partial<TierSettings>;
        if (Object.keys(changed).length === 0) {
          message.info(t('memory.tier.nothingChanged'));
          return;
        }
        await send.run(name, changed, false);
        return;
      }
      await send.run(name, settings, false);
      return;
    }
    modal.confirm({
      title: t('memory.tier.confirmCreate', { name }),
      okText: t('pages.common.ok'),
      cancelText: t('pages.common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        await send.run(name, settings, true);
      },
    });
  };

  return (
    <Modal
      open={open}
      title={
        creating ? t('memory.tier.createTitle') : t('memory.tier.editTitle', { name: tierName })
      }
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={send.pending ? undefined : onClose}
      okText={t('memory.tier.save')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: send.pending, disabled: send.pending || loading || !ready }}
      cancelButtonProps={{ disabled: send.pending }}
      onOk={() => form.submit()}
    >
      <Flex vertical gap={12}>
        <Alert type="warning" showIcon title={t('memory.tier.impact')} />
        {creating ? <Alert type="info" showIcon title={t('memory.tier.createNote')} /> : null}
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
            {creating ? (
              <Form.Item
                name="tierName"
                label={t('memory.tier.name')}
                extra={t('memory.tier.nameHelp')}
                rules={[
                  {
                    validator: async (_, value) => {
                      if (!MEMORY_NAME_PATTERN.test(trimSpec(String(value ?? '')))) {
                        throw new Error(t('memory.tier.nameInvalid'));
                      }
                    },
                  },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
            ) : null}
            {creating ? (
              <Alert
                type="info"
                title={t('memory.tier.defaultsFrom')}
                style={{ marginBottom: 12 }}
              />
            ) : null}
            <Form.Item
              name="topK"
              label={t('memory.tier.col.topK')}
              extra={t('memory.tier.topKHelp')}
              rules={[range('topK')]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="recencyChannelEnabled"
              label={t('memory.tier.col.recencyEnabled')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="recencyChannelCount"
              label={t('memory.tier.col.recencyCount')}
              extra={t('memory.tier.recencyCountHelp')}
              rules={[range('recencyChannelCount')]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="consolidationEnabled"
              label={t('memory.tier.col.consolidationEnabled')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="consolidationThreshold"
              label={t('memory.tier.col.consolidationThreshold')}
              extra={t('memory.tier.thresholdHelp')}
              rules={[range('consolidationThreshold')]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Spin>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Flex>
    </Modal>
  );
}
