import { describe, expect, it } from 'vitest';
import type { PushTemplate } from '../../services/push';
import { coverage, missingFor, supportedLocalesOf } from './coverage';

const t = (triggerReason: string, locale: string, enabled = true): PushTemplate => ({
  id: `${triggerReason}-${locale}`,
  triggerReason,
  locale,
  title: 'x',
  body: 'y',
  linkType: 'NONE',
  linkTarget: null,
  imageUrl: null,
  enabled,
});

describe('supportedLocalesOf (the languages of GET /meta)', () => {
  it('takes a list of tags, once each', () => {
    expect(supportedLocalesOf({ supportedLocales: ['en', 'th', 'en'] })).toEqual(['en', 'th']);
  });

  it.each([[undefined], [null], [[]], ['en'], [['en', 3]], [['en', '']], [{ 0: 'en' }]])(
    'is null (no matrix) for %j',
    (value) => {
      expect(supportedLocalesOf({ supportedLocales: value })).toBeNull();
    },
  );

  it('is null when meta itself has no such field', () => {
    expect(supportedLocalesOf({})).toBeNull();
  });
});

describe('coverage: a row for each recall reason, a cell for each supported language', () => {
  const templates = [
    t('daily_recall', 'en'),
    t('daily_recall', 'th', false),
    t('streak_at_risk', 'th'),
  ];

  it('puts the template in its cell and null where there is none', () => {
    const rows = coverage(templates, ['en', 'th']);
    expect(rows.map((r) => r.reason)).toEqual(['daily_recall', 'streak_at_risk']);
    expect(rows[0].cells.map((c) => [c.locale, c.template?.id ?? null])).toEqual([
      ['en', 'daily_recall-en'],
      ['th', 'daily_recall-th'],
    ]);
    expect(rows[1].cells.map((c) => [c.locale, c.template?.id ?? null])).toEqual([
      ['en', null],
      ['th', 'streak_at_risk-th'],
    ]);
  });

  it('does not count a template of another reason or of a language outside the list', () => {
    const rows = coverage([t('admin', 'en'), t('daily_recall', 'ar')], ['en']);
    expect(rows[0].cells[0].template).toBeNull();
    expect(rows[1].cells[0].template).toBeNull();
  });
});

describe('missingFor', () => {
  const templates = [t('daily_recall', 'en'), t('daily_recall', 'th'), t('streak_at_risk', 'th')];

  it('lists the supported languages the reason has no template in, in the order of the list', () => {
    expect(missingFor(templates, ['en', 'th', 'ar', 'vi'], 'daily_recall')).toEqual(['ar', 'vi']);
    expect(missingFor(templates, ['en', 'th'], 'streak_at_risk')).toEqual(['en']);
  });

  it('counts the language of a template that is being added', () => {
    expect(missingFor(templates, ['en', 'th'], 'streak_at_risk', 'en')).toEqual([]);
  });

  it('is empty when the supported languages are not known', () => {
    expect(missingFor(templates, null, 'streak_at_risk')).toEqual([]);
  });
});
