import type { Translator } from '../../utils/displayText';

const LIFECYCLE_COLOR: Record<string, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  ENDED: 'warning',
  DISABLED: 'error',
};

/** The status tags of a sign-in activity: its words in the current language and a colour for each state. */
export function lifecycleOptions(
  intl: Translator,
): Record<string, { label: string; color: string }> {
  return Object.fromEntries(
    ['DRAFT', 'ACTIVE', 'ENDED', 'DISABLED'].map((status) => [
      status,
      {
        label: intl.formatMessage({ id: `activity.lifecycle.${status}` }),
        color: LIFECYCLE_COLOR[status],
      },
    ]),
  );
}
