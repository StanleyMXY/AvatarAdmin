改了 5 处（请求 2、5、41、103、137）、没做 0 处、没运行 3 项、阻塞 0

立即修未修 0、记录项 0、未运行 3、阻塞 0。

组 c1。"后端实现说明"指 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`，"更新接口文档"指同目录 `2026-11-03-backend-task-java-backend-updated.md`。计划里这 5 个请求的写法由组 c6 先写进了计划（提交 `f948745`），我没有再改计划，只核对了代码和它写的一致。

## 提交

| 提交 | 内容 |
|---|---|
| `94edf34` | 请求 2 的全部代码、假后端和测试。**这个提交的说明写的是"Push templates…（请求 35）"**：推送组提交时把我当时工作区里还没提交的订阅文件一起带进去了（共用一个检出，他们的提交带上了别人未提交的改动）。内容是我的，说明不是；没有改历史。涉及的文件见下表 |
| `b82f345` | 请求 103（管线来源下拉）。这个提交里还带进了别组暂存的 `src/pages/system/admins.test.tsx`（不是我的，同样是共用检出的竞争） |
| `24fe845` | 请求 137（记忆模型冲突带原维度）。这个提交里还带进了别组暂存的计划文件改动（不是我的） |
| `ba636a4` | 请求 41 的译文：四个保护性原因代码加 `reason.*`，检查"接口文档的每个原因都有译文"的测试改读更新接口文档 |
| `3fbaf1a` | 请求 5 和 41 的页面、假后端、类型、测试（两条在同一批文件里，没有拆开：假后端、语言文件、短信服务类型里两条的改动交织在一起，拆开会留下一个页面测试过不了的中间状态） |

## 对照表

| 请求 | 后端实现说明怎么说（节） | 前端要改什么 | 状态 | 提交；文件和行号 |
|---|---|---|---|---|
| 2 订阅令牌末 6 位 | 第二节第 2、3 条；第三节 2 号（更新接口文档第 2394、2451 行） | `linkedPurchaseToken` 删除，GOOGLE 的 `storeRef` 为 `null`，读 `storeRefSuffix`、`linkedPurchaseTokenSuffix`；事件的 `sourceEventId`、`payload` 里的令牌键改名；去掉前端自己截取末 6 位的代码；加"页面拿不到也不显示完整令牌"的测试 | 已改。抽屉对 GOOGLE 订阅只读 `storeRefSuffix`（没有则显示破折号；即使应答里还带着 `storeRef` 也不显示），Apple 订阅照旧显示完整 `storeRef`；`REF_SUFFIX` 和截取代码已删。事件列表和时间线原本就不显示 `sourceEventId`、`payload`，没有显示要改，只改了类型（加 `payload`、`status`）。假后端按后端行为：库里存完整令牌，应答里遮掉（订阅列表、详情、事件列表、重处理和确认的返回都遮） | `94edf34`：`src/pages/subscriptions/SubscriptionDrawer.tsx` 约 124 至 140 行，`src/services/subscriptions/types.ts` 58 至 66 行、`SubscriptionEvent` 一段，`mock/_core/subscriptionsData.ts` 449 至 480 行（`publicSubscription`、`renameTokens`、`publicEvent`），`mock/subscriptions.mock.ts`；测试 `src/pages/subscriptions/list.test.tsx`（三条：收到的应答里没有完整令牌；应答仍带完整令牌时也只显示末 6 位；没有后缀时显示破折号）、`events.test.tsx`（事件应答里没有完整令牌，键已改名，页面上没有）、`mock/subscriptions.mock.test.ts`（订阅、事件各层的遮蔽，Apple 不遮） |
| 5 短信渠道凭据 | 第二节第 6 条；第三节 5 号（更新接口文档第 3852、3854 行） | 表单按所选供应商的 `credentialNames` 生成输入项；缺名称 `EMPTY_NOT_ALLOWED`、多名称 `OUT_OF_RANGE`、换供应商不给凭据 `EMPTY_NOT_ALLOWED`、`PUT` 传空保留已存凭据；"凭据永不回显"保持 | 已改。每个供应商声明的名称一个只写框（密码框、不可显示、不填充），没有"名称加值"行；只在每个框都填了时才发，且只发该供应商声明的名称；全空不带 `credentials`（保留已存）；只填一部分页面先拦住并说缺哪几个；编辑时换成需要凭据的供应商要求全填；换供应商时已输入的内容清空。两种后端 400 各有固定文字放在凭据区，不显示后端 `message`。本地桩（无名称）显示"不需要凭据"。假后端按文档校验名称。真实浏览器（Playwright Chromium，`dev:mock`）看过：选 gateway-b 出两个框，只填一个出现"还缺 apiSecret"，换成 test-stub 框消失、提示消失 | `3fbaf1a`：`src/pages/sms/ChannelModal.tsx` 108 至 140 行、凭据一项 300 至 350 行，`src/pages/sms/CredentialFields.tsx`（新），`src/pages/sms/channelRules.ts` 54 至 80 行（`credentialsProblem`）和 `buildChannelBody`，`src/services/sms/index.ts` 62 至 100 行，`src/services/sms/types.ts`，`mock/sms.mock.ts` 200 至 250 行（`credentialsDetail`），`mock/_core/smsData.ts`（供应商的 `credentialNames`），语言文件；测试 `channels.form.test.tsx`、`channelRules.test.ts`、`sms.test.ts`、`mock/sms.mock.test.ts` |
| 41 保护性 400 的四个原因，meta 的两个字段 | 第二节第 4 条；第三节 41 号（更新接口文档第 112、3833、3854 行） | 四条 `reason.*` 译文；删掉对这四种情形按 `OUT_OF_RANGE` 翻译的逻辑，各显示固定说明；meta 恰好四个顶层字段、`providers[]` 恰好三项；操作前的提示读 `phoneLoginEnabled`、`phoneAccountCount` | 已改。更新接口文档第 112 行已把四个值写进封闭集合，所以把检查用的"新版本"（`NEXT_CONTRACT`）改成它，四条译文加进 `reason.*`；同一份文档还多了 `NEGATIVE`、`TOO_MANY_DECIMALS`，检查要求它们也有 `reason.*`，我按金额写了通用译文加进去（投放批量导入对话框里自己的两条原文没动）。`OUT_OF_RANGE` 不再被当作这四种情形（有测试：它只显示按码翻译的通用句）。操作前的提示：meta 说手机号登录关且没有手机号账号时不再询问（后端不拦），否则按实际情况写出开着的条件和账号数，读不到 meta 时写"读不到"仍然询问。只有短信权限的管理员能读 meta，不再依赖读配置 | `ba636a4`：`scripts/contractErrors.ts` 19 行、`scripts/contractErrors.test.ts`，`src/locales/{en-US,zh-CN}/reason.ts`；`3fbaf1a`：`src/pages/sms/useLastOtpPrompt.tsx`（`lastChannelReason`、`readPhoneGuard`、`guardOff`），`src/pages/sms/templateFailure.ts`，`src/services/sms/index.ts` `getSmsMeta`，`mock/sms.mock.ts` 的 `refuseLastChannel`、meta，测试 `channelFailure.test.ts`、`templateFailure.test.ts`、`channels.test.tsx`、`templates.test.tsx`、`mock/sms.mock.test.ts` |
| 103 管线来源 | 第三节 103 号（更新接口文档第 1824 行） | 来源下拉取自 `sources`，停止上报的来源也能看到 | 已改。页面不再从点里攒来源，下拉就是最新一次应答的 `sources`（加上正在选中的那个）；假后端给 `sources`（含一个没有任何点的 `agent-server-retired`，没有任何上报时为空）；不受 `from`、`to`、`source` 影响 | `b82f345`：`src/pages/monitor/pipeline.tsx` 86 至 89 行，`src/services/monitor/index.ts` 71 至 85 行，`mock/monitor.mock.ts` 105 至 118 行，`mock/_core/monitorData.ts`；测试 `pipeline.test.tsx`（两条）、`mock/monitor.mock.test.ts` |
| 137 记忆模型冲突 | 第三节 137 号（更新接口文档第 2312 行） | 409 的 `data` 是 `{detail, registeredDimensions}`，冲突提示里显示原维度，`null` 时不显示，不显示 `detail` | 已改。`registeredDimensions` 是正整数时用带维度的译文，其余（`null`、缺失、不是整数、不是数）用原来的按码译文；`detail` 仍不显示。中英文各一句，切换语言时跟着变 | `24fe845`：`src/services/memory/index.ts` 75 至 88 行（`registeredDimensionsOf`），`src/pages/memory/ModelForm.tsx` 56 至 70 行，`mock/memory.mock.ts` 151 行，语言文件 `memory.model.conflictRegistered`；测试 `models.test.tsx`（中文、英文、六种非整数取值）、`failureLanguage.test.tsx`、`mock/memory.mock.test.ts` |

## 测试和检查

- 先写会失败的测试并看到红，再改：2、103、137 的页面测试和假后端测试都先红过；5、41 的假后端测试先红过；5、41 页面和规则函数的部分是先写实现再补测试，之后用变异检查补上证据。
- 变异检查（故意改坏，测试必须变红，改完已恢复，`git diff` 核对过）：假后端不遮令牌 → 事件列表测试红；抽屉改读 `storeRef` → 订阅测试红；管线下拉改回从点里攒 → 两条红；`registeredDimensionsOf` 永远返回无 → 三条红；`buildChannelBody` 发所有输入过的名称 → 红；`credentialsProblem` 永远没问题 → 页面两条红；`lastChannelReason` 也认 `OUT_OF_RANGE` → 两条红；`guardOff` 永远为假 → 两条红；假后端不查多出的名称 → 两条红。
- 跑过：`src/pages/sms`、`src/services/sms`、`mock/sms.mock.test.ts`、`src/pages/subscriptions`（含实体、开关页）、`src/pages/users/detailPanels.test.tsx`、`src/pages/monitor`、`src/pages/memory`、各自的服务和假后端测试、`src/locales`、`scripts`、`tests`（扫描类：禁止写死文字、字段原因、重新校验、存失败文字）全部通过。机器负载高时（负载 15 到 24，别组同时在跑 40 个测试进程）有几条 30 秒超时，单独或减少并行（`--maxWorkers=2`）重跑都通过，不是代码问题。
- `tsc --noEmit` 0 错误（我提交时），`biome check` 我的文件 0 诊断。

## 没运行

1. 全量测试和生产构建（任务要求只跑相关的）。
2. 三个一致性检查（`check:routes`、`check:codes`、`check:config-keys`）：没改路由、权限码、配置键；`check:codes` 读的是旧快照。
3. 真实浏览器只看了短信渠道对话框（英文、深色）；订阅抽屉、管线下拉、记忆登记对话框、短信对话框的中文只靠页面测试。

## 给主会话的提醒

1. `NEXT_CONTRACT`（`scripts/contractErrors.ts`）已指向更新接口文档，原因代码数从 29 变成 35；组 c5（成本）如果也要改这一处，会发现已经改了；`reason.NEGATIVE`、`reason.TOO_MANY_DECIMALS` 我已加进共用的 `reason.*`，他们若也加，会有重复键，类型检查会报。
2. 接口文档没写清的细节写在 `docs/contract-requests/2026-11-03-new-differences-c1.md`（8 处：既缺又多名称时的 `details`、空字符串的凭据值、`credentialNames` 的顺序、国家覆盖的范围、令牌不足 6 位、Apple 的 `storeRefSuffix`、`sources` 有没有上限、其他 409 的形状）。
3. 本批改动让操作前的提示变少：手机号登录关且没有手机号账号时，删除、停用最后一个验证码渠道或模板不再弹确认（后端此时也不拦）。这是按负责人"据 `phoneLoginEnabled`、`phoneAccountCount` 在操作前给提示"的字面做的取舍。
4. 共用检出里别组的提交把我的未提交文件带走过一次（`94edf34`），也把别组的暂存文件带进过我的两个提交（`b82f345`、`24fe845`）；内容都在历史里，只是提交说明和实际内容不完全对应。
