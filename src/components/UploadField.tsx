import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Progress, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { uploadFile } from '../request/upload';
import { describeFailure } from '../session/describe';
import { useAdminMeta } from '../session/useSession';
import { readImageSize } from '../utils/imageHeader';
import {
  checkUploadFile,
  describeUploadLimits,
  UPLOAD_ENTRIES,
  type UploadKind,
  type UploadLimitMeta,
} from '../utils/uploadLimits';

const ACCEPT_BY_KIND = {
  PNG: '.png,image/png',
  JPEG: '.jpg,.jpeg,image/jpeg',
  MP4: '.mp4,video/mp4',
  ZIP: '.zip',
} as const;

type Props<T extends { uploadId: string }> = {
  kind: UploadKind;
  onUploaded: (result: T) => void;
  onBusyChange: (busy: boolean) => void;
  /**
   * Called when the upload the form holds is no longer shown (a new file was chosen, so the
   * `uploadId` from the earlier one must not be submitted any more).
   */
  onCleared?: () => void;
  /** Called when a file is chosen, before anything else (the form forgets the last refusal). */
  onStart?: () => void;
  /**
   * Called with the error of a failed upload. It returns `true` when the page shows that failure
   * itself (a page that has to say what to set up, for example); the control then does not repeat
   * it in its own words.
   */
  onFailed?: (error: unknown) => boolean | undefined;
  /** Say, with the text of the error, the reason the backend gave for each field (default: the text of the error only). */
  withFieldReasons?: boolean;
  /** Show a small preview of a chosen picture (default: yes). */
  showPreview?: boolean;
  disabled?: boolean;
};

/** A picture is shown as a preview only when its header says it is no larger than this many pixels. */
export const PREVIEW_MAX_PIXELS = 16_000_000;

/**
 * A file control for one of the six upload entries. The limits come from `GET /meta` and are shown
 * beside the control; a chosen file is checked (type, empty, size, pixels from the file header,
 * never by decoding the image) before anything is sent, and a refusal says which item, the limit
 * and the actual value. What `meta` does not tell is not checked: the server decides. The result
 * of the upload is the server's `{ uploadId }`, which the form sends instead of any address.
 */
export function UploadField<T extends { uploadId: string }>({
  kind,
  onUploaded,
  onBusyChange,
  onCleared,
  onStart,
  onFailed,
  withFieldReasons,
  showPreview = true,
  disabled,
}: Props<T>) {
  const intl = useIntl();
  const meta = useAdminMeta() as Partial<UploadLimitMeta>;
  const entry = UPLOAD_ENTRIES[kind];
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [doneName, setDoneName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const limits = describeUploadLimits(kind, meta, intl.locale);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const problemText = (
    check: Exclude<Awaited<ReturnType<typeof checkUploadFile>>, { ok: true }>,
  ): string => {
    const shown = (field: keyof UploadLimitMeta | undefined, value: number | undefined) =>
      field && value !== undefined
        ? describeUploadLimits(kind, { [field]: value }, intl.locale, { note: false })
        : undefined;
    switch (check.problem) {
      case 'EMPTY':
        return t('pages.upload.problem.EMPTY');
      case 'WRONG_TYPE':
        return t('pages.upload.problem.WRONG_TYPE', { types: limits.types });
      case 'TOO_LARGE':
        return t('pages.upload.problem.TOO_LARGE', {
          limit: shown(entry.maxBytesField, check.limit)?.maxBytes ?? '',
          actual: shown(entry.maxBytesField, check.actual)?.maxBytes ?? '',
        });
      case 'TOO_MANY_PIXELS':
        return t('pages.upload.problem.TOO_MANY_PIXELS', {
          limit: shown(entry.maxPixelsField, check.limit)?.maxPixels ?? '',
          actual: shown(entry.maxPixelsField, check.actual)?.maxPixels ?? '',
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
    setPreview(null);
    latest.current.onStart?.();
    if (holdsResult.current) {
      holdsResult.current = false;
      latest.current.onCleared?.();
    }
    let check: Awaited<ReturnType<typeof checkUploadFile>>;
    try {
      check = await checkUploadFile(kind, file, meta);
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
    // A picture is shown only after the check, and only when its header says it is small: the
    // browser decodes the whole picture to show it, and a small file can declare a huge one.
    if (showPreview && (file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name))) {
      const size = await readImageSize(file).catch(() => null);
      if (alive.current && size && size.width * size.height <= PREVIEW_MAX_PIXELS) {
        setPreview(URL.createObjectURL(file));
      }
    }
    if (!alive.current) return;
    busy.current = true;
    latest.current.onBusyChange(true);
    abort.current = new AbortController();
    let result: T | null = null;
    try {
      setPercent(0);
      result = await uploadFile<T>({
        url: entry.endpoint,
        file,
        signal: abort.current.signal,
        onProgress: (loaded, total) => {
          if (alive.current) setPercent(total > 0 ? Math.round((loaded / total) * 100) : 0);
        },
      });
    } catch (error) {
      if (alive.current) {
        setPreview(null);
        const shownByPage = latest.current.onFailed?.(error) === true;
        if (!shownByPage) {
          const described = describeFailure(intl, error);
          setFailure(
            withFieldReasons
              ? [described.text, ...described.fields.map((f) => f.text)].join(' ')
              : described.text,
          );
        }
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

  const accept =
    (entry.extensions ? [...entry.extensions].join(',') : '') ||
    entry.accept.map((k) => ACCEPT_BY_KIND[k]).join(',');

  return (
    <Flex vertical gap={8}>
      <Flex gap={8} align="center" wrap>
        <input
          ref={input}
          type="file"
          hidden
          // an Ant Design form shows a file input again whatever `hidden` says; the inline style wins
          style={{ display: 'none' }}
          accept={accept}
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
      {preview ? (
        <img src={preview} alt="" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain' }} />
      ) : null}
    </Flex>
  );
}
