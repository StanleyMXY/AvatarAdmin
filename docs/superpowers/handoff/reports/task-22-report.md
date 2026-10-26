立即修未修 0、记录项 9、未运行 3、阻塞 0。

# 任务 22 报告：推送

环境：Node 24.22.1。分支 `claude/jolly-dirac-4pq9g6`。提交：`2652b7a`（实现）、`7f6d465`（浏览器检查后的修正和问题文件）、本报告所在的提交（测试补强、报告）。

## 做了什么

六个页面，路由取规格 5.0"推送"六行，页面权限码按规格：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/push/templates` | `PUSH:TEMPLATE` | 顶部"触发原因 × 支持语言"完整性矩阵，缺的格子红色；模板列表（标题、正文、链接、图片、启用开关）；新建、修改、删除；图片用 `UploadField kind="pushImage"`，只提交 `uploadId` |
| `/push/tasks` | `PUSH:SEND` | 手动任务列表（状态、已发数、失败数、创建人、计划时间）；`PENDING` 行才有"取消任务"（行内确认）；新建表单（受众四种、平台和语言筛选、标题、正文、链接、图片、立即或定时） |
| `/push/schedules` | `PUSH:SEND` | 周期推送列表（重复方式、时刻与时区、起止日期、启用开关、受众、下次生成时间）；新建和修改表单；"停用，已生成的任务保留" |
| `/push/records` | `PUSH:VIEW` | 发送记录列表；展开行读 `GET /push/records/{id}`，显示对每个 token 的发送结果 |
| `/push/stats` | `STATS:VIEW` | 日期范围、触发原因筛选；一张折线图（发送数、送达成功数、送达失败数、点开数四条线，各触发原因按日相加）加明细表（每天每个触发原因一行，含点开率）；落地条 `push`；导出 `push` |
| `/push/recall` | `PUSH:CONFIG` | `<ConfigForm editPermission="PUSH:CONFIG" />`，浏览器里看到 12 个键 |

文件：
- 服务：`src/services/push/{index,types,push.test}.ts`
- 页面：`src/pages/push/` 下 `templates`、`tasks`、`schedules`、`records`、`stats`、`recall`，对话框 `TemplateModal`、`TaskModal`、`ScheduleModal`，共用的 `ContentFields`、`AudienceFields`、`TemplateMatrix`、`LinkField`、`EnabledSwitch`、`PushImage`、`UploadBox`，纯函数 `coverage`、`bodies`、`pushStats`、`texts`、`formFailure`、`uploadSlot`，以及各自的测试和 `testSetup.ts`
- 假后端：`mock/push.mock.ts`、`mock/push.mock.test.ts`、`mock/_core/pushData.ts`
- 路由和文字：`config/routes/push.ts`、`config/routes/push.test.ts`、`src/locales/{zh-CN,en-US}/push.ts`
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-push.md`
- 推送效果页的接口函数、落地和导出用任务 9 已有的 `getPushStats`、`landStat`、`ExportButton`，假后端也用已有的 `GET /stats/push`、`POST /stats/land/push`、`GET /stats/export/push`。

