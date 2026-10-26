import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Progress, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { uploadFile } from '../request/upload';
import { describeFailure } from '../session/describe';
import { useAdminMeta } from '../session/useSession';
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
  disabled?: boolean;
};

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
        ? describeUploadLimits(kind, { [field]: value }, intl.locale)
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

  const { run, pending } = useSingleFlight(async (file: File) => {
    setProblem(null);
    setFailure(null);
    setDoneName(null);
    setPercent(null);
    setPreview(null);
    const check = await checkUploadFile(kind, file, meta);
    if (!check.ok) {
      setProblem(problemText(check));
      return;
    }
    // Only a file that passed the check is shown as a picture.
    if (file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name)) {
      setPreview(URL.createObjectURL(file));
    }
    onBusyChange(true);
    try {
      setPercent(0);
      const result = await uploadFile<T>({
        url: entry.endpoint,
        file,
        onProgress: (loaded, total) =>
          setPercent(total > 0 ? Math.round((loaded / total) * 100) : 0),
      });
      setDoneName(file.name);
      onUploaded(result);
    } catch (error) {
      setPreview(null);
      setFailure(describeFailure(intl, error).text);
    } finally {
      setPercent(null);
      onBusyChange(false);
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
          accept={accept}
          data-testid="upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void run(file);
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
