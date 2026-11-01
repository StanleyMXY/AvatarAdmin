# avatar-admin

Admin console frontend: Umi Max, React, Ant Design 6 and `@ant-design/pro-components`.
The design lives in the plan under `docs/superpowers/plans/`; the shared specification and
backend contract live in the AvatarApp repository (its `main`). This repository holds read-only,
byte-identical snapshots of the two files in `docs/shared-snapshots/`; they are never edited here.

## Requirements

- Node `^22.22.1 || >=24.0.0` (`engines` in `package.json`; developed on 25.6.1). Floor derived from
  the `engines` fields of the installed packages: `lint-staged@17.6.0` needs `>=22.22.1` (the
  highest; it only runs in the commit hook), `@ant-design/pro-components@3.1.14-7` needs
  `>=22.12.0` (the highest among packages needed to build), `@testing-library/jest-dom@7.0.1`
  needs `>=22`, `vite@7.3.6` needs `^20.19.0 || >=22.12.0`, and `vitest@4.1.10` needs
  `^20.0.0 || ^22.0.0 || >=24.0.0`, which excludes Node 23. Node 25 prints a
  `--localstorage-file` warning when `max` runs; it is harmless.
- npm. The lockfile is committed; install with `npm install` from the repository root.
- Keep the npm cache and temp directory off the system drive if it is short on space:

  ```sh
  export npm_config_cache=D:/tmp/npm-cache TMP=D:/tmp TEMP=D:/tmp   # Git Bash
  ```

## Scripts

| Script                                                     | What it does                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:mock`                                         | Dev server with the in-memory fake backend from `mock/` answering `/api/admin/**`.                                                              |
| `npm run dev:api`                                          | Dev server with the fake backend off (`MOCK=none`); `/api` is proxied to `ADMIN_API_PROXY_TARGET`. Application code is identical in both modes. |
| `npm run build`                                            | Production build into `dist/` (`max build`). The fake backend is not part of it.                                                                |
| `npm test` / `npm run test:watch`                          | Vitest run / watch.                                                                                                                             |
| `npm run lint`                                             | `biome check` (lint, format, import order).                                                                                                     |
| `npm run tsc`                                              | `tsc --noEmit` for the whole project.                                                                                                           |
| `npm run check:routes`, `check:codes`, `check:config-keys` | Consistency checks against the specification and contract, run with `tsx`.                                                                      |
| `npm run gen:permission-tree`, `gen:config-keys`           | Rewrite the generated permission tree and configuration key files from the spec / contract; pass the file path after `--` (see the script header).   |

`postinstall` runs `max setup` (generates `src/.umi`, which is git-ignored); `prepare` installs the
husky hooks.

## Mock backend

`npm run dev:mock` serves `/api/admin/**` from `mock/` (Umi's mock loader, development server only, never part of the build). The state is in memory; it survives saving a mock file (the loader reads the files again, the state stays) and starts again when the dev server restarts. There is no proxy in this mode: an endpoint that has no mock is answered with the app's HTML page (the request layer reports `INVALID_RESPONSE`) instead of reaching whatever listens on `ADMIN_API_PROXY_TARGET`. `npm run dev:api` turns it off (`MOCK=none`) and proxies `/api` to `ADMIN_API_PROXY_TARGET`; the front end code is the same in both modes. The loader skips `mock/_core/**` (helpers) and `mock/**/*.test.ts`.

The mock answers at once, so some answers the real backend gives under load cannot come by themselves. For the funnel page, add the step `mock:rate-limited` (type it in the steps box) and press Query: the fake backend answers 429 `RATE_LIMITED`, as when `analytics.funnel_max_concurrency` funnels are already being computed, so the error and its retry can be looked at. The name is a development switch of the mock (`FUNNEL_RATE_LIMIT_STEP` in `mock/_core/analyticsData.ts`); it is checked after the steps, the window and the range, like the limit. The build has no mock, so the name does nothing there (see the `dist/` check below).

**The accounts, passwords and the verification code below exist only in the mock backend. They are fakes, not secrets, and the real backend does not know them.**

| User name | Password | State | Permissions |
|---|---|---|---|
| `root` | `mock-password-root` | super administrator | all 79 codes |
| `support` | `mock-password-support` | normal | sessions, users (view, ban), support, complaints (view), notifications (view), statistics (view) |
| `finance` | `mock-password-finance` | normal | subscriptions, credits, finance statistics, costs and prices, statistics (view, export, re-land) |
| `reviewer` | `mock-password-reviewer` | normal | moderation (view, review, rules), complaints (view, manage) |
| `newhire` | `mock-password-newhire` | must change the password first | users (view), statistics (view) |
| `fresh` | `mock-password-fresh` | has no authenticator yet (login answers `ENROLL_REQUIRED`) | statistics (view), monitor (view) |

The verification code is `000000` for every account, also for the first enrollment. Five wrong codes in a row lock the user name for 5 minutes (429 `RATE_LIMITED` with `data.retryAfterSeconds`), the defaults of `admin.totp_max_failures` and `admin.totp_lockout_minutes`; on enrollment the same count voids the enrollment token. The contract does not say whether the lock answers on the fifth wrong code or the sixth attempt, nor whether the 429 carries `retryAfterSeconds` (open question in `docs/contract-requests/2026-10-26-admin-frontend-auth-and-permissions.md`). Two flags of an administrator in the store (set in a test, not by any request) make the sign-in answers of an unreadable secret: `totpSecretUnreadable` answers 401 `ADMIN_TOTP_INVALID` at sign-in whatever the code is (counted like a wrong code), `enrollSecretUnreadable` answers 401 `ADMIN_INVALID_TOKEN` at enrollment and voids the enrollment token; resetting the authenticator clears the first. A non-super administrator can only grant and act on what they hold (the four 403 `ADMIN_FORBIDDEN` rules of the backend: grant, own role, role, administrator), a super administrator is not bound by them. `GET /api/admin/meta` returns the defaults of contract 17.5 and the upload limits of the backend's third reply, with one difference: `supportedLocales` is `["en", "zh-Hans", "th", "ar", "id", "vi", "es"]` (the contract's default is only `["en"]`), so that the language tabs and the template matrix can be looked at with Thai, Arabic, Indonesian, Vietnamese, Spanish, English and Chinese. Until `app.supported_locales` is saved it stays so (while `GET /config` reports the contract's default `["en"]`); once a setting that `GET /meta` repeats (the languages, the currencies, the longest report range and the upload limits, listed in `mock/_core/meta.ts`) is saved with `PUT /config/{key}`, the answer follows it, and a reset brings the defaults above back. `GET /api/admin/permissions` is the built-in permission tree, derived from spec table 5.0 (`scripts/permissionTree.ts`; the data is `mock/_core/permissionTree.generated.json`, rewritten with `npm run gen:permission-tree -- <spec path>`, and a test keeps the two equal). A code that table 5.0 does not tie to one page (`COSMETIC:GRANT`, `STATS:EXPORT`, `STATS:LAND`) is put under the page of its own area; that is an inference, asked in the same contract request.

Each module's mock file exports `{ 'METHOD /api/admin/path': handler }`; wrap handlers with `guard(permission, handler)` from `mock/_core/auth.ts`, which gives the contract's 401 and 403 answers and `req.admin`. Sample data comes from `mock/_core/fixtures.ts` (Thai, Arabic, Indonesian, Vietnamese, Spanish, English and Chinese, with long strings without spaces and emoji). Tests call a handler directly with `call` from `mock/_core/testing.ts`; no server is started.

## Build variables

Set in the environment or in `.env.local` (git-ignored; copy `.env.example`). They are injected at
build time by `config/buildVars.ts` and read through `src/buildVars.ts`. Invalid values (a
non-hex color, a logo that is not a same-origin path, a threshold outside 0..1) fail the build.
There are no secrets in this repository.

| Variable                                                               | Default                                 |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `ADMIN_PRODUCT_NAME`                                                   | `Admin`                                 |
| `ADMIN_LOGO_URL`                                                       | `/logo.svg` (neutral logo in `public/`) |
| `ADMIN_PRIMARY_COLOR` / `ADMIN_PRIMARY_HOVER` / `ADMIN_PRIMARY_ACTIVE` | `#0ABAB5` / `#3DCBC7` / `#089A96`       |
| `ADMIN_QUALITY_MIN_SUCCESS_RATE`                                       | `0.95`                                  |
| `ADMIN_QUALITY_MAX_SLOW_SHARE`                                         | `0.05`                                  |
| `ADMIN_API_PROXY_TARGET` (dev only)                                    | `http://127.0.0.1:8080`                 |

