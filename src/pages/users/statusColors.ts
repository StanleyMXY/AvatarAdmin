/** The colour of the tag of each account state and deletion task state. */
export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  BANNED: 'red',
  PENDING_DELETION: 'orange',
  DELETING: 'volcano',
  SCHEDULED: 'orange',
  CANCELED: 'default',
  PENDING: 'blue',
  RUNNING: 'processing',
  FAILED: 'red',
  COMPLETED: 'green',
};
