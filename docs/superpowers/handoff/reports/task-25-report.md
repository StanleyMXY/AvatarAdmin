立即修未修 0、记录项 5、未运行 3、阻塞 0。

# 任务 25 报告：投放管理

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：`b0f606c`（服务、假后端、投放效果、投放账户与成本、归因参数、文字、测试）、`5cb7bfe`（归因明细、四条路由）、`ec8d1dc`（一条测试）、`a1767f2`（评审自查后的两处修正、问题文件）、`98347a8`（浏览器检查后的修正）、本报告所在的提交。本模块 13 个测试文件加 1 个文字检查共 293 个测试全部通过；`npx biome check` 和 `npx tsc --noEmit` 对本模块路径没有报错。没有 `hardcodedText.allow.json`（文字扫描没有需要放行的条目）。

## 做了什么

四个页面，路由取规格 5.0"投放管理"四行：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/campaign/stats` 投放效果 | `ATTRIBUTION:VIEW` | 日期范围（默认最近 7 个 UTC 日）、投放账户筛选；一张折线图（访问量、点击数、安装数、注册数四条线，补零）、按投放账户的汇总表（列和顺序同规格：编码、名称、访问量、点击数、点击率、安装数、注册数、安装率、注册转化率、总花费、CPA、CPI；最后一行"未归因"，写安装数和它占（匹配安装加未归因安装）的比例）、按日明细表（每页 20 行）；分母为 0 或有负数一律"—"；落地条 `attribution-daily`；导出 `attribution-performance`；顶部可关闭的"如何阅读此报表"（关闭状态记在 `localStorage`）；说明今天是临时值（文字与总览相同，取同一个键） |
| `/campaign/accounts` 投放账户与成本 | `ATTRIBUTION:MANAGE` | 两个页签。投放账户：列表（编码可复制、名称、渠道包标签、三个像素"已配置"悬浮看编号、状态开关立即提交无二次确认、创建时间、编辑和生成链接，没有删除）；搜索关键字和状态；创建和编辑弹窗（宽 640，三个分区；编码创建后只读；Facebook 访问令牌输入框永远是空的，已设置只写"已设置"，留空时请求体不含该字段）；生成链接弹窗（宽 640，平台单选、三个 UTM 值、没有像素编号时提示且不发请求、链接加复制按钮、落地页接口地址、链接根地址未配置的提示）。投放成本：筛选投放账户和日期（默认最近 30 个 UTC 日）、列表（两位小数、币种、录入者）、录入花费（宽 480，投放账户和日期编辑时只读，默认今天的 UTC 日，币种只读）、行内确认的删除、批量录入（宽 720，JSON 和 CSV 两个页签，在浏览器里解析、整批拒绝、按行说明、模板下载 `attribution-cost-template.csv`、从一开始就写明"已存在的日期会被覆盖"） |
| `/campaign/attribution` 归因明细 | `ATTRIBUTION:VIEW` | 三个页签。点击明细（时间范围、投放账户、状态、关键字；IP 原样显示；注明保留天数和直装渠道非 Android 的下载点击不记录）；安装与注册（来源、匹配方式、时间；22 列，指纹兜底标"可信度较低"，账号跳用户详情，不显示设备和平台标识）；汇总（按来源、媒体来源、campaign；两个来源分列；成本按币种写"USD 12.30 / EUR 4.00"；条形图；说明没有 ROI、激活数会偏低） |
| `/campaign/settings` 归因参数 | `ATTRIBUTION:MANAGE` | 匹配顺序说明加 `<ConfigForm editPermission="ATTRIBUTION:MANAGE" />`，浏览器里看到 9 个键 |

文件：
- 服务：`src/services/campaign/{index,types,parseCostBatch}.ts` 和两个测试。`parseCostBatch` 的签名按任务书，另加一个可选的第二个参数（见"与任务书的出入"）。
- 页面：`src/pages/campaign/` 下 `stats`、`accounts`、`attribution`、`settings`；`CampaignsTab`、`CampaignModal`、`LinkModal`、`CostsTab`、`CostModal`、`BatchModal`、`ClicksTab`、`RecordsTab`、`SummaryTab`；共用的 `CampaignSelect`、`useCampaigns`、`useServerPage`、`useRead`、`PagedTable`、`FailureBar`、`HeaderTip`、`StatusSwitch`、`AccountLink`、`figures`（比率、金额、成本文字）、`costTemplate`、`links`、`texts`、`formFailure`；测试和 `testSetup`。
- 假后端：`mock/campaign.mock.ts`、`mock/campaign.mock.test.ts`、`mock/_core/campaignData.ts`（七个投放账户：泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文名称；一个备注是 300 个字符没有空格；一个停用且没有流量的账户用来出现分母为 0；点击、记录、成本）。投放账户、成本、点击、记录、汇总、效果、批量都按契约；账户的令牌假后端存着但任何回复都不带。
- 路由和文字：`config/routes/campaign.ts`、`config/routes/campaign.test.ts`、`src/locales/{zh-CN,en-US}/campaign.ts`（280 个键，两边相同）。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-campaign.md`。

