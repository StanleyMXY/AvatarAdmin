import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import {
  getModerationContent,
  type ModerationContent,
  type ModerationRecord,
} from '../../services/moderation';
import { describeFailure } from '../../session/describe';

type Phase = 'loading' | 'ready' | 'notStored' | 'failed';

const WRAP = { overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' } as const;

/** The player for a file; the address is only ever the `src` of this element. */
function Media({
  content,
  onError,
}: {
  content: Extract<ModerationContent, { kind: 'FILE' }>;
  onError: () => void;
}) {
  const intl = useIntl();
  const type = content.mediaType.toLowerCase();
  if (type.startsWith('image/')) {
    return (
      <img
        src={content.url}
        alt={intl.formatMessage({ id: 'moderation.content.imageAlt' })}
        referrerPolicy="no-referrer"
        onError={onError}
        style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }}
      />
    );
  }
  if (type.startsWith('audio/')) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: the transcript, when there is one, is shown under the player
      <audio
        controls
        preload="metadata"
        src={content.url}
        onError={onError}
        style={{ width: '100%', maxWidth: 480 }}
      />
    );
  }
  if (type.startsWith('video/')) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: a reviewed clip has no captions
      <video
        controls
        preload="metadata"
        src={content.url}
        onError={onError}
        style={{ maxWidth: '100%', maxHeight: 480 }}
      />
    );
  }
  return (
    <Typography.Text type="secondary" style={WRAP}>
      {intl.formatMessage(
        { id: 'moderation.content.unsupportedMedia' },
        { mediaType: content.mediaType },
      )}
    </Typography.Text>
  );
}

/**
 * The content area of the detail page. Only for an administrator who holds `MODERATION:REVIEW`:
 * without it no request is made. A blocked record has no original. The content is asked for
 * every time the page opens and again when the signed address stops working (the player fails once:
 * one new request; fails again: the person is told and can ask again); nothing is kept between
 * visits and the address is not written anywhere but the player's `src`.
 */
export function ContentPanel({
  record,
  canReview,
}: {
  record: ModerationRecord;
  canReview: boolean;
}) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const blocked = record.status === 'BLOCKED';
  const active = canReview && !blocked;

  const [phase, setPhase] = useState<Phase>('loading');
  const [content, setContent] = useState<ModerationContent | null>(null);
  const [failure, setFailure] = useState('');
  const [mediaFailed, setMediaFailed] = useState(false);
  const retried = useRef(false);
  const counter = useRef(0);
  const id = record.id;

  const load = useCallback(async () => {
    const mine = ++counter.current;
    setPhase('loading');
    setMediaFailed(false);
    try {
      const answer = await getModerationContent(id);
      if (mine !== counter.current) return;
      setContent(answer);
      setPhase('ready');
    } catch (error) {
      if (mine !== counter.current) return;
      const described = describeFailure(intlRef.current, error);
      setContent(null);
      setFailure(described.text);
      setPhase(described.error.code === 'CONTENT_NOT_STORED' ? 'notStored' : 'failed');
    }
  }, [id]);

  useEffect(() => {
    if (!active) return undefined;
    retried.current = false;
    void load();
    return () => {
      counter.current += 1;
    };
  }, [active, load]);

  const onMediaError = () => {
    if (!retried.current) {
      retried.current = true;
      void load();
    } else {
      setMediaFailed(true);
    }
  };

  const reload = () => {
    retried.current = false;
    void load();
  };

  let body: ReactNode;
  if (!canReview) {
    body = <Alert type="info" showIcon title={t('moderation.content.noPermission')} />;
  } else if (blocked) {
    body = <Alert type="info" showIcon title={t('moderation.content.blocked')} />;
  } else if (phase === 'notStored') {
    body = <Alert type="info" showIcon title={failure} />;
  } else if (phase === 'failed') {
    body = (
      <Alert
        type="error"
        showIcon
        title={t('moderation.content.failed', { message: failure })}
        action={
          <Button size="small" onClick={reload}>
            {t('moderation.content.reload')}
          </Button>
        }
      />
    );
  } else if (phase === 'loading' || content === null) {
    body = (
      <Flex gap={8} align="center">
        <Spin size="small" />
        <Typography.Text type="secondary">{t('moderation.content.loading')}</Typography.Text>
      </Flex>
    );
  } else if (content.kind === 'TEXT') {
    body = (
      <Flex vertical gap={8}>
        <div
          dir="auto"
          data-testid="moderation-content-text"
          style={{ ...WRAP, maxHeight: 360, overflow: 'auto' }}
        >
          {content.text}
        </div>
        {record.contentType === 'COMPANION_NAME' ? (
          <Typography.Text type="secondary">
            {t('moderation.content.companionNote')}
          </Typography.Text>
        ) : null}
      </Flex>
    );
  } else {
    body = (
      <Flex vertical gap={12}>
        <Media content={content} onError={onMediaError} />
        {mediaFailed ? (
          <Alert
            type="warning"
            showIcon
            title={t('moderation.content.mediaFailed')}
            action={
              <Button size="small" onClick={reload}>
                {t('moderation.content.reload')}
              </Button>
            }
          />
        ) : null}
        {content.text ? (
          <Flex vertical gap={4} data-testid="moderation-content-attached">
            <Typography.Text type="secondary">
              {t('moderation.content.attachedText')}
            </Typography.Text>
            <EllipsisPopoverText text={content.text} lines={6} width="100%" />
          </Flex>
        ) : null}
      </Flex>
    );
  }

  return (
    <Card size="small" title={t('moderation.content.title')}>
      <Flex vertical gap={12}>
        {canReview ? (
          <Typography.Text type="secondary">{t('moderation.content.audited')}</Typography.Text>
        ) : null}
        {body}
      </Flex>
    </Card>
  );
}
