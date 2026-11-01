// Shared by the page tests of the campaign module: signs in as one of the preset administrators of
// the mock backend, tells the Umi stand-in who that is, and puts the sample data of the mock
// backend back.
import { resetCampaignStore } from '../../../mock/_core/campaignData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { sheetAnswer as sheetResponse } from '../../../tests/pageHelpers';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { resetChannelsCache } from '../../components/ChannelSelect';

export {
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  writesOf,
} from '../../../tests/pageHelpers';

/** The values of `GET /meta`. */
export const META = { ...META_DEFAULTS };

export const NOW = new Date('2026-10-26T10:00:00Z');

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetCampaignStore(NOW);
  resetChannelsCache();
  localStorage.clear();
}

/**
 * Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of
 * `GET /meta`.
 */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  return signInAsAdmin(username, { codes: options.codes, meta: options.meta ?? META });
}

/** The answer of an export: the first bytes of a spreadsheet. */
export const sheetAnswer = (name = 'attribution-performance') => sheetResponse(name);