## 与任务书和规格的出入

1. `parseCostBatch(input)` 要检查 `attribution.cost_batch_max` 和 `attribution.cost_currency`，这两个值不在输入里，所以加了可选的第二个参数 `{ maxRows, currency }`；只传一个参数时不检查这两项。返回的 `errors` 里 `reason` 是原因码（`AMOUNT_NEGATIVE` 等，页面有译文），`line` 是文本里的行号（CSV 表头是第 1 行；JSON 数组是第几项），0 表示整个文本；多出一个可选的 `values` 供译文填空。
2. 页面自己加了两条保护：CSV 文件超过 5 MB 不读；金额整数位超过 13 位拒绝（JSON 数不丢精度）。已写进问题文件，等后端意见。
3. 规格写"未归因"行显示"当天"的安装数；契约的按日行没有写 `unattributedInstalls`，页面只在按投放账户的表里显示未归因行（写进问题文件）。
4. 导出 `attribution-performance` 发 `from`、`to`、`campaignId`（选了才发）、`groupBy=campaign`（契约没写导出的 `groupBy`，写进问题文件）。
5. 只有 `ATTRIBUTION:VIEW` 的管理员读不到 `attribution.cost_currency`（`GET /config` 只给有权编辑的键），投放效果表头不写币种（写进问题文件，请求在 `GET /meta` 里加一项）。
6. 状态开关发整条 `PUT`（契约没写 `PUT` 是整条替换还是只改带来的字段），创建时发 `enabled: true`。
7. 点击明细的 `from`、`to` 和归因明细的一样用 UTC 日变成的 ISO-8601 时刻（契约只写了参数名）。

## 红到绿

