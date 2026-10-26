import { describe, expect, it } from 'vitest';
import {
  daysAgoIso,
  makeUuid,
  multilingualSamples,
  SAMPLE_LANGUAGES,
  sampleAny,
  sampleText,
} from './fixtures';

describe('multilingualSamples', () => {
  it('has samples in Thai, Arabic, Indonesian, Vietnamese, Spanish, English and Chinese', () => {
    expect([...SAMPLE_LANGUAGES].sort()).toEqual(['ar', 'en', 'es', 'id', 'th', 'vi', 'zh']);
    for (const language of SAMPLE_LANGUAGES)
      expect(multilingualSamples[language].length).toBeGreaterThanOrEqual(3);
  });

  it('really is in those scripts', () => {
    expect(multilingualSamples.th.join('')).toMatch(/[฀-๿]/);
    expect(multilingualSamples.ar.join('')).toMatch(/[؀-ۿ]/);
    expect(multilingualSamples.zh.join('')).toMatch(/[一-鿿]/);
    expect(multilingualSamples.vi.join('')).toMatch(/[ạảãàáâậầấẩẫăắằặẳẵ]/);
    expect(multilingualSamples.es.join('')).toMatch(/[¿¡ñáéíóú]/);
  });

  it('has a long string without any space and a code point outside the BMP', () => {
    expect(multilingualSamples.longUnbroken.length).toBeGreaterThan(200);
    expect(multilingualSamples.longUnbroken).not.toMatch(/\s/);
    const all = SAMPLE_LANGUAGES.flatMap((l) => multilingualSamples[l]).join('');
    expect([...all].some((ch) => (ch.codePointAt(0) ?? 0) > 0xffff)).toBe(true);
  });

  it('contains no Korean', () => {
    const text = JSON.stringify(multilingualSamples);
    expect(text).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
  });
});

describe('sampleText and sampleAny', () => {
  it('cycle through the lists', () => {
    expect(sampleText('th', 0)).toBe(multilingualSamples.th[0]);
    expect(sampleText('th', multilingualSamples.th.length)).toBe(multilingualSamples.th[0]);
  });

  it('sampleAny visits every language in turn', () => {
    const first = Array.from({ length: 7 }, (_, i) => sampleAny(i));
    expect(new Set(first).size).toBe(7);
  });
});

describe('makeUuid and daysAgoIso', () => {
  it('makeUuid gives a v4 UUID, different each time', () => {
    expect(makeUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(makeUuid()).not.toBe(makeUuid());
  });

  it('daysAgoIso is an ISO-8601 UTC time n days before', () => {
    const from = new Date('2026-10-21T17:30:00.000Z');
    expect(daysAgoIso(0, from)).toBe('2026-10-21T17:30:00.000Z');
    expect(daysAgoIso(1, from)).toBe('2026-10-20T17:30:00.000Z');
    expect(daysAgoIso(30, from)).toBe('2026-09-21T17:30:00.000Z');
  });
});
