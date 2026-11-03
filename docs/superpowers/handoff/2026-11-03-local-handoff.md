# 交接：云端结束，转入本地开发（2026-11-03）

写给：在本地接手这个项目的人和会话。先读仓库根的 `CLAUDE.md`，再读这份。旧的 `2026-10-25-cloud-handoff.md` 是云端开工时的交接，现在只作历史，里面"任务 2 到 32 还没写"之类的话已经过时。

立即修未修 0、记录项（我能修的）0、未运行 3、阻塞 0；待后端回答和待文档修改的事项见第五节。

## 一、现状（一句话）

计划里的 32 个任务全部做完，并且已经合并到 `main`（写这份文档时 `main` 在 `d9ff32b`，之后若有新提交，以 `git log` 为准）。后端第一批交付的前端改动、后端对 140 条问题的回答里要求前端改的 49 条、新版接口文档带来的 13 处影响，都已经落实。**没有任何代码层面的待办挂着。** 剩下的事都在别人手里或要换环境做，见第五节。

数字（合并前最后一次在云端跑的）：

| 项 | 结果 |
|---|---|
| 全量测试 | 454 个文件、8632 个用例：8631 通过、1 个按预期跳过（只在 Windows 上跑的）、0 失败 |
| 类型检查 `npm run tsc` | 0 错误 |
| 代码检查 `npm run lint` | 0 诊断 |
| 三个一致性检查 | 路由（83 个页面路由）、权限码（79 个）、配置键（225 个契约键加 26 个契约采纳前的额外键）全部一致 |
| 生产构建 `npm run build` | 成功；`dist/` 里没有假后端的内容 |
| 页面 | `src/pages` 下 29 个模块目录，83 个页面路由 |

全量测试在云端要 25 到 30 分钟（机器负载高时），本地空闲时会快很多；负载高时偶尔有 5 秒默认超时的用例，单独重跑会过，不是代码问题。

### 本批次（2026-11-03 后端实现了 28 个请求编号）摘要

后端把我们提的 41 项改动请求里建议做的 33 项（对应 28 个请求编号）全部实现了，另 8 项确认不做（说明在 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`，更新后的接口文档是同目录的 `2026-11-03-backend-task-java-backend-updated.md`）。这个仓库按它要做的事分五类（逐项做到哪一步，以各组报告为准）：类型定义和页面改成后端实际的形状（订阅令牌末 6 位、`fileRef` 删除、`kind` 创建后只读、短信四个专用原因等）；假后端与后端实际行为对齐；测试；开发计划（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md` 新增"后端的实现（2026-11-03）"一节，各任务已改）；给后端、给改契约的人的文件（`docs/contract-requests/` 里的状态、版本差异、缺口）。各代码组的报告是 `docs/superpowers/handoff/reports/impl-c1-report.md` 至 `impl-c6-report.md`（c6 是文档组）。

数字（改了多少处、没做几处、没运行几项、阻塞几项、全量测试、类型检查、代码检查）：**等主会话在全部检查跑完后补在这里。**

## 二、本地怎么起来

1. Node 要 `^22.22.1 || >=24.0.0`（下限来自 lint-staged 17.6.0、pro-components、vitest 4.1.10 的 engines）。云端的 Node 是 22.22.0，略低于这个下限，测试能跑；本地请用满足的版本。`.npmrc` 里的 `legacy-peer-deps=true` 不要去掉。
2. `npm ci`（`postinstall` 会跑 `max setup`，`prepare` 会装 husky 钩子）。
3. 开发：
   - `npm run dev:mock`：用 `mock/` 里的假后端，状态在内存里，重启开发服务器即复位。假后端里的演示账号和各种触发方式（例如步骤名 `mock:rate-limited` 触发漏斗 429）写在 `README.md` 的 "Mock backend" 一节。
   - `npm run dev:api`：关掉假后端（`MOCK=none`），`/api` 代理到 `ADMIN_API_PROXY_TARGET`（默认 `http://127.0.0.1:8080`）。**这是对着真后端联调用的，云端从没跑过。**
