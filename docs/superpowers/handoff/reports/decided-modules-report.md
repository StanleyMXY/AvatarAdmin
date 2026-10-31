立即修未修 0、记录项 0、未运行 1、阻塞 0

未运行的一项：真实浏览器检查（Playwright 加 `npm run dev:mock`）没有做。这四条都是已有页面里的小行为变化，用假后端的页面测试覆盖；轮询、自动查询、导入后提示在真实浏览器里的观感没有看过。全量测试和构建按规则没有跑，由主会话统一跑。

区域：modules（模块行为的“采用”项，来自 `docs/superpowers/handoff/decisions-2026-10-27.md`）。分支 `claude/jolly-dirac-4pq9g6`，没有推送。

## 提交

| 事项 | 提交 |
|---|---|
| 订阅统计活跃订阅数 | 53a0d55 |
| 默认数字人生成中自动轮询 | 98b9188 |
| 选已保存的漏斗后自动查询 | 7e03e46 |
| 投放批量导入后写新增和覆盖几行 | c1edee5 |
| 本报告 | 见主会话收到的回复里的最后一个哈希 |

## 1. 订阅统计“活跃订阅数”

做了什么：卡片的值取“所选范围内最后一个有完整快照的日子”的各行相加，卡片下面写“截至 {date}（UTC）的快照，不跨日相加”。一天算有快照，要求这一天的每一行 `active` 都不是空；最后一天只有部分商品有快照时，这一天跳过，往前找最近的完整日，不显示残缺的和。范围内没有任何一天满足时显示“—”和“所选范围内没有哪一天有快照”。以前是只取最后一天，那一天有空值就整张卡片显示“—”，而今天（还没统计完）的快照在假后端里恒为空，所以默认范围下卡片常年是“—”。

文件：`src/pages/subscriptions/stats.tsx`（`activeOnLastSnapshotDay` 替换原来的 `activeOnLastDay`）、`src/locales/{zh-CN,en-US}/subscriptions.ts`（`activeHint` 换成 `activeAsOf`、`activeNone`）。

测试：`src/pages/subscriptions/stats.test.tsx` 新增四条（标出日期；最后几天无快照时取更早的完整日并标日期；最后一天部分有快照时退回完整日；范围内一天都没有时显示“—”和说明）。原有的“空值显示破折号”“有一个商品缺快照显示破折号”两条保持通过。

命令和结果：
- RED：`npx vitest run src/pages/subscriptions/stats.test.tsx`，4 failed | 11 passed，失败原因是页面没有“Snapshot of …”文字、仍显示旧提示“Of the last day, not added across days”。
- GREEN：同一命令加 `src/locales`，5 个文件 423 条全部通过。
- 变异：把完整日判断 `every` 改成 `some`，两条测试变红（部分快照退回完整日；有一个商品缺快照显示“—”），已还原。

## 2. 默认数字人“生成中”自动轮询

做了什么：列表里有任一行是 `GENERATING` 时，每 5 秒重新读一次列表；所有行都到了终态（`READY`，或回到 `DRAFT`）时停；离开页面时停；从开始轮询算起最多 5 分钟，到了就停，并在页面上方写“自动刷新已在 5 分钟后停止，请点击“刷新”再查看。”。按“刷新”或做了写操作（重新读列表）会重新开始计这 5 分钟。没有 `GENERATING` 行时不会自己读。这条提示文字是为了不让“停了”变成无声失败而加的，属于这个决定的一部分，不是另一个功能。

文件：新增 `src/pages/avatar/useGenerationPolling.ts`（间隔和上限常量、定时器及清理）；改 `src/pages/avatar/defaultAvatars.tsx`（列表请求里记下是否有生成中的行，刷新和写操作都走会重新计时的 `reload`）；`src/locales/{zh-CN,en-US}/avatar.ts` 加 `avatar.defaults.pollStopped`。

测试：新增 `src/pages/avatar/defaultAvatars.polling.test.tsx`（7 条，假时钟 `shouldAdvanceTime`）：每 5 秒读一次（4 秒内不读、5.5 秒后读一次）；生成完成后自己变成“Ready”并且不再读；失败回到草稿并显示原因同样停止；没有生成中的行时 30 秒内不读；离开页面后没有任何定时器（`vi.getTimerCount()` 为 0）也不再读；5 分钟后停、显示提示、按“刷新”后重新开始；点“生成”后该行变成生成中并自动变成“Ready”。

命令和结果：
- RED：`npx vitest run src/pages/avatar/defaultAvatars.polling.test.tsx`，6 failed | 1 passed（读次数始终为 1，没有轮询；唯一通过的是“没有生成中的行就不读”）。
- GREEN：加上 `src/pages/avatar/defaultAvatars` 和 `src/locales`，446 条通过；再加 `tests/noHardcodedText`，69 条通过。
- 变异：去掉清理函数，三条变红（含离开页面那条）；去掉 5 分钟的停止，一条变红；忽略 `generating`（一直轮询），三条变红。每次都已还原。第一次写的“离开页面”测试在去掉清理函数时仍然通过（因为表格卸载后 `reload` 调不到东西），所以补上了对定时器数量的断言。

## 3. 选已保存的漏斗后自动查询

