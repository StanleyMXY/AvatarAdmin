import { useIntl } from '@umijs/max';
import { Alert, App, Checkbox, Divider, Form, Input, Modal, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AttributionCampaign,
  type CampaignFields,
  createCampaign,
  updateCampaign,
} from '../../services/campaign';
import { type ChannelRow, getChannels } from '../../services/channels/getChannels';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { failureToForm } from './formFailure';

type Values = {
  code: string;
  name: string;
  mediaSource: string;
  campaign: string;
  utmMedium: string;
  adset: string;
  ad: string;
  remark: string;
  facebookPixelId: string;
  facebookAccessToken: string;
  googlePixelId: string;
  tiktokPixelId: string;
};

type Props = {
  /** The campaign being edited; none means a new campaign. */
  campaign: AttributionCampaign | null;
  /** The codes of every campaign there is, for the check of the code of a new one. */
  existingCodes: string[];
  onClose: () => void;
  onSaved: () => void;
};

const CODE = /^[a-z0-9_-]{3,32}$/;
// Contract 10.4: what a link takes as a UTM value; anything else is dropped from the link.
const UTM_VALUE = /^[A-Za-z0-9._-]{1,64}$/;
const FIELDS = [
  'code',
  'name',
  'mediaSource',
  'campaign',
  'utmMedium',
  'adset',
  'ad',
  'remark',
  'facebookPixelId',
  'facebookAccessToken',
  'googlePixelId',
  'tiktokPixelId',
  'channelCodes',
  'enabled',
] as const;

const orNull = (value: string | undefined): string | null => {
  const text = trimSpec(value ?? '');
  return text === '' ? null : text;
};

type ChannelState = { rows: ChannelRow[] } | 'failed' | null;

/**
 * New or edit campaign (width 640, three sections). The `code` is the key of a campaign: typed once
 * and then read-only. The access token is write-only: the box is always empty, a token
 * that is set is only said to be set, and an empty box sends no token at all (the old one stays).
 * A channel package that is disabled cannot be linked anew; one that is linked stays.
 */