4. 检查：
   - `npm test`（全量）；只跑相关的：`npx vitest run <路径或文件名>`。机器忙时加 `--testTimeout=60000`。
   - `npm run tsc`、`npm run lint`。
   - 三个一致性检查要带参数（读的是 `docs/shared-snapshots/` 里的快照）：
     ```
     S=docs/shared-snapshots
     npm run check:routes -- $S/admin-frontend-design.md
     npm run check:codes -- $S/admin-frontend-design.md $S/backend-task-java-backend.md docs/superpowers/handoff/permission-code-exclusions.txt
     npm run check:config-keys -- $S/backend-task-java-backend.md
     ```
   - 发布前的完整清单见 `README.md` 的 "Checks before a release"，部署（nginx 示例、缓存规则、构建变量、`TRUSTED_PROXY_CIDRS` 提醒）见 `docs/deploy.md`。
5. 提交钩子：pre-commit = lint-staged（对暂存文件跑 biome）加暂存文件的类型检查。钩子失败就修，不绕过（不用 `--no-verify`）。

## 三、仓库地图

- `src/pages/<模块>/`：每个模块一个目录，页面、对话框和同目录的测试。模块有：activity、ads、analytics、appVersions、avatar、campaign、channels、clientConfig、companionship、complaints、config、cost、credits、dashboard、email、invite、memory、moderation、monitor、notifications、push、sessions、sms、stat、subscriptions、support、system、user、users。
- `src/services/<模块>/`：每个模块的请求函数和类型。`src/request/`：请求层（信封 `{code,message,data}`、`ApiError`、令牌、下载、上传、超时、错误文字）。`src/session/`：登录会话（`SessionGate`、`loadSession`、`ServiceUnavailable`、`useSession`）。
- `mock/<模块>.mock.ts` 加 `mock/_core/`：假后端和它的数据、共用的范围规则（`statRange.ts`）等。`mock/_core/**` 不会被当成接口加载。
- `config/routes/<模块>.ts`：每个模块的路由和菜单；`config/assembleRoutes.ts` 合并。路由顺序由规格的路由总表（`ROUTE_ORDER`）固定，参数路径（`/users/:id`）排在同组固定路径之后。
- `src/locales/{zh-CN,en-US}/<模块>.ts`：界面文字，两种语言键必须对称（有测试）。界面**只有 zh-CN 和 en-US**。
- `src/components/`：共用组件。`src/hooks/`：共用钩子。`src/utils/`：共用函数。`tests/`：测试助手、扫描器、桩。
- `docs/`：
  - `docs/shared-snapshots/`：规格和契约的**只读**快照（正本在 AvatarApp 的 `main`）。
  - `docs/backend-inputs/`：后端写给前端的文件（字段名以它们为准），包括 2026-11-02 的回答和新版接口文档（后者与旧快照差别见 `docs/contract-requests/2026-11-02-contract-version-diff.md`），以及 2026-11-03 的实现说明和更新接口文档（与上一版的差别见 `docs/contract-requests/2026-11-03-contract-version-diff.md`）。
  - `docs/contract-requests/`：我们对后端的提问和对规格、契约的变更请求（见第五节）。
  - `docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`：开发计划，已并入后端的回答和 2026-11-03 的实现。
  - `docs/superpowers/handoff/`：执行约定、账本、各任务和各批修复的报告（`reports/`，约 100 份）、评审文件、决定。

## 四、项目的"记忆"：规则、负责人的决定、写法

### 4.1 负责人的工作方式（来自对话，务必保持）

- 用中文回复；报告开头先写数字：立即修未修 N、记录项 N、未运行 N、阻塞 N，然后才写"完成"之类的词。没核实过的不写成结论。
- **没有规格依据的取舍，按业界通行做法自己定，不要再问负责人**（他明确说过多次）。定了就写进报告或决定文件。
- 契约没写的接口和字段不要猜：写成问题文件放到 `docs/contract-requests/`，当前按最小做法继续；这不是阻塞。
- 不用自造的简称和编号代替描述；不用"工单""台账"。
- `main` 只通过拉取请求改，不直接推；不强推。

