import { afterEach, describe, expect, it } from 'vitest';
import { currentValue, defaultOf, resetConfigStore, saved } from './configStore';

afterEach(() => resetConfigStore());

describe('the defaults of the fake settings', () => {
  it('give the price source address a default of the example domain (the contract names a third-party service, which is not written here)', () => {
    expect(defaultOf('usage_price.source_url')).toBe('https://example.com/model-prices');
    expect(currentValue('usage_price.source_url')).toBe('https://example.com/model-prices');
  });

  it('keep a saved value over the default, and come back to the default when it is dropped', () => {
    saved.set('usage_price.source_url', {
      value: 'https://prices.example.org/x',
      updatedAt: 'x',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    expect(currentValue('usage_price.source_url')).toBe('https://prices.example.org/x');
    saved.delete('usage_price.source_url');
    expect(currentValue('usage_price.source_url')).toBe('https://example.com/model-prices');
  });

  it('leave a key that has no default as it was: nothing', () => {
    expect(defaultOf('moderation.block_score')).toBeNull();
  });
});
