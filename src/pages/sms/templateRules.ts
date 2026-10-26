import type { SmsType, TemplateInput, TemplatePatch } from '../../services/sms';
import { trimSpec } from '../../utils/trimSpec';

/** The placeholders that can be used in the content of a template (contract 23.4). */
export const SMS_PLACEHOLDERS = ['{code}', '{minutes}', '{appName}'] as const;

/** The placeholder that an OTP template must hold. */
export const CODE_PLACEHOLDER = '{code}';

/** An OTP template must hold `{code}` exactly (contract 23.4): `code`, `{CODE}` and `{ code }` do not count. Other types are not checked. */
export function otpContentProblem(
  content: string | undefined,
  smsType: SmsType | string | undefined,
): 'MISSING_CODE' | null {
  if (smsType !== 'OTP') return null;
  return typeof content === 'string' && content.includes(CODE_PLACEHOLDER) ? null : 'MISSING_CODE';
}

export type TemplateFormValues = {
  templateCode?: string;
  name: string;
  smsType: SmsType;
  locale: string;
  country?: string;
  content: string;
  providerTemplateId?: string;
  enabled?: boolean;
};

const orNull = (text: string | undefined): string | null => {
  const trimmed = trimSpec(text ?? '');
  return trimmed === '' ? null : trimmed;
};

export function buildTemplateBody(values: TemplateFormValues, mode: 'create'): TemplateInput;
export function buildTemplateBody(values: TemplateFormValues, mode: 'update'): TemplatePatch;
export function buildTemplateBody(
  values: TemplateFormValues,
  mode: 'create' | 'update',
): TemplateInput | TemplatePatch;
/** The body of a create or an update; an update has neither the code nor the switch. */
export function buildTemplateBody(
  values: TemplateFormValues,
  mode: 'create' | 'update',
): TemplateInput | TemplatePatch {
  const country = orNull(values.country);
  const common = {
    name: trimSpec(values.name),
    smsType: values.smsType,
    locale: trimSpec(values.locale),
    country: country === null ? null : country.toUpperCase(),
    content: trimSpec(values.content),
    providerTemplateId: orNull(values.providerTemplateId),
  };
  if (mode === 'update') return common;
  return {
    templateCode: trimSpec(values.templateCode ?? ''),
    ...common,
    enabled: values.enabled === true,
  };
}
