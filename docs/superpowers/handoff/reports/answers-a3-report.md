改了 10 处、没做 1 处、没运行 2 项、阻塞 0

（改了 10 处 = 负责的 10 个编号各一处；没做 1 处 = 第 75 条 (f) 的批量一半；没运行 2 项 = 真实浏览器检查（Playwright）、全量测试和构建；立即修未修 0、记录项 0。）

组号 a3，分支 `claude/jolly-dirac-4pq9g6`，没有推送，没有开拉取请求。后端的"改动请求"（第二、三节）没有当作已存在：第 75 条的 `overwritten`、第 111 条的 `details` 都按后端现在的行为做。第四节的两条（38、30）按保守做法：解析仍容忍字符串形式的数，但不依赖。

## 一张表

| 编号 | 答案要求前端改什么 | 状态 | 提交与位置 |
|---|---|---|---|
| 28 | `PUT /subscription-products` 请求体写成 `{"items":[那一条]}`；成功 `data` 为 `null`，要重新 `GET`；`entitlementKey` 不存在是 404 不是 400 | 已改。服务发 `{items:[one]}`，返回 `null`；两处调用（开关、对话框）成功后本来就重新读列表，加了页面测试证明读了第二次；假后端按后端：六项都必填、`surfaces` 缺失是 400 `EMPTY_NOT_ALLOWED`、同一请求里同一商品出现两次是 409 `DUPLICATE_RESOURCE` 且 `data.field` 为 `productId`、整个请求要么全存要么全不存、未知权益 404。`surfaces` 的类型和假数据原先是字符串，契约是 `{platform, channel}` 对象，一并改正（见新差异文件第 5 条） | `52af391`；`src/services/subscriptions/index.ts:134`，`mock/subscriptions.mock.ts:500`，`src/pages/subscriptions/products.tsx:111`，`src/services/subscriptions/types.ts:99-109` |
| 30 | 没有 `PUT /credit-products/{id}`，改 `PUT /credit-products`，体带六项；GET 行没有 id，以 `(store, productId)` 作行标识；`surfaces` 必须带；读这个页面要 `SUBSCRIPTION:CONFIG`；"保存前重读比较"仍可用 | 已改（前三项）；第四项读权限原本就一致（路由 `config/routes/credits.ts:12` 的 `access: 'SUBSCRIPTION:CONFIG'`，假后端 GET 的 guard 也是它，`mock/credits.mock.test.ts` 的权限用例里 `support` 读 GET 得 403）；保存前重读比较保留并改为按 (store, productId) 找那一行。列表只读一次（后端没有 `total`、不分页，原来的"读到取够"循环删掉）。假后端没有 id、六项必填、`credits` 1 到 1000000000、404 | `78237b1`；`src/services/credits/index.ts:27,36,50`，`mock/credits.mock.ts:183`，`src/pages/credits/freshPack.ts:25`，`src/pages/credits/products.tsx`（`rowKey`），`src/pages/credits/ProductModal.tsx`（回传 `pack.surfaces`） |
| 38 | `campaignId` 按数处理；直接用行里的 `campaignCode`、`campaignName`；按日分组也有最后一行未归因行，用 `unattributedInstalls` 识别并显示；`cost/cpa/cpi` 是数；导出可发 `groupBy=day` | 已改。（a）类型改为数，`isUnattributedRow` 按 `campaignId === 0`，也读 "0"（不依赖）、按日时按"没有日期和投放账户但有 `unattributedInstalls`"识别；（b）行里的编码和名称优先，列表和 id 只作回退（原代码就是这个顺序，加了页面测试，列表被拒 403 时仍显示行里的名称）；（c）日表末尾显示"未归因"行（计数是整个范围的，提示说明后端不按天拆），不进图；（d）类型改数，`numberOf` 仍容忍字符串（第四节保守）；（e）加了"导出的分组"选择（按投放账户/按日），导出带所选的 `groupBy`。假后端发数、按日分组也在最后加未归因行、选了投放账户时两种都没有 | `eb69443`；`src/pages/campaign/stats.tsx:68,327,363`，`src/pages/campaign/figures.ts:94`，`src/services/campaign/types.ts:125`，`mock/campaign.mock.ts:642` |
| 75 | 成功读 `count`、提示写"已导入 n 行（已存在的日期被覆盖）"；`details` 的 `index` 独立、`ref` 是字段名，显示"第 N 行"用 `index+1`；未知编码 `NOT_FOUND`、批内重复 `DUPLICATE` 每个重复行一项；补 `NEGATIVE`、`TOO_MANY_DECIMALS` 译文；成本行直接用 `campaignCode/campaignName`；不带 `currency` 可以 | 已改（a 到 e），(f) 一半：单条成本弹窗读不到币种时本来就不发 `currency`（`src/pages/campaign/CostModal.tsx` 的 `...(currency === null ? {} : { currency })`，原本就一致），假后端也接受不带；批量行里币种仍是必填列（见"没做"）。服务 `batchCosts` 读 `{count}`，不再认 `{imported, overwritten}`；请求层 `ErrorDetail` 增加 `index`（整数从 0 起才保留）；对话框把拒绝写成"第 N 行，字段：原因"，整批问题没有行号只写"整批：…"，没有译文的码显示码本身，不显示后端 message；译文放模块自己的语言文件（共用的 `reason.*` 有"只能是契约里的码"的测试，见新差异文件第 1 条）；成本表和编辑弹窗直接用行里的编码名称。假后端：`{count}`、一次列全所有问题、原因码 `REQUIRED/INVALID_TYPE/INVALID_FORMAT/TOO_LONG/CONTROL_CHARACTER/OUT_OF_RANGE/NEGATIVE/TOO_MANY_DECIMALS/CURRENCY_MISMATCH/NOT_FOUND/DUPLICATE/IMMUTABLE`、金额可发数或文本、币种可省略、整批问题先于逐行（不是数组 `body`/`INVALID_TYPE`、超条数 `body`/`OUT_OF_RANGE`、空 `body`/`REQUIRED`） | `94d5805`（**注意**：这一条的改动被另一个代理的提交带了进去，那个提交的说明写的是第 82 条；内容在，哈希是它）；`src/services/campaign/index.ts:102`，`src/pages/campaign/BatchModal.tsx:78`，`src/request/errors.ts:5`，`mock/campaign.mock.ts:545`，`src/pages/campaign/CostsTab.tsx:66`，`src/locales/en-US/campaign.ts`（`campaign.batch.refused*`） |
| 76 | 点击明细 `from`/`to` 直接发 `YYYY-MM-DD`，`to` 是最后一天；`summary` 缺失分组 key 显示"—" | 已改。点击页发所选的天；汇总表 key 为空串（或 null）显示"—"。假后端：点击的 `from`/`to` 只收天（含两端），带时分秒、不存在的日期、`from` 晚于 `to` 都是 400 `OUT_OF_RANGE`；汇总的缺失 key 是空串不是 null | `4a9daba`；`src/pages/campaign/ClicksTab.tsx:65`，`src/pages/campaign/SummaryTab.tsx:101`，`mock/campaign.mock.ts:309,683` |
| 104 | 预检 key 匹配 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` 创建后不可改，name 去空白后 1–100 码点；key/priority 重复都要处理 `data.field` | 已改。新建对话框的 key 有格式检查和"创建后不能改"的说明，name 按码点数检查（表情算一个）；编辑时 key 不检查（它是路径）；`data.field` 为 `key` 或 `priority` 时放到各自字段下（原本就处理两种，加了 key 的页面测试）。假后端按后端：key 格式 `OUT_OF_RANGE`，name 空/超长，`priority` 不限范围，key 已存在而 priority 也被别的权益占着时报 `priority`，POST 答 `{key}`，PUT 答 `null` | `8152595`；`src/pages/subscriptions/entitlements.tsx:186,219`，`mock/subscriptions.mock.ts`（`defProblems` 与 `POST /entitlement-defs`），`src/locales/en-US/subscriptions.ts`（`keyRule`、`keyHint`）。页面测试在 `ff1b2a7` 里（被别的代理的提交带入） |
| 105 | 可编辑单价的开关只有 `assets.avatar_max`、`assets.voice_max` | 已改。`creditCostEditable` 改为这两个键的清单，价格输入最小值 1；假后端其余开关设非空价格是 400（`creditCost` `OUT_OF_RANGE`），清除（null）所有开关都可，缺 `creditCost` 是 400 `EMPTY_NOT_ALLOWED`，成功 `null`，没有上限 | `906d5ed`；`src/pages/subscriptions/featureRules.ts:35`，`src/pages/subscriptions/gates.tsx`（`min={1}`），`mock/subscriptions.mock.ts`（`credit-cost`）。页面测试在 `ff1b2a7` |
| 106 | 预检 `durationDays` 上限 3650 | 已改。对话框 1 到 3650，超出不发请求；假后端同范围，另改了两处与后端不符的地方：未知权益 404（原来 400）、撤销商店来源的行或不存在的行 404（原来 409）、撤销成功 `null` | `0e1645d`；`src/pages/subscriptions/AccountEntitlementsPanel.tsx:52,90`，`mock/subscriptions.mock.ts`（发放与撤销） |
| 108 | 预检 GRANT 必须为正、ADJUST 不能为 0、`delta` 绝对值不超过 1000000000；reason/note 1–500 码点，note 仅驳回必填 | 已改（上限）；其余原本就一致：GRANT 为正、ADJUST 不为 0（`src/pages/credits/AdjustRequestModal.tsx` 的 `validateDelta`）、reason 1–500（`validateReason`）、通过的备注可空且最多 500（`ApproveModal.tsx:10,66`）、驳回的备注必填（`ReasonModalForm`），假后端这几条的测试补在 `mock/credits.mock.test.ts`。假后端创建申请改为只答 `{id}`，`delta` 超限 `OUT_OF_RANGE` | `56d54af`；`src/pages/credits/AdjustRequestModal.tsx:25,72`，`mock/credits.mock.ts`，`src/services/credits/index.ts:58` |
| 111 | 价格 POST 校验失败后端没有 `details`，页面只显示通用句 | 已改（假后端和测试）。页面代码不用改：保存弹窗用 `failureLines`（`src/pages/cost/failure.ts:9-24`）显示通用句加"有译文的原因"，没有 `details` 时自然只剩通用句。改的是：`POST /usage/prices` 的所有校验失败、确认时档位不对的 400 都不再带 `details`，`message` 是英文；成功答新建的那一批（和列表一项同形）。页面测试：被拒时对话框只有通用句，不含"取值超出范围"，也不含后端英文 | `3ea1935`；`mock/cost.mock.ts:227-233,257,283` |

## 没做（1 处）

- 第 75 条 (f) 的批量一半：批量导入的每一行仍必须带 `currency`（缺了是本地检查 `CURRENCY_MISSING`）。原因：这一列是规格 5.13 的批量模板（`campaign_code,stat_date,cost,currency,remark`）和本地检查的一部分，改成可省略等于改模板和检查规则，属于"变更"，要先把设计点交负责人确认；后端接受不带币种，所以这不会产生错误，只是页面比后端严。

## 没运行（2 项）

- 真实浏览器检查（Playwright Chromium 起 `dev:mock`）：机器负载很高（同时有很多代理在跑测试，一轮 vitest 要 5 到 10 分钟），没有做；页面行为都由页面测试通过假后端触发验证。
- 全量测试和构建：按规则不跑。

## 验证

- 先写测试，再改实现；看到红的有：28（11 个失败）、38（页面测试 3 个失败，之后改实现转绿）、75（服务和请求层 3 个失败、假后端 9 个失败）。其余（30、76、104、105、106、108、111）测试也是先写，但没有单独跑出红（共享文件被别的代理同时改，我没有用"还原再跑"的办法）；这几条用下面的变异检查证明测试咬得住。
- 变异检查（改坏一条规则看测试是否变红）：30（去掉对话框回传 `surfaces`，`sends the surfaces of a pack back unchanged` 变红）、38（去掉按日分组的未归因识别，`isUnattributedRow` 的单元测试变红）、104（key 规则放成 `.+`，`refuses a key outside` 变红）、105（把 `avatar.looks_max` 放进可编辑清单，单元测试变红）、106（上限改成 36500，对话框测试变红）、108（上限乘 10，对话框测试变红）。
- 相关快速测试都过：`mock/subscriptions.mock.test.ts`、`mock/credits.mock.test.ts`、`mock/campaign.mock.test.ts`、`mock/cost.mock.test.ts`、`src/services/{subscriptions,credits,campaign}`、`src/request/errors.test.ts`、`src/pages/subscriptions/{products,entitlements,gates,featureRules,AccountEntitlementsPanel}`、`src/pages/credits/{products,requests,AccountCreditsPanel,failureLanguage,fieldReasonLanguage}`、`src/pages/campaign/{stats,figures,accounts.batch,accounts.costs,attribution.clicks,attribution.summary,failureLanguage,fieldReasonLanguage}`、`src/pages/cost/{prices,prices.followups,failureLanguage}`。机器负载高时，页面测试里 30 秒的测试偶尔超时，单独重跑都过。

## 发现的、不属于本组编号的事（已写进 `docs/contract-requests/2026-11-02-new-differences-a3.md`）

1. 原因码 `NEGATIVE`、`TOO_MANY_DECIMALS` 不在新版接口文档的清单里（译文放在模块自己的语言文件）。
2. 负责人 2026-10-27 的"批量导入后写新增几行、覆盖几行"，在后端加 `overwritten` 之前做不到。
3. 投放账户、成本、点击的 `id`、`campaignId` 后端是数，前端类型和假数据仍是字符串。
4. 确认时币种/日期、`PUT /usage/models/{id}` 的假后端仍带 `details`（后端没有），不属于本组编号，没有改。
5. 订阅商品 `surfaces` 类型原先是字符串，已改成对象数组。
6. 批量成本"第 N 行"（`index+1`）与 CSV 本地检查的文件行号差一行。

## 过程中的两件事（给负责人）

- 别的代理的提交把我还没提交的改动带了进去两次：第 75 条（被 `94d5805`，说明写的是第 82 条）和第 104、105 条的页面测试（被 `ff1b2a7`，说明写的是第 54 条）。最终树里内容都在、测试都过，但这两个提交的说明和内容对不上，也让 `ff1b2a7` 里有一段时间测试在、实现不在。原因是共享的暂存区：我先 `git add` 再提交时被另一个代理的提交抢了先，我的暂存文件留在了暂存区里。之后我改成"一条命令里 add 加 commit"。
- 假后端文件被几个代理同时改（`mock/campaign.mock.ts` 等），我用补丁把同一文件里不同编号的改动分开提交，没有动别人的改动。