按任务书逐条对应：
- 矩阵：行是两个召回触发原因（`admin`、`system_event` 没有模板，不画），列是 `meta.supportedLocales`，缺的格子是红色"缺失"标签；`supportedLocales` 缺失、`null`、空数组或不是数组时不画矩阵，只显示模板列表和一句说明。启用时缺语言：对话框里的警告和列表开关点击前的顶部提示都写出缺哪几种语言，请求照发，以后端为准。
- 图片：只接受 JPEG/PNG；上传前按 `pushImageMaxBytes` 检查，取不到时不检查；上传中提交按钮禁用；请求体只有 `imageUploadId`，没有 `imageUrl`；后端拒绝上传编号（404、409、400）时提示重新上传、清掉编号、换 `key` 让上传控件复位，重新上传之前不再发请求。
- 链接：三处都用同一个 `LinkTargetField` 加 `linkTargetRule`（无链接、9 个页面标识的下拉、网址总长不超过 2048）。
- 手动任务：受众选"账号 ID 列表"时平台和语言筛选禁用并清空，请求体不带这两项（后端会 400）；换回别的受众又可用。周期推送：每月时显示"当月没有这一天时取当月最后一天，31 日在 4 月发在 30 日"；时区下拉默认 UTC，旁边写"固定时区，不是每个用户的当地时间"（始终显示）。
- 推送效果：点开率是 `pushesOpened / pushesSent`，分母 0、缺失、不是数字都显示"—"，大于 100% 照实显示；"点开数"和"点开率"的列提示写明"点开数记在点开当天，与发送日不一定是同一天"。
- 提交一律防重复：新建和修改对话框、列表里的开关、取消、停用、删除。已知错误码只显示译文，不显示后端的 `message`（已测）。
- 来自后端的文字字段一律经 `plainText` 或 `codeText` 显示，数字、对象、`null` 不会作为 React 子元素直接渲染（每页一个测试）。
- 模板的 `(触发原因, 语言)` 是键：新建时页面已读到该组合就不发请求，提示改那一条（对应"复用键会覆盖要先问"的教训）。
- 不显示任何凭据类字段；本模块没有这类字段。

## 与任务书和规格的出入

- 任务书写"记录详情用抽屉"，规格 5.11 写"展开行显示对每个 token 的发送结果"。按规格做了展开行（任务书那句话的意思是详情没有自己的路由，路由表一致）。共用的 `PagedListTable` 没有 `expandable` 参数，所以发送记录页用 antd `Table` 加自己的分页，和 `analytics/detail.tsx` 同一做法。
- 规格 5.11 对召回参数只点名 `recall.*` 和 `push.default_locale`，页面按任务书显示该码的全部 12 个键。
- 推送效果的趋势图规格没写画哪些指标：画了四个计数。点开率量级不同，只在表里。

## 红到绿

