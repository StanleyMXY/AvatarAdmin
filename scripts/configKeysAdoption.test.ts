import { describe, expect, it } from 'vitest';
import generated from '../src/pages/config/configKeys.generated.json';
import { CONFIG_SCHEMA } from '../src/pages/config/configSchema';
import { EXTRA_ENTRIES } from '../src/pages/config/extraConfigKeys';
import { parseConfigRows } from './configKeys';
import { compareConfigKeys } from './configKeysCheck';
import { DEFAULT_CONTRACT, NEXT_CONTRACT, readContract } from './contractErrors';

// What `npm run check:config-keys -- <path of the new version>` tells when the version of the
// contract of 2026-11-02 is adopted: the same comparison the script makes, with that document.
const rowsOf = (path: string) =>
  parseConfigRows(readContract(path)).map((r) => ({
    key: r.key,
    editPermission: r.editPermission,
  }));
const schema = CONFIG_SCHEMA.map((s) => ({ key: s.key, editPermission: s.editPermission }));
const extras = EXTRA_ENTRIES.map((e) => ({ key: e.key, editPermission: e.editPermission }));

describe('the key table of the new version of the contract', () => {
  const oldRows = rowsOf(DEFAULT_CONTRACT);
  const newRows = rowsOf(NEXT_CONTRACT);

  it('has 26 keys more than the snapshot and drops none; the edit permission of each old key is the same', () => {
    expect(oldRows).toHaveLength(225);
    expect(newRows).toHaveLength(251);
    const newMap = new Map(newRows.map((r) => [r.key, r.editPermission]));
    for (const row of oldRows) expect(newMap.get(row.key), row.key).toBe(row.editPermission);
  });

  it('adds exactly the keys of the list of backend extra keys: the 25 it had and moderation.model_check_enabled', () => {
    const oldKeys = new Set(oldRows.map((r) => r.key));
    const added = newRows.filter((r) => !oldKeys.has(r.key));
    expect(added.map((r) => r.key).sort()).toEqual(extras.map((e) => e.key).sort());
    expect(added.find((r) => r.key === 'moderation.model_check_enabled')?.editPermission).toBe(
      'MODERATION:CONFIG',
    );
    // with the same edit permission as the schema gives them
    for (const row of added)
      expect(extras.find((e) => e.key === row.key)?.editPermission, row.key).toBe(
        row.editPermission,
      );
  });

  it('says to remove each of the 26 extra keys from the list, finds the schema complete, and asks only for the generated file to be written again', () => {
    const problems = compareConfigKeys(newRows, generated, schema, extras);
    const removals = problems.filter((p) =>
      p.endsWith('remove it from the list of backend extra keys'),
    );
    expect(removals.map((p) => p.split(' ')[0]).sort()).toEqual(extras.map((e) => e.key).sort());
    expect(removals).toHaveLength(26);
    const rest = problems.filter((p) => !removals.includes(p));
    // the generated file is the table of the snapshot: it lacks the 26 keys, and says nothing else
    expect(rest.sort()).toEqual(extras.map((e) => `generated file is missing ${e.key}`).sort());
    expect(rest.some((p) => p.startsWith('schema'))).toBe(false);
  });

  it('is satisfied when the generated file is the new table and the extra keys have left the list', () => {
    expect(compareConfigKeys(newRows, newRows, schema, [])).toEqual([]);
  });

  it('is still satisfied by the snapshot today', () => {
    expect(compareConfigKeys(oldRows, generated, schema, extras)).toEqual([]);
  });
});