每一块都先写测试，在实现不存在时确认因"功能不存在"而失败，再实现，再跑绿。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task25/` 的 `red-*.txt`、`green-*.txt`。

| 文件 | 红 | 绿 |
|---|---|---|
| `src/services/campaign/parseCostBatch.test.ts` | `Failed to resolve import "./parseCostBatch"` | 27 个 |
| `src/services/campaign/campaign.test.ts` | `Failed to resolve import "./index"`（移走实现后） | 13 个 |
| `mock/campaign.mock.test.ts` | `Failed to resolve import "./_core/campaignData"` | 50 个 |
| `config/routes/campaign.test.ts` | 路由数组为空，15 个断言失败 | 15 个 |
| `src/pages/campaign/figures.test.ts` | `Failed to resolve import "./figures"` | 16 个 |
| `settings.test.tsx` | `Failed to resolve import "./settings"` | 4 个 |
| `stats.test.tsx` | `Failed to resolve import "./stats"`（移走实现后） | 24 个 |
| `accounts.campaigns.test.tsx` | `Failed to resolve import "./accounts"` | 41 个 |
| `accounts.costs.test.tsx` | 25 个失败（钱的页签还是空的） | 28 个 |
| `accounts.batch.test.tsx` | 23 个失败（对话框还是空的） | 25 个 |
| `attribution.clicks/records/summary.test.tsx` | 三个都是 `Failed to resolve import "./attribution"` | 20、13、14 个 |
| `messages.test.ts` | 浏览器里发现的问题：旧的 JSON 示例文字 `[{"campaignCode": …}]` 里的花括号让 `react-intl` 解析失败（见下面） | 3 个 |

## 真实浏览器检查

Playwright（Chromium，浏览器时区 `Pacific/Auckland`，本地日期 2026-10-27，UTC 日 2026-10-26）对着 `PORT=8325` 的 `npm run dev:mock`，在 `scratchpad/task25/app` 的一份拷贝里跑（拷贝里的 `config/config.ts` 关了 MFSU、换了缓存目录；`node_modules` 是链接；`src/.umi` 一起复制；没有路由文件需要清空）。脚本 `t25-browser.cjs`、日志 `t25-browser.log`、截图 `t25-*.png`（在同一目录）。服务按监听进程的 PID（21348，检查了它的工作目录是我的拷贝）停掉，端口 8325 已空。看到的：

- 菜单：投放管理下四个页面；每页的列、顺序、路由权限都对（日志里有每页的列）。
- 投放效果：请求是 `from=2026-10-20&to=2026-10-26`（UTC 日，不是本地的 10-27）；一张图四条线；七个投放账户加"未归因"行（份额 4%）；停用账户一行 0、0、"—"；"如何阅读"关闭后重载仍关闭；重新落地发 `POST /stats/land/attribution-daily?date=2026-10-25`；导出保存为 `attribution-performance-2026-10-20-2026-10-26.xlsx`。
- 归因参数：9 个键；写 `http://…` 时提示必须以 https 开头；保存发 `PUT /config/attribution.link_base_url`。
- 投放账户：坏编码提示且不发请求；新建带 5 个泰语、阿拉伯语、emoji 的长名称；编辑时令牌框是空的、显示"已设置"、整个页面的 HTML 里没有令牌；编辑的请求没有 `code` 也没有令牌；开关发 `PUT` 且不带令牌；生成链接：Google 没有像素时提示、没有 `/link` 请求；Facebook 得到 `https://go.example.com/go/spring_th?utm_source=facebook&utm_medium=cpc&utm_campaign=spring_2026`，复制到剪贴板的就是它，落地页接口地址是 `POST https://go.example.com/api/attribution/click`。
- 投放成本：默认日期范围是 UTC 的最近 30 天（`2026-09-27` 至 `2026-10-26`）；录入对话框的默认日期是 UTC 日 2026-10-26（本地是 10-27）；`12.345` 被拒绝；5000 个泰文字符的备注页面没有横向滚动；同一投放账户同一天再录得到"A cost already exists … Edit it instead."（只显示译文）；编辑时投放账户和日期只读；行内确认后 `DELETE`。
- 批量：弹窗一打开（还没输入）就写着覆盖提示，导入按钮是灰的；坏行逐行列出（第 2 行三个问题）；选 CSV 文件（带字节序标记、CRLF、带逗号的泰语和阿拉伯语备注）后没有任何写请求，按"导入"之后只有一个 `POST /attribution/costs/batch`；模板下载为 `attribution-cost-template.csv`（带标记，表头加两行，第二行备注带引号）；后端拒绝的一批（不存在的编码）逐条显示"0.campaignCode: …"。
- 归因明细：三个页签的列、请求（点击和记录用 `2026-10-20T00:00:00Z` 至 `2026-10-27T00:00:00Z`，汇总用 `2026-10-20` 至 `2026-10-26`）都对；三条指纹记录有标记；汇总有一张条形图，换成"媒体来源"后多一列。
- 390 像素宽：四个页面没有页面级横向滚动。中文：表头和说明都是中文。
- 控制台：除登录第一步的 401、我故意触发的 409 和 400 外没有错误。**发现并已修一个缺陷**：批量弹窗 JSON 框的示例文字里有 `{`、`}`，`react-intl` 当占位符解析失败（控制台报 `SyntaxError`，用原文兜底，页面看起来没坏，所以单元测试没发现）。已改成转义的写法，并加了 `messages.test.ts`：两种语言每一条文字都能解析并填空。

## 变异检查

每个变异改一处判断，只跑相关测试，确认变红后恢复（脚本 `t25-mutate.py`，日志 `mutations-run1.log`、`-run2.log`、`-run3.log`）。第一轮有三个变异因改坏了语法而没有真正运行，一个测试没拦住的（汇总的旧答案）和两个两次按键的变异没拦住，都改了测试后重跑变红。

