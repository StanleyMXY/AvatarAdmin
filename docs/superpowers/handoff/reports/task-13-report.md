# 任务 13 报告：记忆服务、系统监控与告警、客服

**立即修未修 0、记录项 4、未运行 2、阻塞 0。**

- 记录项 4 条见下面"记录项"：共用表格组件的空搜索卡片、共用确认气泡的长文字不换行、共用配置行对"从未设置的 JSON 项"显示"不是合法 JSON"、管线页来源下拉只认得已经返回过的来源。
- 未运行 2 条：全量测试和构建（按项目规则留到全部任务做完后跑一次）；用户详情页的"记忆"页签（`AccountMemoryTab`）没有放在任何路由页面里，只在组件测试里验证过，没有在真实浏览器里点过（用户详情页由别的任务做）。
- 变更候选 3 条（需要负责人确认）见最后。

## 做了什么

三个模块目录，所有文件只在任务 13 的路径内：

| 模块 | 文件 |
|---|---|
| 记忆服务 | `src/services/memory/index.ts`、`src/pages/memory/{tiers,models,TierForm,ModelForm,AccountMemoryTab}.tsx`、`mock/memory.mock.ts`、`mock/_core/memoryData.ts`、`config/routes/memory.ts`、`src/locales/{zh-CN,en-US}/memory.ts` |
| 系统监控与告警 | `src/services/monitor/{index,alertTypes}.ts`、`src/pages/monitor/{pipeline,alerts}.tsx`、`mock/monitor.mock.ts`、`mock/_core/monitorData.ts`、`config/routes/monitor.ts`、`src/locales/{zh-CN,en-US}/monitor.ts` |
| 客服 | `src/services/support/index.ts`、`src/pages/support/{feedback,FeedbackDrawer}.tsx`、`src/pages/support/feedbackTexts.ts`、`mock/support.mock.ts`、`mock/_core/supportData.ts`、`config/routes/support.ts`、`src/locales/{zh-CN,en-US}/support.ts` |

测试：每个模块的 `src/services/<模块>/*.test.ts`、`src/pages/<模块>/*.test.tsx` 和 `testSetup.ts`（只给本模块的页面测试用）、`mock/<模块>.mock.test.ts`；三个模块共用一个路由测试 `config/routes/memoryMonitorSupport.test.ts`。问题文件：`docs/contract-requests/2026-10-26-admin-frontend-memory-monitor-support.md`。

### 给别的任务用的东西

- 总览任务（21）：`listAlerts({ status, type, page, pageSize })`、`resolveAlert(id)`、`ALERT_TYPES`（14 种，来自 `src/services/monitor`）。"未处理告警"卡片用 `listAlerts({ status: 'OPEN', page: 1, pageSize: 1 })` 的 `total`。
- 用户详情任务：`getAccountMemory(id)`、`assignEmbeddingModel(accountId, name)`（`src/services/memory`），以及现成的页签组件 `src/pages/memory/AccountMemoryTab.tsx`（默认导出，属性 `accountId`、`accountStatus`；账号状态是 `PENDING_DELETION` 或 `DELETING` 时指派按钮禁用并写明原因，指派按钮和警告只对 `MEMORY:MODEL_ASSIGN` 渲染；页签本身要不要显示由用户详情页按 `MEMORY:VIEW` 决定）。

### 路由和权限（规格 5.0 表，契约为准）

| 路径 | name | 查看权限 | 页面里的写权限 |
|---|---|---|---|
| `/support/feedback` | `feedback` | `SUPPORT:VIEW` | "重试"：`SUPPORT:MANAGE` |
| `/memory/tiers` | `tiers` | `MEMORY:VIEW` | "新建档位"和"修改"：`MEMORY:TIER_CONFIG` |
| `/memory/models` | `models` | `MEMORY:VIEW` | "登记模型"和参数区：`MEMORY:MODEL_REGISTER` |
| `/monitor` | `pipeline` | `MONITOR:VIEW` | — |
| `/monitor/alerts` | `alerts` | `MONITOR:VIEW` | "关闭"：`MONITOR:MANAGE` |

反馈详情是抽屉，不是路由。记忆模型页放了 `<ConfigForm editPermission="MEMORY:MODEL_REGISTER" />` 的"参数"区，只对有这个码的管理员显示（没有这个码时连 `GET /config` 都不发）。

## 红到绿

**红（实现之前，因为"功能不存在"而失败，不是拼写或配置错）**

