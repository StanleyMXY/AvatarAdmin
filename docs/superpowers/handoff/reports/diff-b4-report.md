改了 1 处、没做 0 处、没运行 1 项、阻塞 0（条目 7 一处；立即修未修 0、记录项 0；没运行的 1 项是全量测试，按规则只在全部任务做完后跑一次）

# 组 b4 报告：第二节条目 7（投放管理的筛选与 groupBy）

提交：`c909233`（代码、假后端、测试、语言文件、计划片段、问题文件同一个提交）。

## 先说发现

负责人说“计划里没有这些筛选”，但页面和类型里**已经有**：投放账户列表有“关键字”和“状态”（`CampaignsTab.tsx`，放在 `PagedListTable` 的筛选列里，并带 `initial`/`onCommit` 保留搜索与页码），点击明细有“状态”和“关键字”（`ClicksTab.tsx`），汇总的 `groupBy` 只发三个合法取值，假后端的汇总对缺失和不对的取值已答 400。所以这一条实际要补的是新版接口文档比现状多出来的约束和假后端与文档的出入，不是新建筛选。`PagedListTable` 一行没改。

## 表

| 条目 | 新版接口文档怎么说（行号） | 状态 | 提交与位置 |
|---|---|---|---|
| 7a 投放账户列表 `keyword`（对 `code`、`name` 不区分大小写包含匹配，`%`、`_`、`\` 按字面，最多 100 个码点）、`enabled`（`true`/`false`，其他 400） | 第 1530 行；权限表第 2388 行 | 已改。页面的关键字与状态筛选原本就有（证据：`CampaignsTab.tsx` 的 `keyword` 列与 `enabled` 列，`accounts.campaigns.test.tsx` 里 “the search” 两个原有测试）；新增：输入框按码点限 100（表情算一个、粘贴超长截断且不切开代理对）；假后端原来把 `code` 与 `name` 连成一个字符串再匹配（“cd zz” 这样跨两个字段的词会误中），改成各自匹配；超过 100 个码点答 400 `keyword`/`TOO_LONG`；`enabled` 不合法答 400 `enabled`/`NOT_BOOLEAN`（后者原本就有，补了测试） | c909233：`src/pages/campaign/keywordLimit.ts`、`CampaignsTab.tsx:21,112`、`mock/campaign.mock.ts:44,357`（匹配在其后）；测试 `mock/campaign.mock.test.ts`（两个新测试加“state”测试）、`accounts.campaigns.test.tsx`（两个新测试） |
| 7b 点击明细 `status`（`PENDING`/`MATCHED`/`EXPIRED`）、`keyword`（最多 200 字符；UTM 来源、媒介、活动上不区分大小写字面包含；持有 `ANALYTICS:IP_VIEW` 才匹配完整 IP；含 U+0000 是 400 `keyword`/`INVALID_FORMAT`）；持有 `attrId` 的记录让点击也是 `MATCHED`，所以会出现在 `PENDING` 筛选下 | 第 1486 行；第 2388 行；第 2467 行 | 已改。两个筛选原本就有（证据：`ClicksTab.tsx` 的 `status` 选择与 `keyword` 输入，`attribution.clicks.test.tsx` 原有的查询参数测试）；新增：关键字输入限 200 个码点；筛选旁加一句说明（`campaign.clicks.status.note`，中英文）；假后端原来把三个 UTM 连成一个字符串再匹配，改成各自匹配，超过 200 个码点答 400 `TOO_LONG`，含 U+0000 答 400 `INVALID_FORMAT`；页面遇到这个 400 只显示按码翻译的文字、不显示后端 `message`，并能用“重试”恢复（新测试） | c909233：`ClicksTab.tsx:22,160,209`、`mock/campaign.mock.ts:45,697,700`；`src/locales/{en-US,zh-CN}/campaign.ts`（`campaign.clicks.status.note`）；测试 `attribution.clicks.test.tsx`（三个新测试）、`mock/campaign.mock.test.ts`（两个新测试） |
| 7c 归因汇总 `groupBy` 缺失或取值不对是 400 | 第 1487 行 | 原本就一致，补了页面测试。证据：假后端 `mock/campaign.mock.ts` 汇总处理里缺失答 `EMPTY_NOT_ALLOWED`、不对答 `OUT_OF_RANGE`，`mock/campaign.mock.test.ts` “needs groupBy” 原有；页面只发三个合法值（`SummaryTab.tsx` 的 `Radio.Group`），遇到这个 400 走 `FailureBar`，显示 `INVALID_REQUEST` 按码翻译的文字。新增页面测试三例（缺失/取值不对，中英文）确认只显示码的文字、不含后端 `message` | c909233：`attribution.summary.test.tsx`（`it.each` 三例） |

## 假设与问题文件

新版文档没写：账户关键字超长和 `enabled` 不合法时 400 的 `details`；点击关键字“字符”是码点还是 UTF-16 单位以及超长时的 `reason`；汇总 `groupBy` 的 400 的 `details`。前端按最小做法（上面写的 `TOO_LONG`、`NOT_BOOLEAN`、`EMPTY_NOT_ALLOWED`、`OUT_OF_RANGE`，都在 1.4 的清单里）开发，页面不依赖这些原因码。写在 `docs/contract-requests/2026-11-02-new-differences-b4.md`（4 条）。

## 验证

- 先红后绿：假后端 4 个新测试在改假后端之前失败（跨字段误中、两处超长、U+0000 都答 200），改后通过；页面的两个输入限制测试在加 `count` 之前失败（输入框里是 120/220 个码点），改后通过。
- 变异检查（假后端）：账户上限改 101、点击上限改 201、账户超长判断改成按 UTF-16 单位、去掉 U+0000 判断，各让一个测试失败；已还原。
- 命令：`npx vitest run src/pages/campaign/accounts.campaigns.test.tsx src/pages/campaign/attribution.clicks.test.tsx src/pages/campaign/attribution.summary.test.tsx mock/campaign.mock.test.ts --testTimeout=60000` 共 4 个文件 160 个测试全部通过；`src/locales` 加 `tests/noHardcodedText.test.ts` 通过，但 `src/locales/parity.test.ts` 有 2 个失败，原因是别的组新增的配置键还没有名称和说明（与本组文件无关）。
- `npx biome check`（campaign 相关路径）0 诊断；`npx tsc --noEmit` 在 campaign 路径下 0 报错；提交钩子通过。
- 真实浏览器（Playwright Chromium，从草稿目录拷贝起 `max dev`，用完按进程号停）：在投放账户页输入 70 个泰文字母加 60 个表情，输入框剩 100 个码点；搜索 SPRING 得 2 行，换到成本页签再回来输入框仍是 SPRING；点击明细页输入 150 个泰文字母加 120 个表情，剩 200 个码点；关键字含 U+0000 时页面显示“Failed to load: Some input is not valid…”加“Retry”，没有后端原话。
- 计划：只在任务 25 的测试段落加了一条“列表与明细的筛选”，用 `git apply --cached` 只暂存了这一个片段。

## 没运行

1 项：全量测试和构建（规则：全部任务做完后跑一次）。
