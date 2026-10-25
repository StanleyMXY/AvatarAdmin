# Task 1 report: scaffold, toolchain, stack verification

Status: DONE_WITH_CONCERNS (open items at the end: FIX-NOW not fixed 0, RECORDED 3, not run 1, blocked 0)

## Commits (branch admin-frontend, nothing pushed)

- e6c5e1b Scaffold the admin frontend: Umi Max app, pinned dependencies, build variables and dev proxy
- e584f9c Add Biome, the pre-commit hook (lint-staged and a staged-files-only type check) and placeholder check scripts
- c58cdbe Add the Vitest setup, Umi and chart stand-ins, time zone helper and the stack smoke test, with a README

## Gate results (all on the pinned versions, no version was changed)

| Step | Result | Time |
|---|---|---|
| `npm install` (cold, cache dir on D:) | installed 1593 packages; the first `postinstall` (`max setup`) failed because I had left `model: {}` out of `config/config.ts` (my error, not a version problem); fixed, second `npm install` ran postinstall and `prepare` cleanly | 4 min 30 s (first, including the failed postinstall); 15 s (second) |
| `npm run build` | passes, `dist/` 1.3 MB; JS gzip 222 kB entry + 182 kB async chunk | 18 s (first build in this tree, cold webpack); planning spike: 29 s second build |
| `npm test` | 1 file, 7 tests pass | cold first run 14 s wall (import 8.9 s); later runs 9 to 12 s wall. Planning spike measured 2 min 31 s cold; not reproduced here because the dependency cache and disk were warm after the install |
| `npm run lint` | `biome check`, 22 files, no findings | under 1 s |
| `npm run tsc` | no errors | 8.5 s |

Resolved versions in `package-lock.json` (same as the planning spike): Umi Max 4.7.25, antd 6.6.7, react and react-dom 19.3.1, pro-components 3.1.14-7, plots 2.6.8, icons 6.3.4, dayjs 1.11.23, TypeScript 5.9.3, Vitest 4.1.10, happy-dom 20.14.6, Testing Library React 16.3.3, react-intl 12.1.5. Added at install-time stable versions: qrcode.react 4.2.0, tsx 4.23.15, cross-env 10.1.0, @biomejs/biome 2.6.2, husky 9.1.7, lint-staged 17.6.0, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.8, @testing-library/dom 10.4.2. I pinned every runtime dependency and the tools above exactly (no `^`), which is stricter than the brief required; only `@types/*` use ranges.

Planning measurements to compare: install 4 min 09 s (1755 packages) planned vs 4 min 30 s (1593 packages) measured; build 29 s vs 18 s; Vitest cold 2 min 31 s vs 14 s, warm 15 s vs 9 to 12 s. For the time budget: use install about 4.5 min once, build about 20 s, Vitest about 10 s per run for this one file (the import of antd and ProTable dominates, about 7 to 9 s, and will grow slowly with more files).

## RED to GREEN

Test first: `tests/smoke.test.tsx` (7 tests: intl text + ProTable row + chart stand-in; `withTimeZone` Los Angeles 10 and Singapore 1 and restore; restore when the callback throws; storage read/write; fresh empty storage per test; throwing `setItem` via `vi.spyOn(Storage.prototype, 'setItem')` caught, also after earlier use; spy gone after restore).

RED 1 (helper and stubs moved aside): `npx vitest run tests/smoke.test.tsx`
```
FAIL  tests/smoke.test.tsx
Error: Failed to resolve import "./withTimeZone" from "tests/smoke.test.tsx". Does the file exist?
Test Files  1 failed (1)   Tests  no tests
```
That is the right reason: the feature does not exist.

RED 2 (helper and stubs restored, `npx vitest run`): 2 failed, 3 passed (of 5 at that time):
```
TypeError: localStorage.clear is not a function
AssertionError: expected true to be false   (the throwing setItem was not applied)
```
GREEN: after the two environment fixes below, `npx vitest run` gives `Test Files 1 passed (1), Tests 7 passed (7)`.