```
$ npx vitest run src/services/memory src/services/monitor src/services/support
 FAIL  src/services/support/support.test.ts
Error: Failed to resolve import "./index" from "src/services/support/support.test.ts". Does the file exist?
 Test Files  3 failed (3)      Tests  no tests

$ npx vitest run mock/memory.mock.test.ts mock/monitor.mock.test.ts mock/support.mock.test.ts
 FAIL  mock/memory.mock.test.ts   Error: Failed to resolve import "./_core/memoryData" from "mock/memory.mock.test.ts". Does the file exist?
 FAIL  mock/monitor.mock.test.ts  Error: Failed to resolve import "./_core/monitorData" ...
 FAIL  mock/support.mock.test.ts  Error: Failed to resolve import "./_core/supportData" ...
 Test Files  3 failed (3)      Tests  no tests

$ npx vitest run src/pages/memory
 FAIL  src/pages/memory/AccountMemoryTab.test.tsx  Error: Failed to resolve import "./AccountMemoryTab" ...
 FAIL  src/pages/memory/models.test.tsx            Error: Failed to resolve import "./models" ...
 FAIL  src/pages/memory/tiers.test.tsx             Error: Failed to resolve import "./tiers" ...
 Test Files  3 failed (3)      Tests  no tests

$ npx vitest run src/pages/monitor src/pages/support
 FAIL  src/pages/monitor/alerts.test.tsx    Error: Failed to resolve import "./alerts" ...
 FAIL  src/pages/monitor/pipeline.test.tsx  Error: Failed to resolve import "./pipeline" ...
 FAIL  src/pages/support/feedback.test.tsx  Error: Failed to resolve import "./feedback" ...
 Test Files  3 failed (3)      Tests  no tests
```

**绿（实现之后）**

```
$ npx vitest run src/services/memory src/services/monitor src/services/support \
    src/pages/memory src/pages/monitor src/pages/support \
    mock/memory.mock.test.ts mock/monitor.mock.test.ts mock/support.mock.test.ts \
    config/routes/memoryMonitorSupport.test.ts
 Test Files  13 passed (13)
      Tests  176 passed (176)
```

176 个测试：路由 9、记忆假后端 22、监控假后端 16、客服假后端 9、档位页 23、模型页 19、账号页签 15、告警页 20、管线页 15、客服页 17、三个服务文件 4 + 6 + 1。另外 `src/locales`（两种语言键相同、占位符相同、英文里没有中日韩字符、每个页面路由有菜单文字）和 `tests/noHardcodedText.test.ts`（源码里没有不经语言文件的文字）对我的文件通过；`tests/noHardcodedText.test.ts` 里"没有隐藏字符"这一条当前红，红的位置全在别的任务的文件里（`mock/avatar.mock.test.ts`、`mock/credits.mock.test.ts`），我的文件没有。

```
$ npx biome check <我的全部路径>   → Checked 45 files. No fixes applied.
$ npx tsc --noEmit                  → 我的路径下没有错误
```

### 任务书 Tests 一节逐条对应

| 任务书的测试 | 测试在哪里 |
|---|---|
| 告警类型常量表等于契约列的 14 种 | `src/services/monitor/monitor.test.ts`：从 `docs/shared-snapshots/` 契约快照里把"后台告警"一段的类型名读出来，和 `ALERT_TYPES` 比 |
| 未知类型显示原始字符串，不崩溃 | `alerts.test.tsx` "shows a type it does not know as it is" |
| 每种类型在两种语言里有文字 | `monitor.test.ts` 和 `alerts.test.tsx` 的"every one of the fourteen types in words in en-US / zh-CN" |
| "关闭"只对 `MONITOR:MANAGE` 渲染 | `alerts.test.tsx`（有权限、没权限、已解决的行没有） |
| 关联账号跳 `/users/:id` | `alerts.test.tsx`（链接 `href`；没有账号显示"—"） |
| 关闭调用 `POST /alerts/{id}/resolve` | `alerts.test.tsx` 和假后端测试 |
| LOOK_PACKAGE 的关闭确认写明"会把这个驱动资源包的失败次数清零并重新排准备任务" | `alerts.test.tsx`（zh-CN 里断言原句；en-US 里断言对应英文；别的类型用通用确认） |
| 档位修改表单顶部有"会立即影响该档位下所有账号" | `tiers.test.tsx`（修改和新建两个对话框） |
| 档位名不在列表里时先确认"将新建档位 X" | `tiers.test.tsx`（取消不发请求、确认才发；名字在列表里不问） |
| embedding 注册 409 `MEMORY_MODEL_CONFLICT` 原样展示 `detail` | `models.test.tsx`（假后端的句子、泰语加阿拉伯语加 2000 个字符无空格的句子、没有 `detail` 时退回通用文字） |
| 指派模型的警告文字存在；待删除 / 删除中时按钮禁用 | `AccountMemoryTab.test.tsx` |
| 没有数据的序列显示"暂无数据"而不是错误 | `pipeline.test.tsx`（一个序列没有值、完全没有数据、两种都不出现错误提示） |
| 空值点不画 | `pipeline.test.tsx`（数据里的 `null` 不进图，不画成 0） |
| 页面有跳转成本报表的链接，没有成本图 | `pipeline.test.tsx`（`/cost/report` 链接；页面恰好三张图，没有成本卡片） |
| `FAILED` 行的"重试"只对 `SUPPORT:MANAGE` 渲染 | `feedback.test.tsx`（没权限没有；有权限只在 `FAILED` 行有） |
| 详情抽屉显示 `context` 的各字段 | `feedback.test.tsx`（App 版本、系统版本、设备型号、语言、最近错误；没有 `context` 显示"未上报"；缺字段显示"—"） |
| 长反馈（阿拉伯语、泰语长串）不撑破列表 | `feedback.test.tsx`（4000 个码点无空格的泰语串、阿拉伯语长文、emoji；格子 `overflow:hidden`、有 `maxWidth`、`dir="auto"`） |

