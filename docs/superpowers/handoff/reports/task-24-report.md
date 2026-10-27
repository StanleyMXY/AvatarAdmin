立即修未修 0、记录项 3、未运行 0、阻塞 0。

# 任务 24 报告：活动管理（签到、每日任务）

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：`83e826d`（实现）、本报告所在的提交（查看弹窗去掉一处多余的判断、报告）。本模块 239 个测试全部通过（见下面的清单）；`npx biome check` 和 `npx tsc --noEmit` 对本模块路径没有报错。

## 做了什么

六个页面，路由取规格 5.0 活动管理里签到、任务相关的四行（共六条路由；奖励设置在任务 23，不在这里，`config/routes/invite.ts` 里它的路由我没有碰）：

| 路由 | 页面 | 权限 | 内容 |
|---|---|---|---|
| `/act/act-signin-config` | 签到配置 | `CHECKIN:VIEW`，写 `CHECKIN:MANAGE` | 筛选活动名称和状态（草稿、进行中、已结束、停用）；列：名称、状态、时间（开始日、结束日、创建、更新）、操作。操作按存储的状态给：查看和编辑始终有；草稿：发布、删除（行内确认）；进行中：停用（行内确认）；停用：启用。发布和启用先发 `confirm=false`，有重叠时弹确认框列出将被停用的活动名，确认后再发 `confirm=true`，取消不再发；没有重叠直接成功。编辑生效中活动的日期范围也一样先探测。表单（弹窗宽 560）：名称、开始日、结束日（可空，写明"留空表示不限"）、奖励阶梯（至少一行，"第 N 天"按行序号生成，奖励额度必填且是不小于 0 的整数，额外额度不小于 0 默认 0）。页面和表单里都写着"签到按用户的本地日算，阶梯走完后从第 1 天循环" |
| `/act/act-signin-record` | 签到记录 | `CHECKIN:VIEW` | 筛选账号 ID、活动 ID；列：账号 ID（可复制）、签到活动（名称；活动已不存在时显示"—"和 ID）、签到日期、第几天、连续天数、奖励额度（合计，下面一行小字写奖励和额外各多少）、创建时间。只读 |
| `/act/act-signin-stats` | 签到统计 | `STATS:VIEW` | 日期范围（默认 7 天）；页面注明"日期是用户的本地日，不是 UTC 日"；两个页签：每日签到人数（折线图加表）、连续签到分布（柱状图，横轴"N 天"，加表）；落地条 `checkin-daily`；导出跟着页签：`checkin-daily-users`、`checkin-streaks` |
| `/act/act-task-config` | 任务配置 | `TASK:VIEW`，写 `TASK:MANAGE` | 筛选任务名称、类型、状态；十列（名称、类型、目标值、奖励额度、说明、领取倒计时、排序、状态、时间、操作）；编辑、启用或停用（行内确认）、删除（行内确认，有记录时 `TASK_HAS_RECORDS`，提示改用停用）。表单：目标值不小于 1 默认 1，`daily_login` 固定为 1，通话时长旁写"单位：秒"，奖励额度不小于 0 默认 0，说明最多 500 个码点并带计数（按码点数，三个 emoji 是 3），领取倒计时可空且写着"空 = 当天内随时可以领取"，排序 |
| `/act/act-task-record` | 任务记录 | `TASK:VIEW` | 筛选账号 ID、状态；列里显示任务名称，不显示数字编号（任务已不存在时显示"—"和 ID）、统计日期、当前进度（含目标值）、状态、达标时间、领奖时间、发放额度、创建时间。只读 |
| `/act/act-task-stats` | 任务统计 | `STATS:VIEW` | 日期范围；注明本地日，并写明"领奖发生在第二天的也计入任务所属的那天"；趋势图（记录数、完成数、领奖次数，缺失日期补 0）加表（任务名称、记录数、完成数、领奖次数、完成率一位小数、发放额度）；落地条 `task-daily`；导出 `task-summary` |

