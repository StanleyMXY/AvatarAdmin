export type KeyPermission = { key: string; editPermission: string };

/** What differs between the contract's keys, the generated file and the schema; an empty list means nothing. */
export function compareConfigKeys(
  contract: KeyPermission[],
  generated: KeyPermission[],
  schema: KeyPermission[],
): string[] {
  const problems: string[] = [];
  const mapOf = (list: KeyPermission[]) => new Map(list.map((e) => [e.key, e.editPermission]));
  const sets: [string, Map<string, string>][] = [
    ['generated file', mapOf(generated)],
    ['schema', mapOf(schema)],
  ];
  const base = mapOf(contract);
  if (base.size !== contract.length) problems.push('the contract table has a key twice');
  for (const [name, map] of sets) {
    if (map.size !== (name === 'schema' ? schema : generated).length)
      problems.push(`${name} has a key twice`);
    for (const [key, permission] of base) {
      if (!map.has(key)) problems.push(`${name} is missing ${key}`);
      else if (map.get(key) !== permission) {
        problems.push(`${name}: ${key} needs ${map.get(key)} but the contract says ${permission}`);
      }
    }
    for (const key of map.keys())
      if (!base.has(key)) problems.push(`${name} has ${key}, which the contract does not`);
  }
  return problems;
}
