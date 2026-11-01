import { renderHook } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
import { failureToForm } from './formFailure';

const intl = {
  messages: enUS as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }) => (enUS as Record<string, string>)[id] ?? id,
};

function formWith() {
  const form = renderHook(() => Form.useForm()[0]).result.current;
  const set: unknown[][] = [];
  form.setFields = (fields) => {
    set.push(fields as unknown[]);
  };
  return { form, set };
}

const duplicate = (data: unknown) =>
  new ApiError({ code: 'DUPLICATE_RESOURCE', httpStatus: 409, message: 'raw words', data });
const invalid = (details: { ref: string; reason: string }[]) =>
  new ApiError({
    code: 'INVALID_REQUEST',
    httpStatus: 400,
    message: 'raw words',
    data: { details },
  });

describe('failureToForm of the system pages', () => {
  it('puts a duplicate under the field that the backend names, and has no text for the bar', () => {
    const { form, set } = formWith();
    const result = failureToForm(intl, form, duplicate({ field: 'username' }), [
      'username',
      'remark',
    ]);
    expect(result).toEqual({ text: null, unplaced: [] });
    expect(set).toEqual([[{ name: 'username', errors: [enUS['error.DUPLICATE_RESOURCE']] }]]);
  });

  it('keeps the text for the bar when the duplicate names no field of the form, or none', () => {
    for (const data of [{ field: 'elsewhere' }, { field: 7 }, null, undefined]) {
      const { form, set } = formWith();
      const result = failureToForm(intl, form, duplicate(data), ['username']);
      expect(result).toEqual({ text: enUS['error.DUPLICATE_RESOURCE'], unplaced: [] });
      expect(set).toEqual([]);
    }
  });

  it('places the reasons of a refusal under their fields and lists the others, in the words of the file', () => {
    const { form, set } = formWith();
    const result = failureToForm(
      intl,
      form,
      invalid([
        { ref: 'name', reason: 'TOO_LONG' },
        { ref: 'remark', reason: 'BRAND_NEW_REASON' },
      ]),
      ['name'],
    );
    expect(set).toEqual([[{ name: 'name', errors: [enUS['reason.TOO_LONG']] }]]);
    expect(result.text).toBe(enUS['error.INVALID_REQUEST']);
    // A reason the file does not know says "not valid", never the reason code or the backend words.
    expect(result.unplaced).toEqual([enUS['error.INVALID_REQUEST']]);
  });

  it('shows a failure that is not an answer of the backend as a network failure', () => {
    const { form, set } = formWith();
    const result = failureToForm(intl, form, new Error('x'), ['name']);
    expect(result).toEqual({ text: enUS['error.NETWORK_ERROR'], unplaced: [] });
    expect(set).toEqual([]);
  });
});