文件：
- 服务：`src/services/activity/{index,types,activity.test}.ts`。`probeActivityOverlap(action, id, body)` 先以 `confirm=false` 发，没有重叠返回 `null`，有重叠返回将被停用的活动列表；`confirmActivityOverlap` 以 `confirm=true` 再发。两个统计页用任务 9 已有的 `getCheckinDailyUsers`、`getCheckinStreakBuckets`、`getTasksSummary`、`getTasksDaily`、`landStat`、`ExportButton`。
- 页面：`src/pages/activity/` 下 `signinConfig`、`signinRecord`、`signinStats`、`taskConfig`、`taskRecord`、`taskStats`；对话框 `ActivityFormModal`、`ActivityViewModal`、`TaskFormModal`；`useOverlapFlow`（两步探测和确认框）、`LocalDayRange`、`LocalDayLandBar`、`StatsBar`、`CopyableId`、`texts`、`formFailure`；测试和 `testSetup`、`statsTestSetup`。
- 假后端：`mock/activity.mock.ts`、`mock/activity.mock.test.ts`、`mock/_core/activityData.ts`（七种语言的名称、长串无空格、emoji；状态挂在 `globalThis`，`resetActivityStore` 重置）。统计、落地、导出用已有的 `stats.mock.ts`、`export.mock.ts`。
- 路由和文字：`config/routes/activity.ts`、`config/routes/activity.test.ts`、`src/locales/{zh-CN,en-US}/activity.ts`。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-activity.md`。

## 与规格和任务书的出入、我做的取舍

- **两个统计页不用共用的日期范围和落地条。** 共用的 `DateRangeUtc` 的预设写"今天（UTC）""昨天（UTC）"，`LandBar` 的日期写"日期（UTC）"，放在"日期是用户的本地日"的页面上会自相矛盾。我在自己目录里写了 `LocalDayRange`（只有"最近 7 天""最近 30 天"两个预设）和 `LocalDayLandBar`（标签"日期（用户的本地日）"）。共用组件没改（见记录项 1）。
- **导出跟着页签**：规格只写"导出 Excel"，契约有两个名字，所以签到统计在每日签到人数页签导出 `checkin-daily-users`，在连续签到分布页签导出 `checkin-streaks`。
- **什么时候探测**：发布、启用一定探测。编辑只在"存储状态是生效中且开始日或结束日变了"时探测；其余编辑（草稿、停用的、生效中但日期没变）发一次不带 `confirm` 的 `PUT`。契约对"没变日期时发什么"没有写，已写进问题文件。
- **"已有记录的配置，类型和目标值只读"没有数据来源**：契约和后端回复都没有"有没有记录"的字段。做法：表单里始终写着"已有任务记录的任务不能改类型和目标值"；保存时后端回 409 `TASK_HAS_RECORDS`，两个字段还原成原值并变成只读，提示"要换就停用旧任务、新建一个"（编辑时用自己的文字，因为共用的 `error.TASK_HAS_RECORDS` 写的是"不能删除"）。行里如果有 `hasRecords: true`，一打开就只读（字段是我向后端提的，当前不存在，假后端也没有，已测）。
- 空的开始日、结束日显示"不限"（契约：空表示不限）；数量为空或不是数字显示"—"，0 显示 0。
- 所有后端来的文字（名称、说明、账号 ID、活动名、确认框里的名称）都经 `plainText`，数字、对象、`null` 不会作为 React 子元素；已知错误码只显示译文，不显示后端的 `message`（每页一个测试，用 `SECRET BACKEND MESSAGE` 做哨兵）。
- 带数字的输入框是 antd 的 `InputNumber`，设了 `min`：输入 0 或负数会被收回到下限，所以"负数奖励"在页面上打不出来，校验只管"空"和"不是整数"；假后端对负数仍然返回 400（已测）。

## 红到绿

命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task24/` 的 `red-*.txt`、`green-*.txt`、`final.json`。

| 文件 | 红 | 绿 |
|---|---|---|
| `src/services/activity/activity.test.ts` | `Failed to resolve import "./index"` | 15 个通过 |
| `mock/activity.mock.test.ts` | `Failed to resolve import "./activity.mock"` | 60 个通过 |
| `config/routes/activity.test.ts` | 路由数组为空，8 个以上断言失败（"are one group of the activity menu"、六条路由各一条等） | 17 个通过 |
| `src/pages/activity/signinConfig.test.tsx` | `Failed to resolve import "./signinConfig"` | 47 个通过（先写了 45 个，浏览器检查后补 2 个） |
| `signinRecord`、`taskConfig`、`taskRecord`、`signinStats`、`taskStats` 的测试和 `useOverlapFlow.test.tsx` | 见下面的说明 | 11、38、9、19、13、3 个通过 |