每个写操作另测：权限不足不渲染按钮、成功、后端拒绝时显示文字（`error.<码>`）、连点只发一次请求、请求途中令牌过期（401 `ADMIN_INVALID_TOKEN`）不重发。

## 真实浏览器检查

做了：登录 `root`，在 1440 宽下打开五个页面、点一遍主要操作，并截图看了布局；zh-CN 下打开告警页和新建档位对话框；390 宽下五个页面看有没有横向滚动。

- 控制台：除了登录第一步（还没输验证码）的 401 和检查里故意触发的 409（登记同名不同维度），没有错误。
- 档位页：列表、详情抽屉、修改对话框（顶部橙色提示）、新建档位的确认、保存后的提示和列表刷新，都正常。
- 模型页：列表、"参数"区、登记对话框（顶部"先把 TEI 容器启动好再登记"）；同名不同维度时把记忆服务的原句显示在对话框里，对话框不关。
- 管线页：三张折线图（GPU 利用率、报错数、报错率）按来源分线；切到"agent-server-3"（只报 GPU）时，报错数和报错率两张显示"暂无数据"，GPU 照画；7 天范围触发假后端的 5000 点上限。
- 告警页：默认筛选"未处理"；关联账号是链接；LOOK_PACKAGE 行的"关闭"弹出带原句的确认，确认后行消失；中文下同样。
- 客服页：列表里泰语长串、阿拉伯语长文被截成几行；详情抽屉里泰语 4000 个码点的串自动换行，阿拉伯语从右到左；重试后该行变成"待转发"。
- 390 宽：第一次发现管线页的时间范围按钮（5 个）把页面撑到 486 宽，出现横向滚动；给按钮套了一层 `overflow-x: auto`，复查五个页面全部 390 宽无横向滚动。
- 发现但不在我的文件里的问题，见"记录项"。

**怎么做的：** 同一个检出里同时有几个任务各起了开发服务器，它们共用 `src/.umi` 和 `node_modules/.cache` 的依赖预构建缓存，我的服务器两次被冲坏（页面空白；控制台 `Module ".//home/user/AvatarAdmin/node_modules/@umijs/plugins/node_modules/react-intl" does not exist in container`，终端 `Can't resolve '/home/user/AvatarAdmin/src/.umi/exports'`）。所以浏览器检查改在检出的一份复制（放在会话临时目录，不进仓库，包括复制的 `node_modules`）上跑，端口 8303，改了源文件就把改动的文件复制过去。跑完后按进程号停了服务。

**没有检查的：** `AccountMemoryTab`（没有页面放它，见"未运行"）。

## 变异检查

把每个关键判断拿掉或反过来，跑对应的测试，全部变红（36 个，0 个漏）：

