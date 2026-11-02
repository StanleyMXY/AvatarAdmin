// Usage: npm run gen:error-codes -- [contract path]
// Rewrites src/locales/errorCodes.generated.json from table 1.4 of the contract. Without a path it
// reads the snapshot in docs/shared-snapshots (DEFAULT_CONTRACT).
import { writeFileSync } from 'node:fs';
import { DEFAULT_CONTRACT, errorCodesJson, readContract } from './contractErrors';

const text = errorCodesJson(readContract(process.argv[2] ?? DEFAULT_CONTRACT));
writeFileSync('src/locales/errorCodes.generated.json', text);
console.log(`${(JSON.parse(text) as string[]).length} error codes`);
