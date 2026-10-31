import { useIntl } from '@umijs/max';
import type { FormInstance } from 'antd';
import { Alert, App, Form, Input, InputNumber, Modal, Typography } from 'antd';
import { useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AdCampaign,
  type AdPlacement,
  type AdUnit,
  createUnit,
  updateUnit,
} from '../../services/ads';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { Picker } from './Picker';
import { TargetingEditor } from './TargetingEditor';
import {
  emptyTargetingForm,
  fromTargeting,
  type TargetingForm,
  type TargetingKey,
  toTargeting,
  validateTargeting,
} from './targeting';
import type { OptionsStatus } from './useOptions';

type Values = {
  campaignId?: string;
  placementId?: string;
  name: string;
  weight: number | null;
  dailyImpressionCap: number | null;
  targeting: TargetingForm;
};

type Source<T> = { status: OptionsStatus; rows: T[]; reload: () => void };

type Props = {
  open: boolean;
  /** The unit being edited; none means a new unit. */
  unit: AdUnit | null;
  campaigns: Source<AdCampaign>;
  placements: Source<AdPlacement>;
  geoConfigured: boolean | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['campaignId', 'placementId', 'name', 'weight', 'dailyImpressionCap'] as const;
const DEFAULT_WEIGHT = 100;

/** The editor key for a name the backend uses in a detail: `targeting.geo`, `day_parts`, `targeting.day_parts[0].start`. */
const TARGETING_REFS: Record<string, TargetingKey> = {
  platforms: 'platforms',
  geo: 'geo',
  os_version_min: 'osVersionMin',
  app_version_min: 'appVersionMin',
  languages: 'languages',
  day_parts: 'dayParts',
};
const targetingKeyOf = (ref: string): TargetingKey | undefined =>
  TARGETING_REFS[ref.replace(/^targeting\./, '').split(/[.[]/)[0]];

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * New or edit unit. A unit belongs to one campaign and one placement, chosen when it is made and
 * fixed after that (the update changes the name, the targeting, the weight and the daily cap). The
 * selectors read the campaigns and the placements, which are other permissions: when a read is
 * refused the selector is disabled and names the permission it needs. The targeting is checked
 * here by the rules of 22.5 and the backend's faults are shown under their fields.
 */
export function UnitModal({
  open,
  unit,
  campaigns,
  placements,
  geoConfigured,
  onClose,
  onSaved,
}: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const [serverErrors, setServerErrors] = useState<Partial<Record<TargetingKey, string>>>({});
  const editing = unit !== null;

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    setServerErrors({});
    const common = {
      name: trimSpec(values.name),
      weight: values.weight ?? DEFAULT_WEIGHT,
      dailyImpressionCap: values.dailyImpressionCap ?? 0,
    };
    try {
      if (unit) {
        await updateUnit(plainText(unit.id), {
          ...common,
          targeting: toTargeting(values.targeting, unit.targeting),
        });
      } else {
        await createUnit({
          ...common,
          campaignId: values.campaignId as string,
          placementId: values.placementId as string,
          targeting: toTargeting(values.targeting),
        });
      }
    } catch (error) {
      const { text, fields } = describeFailure(intl, error);
      const forTargeting: Partial<Record<TargetingKey, string>> = {};
      const more: string[] = [];
      const forForm: { name: string; errors: string[] }[] = [];
      for (const detail of fields) {
        const key = targetingKeyOf(detail.ref);
        if (key) forTargeting[key] = detail.text;
        else if ((FIELDS as readonly string[]).includes(detail.ref)) {
          forForm.push({ name: detail.ref, errors: [detail.text] });
        } else more.push(detail.text);
      }
      if (forForm.length > 0) (form as FormInstance).setFields(forForm);
      setServerErrors(forTargeting);
      setFailure({ text, more });
      return;
    }
    message.success(t('ads.common.saved'));
    onSaved();
    onClose();
  });

  const campaignName = (id: unknown) => {
    const found = campaigns.rows.find((c) => String(c.id) === String(id));
    return found ? plainText(found.name) : plainText(id);
  };
  const placementName = (id: unknown) => {
    const found = placements.rows.find((p) => String(p.id) === String(id));
    return found ? `${plainText(found.slotKey)} · ${plainText(found.name)}` : plainText(id);
  };

  const wholeFrom0 = async (_: unknown, value: unknown) => {
    if (!isWhole(value)) throw new Error(t('ads.common.wholeFrom0'));
  };

  return (
    <Modal
      open={open}
      title={t(editing ? 'ads.units.editTitle' : 'ads.units.newTitle')}
      destroyOnHidden
      width={680}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
        setServerErrors({});
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="adUnit"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          campaignId: undefined,
          placementId: undefined,
          name: plainText(unit?.name),
          weight: typeof unit?.weight === 'number' ? unit.weight : DEFAULT_WEIGHT,
          dailyImpressionCap:
            typeof unit?.dailyImpressionCap === 'number' ? unit.dailyImpressionCap : 0,
          targeting: unit ? fromTargeting(unit.targeting) : emptyTargetingForm(),
        }}
        onValuesChange={(changed) => {
          if ('targeting' in changed) setServerErrors({});
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {editing ? (
          <>
            <Form.Item label={t('ads.units.field.campaign')}>
              <Typography.Text
                data-testid="unit-campaign-fixed"
                style={{ overflowWrap: 'anywhere' }}
              >
                {campaignName(unit.campaignId)}
              </Typography.Text>
            </Form.Item>
            <Form.Item label={t('ads.units.field.placement')} extra={t('ads.units.fixedHelp')}>
              <Typography.Text
                data-testid="unit-placement-fixed"
                style={{ overflowWrap: 'anywhere' }}
              >
                {placementName(unit.placementId)}
              </Typography.Text>
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="campaignId"
              label={t('ads.units.field.campaign')}
              rules={[{ required: true, message: t('ads.units.campaignRequired') }]}
            >
              <Picker
                label={t('ads.units.field.campaign')}
                status={campaigns.status}
                permission="ADS:CAMPAIGN"
                onRetry={campaigns.reload}
                width="100%"
                options={campaigns.rows.map((c) => ({
                  value: String(c.id),
                  label:
                    c.status === 'ENDED'
                      ? t('ads.units.endedCampaign', { name: plainText(c.name) })
                      : plainText(c.name),
                  disabled: c.status === 'ENDED',
                }))}
              />
            </Form.Item>
            <Form.Item
              name="placementId"
              label={t('ads.units.field.placement')}
              extra={t('ads.units.fixedHelp')}
              rules={[{ required: true, message: t('ads.units.placementRequired') }]}
            >
              <Picker
                label={t('ads.units.field.placement')}
                status={placements.status}
                permission="ADS:PLACEMENT"
                onRetry={placements.reload}
                width="100%"
                options={placements.rows.map((p) => ({
                  value: String(p.id),
                  label: `${plainText(p.slotKey)} · ${plainText(p.name)}`,
                }))}
              />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="name"
          label={t('ads.units.field.name')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (trimSpec(value ?? '') === '') throw new Error(t('ads.units.nameRequired'));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="weight"
          label={t('ads.units.field.weight')}
          extra={t('ads.units.weightHelp')}
          rules={[{ validator: wholeFrom0 }]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item
          name="dailyImpressionCap"
          label={t('ads.units.field.dailyCap')}
          extra={t('ads.units.dailyCapHelp')}
          rules={[{ validator: wholeFrom0 }]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item
          name="targeting"
          label={t('ads.units.field.targeting')}
          rules={[
            {
              validator: async (_, value: TargetingForm | undefined) => {
                if (value && Object.keys(validateTargeting(value)).length > 0) {
                  throw new Error(t('ads.targeting.invalid'));
                }
              },
            },
          ]}
        >
          <TargetingEditor geoConfigured={geoConfigured} serverErrors={serverErrors} />
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
