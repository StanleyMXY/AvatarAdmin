export type KeyPermission = { key: string; editPermission: string };

/**
 * What differs between the contract's keys, the generated file and the schema; an empty list means
 * nothing. `extras` is the list of keys the backend has before the contract lists them: the schema
 * must have them too, the generated file (which is the contract table) must not, and a key that the
 * contract has adopted must leave the list.
 */
export function compareConfigKeys(
  contract: KeyPermission[],
  generated: KeyPermission[],
  schema: KeyPermission[],
  extras: KeyPermission[] = [],
): string[] {
  const problems: string[] = [];
  const mapOf = (list: KeyPermission[]) => new Map(list.map((e) => [e.key, e.editPermission]));
  const base = mapOf(contract);
  const extra = mapOf(extras);
  if (base.size !== contract.length) problems.push('the contract table has a key twice');
  if (extra.size !== extras.length) problems.push('the list of backend extra keys has a key twice');
  for (const key of extra.keys()) {
    if (base.has(key)) {
      problems.push(`${key} is in the contract now: remove it from the list of backend extra keys`);
    }
  }
  const sets: [string, Map<string, string>][] = [
    ['generated file', mapOf(generated)],
    ['schema', mapOf(schema)],
  ];
  for (const [name, map] of sets) {
    if (map.size !== (name === 'schema' ? schema : generated).length)
      problems.push(`${name} has a key twice`);
    for (const [key, permission] of base) {
      if (!map.has(key)) problems.push(`${name} is missing ${key}`);
      else if (map.get(key) !== permission) {
        problems.push(`${name}: ${key} needs ${map.get(key)} but the contract says ${permission}`);
      }
    }
    // The extras belong in the schema only; the generated file is the contract table.
    for (const [key, permission] of extra) {
      if (base.has(key) || name !== 'schema') continue;
      if (!map.has(key)) problems.push(`${name} is missing ${key}`);
      else if (map.get(key) !== permission) {
        problems.push(
          `${name}: ${key} needs ${map.get(key)} but the list of backend extra keys says ${permission}`,
        );
      }
    }
    for (const key of map.keys()) {
      if (base.has(key)) continue;
      if (name === 'schema' && extra.has(key)) continue;
      problems.push(`${name} has ${key}, which the contract does not`);
    }
  }
  return problems;
}
