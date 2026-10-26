/**
 * The app screens a push, an in-app notification or an ad can open (contract 8.3: the one list
 * they all share). The backend checks the target when it saves; a screen the app does not have
 * yet must be added to the contract first, then here.
 */
export const SCREEN_TARGETS: readonly string[] = [
  'conversation',
  'companion',
  'store',
  'credits',
  'settings',
  'notifications',
  'subscription',
  'checkin',
  'daily_tasks',
];
