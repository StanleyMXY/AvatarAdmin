# avatar-admin

Admin console frontend: Umi Max, React, Ant Design 6 and `@ant-design/pro-components`.
The design lives in the plan under `docs/superpowers/plans/`; the shared specification and
backend contract live in the AvatarApp repository and are not copied here.

## Requirements

- Node 20 or newer (developed on 25.6.1). Node 25 prints a `--localstorage-file` warning when
  `max` runs; it is harmless.
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

`postinstall` runs `max setup` (generates `src/.umi`, which is git-ignored); `prepare` installs the
husky hooks.

## Build variables

Set in the environment or in `.env.local` (git-ignored; copy `.env.example`). They are injected at
build time by `config/buildVars.ts` and declared in `src/typings.d.ts`. Invalid values (a
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
  `vitest.config.ts` starts the test workers with `--no-experimental-webstorage`. `tests/setup.ts`
  also gives every test fresh, empty `localStorage` / `sessionStorage`, and makes
  `vi.spyOn(Storage.prototype, 'setItem')` take effect even on a storage that was already used
  (happy-dom otherwise binds the method on first use). Code that guards storage access with
  `try/catch` is tested by making `setItem` throw this way.
- Time zone dependent code is tested with `withTimeZone(tz, fn)` from `tests/withTimeZone.ts`,
  which sets `process.env.TZ` for the callback and restores it afterwards. A `TZ=... node`
  prefix does not work under Git Bash on Windows.

## Commit hook

`.husky/pre-commit` runs, in order:
1. `lint-staged`: `biome check` on the staged files only;
2. `scripts/typecheck-staged.mjs`: type-checks the whole project, but fails only on errors located
   in staged files. Errors in other files are printed as a warning, so a half-written file
   elsewhere in the working tree does not block an unrelated commit.

Do not bypass the hook with `--no-verify`.