说明：前五个先写了测试再写实现，红是"功能不存在"。后面这几个页面的测试和页面是在同一步里写出来的，没有留下"页面不存在"的红输出；我事后在一份拷贝里把页面文件挪走重跑，每个测试文件都因 `Failed to resolve import` 失败（`red-pages.txt`），再加上下面的变异检查，说明测试确实依赖实现。这是和"先写测试"的出入，如实写在这里。

最终一次：`npx vitest run src/pages/activity src/services/activity mock/activity.mock.test.ts config/routes/activity.test.ts src/locales tests/noHardcodedText.test.ts`：653 个通过，0 个失败（其中本模块 239 个：假后端 60、路由 17、服务 15、`signinConfig` 47、`signinRecord` 11、`signinStats` 19、`taskConfig` 38、`taskRecord` 9、`taskStats` 13、文字 7、`useOverlapFlow` 3；其余是语言文件检查和"禁止写死文字"扫描）。`tests/noHardcodedText.*` 里本模块没有放行条目。

## 真实浏览器检查

Playwright（Chromium）对着 `PORT=8324` 的 `npm run dev:mock`，在 `scratchpad/task24/app` 的一份拷贝里跑（拷贝里的 `config/config.ts` 关了 MFSU、换了缓存目录，因为共用的缓存在文件变动后报 `Module … does not exist in container`；只在拷贝里改）。脚本 `t24-browser.cjs`、截图 `t24-*.png`、日志 `t24-dev.log`。服务按监听进程的 PID 停掉（`t24-restart.sh` 里用 `lsof -t -i :8324 -sTCP:LISTEN`，并检查进程的工作目录是我的拷贝）；最后那一次启动的服务也已按 PID 停止（见本报告末尾）。

看到并确认的：
- 菜单"活动管理"下六个页面加奖励设置；登录 `root` 后六个页面都能打开；控制台只有登录前的 401 和我故意做的两次 409。
- 签到配置：七种语言的名称正常，300 个 A 的名称在表格里两行截断，不撑开表；发布一个和进行中的活动重叠的草稿：请求 `confirm:false`，确认框里列出"Autumn check-in 🍂"，点取消后没有第二个请求，再发布再确认后请求 `confirm:false`、`confirm:true`，列表里"Autumn"变成"停用"；发布一个不重叠的草稿只发一个请求；编辑进行中活动的结束日到 2030 年：探测、确认框列出被覆盖的泰语活动名、取消只留一个请求、确认后再发；新建活动请求体 `{"name":"Songkran 🎉 سونغكران","startDate":null,"endDate":null,"rewards":[{"dayNum":1,…},{"dayNum":2,…}]}`；删除草稿；390 宽没有页面级横向滚动。
- 签到记录：账号 ID 旁有复制图标；活动已不存在的行显示"—"和"ID 99"。
- 签到统计：折线图和表；两个页签；导出文件名分别是 `checkin-daily-users-2026-10-20-2026-10-26.xlsx`、`checkin-streaks-2026-10-20-2026-10-26.xlsx`；"重新落地该日"发 `POST /stats/land/checkin-daily?date=2026-10-25`；页面上只有那句"不是 UTC 日"里出现 UTC 这个词。
- 任务配置：删除有记录的任务显示"This task already has records. Disable it instead of deleting it."，行还在；编辑有记录的任务把目标改成 900：后端 409，目标值回到 600 并变成只读，类型也只读，提示出现；新建通话时长任务时出现"Unit: seconds"，说明计数 `7 / 500`（七个 emoji）。
- 任务记录、任务统计：趋势图三条线、汇总表、导出 `task-summary-….xlsx`；中文界面下两个页面和提示文字正常。

浏览器检查发现并已修的两个真缺陷（单元测试没有看到）：
1. **重叠确认框一打开就让整个页面报错**（`[React Intl] Could not find required intl object`）：`modal.confirm` 的内容画在页面的语言上下文之外，我在里面用了 `useIntl`。单元测试里 App 的弹窗挂在页面树里，所以看不到。改成内容组件 `OverlapNames` 只收文字属性、不调用任何钩子，并加了一个"不包任何 provider 也能渲染"的测试（`useOverlapFlow.test.tsx`）。
2. **新建表单带着上一次编辑的值**（日期、六行阶梯）：同一个 `Form` 实例在关闭后保留了数据。现在每次打开表单都换一个新的组件实例（页面里的 `formSession` 做 `key`），并加了测试（"a new form after an edit starts empty…"、任务表单的同类测试、"有记录被锁定的类型和目标值在下一个表单里是开的"）。同时关闭动画期间的内容不再变成转圈或换标题（对话框的 `open` 和对象分开保存）。

