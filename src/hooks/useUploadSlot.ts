import { useCallback, useState } from 'react';

/**
 * What a form needs to hold one uploaded file: the record the server gave (its `uploadId` is the
 * only thing the create or update request carries about the file; the rest is shown to the person,
 * and a form that shows nothing about it just uses `uploadId`), whether an upload is still running
 * (the form cannot be sent then), and a `version` that changes on `reset` so that the upload
 * control starts afresh. Choosing another file clears the record first (`onCleared`).
 */
export function useUploadSlot<T extends { uploadId: string } = { uploadId: string }>() {
  const [upload, setUpload] = useState<T | undefined>();
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const reset = useCallback(() => {
    setUpload(undefined);
    setBusy(false);
    setVersion((v) => v + 1);
  }, []);
  return {
    upload,
    uploadId: upload?.uploadId,
    busy,
    version,
    reset,
    fieldProps: {
      onUploaded: (result: T) => setUpload(result),
      onBusyChange: setBusy,
      onCleared: () => setUpload(undefined),
    },
  };
}