### 4.2 `CLAUDE.md` 的要点（原文以它为准）

- 规格和契约快照只读；不碰 AvatarApp、AvatarBackend 仓库。
- 发现的问题只有五类：立即修、记录、变更、不是缺陷、阻塞；不用"可选、以后、小改动"代替分类。
- 评审深度：认证与会话、权限判断、导出下载、凭据字段、请求层做深度评审（多轮、复现、变异检查）；页面、报表、文档、新增测试做一次独立评审。
- 测试分层：每次只跑相关的快速测试；全量测试和构建在一批做完后跑一次。
- 面向海外：假数据和测试要含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文；只覆盖中文的检查要写明"只覆盖中文"。
- 浏览器里不对密码做哈希；请求不带固定令牌；令牌只放内存和 `sessionStorage`；被审核内容的文件地址不写日志；凭据类字段永不回显。
- 仓库里不出现参照项目名或第三方产品名；不写韩文；不留调试日志（需要时用标签 `[avatar-admin]`）。

### 4.3 已定的决定

- `docs/superpowers/handoff/decisions-2026-10-27.md`：变更项的 6 组决定（超级管理员行保护、权限树取消规则、并发保存的版本检查、当天临时值的标法、切换语言后表单校验文字、合并），加权限隐私、全局行为（超时、网关错误重试、对比度、标签标题等）、模块行为里"保留现状"和"采用"的清单。
- `docs/superpowers/handoff/execution-conventions.md`：执行约定和 10 条裁决（共享文件的归属、放行清单等）。
- 其它对话里定的：
  - 已知错误码时界面只显示按码翻译的文字，**不附后端 `message`**；未知码才退回 `message`。
  - 已登录的人打开登录页，直接送走（送到安全的 `redirect`、总览或改密码页）。
  - 账号读不到而令牌还在时，不退出登录：显示"服务暂时不可用"加"重试"和"退出登录"。只有令牌被服务器拒绝才算退出。
  - 后端实际行为优先于契约文字，在两者矛盾时前端按**后端代码的实际行为**开发（例子：管理员二次验证锁定的 429 带倒计时字段）；矛盾写在 `docs/contract-requests/2026-11-02-contract-contradictions.md`。

### 4.4 共用写法（新代码请复用，不要再抄一份）

- 失败提示：页面存**失败本身**，画的时候用当前语言现算（`src/hooks/useFailure.ts`、`failureToForm`、`useLatestRead`、`useServerPage`）。禁止把 `describeFailure(...).text` 存进状态（有扫描测试 `storedFailureText`）。
- 表单被后端拒绝时字段下面的原因：用 `setFieldReasons`（`src/utils/fieldReasons.ts`），切换语言时由 `RevalidateOnLocaleChange` 重写；禁止裸 `form.setFields`（有扫描）。有校验规则的表单要在 `<Form>` 里挂 `<RevalidateOnLocaleChange />`（有扫描）。
- 读取只认最新一次：`useLatestRead` / `useLatestCall`，不要手写计数器（有扫描 `ownCounters`）。
- 列表：`PagedListTable`（带 `initial`/`onCommit` 保留搜索和页码）、`PagedTable`；操作列统一 `...ACTIONS_COLUMN`（固定在右边，有扫描）；开关 `EnabledSwitch`；危险操作 `DangerConfirmButton`；带原因的对话框 `ReasonModalForm`；上传 `UploadField`。
- 后端给的、类型不可信的值（名称、备注、`detail`）显示前过 `plainText`；金额、价格等十进制字符串**不经浮点**（`Intl.NumberFormat` 直接收字符串）。
- 有未保存编辑的页面用 `useLeaveGuard`；统计页的日期用 `DateRangeUtc`，把 400 里指向 `from`/`to` 的错误传给它的 `refused`。
- 当天未过完的值标"临时值"（`src/utils/settledDay.ts`），涨跌不用红绿。
- 图表坐标轴文字用共用的 `axisTextStyle`；颜色对比度要达到 4.5:1（`src/theme/` 里有工具和测试）。
- 假后端要和后端**实际行为**一致，页面测试通过假后端触发；`tests/signInAsAdmin.ts`、`tests/failureLanguage.tsx`、`tests/pageHelpers.ts` 是共用测试助手。
- 禁止写死文字：`src` 下 `.tsx` 里不写死任何语言的文字，走语言文件（`tests/noHardcodedText.test.ts` 扫描；放行清单在 `tests/noHardcodedText.allow.json` 和各模块的 `hardcodedText.allow.json`，每条要写理由）。

