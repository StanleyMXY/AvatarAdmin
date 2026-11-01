import { apiRequest } from '../../request/apiClient';

export type LoginBody = { username: string; password: string; totp?: string };

export type LoginResult =
  | { token: string; expiresAt: string }
  | { status: 'ENROLL_REQUIRED'; enrollToken: string; otpauthUri: string };

/** True for the answer that carries a token (the enrollment answer has a `status` instead). */
export const hasToken = (result: LoginResult): result is { token: string; expiresAt: string } =>
  'token' in result;

/** Passwords go to the server exactly as typed: no trimming, no hashing in the browser. */
export function login(body: LoginBody): Promise<LoginResult> {
  const payload: LoginBody = { username: body.username, password: body.password };
  if (body.totp !== undefined && body.totp !== '') payload.totp = body.totp;
  // Anonymous: a token left from an earlier session is not sent to the sign-in.
  return apiRequest<LoginResult>({
    method: 'POST',
    url: '/auth/login',
    body: payload,
    anonymous: true,
  });
}

export function enrollTotp(body: {
  enrollToken: string;
  totp: string;
}): Promise<{ token: string; expiresAt: string }> {
  // The enrollment token is in the body; the 401 of this call means it is void, not that a session ended.
  return apiRequest({ method: 'POST', url: '/auth/totp/enroll', body, anonymous: true });
}

export function changePassword(body: { oldPassword: string; newPassword: string }): Promise<null> {
  return apiRequest({ method: 'POST', url: '/auth/change-password', body });
}

/** `GET /me`, with every field read defensively: a field the backend does not send counts as missing. */
export type Me = {
  id: string | undefined;
  username: string | undefined;
  superAdmin: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  passwordMinLength: number | undefined;
};

export function normalizeMe(raw: unknown): Me {
  const o = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const length = o.passwordMinLength;
  return {
    id: typeof o.id === 'string' && o.id !== '' ? o.id : undefined,
    username: typeof o.username === 'string' && o.username !== '' ? o.username : undefined,
    superAdmin: o.superAdmin === true,
    mustChangePassword: o.mustChangePassword === true,
    permissions: Array.isArray(o.permissions)
      ? o.permissions.filter((code): code is string => typeof code === 'string')
      : [],
    passwordMinLength:
      typeof length === 'number' && Number.isInteger(length) && length > 0 ? length : undefined,
  };
}

/**
 * `GET /me`. A 403 here is not passed on to the session layer (which would read this same account
 * again and say "no permission"): the caller treats it like any other failure to read the account.
 */
export async function getMe(): Promise<Me> {
  return normalizeMe(
    await apiRequest<unknown>({ method: 'GET', url: '/me', reportForbidden: false }),
  );
}

/** `GET /meta`: the configuration values and upload limits a page needs but may not be allowed to edit. */
export type AdminMeta = {
  supportedLocales: string[] | null;
  landIntervalMinutes: number | null;
  allowedCurrencies: string[] | null;
  deletionAlertAfterFailures: number | null;
  inviteChainMaxDepth: number | null;
  maxRecipients: number | null;
  pushImageMaxBytes: number | null;
  statsMaxRangeDays: number | null;
  analyticsLiveMaxRangeDays: number | null;
  abuseClusterMinFreeAccounts: number | null;
  attributionClickRetentionDays: number | null;
  declarationRequired: boolean | null;
  uploadMaxBytes: number;
  adMediaMaxBytes: number;
  apkMaxBytes: number;
  renderAssetMaxBytes: number;
  catalogImageMaxBytes: number;
  catalogImageMaxPixels: number;
  adImageMaxPixels: number;
  defaultAvatarSourceMaxPixels: number;
};

/**
 * Never throws: when the endpoint is missing (the real backend may not have it yet), cannot be
 * reached, or refuses, the answer is an empty object and pages do not check what they cannot read.
 */
export async function getAdminMeta(): Promise<Partial<AdminMeta>> {
  try {
    const data = await apiRequest<unknown>({ method: 'GET', url: '/meta' });
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Partial<AdminMeta>)
      : {};
  } catch {
    return {};
  }
}
