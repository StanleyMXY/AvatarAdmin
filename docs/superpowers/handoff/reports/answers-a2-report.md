改了 7 处、没做 1 处、没运行 2 项、阻塞 0

组 a2，负责编号 26、36、54、56、59、73、116。分支 `claude/jolly-dirac-4pq9g6`，没有推送，没有开拉取请求。每个编号都先写了会失败的测试并看到红，再改代码；关键规则做了变异检查（见后面）。26 与 56 同在埋点模块（同一批文件），36、73、116 同在邀请模块，所以各合成一个提交。

## 提交

| 提交 | 内容 |
|---|---|
| `bdbc8c0` | 26 和 56：埋点管理 |
| `ff1b2a7` | 54：通话列表筛选 |
| `83f21fa` | 59：用户的会话页签 |
| `d439efa` | 36、73、116：邀请与分享 |

## 逐个编号

| 编号 | 答案要求前端改什么 | 状态 | 提交与位置 |
|---|---|---|---|
| 26 | 事件明细读 `name`（不读 `eventName`），筛选参数也叫 `name`；可用 `id` 当行键；`from`/`to` 发完整 ISO 时刻；平台、版本从 `context.platform`、`context.appVersion` 读，SERVER 行允许为空 | 已改：类型 `AnalyticsEvent` 改为 `name`、`source`、`seq`、`deviceId` 可空；筛选参数发 `name`；假后端的行按后端的十二个字段给出，SERVER 行的 `deviceId`、`context`、`clientTime`、`ip`、`country` 为 null，`id` 是 24 位十六进制，`name` 不符合 `[a-z0-9_]{1,64}` 答 400 INVALID_FORMAT（`ref=name`，先查范围再查名字）；页面设备列对 null 显示"—"。原本就一致：行键本来就是 `id`；平台、版本本来就从 `context` 读（`contextText`），这次补了 SERVER 行显示"—"的测试 | `bdbc8c0`：`src/services/analytics/index.ts:18-48`；`src/pages/analytics/detail.tsx:91,189,155,227-232`；`mock/analytics.mock.ts:84-97,228-236`；`mock/_core/analyticsData.ts`（SERVER 行、id、`readFailure`） |
| 56 | 四个接口的 `from`/`to` 发 ISO 时刻，`to` 自己算成次日 00:00:00Z；没有默认范围，页面总传两个参数；跨度是 31 天的时长；越界错误绑 `to`，TOO_SLOW/TOO_MANY_EVENTS 绑 `from` | 已改：服务层类型 `InstantRange`；三个页面（汇总、明细、漏斗，含事件名联想）用 `utcDayRangeToInstants` 把所选的 UTC 日范围转成 `[当天 00:00:00Z, 次日 00:00:00Z)`，两个参数总是发。日期选择器按"含两端的天数"限制和后端按时长限制等价（N 天选出来正好是 N×24 小时），没有改选择器。假后端：缺参数 MISSING（两个都缺只报 `from`）、格式不对 INVALID_FORMAT（只认 `Z` 结尾）、`to` 不晚于 `from` 或超过 `analytics.live_max_range_days`×24 小时（读配置）→ `to` OUT_OF_RANGE，恰好 31×24 小时通过、多 1 秒拒绝；`readFailure` 开关触发 `from` 上的 TOO_SLOW（四个接口）和 TOO_MANY_EVENTS（只漏斗）。页面失败条在通用文字后加这两个原因的译文（`analytics.range.reason.*`），不附后端 message | `bdbc8c0`：`src/services/analytics/index.ts:5-16`；`src/pages/analytics/summary.tsx:33-37`、`detail.tsx:87-100`、`funnel.tsx:79,105,111`；`src/pages/analytics/rangeFailure.ts`；`mock/analytics.mock.ts:21-75`；`src/locales/{zh-CN,en-US}/analytics.ts` 末尾两条 |
| 54 | "进行中"参数用 `inProgress`；`from`/`to` 发 ISO 时刻；`guest` 只发小写 `true`/`false`；第四节：偏移写法没核实，只发 `Z` 结尾 | 已改："进行中"原来发 `ongoing`（后端会静默忽略，筛选不生效），现在发 `inProgress`；`from`/`to` 原本就发 `…T00:00:00Z`，`guest` 原本就发小写，补了测试。按保守做法：页面只发 `Z` 结尾的 UTC 时刻，假后端也只认 `Z`（带 `+08:00` 的答 INVALID_FORMAT，使一旦页面改发偏移就会被测试发现）。假后端其余按答案：`guest`/`inProgress` 的非法词（`TRUE`、`1`、`yes`）→ OUT_OF_RANGE；`accountId` 不是 UUID → INVALID_FORMAT；不认识的参数名被忽略；不再检查 `from` 早于 `to`，也没有最长范围 | `ff1b2a7`：`src/pages/sessions/list.tsx:193`；`src/services/sessions/types.ts:46-65`；`mock/sessions.mock.ts:1-60` |
| 59 | 用户会话页签不读 `endReason` | 已改：去掉"结束原因"一列；类型 `UserSession` 去掉 `endReason`，补上后端的 `accountId`、`deviceId`；假后端 `GET /users/{id}/sessions` 只给九个字段（内部仍保留 `endReason` 给封禁结束通话用）；两个语言文件里不再使用的六条文字（`users.sessions.endReason`、`users.endReason.*`）删除。没有加"点开某行再取详情"（新增功能，答案只说"需要时"） | `83f21fa`：`src/pages/users/SessionsTab.tsx`；`src/services/users/types.ts:114-130`；`mock/users.mock.ts`（会话接口）；`src/locales/*/users.ts` |
| 36 | 分享漏斗六个数要能接受 `null`，显示"—"，不当 0 参与合计；渠道"无渠道"显示 `unknown` | 已改：类型六个数 `number \| null`；假后端对早于 30 天的日子给六个 null、只有 `registered` 有值（样例同时含新旧日子）。页面本来就把 null 显示成"—"、合计跳过 null（`count`、`sumCounts`），这次新增：步骤之间的转化率只在两步都有数的日子上算（`pairedRate`），否则一个只有注册数的日子会抬高"注册/下载点击"。原本就一致：渠道名按后端原样显示，`unknown` 在列表、饼图、表格里就是 `unknown`；补了页面测试 | `d439efa`：`src/services/invite/types.ts:86-106`；`src/pages/invite/numbers.ts:25-42`、`ShareFunnelTab.tsx:34-40`；`mock/_core/inviteData.ts`（`EVENT_SOURCE_DAYS`、`funnelRow`） |
| 73 | 请求参数名 `rootAccountId`；读 `truncated`，为 true 时提示只显示前 10000 个节点，总数用 `totalDescendants` | 参数名原本就一致（`src/services/invite/index.ts:41`、`FissionTab.tsx:77`、假后端 `mock/invite.mock.ts` 的 chain）；总数原本就取 `totalDescendants`（`FissionTab.tsx` 的 `total`）。已改：类型加 `truncated`；`truncated === true` 时在树上方显示提示（含 10,000 和总数）；假后端按答案截断（按层从浅到深、同一上级下按被邀请时间，最多 10000，测试里可调低），`maxDepth` 取返回节点里最深一层 | `d439efa`：`src/pages/invite/FissionTab.tsx:293-303`；`chainRules.ts`（`CHAIN_NODE_LIMIT`）；`src/locales/*/invite.ts`（`invite.chain.truncated`）；`mock/invite.mock.ts`（chain） |
| 116 | 无被邀请人时 `maxDepth` 是 0 不是 null，用 `depthDistribution` 为空或 `totalChains===0` 判断显示"—"；`stats` 的 `limit` 不传超过 200 | 已改：类型 `maxDepth: number`；页面"最深链路"在 `depthDistribution` 为空（或不是数组）或 `totalChains === 0` 时显示"—"；假后端空范围给 `maxDepth: 0`。`limit` 原本就一致：页面在点"查询"时 `isLimit` 拒绝大于 200 或小于 1 的值，不发请求（`src/pages/invite/stats.tsx:15-18,48`，页面测试 `stats.test.tsx` 里输入 201 后请求数不增加），假后端对 201 答 OUT_OF_RANGE | `d439efa`：`src/pages/invite/FissionTab.tsx:112-135`；`src/services/invite/types.ts:57-65`；`mock/invite.mock.ts`（depth-stats） |

