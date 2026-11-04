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

/** What the backend takes for a placeholder in a subject or a body: braces around a letter and then letters or digits (EmailTemplateService.TOKEN). */
const TOKEN = /\{[A-Za-z][A-Za-z0-9]*\}/g;

/**
 * The placeholders written in the text that the template does not list, each once, in the order
 * they first appear. The backend refuses a subject or a body with any of them, and answers without
 * saying which one, so the dialog says it first.
 */
export function unknownPlaceholders(text: string, allowed: unknown): string[] {
  const known = new Set(listOfText(allowed));
  return [...new Set(text.match(TOKEN) ?? [])].filter((token) => !known.has(token));
}