## 变异检查

在一份拷贝里每次改一处判断，只跑应该发现它的测试，确认变红，再还原。脚本 `t24-mutate.py`、定义 `t24-mutations.json`、输出 `t24-mutate-batch1.log`、`t24-mutate-m12.log`。35 个全部变红：

| 编号 | 变异 | 结果 |
|---|---|---|
| m01 | 重叠确认框点取消仍发第二个请求 | 变红 |
| m02 | 探测的答案被忽略（永远不问） | 变红 |
| m03 | 非草稿也显示删除 | 变红 |
| m04 | 没有 `CHECKIN:MANAGE` 也显示编辑、发布等 | 变红 |
| m05 | 编辑进行中活动的日期不探测 | 变红 |
| m06 | 日期没变也探测 | 变红 |
| m07 | 阶梯的 `dayNum` 从 0 起 | 变红 |
| m08 | 缺少奖励额度的一行也接受 | 变红 |
| m09 | 最后一行阶梯也能删 | 变红 |
| m10 | 新阶梯行的额外额度默认不是 0 | 变红 |
| m11 | 活动表单不是每次打开都换新的（值带到下一次） | 变红 |
| m12 | 详情弹窗打开另一个活动时不回到"加载中"（会显示上一个活动的内容） | 变红（第一版写成"去掉 `forId` 判断"时存活，因为它和 `setState(loading)` 重复；我把重复的判断删掉，换成去掉 `setState(loading)`，变红） |
| m13 | 活动表单连点提交发两次 | 变红 |
| m14 | 确认框内容里调用钩子 | 变红 |
| m15 | 没有 `TASK:MANAGE` 也显示任务的按钮 | 变红 |
| m16 | 409 `TASK_HAS_RECORDS` 之后类型和目标值仍可改 | 变红 |
| m17 | 登录类型的目标值不固定为 1 | 变红 |
| m18 | 说明按 UTF-16 长度而不是码点计数 | 变红 |
| m19 | 任务表单连点提交发两次 | 变红 |
| m20 | 任务表单不是每次打开都换新的 | 变红 |
| m21 | 任务记录显示任务编号而不是名称 | 变红 |
| m22 | 签到记录的奖励额度不含额外额度 | 变红 |
| m23 | 签到统计的导出不跟着页签 | 变红 |
| m24 | 签到统计落地错了汇总 | 变红 |
| m25 | 导出用正在编辑的范围而不是上次查询的范围 | 变红 |
| m26 | 两个统计页写成"统计日是 UTC 日" | 变红 |
| m27 | 完成率不固定一位小数 | 变红 |
| m28 | 任务统计趋势图少一条线 | 变红 |
| m29 | 没有 `STATS:LAND` 也显示落地条 | 变红 |
| m30 | 落地条连点发两次 | 变红 |
| m31 | 假后端允许删除非草稿 | 变红 |
| m32 | 假后端允许有记录的任务改目标值 | 变红 |
| m33 | 假后端改日期范围不探测 | 变红 |
| m34 | 签到配置路由的权限码错 | 变红 |
| m35 | 服务的第一次请求就带 `confirm=true` | 变红 |

注意：第一次跑变异时拷贝里缺 `src/.umi/tsconfig.json`，所有测试文件都因加载失败而"变红"，那一批结果作废；补上后重跑，上表是重跑的结果（脚本现在区分"测试失败"和"测试文件没跑起来"）。

## 覆盖的语言

假数据含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，以及 300 个 A 的无空格长串、emoji（`mock/_core/activityData.ts`）。页面测试直接断言泰语、阿拉伯语、印尼语、越南语、西班牙语、英语名称出现在列表里，并对长串、泰语和阿拉伯语的名称断言截断属性（`data-lines`、`overflow-wrap`）；说明字段用五百个 emoji 测码点计数。中文只出现在假数据（任务六的名称、统计汇总的样例）里，页面测试没有对中文字符串做断言；中文界面只在浏览器检查里看过（`t24-signin-config-zh.png`、`t24-task-stats-zh.png`），键的一致由 `texts.test.ts` 和共用的 `parity` 测试保证（两边键相同、占位符相同、英文里没有中日韩字符、每个键都被页面用到）。没有"只覆盖中文"的检查。

## 问题文件清单

