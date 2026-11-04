import { ApiError } from '../request/errors';

/**
 * True when the backend refused a form because of the `uploadId` it carried: the id was already
 * used by another object (409 INVALID_STATE), is of another kind (400 INVALID_REQUEST) or does not
 * exist (404 RESOURCE_NOT_FOUND). The form then asks for the file again, clears the id, and does
 * not send the request again. Call it only for a request that carries an upload id.
 */
export function isUploadIdRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    (error.httpStatus === 409 && error.code === 'INVALID_STATE') ||
    (error.httpStatus === 400 && error.code === 'INVALID_REQUEST') ||
    (error.httpStatus === 404 && error.code === 'RESOURCE_NOT_FOUND')
  );
}

/**
 * True when the backend refused the request because of the upload id it carried, and not because
 * of another field of the same request. A 400 counts only when it names no field (the answer for an
 * upload of another kind carries no details) or names one of `uploadRefs`; a 400 that names other
 * fields leaves the uploaded file as it is, because the file is still good. A 409 or a 404 is about
 * the upload id whatever it says. Call it only for a request that carries an upload id.
 */
export function isUploadFieldRejection(error: unknown, uploadRefs: readonly string[]): boolean {
  if (!isUploadIdRejection(error)) return false;
  if (error instanceof ApiError && error.httpStatus === 400) {
    return error.details.length === 0 || error.details.some((d) => uploadRefs.includes(d.ref));
  }
  return true;
}
