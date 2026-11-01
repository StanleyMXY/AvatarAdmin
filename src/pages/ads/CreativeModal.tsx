import { Link, useAccess, useIntl } from '@umijs/max';
import type { FormInstance } from 'antd';
import {
  Alert,
  App,
  AutoComplete,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Typography,
} from 'antd';
import { useState } from 'react';
import { linkRule } from '../../components/LinkInput';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { ApiError } from '../../request/errors';
import {
  type AdCreative,
  type AdPlacement,
  type AdUnit,
  CLICK_ACTIONS,
  type ClickAction,
  type CreativeFields,
  createCreative,
  type MediaUpload,
  updateCreative,
  warningsOf,
} from '../../services/ads';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { formatBytes } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { SCREEN_TARGETS } from '../../utils/screenTargets';
import { trimSpec } from '../../utils/trimSpec';
import { isUploadIdRejection } from '../../utils/uploadErrors';
import { AdMediaUpload } from './AdMediaUpload';
import { bytesProblemTexts, checkMediaSpec } from './mediaSpec';
import { Picker } from './Picker';
import { Thumb } from './Thumb';
import { UploadBox } from './UploadBox';
import { useUploadSlot } from './uploadSlot';
import type { OptionsStatus } from './useOptions';

type Values = {
  adUnitId?: string;
  clickAction: ClickAction;
  clickTarget: string;
  language: string;
  weight: number | null;
  skippable: boolean;
  rewardAfterSeconds: number | null;
  title: string;
  body: string;
  ctaText: string;
  advertiserName: string;
};

type Source<T> = { status: OptionsStatus; rows: T[]; reload: () => void };

