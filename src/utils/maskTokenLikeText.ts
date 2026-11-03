/**
 * Hides what looks like a purchase token or another long random string in a text the backend wrote
 * (the error of a store event): a run of twenty or more letters, digits, `-`, `_` and `.` becomes its
 * first four characters, an ellipsis and its last six (the same shape as the tail of a token that the
 * subscription pages show). The side of caution: a long code name is hidden too. Words of other
 * scripts are not in the set and stay as they are. One pass, and every run is read once.
 */
const RUN = /[A-Za-z0-9_.-]{20,}/g;
const KEEP_START = 4;
const KEEP_END = 6;

export function maskTokenLikeText(text: string): string {
  return text.replace(RUN, (run) => {
    // Full stops and dashes at the end belong to the sentence, not to the string.
    let end = run.length;
    while (end > 0 && (run[end - 1] === '.' || run[end - 1] === '-')) end -= 1;
    if (end < 20) return run;
    return `${run.slice(0, KEEP_START)}…${run.slice(end - KEEP_END, end)}${run.slice(end)}`;
  });
}