| # | 变异 | 结果 |
|---|---|---|
| 1 | parse: a bad row no longer empties the batch | 变红：5 failed，22 passed (27) |
| 2 | parse: the same campaign and day twice is allowed | 变红：1 failed，26 passed (27) |
| 3 | parse: the currency is not checked | 变红：1 failed，26 passed (27) |
| 4 | parse: one row more than the limit is allowed | 变红：1 failed，26 passed (27) |
| 5 | parse: a day that does not exist is accepted | 变红：2 failed，25 passed (27) |
| 6 | parse: the byte order mark is not removed | 变红：1 failed，26 passed (27) |
| 7 | parse: quotes are ordinary characters | 变红：4 failed，23 passed (27) |
| 8 | parse: a negative amount is accepted | 变红：6 failed，21 passed (27) |
| 9 | figures: a rate with a denominator of 0 is worked out | 变红：2 failed，14 passed (16) |
| 10 | figures: a cost per unit with a count of 0 is worked out | 变红：2 failed，14 passed (16) |
| 11 | figures: costs of two currencies are cut to the first | 变红：1 failed，15 passed (16) |
| 12 | campaign form: an empty token box sends an empty token | 变红：1 failed，6 passed，33 skipped (40) |
| 13 | campaign form: the token box is filled from what the backend sent | 变红：1 failed，39 skipped (40) |
| 14 | campaign form: the code is not checked | 变红：1 failed，39 skipped (40) |
| 15 | campaign form: a code that exists is not caught | 变红：1 failed，41 skipped (42) |
| 16 | campaigns: the new button is shown to everyone | 变红：1 failed，41 skipped (42) |
| 17 | campaigns: the switch is not blocked without the permission | 变红：1 failed，39 skipped (40) |
| 18 | switch: two clicks send two requests | 变红：1 failed，39 skipped (40) |
| 19 | campaign form: two presses send two requests | 变红：1 failed，1 passed，39 skipped (41) |
| 20 | link: no pixel number still asks the backend | 变红：1 failed，39 skipped (40) |
| 21 | link: generating is allowed without a link root | 变红：1 failed，39 skipped (40) |
| 22 | cost form: the amount is not checked | 变红：1 failed，26 skipped (27) |
| 23 | cost form: today is the local date | 变红：1 failed，26 skipped (27) |
| 24 | cost form: two presses send two requests | 变红：2 failed，26 skipped (28) |
| 25 | batch: Import is enabled for an empty batch | 变红：3 failed，9 passed，13 skipped (25) |
| 26 | batch: the overwrite warning is gone | 变红：1 failed，24 skipped (25) |
| 27 | batch: two presses send two requests | 变红：1 failed，24 skipped (25) |
| 28 | batch: the file is not size-checked | 变红：1 failed，24 skipped (25) |
| 29 | stats: an old answer replaces a newer one | 变红：1 failed，23 skipped (24) |
| 30 | stats: the export is shown without STATS:EXPORT | 变红：1 failed，23 skipped (24) |
| 31 | stats: a zero denominator is no longer a dash (page) | 变红：1 failed，23 skipped (24) |
| 32 | lists: an old page replaces a newer one (clicks) | 变红：1 failed，18 skipped (19) |
| 33 | summary: an old answer replaces a newer one | 变红：1 failed，13 skipped (14) |
| 34 | clicks: the address is changed by the page | 变红：1 failed，18 skipped (19) |
| 35 | clicks: the days are sent as days, not as instants | 变红：1 failed，18 skipped (19) |
| 36 | records: the day after the last day is not the end | 变红：1 failed，12 skipped (13) |
| 37 | records: the fingerprint is not marked | 变红：1 failed，12 skipped (13) |
| 38 | route: the accounts page needs only ATTRIBUTION:VIEW | 变红：4 failed，11 passed (15) |
| 39 | mock: a campaign answer carries the token | 变红：2 failed，48 passed (50) |
| 40 | mock: a cost for a pair that exists overwrites instead of 409 | 变红：1 failed，49 passed (50) |
| 41 | mock: the batch is not all or nothing | 变红：2 failed，48 passed (50) |
| 42 | mock: the address is not masked | 变红：1 failed，49 passed (50) |
| 43 | clicks: Search with the same filters does not read again | 变红：1 failed，19 skipped (20) |
| 44 | link: an answer for changed fields is shown | 变红：1 failed，41 skipped (42) |
| 45 | costs: Search with the same filters does not read again | 变红：1 failed，27 skipped (28) |

还有一个变异没有意义：链接弹窗里"回车时没有链接根地址不发请求"的判断。弹窗里没有提交按钮，回车不会提交，这个判断到不了，已经连同它的测试一起删掉。

## 覆盖的语言

界面只有 zh-CN 和 en-US，每个页面都有中文的测试。假数据和测试含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文、emoji 和 5000 字符无空格串（投放账户名称、成本备注、归因名称、汇总的键、批量备注）。

## 问题文件清单