先写测试，确认因"功能不存在"而红（`Failed to resolve import …` 或路由数组为空），再实现，再绿。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task22/` 的 `red-*.txt`、`green-*.txt`。

| 文件 | 红 | 绿 |
|---|---|---|
| `src/services/push/push.test.ts` | `Failed to resolve import "./index"` | 7 个通过 |
| `mock/push.mock.test.ts` | 找不到 `./_core/pushData` | 36 个通过 |
| `coverage`、`bodies`、`pushStats` 的测试 | 三个文件都 `Failed to resolve import` | 34 个通过（现为 34） |
| `templates.test.tsx` | `Failed to resolve import "./templates"` | 37 个，之后补到 39 |
| `tasks.test.tsx` | `Failed to resolve import "./tasks"` | 23 个，之后补到 24 |
| `schedules.test.tsx` | `Failed to resolve import "./schedules"` | 21 个，之后补到 22 |
| `records.test.tsx` | `Failed to resolve import "./records"` | 11 个 |
| `stats.test.tsx` | `Failed to resolve import "./stats"` | 19 个 |
| `recall.test.tsx`、`config/routes/push.test.ts` | 移走实现后：`recall` 找不到，路由 15 个断言失败（路由数组为空） | 21 个（recall 4、路由 17） |

最终一次：`npx vitest run src/pages/push src/services/push mock/push.mock.test.ts config/routes/push.test.ts src/locales/parity.test.ts`：13 个文件、232 个测试全部通过。本模块的 213 个：假后端 36、路由 17、`bodies` 14、`coverage` 14、`pushStats` 6、`recall` 4、`records` 11、`schedules` 22、`stats` 19、`tasks` 24、`templates` 39、服务 7。`npx biome check` 本模块路径无问题；`npx tsc --noEmit` 本模块路径无报错。`tests/noHardcodedText.test.ts` 里本模块没有条目（不需要放行清单）；该测试当时因别的模块的 `mock/invite.mock.test.ts` 里有隐藏字符而失败，不是本模块的。

## 真实浏览器检查

用 Playwright（Chromium）对着 `PORT=8322` 的 `npm run dev:mock` 跑完整流程，脚本和截图在 `scratchpad/task22/`（`browser-check.cjs`、`browser-check.log`、`shot-*.png`）。因为共享检出里有别的任务的路由指向还不存在的页面，在 `scratchpad/task22/app` 的一份拷贝里跑，拷贝里做了三处只在拷贝里的改动：清空 `config/routes/invite.ts`、把 `mock/_core/statRange.ts` 的 `TRIGGERS` 改成契约的四个值、把 `mock/_core/meta.ts` 的 `supportedLocales` 改成 `en、zh-Hans、th、ar`（否则矩阵只有一列）。服务按监听进程的 PID 停掉，已停。

看到并确认的：
- 登录后六个页面都能打开；矩阵显示 `daily_recall` 四种语言都是"已启用"、`streak_at_risk` 的 `en` 和 `ar` 红色"缺失"。
- 新建模板：GIF 在上传前被拒（"Wrong file type. Accepted: JPEG / PNG"）；PNG 上传后请求体是 `{"title":…,"imageUploadId":"up-img-0001","enabled":false,"triggerReason":"streak_at_risk","locale":"en"}`，没有 `imageUrl`；打开启用开关时出现"缺 ar"的警告；创建后矩阵格子变成"未启用"；在列表里启用时先出提示，后端拒绝（400），开关回到关。
- 手动任务：选账号 ID 列表时平台禁用；请求体 `{"audience":"ACCOUNT_IDS","accountIds":["acc-1","acc-2"],…}` 没有平台和语言；泰语、阿拉伯语、西班牙语、emoji 混合标题正常；新建后取消，状态变"已取消"。
- 周期推送：每月 31 日、08:30、UTC 创建，下次生成时间 11/30/2026 08:30；停用的问句是"Deactivate; the tasks already made are kept."，停用后行还在、开关关。
- 发送记录：展开一行看到三个 token 的三种结果。
- 推送效果：折线图四条线和明细表同屏；选"每日召回"后查询 7 行；导出下载了 `push-2026-10-20-2026-10-26.xlsx`；重新落地提示"Re-landed 2026-10-25"。
- 召回参数：12 个键。
- 中文和手机宽度（390）打开矩阵页：矩阵和表格能横向滚动，没有页面级横向滚动。

浏览器检查发现并已修的：
1. 表单里的 `UploadField` 旁边多出一个原生的"选择文件"框（antd 表单的样式盖过了 `hidden`）。形象模块在自己目录里加了 `UploadBox` 的做法，这里同样做了一份 `src/pages/push/UploadBox.tsx`，加了测试。共用组件的根因见下面记录项。
2. 控制台警告 antd 表格 `rowKey` 的 `index` 参数已弃用（发送记录、推送效果两处）。改成给每行加一个键，已无警告。
3. 任务页"计划时间"被固定的"操作"列盖住一部分：把标题和受众列收窄；模板页把启用开关挪到语言旁边，不用横向滚动才看得到。

控制台还有两条 umi 构建的 `async/await` 目标环境警告，是脚手架自己的，与本模块无关；两条 4xx 响应是登录前的 401 和上面写的后端拒绝启用的 400。

## 变异检查

每个变异改一处判断，跑相关测试，确认变红，再还原。脚本 `scratchpad/task22/mutate22.py` 和 `mutate22b.py`，结果 `mutate.out`。

| 变异 | 结果 |
|---|---|
| 去掉"该组合已有模板"的拦截 | 变红 |
| 去掉对话框里缺语言的警告 | 变红 |
| `missingFor` 不算正在新建的那种语言 | 变红 |
| 矩阵里缺失的格子显示成"已启用" | 变红 |
| 空的支持语言列表也画矩阵 | 变红 |
| 账号 ID 列表时也发 `platforms` | 变红 |
| 请求体带 `imageUrl` | 变红 |
| 上传中提交按钮不禁用 | 变红 |
| 取消按钮对所有状态显示 | 变红 |
| 取消按钮不看 `PUSH:SEND` | 变红 |
| 已停用的周期推送也显示"停用" | 变红 |
| 去掉每月月末的提示 | 变红 |
| 每周推送也发 `dayOfMonth` | 变红 |
| 点开率不处理分母 0 | 变红 |
| 落地条落错汇总（`daily-event`） | 变红 |
| 导出错报表（`daily`） | 变红 |
| 趋势图各触发原因不相加（覆盖） | 变红 |
| 召回参数路由权限改成 `PUSH:SEND` | 变红 |
| 召回参数页换成别的权限码 | 变红 |
| 后端拒绝上传编号时不处理 | 变红 |
| 定时时间按本地时区读 | 变红 |
| 列表开关启用前不提示缺语言 | 变红 |
| 发送结果代码显示原文 | 变红 |
| 发送记录展开后不显示 token 编号 | 变红 |
| 模板写按钮不看权限 | 变红 |
| 假后端：取消任何状态都允许 | 变红 |
| 假后端：账号 ID 列表时允许平台和语言 | 变红 |
| 新建任务、新建模板、新建周期推送的提交不防重复（三个变异） | 第一轮 **存活**，见下 |

存活的一个：原来"连点两次提交只发一次"的测试在没有 `useSingleFlight` 时也通过（antd 表单在校验未完成时重复提交会合并，所以同一个事件循环里的两次点击不能证明守卫在起作用）。补了三个新测试：用 `holdWrites()`（`testSetup.ts`）让第一次请求在途，再提交两次，要求只有一次写请求发出。补强后三个变异都变红，这是本任务里唯一一次变异检查改了测试。

## 覆盖的语言

假数据和测试含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：模板（七种语言，另有 300 个字母无空格的标题）、任务标题（七种循环，加 emoji）、周期推送标题；页面测试里还有 200 个泰文字符、300 个阿拉伯字母、100 个 emoji 的标题，账号 ID 300 个阿拉伯字母。界面文字只有 zh-CN 和 en-US，每个页面各有一个中文渲染测试；其余界面文字的断言以 en-US 为主（只覆盖英文的部分：对话框里各字段的校验文字）。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-push.md`：模板路径用 `id` 还是 `(triggerReason, locale)`、列表分页和筛选、请求体字段和图片字段名、怎样去掉图片、标题正文长度上限、启用缺语言的错误、删除已启用模板的结果、重复创建的错误、任务列表和立即发送、取消的错误、周期推送停用后行是否保留和 `PUT` 是否整条替换、发送记录的筛选和详情里数组的名字、上传返回的地址字段、推送效果触发原因的值。

