import { useIntl } from '@umijs/max';
import { useCallback, useMemo, useState } from 'react';
import { describeFailure, type Translator } from '../session/describe';

/**
 * How to say a failure: a function of the translator, called when the page is drawn, so that the
 * words follow the language of that moment. A page keeps this (or the failure itself) in its
 * state, never the text that `describeFailure` made, which stays in the language it was made in.
 */
export type Words = (intl: Translator) => string;

/** The words of an error: the text of its code, in the language of the moment the page is drawn. */
export const wordsOf =
  (error: unknown): Words =>
  (intl) =>
    describeFailure(intl, error).text;

/**
 * A failure shown as more than one sentence (a text and the lines under it): `show` keeps the
 * function that makes `view` from the translator, and `view` is what it makes now, in the
 * current language. `clear` takes the failure away.
 */
export function useFailureView<V>() {
  const intl = useIntl();
  const [made, setMade] = useState<{ make: (intl: Translator) => V } | null>(null);
  const view = useMemo(() => (made === null ? null : made.make(intl)), [intl, made]);
  const show = useCallback((make: (intl: Translator) => V) => setMade({ make }), []);
  const clear = useCallback(() => setMade(null), []);
  return { view, show, clear };
}

/**
 * The failure a page shows in a bar or a message, kept so that it follows the language. `fail` keeps
 * the error itself (`failWith` keeps a function that makes the words from the translator, for
 * words that need more than the error: a hint, a list of fields). `text` is the words in the
 * current language, null when there is no failure. `clear` takes the failure away.
 */
export function useFailure() {
  const { view, show, clear } = useFailureView<string>();
  const fail = useCallback((error: unknown) => show(wordsOf(error)), [show]);
  return { text: view, fail, failWith: show, clear };
}

/** A failure bar with lines under it: the text of the error, and the details that no field of the form took. */
export type FailureLines = { text: string; more: string[] };