- `docs/contract-requests/2026-10-26-admin-frontend-campaign.md`：效果的行字段和数的类型、未归因行、导出的参数、只有查看权限的管理员读不到成本币种；投放账户的 `PUT` 语义、创建时的 `enabled`、重复编码的错误、怎样清除令牌、链接的两种 400 怎样区分、落地页接口地址；成本的行和请求体、批量的响应和 `details` 的格式、页面的两条保护；点击明细的时间参数、汇总的 `key`。没有一处是阻塞。

## 需要改共享文件的地方

1. `src/pages/config/ConfigRow.tsx` 第 72 到 73 行：保存失败时对没有字段明细的 `INVALID_REQUEST`，把后端的 `message` 接在译文后面显示，与"错误码已知时只显示译文"的决定不一致；归因参数页（和所有放 `<ConfigForm>` 的页面）受影响。改法：只显示 `text`。
2. 没有别的。

## 规格需要在 main 上修改的地方

1. 5.0 的 `/campaign/stats` 行的接口栏只写了 `/attribution/performance`；页面还用 `GET /attribution/campaigns`（契约 §17.4 通则第 5 条已对 `ATTRIBUTION:VIEW` 开放读取）和 `GET /config`（读成本币种）。
2. 5.13 的点击明细"关键字（IP 或 UTM）"：契约写完整 IP 的精确匹配只在持有 `ANALYTICS:IP_VIEW` 时生效，否则忽略；请在规格里写上（页面已按此写了说明）。

## 记录项（5 项，建议全部修）

1. `src/pages/config/ConfigRow.tsx:72`，见上面"需要改共享文件"。触发：归因参数页保存一个没有字段明细的错误值（例如 `attribution.cost_currency` 写成不合法的值而后端只回 `INVALID_REQUEST`）；错误结果：除译文外还显示后端的英文 `message`。
2. 本模块有五份本地副本，做的是共用的事：`useRead.ts`（`pages/invite/useRead.ts` 同样的做法）、`StatusSwitch.tsx`（`pages/push/EnabledSwitch.tsx`）、`HeaderTip.tsx`（`pages/push/stats.tsx` 里的同名内部函数）、`formFailure.ts`（`pages/push/formFailure.ts`）、`texts.ts`（`pages/push/texts.ts`）。触发：以后共用的行为（比如失败文字、开关的处理）改了，副本不会跟着变。建议：移到 `src/hooks`、`src/components` 后删副本（只有地基任务能改那里）。
3. `src/pages/campaign/accounts.tsx:27`（和 `attribution.tsx:25`）：页签用 `destroyOnHidden`，切到另一个页签再切回来，投放成本的筛选条件回到默认值，要重新选。原因：不卸载时，两个表格同时在页面里，测试进程内存涨到 1.7 GB 后崩溃，也让投放成本页的元素查询取到另一个页签的行。后果：不是错误结果，是要重新选一次。
4. `src/pages/campaign/stats.tsx:176`：汇总表里"未归因"行安装数下面的占比说明写在一格里，把"安装数"这一列撑宽到 220 像素（截图 `t25-stats2.png`）。不是错误结果。
5. `src/locales/{zh-CN,en-US}/campaign.ts`：来源的文字里写了契约枚举 `APPSFLYER`、`SELF`（"第三方回传（APPSFLYER）"），平台名 Facebook、Google、TikTok 也在文字里（规格 5.13 用了这些词）。`CLAUDE.md` 说仓库里不出现第三方产品名；这些是契约的枚举值和规格的用词，我没有换，需要负责人判断要不要换成中性的说法。

## 变更候选

- 投放账户的"清除令牌"操作（需要后端支持，见问题文件）。
- 批量导入成功后在提示里写"新增几行、覆盖几行"（需要后端在响应里给出）。

## 未运行（3）

- 全量测试和构建（按规则最后一起跑）。仓库里别的任务的未完成文件让 `tests/noHardcodedText.test.ts` 和 `src/locales/parity.test.ts` 现在有红（`mock/cost.mock.test.ts` 里的不可见字符、成本模块的文字键），不是本模块的。
- Firefox、Safari、真机手机；真正的 Microsoft Excel 打开模板（带字节序标记）和真的 `.xlsx` 导出（假后端只有样例文件）；夏令时跨午夜的时区。
- 对着真后端（后端的响应字段、批量失败的 `details` 格式见问题文件，本模块是按假后端和契约做的）。