| # | 变异 | 结果 |
|---|---|---|
| 1 | 告警页"关闭"不看 `MONITOR:MANAGE` | 红 |
| 2 | 已解决的行也显示"关闭" | 红 |
| 3 | LOOK_PACKAGE 的确认文字不特殊处理 | 红 |
| 4 | 关闭后（含被拒绝时）不重新读列表 | 红 |
| 5 | 未知告警类型不显示原始字符串 | 红 |
| 6 | 告警页默认筛选不是"未处理" | 红 |
| 7 | 客服页"重试"不看 `SUPPORT:MANAGE` | 红 |
| 8 | "重试"对所有状态显示 | 红 |
| 9 | "重试"不先确认 | 红 |
| 10 | 抽屉里不显示 `context` 的字段 | 红 |
| 11 | 档位名不在列表里也不确认新建 | 红 |
| 12 | 档位名规则检查去掉 | 红 |
| 13 | 档位数值范围检查去掉 | 红 |
| 14 | 档位对话框顶部去掉"立即影响所有账号" | 红 |
| 15 | 没有 `MEMORY:TIER_CONFIG` 也显示"修改""新建档位" | 红 |
| 16 | 档位保存绕过防重复提交 | 红 |
| 17 | 保存档位时发送全部五项（而不是只发改动的） | 红 |
| 18 | 什么都没改也发请求 | 红 |
| 19 | 模型页丢掉 409 的 `detail` | 红 |
| 20 | 模型地址检查去掉 | 红 |
| 21 | 没有 `MEMORY:MODEL_REGISTER` 也显示"登记模型" | 红 |
| 22 | 参数区对所有有查看权限的人显示 | 红 |
| 23 | 账号页签对待删除 / 删除中的账号不禁用 | 红 |
| 24 | 没有 `MEMORY:MODEL_ASSIGN` 也显示指派 | 红 |
| 25 | 去掉指派的警告文字 | 红 |
| 26 | 指派不先确认 | 红 |
| 27 | 管线页把空值画成 0 | 红 |
| 28 | 管线页没有"暂无数据" | 红 |
| 29 | 没有 `COST:VIEW` 也显示成本报表链接 | 红 |
| 30 | 去掉"数据被截断"的提示 | 红 |
| 31 | 假后端关闭已解决的告警不报 409 | 红 |
| 32 | 假后端关闭告警只要 `MONITOR:VIEW` | 红 |
| 33 | 假后端对待删除的账号也允许指派 | 红 |
| 34 | 假后端同名不同维度不报 409 | 红 |
| 35 | 假后端对不是 `FAILED` 的反馈也允许重试 | 红 |
| 36 | `ALERT_TYPES` 少一种（LOOK_PACKAGE_PREPARE_FAILED） | 红 |

（"档位保存时发送全部五项"这一条是我在评审自己时发现、改掉的：见下面"自检发现"第 1 条。）

## 覆盖了哪些语言

- 界面文字：zh-CN 和 en-US 两边键相同、占位符相同（`src/locales` 的测试），告警 14 种类型、反馈 4 种类别和 3 种状态两边都有文字；zh-CN 在浏览器和测试（告警页的 LOOK_PACKAGE 确认、14 种类型）里都看过。
- 假数据和测试里的文字：泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文都有（客服反馈的正文和 `context.locale`，告警的 `detail`）；另有 4000 个码点没有空格的泰语串（契约规定的正文上限）、一个 5000 字符无空格的告警详情、emoji（`😀` 重复）、阿拉伯语长文。档位名的检查测了泰语、阿拉伯语、空格、点和 65 个字符。
- 不适用：本任务没有统计日，所以"UTC 日边界"不适用；管线图的时间点按浏览器时区显示（`Intl`），页面上写了这一点。

## 自检发现（按 CLAUDE.md 的分类）

1. **立即修，已修：** 档位修改最初发送全部五项。契约允许部分更新（"未给出的字段保持原值"），而修改的是立即影响所有账号的运行参数：两个管理员同时改同一个档位的不同项时，后保存的会把另一个人刚改的项悄悄改回去。现在修改已有档位只发这一次改动过的项，什么都没改时提示"没有改动"、不发请求；新建档位仍发全部五项（新档位没有"原值"）。测试：`tiers.test.tsx` 的"saves only the settings that were changed"、"does not overwrite a setting that another administrator changed meanwhile"、"says nothing changed"；变异 17、18。
2. **立即修，已修：** 管线页的时间范围按钮在窄屏撑出横向滚动（见浏览器检查）。
3. **不是缺陷：** 告警 14 种。任务书写"规格 5.14 只列了 13 种，少了 LOOK_PACKAGE_PREPARE_FAILED"，但 `docs/shared-snapshots/admin-frontend-design.md` 第 342 行现在已经列了这 14 种，和契约一致，不用改规格。
4. **不是缺陷：** 假后端里 `newhire` 是"必须改密码"的预置管理员，我的测试一律用 `reviewer` 再改权限，没有用 `newhire`。

## 记录项（4）

