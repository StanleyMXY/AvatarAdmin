/**
 * What the column of row actions (edit, delete, ...) of every table has in common: it stays at the
 * right edge while the other columns scroll sideways. Without it a wide table puts the buttons out of
 * sight, and nothing on the page says that they are there. A table needs `scroll.x` for this to work.
 */
export const ACTIONS_COLUMN = { fixed: 'right' } as const;
