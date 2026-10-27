立即修 1、记录 8、变更 3、不是缺陷 7、阻塞 0

# 任务 11（订阅与权益）评审，提交 dc78eaa

评审方式：读 CLAUDE.md、执行约定、模块任务书、任务 11 任务书、规格 5.10、契约 15.2–15.6 与 17.4 及其附表、后端回复；逐个读了 `src/pages/subscriptions/`（除测试外的全部 12 个文件）、`src/services/subscriptions/`、`mock/subscriptions.mock.ts`、`config/routes/subscriptions.ts`、两份语言文件和问题文件；跑了本任务的测试、biome、tsc；做了 21 次变异（见末尾）。没有改任何源文件；每次变异后用 `git checkout -- <文件>` 还原，最后 `git diff HEAD --quiet` 对本任务路径无差异。

我自己跑的结果：
- `npx vitest run src/pages/subscriptions src/services/subscriptions mock/subscriptions.mock.test.ts config/routes/subscriptions.test.ts`：12 个文件、202 个测试全绿（和报告写的数一致）。
- `npx vitest run tests/noHardcodedText.test.ts src/locales`：414 个全绿。
- `npx biome check`（本任务全部路径）：无诊断。`npx tsc --noEmit`：本任务路径下无报错。
- 两个语言文件各 144 个键，键集相同，占位符相同，en-US 里没有中日韩字符，没有韩文；页面里用到的静态键和动态键前缀在语言文件里都存在。
- 仓库里没有参照项目名（扫描的两个禁用名和我另外查的几个第三方名都没命中）。

---

## 一、立即修（1）

### 1. 订阅详情抽屉把 Google 的购买令牌（purchaseToken）显示出来，并提供复制按钮，持有 `SUBSCRIPTION:VIEW` 的人都能看到

- 位置：`src/pages/subscriptions/SubscriptionDrawer.tsx:115-119`（`key: 'ref'` 那一行，内容是 `detail.storeRef`）；弹出层和"复制"按钮来自 `src/components/EllipsisPopoverText.tsx:44-58`。
- 触发步骤：用只有 `SUBSCRIPTION:VIEW` 的管理员（契约 17.4 末尾写明支持人员持有 VIEW/GRANT）打开订阅列表，点一条商店为 GOOGLE 的订阅"详情"，在"商店侧订阅标识"一行点击文字，弹出层里显示完整令牌，点"复制"就进了剪贴板。
- 错误结果和依据：
  - 契约 15.3 写明 `storeRef` 对 Google 就是 `purchaseToken`。
  - 契约 15.2 的绑定规则第 2 步最后一条写明"不存在（用户在旧版本或 App 外购买）：绑定到当前账号，**依据是持有购买凭证**"；同一节末尾写明找不到账号时 `accountId` 留空，"等客户端 `verify` 时绑定"。也就是说，对一条还没有归属（`accountId` 为空）或购买时没带账号标识的 Google 订阅，谁拿到令牌，谁用自己的账号调用 `POST /api/subscriptions/google/verify {productId, purchaseToken}` 就能把这条订阅（和它的权益）认领到自己名下。令牌因此是持有即可用的凭据，不是普通的标识。
  - 契约 17.4 附表第 8 条对同类的东西已经是只给末 6 位（设备推送令牌 `tokenSuffix`，"完整 token 不返回"）；CLAUDE.md 的产品规则是"凭据类字段永不回显"。
  - 客服查商店后台并不需要令牌：契约里 `Subscription` 有 `id`、`accountId`、`productId` 和时间；这个任务的任务书和规格 5.10 的详情字段表也没有要求显示商店侧标识。报告把它放在"变更候选"里问负责人，但它属于"安全或隐私暴露"，不是新增行为的取舍，按 CLAUDE.md 分类应当立即修。
- 如果带着它上线：每个客服账号都能看到并复制所有未归属 Google 订阅的认领凭据，一个被收买或被盗号的客服账号可以把别人付费的订阅认领走。
- 建议的修法（在本任务路径内）：商店为 GOOGLE 时抽屉不显示 `storeRef`（或只显示末 6 位，不带复制）；Apple 的 `originalTransactionId` 单独不能用来认领（verify 要的是 Apple 签名的交易 JWS），可以保留。修的时候带测试：用 `store: 'GOOGLE'` 的订阅打开抽屉，断言 DOM 里（含点击后的弹出层）找不到完整令牌，也没有复制按钮。现在没有任何页面测试断言过 `storeRef` 这一行（`grep storeRef src/pages/subscriptions/*.test.tsx` 无结果），所以这一行被删掉或改掉测试都不会变红，修的时候要补。
- 响应本身仍带完整令牌（`GET /subscriptions` 和 `/subscriptions/{id}` 的 JSON，开发者工具里可见），这一部分前端修不了，见下面变更 1。

