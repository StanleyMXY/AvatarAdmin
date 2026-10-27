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
