立即修未修 0、记录项 2、未运行 3、阻塞 0

区域 ops：告警、记忆服务、通话详情、订阅统计、投诉、用户封禁、推送任务状态（清单 b1、b2、W2a、GROUP A 的第 18 种告警和两条结果、a7、a11、a12、GROUP B 的记忆服务两个字段）。分支 `claude/jolly-dirac-4pq9g6`，没有推送。提交：c1ef340（全部代码、测试、语言文件、问题文件和本报告的第一版）；`push.tasks.missed` 两个语言文件里的那一行是 msg 区域的提交 e6a2ad9 整个文件一起带进去的（我没有重复提交）。

未运行的三项：（1）全量测试和构建，按规则由主会话统一跑；（2）真实后端联调（没有后端）；（3）账号“记忆”页签的“只显示最新 200 条，共 N 条”没有在真实浏览器里看：假后端里有 230 条记录的账号是 `2006`，它不在用户列表里，用户详情页打不开它，只有页面测试（`AccountMemoryTab.test.tsx`）覆盖。

## 记录项

1. 手动推送任务的“定时发送”帮助文字（`src/locales/en-US/push.ts` 的 `push.tasks.sendAtHelp`，中文同键）还写着“时间过去很久会按错过取消”，没有说“执行器停机超过 `push.schedule_catchup_minutes`”这个条件。触发：新建任务，选“定时”，看输入框下的说明。后果：只是说明不够准，不影响行为。建议和其他记录项一起修。
2. `src/pages/complaints/likeness.test.tsx` 在机器负载高时（同时有十几个 vitest 进程）会有一两条超时失败，每次失败的用例不同（我这边先后见到“sends no note when it is empty”“shows the state when the backend says the complaint is closed already (409)”“has no change or remove button for a closed complaint”），单独跑 38 条全过。和我的改动无关（我只加了三条）；触发：负载高时跑整个文件。

另有一件事要如实交代：开始时我对 `mock`、`src/pages`、`src/services` 整个目录跑了一次 `biome format --write`（输出“Fixed 9 files”），其中我自己的测试文件占一部分，但我没法逐个确认另外几个是不是别的代理还没提交的文件（只是排版，不改内容）。之后只对自己的路径跑。

## 逐行

### b1 SUPPORT_FORWARD_FAILED
- 落实：类型加进告警类型表（`src/services/monitor/alertTypes.ts`）和筛选（`src/pages/monitor/alerts.tsx` 取 `ALERT_TYPES`）；文字“客服反馈转发失败 / Support feedback forwarding failed”（`src/locales/{zh-CN,en-US}/monitor.ts`）。关联账号沿用原来的链接到 `/users/{id}`。`detail` 固定值 `attempts_exhausted` 显示成“转发次数已用尽（attempts_exhausted）”（旁边保留原值便于搜索；不附后端 message）；只对这个类型的这个值翻译，别的类型出现同样的值按原样显示（`alertDetailKey`）。`refType` `SUPPORT_FEEDBACK` 原样显示。
- 假后端：`mock/_core/monitorData.ts` 加样例告警（反馈 5003，是假数据里失败的一条，账号 2003）；`mock/support.mock.ts` 的重试成功后同一步把这个反馈的未处理告警置为 RESOLVED；重试没改任何东西（404、409）时告警保持打开。
- 测试：`src/pages/monitor/alerts.test.tsx`（“the four types the backend added”整组：链接到用户、固定值的文字、中文、筛选里能选并发出 type）；`mock/support.mock.test.ts`（重试后告警置为已解决且只有这一条；404/409 保持打开；失败后再开新告警，重试再关）；`src/services/monitor/monitor.test.ts`（固定值表）。

### b2 POSTBACK_CREDENTIAL_FAILED（含 GROUP A 更正）
- 落实：类型和文字“投放回传凭证不可用 / Campaign postback credential unusable”；`token_unreadable`、`pixel_id_malformed` 按码翻译（旁边写原值）；平台错误码（如 `190`）原样显示，空值显示“—”；该类型没有关联账号，不出链接。
- 假后端：样例三条（`token_unreadable`、`pixel_id_malformed`、`190`，分别对应活动 1、4、6）；`raiseAlert`（`mock/_core/monitorData.ts`）实现“一个对象同一时刻一条未处理告警；后到的失败原因替换 detail（只对这个类型），别的类型保留第一次；解决后再失败开新的”；`mock/campaign.mock.ts` 的 `PUT /attribution/campaigns/:id` 在“带了新令牌，或像素 id 变了”时自动关闭该活动的告警，只改名字等不关。
- 测试：`mock/monitor.mock.test.ts`（“opening and closing alerts from the backend side”三条）；`mock/campaign.mock.test.ts`（“the postback credential alert of a campaign”三条：填令牌关闭、改像素 id 关闭而只改名字不关、更新被拒绝时不关）。
- 没落实/未定：清单只说“重新填写令牌或像素 id 时”，不清楚“像素 id 没变”算不算。我按“变了才算”做假后端，写进问题文件 `docs/contract-requests/2026-10-31-admin-frontend-alerts-new-types.md` 第二节；真实后端不一样时只改假后端。

