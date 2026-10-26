import { describe, expect, it } from 'vitest';
import { buildTemplateBody, otpContentProblem } from './templateRules';

describe('the content of an OTP template', () => {
  it('needs {code}, exactly', () => {
    expect(otpContentProblem('Your code is {code}', 'OTP')).toBeNull();
    expect(otpContentProblem('{code}', 'OTP')).toBeNull();
    expect(otpContentProblem('Your code is code', 'OTP')).toBe('MISSING_CODE');
    expect(otpContentProblem('Your code is {CODE}', 'OTP')).toBe('MISSING_CODE');
    expect(otpContentProblem('Your code is { code }', 'OTP')).toBe('MISSING_CODE');
    expect(otpContentProblem('Your code is {Code}', 'OTP')).toBe('MISSING_CODE');
    expect(otpContentProblem('', 'OTP')).toBe('MISSING_CODE');
    expect(otpContentProblem(undefined, 'OTP')).toBe('MISSING_CODE');
  });
  it('is not checked for a marketing template', () => {
    expect(otpContentProblem('Sale today', 'MARKETING')).toBeNull();
    expect(otpContentProblem('', 'MARKETING')).toBeNull();
  });
  it('is not checked until the type is chosen', () => {
    expect(otpContentProblem('Sale today', undefined)).toBeNull();
  });
});

describe('the body of a template', () => {
  const values = {
    templateCode: ' otp_th ',
    name: ' รหัส ',
    smsType: 'OTP' as const,
    locale: ' th ',
    country: ' th ',
    content: 'รหัสของคุณคือ {code}',
    providerTemplateId: ' ',
    enabled: false,
  };
  it('has the code and the switch on a create only, the optional fields empty as null, and the country in capitals', () => {
    expect(buildTemplateBody(values, 'create')).toEqual({
      templateCode: 'otp_th',
      name: 'รหัส',
      smsType: 'OTP',
      locale: 'th',
      country: 'TH',
      content: 'รหัสของคุณคือ {code}',
      providerTemplateId: null,
      enabled: false,
    });
    const update = buildTemplateBody(
      { ...values, country: '', providerTemplateId: ' 77 ' },
      'update',
    );
    expect(update).toEqual({
      name: 'รหัส',
      smsType: 'OTP',
      locale: 'th',
      country: null,
      content: 'รหัสของคุณคือ {code}',
      providerTemplateId: '77',
    });
  });
});