export function CampaignModal({ campaign, existingCodes, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const editing = campaign !== null;
  const initialCodes = Array.isArray(campaign?.channelCodes)
    ? campaign.channelCodes.filter((c) => typeof c === 'string')
    : [];
  const [codes, setCodes] = useState<string[]>(initialCodes);

  const [channels, setChannels] = useState<ChannelState>(null);
  const counter = useRef(0);
  const readChannels = () => {
    const mine = ++counter.current;
    setChannels(null);
    getChannels()
      .then((rows) => {
        if (mine === counter.current) setChannels({ rows });
      })
      .catch(() => {
        if (mine === counter.current) setChannels('failed');
      });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the channel packages are read once, when the dialog opens
  useEffect(() => {
    readChannels();
  }, []);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    const token = trimSpec(values.facebookAccessToken ?? '');
    const fields: CampaignFields = {
      name: trimSpec(values.name),
      mediaSource: trimSpec(values.mediaSource),
      campaign: trimSpec(values.campaign),
      utmMedium: trimSpec(values.utmMedium),
      adset: orNull(values.adset),
      ad: orNull(values.ad),
      facebookPixelId: orNull(values.facebookPixelId),
      googlePixelId: orNull(values.googlePixelId),
      tiktokPixelId: orNull(values.tiktokPixelId),
      channelCodes: codes,
      remark: orNull(values.remark),
      enabled: campaign ? campaign.enabled === true : true,
      // An empty box sends no token: the backend keeps the one it has.
      ...(token === '' ? {} : { facebookAccessToken: token }),
    };
    try {
      if (campaign) await updateCampaign(campaign.id, fields);
      else await createCampaign({ ...fields, code: trimSpec(values.code) });
    } catch (error) {
      setFailure(failureToForm(intl, form, error, FIELDS));
      return;
    }
    message.success(t('campaign.campaigns.saved'));
    onSaved();
    onClose();
  });

  const required = {
    required: true,
    whitespace: true,
    message: t('campaign.campaigns.f.required'),
  };
  const utmRule = {
    pattern: UTM_VALUE,
    warningOnly: true,
    message: t('campaign.campaigns.f.utmRule'),
  };
  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  const options = (() => {
    const rows = channels !== null && channels !== 'failed' ? channels.rows : [];
    const known = new Set(rows.map((r) => r.channelCode));
    const fromList = rows.map((row) => {
      const label = `${plainText(row.channelCode)} · ${plainText(row.name)}`;
      const linked = initialCodes.includes(row.channelCode);
      return {
        value: row.channelCode,
        label:
          row.enabled === false
            ? t('campaign.campaigns.f.channels.disabled', { name: label })
            : label,
        // A disabled package cannot be linked anew; one that is linked already stays as it is.
        disabled: row.enabled === false && !linked,
      };
    });
    const extra = initialCodes
      .filter((c) => !known.has(c))
      .map((c) => ({ value: c, label: plainText(c), disabled: false }));
    return [...fromList, ...extra];
  })();

  return (
    <Modal
      open
      title={t(editing ? 'campaign.campaigns.editTitle' : 'campaign.campaigns.newTitle')}
      width={640}
      destroyOnHidden
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
        name="campaign"
        layout="vertical"
        requiredMark={false}
        autoComplete="off"
        initialValues={{
          code: '',
          name: text(campaign?.name),
          mediaSource: text(campaign?.mediaSource),
          campaign: text(campaign?.campaign),
          utmMedium: campaign ? text(campaign.utmMedium) : 'cpc',
          adset: text(campaign?.adset),
          ad: text(campaign?.ad),
          remark: text(campaign?.remark),
          facebookPixelId: text(campaign?.facebookPixelId),
          // never filled in: the backend does not return the token and the box does not show one
          facebookAccessToken: '',
          googlePixelId: text(campaign?.googlePixelId),
          tiktokPixelId: text(campaign?.tiktokPixelId),
        }}
        onFinish={(values) => run(values)}
      >
        <Divider titlePlacement="start">{t('campaign.campaigns.section.basic')}</Divider>
        {editing ? (
          <Form.Item
            label={t('campaign.campaigns.f.code')}
            extra={t('campaign.campaigns.f.code.fixed')}
          >
            <Typography.Text code style={{ overflowWrap: 'anywhere' }}>
              {plainText(campaign.code)}
            </Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            name="code"
            label={t('campaign.campaigns.f.code')}
            extra={t('campaign.campaigns.f.code.help')}
            validateTrigger={['onChange', 'onBlur']}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  const code = trimSpec(value ?? '');
                  if (!CODE.test(code)) throw new Error(t('campaign.campaigns.f.code.rule'));
                  if (existingCodes.includes(code))
                    throw new Error(t('campaign.campaigns.f.code.exists'));
                },
              },
            ]}
          >
            <Input dir="ltr" autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item name="name" label={t('campaign.campaigns.f.name')} rules={[required]}>
          <Input dir="auto" />
        </Form.Item>
        <Form.Item
          name="mediaSource"
          label={t('campaign.campaigns.f.mediaSource')}
          extra={t('campaign.campaigns.f.mediaSource.help')}
          rules={[required, utmRule]}
        >
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item
          name="campaign"
          label={t('campaign.campaigns.f.campaign')}
          extra={t('campaign.campaigns.f.campaign.help')}
          rules={[required, utmRule]}
        >
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item
          name="utmMedium"
          label={t('campaign.campaigns.f.utmMedium')}
          rules={[required, utmRule]}
        >
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item name="adset" label={t('campaign.campaigns.f.adset')}>
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="ad" label={t('campaign.campaigns.f.ad')}>
          <Input dir="auto" />
        </Form.Item>
        <Form.Item name="remark" label={t('campaign.campaigns.f.remark')}>
          <Input.TextArea dir="auto" autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>

        <Divider titlePlacement="start">{t('campaign.campaigns.section.pixels')}</Divider>
        <Form.Item name="facebookPixelId" label={t('campaign.campaigns.f.facebookPixel')}>
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item
          name="facebookAccessToken"
          label={t('campaign.campaigns.f.facebookToken')}
          extra={
            <span>
              {editing ? (
                <Tag
                  data-testid="token-state"
                  color={campaign.facebookAccessTokenSet === true ? 'green' : undefined}
                  style={{ marginInlineEnd: 8 }}
                >
                  {t(
                    campaign.facebookAccessTokenSet === true
                      ? 'campaign.campaigns.f.facebookToken.set'
                      : 'campaign.campaigns.f.facebookToken.unset',
                  )}
                </Tag>
              ) : null}
              {t('campaign.campaigns.f.facebookToken.help')}
            </span>
          }
        >
          <Input.Password dir="ltr" autoComplete="new-password" visibilityToggle={false} />
        </Form.Item>
        <Form.Item name="googlePixelId" label={t('campaign.campaigns.f.googlePixel')}>
          <Input dir="ltr" />
        </Form.Item>
        <Form.Item name="tiktokPixelId" label={t('campaign.campaigns.f.tiktokPixel')}>
          <Input dir="ltr" />
        </Form.Item>

        <Divider titlePlacement="start">{t('campaign.campaigns.section.channels')}</Divider>
        {channels === null ? <Spin /> : null}
        {channels === 'failed' ? (
          <Alert type="warning" showIcon title={t('campaign.campaigns.f.channels.failed')} />
        ) : null}
        {channels !== null && channels !== 'failed' ? (
          options.length === 0 ? (
            <Typography.Text type="secondary">
              {t('campaign.campaigns.f.channels.none')}
            </Typography.Text>
          ) : (
            <Form.Item extra={t('campaign.campaigns.f.channels.help')}>
              <Checkbox.Group
                value={codes}
                options={options}
                onChange={(next) => setCodes(next as string[])}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              />
            </Form.Item>
          )
        ) : null}
        {failure ? <Alert type="error" showIcon title={failure} style={{ marginTop: 12 }} /> : null}
      </Form>
    </Modal>
  );
}