## 需要改共享文件的清单

1. `mock/_core/statRange.ts:70`：`TRIGGERS` 是 `recall、announcement、notification、activity、admin`（推送的 `data.type`），契约的 `triggerReason` 是 `daily_recall、streak_at_risk、admin、system_event`。后果：推送效果页用契约的值筛选，开发用假后端返回 400；假后端返回的行里触发原因显示成原文。这是假后端的错，建议改成契约的值，并更新 `mock/stats.mock.test.ts` 里依赖它的断言。
2. `src/components/UploadField.tsx`：放在 antd 表单里时，表单样式（`.ant-form input[type="file"]{display:block}`）盖过 `hidden`，多出原生"选择文件"框（Chromium 实测）。形象模块和本模块各自在自己目录里加了一份 `UploadBox` 绕开；建议在共用组件里一次修掉（输入框改用 `style={{display:'none'}}` 加 `!important`，或自带样式）。
3. `src/components/PagedListTable.tsx`：没有任何列可搜索时仍显示一个空的搜索框（只有"重置"和"查询"，点了没有用）；没有 `expandable` 参数。本模块三个页面（模板、任务、周期推送）受第一点影响，发送记录页因第二点没法用它。
4. `src/components/LinkTargetField.tsx` 加 `linkTargetRule`：网址不合法时，输入框自己显示原因，表单项的规则又显示一遍同样的话。本模块在 `ContentFields.tsx` 里包了一层，网址类的错误让规则抛空消息（仍然拦住提交）。建议共用组件加 `showError` 之类的开关。
5. `mock/_core/meta.ts`：`supportedLocales` 固定是 `['en']`，开发用假后端里完整性矩阵只有一列；也不随 `PUT /config/app.supported_locales` 变化。建议 `GET /meta` 读配置存储里的值。

