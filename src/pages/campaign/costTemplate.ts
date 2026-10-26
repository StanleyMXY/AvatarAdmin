/** The file name the template is saved as (spec 5.13). */
export const TEMPLATE_FILE_NAME = 'attribution-cost-template.csv';

/** The header of a CSV of costs: what the page reads and what the template starts with. */
export const CSV_HEADER = 'campaign_code,stat_date,cost,currency,remark';

/** The largest file the page reads into the browser's memory before it refuses it. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Written as a code so that no invisible character stands in the source.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** One value of a CSV line: in quotes, with the quotes doubled, when it holds a comma, a quote or a line break. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * The template: the header and two example rows (one with a day written with slashes, one with a
 * comma in the remark, so that the quotes show). It starts with a byte order mark, so that a
 * spreadsheet program reads the remarks as UTF-8; the page reads a file with or without the mark.
 */
export function buildCostTemplate(options: {
  currency: string;
  remarks: [string, string];
}): string {
  const { currency, remarks } = options;
  const rows = [
    ['example_campaign', '2026-01-15', '123.45', currency, remarks[0]],
    ['example_campaign', '2026/01/16', '98.00', currency, remarks[1]],
  ];
  return `${BYTE_ORDER_MARK}${[CSV_HEADER, ...rows.map((row) => row.map(csvField).join(','))].join('\r\n')}\r\n`;
}