### SUBSCRIPTION_EVENT_FAILED
- 落实：类型在筛选里（“订阅事件处理失败 / Subscription event processing failed”，名字取自类型名）；`refType`、`refId`、`detail` 一律经 `plainText` 原样显示（对象显示成 JSON），不编说明；`accountId` 有值就是链接。假后端有一条样例（`refType` `SUBSCRIPTION_EVENT`、`detail` `IllegalStateException` 是我编的占位，不自动解决）。
- 测试：`alerts.test.tsx` “shows what a subscription event alert carries as it comes”（泰语的 refType、对象形式的 detail）。
- 问题文件：`docs/contract-requests/2026-10-31-admin-frontend-alerts-new-types.md` 第一节（refType、refId、accountId、detail 取值、自动解决条件、运营该做什么）。

### GROUP A 第 18 种 STAT_RELAND_FAILED
- 落实：类型和文字“统计重新落库失败 / Statistics re-landing failed”；`refType` `STAT_RELAND_DAY`、`refId` `<lander>:<yyyy-MM-dd>`（样例 `usage-cost:<日期>`）、`detail` 异常类名，全部原样显示。
- 测试：`alerts.test.tsx` “shows the re-landing alert …”和类型筛选；`mock/monitor.mock.test.ts` “has the details the backend names for the other new types”。

### W2a 告警接口
- 现有 `ALERT_TYPES` 原来是 14 种（契约 17.4），现在是 18 种（加了上面四种；清单说“17 现 18”，是把 `SUBSCRIPTION_EVENT_FAILED` 算在内的数）。筛选选项取这 18 种（`alerts.tsx` 的 `valueEnum`）。页面本来就用 `status || undefined`，不会发空字符串。
- “未知类型显示原始字符串不崩溃”的测试仍成立：`alerts.test.tsx` “shows a type it does not know as it is”原样保留并通过；类型数量的测试从 14 改成“契约的 14 种都在、再加四种、共 18”（`monitor.test.ts` 第一条）。
- 假后端：`GET /alerts` 现在对 `status` 不是 OPEN/RESOLVED、`type` 不是这 18 种、空字符串（空字符串也算一个值）一律 400，`details` `[{ref, reason:'OUT_OF_RANGE'}]`；分页的错误先于它们（`mock/monitor.mock.ts`，测试 `mock/monitor.mock.test.ts` 两条）。

### a7 通话详情 maxDurationMinutes
- 落实：抽屉新增一行“发起时的最长时长 / Max length when made”，整数分钟（“10 分钟 / 10 min”），下面一行小字说明“发起通话时记下的值，之后改设置不影响已发起的通话；用来解释截止时间为什么和现在的设置不一样”。不是整数、负数、缺失一律“—”，0 显示“0 分钟”。（`SessionDrawer.tsx`、`format.ts` 的 `formatMinutes`、`src/services/sessions/types.ts`、两个 `sessions.ts` 语言文件。）会话列表九列不变。
- 假后端：`mock/_core/sessionsData.ts` 每条通话带 `maxDurationMinutes`，截止时间 = 开始 + 这个分钟数；`ses-0008` 是 10 分钟（和默认 60 不同，用来演示）；详情返回，列表不返回。
- 测试：`mock/sessions.mock.test.ts` “gives the longest length …”；`src/pages/sessions/list.test.tsx` 三条（英文显示、中文加 0/缺失/小数/负数/文字、BANNED 结束原因）。

### a12 订阅统计 Google 标价
- 该行在我的区域里原本就已满足一部分：统计表早已有“标价”列（`src/pages/subscriptions/stats.tsx` 原第 168 行，`subscriptions.stats.listPrice` 中文“标价”），两个字段都为空时显示“—”（原测试 `stats.test.tsx` 的“shows a dash …”），苹果行不变。所以没有再加列。
- 不经浮点：原来的 `formatListPrice` 用 `Number(amount)`，会把超过 15 位的十进制字符串改掉。现在用字符串直接交给 `Intl.NumberFormat`（不丢位、不四舍五入，小数位最多 20），格式不是十进制字符串（含 `1e21`）显示“—”；没有币种就按原有小数位写成普通数字；币种浏览器不认识就写币种代码加数字。类型 `listPriceAmount` 改成 `string | null`（`src/services/subscriptions/types.ts`）。
- 假后端：原来的样例已是字符串或 null、Google 行无尾零；加了一条测试固定这一点（`mock/subscriptions.mock.test.ts`）。
- 测试：`stats.test.tsx` 新增 `9007199254740993.01`、`24.999`、`0.1234567`、中文界面、五种“显示破折号”、无币种、列顺序。

