import { useIntl } from '@umijs/max';
import { Alert, App, Checkbox, Flex, Modal, Typography } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type AppVersion, setAppVersionStatus } from '../../services/appVersions';
import type { ChannelPackage } from '../../services/channelPackages';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { distributionOf } from './distribution';
import { useActiveVersion } from './useActiveVersion';

type Props = {
  version: AppVersion;
  channels: ChannelPackage[];
  /** The versions the page shows: when the active version cannot be read again, the list is the hint. */
  rows: AppVersion[];
  onClose: () => void;
  onDone: () => void;
};

const numberOr = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Activating a draft. It becomes the only active version of its channel. For a STORE channel the
 * person must say that the new version is already visible to users in the store (the box), and the
 * request carries `confirmStoreLive=true`; when the new minimum version number is higher than the
 * version number that is active now, the text is the strong one. A DIRECT channel is not asked
 * that: the backend checks the file. Mounted by the page only while it is open, so the box is empty
 * every time.
 */
export function ActivateModal({ version, channels, rows, onClose, onDone }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [live, setLive] = useState(false);
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const channelCode = plainText(version.channelCode);
  const kind = distributionOf(version, channels);
  const channel = channels.find((c) => c.code === channelCode);
  const channelName = (channel && plainText(channel.name)) || channelCode;

  const hint = useActiveVersion(channelCode);
  // The read is the fresher; the list the page shows is the hint when the read failed.
  const fromList = rows.find((r) => r.status === 'ACTIVE' && r.channelCode === channelCode);
  const activeCode =
    hint.state === 'known'
      ? hint.code
      : hint.state === 'failed'
        ? numberOr(fromList?.versionCode)
        : null;
  const settled = hint.state === 'known' || hint.state === 'none' || hint.state === 'failed';
  // Activating before the read is back would skip the strong warning that the read may bring.
  const reading = hint.state === 'loading';
  const unknown = settled && hint.state !== 'none' && activeCode === null;

  const min = numberOr(version.minVersionCode);
  const code = numberOr(version.versionCode);
  const minText = min === null ? '—' : String(min);
  const strong = settled && min !== null && (unknown || (activeCode !== null && min > activeCode));

  const needsBox = kind === 'STORE';
  const { run, pending } = useSingleFlight(async () => {
    setFailure(null);
    try {
      await setAppVersionStatus(plainText(version.id), 'ACTIVE', needsBox ? true : undefined);
    } catch (error) {
      const described = describeFailure(intl, error);
      setFailure({ text: described.text, more: described.fields.map((f) => f.text) });
      return;
    }
    message.success(t('appVersions.activated', { name: plainText(version.versionName) }));
    onDone();
    onClose();
  });

  return (
    <Modal
      open
      title={t('appVersions.activate.title', { name: plainText(version.versionName) })}
      width={620}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('appVersions.activate.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{
        loading: pending,
        disabled: pending || reading || (needsBox && !live),
        danger: strong,
      }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => void run().catch(() => {})}
    >
      <Flex vertical gap={12}>
        <Typography.Paragraph style={{ marginBottom: 0, overflowWrap: 'anywhere' }}>
          {t('appVersions.activate.only', { channel: channelName })}
        </Typography.Paragraph>
        {needsBox ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('appVersions.activate.consequence')}
          </Typography.Paragraph>
        ) : (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {t('appVersions.activate.direct')}
          </Typography.Paragraph>
        )}
        {min !== null ? (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {t('appVersions.activate.minimum', { min })}
          </Typography.Paragraph>
        ) : null}
        {reading ? (
          <Typography.Text type="secondary" data-testid="activate-reading">
            {t('appVersions.activate.reading')}
          </Typography.Text>
        ) : null}
        {strong ? (
          <Alert
            type={unknown ? 'warning' : 'error'}
            showIcon
            data-testid="activate-strong"
            title={
              unknown
                ? t('appVersions.activate.strongUnknown', { min: minText })
                : t('appVersions.activate.strong', { min: minText, active: activeCode as number })
            }
          />
        ) : null}
        {settled && code !== null && activeCode !== null && code <= activeCode ? (
          <Alert
            type="warning"
            showIcon
            data-testid="activate-not-above"
            title={t('appVersions.activate.notAbove', { code, active: activeCode })}
          />
        ) : null}
        {needsBox ? (
          <Checkbox checked={live} disabled={pending} onChange={(e) => setLive(e.target.checked)}>
            {t('appVersions.activate.confirmLive')}
          </Checkbox>
        ) : null}
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
      </Flex>
    </Modal>
  );
}
