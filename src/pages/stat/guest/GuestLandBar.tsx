import { LandBar } from '../../../components/stat/LandBar';
import type { LandName } from '../../../services/stats/types';

/** What the one landing bar of the guest tabs recomputes: the day, the conversion cells and the retention cells. */
const GUEST_LAND_NAMES: LandName[] = ['daily-business', 'guest-cohort', 'guest-retention'];

/**
 * The landing bar of the guest daily report, the conversion cohorts and the guest retention (spec
 * 5.4): the shared bar with the three summaries and the words that say the date is the check day.
 * One date, the three one after the other, stopping at the first that fails.
 */
export function GuestLandBar({ onLanded }: { onLanded: () => void }) {
  return (
    <LandBar
      name={GUEST_LAND_NAMES}
      onLanded={onLanded}
      dateLabelId="stat.guest.land.date"
      hintId="stat.guest.land.hint"
    />
  );
}
