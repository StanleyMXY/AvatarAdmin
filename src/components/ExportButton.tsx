import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { PermissionCode } from '../access/permissionCodes';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { downloadFile } from '../request/download';
import { isAbortError } from '../request/errors';
import { describeFailure } from '../session/describe';
import { formatBytes } from '../utils/format';

type Access = { canAccess: (code?: string) => boolean };

type Props = {
  /** The report name in `/stats/export/{name}`. */
  name: string;
  params: Record<string, unknown>;
  /** The permission to see the page the export belongs to; it is needed together with `STATS:EXPORT`. */
  viewCode: PermissionCode;
  /** Another export address (the user list and others have their own). */
  url?: string;
  /** Replaces the default `['STATS:EXPORT', viewCode]`: every one of these is needed. */
  requiredCodes?: PermissionCode[];
};

/**
 * The export button. It is not drawn for an administrator who lacks a needed permission. The file
 * is requested with the token in a header; only an answer that really is the spreadsheet is saved,
 * and a refusal of the backend (rate limit, too many rows, no permission) is shown, never saved.
 * While the file is coming there is a cancel button; leaving the page cancels too. A download that
 * takes more than 5 minutes is given up on with "request timed out".
 */
export function ExportButton({ name, params, viewCode, url, requiredCodes }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const [received, setReceived] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const leaving = useRef(false);

  // Leaving the page stops a download that is still running (and shows nothing).
  useEffect(() => {
    leaving.current = false;
    return () => {
      leaving.current = true;
      controller.current?.abort();
    };
  }, []);

  const { run, pending } = useSingleFlight(async () => {
    setReceived(0);
    const mine = new AbortController();
    controller.current = mine;
    try {
      const { filename } = await downloadFile({
        url: url ?? `/stats/export/${encodeURIComponent(name)}`,
        params,
        fallbackName: `${name}.xlsx`,
        onProgress: setReceived,
        signal: mine.signal,
      });
      message.success(intl.formatMessage({ id: 'pages.export.saved' }, { name: filename }));
    } catch (error) {
      if (isAbortError(error)) {
        // Cancelled by the person (say so) or by leaving the page (nothing to say to).
        if (!leaving.current) message.info(intl.formatMessage({ id: 'pages.export.cancelled' }));
        return;
      }
      const { error: failure, text } = describeFailure(intl, error);
      // The backend refuses an export with too many rows as 400 INVALID_REQUEST; its message is not
      // shown (codes are translated here), so the text says what to try.
      message.error(
        failure.code === 'INVALID_REQUEST'
          ? `${text} ${intl.formatMessage({ id: 'pages.export.narrowRange' })}`
          : text,
      );
    } finally {
      if (controller.current === mine) controller.current = null;
      setReceived(null);
    }
  });

  const needed = requiredCodes ?? ['STATS:EXPORT', viewCode];
  if (!needed.every((code) => access.canAccess(code))) return null;

  return (
    <Space size={8}>
      <Button onClick={() => void run()} loading={pending} disabled={pending}>
        {received === null || received === 0
          ? intl.formatMessage({ id: 'pages.export.button' })
          : intl.formatMessage(
              { id: 'pages.export.received' },
              { bytes: formatBytes(received, intl.locale) },
            )}
      </Button>
      {pending ? (
        <Button onClick={() => controller.current?.abort()}>
          {intl.formatMessage({ id: 'pages.common.cancel' })}
        </Button>
      ) : null}
    </Space>
  );
}
