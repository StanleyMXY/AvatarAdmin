import { describeFailure } from './describe';

/**
 * One line for a message bar that cannot have fields to put the details beside: the text of the
 * error, then each detail as `name: reason` in the current language, joined with " / ". A refusal
 * without details gives just the text of the error.
 */
export function failureLine(intl: Parameters<typeof describeFailure>[0], failure: unknown): string {
  const { text, fields } = describeFailure(intl, failure);
  return [text, ...fields.map((field) => `${field.ref}: ${field.text}`)].join(' / ');
}
