import { useCallback } from 'react';
import { type AppVersion, readActiveVersion } from '../../services/appVersions';
import { useLatestRead } from './useLatestRead';

export type ActiveHint =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'failed' }
  | { state: 'known'; version: AppVersion; code: number | null };

type Read = { channel: string; active: AppVersion | null };

/**
 * The version that is active in a channel, as a hint: read when the channel is known and again when
 * it changes; the answer of a read for a channel that is not the current one any more is dropped
 * (`useLatestRead`). The number is what the list shows now; the server decides where it is checked.
 */
export function useActiveVersion(channelCode: string | undefined): ActiveHint {
  const fetcher = useCallback(
    async (): Promise<Read> => ({
      channel: channelCode ?? '',
      active: channelCode ? await readActiveVersion(channelCode) : null,
    }),
    [channelCode],
  );
  const { data, failure } = useLatestRead(fetcher);
  if (!channelCode) return { state: 'idle' };
  if (failure !== null) return { state: 'failed' };
  if (data === null || data.channel !== channelCode) return { state: 'loading' };
  if (data.active === null) return { state: 'none' };
  const code = data.active.versionCode;
  return {
    state: 'known',
    version: data.active,
    code: typeof code === 'number' && Number.isFinite(code) ? code : null,
  };
}
