立即修未修 0、记录项 1、未运行 2、阻塞 0

# 组 g5 记录项修复报告：任务 19 到 22（通话、埋点管理、总览、推送），加推送模板区域和当天临时值区域

范围：`task-19/20/21/22-report.md` 和 `-review.md`，`backend-d1-msg-report.md`、`backend-d1-msg-review.md` 里属于推送的仍开着的记录项，`decided-provisional-report.md`、`decided-provisional-review.md`。清单是把每份文件里分类为"记录"的发现逐条列出，再对着当前代码核对（读代码，没有照报告）。"不是缺陷""变更""未运行"没有列入；实现者标成记录、评审改判为变更的（通话质量页的当天临时值标记、通话分析页和其他图的空心点）也没有列入。

计数说明：**记录项 1** = 核对后仍未修的数量：推送与形象等模块里各有一份相同的小件（`EnabledSwitch`、`useUploadSlot`、`codeText`、`failureToForm`），要合并就得同时改形象、活动、短信、应用版本、广告等别的组正在改的页面目录，见下表最后一行。另有一条（推送图片字段名 `imageUploadId` 还是 `uploadId`）等后端答复，已有问题文件，状态"写成问题文件"，不算在 1 里。**未运行 2**：全量测试和构建（按规则最后一起跑）；漏斗图在所有步骤人数都是 0 时画成什么样（任务 20 评审"没有核实的"，不是记录项，仍没有在真实浏览器里看）。

环境：Node 24，`npx vitest run` 只跑相关文件；这台机器同时有很多会话在跑测试（负载 20 到 40），异步等待的默认 1 秒经常不够，所以用 `--no-file-parallelism --testTimeout=60000`，个别测试失败后单独重跑。提交：`bb736bc`（通话页面、当天临时值的日报和通话质量、假后端）、`681c778`（埋点管理）、`159e29b`（总览和等待时长）、`1693db6`（推送）、再加这份报告所在的提交。

## 逐条

