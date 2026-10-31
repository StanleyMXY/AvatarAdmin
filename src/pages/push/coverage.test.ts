import { describe, expect, it } from 'vitest';
import type { PushTemplate } from '../../services/push';
import { coverage, supportedLocalesOf } from './coverage';

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
  const missing = { daily_recall: ['th'], streak_at_risk: ['en'] };

  it('puts the template in its cell and null where there is none', () => {
    const rows = coverage(templates, ['en', 'th'], missing);
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

  it('marks a cell as falling back to the default language only where the backend lists the language, and never works it out from the templates', () => {
    const rows = coverage(templates, ['en', 'th'], missing);
    expect(rows[0].cells.map((c) => c.fallback)).toEqual([false, true]);
    expect(rows[1].cells.map((c) => c.fallback)).toEqual([true, false]);
    // The backend says the language is covered although the page sees no template: the page does not argue.
    const other = coverage([], ['en'], { daily_recall: [], streak_at_risk: [] });
    expect(other[0].cells[0]).toEqual({ locale: 'en', template: null, fallback: false });
  });

  it('says that a reason has no enabled template when the backend lists every supported language for it, and then marks no cell as falling back, the default language cell least of all', () => {
    const rows = coverage(templates, ['en', 'th'], {
      daily_recall: ['th'],
      streak_at_risk: ['en', 'th'],
    });
    expect(rows.map((r) => r.noneEnabled)).toEqual([false, true]);
    expect(rows[1].cells.map((c) => c.fallback)).toEqual([false, false]);
    expect(rows[0].cells.map((c) => c.fallback)).toEqual([false, true]);
  });

  it('does not say it from a partial list, an empty list of languages, or no list', () => {
    expect(
      coverage(templates, ['en', 'th'], { daily_recall: ['en'], streak_at_risk: ['th'] }).map(
        (r) => r.noneEnabled,
      ),
    ).toEqual([false, false]);
    expect(
      coverage(templates, [], { daily_recall: [], streak_at_risk: [] }).map((r) => r.noneEnabled),
    ).toEqual([false, false]);
    expect(coverage(templates, ['en'], null).map((r) => r.noneEnabled)).toEqual([false, false]);
  });

  it('does not know when the backend sent no list, or none for the reason', () => {
    for (const none of [null, {}, { daily_recall: ['en'] }] as (Record<
      string,
      string[]
    > | null)[]) {
      const rows = coverage(templates, ['en'], none);
      expect(rows[1].cells[0].fallback).toBeNull();
    }
  });

  it('does not count a template of another reason or of a language outside the list', () => {
    const rows = coverage([t('admin', 'en'), t('daily_recall', 'ar')], ['en'], null);
    expect(rows[0].cells[0].template).toBeNull();
    expect(rows[1].cells[0].template).toBeNull();
  });
});