## Findings that change what later tasks may assume

1. **Node 22+ has its own broken global `localStorage`.** On Node 25.6.1 the global `localStorage` is Node's experimental web storage (accessor property, object without `setItem`/`clear`), which shadows happy-dom's. `sessionStorage` was fine. Fix in `vitest.config.ts`: `execArgv: ['--no-experimental-webstorage']` when Node is 22.4 or newer (the flag does not exist before that, so it is guarded by a version check). This also removes the `--localstorage-file` warning in test runs. Verified by a probe test (removed afterwards): after the flag, `localStorage instanceof Storage` is true.
2. **`vi.spyOn(Storage.prototype, 'setItem')` silently does nothing once the storage has been used.** happy-dom's `Storage` constructor returns a Proxy whose `ClassMethodBinder` binds each method onto the instance on first read (`node_modules/happy-dom/lib/storage/Storage.js`, constructor), so a later prototype spy is shadowed. Verified: spy first then call throws; call once, then spy, then call does not throw. The brief requires the prototype spy to work, so `tests/setup.ts` installs, in a global `beforeEach`, fresh `localStorage` and `sessionStorage` whose methods resolve `Storage.prototype[name]` at call time. Consequences: prototype spy and instance spy both always take effect; storage is empty at the start of every test (no leakage between tests). A test that needs data in storage must set it inside the test.
3. **`@umijs/max`'s real types for `IntlProvider` are the old react-intl 3 class type and reject `children` under React 19.** The stub exports react-intl 12's `IntlProvider` at runtime (R3), but `tsc` sees the real package. So tests should import `IntlProvider` from `react-intl` directly and `useIntl` from `@umijs/max` (same context at runtime). The smoke test does that. Later tasks that write component tests will hit this; the stub's `IntlProvider` export exists but is not usable in typed test code.
4. **Biome 2.6 formats Markdown.** My first `biome check --write .` rewrote table alignment in two files under `docs/` (the plan and the first contract-request file). I reverted them with `git checkout -- docs` (they were committed and unchanged otherwise), and `biome.json` now excludes `docs` and `*.md`. `git status` shows no changes under `docs/`. The `.superpowers/` folder is excluded too.
5. **Global git hooks.** This machine has a global `core.hooksPath` (`C:/Users/49868/.git-hooks`, with a `commit-msg` hook that strips the Claude co-author trailer, and LFS hooks). Husky sets a local `core.hooksPath` to `.husky/_`, which bypasses the global ones for this repository. I added `.husky/commit-msg`, which delegates to the global `commit-msg` hook when a global hooks path with that hook exists (no effect without one). The LFS stub hooks (`post-checkout`, `post-commit`, `post-merge`, `pre-push`) are not delegated; this repository does not use LFS.
6. **`legacy-peer-deps` reason is wider than the brief says.** `npm install --dry-run --no-legacy-peer-deps --ignore-scripts` on the lockfile exits 0 but prints 23 peer-conflict overrides: the pro-components sub-packages (card, descriptions, field, form, layout, list, provider, skeleton, table, and more) and also `@ahooksjs/use-request` (a dependency of `@umijs/plugins`), whose peer range is React 16/17. The README states this. I did not test a fresh install without a lockfile.
7. `src/pages/user/login/index.tsx` exists only as an empty `<div data-testid="login-placeholder">` so the placeholder login route builds. Task 4 rewrites `config/routes.ts`; the login page task replaces this file. `src/access.ts` (empty access map) and `src/app.tsx` (empty initial state) are minimal for the same reason; `access.ts` is not in the brief's file list but the access plugin config needs it to exist. Whether the build needs it was not tested separately.

## Files