## Deployment

`docs/deploy.md` describes how to serve the build: same-domain reverse proxy (`/api/` to the
backend, every other path falls back to `index.html`), a complete nginx example, cache headers for
the hashed files, the build variables above and the checks after a release.

## Checks before a release

Run these from the repository root and keep the output:

```sh
npm run lint
npm run tsc
npm test
npm run build
npm run check:routes -- <spec path>
npm run check:codes -- <spec path> <contract path>
npm run check:config-keys -- <contract path>
```

The spec and the contract are the snapshots in `docs/shared-snapshots/` (see the README there);
`check:codes` reads the exclusions from `docs/superpowers/handoff/permission-code-exclusions.txt`.
`grep -r "mock-password" dist/` and `grep -r "mock:rate-limited" dist/` must find nothing: the fake backend is not part of the build.

### Dependency audit

`npm audit` (checked 2026-11-01) reports 64 advisories in 70 installed package copies: 1 critical, 16 high, 37 moderate, 10 low. `npm` marks all 70 copies `dev` in `package-lock.json`: none is reached through `dependencies` (antd, pro-components, react, dayjs, qrcode.react). The build tool is itself a dev dependency, though, and a few of its parts end up in the browser bundle, so they were read one by one:

- `react-router` 6.3.0 (open redirect through a backslash or an untrusted address given to `navigate` or `Link`): the only address the app takes from outside is the return address after sign-in, and `safeReturnUrl` (`src/session/returnUrl.ts`) refuses `//`, backslashes, encoded slashes and control characters. Not reachable.
- `path-to-regexp` 8.2.0 inside `@ant-design/pro-layout` (backtracking patterns): the patterns are the route paths of `config/routes`, written by us; nothing a visitor types is turned into a pattern. Not reachable by a visitor.
- `@babel/runtime` 7.23.6 (slow generated code for `.replace` with named groups): the only named-group expression in `src` is replaced with a function, never with a `$<name>` string (`src/pages/system/auditDetail.ts`). Not reachable.
- `immer` (through the dva plugin), `axios` (through the request plugin): neither plugin is enabled in `config/config.ts`.
- The rest is build, lint, dev-server and test tooling (webpack, mako, esbuild, vite, eslint, glob, minimatch, the crypto polyfills, `happy-dom`, `vitest`): it runs on a developer or CI machine only. `happy-dom` and `vitest` advisories need a page or a mock file from an untrusted source; the tests load only our own code.

