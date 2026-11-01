import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Spin, Typography } from 'antd';
import { useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
import { ApiError } from '../../request/errors';
import { type ComplaintEvidence, getComplaintEvidence } from '../../services/complaints';
import { describeFailure } from '../../session/describe';

type Shown =
  | { index: number; state: 'loading' }
  | { index: number; state: 'ready'; evidence: ComplaintEvidence }
  | { index: number; state: 'failed'; error: unknown };

/** A signed address is a plain http(s) address; anything else (a script address, for one) is not opened. */
export function isOpenableAddress(url: unknown): url is string {
  if (typeof url !== 'string' || url === '') return false;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** The file by its media type: a picture, a PDF, a video or a sound in its own player; any other type is not shown (no link to its address). */
function EvidenceFile({ evidence, label }: { evidence: ComplaintEvidence; label: string }) {
  const intl = useIntl();
  if (!isOpenableAddress(evidence.url)) {
    return (
      <Alert
        type="error"
        showIcon
        title={intl.formatMessage({ id: 'complaints.evidence.badAddress' })}
      />
    );
  }
  const type = String(evidence.mediaType ?? '').toLowerCase();
  if (type.startsWith('image/')) {
    return (
      <img
        src={evidence.url}
        alt={label}
        style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }}
      />
    );
  }
  if (type === 'application/pdf') {
    return (
      <iframe src={evidence.url} title={label} style={{ width: '100%', height: 420, border: 0 }} />
    );
  }
  if (type.startsWith('video/')) {
    // biome-ignore lint/a11y/useMediaCaption: evidence files have no captions
    return <video src={evidence.url} controls style={{ maxWidth: '100%', maxHeight: 420 }} />;
  }
  if (type.startsWith('audio/')) {
    // biome-ignore lint/a11y/useMediaCaption: evidence files have no captions
    return <audio src={evidence.url} controls />;
  }
  // No player for this type: the address is not offered as a link, because a link can be copied
  // and opened apart, and this address is the signed address of a person's file.
  return (
    <Alert
      type="info"
      showIcon
      title={intl.formatMessage({ id: 'complaints.evidence.unsupported' })}
    />
  );
}

/**
 * The evidence files of one complaint, one button for each (counted from 1 on the screen, from 0
 * in the request). Each click asks for the file again: the address is signed for a short time, every
 * read is written to the audit log, and nothing is kept. The address is never written to a log or
 * put into the page's own address.
 */
export function EvidenceViewer({ complaintId, count }: { complaintId: string; count: number }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [shown, setShown] = useState<Shown | null>(null);
  const begin = useLatestCall();

  const open = async (index: number) => {
    const isCurrent = begin();
    setShown({ index, state: 'loading' });
    try {
      const evidence = await getComplaintEvidence(complaintId, index);
      if (isCurrent()) setShown({ index, state: 'ready', evidence });
    } catch (error) {
      if (!isCurrent()) return;
      setShown({ index, state: 'failed', error });
    }
  };

  if (count === 0)
    return <Typography.Text type="secondary">{t('complaints.evidence.none')}</Typography.Text>;

  return (
    <Flex vertical gap={8}>
      <Alert type="warning" showIcon title={t('complaints.evidence.logged')} />
      <Flex gap={8} wrap>
        {Array.from({ length: count }, (_, n) => n).map((index) => (
          <Button
            key={index}
            type={shown?.index === index ? 'primary' : 'default'}
            disabled={shown?.index === index && shown.state === 'loading'}
            onClick={() => void open(index)}
          >
            {t('complaints.evidence.file', { n: index + 1 })}
          </Button>
        ))}
      </Flex>
      {shown?.state === 'loading' ? <Spin /> : null}
      {shown?.state === 'failed' ? (
        <Alert
          type="error"
          showIcon
          title={
            shown.error instanceof ApiError && shown.error.code === 'RESOURCE_NOT_FOUND'
              ? t('complaints.evidence.notFound')
              : describeFailure(intl, shown.error).text
          }
        />
      ) : null}
      {shown?.state === 'ready' ? (
        <EvidenceFile
          evidence={shown.evidence}
          label={t('complaints.evidence.file', { n: shown.index + 1 })}
        />
      ) : null}
    </Flex>
  );
}
