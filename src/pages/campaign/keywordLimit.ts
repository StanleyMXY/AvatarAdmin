import { countCodePoints } from '../../utils/codePoints';

/** The longest keyword of the campaign list, in code points (contract 10.5). */
export const CAMPAIGN_KEYWORD_MAX = 100;
/** The longest keyword of the click list, in characters (contract 10.3), counted here as code points. */
export const CLICK_KEYWORD_MAX = 200;

/**
 * The `count` prop of an antd `Input` that stops a text at `max` code points (an emoji is one, not
 * two) and never cuts a pair of UTF-16 units in the middle, also for a pasted text. No counter is
 * drawn: the box simply takes no more.
 */
export const codePointLimit = (max: number) => ({
  max,
  strategy: countCodePoints,
  exceedFormatter: (value: string, config: { max?: number }) =>
    [...value].slice(0, config.max ?? max).join(''),
});
