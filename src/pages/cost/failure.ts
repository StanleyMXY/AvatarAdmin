import { describeFailure } from '../../session/describe';

type Translator = Parameters<typeof describeFailure>[0];

/** The fields of a band, by the name the backend gives in a path (`bands[1].inputMinTokens`), and the language key of the label of its input. */
const BAND_FIELD_LABEL = {
  inputMinTokens: 'cost.manual.band.min',
  inputMaxTokens: 'cost.manual.band.max',
  inputPrice: 'cost.manual.band.input',
  cachedInputPrice: 'cost.manual.band.cached',
  outputPrice: 'cost.manual.band.output',
} as const;
export type BandField = keyof typeof BAND_FIELD_LABEL;

/** The place a `ref` such as `bands[1].inputMinTokens` names: the band (counted from 0) and its field; null for any other ref. */
export function bandPlace(ref: string): { index: number; field: BandField } | null {
  const found = /^bands\[(\d+)\]\.([A-Za-z]+)$/.exec(ref);
  if (!found || !Object.hasOwn(BAND_FIELD_LABEL, found[2])) return null;
  return { index: Number(found[1]), field: found[2] as BandField };
}

/** The words of a reason code of the language files, or null when this app has none for it (the backend's own word is never shown). */
export function reasonWords(intl: Translator, reason: string): string | null {
  const id = `reason.${reason}`;
  return intl.messages[id] ? intl.formatMessage({ id }) : null;
}

/**
 * The line to show for one refused field of a price: the words given for its `ref` (a language-file
 * key) instead of the words of its reason; for a field of a band, the label of that input in front
 * of the words of the reason ("Band 2: lower bound (tokens): ..."); otherwise the words of the
 * reason. Null when there are no words for it.
 */
export function refusalLine(
  intl: Translator,
  detail: { ref: string; reason: string },
  refTexts: Record<string, string> = {},
): string | null {
  const given = refTexts[detail.ref];
  if (given !== undefined) return intl.messages[given] ? intl.formatMessage({ id: given }) : null;
  const reason = reasonWords(intl, detail.reason);
  if (reason === null) return null;
  const band = bandPlace(detail.ref);
  if (band === null) return reason;
  return intl.formatMessage(
    { id: 'cost.refused.field' },
    {
      field: intl.formatMessage({ id: BAND_FIELD_LABEL[band.field] }, { n: band.index + 1 }),
      reason,
    },
  );
}

/**
 * What to show for a failed write: the text of the error code and, for a refused input, the text of
 * each reason that this app has a translation for. The backend's own words are never shown for a code
 * that is known; a reason that is not translated is left out.
 */
export function failureLines(
  intl: Translator,
  failure: unknown,
  /** The language-file key of the words to say for a refused field (`ref`) instead of the words of its reason. */
  refTexts: Record<string, string> = {},
): { text: string; reasons: string[] } {
  const { error, text } = describeFailure(intl, failure);
  const reasons = [
    ...new Set(
      error.details
        .map((detail) => refusalLine(intl, detail, refTexts))
        .filter((line): line is string => line !== null),
    ),
  ];
  return { text, reasons };
}
