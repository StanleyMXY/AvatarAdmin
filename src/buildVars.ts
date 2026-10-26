// The build variables as application code reads them. config/buildVars.ts reads the environment and
// `define` in config/config.ts injects the values as globals; when a global is missing (unit tests)
// the defaults of spec sections 7 and 11 apply. src/buildVars.test.ts keeps both sets of defaults equal.
declare const ADMIN_PRODUCT_NAME: string | undefined;
declare const ADMIN_LOGO_URL: string | undefined;
declare const ADMIN_PRIMARY_COLOR: string | undefined;
declare const ADMIN_PRIMARY_HOVER: string | undefined;
declare const ADMIN_PRIMARY_ACTIVE: string | undefined;
declare const ADMIN_QUALITY_MIN_SUCCESS_RATE: number | undefined;
declare const ADMIN_QUALITY_MAX_SLOW_SHARE: number | undefined;

export const buildVars = {
  productName: typeof ADMIN_PRODUCT_NAME === 'undefined' ? 'Admin' : ADMIN_PRODUCT_NAME,
  logoUrl: typeof ADMIN_LOGO_URL === 'undefined' ? '/logo.svg' : ADMIN_LOGO_URL,
  primary: typeof ADMIN_PRIMARY_COLOR === 'undefined' ? '#0ABAB5' : ADMIN_PRIMARY_COLOR,
  primaryHover: typeof ADMIN_PRIMARY_HOVER === 'undefined' ? '#3DCBC7' : ADMIN_PRIMARY_HOVER,
  primaryActive: typeof ADMIN_PRIMARY_ACTIVE === 'undefined' ? '#089A96' : ADMIN_PRIMARY_ACTIVE,
  qualityMinSuccessRate:
    typeof ADMIN_QUALITY_MIN_SUCCESS_RATE === 'undefined' ? 0.95 : ADMIN_QUALITY_MIN_SUCCESS_RATE,
  qualityMaxSlowShare:
    typeof ADMIN_QUALITY_MAX_SLOW_SHARE === 'undefined' ? 0.05 : ADMIN_QUALITY_MAX_SLOW_SHARE,
} as const;