---

## 二、记录（8）

### R1. 读数据没有"只认最新一次请求"的保护，响应乱序时会显示别的对象的数据
- 位置：`SubscriptionDrawer.tsx:56-69`（`load` 里 `setDetail(await getSubscription(id))`，没有判断是不是最新）；`AccountEntitlementsPanel.tsx:185-197`（`setData(await getAccountEntitlements(accountId))`）；`products.tsx:261-273`、`gates.tsx:173-181`、`entitlements.tsx:281-290` 写操作后重读列表，同样没有。统计页 `stats.tsx:227-239` 和 `PagedListTable` 已经有这个保护，说明项目约定要有。
- 触发步骤：点订阅 A 的"详情"（响应慢），关掉，点订阅 B（响应快）；B 先到，A 后到，抽屉标题是 B，内容被换成 A 的字段和事件（第一行"订阅 ID"能看出不一致）。账号权益页签：`accountId` 变化时同理，会在账号 B 的页面显示账号 A 的权益行，且那几行的"撤销"按钮作用在 A 的限时权益上。商品映射：连续切换两个商品的在售开关，第一次的重读晚到时，页面把第二个开关显示回旧值。
- 错误结果：显示的数据和选中的对象不一致；只发生在响应乱序时，不丢数据，所以记录。建议三处一起修（用请求序号，照 `stats.tsx` 的做法）。

### R2. 三个写操作没有"重复点击只发一次"的测试，去掉防重复提交后测试仍然全绿
- 我的变异：把 `useSingleFlight` 换成直接调用（并去掉 `pending`）：
  - `gates.tsx:132` `CreditCostCell`（额度单价"保存"）：`gates.test.tsx` 27 个全绿。
  - `entitlements.tsx:187` `DefDialog`（新增/编辑权益）：`entitlements.test.tsx` 25 个全绿。
  - `products.tsx:86` `ProductDialog`（新增/编辑商品映射）：`products.test.tsx` 21 个全绿。
  - 对照：`DefaultDialog`、`FeaturesDrawer`、`EnabledSwitch`、账号权益发放去掉保护后各有 1 个测试变红。
- 报告第 18 条写的"商品映射"实际只覆盖了在售开关 `EnabledSwitch`，没覆盖 `ProductDialog`；报告里没有说明这一点。模块任务书要求"每个写操作测：重复点击只发一次"。
- 实际后果：现在代码里有保护，所以运行结果没错；以后有人改动这三处，测试不会拦。
- 事件页的"重新处理""已处理"和"撤销"走共用的 `RowActions`/`DangerConfirmButton`，它们的防重复由共用组件的测试负责，不在本任务范围。

### R3. 新增/编辑权益的对话框把无法对应到表单项的后端字段错误吞掉，用户什么都看不到
- 位置：`entitlements.tsx:195-207`。`fields.length > 0` 时对每个 `f.ref` 直接 `form.setFields({ name: f.ref })`；`error.data.field`（重复）也直接当表单项名。
- 触发步骤：后端对 `POST /entitlement-defs` 返回 400 且 `details[].ref` 不是 `key`/`name`/`priority`（契约没定，问题文件第二条正是在问），或 409 的 `data.field` 是别的名字。结果：对话框停着，没有任何错误提示。`products.tsx:108-115` 和 `AccountEntitlementsPanel.tsx:99-106` 已经先按已知字段过滤、其余落到 `FailureAlert`，这里漏了。
- 契约没定这些 `ref`，所以现在只是防御性缺口，记录。

### R4. 权益"功能值"抽屉的标题里放了运营填的权益名，名字是 5000 字符无空格串时标题撑宽整个抽屉
- 位置：`entitlements.tsx:110`（`title={t('subscriptions.entitlements.featuresTitle', { name: def.name })}`）。antd 6.6.7 的抽屉标题样式 `node_modules/antd/es/drawer/style/index.js:184-190` 没有换行或省略规则（`-header-title` 只有 `min-width:0`，没有 `overflow`/`word-break`），所以不会像表格里那样被 `EllipsisPopoverText` 截断。
- 触发步骤：新增一个名字为 5000 个无空格字符（或很长的泰语/阿拉伯语连续串）的权益，打开它的"功能值"。结果：标题一行撑出抽屉宽度，抽屉整体出现横向滚动。权益名的长度上限后端还没回复（问题文件第二条），所以现在能建出这样的名字。其余地方放名字的位置（表格、下拉、账号页签）都是 `EllipsisPopoverText` 或下拉自带省略，没发现别的。
- 我是按 antd 样式源码判断的，没有在真实浏览器里量；影响是外观，不影响数据，记录。

