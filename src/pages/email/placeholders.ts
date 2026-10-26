/** The entries of a list from the backend that are text; anything else (a number, null) is dropped. A value that is not a list is an empty list. */
export function listOfText(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/**
 * The required placeholders that the body does not hold, in the order of the list. A placeholder is
 * found only when the body holds exactly the string the backend gave, braces included: `code`,
 * `{CODE}` and `{ code }` do not count as `{code}`. Case is not folded and nothing is added or cut,
 * because the backend checks the body in just this way (contract 17.4, reply 2 of the backend).
 */
export function missingPlaceholders(body: string, required: unknown): string[] {
  return listOfText(required).filter((placeholder) => !body.includes(placeholder));
}