## 没做

- 56 里"事件明细要精确到分钟，页面需要时间选择"：没有加分钟级的时间选择。这是新增页面行为（变更），要先由负责人确认；页面仍按整天的 UTC 日选择，转成整天的 ISO 时刻发给后端，后端已能接受分钟级时刻，假后端的测试覆盖了 `[from, to)` 精确到秒的含与不含。

## 没运行

- 全量测试和构建：按规则不跑，只跑了相关目录（见下）。
- 真实浏览器：从草稿目录拷贝起 `dev:mock`，Playwright Chromium 登录后看了事件汇总、事件明细（有截图）、通话列表的首次请求，请求里 `from`/`to` 是 `…T00:00:00Z`，筛选为空时不带 `name`、`inProgress`；用完已按进程号停掉。邀请页面、漏斗页面、按筛选发 `inProgress` 的请求、截断提示和已过期日子的显示只在页面测试里验证，没有在真实浏览器里看。

## 验证

- 相关目录测试（`--testTimeout=60000`）：`src/pages/{analytics,sessions,invite}`、`src/services/{analytics,sessions,invite,users}`、`src/locales`、`src/utils`、`mock/{analytics,sessions,invite,users}.mock.test.ts`、`src/pages/users/detailTabs.test.tsx`：1245 通过，1 失败。失败的是"gives a cosmetic with a reason"（头像与服装页签选不到 `outfit_blue_suit`），和会话页签无关，是别的组正在改的头像假后端造成的，不是本组的改动。
- `tsc --noEmit` 在本组路径下 0 报错（别的路径下有别的组正在改的推送测试的报错）；本组路径 `biome check` 0 诊断。提交前钩子都通过。
- 变异检查（改坏一处后相关测试应变红，已全部变红再恢复）：明细页把筛选参数改回 `eventName`（1 个测试变红）；把列改回读 `eventName`（10 个）；汇总页把 `to` 改成不加一天（7 个）；假后端把跨度判断 `>` 改成 `>=`（23 个）；把 TOO_SLOW 的 `ref` 从 `from` 改成 `to`（1 个）；失败条不加原因文字（2 个）；通话列表把 `inProgress` 改回 `ongoing`（2 个）；假后端把布尔词放宽成不分大小写（2 个）；最深链路不看 `totalChains`（1 个）；去掉截断提示（1 个）；转化率改回用合计（1 个）；假后端不标 `truncated`（1 个）。
- 与 `src/utils/settledDay.ts`、`utcDay.ts` 的协调：这两个文件没有改（`utcDay.ts` 里的 `utcDayRangeToInstants` 是现成的，这次三个埋点页面也用它）；埋点和通话列表读的是实时数据，不涉及"当天临时值"，所以不套 `settledDay`；分享统计页（读汇总表）的"当天没有行"仍由假后端的 `landedDays` 保持，没有改。

## 新的差异

写在 `docs/contract-requests/2026-11-02-new-differences-a2.md`：事件汇总和事件名最多 1000 个而页面当作全部（未改，要负责人确认）；假后端通话样例里有非 UUID 的账号编号；保存漏斗里步骤名重复的观察（不属于本组）。
