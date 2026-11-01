import { useAccess, useIntl } from '@umijs/max';
import { Alert, Flex } from 'antd';
import { useEffect, useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
import { type AdPlacement, listCreatives, listUnits, loadAllPages } from '../../services/ads';
import { listConfig } from '../../services/config';

const FULL_SCREEN = ['SPLASH', 'INTERSTITIAL'];

/** How many creatives that cannot be skipped there are on the splash and interstitial placements, or `null` when that cannot be read. */
async function countNotSkippable(placements: AdPlacement[]): Promise<number | null> {
  try {
    const formatOf = new Map(placements.map((p) => [String(p.id), p.adFormat]));
    const units = await loadAllPages((page, pageSize) => listUnits({ page, pageSize }));
    const unitFormat = new Map(
      units.map((u) => [String(u.id), formatOf.get(String(u.placementId))]),
    );
    const creatives = await loadAllPages((page, pageSize) => listCreatives({ page, pageSize }));
    // A rejected creative is never served, so it does not count; any other can be.
    return creatives.filter(
      (c) =>
        c.skippable === false &&
        c.reviewStatus !== 'REJECTED' &&
        FULL_SCREEN.includes(String(unitFormat.get(String(c.adUnitId)))),
    ).length;
  } catch {
    return null;
  }
}

type Found = { skipAfter: number | null; forceClose: number | null; notSkippable: number | null };

/**
 * The two risks of the global settings that stay on the page: a skip countdown of more than 5
 * seconds, and a forced close of 0 (off) while a splash or interstitial creative cannot be skipped
 * (then there is no way to close it). Neither stops a save; the backend says the same in the
 * `warnings` of a save, which the row of the setting shows. The count needs the creatives, so an
 * administrator without ADS:CREATIVE gets the warning without it.
 */
export function AdsWarnings({
  placements,
  version = 0,
}: {
  placements: AdPlacement[] | null;
  /** Changes when a setting was saved: the values are read again. */
  version?: number;
}) {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canReadCreatives = access.canAccess('ADS:CREATIVE');
  const [found, setFound] = useState<Found | null>(null);
  const begin = useLatestCall();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` only asks for a new read of the settings
  useEffect(() => {
    if (placements === null) return;
    const isCurrent = begin();
    void (async () => {
      let rows: { key: string; value: unknown }[] = [];
      try {
        rows = (await listConfig()).items;
      } catch {
        // without the values there is nothing to warn about
      }
      const numberAt = (key: string) => {
        const value = rows.find((row) => row.key === key)?.value;
        return typeof value === 'number' ? value : null;
      };
      const forceClose = numberAt('ads.force_close_seconds');
      const notSkippable =
        forceClose === 0 && canReadCreatives ? await countNotSkippable(placements) : null;
      if (isCurrent()) {
        setFound({ skipAfter: numberAt('ads.skip_after_seconds'), forceClose, notSkippable });
      }
    })();
    return () => {
      // Other placements or settings: the read still on its way belongs to nobody.
      begin();
    };
  }, [placements, canReadCreatives, version]);

  if (found === null) return null;
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const warnings: { key: string; text: string }[] = [];
  if (found.skipAfter !== null && found.skipAfter > 5) {
    warnings.push({ key: 'skipAfter', text: t('ads.placements.warn.skipAfter') });
  }
  if (found.forceClose === 0) {
    if (found.notSkippable === null) {
      warnings.push({ key: 'forceClose', text: t('ads.placements.warn.forceCloseUnknown') });
    } else if (found.notSkippable > 0) {
      warnings.push({
        key: 'forceClose',
        text: t('ads.placements.warn.forceClose', { count: found.notSkippable }),
      });
    }
  }
  if (warnings.length === 0) return null;
  return (
    <Flex vertical gap={8} data-testid="ads-placements-warnings">
      {warnings.map((w) => (
        <Alert key={w.key} type="warning" showIcon title={w.text} />
      ))}
    </Flex>
  );
}
