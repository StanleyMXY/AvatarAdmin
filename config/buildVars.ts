/**
 * Build-time variables. Read from the process environment (Umi loads `.env` and `.env.local`
 * before this file is evaluated). They are injected into the bundle through `define` in
 * `config.ts`, so application code reads them through `src/buildVars.ts`, the only file that names the globals.
 *
 * Defaults follow the design spec (section 7 and section 11). Nothing here is a secret.
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function readString(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function readColor(name: string, fallback: string): string {
  const value = readString(name, fallback);
  if (!HEX_COLOR.test(value)) {
    throw new Error(`${name} must be a 6-digit hex color such as #0ABAB5, got "${value}"`);
  }
  return value.toUpperCase();
}

function readFraction(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1, got "${raw}"`);
  }
  return value;
}

/** The logo must be served by this app: a same-origin path, never an external address. */
function readLogoUrl(name: string, fallback: string): string {
  const value = readString(name, fallback);
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new Error(
      `${name} must be a same-origin path starting with a single "/", got "${value}"`,
    );
  }
  return value;
}

export const buildVars = {
  ADMIN_PRODUCT_NAME: readString('ADMIN_PRODUCT_NAME', 'Admin'),
  ADMIN_LOGO_URL: readLogoUrl('ADMIN_LOGO_URL', '/logo.svg'),
  ADMIN_PRIMARY_COLOR: readColor('ADMIN_PRIMARY_COLOR', '#0ABAB5'),
  ADMIN_PRIMARY_HOVER: readColor('ADMIN_PRIMARY_HOVER', '#3DCBC7'),
  ADMIN_PRIMARY_ACTIVE: readColor('ADMIN_PRIMARY_ACTIVE', '#089A96'),
  /** Call quality is flagged when the connect success rate is below this fraction. */
  ADMIN_QUALITY_MIN_SUCCESS_RATE: readFraction('ADMIN_QUALITY_MIN_SUCCESS_RATE', 0.95),
  /** Call quality is flagged when the share of slow connects is above this fraction. */
  ADMIN_QUALITY_MAX_SLOW_SHARE: readFraction('ADMIN_QUALITY_MAX_SLOW_SHARE', 0.05),
} as const;

/**
 * The values for Umi's `define`. Umi encodes each value as JSON itself, so they are passed as they
 * are: encoding them here too would put quote marks inside every string in the browser.
 */
export function toDefine(vars: Record<string, string | number>): Record<string, string | number> {
  return { ...vars };
}
