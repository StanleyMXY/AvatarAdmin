# AvatarAdmin 项目约定

AvatarApp 的管理后台前端（Umi Max + Ant Design，TypeScript）。32 个任务已全部完成，现在在本地维护和联调。

这份文件只写**这个项目自己的事实**：需求从哪来、产品规则、代码约定、怎么在本机跑。通用的工作方式（怎么分类问题、评审多深、测试怎么分层、何时提交和推送、怎么汇报）由负责人的全局 `CLAUDE.md` 管，本地会话会加载它，这里不再抄一份，免得两份各自过时。云端会话读不到全局设置，只看最后一节。

读什么：计划 `docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`；现状和接下来要做的事 `docs/superpowers/handoff/2026-11-03-local-handoff.md`（云端结束时写的，读完即可，它不再更新）；怎么跑、怎么部署 `README.md`、`docs/deploy.md`。`docs/superpowers/handoff/2026-10-25-cloud-handoff.md` 只作历史。

## 需求来源

- 规格（`docs/admin-frontend-design.md`）和契约（`docs/backend-task-java-backend.md`）的正本在 AvatarApp 仓库的 `main`。本仓库 `docs/shared-snapshots/` 里是逐字节相同的只读快照（来源提交写在那里的 `README.md`）。这是负责人 2026-10-26 定的例外：不让云端会话访问 AvatarApp，所以放一份副本。不在这里改快照；契约快照是旧版，新版接口文档是 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`，换快照由负责人做（步骤见交接文档 5.2）。
- 要改规格或契约的地方，写成完整的变更请求（名称、行为、检查顺序、错误、测试）放到 `docs/contract-requests/`，再由负责人在 AvatarApp 的 `main` 上改。契约的缺口不是阻塞：写成问题文件，当前按最小做法继续。
- 接口的字段名以 `docs/backend-inputs/` 里后端写的文件为准；后端实际行为和契约文字矛盾时，前端按后端代码的实际行为开发，矛盾写在 `docs/contract-requests/2026-11-02-contract-contradictions.md`。
- 不改 AvatarApp、AvatarBackend 仓库里的文件；需要它们改的，写成文件。
- 规格里的 `[子代理读码 …]`、`[核实 … 笔记 …]` 标注是当初核实时留的出处，指向这里看不到的参考项目文件，不是指示，不用去找、不用核对。参考项目不需要看：页面的字段、列、权限码、接口、行为和颜色尺寸，规格第 5、7 节和计划任务 6 里都已逐条写明；规格里写"照某模块"的地方，后面紧跟着展开后的完整说明，按展开的做。

## 产品规则

- 面向海外市场，不把任何一种语言当默认：界面只有 zh-CN 和 en-US，两边键必须相同；假数据和测试要含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文；只覆盖中文的检查，结论里写明"只覆盖中文"。
- 仓库里（文件、文件夹、标识符、注释、文档）不出现参照项目名或任何第三方产品名，不复制参照项目的代码；不写韩文；不留调试日志（需要时用标签 `[avatar-admin]`）。
- 浏览器里不对密码做哈希；请求不带固定令牌；令牌只放内存和 `sessionStorage`；被审核内容的文件地址不写日志；凭据类字段永不回显。
- 已知错误码时界面只显示按码翻译的文字，不附后端 `message`；未知码才退回 `message`。

## 代码约定（有扫描测试守着，细节见交接文档 4.4）

- `src` 下的 `.tsx` 不写死任何语言的文字，走语言文件；放行清单每条要写理由。
- 失败提示：页面存失败本身，画的时候用当前语言现算（`useFailure`、`failureToForm`、`useLatestRead`、`useServerPage`），不存 `describeFailure(...).text`。
- 表单被后端拒绝时用 `setFieldReasons`（`src/utils/fieldReasons.ts`），有校验规则的表单挂 `<RevalidateOnLocaleChange />`，不用裸 `form.setFields`。
- 读取只认最新一次：`useLatestRead` / `useLatestCall`，不手写计数器。
- 列表用 `PagedListTable` / `PagedTable`，操作列用 `...ACTIONS_COLUMN`，开关 `EnabledSwitch`，危险操作 `DangerConfirmButton`，带原因的对话框 `ReasonModalForm`，上传 `UploadField`。
- 后端给的、类型不可信的文字显示前过 `plainText`；金额、价格等十进制字符串不经浮点。
- 假后端要和后端实际行为一致，页面测试通过假后端触发。

## 在本机跑

- Node 要 `^22.22.1 || >=24.0.0`；`.npmrc` 里的 `legacy-peer-deps=true` 不要去掉。`npm ci` 之后：`npm run dev:mock`（假后端）、`npm run dev:api`（对真后端，`ADMIN_API_PROXY_TARGET`）。
- 换行统一为 LF，由 `.gitattributes` 保证；Windows 上不要把 `core.autocrlf` 的 CRLF 带进来，否则代码检查和读规格表格的测试会失败。
- 只跑相关的测试用 `npx vitest run <路径>`。全量测试在核数多、内存少的机器上默认并行数会内存溢出：用 `npx vitest run --maxWorkers=8 --testTimeout=60000`（32 核、约 10 GB 可用内存的机器上约 20 分钟）。
- 提交钩子是 lint-staged 加暂存文件的类型检查；失败就修，不绕过。
- 三个一致性检查要带参数，命令见交接文档第二节。

## 仅云端会话

云端会话读不到负责人的全局设置，需要遵守下面这些；本地会话以全局设置为准，不看这一节。

- 对话和报告用中文；报告开头先写数字：立即修未修 N、记录项 N、未运行 N、阻塞 N，再写"完成"之类的词。没核实过的不写成结论。
- 发现的问题只分五类：立即修（错误输出、崩溃、数据丢失、安全隐私、破坏契约、后面的任务依赖它；带测试修）、记录（真实的小缺陷，写文件行号和触发步骤，最后建议全部修）、变更（新增或改变行为，先给负责人确认关键设计点）、不是缺陷（写理由和行号）、阻塞（只有别人能给的输入）。不用"可选、以后、小改动"代替分类。
- 只读本仓库：不克隆、挂载或申请读取 AvatarApp、AvatarBackend 等其他仓库。
- 推送自己的工作分支（`claude/…`，从 `main` 分出），不直接推 `main`，不强推；由负责人合并。多个会话共用一个检出时，提交只带自己任务的路径（`git add <路径>`、`git commit -- <路径>`）。
