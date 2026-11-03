import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useLatestCall } from '../../hooks/useLatestCall';
import {
  getModerationContent,
  type ModerationContent,
  type ModerationRecord,
} from '../../services/moderation';
import { describeFailure, failureCode } from '../../session/describe';

type Phase = 'loading' | 'ready' | 'notStored' | 'failed';

/**
 * A file's signed address is asked for again this long before it ends, so the player never meets an
 * expired one (and never has to fail first). Every read writes an audit row, so a read is made once
 * for each address, only while someone can see it, and not while a sound or a clip is playing.
 */
const RENEW_BEFORE_MS = 30_000;
/** When a sound or a clip is playing at the moment of renewal, look again after this long. */
const RENEW_RECHECK_MS = 5_000;
/** The least wait before a renewal, so an address with little time left cannot make a loop of reads. */
const RENEW_MIN_MS = 1_000;
/**
 * A renewed address that the browser's clock says has less than this left is not renewed again by
 * itself: the clock is off, or the lifetime is very short, and a next read would only be an audit row
 * every few seconds. The player's failure then renews it once, as for any address.
 */
const RENEW_LEAST_LEFT_MS = 2 * RENEW_BEFORE_MS;
/** How many times the panel renews by itself for one record in one visit; after that, only a failing player does. */
const MAX_AUTO_RENEWALS = 3;

/** Whether an address that ends at `expiresAt` still has at least `RENEW_LEAST_LEFT_MS` by the browser's clock. */
function hasRoomToRenew(expiresAt: unknown, now: number): boolean {
  if (typeof expiresAt !== 'string') return false;
  const end = Date.parse(expiresAt);
  return !Number.isNaN(end) && end - now >= RENEW_LEAST_LEFT_MS;
}

/** How long to wait before renewing an address that ends at `expiresAt`; null when there is nothing to plan. */
function renewDelay(expiresAt: unknown, now: number): number | null {
  if (typeof expiresAt !== 'string') return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  const left = end - now;
  // Over already (a clock that is off): the player's own failure renews it once.
  if (left <= 0) return null;
  return Math.max(left - RENEW_BEFORE_MS, left / 2, RENEW_MIN_MS);
}

/** The place of a sound or a clip that is stopped in the middle, when `answer` is going to replace its address; else null. */
function stoppedPosition(area: HTMLElement | null, answer: ModerationContent): number | null {
  const media = area?.querySelector<HTMLMediaElement>('audio, video');
  if (!media || answer.kind !== 'FILE' || media.getAttribute('src') === answer.url) return null;
  return media.currentTime > 0 && media.paused ? media.currentTime : null;
}

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
 * visits and the address is not written anywhere but the player's `src`. A file's answer says when
 * its address ends (`expiresAt`): the panel asks again shortly before that, once per address, only
 * while the tab is visible and nothing is playing; a failed renewal keeps what is shown. An address
 * that the browser's clock calls nearly over after a renewal, or the third renewal of a visit, is the
 * last planned one: after that only a failing player asks again. A sound or a clip stopped in the
 * middle goes back to its place when the new address is ready.
 */