Created (all committed): `package.json`, `package-lock.json`, `.npmrc`, `.gitignore`, `.editorconfig`, `.env.example`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`, `.lintstagedrc`, `.husky/pre-commit`, `.husky/commit-msg`, `config/config.ts`, `config/buildVars.ts`, `config/proxy.ts`, `config/routes.ts`, `src/app.tsx`, `src/access.ts`, `src/typings.d.ts`, `src/pages/user/login/index.tsx`, `public/logo.svg`, `scripts/typecheck-staged.mjs`, `scripts/check-route-inventory.ts`, `scripts/check-permission-codes.ts`, `scripts/check-config-keys.ts`, `tests/setup.ts`, `tests/withTimeZone.ts`, `tests/stubs/umi-max.tsx`, `tests/stubs/plots.tsx`, `tests/smoke.test.tsx`.

Notes on specific files:
- `config/config.ts`: `esbuildMinifyIIFE: true`, `model: {}` (required: the initialState, access and layout plugins import the model plugin; without it `max setup` fails with "Can't resolve src/.umi/plugin-model"), `initialState`, `access`, `layout.title` from `ADMIN_PRODUCT_NAME`, locale default `en-US` with `baseNavigator: false` (the app resolves the initial language itself), `define` from `config/buildVars.ts`, `proxy`, `routes`. No Umi `request` plugin.
- `config/buildVars.ts`: reads the seven `ADMIN_*` variables with the spec's defaults (name `Admin`, logo `/logo.svg`, `#0ABAB5` / `#3DCBC7` / `#089A96`, 0.95, 0.05), and throws at config time on a non-hex color, a logo that is not a single-slash same-origin path, or a threshold outside 0..1 (checked with `tsx`: both invalid cases throw). Values are injected through `define`; `src/typings.d.ts` declares them. The product name default `Admin` is my choice because the spec says the name is undecided.
- `config/proxy.ts`: `/api/` to `ADMIN_API_PROXY_TARGET` (default `http://127.0.0.1:8080`). `dev:api` sets `MOCK=none`; `dev:mock` is plain `max dev`, so Umi's `mock/` directory (does not exist yet) serves `/api`. Neither dev script was started in this task.
- `tests/stubs/umi-max.tsx`: exports `IntlProvider`, `useIntl`, `FormattedMessage`, `history` (`push`/`replace`/`back` as `vi.fn`), `useAccess`, `useModel('@@initialState')` (returns `initialState`, `setInitialState` supporting an updater function, `refresh`, `loading`, `error`; other namespaces throw), `useLocation`, `Link`, `getLocale`, `setLocale`; test controls `setTestAccess`, `setTestInitialState`, `setTestLocation`, `resetUmiStub()`. Hooks re-render through `useSyncExternalStore`. The `useModel`, `useAccess` and `useLocation` stubs are only exercised by `tsc`, not by a behavioural test yet (RECORDED below).
- `tests/stubs/plots.tsx`: `Line`, `Column`, `Bar`, `Area`, `Pie`, `Funnel`, `Heatmap`, `DualAxes`, each rendering `<div data-testid="chart-<kind>">` with the JSON of `data`.
- Aliases in `vitest.config.ts`: `@umijs/max`, `@ant-design/plots`, `@@` (src/.umi), `@root` (repo root), `@`. `tsconfig.json` extends the generated `src/.umi/tsconfig.json` and restates `paths` (`@/*`, `@@/*`, `@root/*`, `@umijs/max`, `@umijs/max/typings`) because a child `paths` replaces the parent's.
- `include` for tests: `{src,mock,config,scripts,tests}/**/*.test.{ts,tsx}`, `pool: 'forks'`, environment happy-dom, `globals: true` (needed for Testing Library's automatic cleanup).
- `scripts/check-*.ts` are placeholders that print "not implemented yet (task N provides it)" and exit 1: `check-route-inventory.ts` and `check-permission-codes.ts` are for task 4, `check-config-keys.ts` for task 10. They exit non-zero on purpose so a missing check cannot read as a pass; those tasks replace the files. `npm run check:routes` was run and prints the message.

## Pre-commit hook verification

`scripts/typecheck-staged.mjs` runs `tsc --noEmit --pretty false` for the whole project, parses `path(line,col): error TSxxxx` diagnostics (continuation lines kept), and compares against `git diff --cached --name-only --diff-filter=ACMR`. Tried by hand with temporary files (deleted afterwards):
- bad file staged: prints the error, exit 1;
- good file staged, bad file unstaged: prints the other file's error as a warning, exit 0;
- no TypeScript file staged: exit 0 without running tsc.
Diagnostics without a file location (for example a broken tsconfig) are printed as warnings and do not fail the hook, following the ruling "fail only on staged files". The real hook ran on commits 2 and 3 (lint-staged "Done running tasks for staged files", then the type check) and passed; commit 1 was made before `.husky/` existed. `--no-verify` was never used.

## Checks done by hand

- No reference-project or other third-party product names in tracked files outside `docs/` (searched for the names the plan forbids and a few likely ones); no Korean characters. The README no longer names the starter template. Final scan test belongs to a later task.
- No external CDN address, no secrets. The default logo is the neutral `public/logo.svg`.

## Triage of what I found

- FIX-NOW, fixed: missing `model: {}`; localStorage shadowing; prototype spy ineffective; Biome reformatting docs (reverted, excluded); lost backslashes in `typecheck-staged.mjs` (the file contained `'\'` after writing; replaced by `/\\/g` and verified by the hook tests); `IntlProvider` typing in the smoke test; a README claim ("npm refuses to install") that I had not verified, now replaced by the measured statement.
- RECORDED (not fixed, not load-bearing):
  1. `tests/stubs/umi-max.tsx`: `useAccess`, `useModel`, `useLocation`, `Link`, `getLocale`/`setLocale` have no behavioural test; the first page test that uses them will exercise them (path: a later task calls `setTestAccess` and the component does not re-render, wrong result: stale permission in a test).
  2. `npm audit` reports 85 vulnerabilities (1 critical, 45 high) in transitive dependencies of the Umi toolchain; not examined whether any is reachable in the built bundle or only in dev tooling (path: `npm install` output). Needs a look before release.
  3. `scripts/typecheck-staged.mjs` treats diagnostics that have no file location as warnings (as the ruling says: fail only on staged files). Not tried: whether `tsc` reports a broken `tsconfig.json` with a file path (then the hook fails when it is staged) or without one (then a commit staging a broken `tsconfig.json` would pass). Path to check: stage an invalid `tsconfig.json` and run the script.
- NOT-A-DEFECT: Node prints `--localstorage-file` warning during `max setup` and `max build` (harmless, as the brief says; the test workers no longer print it).
- Not run: `npm run dev:mock` / `dev:api` were not started (no mock directory or login page yet), so the dev proxy configuration and the `MOCK=none` behaviour are unverified; only `max build` and `max setup` exercised `config/config.ts`.

## For the controller

- Shared-file ownership: `tests/setup.ts`, `tests/stubs/*`, `vitest.config.ts` now carry the storage workaround described above; later tasks must not replace `beforeEach` storage handling.
- Tasks that write component tests should import `IntlProvider` from `react-intl` (type issue above).
- The `check:*` scripts fail until tasks 4 and 10 land.

---

# Fix round 1 (review of task 1)

Commits: b9bc554 (hook and type-check fixes, with tests), 6a7a509 (storage helper, Node floor, README). Both went through the real pre-commit hook (lint-staged + the new typecheck-staged), no `--no-verify`.

Open items after this round: FIX-NOW not fixed 0; RECORDED 2 (stub exports without behavioural tests; 85 npm audit findings; the third earlier recorded item, broken tsconfig in the hook, is now fixed and covered); not run 1 (dev:mock / dev:api never started); blocked 0. The coordinator's recorded note "tsc checks the working tree, not the index" is now stated in the script header and the README.

## 1. `.husky/commit-msg` failed without a global hooksPath

Reproduced first: `GIT_CONFIG_GLOBAL=/dev/null sh -e .husky/commit-msg msg` exited 1 (`git config` returns 1 for an unset key, and `sh -e` aborts on the failed substitution). Fix: `git config --global core.hooksPath 2>/dev/null || true`. Verified:
```
GIT_CONFIG_GLOBAL=/dev/null sh -e .husky/commit-msg /d/tmp/t1-msg.txt   -> exit 0, message unchanged (3 lines)
sh -e .husky/commit-msg /d/tmp/t1-msg.txt   (this machine, global hook present) -> exit 0, the Claude co-author trailer removed (message is now just "hello")
```
Delegation still works. No recursion: the global hook chains to `.git/hooks/commit-msg`, not to `.husky`; the delegating call is made once from the husky hook.

## 2. `scripts/typecheck-staged.mjs` was fail-open

Rewritten as exported pure functions plus a `main()` that runs only when the file is executed directly: `shouldCheck(stagedFiles)`, `parseDiagnostics(output, root)`, `evaluate({stagedFiles, result, root})`. Rules now:
- exit 1 when `result.error` is set, or `status` is null (killed by a signal);
- exit 1 when tsc exits non-zero and no diagnostic can be parsed (crash status 139, `FATAL ERROR ... out of memory` with status 2, usage text);
- exit 1 for a location-less `error TSnnnn` (TS6053 missing file, TS5083 unreadable extends) and for any diagnostic located in a `.json` file (unknown tsconfig option TS5023, broken tsconfig syntax TS1005), staged or not, because source files are not reliably checked then. I captured real tsc 5.9.3 output for each shape before writing the parser (note: with a broken tsconfig tsc still reports type errors of source files, and with a bad `extends` too; the config line is what must block);
- unchanged: located errors in staged files fail; located errors in other files are printed as a warning and the commit passes;
- the check also runs when `tsconfig*.json` or `package.json` is staged (previously only `.ts/.tsx/.d.ts`).

Covering tests: `scripts/typecheck-staged.test.ts`, 23 tests. 14 unit tests on `shouldCheck`, `parseDiagnostics`, `evaluate` (result.error, status null with signal, status 139 silent, OOM status 2, usage text, TS6053, TS5023 with tsconfig unstaged, TS1005, staged error, unstaged-only error as warning). 9 end-to-end tests that run the real script in throwaway `git init` directories under the OS temp dir: a stand-in `node_modules/typescript/bin/tsc` replays canned output (139 silent; OOM; unknown option) or runs the real tsc (clean project passes; staged type error fails and unstaged one only warns; `files: ["missing.ts"]` fails with TS6053; broken tsconfig fails whether or not it is staged; only `tsconfig.json` or only `package.json` staged triggers tsc; only `README.md` staged does not run tsc; typescript not installed fails).

Command and output: `npx vitest run scripts tests` -> `Test Files 3 passed (3), Tests 38 passed (38)`.
Mutation check (temporarily restoring the old fail-open behaviour for "no readable diagnostic" and "status null", then restored from a saved copy): 6 tests failed (signal, status 139, OOM, usage text, and the two end-to-end 139/OOM cases). Unreachable by this check: the `.json`/location-less rule (my sed for that line did not match), but its tests pass on the real implementation and the TS6053/TS5023/TS1005 cases cannot pass if that rule is absent (they would return 0 with only unstaged diagnostics).

## 3. Storage helper ignored instance spies

Confirmed by running the new tests against the committed old `tests/setup.ts`: 6 of 8 failed (instance spy, `Object.defineProperty`, assignment, getItem/removeItem spies, stale override after restore). New helper in `tests/setup.ts`: a proxy over the happy-dom storage that remembers a method defined, assigned or spied on the instance (traps `set`, `defineProperty`, `deleteProperty`, `getOwnPropertyDescriptor`, `has`) and otherwise looks up `Storage.prototype[name]` at call time. `getOwnPropertyDescriptor` returns nothing for a method without an override, so `vi.spyOn(localStorage, ...)` finds the original on the prototype and restore removes the override without leaving a stale copy.

Covering tests: `tests/storage.test.ts`, 8 tests, each asserting that a `try/catch` around `setItem` sees the throw: prototype spy after earlier use (both storages); instance spy after earlier use (only that storage; the other storage still works; nothing stored); instance spy without implementation (records call and still stores); `Object.defineProperty`; assignment; throwing `getItem` (prototype) and `removeItem` (instance); restoring an instance spy leaves no override and a later prototype spy still works; ordinary behaviour (property writes, `length`, `Object.keys`, `instanceof Storage`, `clear`). Output with the new helper: `tests/smoke.test.tsx` + `tests/storage.test.ts` pass (15 tests in the first run of those two files; 38 together with the scripts tests).

README updated: it now lists exactly which spy forms work and for which storage.

## 4. Node floor

Read from the installed packages' `engines.node` and from a scan of all 834 installed packages that declare one: highest is `lint-staged@17.6.0` `>=22.22.1` (only used by the commit hook), next `@ant-design/pro-components@3.1.14-7` `>=22.12.0` (highest among packages needed to build), `@testing-library/jest-dom@7.0.1` `>=22`, `vite@7.3.6` and `@vitejs/plugin-react@5.2.0` `^20.19.0 || >=22.12.0`, `vitest@4.1.10` `^20.0.0 || ^22.0.0 || >=24.0.0` (excludes Node 23), `happy-dom@20.14.6` `>=20.0.0`. `@umijs/max`, `@umijs/preset-umi` and `@umijs/core` declare none (`umi` itself `>=14`). Written: `package.json` `engines.node` = `^22.22.1 || >=24.0.0`, README requirements list the packages that set it. Because the floor is above 22.4, the version guard around `--no-experimental-webstorage` in `vitest.config.ts` was removed (the flag is passed unconditionally). My earlier report line "Node >= 20" was wrong; the earlier planning text in the plan (`Node >= 20`) is also lower than the real floor and is for the controller to correct where it matters.

---

# Fix round 2 (re-review of task 1)

Commit: 702c9a2 (went through the real pre-commit hook, which now runs the new entry point). Open items: FIX-NOW 0; RECORDED 2 (stub exports without behavioural tests; 85 npm audit findings); not run 1 (dev:mock / dev:api); blocked 0.

## FIX-NOW: the "am I the main module" guard failed open behind a junction or other path spelling

Reproduced with the previous commit's script (`git show b9bc554:scripts/typecheck-staged.mjs`) run through junctions to both a repository holding a staged type error and the scripts directory: exit 0, nothing checked. The same repository and junctions with the new entry point: exit 1 with `bad.ts(1,14): error TS2322`.

Change: removed the guard instead of making the path comparison smarter. `scripts/typecheck-staged-core.mjs` now holds `shouldCheck`, `parseDiagnostics`, `evaluate` and an exported `main()` (no top-level side effects); `scripts/typecheck-staged.mjs` is three lines: `import { main } ...; process.exit(main());`. `.husky/pre-commit` still calls `node scripts/typecheck-staged.mjs`, unchanged. The test file imports the core module. README mentions the split.

Covering tests (added to `scripts/typecheck-staged.test.ts`, end-to-end, real tsc, a staged file with a type error, expecting exit 1 and the error text):
- through a junction (`fs.symlinkSync(..., 'junction')`) for both the repository (used as cwd) and the scripts directory (the script path);
- with a different drive-letter casing for both the cwd and the script path (skipped on non-Windows).

Command and output: `npx vitest run scripts --reporter=verbose` -> `Tests 25 passed (25)`; the junction case 1406 ms, the casing case 1387 ms. `npx biome check scripts` clean, `npm run tsc` clean.

## RECORDED, fixed: end-to-end tests ran under the 5 s default timeout

Measured durations of the end-to-end cases in the same run: 470, 441, 474, 2172, 3055, 859, 2767, 919, 354, 1406, 1387 ms; the longest (two real tsc runs) is 3.1 s, so 5 s leaves little margin on a cold disk or a loaded machine. The end-to-end `describe` now has an explicit `{ timeout: 60_000 }` (per describe rather than `testTimeout` in the config, so the fast unit tests keep the default limit).
