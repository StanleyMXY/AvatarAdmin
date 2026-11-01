import { act, renderHook } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it } from 'vitest';
import enUS from '../locales/en-US';
import { ApiError } from '../request/errors';
import { failureToForm } from './failureToForm';

const intl = {
  messages: enUS as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }) => (enUS as Record<string, string>)[id] ?? id,
};
const refusal = (
  details: { ref: string; reason: string }[],
  httpStatus = 400,
  code = 'INVALID_REQUEST',
) => new ApiError({ code, httpStatus, message: 'raw backend words', data: { details } });

function formWith() {
  return renderHook(() => {
    const [form] = Form.useForm();
    return form;
  }).result.current;
}

describe('failureToForm', () => {
  it('returns the words of the error code, never the backend message', () => {
    const form = formWith();
    const { text } = failureToForm(intl, form, refusal([]), ['name']);
    expect(text).toBe(enUS['error.INVALID_REQUEST']);
    expect(text).not.toContain('raw backend words');
  });

  it('puts the words of a reason under the field it names, and under no other', () => {
    const form = formWith();
    let setFields: unknown[] = [];
    form.setFields = (fields) => {
      setFields = fields as unknown[];
    };
    act(() => {
      failureToForm(
        intl,
        form,
        refusal([
          { ref: 'name', reason: 'TOO_LONG' },
          { ref: 'other', reason: 'TOO_LONG' },
        ]),
        ['name'],
      );
    });
    expect(setFields).toEqual([{ name: 'name', errors: [enUS['reason.TOO_LONG']] }]);
  });

  it('follows an alias from the name the backend uses to the field of the form', () => {
    const form = formWith();
    let setFields: unknown[] = [];
    form.setFields = (fields) => {
      setFields = fields as unknown[];
    };
    failureToForm(intl, form, refusal([{ ref: 'linkTarget', reason: 'INVALID_HOST' }]), ['link'], {
      linkTarget: 'link',
    });
    expect(setFields).toEqual([{ name: 'link', errors: [enUS['reason.INVALID_HOST']] }]);
  });

  it('says when the backend refused the upload id that the request carried', () => {
    const form = formWith();
    expect(failureToForm(intl, form, refusal([], 409, 'INVALID_STATE'), []).uploadRejected).toBe(
      true,
    );
    expect(failureToForm(intl, form, refusal([]), []).uploadRejected).toBe(true);
    expect(failureToForm(intl, form, refusal([], 500, 'INTERNAL_ERROR'), []).uploadRejected).toBe(
      false,
    );
    expect(failureToForm(intl, form, new Error('x'), []).uploadRejected).toBe(false);
  });

  it('lists the text of each detail that no field of the form took, with the alias applied', () => {
    const form = formWith();
    form.setFields = () => {};
    const result = failureToForm(
      intl,
      form,
      refusal([
        { ref: 'name', reason: 'TOO_LONG' },
        { ref: 'linkTarget', reason: 'INVALID_HOST' },
        { ref: 'elsewhere', reason: 'TOO_LONG' },
      ]),
      ['name', 'link'],
      { linkTarget: 'link' },
    );
    expect(result.unplaced).toEqual([enUS['reason.TOO_LONG']]);
    expect(failureToForm(intl, form, refusal([]), ['name']).unplaced).toEqual([]);
  });

  it('gives the error code of the failure, and the code of a network failure for anything else', () => {
    const form = formWith();
    expect(failureToForm(intl, form, refusal([], 409, 'INVALID_STATE'), []).code).toBe(
      'INVALID_STATE',
    );
    expect(failureToForm(intl, form, new Error('x'), []).code).toBe('NETWORK_ERROR');
  });

  it('shows the reason code of a reason the language file does not know, unless it is told to say "not valid"', () => {
    const form = formWith();
    let setFields: unknown[] = [];
    form.setFields = (fields) => {
      setFields = fields as unknown[];
    };
    const details = [
      { ref: 'name', reason: 'BRAND_NEW_REASON' },
      { ref: 'body', reason: 'TOO_LONG' },
    ];
    failureToForm(intl, form, refusal(details), ['name', 'body']);
    expect(setFields).toEqual([
      { name: 'name', errors: ['BRAND_NEW_REASON'] },
      { name: 'body', errors: [enUS['reason.TOO_LONG']] },
    ]);
    const result = failureToForm(
      intl,
      form,
      refusal(details),
      ['name'],
      {},
      { generalReason: true },
    );
    expect(setFields).toEqual([{ name: 'name', errors: [enUS['error.INVALID_REQUEST']] }]);
    expect(result.unplaced).toEqual([enUS['reason.TOO_LONG']]);
  });

  it('never shows the backend message for a single unknown reason when it is told to say "not valid"', () => {
    const form = formWith();
    let setFields: unknown[] = [];
    form.setFields = (fields) => {
      setFields = fields as unknown[];
    };
    const single = refusal([{ ref: 'name', reason: 'BRAND_NEW_REASON' }]);
    failureToForm(intl, form, single, ['name']);
    expect(setFields).toEqual([{ name: 'name', errors: ['raw backend words'] }]);
    failureToForm(intl, form, single, ['name'], {}, { generalReason: true });
    expect(setFields).toEqual([{ name: 'name', errors: [enUS['error.INVALID_REQUEST']] }]);
  });

  it('follows an alias also when it says "not valid", and places nothing for a failure without details', () => {
    const form = formWith();
    let setFields: unknown[] | null = null;
    form.setFields = (fields) => {
      setFields = fields as unknown[];
    };
    failureToForm(
      intl,
      form,
      refusal([{ ref: 'linkTarget', reason: 'INVALID_HOST' }]),
      ['link'],
      { linkTarget: 'link' },
      { generalReason: true },
    );
    expect(setFields).toEqual([{ name: 'link', errors: [enUS['reason.INVALID_HOST']] }]);
    setFields = null;
    failureToForm(intl, form, new Error('x'), ['link'], {}, { generalReason: true });
    expect(setFields).toBeNull();
  });
});
