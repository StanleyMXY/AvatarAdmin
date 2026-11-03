import { ApiError } from '../../request/errors';
import { describeFailure, type Translator } from '../../session/describe';
import { plainText } from '../../utils/plainText';

const VERSION_STATES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

/**
 * The words of a 409 INVALID_STATE of the version endpoints by `data.status` (contract 24.2): the
 * state of the version (DRAFT, ACTIVE, ARCHIVED), DISABLED for a channel that is off, CONSUMED for an
 * APK upload that another version has used. Any other value, a status that is not text, or no data
 * at all is not told apart: `null`, and the general words of the code stay.
 */
export function invalidStateText(intl: Translator, failure: unknown): string | null {
  if (!(failure instanceof ApiError)) return null;
  if (failure.httpStatus !== 409 || failure.code !== 'INVALID_STATE') return null;
  const status = (failure.data as { status?: unknown } | null)?.status;
  if (status === 'DISABLED' || status === 'CONSUMED') {
    return intl.formatMessage({ id: `appVersions.state.${status}` });
  }
  if (typeof status === 'string' && VERSION_STATES.includes(status)) {
    return intl.formatMessage(
      { id: 'appVersions.state.version' },
      { state: intl.formatMessage({ id: `appVersions.status.${status}` }) },
    );
  }
  return null;
}

/** `describeFailure`, with the words of the state when the 409 names one. */
export function describeVersionFailure(intl: Translator, failure: unknown) {
  const described = describeFailure(intl, failure);
  const text = invalidStateText(intl, failure);
  return text === null ? described : { ...described, text };
}

const REF_LABELS: Record<string, string> = {
  channelCode: 'appVersions.field.channel',
  versionName: 'appVersions.field.versionName',
  versionCode: 'appVersions.field.versionCode',
  minVersionCode: 'appVersions.field.minVersionCode',
  changelog: 'appVersions.field.changelog',
  storeUrl: 'appVersions.field.storeUrl',
  apkUploadId: 'appVersions.field.apk',
  status: 'appVersions.ref.status',
  confirmStoreLive: 'appVersions.ref.confirmStoreLive',
};

/** `changelog.<language>` is the notes of that language; the language is the part after the dot. */
export const noteLanguageOf = (ref: string): string | null =>
  ref.startsWith('changelog.') ? plainText(ref.slice('changelog.'.length)) : null;

/**
 * One line of a refusal for a field that has no place of its own in the dialog: the name of the
 * field, then the words of the reason. A field the page does not know is the reason alone.
 */
export function refusalLine(intl: Translator, ref: string, reasonText: string): string {
  const label = REF_LABELS[ref];
  if (label === undefined) return reasonText;
  return intl.formatMessage(
    { id: 'appVersions.refusalLine' },
    { field: intl.formatMessage({ id: label }), reason: reasonText },
  );
}
