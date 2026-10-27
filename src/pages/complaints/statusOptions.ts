import type { StatusOption } from '../../components/StatusTag';
import type { ComplaintStatus } from '../../services/complaints';

type Intl = { formatMessage: (d: { id: string }) => string };

/** The words and colours of the five states of a complaint. */
export const statusOptions = (intl: Intl): Record<ComplaintStatus, StatusOption> => ({
  RECEIVED: { label: intl.formatMessage({ id: 'complaints.status.RECEIVED' }), color: 'gold' },
  INVESTIGATING: {
    label: intl.formatMessage({ id: 'complaints.status.INVESTIGATING' }),
    color: 'processing',
  },
  RESOLVED_REMOVED: {
    label: intl.formatMessage({ id: 'complaints.status.RESOLVED_REMOVED' }),
    color: 'green',
  },
  RESOLVED_NOT_FOUND: {
    label: intl.formatMessage({ id: 'complaints.status.RESOLVED_NOT_FOUND' }),
    color: 'default',
  },
  REJECTED: { label: intl.formatMessage({ id: 'complaints.status.REJECTED' }), color: 'default' },
});