## 规格需要在 main 上修改的地方

- 规格 5.11 的"发送记录：展开行显示对每个 token 的发送结果"和计划里的"记录详情用抽屉"不一致，建议计划那句改成"没有自己的路由"。
- 规格 5.11"召回参数：`recall.*`、`push.default_locale`"：该权限码实际有 12 个键（另有 `push.schedule_scan_seconds`、`push.guest_token_retention_days`、`push.schedule_catchup_minutes`、`push.task_lease_minutes`、`push.task_image_retention_days`），建议写成"`PUSH:CONFIG` 的全部键"。
- 契约 §17.4 推送管理行没有写列表的参数和响应字段表，建议在"响应字段表"里补推送的几行（见问题文件）。

## 记录项（9）

1. `src/components/PagedListTable.tsx`（外部，任务 8）：模板、任务、周期推送页没有可搜索的列，页面上仍有空的搜索框；触发：打开 `/push/templates`。结果：一个点了没有用的"重置/查询"。
2. `src/components/UploadField.tsx`（外部，任务 8）：在 antd 表单里原生文件框显示出来；触发：打开推送模板的新建对话框。结果：按钮旁边多一个"选择文件"框。本模块已用 `src/pages/push/UploadBox.tsx` 绕开。
3. `src/components/LinkTargetField.tsx`（外部）：和 `linkTargetRule` 一起用时网址错误显示两遍；触发：链接类型选"网址"输入 `http://x`。本模块在 `src/pages/push/ContentFields.tsx` 里绕开。
4. `mock/_core/statRange.ts:70`（外部）：假后端的触发原因值不是契约的值；触发：推送效果页选"每日召回"点查询，开发用假后端返回 400。
5. 本模块和形象模块各有一份相同的小件：`EnabledSwitch`、`useUploadSlot`、`failureToForm`、`codeText`、`UploadBox`（`src/pages/push/` 和 `src/pages/avatar/`）。建议挪到共用目录各留一份；不是错误，是重复。
6. `mock/_core/meta.ts:4`（外部）：`supportedLocales` 固定 `['en']`；触发：开发用假后端打开模板页，矩阵一列。
7. `src/pages/push/tasks.tsx`（计划时间列）和 `schedules.tsx`（下次生成时间列）：列表里的时刻按浏览器时区显示（和其他页面一致），而新建任务的定时时间是按 UTC 输入的；触发：浏览器在 UTC+8，选定时 10:00（UTC），列表显示 18:00。表单旁和提示已写明是 UTC，但列表没写时区。
8. `src/pages/push/templates.tsx` 的列表开关：后端以 400 拒绝启用时，只在顶部提示通用的"输入不合法"，看不到是哪一项（详情的原因文字没有显示）；触发：缺语言时在列表里打开开关。顶部的缺语言提示（先于请求）补了一部分；对话框里的启用则会把原因放在开关下面。
9. `src/pages/push/records.tsx`：没有筛选（账号、触发原因、日期），只能翻页；原因是契约没有写参数（见问题文件第四节第 1 条）。

## 未运行（3）

- 非 Chromium 浏览器（Firefox、Safari）：时间选择器、时区下拉（`Intl.supportedValuesOf` 在旧浏览器里没有，页面用一份很短的备用列表，没有在这样的浏览器里看过）。
- 真后端：上传（`POST /uploads/image` 的返回、`imageUrl` 的形状）、模板启用被拒的错误形状、`GET /push/records/{id}` 里数组的名字、周期推送 `DELETE` 之后列表里是否还有这一行，都是按问题文件里的暂定做法对着假后端做的。
- 夏令时和跨月边界下周期推送的"下次生成时间"由后端算，前端只显示；假后端的 `nextRunAt` 是自己写的近似实现，不能代表后端。

## 变更候选

没有。
