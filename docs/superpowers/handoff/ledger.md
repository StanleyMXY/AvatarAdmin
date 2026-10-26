# 进度账本

计划：`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`。执行约定：`execution-conventions.md`（同目录）。
这份文件是接手方继续写的账本：每个任务开始、完成、评审、修复都在"进度"末尾加一行，带日期和提交。**不要改下面已有的行。**
2026-10-25 起从本机迁到仓库里（之前在本机被忽略的 `.superpowers/` 目录），下面是迁移时的内容，其中"工作目录""预算批准"等是当时本机的情况。

Started 2026-10-22. Branch admin-frontend (from main b9e5ab1.. plan commits up to 3169eac). Budget approved by user: 2776 min sum / ~24.8 h wall incl. 20% reserve; 3 module lanes in one checkout, foundation sequential. Model: implementers sonnet; deep-task reviewers opus; normal reviewers sonnet; final review fable.
Spec/contract: read-only; backend note + replies 1-3 are field-name authority.

## Pre-flight scan (pairs sharing a file or interface)
| pair | produced / consumed | finding |
|---|---|---|
| T1 / T4 | T1 placeholder config/routes.ts; T4 rewrites | fine: T4 owns it afterwards |
| T4 / T7 | T4 creates config/routes/<all>.ts empty incl. auth.ts; T7 lists "Create config/routes/auth.ts" | Ruling R1: T7 fills the existing file |
| T3,T4 / T6 | T3 error.ts+reason.ts, T4 permission.ts locale files; T6 creates aggregator + module stubs + pages.ts | Ruling R2: T6 aggregator imports error, reason, permission, pages and all module files |
| T1 / all | vitest include pattern unspecified; tests live in src, mock, config, scripts, tests | Ruling R3: vitest include = {src,mock,config,scripts,tests}/**/*.test.{ts,tsx}; pool forks |
| T1 stub / T6,T7,T8 | tests/stubs/umi-max.tsx exports only IntlProvider/useIntl/history; later tasks need useAccess, useModel, useLocation, Link, getLocale, setLocale | Ruling R4: T6-T8 extend the stub; modules never edit it (NEEDS_CONTEXT instead) |
| T1 hook / lanes | pre-commit runs whole-project tsc; parallel lanes leave WIP files that break it | Ruling R5: hook = lint-staged (biome on staged files) + scripts/typecheck-staged (tsc whole project, fail only on diagnostics in staged files); full tsc by controller per batch and T32. Cost if wrong: a cross-file break by a staged file is caught only at batch check |
| T2 / T7 | T2 UploadLimitMeta; T7 AdminMeta includes it | consistent |
| T3 / T8 | ApiError, describeError, Page, downloadFile, uploadFile | consistent |
| T4 / T5 | PERMISSION_CODES, canAccess, permission locale; mock imports by relative path | consistent |
| T5 / T7 | mock auth endpoints, /me, /meta (20 fields) | consistent; T5 mock must return 20 meta fields and me.id/passwordMinLength |
| T6 noHardcodedText / T2,T5,tests | scanner forbids external https:// addresses and product names repo-wide; tests and mock contain https://example URLs | Ruling R6: external-address rule skips *.test.*, mock/, tests/, docs/; forbidden names and token=123 rule applies everywhere except docs/ |
| T8 / T9,T10 | ExportButton, LinkTargetField, UploadField consumed | consistent |
| T9 / T29 | T9 creates services/channels + mock/channels.mock.ts (GET); T29 adds write endpoints | Ruling R7: T29 may edit those T9-owned files (nobody else touches them) |
| T10 / hosts | CONFIG_HOSTS maps codes to pages built later | Ruling R8: T10 test asserts map coverage only; T32 asserts host routes exist |
| T11,T12,T13,T14 / T16 | account entitlements, credits, memory, avatars services | T16 depends on them (order) |
| T13,T15,T17 / T21 | alerts, moderation stats, daily/retention services | T21 depends on them (order) |
| T14 / T16 | grantCosmetic, getAccountAvatars | consistent |
| T22,T27,T29,T30 / T8 | LinkTargetField, UploadField kinds | consistent |
| T25 / T2 | utcDayRangeToInstants | consistent |
| T32 / all | route/code/config-key scripts from T4,T10 | consistent |
Task self-consistency: T1-T31 read; no internal contradiction found beyond R1-R8. Parallel-lane protocol (user-approved) overrides the skill's one-implementer rule for module tasks only (R9).