| # | 记录项（一两句话） | 状态 | 提交或证据 |
|---|---|---|---|
| 19-1 | 开发用假后端的通话质量样例里成功率和慢接通占比总在阈值以内，看不到红框（`mock/stats.mock.ts`） | 已修 | 假数据里每第四个日历日是坏日（成功率 67%、慢接通 20%），任意连续 7 天合计都越过两条阈值；测试 `mock/stats.mock.test.ts`"session quality has a clearly bad day in any seven days"，先红后绿（还原假后端后 3 条红）。哈希 `bb736bc` |
| 19-2 | 列表页"旧答案不覆盖新答案"的用例去掉钩子里的计数比较后仍通过，没有证明力 | 已修 | 新增 `src/pages/sessions/useStatRead.test.tsx`（5 条：晚到的答案、晚到的失败、离开页面、失败文字）；去掉 `useStatRead.ts` 里两处计数比较后 2 条变红；列表页那条用例改名成它真正测的（关闭抽屉后再开另一个）。`bb736bc` |
| 19-3 | 通话质量页的合计含今天（临时值），页面没有标识 | 已不存在 | 提交 `9c3f678`（当天临时值）之后六张卡片各带"临时值"：`src/pages/sessions/quality.tsx` 里 `QualityCard` 的 `provisional`。评审把它改判为变更，已被该决定做掉 |
| 19-r1 | 成功率 94.96% 的卡片写"95%"并画红框，旁边写"低于 95% 时红框"，读起来矛盾 | 已修 | 新函数 `percentAgainst`（`qualityMetrics.ts`）：先一位小数，和阈值写出来一样时加位数，最多六位；阈值本身最多写四位小数；折线图提示框用两位小数。测试 `qualityMetrics.test.ts`（4 条）、`quality.test.tsx`"a figure next to its limit"（4 条），回退源码后全部红。`bb736bc` |
| 19-r2 | 后端给负数或缺值时，通话分析页显示"—"与"没数据"分不开；通话质量页表里原样显示负数，卡片合计却悄悄把那天当 0（两页不一致） | 已修 | 质量页：`sumRows` 遇到任一天的无效值，该项合计就是"不知道"，依赖它的卡片显示"—"、不画红框；表里仍原样显示；新增警告条写出是哪几天（`quality-invalid-note`）。分析页：新增 `brokenDays`，警告条写出是哪几天（`analytics-invalid-note`），缺值和 `null` 不算无效。测试在 `quality.test.tsx`、`qualityMetrics.test.ts`、`analytics.test.tsx`。`bb736bc` |
| 19-r3 | "详情每次打开重新读取"没有测试（在抽屉里按会话缓存详情，26 条全过） | 已修 | `list.test.tsx`"reads the session again each time it is opened"；加缓存的变异后红。`bb736bc` |
| 19-r4 | 成功率折线的百分比格式没有测试（去掉 `percent`，35 条全过） | 已修 | `quality.test.tsx`"writes the success rate line as percentages"，直接取图的格式函数断言；去掉 `percent` 后红。`bb736bc` |
| 19-r5 | 分析页图里"通话人数"在没有行的日子是不是 0 没有测试 | 已修 | `analytics.test.tsx`"draws 0 accounts with a call for a day without a row"。该行为本来就对，是测试缺口；断言的是 `[0,0,4,0,0,0,0]`，补 null 的变异会红。`bb736bc` |
| 19-r6 | 质量明细表里"额度限制""用户未进入"两列（和"数字人不可用"）标题旁没有提示图标 | 已修 | 复用卡片的提示文字，`quality.tsx` 的 `headerWithTip`；`quality.test.tsx`"the hints of the table columns"悬停断言；回退后红。（"数字人不可用"一列的含义自解释，规格"自解释的列不加"，没有加。）`bb736bc` |
| 20-1 | 漏斗页"连续输入多个步骤"没有自动测试（happy-dom 里第二次输入加不上，测试靠先存再选绕开） | 已修 | 找到原因：加完一个步骤后下拉仍开着，第二次输入的回车被当作选下拉项；测试的 `addStep` 在每次加完后按 Esc 并失焦，之后可以连续输入。新增三条纯输入的测试（顺序和请求、十个允许第十一个拒绝、逗号）；步骤上限改 11 的变异后红。`681c778` |
| 20-2 | IP 列表头的提示没有测试 | 已修 | `detail.test.tsx`"says on the IP header…"悬停断言；把提示换成空串后红。`681c778` |
| 20-3 | 改了步骤、窗口、日期或另选漏斗后，下面的结果还是旧表单的，没有标记 | 已修 | `funnel.tsx` 的 `dropResult`：表单任一项改动就清掉结果和在途的查询（在途的回答作废）；另存为不改表单，结果保留。测试`funnel.test.tsx`"a result belongs to the form it was asked with"（5 条），回退后红。`681c778` |
| 20-4 | "客户端时间不可信"只在悬停提示里，键盘和触屏看不到 | 已修 | 列标题本身写成"客户端时间（自报）/ Client time (self-reported)"，提示保留；`detail.test.tsx`断言。`681c778` |
| 20-5 | 默认日期范围不看 `analyticsLiveMaxRangeDays`，后端上限小于 7 时第一次请求就被拒 | 已修 | 新增 `defaultRange.ts`：7 天与上限取小；三个页面用；三页各一条测试（上限 3、2、3）。回退后红。`681c778` |
| 20-6 | 提示文字里有契约没写的语义（"每个已登录的账号只算一次"；匿名事件"串到之后登录的账号"） | 已修 | 汇总页提示改成"每个账号只算一次"；漏斗说明改成契约写的三步（事件的账号；没有时取同一设备在窗口内带账号的事件的账号；仍没有用设备本身）。测试断言说明文字含这三步、汇总页不含"signed-in"。`681c778` |
| 21-1 | 总览从审核模块的页面目录取 `formatDuration`，审核改名或移动就编译失败 | 已修 | 移到 `src/utils/duration.ts`（连同测试），审核目录留一行转发；总览从 `utils` 取。文字键仍是 `moderation.duration.*`（只有这一套）。`159e29b` |
| 21-2 | 趋势图只要用到的一个请求失败，整张图都不画 | 已修 | `TrendSection.tsx`：失败请求对应的指标不画并写出名字（`dashboard-trend-partial`，带重试），其余照画；所选指标全部依赖失败请求时仍显示整体失败。`overview.test.tsx` 三条；回退后红。`159e29b` |
| 21-3 | D1 提示框数值格式（加"%"，一位小数）没有测试 | 已修 | `trendChart.test.ts`"the tooltip of the percentage axis"；把格式函数改成直接输出后红。`159e29b` |
| 21-4 | 通话质量快捷入口指向当时不存在的路由，路由测试只核对"已在路由表里的" | 已修 | 通话页面已上线（`/sessions/quality` 在路由表里）；`config/routes/dashboard.test.ts` 改成五个入口的目标都必须在路由表里。`159e29b` |
| 21-5 | 未处理告警数里的负数没有测试 | 已修 | `overview.test.tsx`"…when the alert count is below 0"；去掉 `cleanFigure` 后红。`159e29b` |
| 21-6 | 统计跨度配置小于 90 天时，总览的统计类内容全部失败 | 已修 | `dashboardSources.ts` 的 `loadedDays`：取 90 与 `statsMaxRangeDays` 的小者，总览把 `meta.statsMaxRangeDays` 传进去；两条测试（31 天、366 天）；回退后红。`159e29b` |
| 22-1 | 推送模板、任务、周期推送页有一个点了没用的搜索框（`PagedListTable`） | 已不存在 | 提交 `696f759` 起，没有可搜索列时不画搜索区：`src/components/PagedListTable.tsx` 的 `hasFilter` 判断，测试 `PagedListTable.test.tsx`"draws no search area…" |
| 22-2 | 表单里的 `UploadField` 旁边多一个原生"选择文件"框，推送自己加了一份 `UploadBox` 绕开 | 已修（根因已在共用组件里修） | 提交 `c89c581`：`src/components/UploadField.tsx` 的 input 加内联 `display:none`。这里删掉推送自己的 `UploadBox.tsx`，`ContentFields.tsx` 直接用 `UploadField`，测试改成断言 input 的内联样式。`1693db6` |
| 22-3 | `linkTargetRule` 与链接输入框一起用时网址错误显示两遍，推送自己包了一层 | 已修 | 共用规则加选项 `{ quietUrl: true }`（`LinkTargetField.tsx`）：网址不合法时仍拦住提交，但不带消息；推送的 `ContentFields.tsx` 用它，删掉自己的包装；`LinkTargetField.test.tsx` 一条新测试。通知页的 `SendModal.tsx` 也有同样的重复（属别的组），可以同样加这个选项。`1693db6` |
| 22-4 | 假后端推送效果的触发原因不是契约的值（`recall`…），选"每日召回"得到 400 | 已修 | `mock/_core/statRange.ts` 的 `TRIGGERS` 改成 `daily_recall、streak_at_risk、admin、system_event`；`mock/stats.mock.test.ts` 两条（按契约值能筛、不是契约值给 400），回退后红。`bb736bc`（与 19-1 同一提交，同一个假后端文件） |
| 22-5 | 推送和形象各有一份相同的小件：`EnabledSwitch`、`useUploadSlot`、`failureToForm`、`codeText`、`UploadBox` | **仍未修**（`UploadBox` 已随 22-2 消失） | 现在 `EnabledSwitch` 在 `src/pages/avatar/` 和 `src/pages/push/` 各一份（推送多一个 `failureText`）；`useUploadSlot` 在 push、avatar、appVersions、ads 四处；`codeText` 在 push、avatar、campaign、activity、sms、appVersions 六处且签名已不同；`failureToForm` 在 push、avatar、campaign、activity、sms。要合并必须同时改这些组正在改的目录（广告、形象的文件此刻都有未提交的改动），并行时会互相踩，所以没有动。建议：所有组做完后做一次合并（`src/components/EnabledSwitch.tsx`、`src/hooks/useUploadSlot.ts`、`src/utils/codeText.ts`，各目录改成引用），一次只改引用，不改行为 |
| 22-6 | 假后端 `supportedLocales` 固定 `['en']`，矩阵只有一列 | 已不存在 | `mock/_core/meta.ts:7` 现在是七种语言 |
| 22-7 | 列表里的时刻按浏览器时区显示而新建时按 UTC 输入，列表没标时区 | 已修 | 两个列标题改成"计划时间（本机时区）/ Planned time (time zone of this computer)"、"下次生成时间（本机时区）/ Next task (time zone of this computer)"；"发送时刻与时区"列仍按输入的时区原样写。测试：标题；新加坡浏览器里 10:00 UTC 显示 18:00。`1693db6` |
| 22-8 | 列表开关被后端 400 拒绝时只显示通用文字，看不到是哪一项 | 已修 | `recallRule.ts` 的 `templateFailureText(…, { reasons: true })`：在按错误码的文字后面加上页面有译文的原因（每个原因一次），没有译文的原因不显示、后端原话从不显示；行内开关和行内删除用它，对话框不用（字段下面已经有）。测试 `recallRule.test.ts` 6 条、`templates.test.tsx` 1 条；回退后红。`1693db6` |
| 22-9 | 发送记录页没有筛选 | 不在清单 | 评审判为不是缺陷（规格没写筛选，契约没给参数） |
| 22-10 | 取回结果的过期守卫没有测试（记录页列表、记录展开行、推送效果页、模板页矩阵，去掉任一处 `counter` 判断全绿） | 已修 | 新文件 `src/pages/push/staleReads.test.tsx`：四处各一条（先发的后到）；展开行那条用严格模式让副作用跑两次来触发。四处守卫各去掉一次，对应测试红。`1693db6` |
| 22-11 | 换文件时清掉旧 `uploadId` 没有页面级测试（`onCleared` 改成空函数全绿） | 已修 | `templates.test.tsx`"sends no picture when a picture was uploaded and then replaced by a file that was refused"；`onCleared` 改空后红。`1693db6` |
| 22-12 | 发送记录账号链接的 `USER:VIEW` 判断没有测试 | 已修 | `records.test.tsx`"links the account to the user page only for an administrator who may see users"；把判断改成 `true` 后红。`1693db6` |
| 22-13 | 没用到的语言键 `push.templates.empty` | 已修 | 两种语言文件里都删了。`1693db6` |
| 22-14 | 推送图片请求体字段叫 `imageUploadId`，契约写"只接受 `uploadId`" | 写成问题文件（已有，未改代码） | `docs/contract-requests/2026-10-26-admin-frontend-push.md` 第一节第 3 条；契约没有给请求体字段名，按主会话复核归为记录。后端答复前不改；若答复是 `uploadId`，改动面是 `types.ts`、`bodies.ts`、假后端和六处测试 |
| msg-1 | 模板列表响应没有 `total` 时多请求或丢行 | 已不存在 | `src/services/push/index.ts:69-70` 按数字 `total` 停，没有时按短页和重复 id 停（追加部分已修） |
| msg-2 | 假后端 `PUT /push/templates/:id` 接受请求体里的 `locale`、`triggerReason`，页面从不发 | 仍在，保留 | 是为复现后端清单 a5 的第三种拒绝而留的，问题文件 `2026-10-31-admin-frontend-push-default-language-case.md` 与 `2026-10-26-admin-frontend-push.md` 已向后端问真后端是否接受。没有后端答复前不改，不算缺陷；属于"写成问题文件" |
| msg-3 | 被拒文字比计划写的少；矩阵"整行没启用的模板"标记；假后端大小写比较没有测试 | 已不存在 | 追加部分已修：`push.templates.noteHowTo`（`templates.tsx:179-180`）、`coverage.ts:33,44` 的 `noneEnabled`、`mock/push.mock.test.ts` 的大小写用例 |
| msg-4 | 短信页相关三条（等待上限、被拒判断的两个条件、操作前提示） | 不属于推送 | 不在本组范围，未核对 |
| prov-1 | 日报和通话质量页每次渲染都取当前时间，页面跨过 UTC 零点后昨天那天会在没重新读的情况下失去"临时值" | 已修 | `daily.tsx` 记下读数据时的"今天"（`askedOn`）随行保存；`quality.tsx` 的读取函数把它和答案一起返回；总览本来就是这样。测试：日报和通话质量各一条，23:58 读数据，00:02 重绘（切页签、改日期），标记仍在昨天那一行/六张卡片；回退后红。`bb736bc`（含 `daily.tsx`、`daily.test.tsx`） |
| prov-2 | 总览灰色涨跌的说明只写在 `title` 属性，触屏和键盘用不了 | 已修 | `OverviewCard.tsx`：灰色的涨跌用 antd `Tooltip`，并可聚焦（`tabIndex=0`）；完整日的涨跌既无提示也不占 Tab 位。测试：悬停、键盘焦点都出现；完整日的没有 `tabindex`；中文一条改成悬停。`159e29b` |
| prov-3 | 实现者的记录 1、2、3 | 不在清单 | 评审改判：1、2 是变更，3 不是缺陷 |

