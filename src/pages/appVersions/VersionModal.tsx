import { Link, useAccess, useIntl } from '@umijs/max';
import type { FormInstance } from 'antd';
import {
  Alert,
  App,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import {
  type AppVersion,
  createAppVersion,
  updateAppVersion,
  VERSION_STATUSES,
  type VersionFields,
} from '../../services/appVersions';
import type { ChannelPackage } from '../../services/channelPackages';
import { describeFailure } from '../../session/describe';
import { formatBytes } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { isUploadIdRejection } from '../../utils/uploadErrors';
import { ApkUpload } from './ApkUpload';
import { ChangelogField } from './ChangelogField';
import { distributionOf } from './distribution';
import { FailureBar } from './FailureBar';
import { validateStoreUrl } from './storeUrl';
import { codeText } from './texts';
import { useUploadSlot } from './uploadSlot';
import { useActiveVersion } from './useActiveVersion';
import {
  checkChangelog,
  checkMinVersionCode,
  checkVersionCode,
  checkVersionName,
  cleanChangelog,
  type Texts,
} from './versionRules';

type Values = {
  channelCode?: string;
  versionName: string;
  versionCode: number | null;
  minVersionCode: number | null;
  changelog: Texts;
  storeUrl: string;
};

export type ChannelSource = {
  rows: ChannelPackage[];
  /** The words of the failure to read the channel packages, or null. */
  failure: string | null;
  reload: () => void;
};

type Props = {
  /** The draft being edited; none means a new version. */
  version: AppVersion | null;
  channels: ChannelSource;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'channelCode',
  'versionName',
  'versionCode',
  'minVersionCode',
  'changelog',
  'storeUrl',
  'apkUploadId',
] as const;

/** Notes the draft has, as text for the tabs (a value that is not text is not shown). */
function notesOf(changelog: unknown): Texts {
  if (typeof changelog !== 'object' || changelog === null || Array.isArray(changelog)) return {};
  const result: Texts = {};
  for (const [tag, text] of Object.entries(changelog)) {
    if (typeof text === 'string') result[tag] = text;
  }
  return result;
}

const numberOr = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * The backend refused the upload id: it is already used by another object (409 without a state of a
 * version), it is of another kind or does not fit (400 about `apkUploadId`) or it is not there
 * (404). The form then asks for the file again. A refusal that is about the version itself (its
 * state, other fields) is not this: the file is still good.
 */
function uploadRefused(error: unknown, carriedNewUpload: boolean): boolean {
  if (!(error instanceof ApiError) || !isUploadIdRejection(error)) return false;
  if (error.httpStatus === 400) {
    return error.details.length === 0 || error.details.some((d) => d.ref === 'apkUploadId');
  }
  if (error.httpStatus === 409) {
    const status = (error.data as { status?: unknown } | null)?.status;
    const ofVersion =
      typeof status === 'string' && (VERSION_STATUSES as readonly string[]).includes(status);
    return carriedNewUpload && !ofVersion;
  }
  return carriedNewUpload;
}

/**
 * New version, or edit a draft. The channel package is chosen once and cannot be changed after
 * that. A STORE channel's version has the store link, checked while it is typed; a DIRECT channel's
 * has the APK: it is uploaded first, the form shows the address, size and checksum the server read
 * (text, not inputs) and sends only the `uploadId`. The numbers are compared with the version that
 * is active in the channel as a hint; the backend decides. Mounted by the page only while it is
 * open.
 */
export function VersionModal({ version, channels, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const slot = useUploadSlot<{
    uploadId: string;
    apkUrl: string;
    apkSizeBytes: number;
    apkSha256: string;
  }>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const [rejected, setRejected] = useState(false);
  const [needFile, setNeedFile] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const editing = version !== null;

  const chosen = Form.useWatch('channelCode', form);
  const channelCode = editing ? plainText(version.channelCode) : (chosen ?? '');
  const channel = channels.rows.find((c) => c.code === channelCode);
  const kind: 'STORE' | 'DIRECT' | undefined = channel
    ? channel.distribution === 'DIRECT'
      ? 'DIRECT'
      : 'STORE'
    : editing
      ? distributionOf(version, channels.rows)
      : undefined;
  const platform = channel ? channel.platform : plainText(version?.platform);
  const packageName = channel?.packageName ?? undefined;

  const hint = useActiveVersion(channelCode || undefined);
  const activeCode = hint.state === 'known' ? hint.code : null;
  const activeRef = useRef<number | null>(null);
  activeRef.current = activeCode;
  // The hint arrives after the person typed: look at the number again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the hint is what makes the number worth looking at again
  useEffect(() => {
    if (hint.state !== 'idle' && form.isFieldTouched('versionCode')) {
      void form.validateFields(['versionCode']).catch(() => {});
    }
  }, [hint.state, activeCode, form]);

  const hasFile = editing && !rejected && plainText(version.apkUploadId) !== '';
  const shownFile = slot.upload
    ? slot.upload
    : hasFile
      ? {
          uploadId: plainText(version.apkUploadId),
          apkUrl: plainText(version.apkUrl),
          apkSizeBytes: numberOr(version.apkSizeBytes),
          apkSha256: plainText(version.apkSha256),
        }
      : null;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    setNeedFile(false);
    if (slot.busy) return;
    let apkUploadId: string | undefined;
    if (kind === 'DIRECT') {
      apkUploadId = slot.uploadId ?? (hasFile ? plainText(version?.apkUploadId) : undefined);
      if (!apkUploadId) {
        setNeedFile(true);
        return;
      }
    }
    const fields: VersionFields = {
      versionName: trimSpec(values.versionName ?? ''),
      versionCode: values.versionCode as number,
      minVersionCode: values.minVersionCode as number,
      changelog: cleanChangelog(values.changelog),
      ...(kind === 'STORE' ? { storeUrl: trimSpec(values.storeUrl ?? '') } : {}),
      ...(kind === 'DIRECT' && apkUploadId ? { apkUploadId } : {}),
    };
    try {
      if (editing) await updateAppVersion(plainText(version.id), fields);
      else await createAppVersion({ ...fields, channelCode: values.channelCode as string });
    } catch (error) {
      const described = describeFailure(intl, error);
      const forForm: { name: string; errors: string[] }[] = [];
      const more: string[] = [];
      for (const detail of described.fields) {
        if ((FIELDS as readonly string[]).includes(detail.ref) && detail.ref !== 'apkUploadId') {
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
      if (forForm.length > 0) (form as FormInstance).setFields(forForm);
      if (kind === 'DIRECT' && uploadRefused(error, slot.uploadId !== undefined)) {
        slot.reset();
        setRejected(true);
      }
      setFailure({ text: described.text, more });
      return;
    }
    message.success(t('appVersions.saved'));
    onSaved();
    onClose();
  });

  const channelLabel = (c: ChannelPackage) => {
    const name = plainText(c.name) || c.code;
    return c.enabled
      ? `${name} (${c.code})`
      : t('appVersions.channelOff', { name: `${name} (${c.code})` });
  };

  const versionCodeRules = [
    {
      validator: async (_: unknown, value: unknown) => {
        const check = checkVersionCode(value, activeRef.current);
        if (!check.ok) throw new Error(t(check.reasonKey, check.values));
      },
    },
  ];

  const activeText =
    hint.state === 'known' && hint.code !== null
      ? t('appVersions.activeHint', { code: hint.code })
      : hint.state === 'none'
        ? t('appVersions.activeNone')
        : hint.state === 'failed' || (hint.state === 'known' && hint.code === null)
          ? t('appVersions.activeUnknown')
          : null;

  const storeHelp =
    platform === 'IOS'
      ? t('appVersions.storeUrlHelpIos')
      : t('appVersions.storeUrlHelpAndroid', {
          package: packageName || t('appVersions.storeUrlHelpUnknownPackage'),
        });

  return (
    <Modal
      open
      title={t(editing ? 'appVersions.editTitle' : 'appVersions.newTitle')}
      width={720}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || slot.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="appVersion"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          channelCode: undefined,
          versionName: plainText(version?.versionName),
          versionCode: numberOr(version?.versionCode),
          minVersionCode: numberOr(version?.minVersionCode),
          changelog: notesOf(version?.changelog),
          storeUrl: plainText(version?.storeUrl),
        }}
        onValuesChange={(changed) => {
          // A file or a link of one channel means nothing for another.
          if ('channelCode' in changed) {
            form.setFieldValue('storeUrl', '');
            slot.reset();
            setRejected(false);
            setNeedFile(false);
            setUnavailable(false);
          }
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {editing ? (
          <Form.Item label={t('appVersions.field.channel')} extra={t('appVersions.channelFixed')}>
            <Typography.Text
              data-testid="version-channel-fixed"
              style={{ overflowWrap: 'anywhere' }}
            >
              {channel
                ? `${plainText(channel.name) || channel.code} (${channel.code})`
                : channelCode}
            </Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            name="channelCode"
            label={t('appVersions.field.channel')}
            rules={[{ required: true, message: t('appVersions.channelRequired') }]}
            extra={
              channel
                ? t('appVersions.channelDetails', {
                    platform: codeText(intl, 'appVersions.platform', channel.platform),
                    distribution: codeText(intl, 'appVersions.distribution', channel.distribution),
                  })
                : undefined
            }
          >
            <Select
              aria-label={t('appVersions.field.channel')}
              showSearch
              optionFilterProp="label"
              options={channels.rows.map((c) => ({
                value: c.code,
                label: channelLabel(c),
                disabled: !c.enabled,
              }))}
            />
          </Form.Item>
        )}
        {!editing && channels.failure ? (
          <FailureBar failure={channels.failure} onRetry={channels.reload} />
        ) : null}

        <Form.Item
          name="versionName"
          label={t('appVersions.field.versionName')}
          extra={t('appVersions.versionNameHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const check = checkVersionName(trimSpec(value ?? ''));
                if (!check.ok) throw new Error(t(check.reasonKey));
              },
            },
          ]}
        >
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item
          name="versionCode"
          label={t('appVersions.field.versionCode')}
          extra={
            <>
              {t('appVersions.versionCodeHelp')}
              {activeText ? (
                <>
                  <br />
                  <span data-testid="version-active-hint">{activeText}</span>
                </>
              ) : null}
            </>
          }
          rules={versionCodeRules}
        >
          <InputNumber precision={0} style={{ width: 200 }} />
        </Form.Item>
        <Form.Item
          name="minVersionCode"
          label={t('appVersions.field.minVersionCode')}
          extra={t('appVersions.minVersionCodeHelp')}
          dependencies={['versionCode']}
          rules={[
            ({ getFieldValue }) => ({
              validator: async (_, value: unknown) => {
                const code = getFieldValue('versionCode');
                const check = checkMinVersionCode(value, numberOr(code));
                if (!check.ok) throw new Error(t(check.reasonKey, check.values));
              },
            }),
          ]}
        >
          <InputNumber precision={0} style={{ width: 200 }} />
        </Form.Item>
        <Form.Item
          name="changelog"
          label={t('appVersions.field.changelog')}
          extra={t('appVersions.changelogHelp')}
          rules={[
            {
              validator: async (_, value: Texts | undefined) => {
                const check = checkChangelog(value);
                if (!check.ok) throw new Error(t(check.reasonKey));
              },
            },
          ]}
        >
          <ChangelogField />
        </Form.Item>

        {kind === 'STORE' ? (
          <Form.Item
            name="storeUrl"
            label={t('appVersions.field.storeUrl')}
            extra={storeHelp}
            dependencies={['channelCode']}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  const text = trimSpec(value ?? '');
                  if (text === '') throw new Error(t('appVersions.storeUrlRequired'));
                  const check = validateStoreUrl(
                    platform === 'IOS' ? 'IOS' : 'ANDROID',
                    text,
                    packageName,
                  );
                  if (!check.ok)
                    throw new Error(t(check.reasonKey, { package: packageName ?? '' }));
                },
              },
            ]}
          >
            <Input dir="ltr" />
          </Form.Item>
        ) : null}

        {kind === 'DIRECT' ? (
          <Form.Item label={t('appVersions.field.apk')} extra={t('appVersions.apk.help')}>
            <Flex vertical gap={8}>
              {shownFile ? (
                <Flex vertical gap={4} data-testid="apk-info">
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      {
                        key: 'url',
                        label: t('appVersions.apk.url'),
                        children: (
                          <span dir="ltr" style={{ overflowWrap: 'anywhere' }}>
                            {shownFile.apkUrl}
                          </span>
                        ),
                      },
                      {
                        key: 'size',
                        label: t('appVersions.apk.size'),
                        children:
                          typeof shownFile.apkSizeBytes === 'number'
                            ? formatBytes(shownFile.apkSizeBytes, intl.locale)
                            : '—',
                      },
                      {
                        key: 'sha',
                        label: t('appVersions.apk.sha256'),
                        children: (
                          <span
                            dir="ltr"
                            style={{ overflowWrap: 'anywhere', fontFamily: 'monospace' }}
                          >
                            {shownFile.apkSha256}
                          </span>
                        ),
                      },
                    ]}
                  />
                  {!slot.upload ? (
                    <Typography.Text type="secondary">
                      {t('appVersions.apk.current')}
                    </Typography.Text>
                  ) : null}
                </Flex>
              ) : null}
              <ApkUpload
                key={slot.version}
                onBusyChange={slot.fieldProps.onBusyChange}
                onUploaded={(result) => {
                  slot.fieldProps.onUploaded(result);
                  setRejected(false);
                  setNeedFile(false);
                }}
                onCleared={slot.fieldProps.onCleared}
                onStart={() => setUnavailable(false)}
                onFailed={(error) => {
                  if (error instanceof ApiError && error.code === 'DEPENDENCY_UNAVAILABLE') {
                    setUnavailable(true);
                    return true;
                  }
                  return false;
                }}
              />
              {slot.busy ? <Alert type="info" showIcon title={t('appVersions.apk.wait')} /> : null}
              {unavailable ? (
                <Alert
                  type="warning"
                  showIcon
                  data-testid="apk-unavailable"
                  title={
                    <>
                      {t('appVersions.apk.unavailable')}{' '}
                      {access.canAccess('CONFIG:MANAGE') ? (
                        <Link to="/config">{t('appVersions.apk.openConfig')}</Link>
                      ) : null}
                    </>
                  }
                />
              ) : null}
              {rejected ? (
                <Alert type="error" showIcon title={t('appVersions.apk.rejected')} />
              ) : null}
              {needFile ? (
                <Alert type="error" showIcon title={t('appVersions.apk.required')} />
              ) : null}
            </Flex>
          </Form.Item>
        ) : null}

        {failure ? (
          <Alert
            type="error"
            showIcon
            title={failure.text}
            description={
              failure.more.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                  {failure.more.map((line) => (
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
