// The shapes of the app version endpoints (contract 24.1 and 24.2). Field names are the columns of
// the entity; an administrator id comes with `…Username` beside it (backend reply, item on names).
// A text field is typed as text, but the pages show what they read through `plainText`: the backend
// has not fixed every type.

export const PLATFORMS = ['ANDROID', 'IOS'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DISTRIBUTIONS = ['STORE', 'DIRECT'] as const;
export type Distribution = (typeof DISTRIBUTIONS)[number];

export const VERSION_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export type AppVersion = {
  id: string;
  channelCode: string;
  platform: Platform;
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  /** STORE channels only. */
  storeUrl: string | null;
  /** DIRECT channels only: the upload the file came from. */
  apkUploadId: string | null;
  apkUrl: string | null;
  apkSizeBytes: number | null;
  apkSha256: string | null;
  /** Language tag to text; always has `en`. */
  changelog: Record<string, string>;
  status: VersionStatus;
  createdBy: string | null;
  createdByUsername: string | null;
  activatedBy: string | null;
  activatedByUsername: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The answer of `POST /uploads/apk`: the form shows the last three and sends only `uploadId`. */
export type ApkUpload = {
  uploadId: string;
  apkUrl: string;
  apkSizeBytes: number;
  apkSha256: string;
};

export type VersionFields = {
  versionName: string;
  versionCode: number;
  minVersionCode: number;
  changelog: Record<string, string>;
  /** STORE channels; a DIRECT channel's version must not have one. */
  storeUrl?: string;
  /** DIRECT channels; a STORE channel's version must not have one. */
  apkUploadId?: string;
};

/** The channel package is the scope of a version and cannot be changed afterwards. */
export type CreateVersionBody = VersionFields & { channelCode: string };
export type UpdateVersionBody = VersionFields;

export type VersionQuery = {
  channelCode?: string;
  platform?: Platform;
  status?: VersionStatus;
  page: number;
  pageSize: number;
};