## 新发现的问题

- 立即修：无。
- 记录：通知页 `src/pages/notifications/SendModal.tsx:417` 的链接规则也有同样的网址错误重复（不是我的范围）。触发：链接类型选"网址"输入 `http://x`；结果：同一句原因出现两次。可以像推送那样给 `linkTargetRule` 传 `{ quietUrl: true }`。
- 记录：合并后 `src/pages/stat/daily.tsx` 里有别的会话未提交的改动（它引用了我新加的 `src/pages/analytics/defaultRange.ts`）；我没有碰它们，也不在我的提交里。
- 一次提示：`src/pages/moderation/queue.test.tsx` 有一次失败（`findByRole('link', { name: id })` 找不到），那个目录里别的会话有未提交的改动；我把 `duration.ts` 移走后重跑同一个文件通过（见下面的命令）。

## 测试和变异

命令都是 `npx vitest run --no-file-parallelism … --testTimeout=60000`（机器负载高）：

- 通话、推送、日报、公用链接组件、路由、假后端、语言一致性：22 个文件 503 条，第一次 4 条失败（我自己新写的 3 条测试的写法问题：下拉预设在页面打开时已定、表格读取时挡住鼠标、矩阵测试的读取顺序错，以及列表页一条在高负载下超时），改后重跑通过。
- 总览、审核队列、等待时长、通话质量、列表页、过期读取：11 个文件 262 条，1 条（提示框）改后通过。
- 埋点管理全部：4 个文件 81 条通过。
- 总览页、禁止写死文字扫描、语言一致性、三个路由文件：6 个文件 174 条通过。

每条新增测试都在回退源码后看到红，再恢复看到绿；测试缺口类另做了变异：去掉两处读取钩子的计数比较、抽屉缓存详情、折线图 `percent`、D1 提示格式、告警数 `cleanFigure`、四处推送过期读取的守卫、`onCleared`、`USER:VIEW` 判断、步骤上限、IP 提示、"今天"取每次渲染的时钟（日报、通话质量）、快捷入口路径、通话分析的无效数判断，全部变红后恢复。没有留调试日志；两种语言文件键相同（一致性测试通过）；没有新增第三方产品名。