1. `src/components/PagedListTable.tsx`（`search={{ defaultCollapsed, labelWidth: 'auto' }}` 总是画搜索区）：没有任何可筛选列的页面，搜索区是一张只有"重置""查询"两个按钮的空卡片。触发：打开 `/support/feedback`（契约没有给这个列表的筛选参数，见问题文件第二条）。错误结果：页面顶部多一块空卡片和两个什么都不做的按钮。共用文件，不改；建议：所有列都 `search: false` 时不画搜索区，并在 `PagedListTable.test.tsx` 里加两个用例。
2. `src/components/DangerConfirmButton.tsx`（`Popconfirm` 的标题没有宽度上限）：确认文字很长时气泡很宽、不换行。触发：`/monitor/alerts` 里 LOOK_PACKAGE 行点"关闭"（英文约 120 个字符）。错误结果：气泡约 800 像素宽，右端贴着窗口边缘（1440 宽）；更窄的窗口我没有试。共用文件，不改；建议给标题加最大宽度。
3. `src/pages/config/ConfigRow.tsx`（JSON 项没有值时文本框是空的，解析"空"得到"不是合法 JSON"）：从未设置、也没有默认值的 JSON 项一打开就显示红色的"Not valid JSON"，并且"保存"是灰的。触发：`/memory/models` 的"参数"区（`memory.tei_allowed_hosts`，没有默认值），`/config` 里同一个键也一样。错误结果：技术人员看到一个红色错误但什么也没输入；这个键没配置时不能登记任何模型，页面又没有提示怎么办。共用文件，不改；建议没输入时不当错误显示。
4. `src/pages/monitor/pipeline.tsx`（`known` 状态，来源下拉的选项）：契约没有"列出所有上报来源"的接口，下拉的选项只来自返回的点里出现过的来源。触发：只打开页面并选"最近 1 小时"，而某个来源在这一小时没有上报，它就不在下拉里；换范围看到它之后才会出现。错误结果：看不到一个"最近没有上报"的来源，而这恰恰是监控最想知道的。问题文件里没有单独问这一条，因为它取决于后端要不要提供来源列表；如果要，写进下一份问题文件。

## 需要改共享文件

- `src/components/PagedListTable.tsx`：没有可筛选列时不画搜索区（记录项 1）。
- `src/components/DangerConfirmButton.tsx`（`RowActions` 的菜单版确认是 `modal.confirm`，没有这个问题）：确认文字太长时给气泡加最大宽度（记录项 2）。
- `src/pages/config/ConfigRow.tsx`（或 `src/components/JsonField.tsx`）：空值的 JSON 项不要显示"不是合法 JSON"（记录项 3）。

## 规格需要在 main 上修改的地方

没有必须改的。如果负责人接受下面"变更候选"里的 1，规格 5.14"系统监控"一段要补一句"时间范围默认最近 24 小时，可选 1 小时到 7 天（契约 §14.1 的 `monitor.max_range_days`）"；如果接受 2，"页面上有一个链接跳到成本报表"要改成"有 `COST:VIEW` 时是链接，没有时是纯文字说明"。已知的"规格里仍然留着的冲突"表里第 1 行（记忆服务的接口写 `/memory/*`、页面路由 `/memory/models`，契约的接口是 `/memory/embedding-models`）和第 5 行（客服详情没有路由）这次都按契约和计划做了，不用另写。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-memory-monitor-support.md`，6 条：`GET /alerts` 的响应形状；客服反馈列表的筛选、分页和是否带全文；重试和关闭告警的响应与状态错误；记忆服务三个写接口的响应、409 里 `detail` 的位置、校验错误的 `ref` 和 `reason`；`GET /meta` 加 `monitorMaxRangeDays`；账号模型指派历史的顺序。每一条都有暂定做法，没有阻塞。

## 变更候选（需要负责人确认，不是遗留项）

1. 管线页有"最近 1 小时 / 6 小时 / 24 小时 / 3 天 / 7 天"五个范围按钮和"刷新"按钮。规格 5.14 只写了"按 source 筛选"，没有写时间范围；契约 §14.1 的接口有 `from`、`to`（默认最近 24 小时，上限 7 天），没有范围控件就只能看最近 24 小时。我加了按钮，需要确认保留，以及 7 天这一档（上限是提议值 `monitor.max_range_days`，问题文件第五条）。
2. 成本报表链接只对有 `COST:VIEW` 的管理员显示为链接，其他人看到纯文字说明（点一个只会得到 403 页面的链接没有意义）。规格写的是"页面上有一个链接"。
3. 告警页默认筛选"未处理"（总览的卡片也是未处理的条数）；规格没有写默认筛选。要看全部时在状态筛选里清掉即可。
