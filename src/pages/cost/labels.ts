import { plainText } from '../../utils/plainText';

/** The parts of `useIntl()` the labels need. */
type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** The text of a code (`cost.source.CALL`); a code the page does not know is shown as it is, never hidden. */
export function labelOf(intl: Translator, prefix: string, code: unknown): string {
  const text = plainText(code);
  const id = `${prefix}.${text}`;
  return Object.hasOwn(intl.messages, id) ? intl.formatMessage({ id }) : text;
}

/** A quantity with its unit (`12.5 s`); a unit the page does not know follows the number as it is. */
export function quantityText(intl: Translator, quantity: string, unit: string): string {
  const id = `cost.quantity.${unit}`;
  return Object.hasOwn(intl.messages, id)
    ? intl.formatMessage({ id }, { value: quantity })
    : `${quantity} ${plainText(unit)}`;
}

/** A model name for a legend: at most 24 code points, then an ellipsis; two names that become the same get a number. */
export function legendLabels(models: string[]): Map<string, string> {
  const taken = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const model of [...models].sort()) {
    const points = [...model];
    const base = points.length > 24 ? `${points.slice(0, 24).join('')}…` : model;
    const n = (taken.get(base) ?? 0) + 1;
    taken.set(base, n);
    labels.set(model, n === 1 ? base : `${base} (${n})`);
  }
  return labels;
}