export function ContentPanel({
  record,
  canReview,
}: {
  record: ModerationRecord;
  canReview: boolean;
}) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const blocked = record.status === 'BLOCKED';
  const active = canReview && !blocked;

  const [phase, setPhase] = useState<Phase>('loading');
  const [content, setContent] = useState<ModerationContent | null>(null);
  // The failed read itself (boxed): its words are made when drawn, so they follow the language.
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);
  const failure = failed === null ? '' : describeFailure(intl, failed.error).text;
  const [mediaFailed, setMediaFailed] = useState(false);
  const retried = useRef(false);
  // How many times this visit renewed by itself, and whether the last renewed address left too little time to plan another.
  const autoRenewals = useRef(0);
  const [renewedTooShort, setRenewedTooShort] = useState(false);
  // Where a clip that was stopped in the middle was, to put it back when its address is replaced.
  const resume = useRef<number | null>(null);
  const begin = useLatestCall();
  const id = record.id;
  const area = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const isCurrent = begin();
    setPhase('loading');
    setMediaFailed(false);
    try {
      const answer = await getModerationContent(id);
      if (!isCurrent()) return;
      resume.current = null;
      setContent(answer);
      setRenewedTooShort(false);
      setPhase('ready');
    } catch (error) {
      if (!isCurrent()) return;
      setContent(null);
      setFailed({ error });
      setPhase(failureCode(error) === 'CONTENT_NOT_STORED' ? 'notStored' : 'failed');
    }
  }, [id, begin]);

  useEffect(() => {
    if (!active) return undefined;
    retried.current = false;
    autoRenewals.current = 0;
    void load();
    return () => {
      // Another record, or the tab is left: the read still on its way belongs to nobody.
      begin();
    };
  }, [active, load, begin]);

  // The renewal of an address that is about to end. It keeps the answer on screen when it fails.
  const renew = useCallback(async () => {
    const isCurrent = begin();
    autoRenewals.current += 1;
    try {
      const answer = await getModerationContent(id);
      if (!isCurrent()) return;
      retried.current = false;
      resume.current = stoppedPosition(area.current, answer);
      setRenewedTooShort(
        !hasRoomToRenew(answer.kind === 'FILE' ? answer.expiresAt : undefined, Date.now()),
      );
      setContent(answer);
    } catch (error) {
      if (!isCurrent()) return;
      if (failureCode(error) === 'CONTENT_NOT_STORED') {
        setContent(null);
        setFailed({ error });
        setPhase('notStored');
      }
    }
  }, [id, begin]);

  const expiresAt = content?.kind === 'FILE' ? content.expiresAt : undefined;
  useEffect(() => {
    if (!active || phase !== 'ready') return undefined;
    if (renewedTooShort || autoRenewals.current >= MAX_AUTO_RENEWALS) return undefined;
    const delay = renewDelay(expiresAt, Date.now());
    if (delay === null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const playing = () =>
      [...(area.current?.querySelectorAll<HTMLMediaElement>('audio, video') ?? [])].some(
        (media) => !media.paused && !media.ended,
      );
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      attempt();
    };
    const attempt = () => {
      if (document.visibilityState === 'hidden') {
        document.addEventListener('visibilitychange', onVisible);
        return;
      }
      if (playing()) {
        timer = setTimeout(attempt, RENEW_RECHECK_MS);
        return;
      }
      void renew();
    };
    timer = setTimeout(attempt, delay);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, phase, expiresAt, renew, renewedTooShort]);

  // The new address of a clip that was stopped in the middle starts at 0:00 again: once it knows its
  // length, go back to where it was. Nothing is played, so it stays stopped.
  const url = content?.kind === 'FILE' ? content.url : undefined;
  useEffect(() => {
    const media = area.current?.querySelector<HTMLMediaElement>('audio, video');
    if (url === undefined || !media || resume.current === null) return undefined;
    const restore = () => {
      if (resume.current !== null) media.currentTime = resume.current;
      resume.current = null;
    };
    media.addEventListener('loadedmetadata', restore, { once: true });
    return () => media.removeEventListener('loadedmetadata', restore);
  }, [url]);

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

  let bodyNode: ReactNode;
  if (!canReview) {
    bodyNode = <Alert type="info" showIcon title={t('moderation.content.noPermission')} />;
  } else if (blocked) {
    bodyNode = <Alert type="info" showIcon title={t('moderation.content.blocked')} />;
  } else if (phase === 'notStored') {
    bodyNode = <Alert type="info" showIcon title={failure} />;
  } else if (phase === 'failed') {
    bodyNode = (
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
    bodyNode = (
      <Flex gap={8} align="center">
        <Spin size="small" />
        <Typography.Text type="secondary">{t('moderation.content.loading')}</Typography.Text>
      </Flex>
    );
  } else if (content.kind === 'TEXT') {
    bodyNode = (
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
    bodyNode = (
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
        <div ref={area}>{bodyNode}</div>
      </Flex>
    </Card>
  );
}
