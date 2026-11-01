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
});