### 4.5 流程上的教训（云端并行做事时踩过的）

- 先写会失败的测试并看到红，再改；测试缺口类的修复要做变异检查（故意改坏代码，新测试必须变红）。
- 多个人同时改同一个检出时，`git commit -- <路径>` 会把别人已暂存的文件带进去；本地单人开发时不会遇到。要多开时，各用自己的工作树。
- 独立评审要由不同的上下文做，并且不信实现者的结论；"已修"的报告抽样核对过，仍有个别在真实浏览器里不成立（例如浏览器拒绝站点数据时切换语言），所以涉及浏览器行为的修复要在真实浏览器里看。
- 用来压测的变异脚本要确保跑完后文件恢复；别用 `kill`/`pkill` 去停别人的测试进程。

## 五、接下来要做的事

### 1. 等后端告知或确认，然后前端跟进

**41 项向后端提出的改动请求不再是待办**：2026-11-03 后端实现了建议做的 33 项（28 个请求编号），前端已按它落实（落实情况见各代码组的报告，数字等主会话核对后补）；另 8 项后端确认不做，前端的做法不变——额度包整行提交、不发 `expectedUpdatedAt`（30 号）；开启手机号登录被拒时读 `data.details` 判断缺哪几项（42 号）；游客留存不提供 `unknown`（52 号）；审核队列的等待时长由前端按创建时间算、最老一条取 `oldestPendingSeconds`（62 号）；客服反馈列表把 `pageSize` 设小（65 号）；成本币种从 `GET /config` 读或用成本行里的 `currency`（67 号的 `attributionCostCurrency`）；前端提前校验币种格式（70 号）；漏斗步骤继续用逗号分隔（93 号）。19 号的 `GET /roles` 加 `heldByMe`、60 号的 `GET /account-deletions` 加 `accountId` 筛选后端也没做，前端分别用 `/me.roleIds` 和用户详情的 `deletion` 满足。逐项状态在 `docs/contract-requests/2026-11-02-requests-to-backend.md`。

**仍在后端一侧的事**（2026-11-03 数过，不含本批次各组新写的 `2026-11-03-new-differences-<组号>.md`，那些数等主会话收齐后补）：

- 等后端告知：1 件——后端实现说明第五节第 1 条，后端的全量集成测试，以及应用服务、后台任务两个模块的测试，要等后端持续集成的结果（推送发送逻辑在这两个模块里）。联调时要多看一眼推送记录详情的 `platform`、`tokenSuffix`。
- 要向后端确认细节：4 处，在 `docs/contract-requests/2026-11-03-contract-gaps.md`——G1（任务配置带未改字段的 `PUT` 的检查顺序）、G3（内容类型、资源类型的大小写和检查顺序）、G5（价格 400 的 `ref` 路径下标从几起）、G7（版本号大小比较失败的 400 有没有 `details`）。
- 部分核实的结论：17 条里第 45、137 条已解决，**还剩 15 条**，每条缺什么在 `requests-to-backend.md` 的"未完全核实"一节；要靠对着真实后端联调确认。
- 各组新差异：2026-11-02 的 9 个文件共 43 个小节，其中 10 个已因本批次标了"后端已于 2026-11-03 回答/实现"或"已采纳"，其余 33 个小节不变，是否转给后端由负责人定。
- 向后端问的 140 条问题：全部已答，没有待回答的（`docs/contract-requests/for-backend.md` 的"仍待回答的"一节按 2026-11-03 重新数过）。

### 2. 规格和契约文档的修改（在 AvatarApp 的 `main` 上，由负责人决定谁来改）

