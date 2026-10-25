# 执行约定（每个任务的实现和评审都先读这个文件）

这份文件取代本机上 `.superpowers/` 里的同名约定（那个目录不进仓库）。全项目适用的要求（Global Constraints）、最容易咬到真人的输入（Review Focus）、任务的统一写法、后端回复与暂定做法的出入、规格与契约的冲突表，都在计划里，不在这里重复：`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`。项目规则在仓库根的 `CLAUDE.md`。

## 约定（每条都来自本项目已发生的问题或负责人的明确要求）

- 分支：在你自己的工作分支上做，从 `main` 分出；不开 worktree；不用 `git add -f`、`--no-verify`、`git add -A`、`git commit -a`、强推。
- 需求来源（只读，不改，不复制进本仓库）：
  - 计划：本仓库 `docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`。
  - 规格 `docs/admin-frontend-design.md` 和契约 `docs/backend-task-java-backend.md`：在 GitHub 仓库 `StanleyMXY/AvatarApp` 的 `main` 分支，读不到就是**阻塞**（见交接文档），不要凭记忆写。
  - 后端的四份文件：本仓库 `docs/backend-inputs/`。字段名以它们为准；它们和契约里都没有的接口不要猜，状态 NEEDS_CONTEXT，写成新的问题文件放到 `docs/contract-requests/`，本任务按最小的做法继续。
- 不修改 AvatarApp、AvatarBackend 里的任何文件。
- 提交：每次只提交本任务的路径：`git add <路径…>` 然后 `git commit -m "<说明>" -- <路径…>`。提交说明写这个任务做了什么，不带编号式缩写。提交前的钩子（lint-staged 和暂存文件的类型检查）必须通过。
- 测试：只跑本任务相关的测试：`npx vitest run <路径或文件名>`；不跑全量测试，不跑 `npm run build`（任务 1 和任务 32 除外）。类型检查和 lint 用 pre-commit 钩子，或 `npx biome check <路径>`、`npx tsc --noEmit` 并只看自己路径下的报错。
- Node：版本要求 `^22.22.1 || >=24.0.0`（来自 lint-staged 17.6.0、pro-components、vitest 4.1.10 的 engines）。开始前 `node -v`；不满足就先装满足的版本，再 `npm install`。`.npmrc` 里 `legacy-peer-deps=true` 不要去掉。
- 测试里的时区用 `tests/withTimeZone.ts`，不要靠环境变量。
- 共享文件的归属：`tests/stubs/*`、`tests/setup.ts`、`vitest.config.ts`、`config/config.ts`、`config/routes.ts`、`src/app.tsx`、`src/locales/zh-CN.ts`、`src/locales/en-US.ts` 只由地基任务（1–10）改；模块任务（11–31）只写自己模块的 `src/services/<模块>/`、`src/pages/<模块>/`、`mock/<模块>.mock.ts`、`config/routes/<模块>.ts`、`src/locales/{zh-CN,en-US}/<模块>.ts` 和对应测试；需要改共享文件时状态 NEEDS_CONTEXT。
- 仓库里不出现参照项目名或其他第三方产品名；不写韩文；`src` 下的 `.tsx` 里不写死任何语言的文字（走语言文件，zh-CN 和 en-US 键相同）；不留调试日志；假数据要含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，不只有中文。
- 发现的缺陷或不一致按 `CLAUDE.md` 里的分类（立即修 / 记录 / 变更 / 不是缺陷 / 阻塞）写进任务报告和账本，不用"可选、以后、小改动"这类词代替分类。
- 报告：每个任务一份报告，写到 `docs/superpowers/handoff/reports/task-N-report.md`。报告里写 RED→GREEN 的命令和输出、改了哪些文件、自检发现、本任务的未完成项数。

## 已定的裁决（执行时按这些做）

| 编号 | 裁决 |
|---|---|
| 1 | 任务 4 建好 `config/routes/` 下所有模块的空文件（含 `auth.ts`）；任务 7 往已有的 `auth.ts` 里填内容，不新建 |
| 2 | 任务 6 的聚合文件导入 error、reason、permission、pages 和所有模块的语言文件 |
| 3 | vitest 的 include = `{src,mock,config,scripts,tests}/**/*.test.{ts,tsx}`，`pool: 'forks'`（任务 1 已做） |
| 4 | `tests/stubs/umi-max.tsx` 现在只导出 `IntlProvider`、`useIntl`、`history`；任务 6–8 补 `useAccess`、`useModel`、`useLocation`、`Link`、`getLocale`、`setLocale`；模块任务不改它，需要时 NEEDS_CONTEXT |
| 5 | pre-commit 钩子 = lint-staged（对暂存文件跑 biome）+ `scripts/typecheck-staged`（tsc 跑全项目，只在暂存文件里有诊断时失败）。整个项目的 tsc 由每批任务做完后跑一次，任务 32 再跑一次 |
| 6 | 任务 6 的"禁止写死文字"扫描：外部 https 地址规则跳过 `*.test.*`、`mock/`、`tests/`、`docs/`；禁用名称和固定 token 规则对除 `docs/` 外的所有文件生效 |
| 7 | 任务 9 建 `services/channels` 和 `mock/channels.mock.ts`（读接口）；任务 29 可以改这两个文件加写接口，别的任务不碰 |
| 8 | 任务 10 的测试只断言配置键到页面的映射覆盖；任务 32 断言承载配置的路由都存在 |
| 9 | 模块任务 11–31 可以并行（见交接文档里的执行方式），每个并行的任务只提交自己路径；地基任务 1–10 严格按顺序 |
| 10 | Node 下限见上；计划里旧的"Node ≥ 20"已改正 |

## 评审深度

- 深度评审（多轮、复现缺陷、变异检查）：任务 3（请求层）、4（权限和路由守卫）、7（登录和会话）、8（共用组件，含导出下载和上传）。
- 凭据类字段永不回显的专项检查：任务 25（短信渠道凭据）、28（Facebook 访问令牌），各加一次评审。
- 其余任务：一次独立评审，修真缺陷，不加复审轮次；改名、注释、格式不评审。
- 复审只验证上一轮给出的发现；复审里的新发现只有在破坏必需行为时才算数。
- 评审者必须是和实现者不同的上下文（子代理，或没有子代理时在一个新会话里只读 diff 和任务书做评审）；评审时对每条发现给出分类和"如果带着它上线的后果"。
