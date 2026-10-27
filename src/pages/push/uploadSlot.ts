import { useCallback, useState } from 'react';

/**
 * What a form needs to hold one uploaded picture: the `uploadId` the server gave (the only thing
 * the request carries about the picture), whether an upload is still running (the form cannot be
 * sent then), and a `version` that changes on `reset` so the upload control starts afresh.
 */
export function useUploadSlot() {
  const [uploadId, setUploadId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const reset = useCallback(() => {
    setUploadId(undefined);
    setBusy(false);
    setVersion((v) => v + 1);
  }, []);
  return {
    uploadId,
    busy,
    version,
    reset,
    fieldProps: {
      onUploaded: (result: { uploadId: string }) => setUploadId(result.uploadId),
      onBusyChange: setBusy,
      onCleared: () => setUploadId(undefined),
    },
  };
}