type Props = {
  open: boolean;
  /** The creative being edited; none means a new creative. */
  creative: AdCreative | null;
  units: Source<AdUnit>;
  placements: Source<AdPlacement>;
  /** `ads.creative_aspect_tolerance_percent` when it could be read. */
  tolerance: number | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = [
  'adUnitId',
  'clickAction',
  'clickTarget',
  'language',
  'weight',
  'skippable',
  'rewardAfterSeconds',
  'title',
  'body',
  'ctaText',
  'advertiserName',
] as const;
const FULL_SCREEN = ['SPLASH', 'INTERSTITIAL'];
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const DEEP_LINK_MAX = 2048;

/**
 * The backend refused the upload id: another object used it (409), it is of another kind or the
 * file does not fit (400 about `uploadId`), or it is not there (404). A 400 that is only about other
 * fields is not this: the file is still good.
 */
function uploadRefused(error: unknown): boolean {
  if (!isUploadIdRejection(error)) return false;
  if (error instanceof ApiError && error.httpStatus === 400) {
    return error.details.length === 0 || error.details.some((d) => d.ref === 'uploadId');
  }
  return true;
}

const orNull = (value: string | undefined): string | null => {
  const trimmed = trimSpec(value ?? '');
  return trimmed === '' ? null : trimmed;
};

type Shown = {
  thumbnailUrl: unknown;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSeconds: number | null;
  mediaType: string;
  /** The file the creative has now, not one that was just uploaded. */
  current: boolean;
};

const numberOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * New or edit creative. The file is uploaded first and the form sends its `uploadId` and nothing
 * about the file: the type, size, dimensions, duration and addresses come from the upload record
 * and are shown read-only. The file is checked against the spec of the placement of the unit and
 * the reasons are given; the backend has the last word. A creative that has been approved is not
 * edited (the page does not offer it).
 */
export function CreativeModal({
  open,
  creative,
  units,
  placements,
  tolerance,
  onClose,
  onSaved,
}: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const meta = useAdminMeta() as { supportedLocales?: unknown } | null;
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const slot = useUploadSlot<MediaUpload>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const [rejected, setRejected] = useState(false);
  const [needFile, setNeedFile] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const editing = creative !== null;

  const chosenUnit = Form.useWatch('adUnitId', form);
  const action = (Form.useWatch('clickAction', form) ??
    creative?.clickAction ??
    'OPEN_URL') as ClickAction;
  const skippable = Form.useWatch('skippable', form) ?? creative?.skippable ?? true;
  const unitId = editing ? plainText(creative.adUnitId) : (chosenUnit ?? '');
  const unit = units.rows.find((u) => String(u.id) === String(unitId));
  const placement = unit
    ? placements.rows.find((p) => String(p.id) === String(unit.placementId))
    : undefined;
  const format = placement?.adFormat;
  const placementLabel = placement ? plainText(placement.slotKey) : '';
  const showReward = format === 'REWARDED' || (unitId !== '' && placement === undefined);

  const uploaded = slot.upload;
  const shown: Shown | null = uploaded
    ? {
        thumbnailUrl: uploaded.thumbnailUrl,
        width: numberOrNull(uploaded.width),
        height: numberOrNull(uploaded.height),
        bytes: numberOrNull(uploaded.bytes),
        durationSeconds: numberOrNull(uploaded.durationSeconds),
        mediaType: plainText(uploaded.mediaType),
        current: false,
      }
    : creative
      ? {
          thumbnailUrl: creative.thumbnailUrl,
          width: numberOrNull(creative.width),
          height: numberOrNull(creative.height),
          bytes: numberOrNull(creative.bytes),
          durationSeconds: numberOrNull(creative.durationSeconds),
          mediaType: plainText(creative.type),
          current: true,
        }
      : null;
  const check = shown && placement ? checkMediaSpec(shown, placement, tolerance) : null;

  const locales = meta?.supportedLocales;
  const supportedLocales = Array.isArray(locales)
    ? locales.filter((x): x is string => typeof x === 'string')
    : [];

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    setNeedFile(false);
    if (!editing && !slot.uploadId) {
      setNeedFile(true);
      return;
    }
    const fields: CreativeFields = {
      clickAction: values.clickAction,
      clickTarget: trimSpec(values.clickTarget),
      language: trimSpec(values.language),
      weight: values.weight ?? 100,
      skippable: values.skippable,
      rewardAfterSeconds:
        showReward && typeof values.rewardAfterSeconds === 'number'
          ? values.rewardAfterSeconds
          : null,
      title: orNull(values.title),
      body: orNull(values.body),
      ctaText: orNull(values.ctaText),
      advertiserName: orNull(values.advertiserName),
    };
    let saved: unknown;
    try {
      saved = creative
        ? await updateCreative(plainText(creative.id), {
            ...fields,
            ...(slot.uploadId ? { uploadId: slot.uploadId } : {}),
          })
        : await createCreative({
            ...fields,
            adUnitId: values.adUnitId as string,
            uploadId: slot.uploadId as string,
          });
    } catch (error) {
      const { text, fields: details } = describeFailure(intl, error);
      const forForm: { name: string; errors: string[] }[] = [];
      const more: string[] = [];
      for (const detail of details) {
        if ((FIELDS as readonly string[]).includes(detail.ref)) {
          forForm.push({ name: detail.ref, errors: [detail.text] });
        } else more.push(detail.text);
      }
      if (forForm.length > 0) (form as FormInstance).setFields(forForm);
      if (uploadRefused(error)) {
        slot.reset();
        setRejected(true);
      }
      setFailure({ text, more });
      return;
    }
    message.success(t('ads.common.saved'));
    for (const warning of warningsOf(saved)) {
      const id = `ads.creatives.warning.${warning.code}`;
      message.warning(
        intl.messages[id]
          ? t(id)
          : t('ads.creatives.warning.UNKNOWN', { message: plainText(warning.message) }),
      );
    }
    onSaved();
    onClose();
  });

  const unitName = (id: unknown) => {
    const found = units.rows.find((u) => String(u.id) === String(id));
    return found ? plainText(found.name) : plainText(id);
  };

  const clickTargetRules = [
    ({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => ({
      validator: async (rule: unknown, value: string | undefined) => {
        const kind = (getFieldValue('clickAction') ?? 'OPEN_URL') as ClickAction;
        const text = trimSpec(value ?? '');
        if (kind === 'OPEN_URL') {
          // The one rule of contract 1.7 for a link the server hands to a client; its reason is the message.
          const rules = linkRule(intl, { required: true }) as unknown as {
            validator: (rule: unknown, value: unknown) => Promise<void>;
          };
          await rules.validator(rule, text);
        } else if (kind === 'IN_APP_ROUTE') {
          if (!SCREEN_TARGETS.includes(text))
            throw new Error(t('pages.link.target.screenRequired'));
        } else if (text === '') {
          throw new Error(t('ads.creatives.deepLinkRequired'));
        } else if (text.length > DEEP_LINK_MAX) {
          throw new Error(t('reason.TOO_LONG'));
        }
      },
    }),
  ];

  const mediaBlock = shown ? (
    <Flex vertical gap={8} data-testid="creative-media">
      <Flex gap={12} align="start">
        <Thumb url={shown.thumbnailUrl} size={96} />
        <Descriptions
          size="small"
          column={1}
          items={[
            {
              key: 'type',
              label: t('ads.creatives.media.type'),
              children: t(`ads.creatives.type.${shown.mediaType}`),
            },
            {
              key: 'size',
              label: t('ads.creatives.media.dimensions'),
              children:
                shown.width !== null && shown.height !== null
                  ? t('ads.creatives.media.dimensionsValue', {
                      width: shown.width,
                      height: shown.height,
                    })
                  : DASH,
            },
            {
              key: 'bytes',
              label: t('ads.creatives.media.bytes'),
              children: shown.bytes === null ? DASH : formatBytes(shown.bytes, intl.locale),
            },
            {
              key: 'duration',
              label: t('ads.creatives.media.duration'),
              children:
                shown.mediaType === 'VIDEO' && shown.durationSeconds !== null
                  ? t('ads.creatives.media.seconds', { seconds: shown.durationSeconds })
                  : DASH,
            },
          ]}
        />
      </Flex>
      {shown.current ? (
        <Typography.Text type="secondary">{t('ads.creatives.media.current')}</Typography.Text>
      ) : null}
    </Flex>
  ) : null;

  const specBlock = shown ? (
    check ? (
      <Alert
        data-testid="creative-spec-check"
        type={check.fits ? 'success' : 'error'}
        showIcon
        title={
          check.fits
            ? t('ads.creatives.spec.fits', { slot: placementLabel })
            : t('ads.creatives.spec.misses', { slot: placementLabel })
        }
        description={
          check.fits ? undefined : (
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {check.problems.map((p) => (
                <li key={p.code}>
                  {t(`ads.creatives.spec.${p.code}`, {
                    ...p.values,
                    ...(p.code === 'bytes' ? bytesProblemTexts(p.values, intl.locale) : {}),
                  })}
                </li>
              ))}
            </ul>
          )
        }
      />
    ) : unitId !== '' ? (
      <Alert
        data-testid="creative-spec-check"
        type="info"
        showIcon
        title={t('ads.creatives.spec.unknown')}
      />
    ) : null
  ) : null;

  return (
    <Modal
      open={open}
      title={t(editing ? 'ads.creatives.editTitle' : 'ads.creatives.newTitle')}
      destroyOnHidden
      width={720}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        slot.reset();
        setFailure(null);
        setRejected(false);
        setNeedFile(false);
        setUnavailable(false);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || slot.busy }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="adCreative"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          adUnitId: undefined,
          clickAction: (CLICK_ACTIONS as readonly string[]).includes(String(creative?.clickAction))
            ? creative?.clickAction
            : 'OPEN_URL',
          clickTarget: plainText(creative?.clickTarget),
          language: plainText(creative?.language) || '*',
          weight: typeof creative?.weight === 'number' ? creative.weight : 100,
          skippable: creative ? creative.skippable !== false : true,
          rewardAfterSeconds:
            typeof creative?.rewardAfterSeconds === 'number' ? creative.rewardAfterSeconds : null,
          title: plainText(creative?.title),
          body: plainText(creative?.body),
          ctaText: plainText(creative?.ctaText),
          advertiserName: plainText(creative?.advertiserName),
        }}
        onValuesChange={(changed) => {
          // The target of one kind of action means nothing for another.
          if ('clickAction' in changed) form.setFieldValue('clickTarget', '');
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {editing ? (
          <Form.Item label={t('ads.creatives.field.unit')}>
            <Typography.Text data-testid="creative-unit-fixed" style={{ overflowWrap: 'anywhere' }}>
              {unitName(creative.adUnitId)}
            </Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            name="adUnitId"
            label={t('ads.creatives.field.unit')}
            extra={
              placement
                ? t('ads.creatives.unitPlacement', {
                    slot: placementLabel,
                    format: t(`ads.format.${plainText(placement.adFormat)}`),
                  })
                : undefined
            }
            rules={[{ required: true, message: t('ads.creatives.unitRequired') }]}
          >
            <Picker
              label={t('ads.creatives.field.unit')}
              status={units.status}
              permission="ADS:UNIT"
              onRetry={units.reload}
              width="100%"
              options={units.rows.map((u) => ({ value: String(u.id), label: plainText(u.name) }))}
            />
          </Form.Item>
        )}

        <Form.Item label={t('ads.creatives.field.file')} extra={t('ads.creatives.fileHelp')}>
          <Flex vertical gap={8}>
            {mediaBlock}
            {specBlock}
            <UploadBox>
              <AdMediaUpload
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
            </UploadBox>
            {slot.busy ? (
              <Alert type="info" showIcon title={t('ads.creatives.uploadWait')} />
            ) : null}
            {unavailable ? (
              <Alert
                type="warning"
                showIcon
                data-testid="creative-upload-unavailable"
                title={
                  <>
                    {t('ads.creatives.uploadUnavailable')}{' '}
                    {access.canAccess('CONFIG:MANAGE') ? (
                      <Link to="/config">{t('ads.creatives.openConfig')}</Link>
                    ) : null}
                  </>
                }
              />
            ) : null}
            {rejected ? (
              <Alert type="error" showIcon title={t('ads.creatives.fileRejected')} />
            ) : null}
            {needFile ? (
              <Alert type="error" showIcon title={t('ads.creatives.uploadFirst')} />
            ) : null}
          </Flex>
        </Form.Item>

        <Form.Item name="clickAction" label={t('ads.creatives.field.clickAction')}>
          <Select
            aria-label={t('ads.creatives.field.clickAction')}
            options={CLICK_ACTIONS.map((a) => ({
              value: a,
              label: t(`ads.creatives.action.${a}`),
            }))}
          />
        </Form.Item>
        <Form.Item
          name="clickTarget"
          label={t('ads.creatives.field.clickTarget')}
          dependencies={['clickAction']}
          rules={clickTargetRules}
        >
          {action === 'IN_APP_ROUTE' ? (
            <Select
              aria-label={t('ads.creatives.field.clickTarget')}
              placeholder={t('pages.link.target.placeholderScreen')}
              options={SCREEN_TARGETS.map((id) => ({
                value: id,
                label: t(`pages.link.screen.${id}`),
              }))}
            />
          ) : (
            <Input
              aria-label={t('ads.creatives.field.clickTarget')}
              dir="ltr"
              placeholder={
                action === 'OPEN_URL' ? t('pages.link.target.placeholderUrl') : undefined
              }
            />
          )}
        </Form.Item>
        <Form.Item
          name="language"
          label={t('ads.creatives.field.language')}
          extra={t('ads.creatives.languageHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const text = trimSpec(value ?? '');
                if (text !== '*' && !(LANGUAGE_TAG.test(text) && text.length <= 35)) {
                  throw new Error(t('ads.creatives.languageInvalid'));
                }
              },
            },
          ]}
        >
          <AutoComplete
            aria-label={t('ads.creatives.field.language')}
            options={[
              { value: '*', label: t('ads.creatives.allLanguages') },
              ...supportedLocales.map((tag) => ({ value: tag, label: tag })),
            ]}
          />
        </Form.Item>
        <Form.Item
          name="weight"
          label={t('ads.creatives.field.weight')}
          extra={t('ads.creatives.weightHelp')}
          rules={[
            {
              validator: async (_, value: number | null | undefined) => {
                if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
                  throw new Error(t('ads.common.wholeFrom0'));
                }
              },
            },
          ]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item
          name="skippable"
          label={t('ads.creatives.field.skippable')}
          valuePropName="checked"
          extra={t('ads.creatives.skippableHelp')}
        >
          <Switch aria-label={t('ads.creatives.field.skippable')} />
        </Form.Item>
        {skippable === false && format !== undefined && FULL_SCREEN.includes(format) ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            data-testid="creative-policy-warning"
            title={t('ads.creatives.policyWarning')}
          />
        ) : null}
        {showReward ? (
          <Form.Item
            name="rewardAfterSeconds"
            label={t('ads.creatives.field.reward')}
            extra={t(
              format === 'REWARDED'
                ? 'ads.creatives.rewardHelp'
                : 'ads.creatives.rewardHelpUnknown',
            )}
            dependencies={['adUnitId']}
            rules={[
              {
                validator: async (_, value: number | null | undefined) => {
                  if (format !== 'REWARDED' && (value === null || value === undefined)) return;
                  if (
                    typeof value !== 'number' ||
                    !Number.isInteger(value) ||
                    value < 5 ||
                    value > 30
                  ) {
                    throw new Error(t('ads.creatives.rewardRange'));
                  }
                  if (
                    shown?.mediaType === 'VIDEO' &&
                    shown.durationSeconds !== null &&
                    value > shown.durationSeconds
                  ) {
                    throw new Error(
                      t('ads.creatives.rewardOverVideo', { seconds: shown.durationSeconds }),
                    );
                  }
                },
              },
            ]}
          >
            <InputNumber
              precision={0}
              style={{ width: 160 }}
              aria-label={t('ads.creatives.field.reward')}
            />
          </Form.Item>
        ) : null}
        <Form.Item
          name="title"
          label={t('ads.creatives.field.title')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (format === 'NATIVE' && trimSpec(value ?? '') === '') {
                  throw new Error(t('ads.creatives.titleRequired'));
                }
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="body" label={t('ads.creatives.field.body')}>
          <Input.TextArea rows={3} dir="auto" />
        </Form.Item>
        <Form.Item
          name="ctaText"
          label={t('ads.creatives.field.ctaText')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (format === 'NATIVE' && trimSpec(value ?? '') === '') {
                  throw new Error(t('ads.creatives.ctaRequired'));
                }
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="advertiserName" label={t('ads.creatives.field.advertiser')}>
          <Input dir="auto" />
        </Form.Item>
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