### a11 投诉列表 status=OPEN
- 落实：筛选下拉第一项加“未结案 / Not closed”（`complaints.filter.OPEN`），默认不选，仍不带 status；选中发出 `status=OPEN`。服务里 `ComplaintStatusFilter`、`COMPLAINT_FILTER_STATUSES`。（`src/services/complaints/index.ts`、`src/pages/complaints/likeness.tsx`）
- 假后端：`OPEN` = 未结案（RECEIVED 和 INVESTIGATING），`total` 按同一条件，仍按 dueAt 升序；`open`、`Open`、`OPEN,RECEIVED`、带空白的值、小写的状态都是 400 `OUT_OF_RANGE` on `status`；空字符串不过滤；分页的错误先于 status 的错误。原来假后端把 `OPEN` 当错误值的那条测试已改。
- 测试：`mock/complaints.mock.test.ts`（五条）、`src/services/complaints/complaints.test.ts`、`likeness.test.tsx`（选“未结案”发出 status=OPEN、默认不带、中文）。

### GROUP B 记忆服务 truncated 和 totalCount
- 落实：`truncated` 为真时，历史表上方显示信息条“只显示最新 200 条，共 N 条。”（200 取自实际显示的条数；`totalCount` 缺失时只写“只显示最新 200 条。”，不编数字；`truncated` 缺失或为假不显示）。（`AccountMemoryTab.tsx`、`src/services/memory/index.ts`、语言文件。）
- 假后端：`GET /accounts/{id}/memory` 只返回最新 200 条（新到旧）、`truncated`、`totalCount`；加了账号 `2006`（230 条）。测试 `mock/memory.mock.test.ts`（未截断、截断、恰好 200 与 201 的边界）、`AccountMemoryTab.test.tsx`（英文、中文、不截断、缺字段、只有 truncated）。

### GROUP A 两条结果
- 封禁后通话以 BANNED 结束：结束原因翻译原本就有——通话抽屉 `sessions.endReason.BANNED`（`src/locales/*/sessions.ts` 第 20/21 行，“账号被封禁 / Account banned”）和用户详情的通话页签 `users.endReason.BANNED`（`src/locales/*/users.ts`）；`END_REASONS` 里也有 `BANNED`。原来没有精确文字的测试，现在补了：`src/services/sessions/sessions.test.ts`（两处前缀、两种语言都有每一个结束原因，BANNED 的文字固定）、`list.test.tsx`（抽屉里英文和中文）。假后端：`mock/users.mock.ts` 封禁时把该账号正在进行的通话（用户页签和通话记录两处）以 BANNED 结束（真实后端是立即或在一个扫描周期内，假后端立即）；测试 `mock/users.mock.test.ts` 两条加“封禁被拒时不动”。
- 推送任务出现 CANCELLED 加 note MISSED：假后端原本就有（`mock/_core/pushData.ts` 第 290 行的任务 5）。原来的标签只写“已错过 / Missed”；现在写“错过：执行器停机过久，未发送 / Missed: the push executor was down for too long, nothing was sent”（`push.tasks.missed`），标签限宽 220 并换行（真实浏览器看过：1440 和 390 宽度都没有撑破表格）；只有带这个 note 的行显示。测试 `src/pages/push/tasks.test.tsx` 两条（英文，中文并检查别的行没有）。

