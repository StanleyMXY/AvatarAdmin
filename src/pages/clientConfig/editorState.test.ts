import { describe, expect, it } from 'vitest';
import type { ClientConfigItem } from '../../services/clientConfig';
import {
  addLanguage,
  type Draft,
  draftOf,
  isChanged,
  problemsOf,
  removeLanguage,
  setValue,
  valuesOf,
} from './editorState';

const item = (over: Partial<ClientConfigItem> = {}): ClientConfigItem => ({
  key: 'privacyPolicyUrl',
  type: 'URL',
  localized: true,
  readOnly: false,
  configured: true,
  defaultValue: null,
  values: { '': 'https://a.example/p', th: 'https://a.example/th', ar: 'https://a.example/ar' },
  updatedBy: '1001',
  updatedByUsername: 'root',
  updatedAt: '2026-10-20T00:00:00Z',
  ...over,
});

describe('draftOf: the values of a key as a list of languages', () => {
  it('puts the default first, then the languages in alphabetical order', () => {
    expect(draftOf(item()).map((e) => e.locale)).toEqual(['', 'ar', 'th']);
    expect(
      draftOf(item({ values: { th: 'https://a.example/t', '': 'https://a.example/d' } })).map(
        (e) => e.locale,
      ),
    ).toEqual(['', 'th']);
  });

  it('is empty for a key that is not configured', () => {
    expect(draftOf(item({ values: {}, configured: false }))).toEqual([]);
  });

  it('is empty when values is not an object', () => {
    for (const values of [null, undefined, 'x', 5, ['a']]) {
      expect(draftOf(item({ values: values as never })), String(values)).toEqual([]);
    }
  });

  it('turns a value of the wrong type into the value the editor of the type works with', () => {
    expect(draftOf(item({ type: 'URL', values: { '': 5 as never } }))[0].value).toBe('5');
    expect(draftOf(item({ type: 'STRING', values: { '': { a: 1 } as never } }))[0].value).toBe(
      '{"a":1}',
    );
    expect(draftOf(item({ type: 'BOOLEAN', values: { '': 'yes' as never } }))[0].value).toBe(false);
    expect(draftOf(item({ type: 'BOOLEAN', values: { '': true } }))[0].value).toBe(true);
    expect(draftOf(item({ type: 'INT', values: { '': '7' as never } }))[0].value).toBeNull();
    expect(draftOf(item({ type: 'INT', values: { '': 7 } }))[0].value).toBe(7);
  });

  it('keeps odd language keys as they are', () => {
    const odd = item({
      values: {
        __proto__x: 'https://a.example',
        ไทย: 'https://a.example/t',
        '': 'https://a.example',
      } as never,
    });
    expect(draftOf(odd).map((e) => e.locale)).toEqual(['', '__proto__x', 'ไทย']);
  });
});

describe('valuesOf: what is saved', () => {
  it('is the whole map, trimmed where the type is trimmed, with "" for the default', () => {
    const draft: Draft = [
      { locale: '', value: ' https://a.example/d ' },
      { locale: 'th', value: 'https://a.example/t' },
    ];
    expect(valuesOf('URL', draft)).toEqual({
      '': 'https://a.example/d',
      th: 'https://a.example/t',
    });
  });

  it('keeps an own key named __proto__ as a key', () => {
    const values = valuesOf('STRING', [{ locale: '__proto__', value: 'x' }]);
    expect(Object.keys(values)).toEqual(['__proto__']);
    expect(JSON.stringify(values)).toBe('{"__proto__":"x"}');
  });

  it('leaves out a language whose value is nothing yet (an empty number box)', () => {
    expect(valuesOf('INT', [{ locale: '', value: null }])).toEqual({});
  });
});

describe('problemsOf: every language is checked, the key is saved only when none has a problem', () => {
  it('reports each failing language by its reason, in the order of the draft', () => {
    const draft: Draft = [
      { locale: '', value: 'https://a.example/d' },
      { locale: 'th', value: 'http://a.example/t' },
      { locale: 'ar', value: '' },
      { locale: 'es', value: 'https://a.example/es' },
    ];
    expect(problemsOf('URL', draft)).toEqual([
      { locale: 'th', reason: 'NOT_HTTPS' },
      { locale: 'ar', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
  });

  it('has no problem when all are fine', () => {
    expect(problemsOf('URL', [{ locale: '', value: 'https://a.example/d' }])).toEqual([]);
  });

  it('says a key with no language at all cannot be saved (an empty values map is refused)', () => {
    expect(problemsOf('URL', [])).toEqual([{ locale: null, reason: 'EMPTY_NOT_ALLOWED' }]);
  });
});

describe('isChanged', () => {
  it('is false for the draft the item gives, and true after any edit, add or remove', () => {
    const original = item();
    const draft = draftOf(original);
    expect(isChanged(original, draft)).toBe(false);
    expect(isChanged(original, setValue(draft, 'th', 'https://a.example/new'))).toBe(true);
    expect(isChanged(original, removeLanguage(draft, 'th'))).toBe(true);
    const added = addLanguage(draft, 'es');
    expect(added.ok && isChanged(original, added.draft)).toBe(true);
  });

  it('is false when a value was changed and put back', () => {
    const original = item();
    const draft = setValue(setValue(draftOf(original), 'th', 'x'), 'th', 'https://a.example/th');
    expect(isChanged(original, draft)).toBe(false);
  });

  it('does not depend on the order of the languages', () => {
    const original = item();
    expect(isChanged(original, [...draftOf(original)].reverse())).toBe(false);
  });

  it('is true for a key that is not configured once a value is typed', () => {
    const original = item({ values: {}, configured: false });
    expect(isChanged(original, [])).toBe(false);
    expect(isChanged(original, [{ locale: '', value: '' }])).toBe(true);
  });
});

describe('addLanguage and removeLanguage', () => {
  it('adds a language with an empty value of the type, refuses a bad or repeated tag', () => {
    const draft = draftOf(item());
    const added = addLanguage(draft, ' es ');
    expect(added.ok && added.draft.map((e) => e.locale)).toEqual(['', 'ar', 'th', 'es']);
    expect(addLanguage(draft, 'TH')).toEqual({ ok: false, problem: 'DUPLICATE' });
    expect(addLanguage(draft, 'not a tag')).toEqual({ ok: false, problem: 'INVALID_LANGUAGE_TAG' });
    expect(addLanguage(draft, '')).toEqual({ ok: false, problem: 'INVALID_LANGUAGE_TAG' });
  });

  it('starts a language with the initial value it is given, also null (an empty number box) and false', () => {
    const draft = draftOf(item());
    const initial = (value: unknown) => {
      const result = addLanguage(draft, 'es', { initial: value });
      return result.ok ? result.draft.at(-1)?.value : 'refused';
    };
    expect(initial(null)).toBeNull();
    expect(initial(false)).toBe(false);
    expect(initial('')).toBe('');
    expect(addLanguage(draft, 'es').ok && addLanguage(draft, 'es')).toMatchObject({ ok: true });
  });

  it('adds the default when it is not there (the empty tag is only for it)', () => {
    const draft = draftOf(item({ values: { th: 'https://a.example/t' } }));
    expect(addLanguage(draft, '', { allowDefault: true })).toMatchObject({ ok: true });
  });

  it('removes one language and leaves the others', () => {
    expect(removeLanguage(draftOf(item()), 'th').map((e) => e.locale)).toEqual(['', 'ar']);
  });
});
