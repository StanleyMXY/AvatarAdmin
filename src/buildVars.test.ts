import { describe, expect, it } from 'vitest';
import { buildVars as configVars } from '../config/buildVars';
import { buildVars } from './buildVars';

describe('buildVars (run time)', () => {
  it('falls back to the defaults of the spec when the build did not define them', () => {
    expect(buildVars).toEqual({
      productName: 'Admin',
      logoUrl: '/logo.svg',
      primary: '#0ABAB5',
      primaryHover: '#3DCBC7',
      primaryActive: '#089A96',
      qualityMinSuccessRate: 0.95,
      qualityMaxSlowShare: 0.05,
    });
  });

  it('has the same defaults as config/buildVars.ts, which feeds the build', () => {
    expect(buildVars.productName).toBe(configVars.ADMIN_PRODUCT_NAME);
    expect(buildVars.logoUrl).toBe(configVars.ADMIN_LOGO_URL);
    expect(buildVars.primary).toBe(configVars.ADMIN_PRIMARY_COLOR);
    expect(buildVars.primaryHover).toBe(configVars.ADMIN_PRIMARY_HOVER);
    expect(buildVars.primaryActive).toBe(configVars.ADMIN_PRIMARY_ACTIVE);
    expect(buildVars.qualityMinSuccessRate).toBe(configVars.ADMIN_QUALITY_MIN_SUCCESS_RATE);
    expect(buildVars.qualityMaxSlowShare).toBe(configVars.ADMIN_QUALITY_MAX_SLOW_SHARE);
  });

  it('keeps the logo on this origin: a single-slash path', () => {
    expect(buildVars.logoUrl.startsWith('/')).toBe(true);
    expect(buildVars.logoUrl.startsWith('//')).toBe(false);
  });
});