### R5. 几处写操作失败时只显示错误的总说明，不显示 `reason.<码>`
- 位置：`gates.tsx:136`（额度单价保存）、`products.tsx:231`（在售开关）都是 `message.error(describeFailure(intl, error).text)`，丢掉了 `fields`。
- 触发步骤：额度单价输入超出后端范围，后端回 400 `INVALID_REQUEST` 且 `details: [{ref:'creditCost', reason:'OUT_OF_RANGE'}]`（本任务假后端就是这样回的，`mock/subscriptions.mock.ts:438`）。结果：用户只看到"请求不合法"一类的总说明，不知道是单价超范围。功能值、默认值、权益、映射对话框、发放对话框都显示了原因，只有这两处没有。
- 事件页和撤销的失败是 409 `INVALID_STATE`，没有 `details`，不受影响。

### R6. 统计表的行键没有币种，同一天同商店同商品出现两个币种时行键重复
- 位置：`stats.tsx:304`，`rowKey` 是 `日期|商店|商品`。问题文件第七条自己问了"同一天、同一商店、同一商品有两种币种时是两行吗"，但暂定做法没有把币种放进行键。
- 触发步骤：后端对同一天、同一商店、同一商品按币种各返回一行。结果：React 报重复键，表格翻页或重绘时可能少行或重复行；顶部合计 `stats.tsx:245-248` 仍把两行相加，不受键影响。
- 后端还没回复，所以只是潜在触发，记录；把币种加进行键即可。

### R7. 订阅列表的"商店"筛选是自由文本，只有输入完全一致的大写标识才有结果
- 位置：`list.tsx:47`（`{ title: ..., dataIndex: 'store' }`，没有 `valueType: 'select'`）。商品映射页（`products.tsx:39,152-160`）已经用了 `APPLE`/`GOOGLE` 的下拉。
- 触发步骤：在"商店"框输入 `google`。结果：假后端是精确匹配（`mock/subscriptions.mock.ts:227`），列表为空，没有任何提示为什么；真实后端的大小写规则未知（问题文件第四条）。
- 不丢数据、不出错误输出，记录。

### R8. 订阅列表的四个筛选项折叠时只露出前两个（作者自己的记录项 2，复核成立）
- 位置：`src/components/PagedListTable.tsx:17` 的 `defaultCollapsed?: true` 是共用组件，本任务没改。账号 ID 和状态露出，商店和商品要点"展开"。属实，不影响正确性。

---

## 三、变更（3，需要负责人决定）

### C1. 契约变更请求：后台读订阅的接口不应把完整 Google 令牌发给只有查看权限的管理员
- 现状：契约 15.3 `GET /subscriptions` "每项是 `Subscription` 的列"，含 `storeRef`（Google 就是 `purchaseToken`）和 `linkedPurchaseToken`，响应 JSON 里完整可见。前端不显示也挡不住开发者工具里看到。
- 请求（完整写法交给负责人，由他决定谁在 AvatarApp 的 main 上改）：
  - 名称：后台订阅读取接口对 Google 订阅的令牌脱敏。
  - 行为：`GET /subscriptions`、`GET /subscriptions/{id}`、以及返回 `linkedPurchaseToken` 的位置，Google 的 `storeRef` 和 `linkedPurchaseToken` 只返回末 6 位，字段名带 `Suffix`（沿用 17.4 附表第 8 条 `tokenSuffix` 的做法）；Apple 的 `originalTransactionId` 不变。若运营确实要完整令牌，需要单独的权限码和审计日志，不放进 `SUBSCRIPTION:VIEW`。
  - 检查顺序、错误：只是响应字段变化，没有新错误；列表筛选里没有按令牌筛选的参数，不受影响。
  - 测试：持有 `SUBSCRIPTION:VIEW` 的管理员读一条 Google 订阅，响应里找不到完整令牌；Apple 订阅的标识照旧返回。
- 在它落地之前，立即修 1 是前端能做的全部。