## 命令和结果
- RED（实现前）：`npx vitest run` 对上述 18 个文件，15 个文件失败、58 条失败、375 条通过（例如 `expected [ 'DELETION_FAILED', …(13) ] to have a length of 18 but got 14`；`isKnownAlertType('STAT_RELAND_FAILED')` 为假；订阅统计 `Number()` 路径丢位；其余是页面或假后端还没有新行为）。输出只留了末尾 150 行，在 `scratchpad/ops/red.txt`（不在仓库里）。
- GREEN：同一批文件（再加 `src/pages/support`、`src/services/memory`、`src/pages/pages.test.tsx`、`tests/noHardcodedText.test.ts`、`src/locales`）：31 个文件，1024 条通过、1 条失败；失败的是上面记录项 2 说的 `likeness.test.tsx` 超时，单独跑 38 条全过。`push/tasks.test.tsx` 改完宽度后单独再跑，25 条通过。
- `npx biome check` 对我改的路径：无错误。`npx tsc --noEmit`：我的路径下没有报错（只有 `src/pages/sms`、`src/services/sms` 里别人的 14 条）。
- 变异检查，20 个全部被测试抓住（`scratchpad/ops/mutate.py` 和 `mut.txt`）：去掉 `STAT_RELAND_FAILED`；固定值不分类型；监测假后端放过空 status；postback 后到原因不替换；重试不关告警；重试在状态检查前就关告警；改活动时带令牌不关；任何保存都关；标价改回 `Number()`；OPEN 过滤取反；status 大小写不敏感；筛选里没有“未结案”；记忆截断条件取反；截断改为 201；排序改成旧到新；所有取消的任务都标错过；分钟数接受小数；接受负数；封禁不结束通话；去掉 BANNED 翻译。每次变异后文件都已还原（再核对过）。
- 真实浏览器（Playwright Chromium，从草稿目录的拷贝起 `dev:mock`，端口 8861，用完按进程号停了）：告警页能看到三个新类型、三种固定详情、`190`；按“统计重新落库失败”筛选后只剩那条且 refId 为 `usage-cost:…`；在客服页点第一个“重试”后，回告警页那条转发告警不再在未处理里；会话抽屉 `ses-0008` 显示“Max length when made / 10 min”；订阅统计的标价列有 `IDR 149,000`、`$9.99`、“—”；投诉的状态下拉依次是“Not closed、Received、…”，选“未结案”后列表里没有已结案的状态；推送任务的错过标签；中文告警页。控制台只有登录前一次 401（未登录时读 /me 的正常现象），没有其他错误。截图在 `scratchpad/ops/*.png`（不在仓库里）。

## 覆盖的语言
界面只有 zh-CN 和 en-US，两种都测了（告警类型和固定详情、通话抽屉、未结案、记忆提示、错过标签）。数据方面：告警和记忆的样例沿用原来含七种语言的假数据；我新加的断言里用了泰语加 emoji 的 refType 和 `ก` 的重复串、阿拉伯语和泰语的推送标题（原有用例）。价格格式只有英文和中文界面两种数字格式的页面测试；其他语言的数字格式只覆盖英文和中文。

## 问题文件
- `docs/contract-requests/2026-10-31-admin-frontend-alerts-new-types.md`：`SUBSCRIPTION_EVENT_FAILED` 的内容；`POSTBACK_CREDENTIAL_FAILED` 的“重新填写”算不算像素 id 没变；平台错误码有没有固定写法。

## 需要改共享文件
无。`src/locales/*/{monitor,sessions,complaints,memory,push}.ts` 是各自模块的语言文件。`mock/campaign.mock.ts`、`mock/users.mock.ts`、`mock/support.mock.ts` 属于别的模块，只加了一小段（告警联动、封禁结束通话），没有改别的行为。

## 规格和契约需要在 main 上修改的地方（变更请求，只写不改快照）
1. 契约 17.4“后台告警（`AdminAlert`）”段落：“共十四种”改成十八种，补四种：`SUPPORT_FORWARD_FAILED`（`refType` `SUPPORT_FEEDBACK`，`refId` 反馈 id，`accountId` 反馈所属账号，`detail` 固定 `attempts_exhausted`，对反馈点“重试”成功时同事务自动解决）、`POSTBACK_CREDENTIAL_FAILED`（`refType` `ATTRIBUTION_CAMPAIGN`，无账号，`detail` 为 `token_unreadable`、`pixel_id_malformed` 或平台错误码，后到的原因替换 detail，填令牌或像素 id 或回传成功时解决）、`SUBSCRIPTION_EVENT_FAILED`（内容待后端补，见问题文件）、`STAT_RELAND_FAILED`（`refType` `STAT_RELAND_DAY`，`refId` `<lander>:<yyyy-MM-dd>`，无账号，`detail` 异常类名，该日落库成功时自动解决，可手动关闭）。`GET /alerts` 的 `status` 只能 OPEN/RESOLVED、`type` 只能这些，其它 400（空字符串也是一个值）。
2. 设计文档 5.14 的类型表同样补这四种；设计文档 5.5 通话详情加 `maxDurationMinutes`；5.10 订阅统计写明谷歌标价字符串；5.25 投诉筛选加 `OPEN`。
3. 注意：`src/services/monitor/monitor.test.ts` 的第一条测试从快照里读“共十四种”并断言契约有 14 种；契约改成十八种后，这条要改成“契约的全部类型都在表里，且表不多于契约”。