- 设计文档 `docs/admin-frontend-design.md`：要改的 16 条在 `docs/contract-requests/2026-10-31-design-doc-changes-from-backend-d1.md`（位置、行为、检查顺序、错误、测试）；另有角色页对 403 的说法（现在写"展示后端 message"，按负责人的规则应是"显示按码翻译的文字，需要区分时由后端给 `data.reason`"）、对话框对含有未持有权限的角色的提示。
- 接口文档（契约）`docs/backend-task-java-backend.md`：2026-11-03 对照更新接口文档核对过，`docs/contract-requests/2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md` 的请求**已被采纳**（17.4 告警类型十八种及四个新类型的行、17.5 的 25 个键及编辑权限、三个键的范围、`GET /alerts` 的参数校验、`moderation.model_check_enabled`），只剩第 2.5 节第三行没写（保存 `auth.phone_login_enabled` 被拒时 400 的 `details`，在 `2026-11-03-contract-gaps.md` 的 G8），采纳情况写在那份请求文件末尾；接口文档与后端代码互相矛盾的 11 条（`2026-11-02-contract-contradictions.md`）里 9 条已被更新接口文档采纳，没采纳的是审计筛选长度的口径一条和代码里过时注释一条（见该文件末尾 2026-11-03 一节）；另有接口文档里还缺的 8 处写成了 `2026-11-03-contract-gaps.md`。设计文档的 16 条（`2026-10-31-design-doc-changes-from-backend-d1.md`）和角色页对 403 的说法不在更新接口文档的范围内，仍待在 AvatarApp 的 `main` 上改；其中 403 现在有 `data.reason`，角色页的说法可以直接写成"按 `data.reason` 显示按码翻译的文字"。
- **快照换成新版之后，前端有一个收尾清理**（步骤原来写在 `docs/superpowers/handoff/reports/diff-b1-report.md` 末尾；现状：接口文档的 17.4/17.5 变更已被采纳，新版是 2026-11-03 的更新接口文档 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`，它的 1.4 原因代码清单已经包含 `NEGATIVE`、`TOO_MANY_DECIMALS` 和短信保护的四个原因，用 `scripts/contractErrors.ts` 的 `reasonCodes` 数过共 35 个，错误码 81 个）。快照 `docs/shared-snapshots/backend-task-java-backend.md` 仍是旧版，等负责人整份替换；替换后：①重新生成 `errorCodes.generated.json` 和配置键清单（`npm run gen:error-codes`、`npm run gen:config-keys`）；②从 `src/pages/config/extraConfigKeys.ts` 删 26 个"契约采纳前的额外键"，删 `NEXT_CONTRACT` 的用法（`scripts/contractErrors.ts`，它指向哪份文档以代码为准）；③更新 `src/locales/parity.test.ts` 里的 225 和 25（现在是 26）；④批量导入的 `NEGATIVE`、`TOO_MANY_DECIMALS` 和短信四个原因：更新接口文档已经写进清单，按计划任务 3 应放在共用的 `reason.*`，断言是 35 个，不再是"14 个"或"16 个"——这一步本批次是否已做，以各代码组报告为准，主会话核对后在这里补一句。
- 未处理的新版接口文档差异里，**新增页面行为**的部分（例如更多筛选）没有做，需要时看 `docs/contract-requests/2026-11-02-contract-version-diff.md`；2026-11-03 的更新接口文档与上一版的差别，以及其中有影响但不在 28 个编号里的 13 条，看 `docs/contract-requests/2026-11-03-contract-version-diff.md`。

### 3. 云端做不了的验证（"未运行 3 项"）——**本地请优先做**

1. **对着真实后端联调**（`npm run dev:api`）：请求体、错误码、分页、响应形状、审计行、导出文件里号码是否掩码、各接口的真实 JSON 类型（例如金额是数还是字符串）。云端所有结论都来自假后端和后端会话读代码的回答，**后端没有运行过任何请求**。联调中发现不一致，按"后端实际行为"改前端，并写成问题文件。
2. **其他浏览器和设备**：Firefox、Safari、手机真机和触摸（标签菜单长按、图表触摸）、屏幕阅读器；Safari 对 10 秒后撤销对象地址的下载、非 ASCII 文件名被当 Latin-1 解码是任务 3 点名的两处。云端只有无头 Chromium，且主要在 1440 宽和 390 宽下看过。
3. **完整的真实浏览器走查**：各页面主要靠页面测试通过假后端验证；真实浏览器里只抽查过一部分（总览、用户列表、配置、角色、告警、推送模板、短信模板、价格、投放、广告等约 20 到 38 个代表页面，中文和英文、浅色和深青主题）。**还没有人逐页逐操作地点过写操作**（导出下载、封禁、赠送服装、发放限时权益、新建额度申请、真实大文件上传：50 MB 视频、100 MB 的 APK、小于 1 MB 但像素极大的 JPEG）。也没有用真正的 Microsoft Excel 打开过导出文件，没有在夏令时跨午夜的时区下看过周期推送的"下次生成时间"，没有真实发送短信。

### 4. 做了决定但没有做的 4 处（想做可以做）

1. 验证码锁定 429 的 `Retry-After` 响应头：页面和假后端都没处理（页面按 `retryAfterSeconds` 的分钟数显示已够）。
2. 批量成本导入每行仍必须带币种：后端接受不带，页面比后端严；放宽要先改规格里的批量模板。
3. 事件明细精确到分钟的时间选择：负责人 10 月 27 日定了保留现状。
4. 问题文件正文里逐小节的"已答"标注：只在每个文件末尾加了一行指向答案文档的话；429 个小节没有可靠的编号对应。

### 5. 已知的限制（不是缺陷，但要心里有数）

- 整条 `PUT /admins/{id}` 必须带当前角色，列表里读到的角色已过期时会覆盖别人刚做的角色变更——这是接口本身的限制。
- 带 `/` 的内置权限节点码（如 `MENU:/system/audit`）的修改和删除请求在真实后端上很可能调不通（后端会话的推断，未验证）。
- 验证码第 5 次错误的"再错将被锁定"提示按后端默认的 5 次计数，页面不知道配置里实际的上限。
- 形象目录的上下架和适用风格筛选，后端不支持（`GET /cosmetics` 只认 `kind`），页面只能对本页内容过滤，页数和总数仍包含所有的行。审核记录的内容类型筛选后端 2026-11-03 起支持（`contentType`），页面改为发参数，分页和总数正确。
- 浏览器关闭标签页不经过站内路由，不会弹未保存提示。

## 六、文档索引（按用途）

| 要找什么 | 去哪 |
|---|---|
| 项目规则 | `CLAUDE.md` |
| 计划（含"后端的回答（2026-11-02）"一节） | `docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md` |
| 执行约定、决定 | `docs/superpowers/handoff/execution-conventions.md`、`decisions-2026-10-27.md` |
| 每个任务做了什么、测试、评审 | `docs/superpowers/handoff/reports/task-N-report.md`、`task-N-review.md` |
| 后续每批修复的报告 | 同目录 `batch-fix-*`、`decided-*`、`backend-d1-*`、`answers-*`、`diff-*`、`final-*`、`session-unavailable-review.md` |
| 记录项去重后的总数和仍未修的清单 | `reports/final-tally.md`（去重后 422 条；当时仍未修的 7 条之后已全部处理） |
| 任务 32 的最终验收 | `reports/task-32-report.md`（数字是 10 月 27 日的，之后又修了很多） |
| 账本 | `docs/superpowers/handoff/ledger.md`（只记到任务 32；之后的批次看各自的报告） |
| 后端的文件、回答、新版接口文档 | `docs/backend-inputs/` |
| 发给后端的问题和改动请求 | `docs/contract-requests/`（先看 `README.md`、`for-backend.md`、`2026-11-02-requests-to-backend.md`） |
| 规格和契约快照（只读） | `docs/shared-snapshots/` |
| 部署 | `docs/deploy.md`、`README.md` 的 Deployment |

核对于 2026-11-03
