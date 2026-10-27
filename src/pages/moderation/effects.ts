import type {
  ModerationContentType,
  ModerationDecision,
  ModerationRecord,
} from '../../services/moderation';

const KNOWN: readonly ModerationContentType[] = [
  'AVATAR',
  'VOICE',
  'MESSAGE',
  'PERSONA',
  'COMPANION_NAME',
  'AVATAR_IMAGE',
  'ACTION_CLIP',
];

/**
 * The language key of what a decision does to this record (contract 11.4, table of effects). A
 * photo or a voice sample that comes from a report or a complaint is an asset that already exists,
 * and a rejection deletes it; the same type from an automatic check is an upload task that waits.
 * A type the page does not know gets a sentence that says so.
 */
export function effectKey(
  record: Pick<ModerationRecord, 'contentType' | 'source'>,
  decision: ModerationDecision,
): string {
  if (!KNOWN.includes(record.contentType)) return 'moderation.effect.UNKNOWN';
  const existingAsset =
    (record.contentType === 'AVATAR' || record.contentType === 'VOICE') && record.source !== 'AUTO';
  return `moderation.effect.${record.contentType}${existingAsset ? '.REPORTED' : ''}.${decision}`;
}
