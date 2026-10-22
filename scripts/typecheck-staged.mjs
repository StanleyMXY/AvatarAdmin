// Entry point of the pre-commit type check; see typecheck-staged-core.mjs for the rules.
import { main } from './typecheck-staged-core.mjs';

process.exit(main());
