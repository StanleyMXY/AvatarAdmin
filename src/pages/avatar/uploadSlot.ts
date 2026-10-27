import { useCallback, useState } from 'react';

/**
 * What a form needs to hold one uploaded file: the `uploadId` the server gave (the only thing the
 * create or update request carries), and whether an upload is still running (the form cannot be
 * sent then). Choosing another file clears the id first.
 */
export function useUploadSlot() {
  const [uploadId, setUploadId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const reset = useCallback(() => {
    setUploadId(undefined);
    setBusy(false);
  }, []);
  return {
    uploadId,
    busy,
    reset,
    fieldProps: {
      onUploaded: (result: { uploadId: string }) => setUploadId(result.uploadId),
      onBusyChange: setBusy,
      onCleared: () => setUploadId(undefined),
    },
  };
}
