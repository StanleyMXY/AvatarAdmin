import type { StatusOption } from '../../components/StatusTag';

/** The part of `useIntl()` that is needed here. */
type Intl = { messages: Record<string, unknown>; formatMessage: (d: { id: string }) => string };

/** The text of a category; a category this page does not know is shown as it is. */
export const categoryText = (intl: Intl, category: string): string => {
  const id = `support.category.${category}`;
  return intl.messages[id] ? intl.formatMessage({ id }) : category;
};

/** The words and colours of the forwarding states (contract 12). */
export const statusOptions = (intl: Intl): Record<string, StatusOption> => ({
  PENDING: { label: intl.formatMessage({ id: 'support.status.PENDING' }), color: 'gold' },
  FORWARDED: { label: intl.formatMessage({ id: 'support.status.FORWARDED' }), color: 'green' },
  FAILED: { label: intl.formatMessage({ id: 'support.status.FAILED' }), color: 'red' },
});
