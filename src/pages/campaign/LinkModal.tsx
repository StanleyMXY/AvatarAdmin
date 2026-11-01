import { Link, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Form, Input, Modal, Radio, Typography } from 'antd';
import { useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AttributionCampaign,
  getCampaignLink,
  LINK_PLATFORMS,
  type LinkPlatform,
} from '../../services/campaign';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { landingAddress, PLATFORM_FIELDS, UTM_VALUE, writeClipboard } from './links';

type Props = {
  campaign: AttributionCampaign;
  /** `attribution.link_base_url`: a text, or null when it is not configured; undefined while it is not known. */
  linkBase: string | null | undefined;
  onClose: () => void;
};

const DEFAULT_PLATFORM: LinkPlatform = 'FACEBOOK';

/**
 * Generate link: the platform and the three UTM values; the link comes from the backend. The
 * campaign must have a pixel number for the platform (else no request is made), and the link root
 * must be configured. The interface of the landing page for the direct download is shown as well.
 */
export function LinkModal({ campaign, linkBase, onClose }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [platform, setPlatform] = useState<LinkPlatform>(DEFAULT_PLATFORM);
  const [utmSource, setUtmSource] = useState<string>(PLATFORM_FIELDS[DEFAULT_PLATFORM].source);
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // A change of the fields overtakes the read that is on its way: an answer for fields that were
  // changed since is dropped.
  const begin = useLatestCall();
  const change = (apply: () => void) => {
    begin();
    apply();
    setLink(null);
    setProblem(null);
  };

  // A UTM value the backend would leave out of the link (contract 10.4) is flagged, not refused: the
  // link that comes back shows what was really used.
  const utmWarning = (value: string) =>
    value.trim() !== '' && !UTM_VALUE.test(value.trim())
      ? { validateStatus: 'warning' as const, help: t('campaign.campaigns.f.utmRule') }
      : {};

  const blocked = linkBase === null;

  const { run, pending } = useSingleFlight(async () => {
    setProblem(null);
    setLink(null);
    const isCurrent = begin();
    if (!campaign[PLATFORM_FIELDS[platform].pixel]) {
      setProblem(t('campaign.link.noPixel'));
      return;
    }
    try {
      const answer = await getCampaignLink(campaign.id, {
        platform,
        utmSource: utmSource.trim(),
        utmMedium: utmMedium.trim(),
        utmCampaign: utmCampaign.trim(),
      });
      if (isCurrent()) setLink(typeof answer.url === 'string' ? answer.url : null);
    } catch (error) {
      if (isCurrent()) setProblem(describeFailure(intl, error).text);
    }
  });

  const copy = async () => {
    if (link === null) return;
    try {
      await writeClipboard(link);
      message.success(t('pages.common.copied'));
    } catch {
      message.error(t('error.UNKNOWN'));
    }
  };

  return (
    <Modal
      open
      title={t('campaign.link.title', { code: plainText(campaign.code) })}
      width={640}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('pages.common.cancel')}</Button>}
    >
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label={t('campaign.link.platform')}>
          <Radio.Group
            value={platform}
            onChange={(event) =>
              change(() => {
                const next = event.target.value as LinkPlatform;
                setPlatform(next);
                setUtmSource(PLATFORM_FIELDS[next].source);
              })
            }
          >
            {LINK_PLATFORMS.map((p) => (
              <Radio key={p} value={p}>
                {t(`campaign.link.platform.${p}`)}
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label={t('campaign.link.utmSource')}
          htmlFor="campaign-link-source"
          {...utmWarning(utmSource)}
        >
          <Input
            id="campaign-link-source"
            dir="ltr"
            value={utmSource}
            onChange={(event) => change(() => setUtmSource(event.target.value))}
          />
        </Form.Item>
        <Form.Item
          label={t('campaign.link.utmMedium')}
          htmlFor="campaign-link-medium"
          {...utmWarning(utmMedium)}
        >
          <Input
            id="campaign-link-medium"
            dir="ltr"
            placeholder={t('campaign.link.utmMedium.placeholder')}
            value={utmMedium}
            onChange={(event) => change(() => setUtmMedium(event.target.value))}
          />
        </Form.Item>
        <Form.Item
          label={t('campaign.link.utmCampaign')}
          htmlFor="campaign-link-campaign"
          {...utmWarning(utmCampaign)}
        >
          <Input
            id="campaign-link-campaign"
            dir="ltr"
            value={utmCampaign}
            onChange={(event) => change(() => setUtmCampaign(event.target.value))}
          />
        </Form.Item>
        <Flex vertical gap={12}>
          {blocked ? (
            <Alert
              type="warning"
              showIcon
              title={t('campaign.link.noBase')}
              description={<Link to="/campaign/settings">{t('campaign.link.noBase.open')}</Link>}
            />
          ) : null}
          <div>
            <Button
              type="primary"
              onClick={() => void run()}
              loading={pending}
              disabled={pending || blocked}
            >
              {t('campaign.link.generate')}
            </Button>
          </div>
          {problem ? <Alert type="error" showIcon title={problem} /> : null}
          {link !== null ? (
            <Flex vertical gap={8}>
              <Typography.Text strong>{t('campaign.link.result')}</Typography.Text>
              <Typography.Paragraph
                data-testid="campaign-link"
                dir="ltr"
                style={{ overflowWrap: 'anywhere', marginBottom: 0 }}
              >
                {link}
              </Typography.Paragraph>
              <div>
                <Button onClick={() => void copy()}>{t('pages.common.copy')}</Button>
              </div>
            </Flex>
          ) : null}
          <Flex vertical gap={4}>
            <Typography.Text strong>{t('campaign.link.landing.title')}</Typography.Text>
            <Typography.Text type="secondary">
              {t('campaign.link.landing.text', { code: plainText(campaign.code) })}
            </Typography.Text>
            <Typography.Text
              code
              data-testid="landing-address"
              style={{ overflowWrap: 'anywhere' }}
            >
              {landingAddress(linkBase ?? null)}
            </Typography.Text>
          </Flex>
        </Flex>
      </Form>
    </Modal>
  );
}
