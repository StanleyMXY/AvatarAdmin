import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Progress, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { uploadFile } from '../../request/upload';
import type { MediaUpload } from '../../services/ads';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import {
  checkUploadFile,
  describeUploadLimits,
  UPLOAD_ENTRIES,
  type UploadLimitMeta,
} from '../../utils/uploadLimits';

type Props = {
  onUploaded: (result: MediaUpload) => void;
  onBusyChange: (busy: boolean) => void;
  /** Called when the upload the form holds is no longer shown (a new file was chosen). */
  onCleared?: () => void;
  /** Called when a file is chosen, before anything else (the form forgets the last refusal). */
  onStart?: () => void;
  /**
   * Called with the error of a failed upload. It returns `true` when the page shows that failure
   * itself (the control then does not repeat it in its own words).
   */
  onFailed?: (error: unknown) => boolean | undefined;
  disabled?: boolean;
};

const ENTRY = UPLOAD_ENTRIES.adMedia;
const ACCEPT = '.png,image/png,.jpg,.jpeg,image/jpeg,.mp4,video/mp4';

/**
 * The file control of an ad creative (`UPLOAD_ENTRIES.adMedia`: JPEG, PNG or MP4). It does what the
 * shared `UploadField` does for this entry (the limits beside it from `GET /meta`; type, size and,
 * for a picture, the pixels read from the header are checked before anything is sent; a video has no
 * pixel check; the answer is the server's `uploadId`) and tells the page why an upload failed, which
 * the shared control does not (the page has to say that `upload.public_base_url` is missing).
 */
export function AdMediaUpload({
  onUploaded,
  onBusyChange,
  onCleared,
  onStart,
  onFailed,
  disabled,
}: Props) {
  const intl = useIntl();
  const meta = useAdminMeta() as Partial<UploadLimitMeta>;
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const limits = describeUploadLimits('adMedia', meta, intl.locale);

  const problemText = (
    check: Exclude<Awaited<ReturnType<typeof checkUploadFile>>, { ok: true }>,
  ): string => {
    const shown = (field: keyof UploadLimitMeta | undefined, value: number | undefined) =>
      field && value !== undefined
        ? describeUploadLimits('adMedia', { [field]: value }, intl.locale, { note: false })
        : undefined;
    switch (check.problem) {
      case 'EMPTY':
        return t('pages.upload.problem.EMPTY');
      case 'WRONG_TYPE':
        return t('pages.upload.problem.WRONG_TYPE', { types: limits.types });
      case 'TOO_LARGE':
        return t('pages.upload.problem.TOO_LARGE', {
          limit: shown(ENTRY.maxBytesField, check.limit)?.maxBytes ?? '',
          actual: shown(ENTRY.maxBytesField, check.actual)?.maxBytes ?? '',
        });
      case 'TOO_MANY_PIXELS':
        return t('pages.upload.problem.TOO_MANY_PIXELS', {
          limit: shown(ENTRY.maxPixelsField, check.limit)?.maxPixels ?? '',
          actual: shown(ENTRY.maxPixelsField, check.actual)?.maxPixels ?? '',
        });
    }
  };

  // The upload in progress is cancelled when the control goes away, and nothing is reported after that.
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const holdsResult = useRef(false);
  const latest = useRef({ onUploaded, onBusyChange, onCleared, onStart, onFailed });
  latest.current = { onUploaded, onBusyChange, onCleared, onStart, onFailed };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
      if (busy.current) latest.current.onBusyChange(false);
    };
  }, []);

  const { run, pending } = useSingleFlight(async (file: File) => {
    setProblem(null);
    setFailure(null);
    setDoneName(null);
    setPercent(null);
    latest.current.onStart?.();
    if (holdsResult.current) {
      holdsResult.current = false;
      latest.current.onCleared?.();
    }
    let check: Awaited<ReturnType<typeof checkUploadFile>>;
    try {
      check = await checkUploadFile('adMedia', file, meta);
    } catch {
      // the file could not be read at all
      if (alive.current) setFailure(t('error.UNKNOWN'));
      return;
    }
    if (!alive.current) return;
    if (!check.ok) {
      setProblem(problemText(check));
      return;
    }
    busy.current = true;
    latest.current.onBusyChange(true);
    abort.current = new AbortController();
    let result: MediaUpload | null = null;
    try {
      setPercent(0);
      result = await uploadFile<MediaUpload>({
        url: ENTRY.endpoint,
        file,
        signal: abort.current.signal,
        onProgress: (loaded, total) => {
          if (alive.current) setPercent(total > 0 ? Math.round((loaded / total) * 100) : 0);
        },
      });
    } catch (error) {
      if (alive.current) {
        const shownByPage = latest.current.onFailed?.(error) === true;
        if (!shownByPage) setFailure(describeFailure(intl, error).text);
      }
    } finally {
      abort.current = null;
      if (busy.current) {
        busy.current = false;
        if (alive.current) {
          setPercent(null);
          latest.current.onBusyChange(false);
        }
      }
    }
    // Reported outside the try: a failure of the parent is not an upload failure.
    if (result && alive.current) {
      holdsResult.current = true;
      setDoneName(file.name);
      latest.current.onUploaded(result);
    }
  });

  return (
    <Flex vertical gap={8}>
      <Flex gap={8} align="center" wrap>
        <input
          ref={input}
          type="file"
          hidden
          accept={ACCEPT}
          data-testid="upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void run(file).catch(() => {});
          }}
        />
        <Button
          onClick={() => input.current?.click()}
          loading={pending}
          disabled={disabled || pending}
        >
          {t('pages.upload.choose')}
        </Button>
        <Typography.Text type="secondary">
          {[
            t('pages.upload.limits', { types: limits.types }),
            limits.maxBytes ? t('pages.upload.maxBytes', { size: limits.maxBytes }) : null,
            limits.maxPixels ? t('pages.upload.maxPixels', { pixels: limits.maxPixels }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography.Text>
      </Flex>
      {percent !== null ? (
        <Progress
          percent={percent}
          size="small"
          format={() => t('pages.upload.uploading', { percent })}
        />
      ) : null}
      {problem ? <Alert type="error" title={problem} showIcon /> : null}
      {failure ? <Alert type="error" title={failure} showIcon /> : null}
      {doneName ? (
        <Typography.Text type="success">
          {t('pages.upload.done', { name: doneName })}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}