Run `npm audit` again before each release; a new advisory in a package that is in the bundle (`antd`, `react`, `react-dom`, `dayjs`, `qrcode.react`, `react-router`, `@ant-design/pro-*`) is a reason to update first.

## Why these choices

- **`legacy-peer-deps=true` in `.npmrc`.** `@ant-design/pro-components` 3.1.14 is a prerelease
  line built for antd 6, but its sub-packages (`pro-layout`, `pro-table`, `pro-form` and others)
  still declare peer dependencies on antd 4/5, and Umi's plugin package pulls in a dependency
  whose peer range stops at React 17. An `npm install --dry-run --no-legacy-peer-deps` on this
  lockfile reports 23 peer conflicts (peer ranges that do not include antd 6 or React 19); the flag
  makes npm accept them.
- **Exact versions** for Umi Max, `@ant-design/pro-components`, antd and React: the combination was
  built and tested together, and a prerelease line must not move on its own.
- **`esbuildMinifyIIFE: true`** in `config/config.ts`: without it `max build` fails at esbuild's
  helper check.
- **Vitest, not Jest.** Jest with the Umi preset failed to load an ESM config on Node 25 and took
  minutes per test file. Vitest uses `pool: 'forks'` and happy-dom.

## Tests

- Test files end in `.test.ts` or `.test.tsx` and sit next to the code under `src/`, `mock/`,
  `config/`, `scripts/`, or in `tests/`.
- `@umijs/max` and `@ant-design/plots` are aliased to `tests/stubs/umi-max.tsx` and
  `tests/stubs/plots.tsx` (see `vitest.config.ts`); application code imports the real package
  names. The Umi stub is steered with `setTestAccess`, `setTestInitialState`, `setTestLocation`
  and reset with `resetUmiStub()` in `beforeEach`.
- Node 22+ has its own `localStorage` that shadows happy-dom's and is unusable without a file, so
  `vitest.config.ts` starts the test workers with `--no-experimental-webstorage`.
- happy-dom binds a `Storage` method onto the instance the first time it is read, which would make
  a later `vi.spyOn(Storage.prototype, 'setItem')` silently do nothing. `tests/setup.ts` therefore
  gives every test fresh, empty `localStorage` / `sessionStorage` (no data carries over between
  tests) and makes both forms work, also on a storage that was already used:
  `vi.spyOn(Storage.prototype, 'setItem')` (affects both storages) and
  `vi.spyOn(localStorage, 'setItem')`, `Object.defineProperty(localStorage, 'setItem', ...)` or
  `localStorage.setItem = fn` (affect that storage only). `tests/storage.test.ts` shows each form
  being caught by a `try/catch`. Code that guards storage access with `try/catch` is tested this way.
- Time zone dependent code is tested with `withTimeZone(tz, fn)` from `tests/withTimeZone.ts`,
  which sets `process.env.TZ` for the callback and restores it afterwards. A `TZ=... node`
  prefix does not work under Git Bash on Windows.

## Commit hook

`.husky/pre-commit` runs, in order:

1. `lint-staged`: `biome check` on the staged files only;
2. `scripts/typecheck-staged.mjs`: type-checks the whole project, but fails only on type errors
   located in staged files; errors in other files are printed as a warning, so a half-written file
   elsewhere in the working tree does not block an unrelated commit. It always fails when `tsc`
   itself cannot do its job: it could not be started or was killed, it exited non-zero without a
   readable diagnostic (crash, out of memory), or it reported a configuration problem (a diagnostic
   with no file location such as TS6053, or any diagnostic located in a `.json` file such as an
   unknown `tsconfig.json` option). It also runs when only `tsconfig*.json` or `package.json` is
   staged. `tsc` reads the working tree, not the index, so a partly staged file is checked as it is
   on disk. `typecheck-staged.mjs` is a thin entry point; the logic is in `typecheck-staged-core.mjs`
   (no "am I the main module" path comparison, which fails open behind a junction or a different
   drive-letter spelling). Tests: `scripts/typecheck-staged.test.ts`.

`.husky/commit-msg` hands over to a global `core.hooksPath` `commit-msg` hook when the developer has
one (husky's own hooks path would otherwise bypass it), and does nothing otherwise.

Do not bypass the hook with `--no-verify`.