### C2. 新增/编辑权益、新增/编辑商品映射的对话框（作者已标为变更候选，复核确认它们不在任务书和规格里）
- 位置：`entitlements.tsx:163-266`（`DefDialog`）、`products.tsx:58-213`（`ProductDialog`）及对应测试。规格 5.10 只写了列表和功能值编辑、商品映射的列；契约有 `POST/PUT /entitlement-defs` 和 `PUT /subscription-products`，请求体由问题文件第一、二条暂定。需要负责人确认保留还是删掉；保留的话请求体仍是暂定的，后端回复后要对。

### C3. 订阅统计页顶部"活跃订阅数"在默认范围下大概率显示"—"
- 位置：`stats.tsx:208-214` `activeOnLastDay` 取"行里最后一天"，最后一天只要有一行 `active` 为 `null` 就整张卡显示"—"；默认范围 `stats.tsx:224` 是含今天的最近 7 天，而契约写明 `active` 取自日末快照（17.6），当天的快照没有时为 `null`（假后端也是当天为 `null`，`mock/subscriptions.mock.ts:188`）。
- 触发步骤：当天（UTC）有订阅事件，打开统计页。结果：卡片文字"活跃订阅数 / 取最后一天"，数值是"—"，而前几天明明有快照。
- 这是取值规则的设计问题（改成取"最后一个有快照的日子"并写出是哪一天，或维持现状），不是计算错，所以放变更；该规则在规格 5.10 里没有写。

---

## 四、不是缺陷（7）

1. 源码里出现 `Apple`/`Google`/`APPLE`/`GOOGLE`（`products.tsx:37,39`，以及测试和假数据）：它们是契约 15.3 规定的商店标识值（`store` 取 `APPLE`/`GOOGLE`），不是参照项目名；`tests/noHardcodedText.test.ts:203` 的禁用名单也不含它们。注释里写 "Apple and Google" 的那一句（`products.tsx:37`）如果负责人要求注释也不写厂商名，改一行即可；我没有按缺陷计。
2. 抽屉里 `detail.productId`、`detail.id` 没有包 `EllipsisPopoverText`（`SubscriptionDrawer.tsx:101,120`）：`Descriptions` 的内容单元格自带 `word-break: break-word; overflow-wrap: break-word`（`node_modules/antd/es/descriptions/style/index.js:151-152`），长串会在格内换行，不撑破。
3. 作者的记录项 1（几个开发服务器共用 `src/.umi` 互相覆盖）：是开发流程，不是代码行为；我也在同一检出里遇到别的会话在同时提交（`index.lock`），与此同类。
4. 商品映射页的在售开关对没有 `SUBSCRIPTION:CONFIG` 的管理员是禁用而不是隐藏（`products.tsx:244`）：任务书要求的是"保存按钮按 CONFIG 显示"，开关本身不是保存按钮，且禁用后点不动；测试 `products.test.tsx` 覆盖。
5. 列表/事件表里 `id`、`store`、事件 `type`/`subtype` 是纯文本（`list.tsx:25,47`、`events.tsx:81,101,108-109`）：这些是后端生成的编号和商店通知枚举名，不是运营或用户输入的文字；权益名、商品 ID、理由、错误文字这些可能很长的都已用 `EllipsisPopoverText`。
6. 权益功能值的 LIMIT 上限不在前端校验（`featureRules.ts:104-120`）：`entitlement.limit_max` 在 `SUBSCRIPTION:CONFIG` 的配置里，`GET /meta` 没有；问题文件第八条已提出；后端拒绝时 `entitlements.tsx:95-97` 把原因放到那一行旁边，已处理。
7. 印尼语在本任务只出现在假数据的轮换样本里（事件错误文字 `mock/_core/subscriptionsData.ts:296`），没有单独断言（报告已如实写明）：其余六种语言加 emoji 和 5000 字符无空格串在权益名、理由、错误、商品 ID、说明里有断言，覆盖范围已经写明，不是缺陷。

---

## 五、逐项检查结论（没有发现问题的项）

