import { describe, expect, it } from 'vitest';
import { cellTint } from './cellTint';

describe('cellTint', () => {
  it('gives no background for a missing or empty share', () => {
    expect(cellTint('#52c41a', null)).toBeUndefined();
    expect(cellTint('#52c41a', 0)).toBeUndefined();
    expect(cellTint('#52c41a', -0.2)).toBeUndefined();
  });

  it('grows from 0.10 to 0.60 of opacity with the share, and stops at a whole', () => {
    expect(cellTint('#52c41a', 0)).toBeUndefined();
    expect(cellTint('#52c41a', 0.5)).toEqual({ backgroundColor: 'rgba(82, 196, 26, 0.35)' });
    expect(cellTint('#52c41a', 1)).toEqual({ backgroundColor: 'rgba(82, 196, 26, 0.60)' });
    expect(cellTint('#52c41a', 3)).toEqual({ backgroundColor: 'rgba(82, 196, 26, 0.60)' });
  });

  it('gives no background for a colour that is not written as #rrggbb', () => {
    expect(cellTint('rgb(1, 2, 3)', 0.5)).toBeUndefined();
    expect(cellTint('green', 0.5)).toBeUndefined();
  });
});
