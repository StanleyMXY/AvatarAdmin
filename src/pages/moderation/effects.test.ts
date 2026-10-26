import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { MODERATION_CONTENT_TYPES, MODERATION_SOURCES } from '../../services/moderation';
import { effectKey } from './effects';

describe('what a decision does (contract 11.4)', () => {
  it('has a text in both languages for every content type, source and decision', () => {
    for (const contentType of MODERATION_CONTENT_TYPES) {
      for (const source of MODERATION_SOURCES) {
        for (const decision of ['APPROVE', 'REJECT'] as const) {
          const key = effectKey({ contentType, source }, decision);
          expect(zhCN[key], key).toBeTruthy();
          expect(enUS[key], key).toBeTruthy();
          expect(key).not.toBe('moderation.effect.UNKNOWN');
        }
      }
    }
  });

  it('treats a photo or a voice sample from a report or a complaint as an asset that exists already', () => {
    expect(effectKey({ contentType: 'AVATAR', source: 'AUTO' }, 'REJECT')).toBe(
      'moderation.effect.AVATAR.REJECT',
    );
    expect(effectKey({ contentType: 'AVATAR', source: 'REPORT' }, 'REJECT')).toBe(
      'moderation.effect.AVATAR.REPORTED.REJECT',
    );
    expect(effectKey({ contentType: 'VOICE', source: 'COMPLAINT' }, 'APPROVE')).toBe(
      'moderation.effect.VOICE.REPORTED.APPROVE',
    );
  });

  it('does not split the other types by source', () => {
    for (const source of MODERATION_SOURCES) {
      expect(effectKey({ contentType: 'MESSAGE', source }, 'REJECT')).toBe(
        'moderation.effect.MESSAGE.REJECT',
      );
    }
  });

  it('says that it does not know a content type it has not been told about', () => {
    expect(effectKey({ contentType: 'HOLOGRAM' as never, source: 'AUTO' }, 'REJECT')).toBe(
      'moderation.effect.UNKNOWN',
    );
  });
});