- 请求形状和路径：`src/services/subscriptions/index.ts` 的路径、方法、请求体与契约 17.4 逐项对：权益功能值 `{features:[{featureKey, mode, value?}]}`（`UNSET`/`UNLIMITED` 不带 `value`，`VALUE` 带）、默认值 `{mode, value?}`、`credit-cost` `{creditCost}`、发放 `{entitlementKey, durationDays, reason}`、撤销、重处理、已处理、统计 `from`/`to`；`key` 路径参数做了 `encodeURIComponent`。筛选参数名、商品映射和事件列表的形状是问题文件里的暂定做法，真实后端回复前不能核对。
- 权限码：路由四页 `SUBSCRIPTION:VIEW`、统计 `FINANCE:VIEW`（`config/routes/subscriptions.ts`）；保存权益功能值、新增/编辑权益（`entitlements.tsx:112,317`）、默认值和额度单价（`gates.tsx:127,279`）、"参数"区（`gates.tsx:292`）、商品映射（`products.tsx:259,298,342`）都按 `SUBSCRIPTION:CONFIG`；事件"重新处理""已处理"（`events.tsx:28,43`）、发放和撤销（`AccountEntitlementsPanel.tsx:182,281,344`）按 `SUBSCRIPTION:GRANT`；撤销按钮条件是 GRANT 且 `source=PROMO` 且 `status=ACTIVE`。发放对话框读 `GET /entitlement-defs`，契约/后端回复写明对 GRANT 开放。
- 防重复提交：除 R2 列出的三处测试缺口外，所有写操作代码上都有 `useSingleFlight`/共用组件的保护。
- 错误显示：主流程都走 `describeFailure`（`error.<码>`/`reason.<码>`），`FailureAlert` 显示 `ref` 和原因；R3、R5 是例外。
- 长串布局：表格里的名字/ID/理由/错误都是 `EllipsisPopoverText`；R4 是抽屉标题例外。
- 空值与 0：`formatCount` 对 `null` 返回"—"；`active` 为 `null` 显示"—"；额度值 0 显示 0（"不允许"）；`null` 单价显示"—"占位；`FeatureValueText` 对缺值显示"—"，不显示 0。
- 统计 UTC：默认范围、预设、所选日期都按 UTC 日历日发送，日期列直接显示 `statDate`，页面有 `UtcNotice`，"金额是标价不是实收，沙盒订阅不计入"两种语言都在，没有退款入口。
- 写死文字：扫描测试全绿；`—` 占位和 `APPLE`/`GOOGLE` 常量是标识符。
- 两种语言：键与占位符一致（144/144）。

## 六、对报告里测试和变异说法的核对

我做了 21 次变异（比要求的 5 次多），全部在检查后立即还原并核对字节一致。发现并如实记下的偏差：一次变异时另一个会话正在提交，`git checkout` 因 `index.lock` 失败，一个文件短暂停在变异状态；我随即还原并确认 `git diff HEAD` 对本任务路径为空，之后给脚本加了重试。

| 变异（改一处判断） | 结果 |
|---|---|
| 撤销按钮去掉 `status === 'ACTIVE'` | 红，3 个（和报告第 9 条一致） |
| 撤销按钮去掉 `source === 'PROMO'` | 红，3 个（报告第 10 条） |
| 撤销按钮去掉 `canGrant` | 红，1 个 |
| 事件页去掉 `if (!canGrant) return []` | 红，2 个（报告第 8 条） |
| "重新处理"对所有事件显示 | 红，2 个 |
| "已处理"对所有事件显示 | 红，2 个 |
| 抽屉里不排序事件 | 红，1 个（报告第 11 条） |
| 事件排序改成升序 | 红，4 个 |
| 参数区的权限码从 CONFIG 改成 VIEW | 红，1 个（报告第 17 条） |
| 红条 `every` 改成 `some` | 红，11 个（报告第 3 条） |
| `credits.period_grant` 能选"不限" | 红，3 个（报告第 6 条） |
| 额度单价格去掉 `canEdit` | 红，1 个 |
| 额度单价去掉"永久"条件 | 红，2 个 |
| 统计页"活跃订阅"改成跨日相加 | 红，1 个（报告第 13 条） |
| 保存提醒去掉"默认值也未配置"条件 | 红，4 个（报告第 4 条） |
| `call.lifetime_minutes` 出现在权益功能值里 | 红，2 个（报告第 7 条） |
| 功能值序列化统一带 `value: null` | 红，7 个（报告第 12 条） |
| 默认值对任何开关都允许"未配置" | 红，2 个（报告第 1 条） |
| 路由：事件页权限改成 GRANT | 红，4 个（报告第 15 条） |
| 路由：统计页权限改成 VIEW | 红，4 个 |
| 去掉防重复：账号权益发放 | 红，1 个（报告第 18 条） |
| 去掉防重复：商品在售开关 | 红，1 个 |
| 去掉防重复：默认值对话框、权益功能值抽屉 | 各红 1 个 |
| 去掉防重复：额度单价、新增/编辑权益、新增/编辑商品映射 | **都没有变红**（见 R2） |

报告里"覆盖了哪些语言""红到绿"的数字我能对上；报告里没有写的差异只有 R2 的"商品映射"范围，和"订阅详情里商店侧标识"被放在变更候选而不是立即修。
