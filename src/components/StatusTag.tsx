import { Tag } from 'antd';

export type StatusOption = { label: string; color?: string };

/**
 * A status as a coloured tag. `options` maps each status code the page knows to its text (already
 * in the current language) and colour; a code that is not in it is shown as it is, never hidden.
 */
export function StatusTag({
  status,
  options,
}: {
  status: string | null | undefined;
  options: Record<string, StatusOption>;
}) {
  if (status === null || status === undefined || status === '') return <span>—</span>;
  const known = Object.hasOwn(options, status) ? options[status] : undefined;
  return <Tag color={known?.color}>{known?.label ?? status}</Tag>;
}