- `docs/contract-requests/2026-10-26-admin-frontend-activity.md`：① `GET /tasks/configs` 需要 `hasRecords`；② 有记录的配置改名时带原值的 `taskType`、`targetValue` 是否成功；③ 四个列表是否分页和筛选写法；④ 签到活动写接口的请求体、`confirm` 的处理和成功响应、状态接口的错误、删除的错误；⑤ 任务写接口的请求体、`description` 为空发什么、任务类型的选项来源；⑥ 两个统计页的日期（落地的 `date`、报表的 `to` 最晚到哪天）；⑦ 规格需要补的两处。

## 需要改共享文件的清单

1. `src/components/stat/DateRangeUtc.tsx`、`src/components/stat/LandBar.tsx`：加一个可选属性，让页面说明这些日子是本地日（预设不写 UTC、落地条的日期标签可换），这样 `LocalDayRange.tsx`、`LocalDayLandBar.tsx` 可以删掉（记录项 1）。
2. `src/pages/stat/guest/useReport.ts`、`ReportState.tsx`：被本模块和别的模块用，应该移到 `src/hooks` 或 `src/components/stat`（记录项 2）。
3. `src/locales/{zh-CN,en-US}/error.ts` 的 `error.TASK_HAS_RECORDS`：契约的错误表写的是"不能删除，也不能改 `taskType`、`targetValue`，只能停用"，现在的文字只说了删除（记录项 3）。本模块编辑时用自己的文字，不依赖这条修改。

## 规格需要在 main 上修改的地方

- 规格 5.22"任务配置"写"已有任务记录的配置，类型和目标值只读"，应补一句数据从哪里来：`GET /tasks/configs` 要有 `hasRecords`（见问题文件第一节）。
- 规格 5.22"任务配置"写"选项取自后端声明的类型"，应写明声明在哪里（目前没有接口，也不在 `GET /meta` 里，页面写死三个）。
- 规格 5.22"签到统计"写"导出 Excel"，契约有两个导出名，应写明每个页签导哪一个。

## 记录项清单

1. `src/pages/activity/LocalDayRange.tsx`（全文）、`src/pages/activity/LocalDayLandBar.tsx`（全文）复制了共用的 `DateRangeUtc`、`LandBar` 的做法。触发：以后共用组件改了（比如超长范围的提示、落地失败的处理），两个本地副本不会跟着变，两个统计页的行为会和别的统计页不一致。后果：不是现在的错误结果。建议：做上面"需要改共享文件"第 1 条后删除副本。
2. `src/pages/activity/signinStats.tsx:13-14`、`src/pages/activity/taskStats.tsx:12-13` 从 `../stat/guest/` 导入 `useReport`、`ReportState`（任务 18 的目录）。触发：那个目录里的文件改名或移动，本模块编译失败。建议：移到共用目录。
3. `src/locales/zh-CN/error.ts:46`、`src/locales/en-US/error.ts:47` 的 `TASK_HAS_RECORDS` 只说"不能删除，只能停用"，而后端对"改有记录的任务的类型或目标值"也返回这个码（契约错误表）。触发：别的页面如果也让人改任务配置，会显示一条只提删除的话。本模块已在编辑表单里用自己的文字，不受影响。

不是缺陷：
- 配置表格有十列（规格列出的全部），1440 宽时"领取倒计时、排序、状态、时间"要在表格里横向滚动才看到（表格自己滚动，页面没有横向滚动，`taskConfig.tsx` 的 `columns`）；规格要求这些列，已把名称和说明列收窄。
- `InputNumber` 把输入的 0 或负数收回下限（`TaskFormModal.tsx:209`、`:263`、`ActivityFormModal.tsx` 的两个数量框）：这是 antd 的标准行为，提交值总是合法的；空值由校验拦住。
- 假后端和测试里 happy-dom 不结束动画，忙过的按钮里的加载图标一直留着，按钮的名字变成"loading Submit"：测试里用正则取名（`signinConfig.test.tsx` 的取消用例），页面没有问题。
- 提交 `be645eb`（别的任务的提交）里带进了我当时还没提交的 `src/locales/zh-CN/activity.ts`；只影响提交历史的归属，内容和最终文件一致。

## 变更候选（需要负责人确认的设计点）

- 若后端同意加 `hasRecords`：页面已经预留，打开表单就只读；只需要假后端也返回它。
- 若后端在 `GET /meta` 里加 `taskTypes`：任务类型的选项改读它，页面不再写死。
- 两个统计页的导出跟页签（见上面"与规格的出入"）：如果负责人希望两个页签各有一个导出按钮，或者一个按钮导出两张表，需要改。