## Rulings
R1-R8 above. R9: module tasks 11-31 run in up to 3 parallel lanes in the same checkout (user approved the budget with this), path-limited commits, controller runs full tsc/lint per batch. Foundation 1-10 strictly sequential.

## Estimates (min): impl / review chain
T1 25/24 T2 30/24 T3 30/53 T4 35/53 T5 35/24 T6 45/24 T7 30/53 T8 45/53 T9 45/24 T10 50/24 | T11 40/24 T12 35/24 T13 35/24 T14 50/24 T15 35/24 T16 50/24 T17 30/24 T18 30/24 T19 25/24 T20 25/24 T21 25/24 T22 40/24 T23 30/24 T24 35/24 T25 40/44 T26 35/24 T27 45/24 T28 30/44 T29 30/24 T30 35/24 T31 35/24 | T32 74

## Progress
Task 1: dispatched 14:02 BASE 3169eac, implementer sonnet (est 25 + install/build waits; check due ~35 min)
Task 1: implementer done 17.5 min (est 25), DONE_WITH_CONCERNS, commits 3169eac..c58cdbe; user: finish task 1 then STOP before task 2
Task 1: review 1 done (2.2 min): Spec ❌ Quality not approved; 3 FIX-NOW (commit-msg hook fails w/o global hooksPath; typecheck-staged fail-open; storage proxy ignores instance spies) + Node floor correction; recorded: stub export tests, 85 npm audit, tsc works on working tree. Fix round 1/5 dispatched 14:25 (est 20 min), FIX_BASE c58cdbe
Task 1: fix round 1/5 (4 addressed, 0 open; commits c58cdbe..6a7a509); re-review found 1 new FIX-NOW (typecheck-staged entry-point guard fails open via junction/path casing) + 1 recorded (test timeout). Fix round 2/5 dispatched 14:33, FIX_BASE 6a7a509. Ruling R10: Node floor is ^22.22.1 || >=24 (from lint-staged/pro-components/vitest engines), plan text 'Node >=20' is wrong - plan to be corrected later
Task 1: fix round 2/5 (2 addressed, 0 open; commits 6a7a509..702c9a2), re-review clean. Task 1: complete (commits 3169eac..702c9a2, review clean). Recorded: umi-max stub exports without behavioural tests; 85 npm audit findings (untriaged); tsc checks working tree not index when partly staged (documented in README). Measured: install 4m30 cold, build 18s, vitest 14s cold, implementer 17.5 min (est 25), review chain 2.2+fixes 6+2.2+2.2 min. STOPPED by user before Task 2.
2026-10-26 Task 2: cloud session took over. Env: default Node 22.22.0 is below the floor (22.22.1), installed Node 24.22.1 under $HOME/.local/node24 (PATH export needed per command); subagents and commit hooks work; lockfile engines synced (43f7d30).
2026-10-26 Task 2: implemented and committed 64bcea6 (10 util modules, tests/imageBytes.ts; RED = 10 files fail on missing modules; GREEN 196 tests, tsc and lint clean). Independent review (one round, ~45 mutations): immediate-fix 0; recorded 6 (header-read tests do not catch whole-file reads; no DST case for yesterdayUtc; formatBytes rounds limit and actual to the same text near multiples of 1024; weakened file signatures not caught; formatInstant ISO guard untested; IPv6 host looser than the Android pattern, which is not in the snapshot); not-a-defect 5. Contract question written: docs/contract-requests/2026-10-26-admin-frontend-link-pattern.md. Task 2 complete. Open: immediate-fix 0, recorded 6, not run 0, blocked 0. Report: reports/task-2-report.md.
2026-10-26 Task 3: implemented and committed 81f761f (src/request, locale error and reason texts for 79 contract codes + 3 local codes in zh-CN and en-US, errorCodes.generated.json 79 codes, tests/httpStubs.ts; RED = 7 files fail on missing modules; GREEN 321 tests, tsc and lint clean; 8 own mutations all caught). Deep review round 1 (~130 mutations): immediate-fix 1 (resetSessionState comment let a sign-out flow keep the token; fixed 5ed838b with tests), recorded 15, change 3 (show backend message for known codes without details; no timeouts; gateway 502 text) waiting for the owner, not-a-defect 5, not run 1 (two real-browser points). Re-review of the fix: clean (0 new). Task 3 complete. Open: immediate-fix 0, recorded 15, not run 1, blocked 0, change decisions 3. Report: reports/task-3-report.md.
