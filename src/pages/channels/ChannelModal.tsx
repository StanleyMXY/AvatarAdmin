import { useIntl } from '@umijs/max';
import type { FormInstance } from 'antd';
import { Alert, App, Descriptions, Form, Input, Modal, Select } from 'antd';
import { useState } from 'react';
import type { FailureLines } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import { DISTRIBUTIONS, PLATFORMS, type Platform } from '../../services/appVersions';
import {
  type ChannelPackage,
  createChannelPackage,
  updateChannelPackage,
} from '../../services/channelPackages';
import { describeFailure } from '../../session/describe';
import { codeText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { checkChannelCode, checkPackageName, distributionsFor } from './channelRules';

type Values = {
  code: string;
  name: string;
  platform?: Platform;
  distribution?: 'STORE' | 'DIRECT';
  packageName: string;
};

type Props = {
  /** The channel being edited; none means a new channel package. */
  channel: ChannelPackage | null;
  /** The codes the list has, so that a new code that is taken is said before anything is sent. */
  existing: readonly string[];
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['code', 'name', 'platform', 'distribution', 'packageName'] as const;

/** What the backend refused, sorted by where it goes: under a form field or in the bar. */
function splitRefusal(intl: Parameters<typeof describeFailure>[0], error: unknown) {
  const described = describeFailure(intl, error);
  const forForm: { name: string; errors: string[] }[] = [];
  const more: string[] = [];
  for (const detail of described.fields) {
    if ((FIELDS as readonly string[]).includes(detail.ref)) {
      forForm.push({ name: detail.ref, errors: [detail.text] });
    } else more.push(detail.text);
  }
  // A duplicate names the field in `data.field`.
  if (error instanceof ApiError && error.code === 'DUPLICATE_RESOURCE') {
    const field = (error.data as { field?: unknown } | null)?.field;
    if (typeof field === 'string' && (FIELDS as readonly string[]).includes(field)) {
      forForm.push({ name: field, errors: [described.text] });
    }
  }
  return { text: described.text, more, forForm };
}

/**
 * New channel package, or edit one. The code, the platform and the distribution are written once:
 * an edit shows them as text and changes only the name and the package name (the enabled state is
 * the switch of the list; it is sent along unchanged). Mounted by the page only while it is open.
 */
export function ChannelModal({ channel, existing, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  // The save the backend refused, kept as the failure itself: its words are made when drawn.
  const [refusal, setRefusal] = useState<{ error: unknown } | null>(null);
  const failure: FailureLines | null = refusal === null ? null : splitRefusal(intl, refusal.error);
  const editing = channel !== null;
  const platform = Form.useWatch('platform', form);
  const allowed = distributionsFor(platform);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setRefusal(null);
    const name = trimSpec(values.name ?? '');
    const packageName = trimSpec(values.packageName ?? '');
    try {
      if (channel) {
        await updateChannelPackage(channel.code, {
          name,
          packageName: packageName === '' ? null : packageName,
          enabled: channel.enabled,
        });
      } else {
        await createChannelPackage({
          code: trimSpec(values.code),
          name,
          platform: values.platform as Platform,
          distribution: values.distribution as 'STORE' | 'DIRECT',
          packageName: packageName === '' ? null : packageName,
        });
      }
    } catch (error) {
      const { forForm } = splitRefusal(intl, error);
      if (forForm.length > 0) (form as FormInstance).setFields(forForm);
      setRefusal({ error });
      return;
    }
    message.success(
      editing ? t('channels.saved') : t('channels.created', { code: trimSpec(values.code) }),
    );
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      title={channel ? t('channels.editTitle', { code: channel.code }) : t('channels.newTitle')}
      width={560}
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
        name="channelPackage"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          code: '',
          name: plainText(channel?.name),
          platform: undefined,
          distribution: undefined,
          packageName: plainText(channel?.packageName),
        }}
        onValuesChange={(changed) => {
          // A direct download is an Android file: iOS cannot keep it.
          if ('platform' in changed && changed.platform === 'IOS') {
            if (form.getFieldValue('distribution') === 'DIRECT') {
              form.setFieldValue('distribution', undefined);
            }
          }
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {channel ? (
          <Form.Item label={t('channels.field.code')} extra={t('channels.fixedHelp')}>
            <Descriptions
              size="small"
              column={1}
              data-testid="channel-fixed"
              items={[
                {
                  key: 'code',
                  label: t('channels.field.code'),
                  children: <span style={{ overflowWrap: 'anywhere' }}>{channel.code}</span>,
                },
                {
                  key: 'platform',
                  label: t('channels.field.platform'),
                  children: codeText(intl, 'channels.platform', channel.platform) || '—',
                },
                {
                  key: 'distribution',
                  label: t('channels.field.distribution'),
                  children: codeText(intl, 'channels.distribution', channel.distribution) || '—',
                },
              ]}
            />
          </Form.Item>
        ) : (
          <Form.Item
            name="code"
            label={t('channels.field.code')}
            extra={t('channels.codeHelp')}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  const check = checkChannelCode(trimSpec(value ?? ''), existing);
                  if (!check.ok) throw new Error(t(check.reasonKey));
                },
              },
            ]}
          >
            <Input dir="ltr" autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label={t('channels.field.name')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') throw new Error(t('channels.rule.nameRequired'));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        {channel ? null : (
          <>
            <Form.Item
              name="platform"
              label={t('channels.field.platform')}
              extra={t('channels.fixedHelp')}
              rules={[{ required: true, message: t('channels.rule.platformRequired') }]}
            >
              <Select
                aria-label={t('channels.field.platform')}
                options={PLATFORMS.map((p) => ({ value: p, label: t(`channels.platform.${p}`) }))}
              />
            </Form.Item>
            <Form.Item
              name="distribution"
              label={t('channels.field.distribution')}
              extra={
                <>
                  <div>{t('channels.fixedHelp')}</div>
                  {!allowed.DIRECT ? <div>{t('channels.directHelp')}</div> : null}
                </>
              }
              rules={[{ required: true, message: t('channels.rule.distributionRequired') }]}
            >
              <Select
                aria-label={t('channels.field.distribution')}
                options={DISTRIBUTIONS.map((d) => ({
                  value: d,
                  label: t(`channels.distribution.${d}`),
                  disabled: !allowed[d],
                }))}
              />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="packageName"
          label={t('channels.field.packageName')}
          extra={t('channels.packageHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const check = checkPackageName(trimSpec(value ?? ''));
                if (!check.ok) throw new Error(t(check.reasonKey));
              },
            },
          ]}
        >
          <Input dir="ltr" />
        </Form.Item>
        {failure ? (
          <Alert
            type="error"
            showIcon
            title={failure.text}
            description={
              failure.more.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                  {[...new Set(failure.more)].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        ) : null}
      </Form>
    </Modal>
  );
}