做了什么：在“已保存的漏斗”里选一项后，把它的步骤和窗口填进表单，并立刻按当前所选的 UTC 日期范围查询；这个漏斗的步骤或窗口不合法（例如步骤里有逗号）时不查，仍显示原来的问题提示。清除选择、改步骤、改窗口、保存或另存都不会自动查（只有“选”会查）。查询用的是被选漏斗自己的值，不依赖尚未更新的状态。连续选两个，以后一次的结果为准（原来的“最新结果优先”机制保留）。“查询”按钮和重试仍按表单当前内容查，并保留“不合法不发”的检查。无 `ANALYTICS:FUNNEL_MANAGE` 的只读管理员同样会自动查。

文件：`src/pages/analytics/funnel.tsx`（`query` 可以带入要查的内容，新增 `ask`）。

测试：`src/pages/analytics/funnel.test.tsx`：原来的“选了之后不自己查”改成“选了就查，且带着表单里的步骤、窗口和日期”；新增五条（自定义漏斗和只读管理员也会查；每选一个查一次，清除选择、改步骤、改窗口不查；步骤里有逗号的已保存漏斗不查并说明原因；另存不查）。原来先选再点“查询”的七条测试按新行为改成不再点“查询”（选漏斗那一步已经查了）；“被拒绝后显示文字和重试”“最新结果优先”两条也改成由选择触发。

命令和结果：
- RED：`npx vitest run src/pages/analytics/funnel.test.tsx -t "saved funnels"`，4 failed | 13 passed | 13 skipped（`expected [] to have a length of 1 but got +0`，即选了漏斗没有查询）。
- GREEN：`npx vitest run src/pages/analytics`，4 个文件 64 条通过；提交前再跑 funnel 测试 30 条通过。
- 变异：把“合法才查”的判断改成恒真，两条变红；把自动查询调用去掉，十一条变红。已还原。
- 提交钩子第一次因 `funnelCalls` 的参数类型报类型错误，改成 `{ url: string }[]` 后通过。

## 4. 投放批量导入后写“新增几行、覆盖几行”

做了什么：导入成功后，提示写“已导入 n 行：新增 a 行，覆盖 m 行”。数字来自后端的响应，页面不自己去数（自己数需要把范围内所有已有成本读出来，数量没有上限，而且读和写之间别人可能改过，结果不可靠）。契约没有写批量接口的响应，所以暂定响应为 `{ "imported": n, "overwritten": m }`（`imported` 是写入的行数，其中 `m` 行覆盖了原来的花费，新增的是 `n - m`）。假后端本来就是这个形状。响应缺这两个数、不是整数、为负、或覆盖数大于写入数时，提示退回“已导入 n 行”（n 是自己提交的行数）。真后端在给出这两个数之前，用户看到的是原来的提示；这一点写进了问题文件，不是阻塞。

文件：`src/services/campaign/index.ts`（`batchCosts` 解析并校验响应，返回 `{imported, overwritten}` 或 null）、`src/services/campaign/types.ts`（`BatchCostsResult`）、`src/pages/campaign/BatchModal.tsx`、`src/locales/{zh-CN,en-US}/campaign.ts`（`campaign.batch.importedSplit`）、`docs/contract-requests/2026-10-26-admin-frontend-campaign.md` 第三节第 5 条（写明暂定响应形状并请后端确认字段名）。

测试：`src/services/campaign/campaign.test.ts`（两条：给出计数时原样返回；缺失、字符串、覆盖数大于写入数、负数、小数、null 时返回 null）；`src/pages/campaign/accounts.batch.test.tsx`（原有成功提示改成“Imported 3 rows: 3 added, 0 overwritten”；新增“5 行里 2 行覆盖已有成本，写 3 added, 2 overwritten”；后端响应没有计数时只写“Imported 2 rows”且没有“overwritten”字样）；`mock/campaign.mock.test.ts` 加上对假后端响应 `{imported: 2, overwritten: 1}` 的断言。

命令和结果：
- RED：`npx vitest run src/services/campaign/campaign.test.ts src/pages/campaign/accounts.batch.test.tsx`，3 failed | 41 passed（找不到“Imported 3 rows: 3 added, 0 overwritten”；`expected {} to be null`）。
- GREEN：`npx vitest run src/services/campaign src/pages/campaign mock/campaign.mock.test.ts src/locales`，17 个文件 693 条通过。
- 变异：把 `added` 改成 `done.overwritten`，“新增几行、覆盖几行”那条变红；去掉“覆盖数大于写入数”的检查，服务测试变红。已还原。
- 提交钩子第一次报 `BatchCostsResult` 没有导入，补上后通过。

## 覆盖的语言
假数据仍含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文（沿用各自的假后端）。这四条的文字检查用的是 en-US 页面渲染；zh-CN 只通过键齐全和占位符一致的 parity 测试（`src/locales`）核对，没有渲染 zh-CN 页面看过。

## 发现的新问题
- 契约缺口（不是阻塞）：批量成本接口的响应字段没有定义。已写进 `docs/contract-requests/2026-10-26-admin-frontend-campaign.md` 第三节第 5 条，请后端确认 `imported`、`overwritten` 这两个字段名，或给出真实的名字。
- 没有新的缺陷。

## 需要改共享文件
无。

## 规格需要在 main 上修改的地方
无。规格 5.0 里订阅统计、默认数字人、漏斗分析、批量录入的描述没有写这四条行为；若要写进规格，正本在 AvatarApp 的 main，由负责人决定谁改。

## 设计点说明（供确认，不阻塞）
- “有快照的日子”按“这一天所有行都有 `active`”判断；若更想要“这一天有任意一行有快照”，只需把 `every` 改成 `some`（会让部分商品缺快照的日子也被计入，和可能偏小）。
- 轮询 5 分钟的起点是第一次读到生成中；按“刷新”或做写操作会重新计 5 分钟。