## 变更候选（按业界做法已自己定，没有请示）
- 固定详情值旁边保留原值（“文字（原值）”）；
- 订阅事件告警不加任何说明文字；
- 推送任务的“错过”标签直接写完整的原因（而不是悬浮提示），限宽换行。

## 收到的转交消息

协调者转来一条写给 growth 区域的提醒（要求把 `src/pages/campaign/settings.test.tsx`、`src/pages/moderation/rules.test.tsx` 的未提交改动带进提交，并修 `rules.test.tsx` 里 “fold look-alike letters” 的失败用例）。这两个文件和那条用例都不是我的区域，里面的改动不是我写的，所以我没有提交也没有改它们；如果这条消息本意是给我，请再确认一次。

## 评审后的修复（2026-10-31）

立即修未修 0、记录项 0、未运行 2、阻塞 0。评审给的 4 条记录项和我自己的记录项 1，共 5 条，都已修。

1. 订阅统计标价若是 JSON 数字，整格显示“—”。`src/pages/subscriptions/stats.tsx` 的 `formatListPrice` 现在接受 `number | string | null`：十进制字符串走原来的精确路径（超过 2^53 的 `9007199254740993.01` 仍显示 `$9,007,199,254,740,993.01`），有限数字按数字格式化（`9.99`/USD 显示 `$9.99`，无币种 `12.5` 显示 `12.5`），NaN、无穷、布尔、对象、数组、坏字符串、null 显示“—”。`src/services/subscriptions/types.ts` 的 `listPriceAmount` 类型改回 `number | string | null`。RED：新测试在改前失败（`expected '—' to be '$9.99'`）。变异：把数字分支的 `Number.isFinite` 去掉，非有限数测试失败；把字符串改成先 `Number()` 再格式化，精确位数测试失败。注意页面测试的假响应要经过 JSON，NaN 和无穷在那里会变成 null，所以非有限数是直接调 `formatListPrice` 测的。
2. 告警“关联对象”列：`src/pages/monitor/alerts.test.tsx` 补了 refType、refId 为对象、数字（含 0）、数组、布尔的页面测试，断言文字是 JSON 或数字原样，页面没有 `[object`。变异（把 `plainText(...)` 改回 `?? DASH`）使它失败，原代码通过。
3. 推送任务只有 `note === 'MISSED'` 才显示“错过”：`src/pages/push/tasks.test.tsx` 补了测试（中英文各一遍），给已取消的任务设 `CANCELLED_BY_ADMIN`、小写 `missed`、带前导空格的 ` MISSED`、`MISSED_LATER`，只有任务 5 显示。变异：`row.note ? …` 失败；`trim().toUpperCase()` 后比较也失败。
4. 假后端“重试哪条反馈就关哪条告警”：`mock/_core/monitorData.ts` 的样例数据多了第二条 `SUPPORT_FORWARD_FAILED` 告警（反馈 5005，账号 2005；5005 本来就是失败的反馈，评审说“假数据里只有 5003 一条失败的反馈”不准确，失败的反馈很多，是只有 5003 有告警）。`mock/support.mock.test.ts` 补测试：先重试第二条，只关它的告警，再重试第一条。变异：把 `resolveAlertsOf('SUPPORT_FEEDBACK', row.id)` 里的 `row.id` 写死成 `'5003'`，新测试失败。`mock/support.mock.ts` 本身不用改，没有动。
5. 我自己的记录项 1：`push.tasks.sendAtHelp` 中英文改成写明“执行器停机超过 push.schedule_catchup_minutes 分钟时，错过的任务会取消并标为错过”；`tasks.test.tsx` 补了弹窗里的文字断言（中英文）。RED：改回旧文字时两条失败。

只跑了相关测试：`src/pages/subscriptions/stats.test.tsx`、`src/pages/monitor`、`mock/support.mock.test.ts`、`mock/monitor.mock.test.ts`、`src/pages/push/tasks.test.tsx`，加语言文件和禁止写死文字的扫描。唯一的失败来自别的区域尚未提交的改动（`src/locales/parity.test.ts` 报 `push.templates.defaultLanguageRequired` 占位符数量和 `NOT_CURRENCY_CODE` 缺原因文字），不是这次的改动。`npx biome check` 对改动的文件无报错；`npx tsc --noEmit` 在这些路径下无报错。

未运行：全量测试和构建（按规则由主会话统一跑）；Firefox、Safari 里标价的格式化（只有 Chromium 和 Node）。
