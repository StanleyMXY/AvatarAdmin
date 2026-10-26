立即修 0、记录 8、变更 0、不是缺陷 8、阻塞 0

# 任务 12（额度）评审：提交 e600006

评审方式：读 CLAUDE.md、执行约定、模块任务说明、任务书、规格和契约快照、后端四份回复；逐文件读 `src/pages/credits/`、`src/services/credits/`、`mock/credits.mock.ts`、`mock/_core/creditsData.ts`、`config/routes/credits.ts`、两种语言的 `credits.ts`、问题文件、任务报告；跑测试、biome、tsc；做了 8 个变异检查。没有起开发服务器，所以"长字符串撑不撑破表格"只读了代码和单元测试（单元测试在 happy-dom 里只能断言内联样式，不能量布局），没有在真实浏览器里重新看一遍；这一项我只能说"代码看起来对，我没有复现"。

## 本次实际跑过的

- `npx vitest run mock/credits.mock.test.ts src/services/credits src/pages/credits config/routes/credits.test.ts src/locales`：14 个文件、528 条全部通过。
- `npx biome check`（本模块全部路径）：无诊断。`npx tsc --noEmit`：本模块路径下无报错。
- `npx vitest run config`：1 条失败，是 `config/routes/moderation.test.ts`（别的模块、同一检出里别的会话正在做的东西），与额度无关。`tests/noHardcodedText.test.ts` 1 条失败，是 `mock/avatar.mock.ts:195` 里有隐藏方向控制字符（形象模块），额度的文件没有被点名。
- 额度模块全部文件逐个扫过：没有韩文、en-US 里没有中日韩字符、没有隐藏字符或非 ASCII 空格、没有第三方产品名或参照项目名、没有 console 或调试日志、没有 localStorage/sessionStorage。
- 语言键：`src/pages/credits` 里用到的 89 个键（`credits.*`、`pages.common.*`、`menu.subscriptions.*`）在语言文件里全部存在；两边占位符一致（`{store} {productId}`、`{min} {max}` 等）。

## 变异检查：自己复现了 8 个（报告说 35 个，另 27 个没有逐个重做）

每个都是：改一处 → 跑相关测试 → `git checkout -- <文件>` → `git diff` 确认还原。结束后 `git diff -- <本模块全部路径>` 为空，`git status` 里没有额度文件的改动。

| 变异 | 结果 |
|---|---|
| `requests.tsx:65` 本人判断 `===` 改 `!==` | `requests.test.tsx` 8 条红（含"本人申请审核按钮禁用并提示"） |
| `services/credits/index.ts` 通过的请求体 `note ? { note } : {}` 改成 `{ note }` | `credits.test.ts` 1 条红 |
| `transactions.tsx` 类型筛选 earn 与 spend 对调 | 2 条红（发出的参数、只显示正或负的变动） |
| `accounts.tsx` 去掉 `min: Number.MIN_SAFE_INTEGER` | 1 条红（保留 ≤0 的余额下限） |
| `NegativeBalance.tsx` `value < 0` 改 `<= 0` | 2 条红（0 余额不标负、无额度账户的面板） |
| `requests.tsx` 新建申请的 `Can` 码 `SUBSCRIPTION:GRANT` 改 `SUBSCRIPTION:VIEW` | 2 条红 |
| `products.tsx` 开关的 PUT 去掉 `surfaces` | 1 条红 |
| `AdjustRequestModal.tsx` GRANT 必须为正的判断改成只拒绝 0 | 2 条红 |

报告里这几类的说法我这边都成立。

## 立即修：0 条

我找了以下几处最可能出错的地方，都没有发现输出错误、崩溃、数据丢失、安全或契约破坏：

- 请求形状与路径：`GET/POST /credit-products`、`PUT /credit-products/{id}`（契约没定，见问题文件第一条）、`GET/POST /credit-adjust-requests`、`POST …/{id}/approve {note?}`、`…/reject {note}`、`GET /credits/accounts`（`accountId`、`balanceMin`、`balanceMax`）、`GET /credits/transactions`（`accountId`、`reason`、`type`、`from`、`to`）、`GET /credits/stats?from=&to=`、`GET /accounts/{id}/credits?page=&pageSize=`。参数名、路径、方法、响应字段名（`applicantUsername`、`reviewerUsername`、`items`/`total`、`balance`/`totalEarned`/`totalSpent`、`purchases`/`refunded`/`spent`）都与契约 §15.9、§17.4 和后端回复第 5 条一致。
- 权限码：路由 `config/routes/credits.ts` 的五个码与规格 5.0 一致（`SUBSCRIPTION:CONFIG`、`SUBSCRIPTION:VIEW`×3、`FINANCE:VIEW`）。按钮：新建申请 `SUBSCRIPTION:GRANT`（`requests.tsx:189` 的 `Can`）、通过和驳回 `CREDIT:REVIEW`（`requests.tsx:62`、`:141`）；额度包页的新建、编辑、在售开关用页面本身的 `SUBSCRIPTION:CONFIG`，正是 `POST/PUT /credit-products` 要求的码。
- 自己不能审核自己：`requests.tsx:65` 只在 `me.id` 有值且等于 `row.applicantAdminId` 时禁用通过和驳回并显示提示；`me.id` 缺失（`normalizeMe` 把非字符串和空字符串都变成 `undefined`）时不禁用；后端的 `SELF_REVIEW_FORBIDDEN` 在通过弹窗（`ApproveModal.tsx:30`）和驳回弹窗（共用的 `ReasonModalForm`）里显示 `error.SELF_REVIEW_FORBIDDEN` 的文字，弹窗保持打开。本人申请只在 PENDING 行出现按钮，所以不会出现已处理的行误禁用。
- 防重复提交：新建申请、通过、额度包保存、在售开关、驳回都走 `useSingleFlight`，提交中确定和取消按钮禁用、遮罩不可关；测试覆盖连点只发一次和令牌过期不重发。
- 余额下限被截成 0 的问题（ProTable 数字框默认 `min: 0`）：`accounts.tsx:347`、`:355` 改成 `Number.MIN_SAFE_INTEGER` 且 `precision: 0`；我去掉这一项，测试变红。上限用 antd 默认 `MAX_SAFE_INTEGER`，所以额度数输入框不会出现超过 2^53 后静默变值。
- 数字：`delta`、`balance` 等都是 `number`；负号用 `Intl.NumberFormat` 的 `signDisplay: 'exceptZero'`（`format.ts`）；`null` 显示"—"（`formatCount`、`formatSigned`、`EllipsisPopoverText` 都是），0 显示"0"。
- UTC：额度流水页的日期范围用 `utcDayRangeToInstants`，发 `from=<起始日>T00:00:00Z`、`to=<结束日次日>T00:00:00Z`，与计划里这个函数的定义一致，选哪天发哪天；统计页默认最近 7 个 UTC 日并标注 UTC。

## 记录：8 条

1. **账号 ID 链接不看 `USER:VIEW`**。`src/pages/credits/AccountLink.tsx:9-10`（用在额度账户页、额度流水页、调账申请页）对所有人都渲染成指向 `/users/<id>?tab=credits` 的链接。触发：只有 `SUBSCRIPTION:VIEW`、没有 `USER:VIEW` 的管理员点账号 ID。错误结果：被路由守卫拦下，进入无权限页，而不是看到普通文字。同一提交旁边的订阅模块已经这样处理：`src/pages/subscriptions/list.tsx:32-36`（有 `USER:VIEW` 才是链接，否则纯文字）。不影响数据，后端和路由守卫仍然是最终裁决，所以是记录。
2. **两处校验提示用了"理由"的文字**。`ApproveModal.tsx:65` 通过备注超过 500 个码点时提示 `pages.common.reasonLength`，en-US 是 "The reason needs 1 to 500 characters"、zh-CN 是"理由需要 1 到 500 个字符"：字段是"备注（可选）"，写的是"理由"，而且"1 到"与"可选"相矛盾。`ProductModal.tsx:137` 商品 ID 超过 200 个码点时用了同一条，提示"理由需要 1 到 200 个字符"，出现在商品 ID 输入框下。
3. **商品 ID 长度上限 200 是前端自己定的，契约和问题文件都没有**。`ProductModal.tsx:32`、`:136`。触发：新建额度包，商品 ID 填 201 个码点，前端拦下；如果商店允许更长就拦错了。问题文件第一条没有问这个范围，应补进去（`credits` 的范围已经问了）。
4. **错误里的字段详情被丢掉**。`ApproveModal.tsx:30` 和 `products.tsx:30`（在售开关）只用了 `describeFailure(...).text`，没用 `fields`。触发：后端回 400 `INVALID_REQUEST`、`details` 是 `[{ref:"note",reason:"TOO_LONG"}]`（契约没有定备注长度，后端范围与前端的 500 不同时会发生）。错误结果：只看到"输入内容不合法，请检查后重试"，看不到哪个字段、什么原因（`reason.<码>` 的文字没有用上）。新建申请和额度包弹窗（`AdjustRequestModal`、`ProductModal`）已经按字段显示，没有这个问题。
5. **用列表里可能已过期的整行去 PUT，会覆盖别人刚改的值**。`products.tsx:23-28`（在售开关）和 `ProductModal.tsx:48-54`（编辑）都把 `credits`、`sortOrder`、`surfaces` 按页面上次加载时的值整体送回。触发：管理员甲打开额度包列表；管理员乙把某包的额度数从 100 改成 200；甲点这个包的在售开关。错误结果：请求带 `credits:100`，乙的修改被改回去，甲看不到任何提示。是否是问题取决于后端 PUT 的语义（问题文件第一条第 4 小问只问了 `surfaces`），等后端回复后确定要不要改成只送变化的字段。
6. **额度包弹窗关闭时标题和字段会变**。`products.tsx:116-117`：关闭时 `editing` 变成 `null`，传给 `ProductModal` 的 `pack` 立刻变成 `null`，而弹窗用 `destroyOnHidden`，淡出动画期间内容还在，于是标题从"编辑额度包"变成"新建额度包"、商店和商品 ID 输入框变成可编辑（`ProductModal.tsx` 里 `editing = pack !== null`）。只是关闭动画那一下的外观，不影响提交。
7. **额度包页有一个空的搜索框和"重置 / 查询"按钮**。`products.tsx:55-93` 全部列都是 `search: false`，仍然用 `PagedListTable`。报告自己在账号额度面板上观察到同样的现象并要求改共享组件（"需要改共享文件"第一条），但没有提到额度包页是同一个情形。依据是报告对同一组件的观察，我没有在浏览器里复现这一页。
8. **切换语言会重新请求并清空统计**。`AccountCreditsPanel.tsx:54`、`stats.tsx:44` 的 `useCallback` 依赖里有 `intl`，切换界面语言时 `intl` 变了，于是额度统计页重新请求（`setData(null)` 先清空，页面闪成加载状态）、账号额度面板重新请求当前页。结果正确，只是多一次请求。

## 变更：0 条

没有发现把行为改成与任务书、规格不同的地方。报告里的三条"变更候选"（额度包页显示 `surfaces`、账号额度页签里加新建申请按钮、流水导出）确实是新行为，要负责人决定，我同意它们不做。

## 不是缺陷：8 条

1. **账号额度面板对没有额度账户的账号显示三个 0**（`AccountCreditsPanel.tsx:274-290`）。依据：任务书和后端回复第 5 条都写"没有额度账户的账号三个合计是 0、`items` 为空，不是 404"，面板显示的就是后端返回的值；规格 5.10 的"账号额度"一条没有另外规定。请求失败或尚未返回时显示"—"而不是 0（`shown(undefined)`），这是对的，不会把"不知道"显示成 0。
2. **`me.id` 缺失时不禁用审核按钮**（`requests.tsx:63-65`）。任务书明文要求（"字段缺失时不禁用，由后端的 `SELF_REVIEW_FORBIDDEN` 兜底"），规格 5.10 同样写"后端仍会返回"。
3. **流水页时间列按浏览器时区、筛选按 UTC 日**（`ledgerColumns.tsx` 的时间列 `formatInstant`，`transactions.tsx:79` 的范围）。规格第 28 行规定时刻按浏览器时区显示、统计和范围按 UTC 日并标注；页面在范围标题和说明里都标了 UTC。
4. **类型"全部"不发 `type`**（`transactions.tsx:85`）。契约 §15.9 的 `type` 默认就是全部，不发等价于 `all`。
5. **流水页和账号页的账号 ID 筛选只去首尾空白、不加通配**（`transactions.tsx:78`、`accounts.tsx:368`、`requests.tsx:180`）。符合"精确匹配、提交完整值"；`trimSpec` 用的是契约 §1.9 的集合，不是 `String.trim`。
6. **`src/pages/credits/testSetup.ts` 放在 `src/pages` 下且引用了 `mock/`、`tests/`**。路由是显式配置的，没有被任何页面导入就不会进构建；`tsc` 和硬编码文字扫描都通过。
7. **报告记录项 5 说端口 8302、8312 上有两个开发服务器没停掉**。我在这个检出的环境里用 `ss -ltnp` 查，这两个端口现在没有监听进程，所以没有可做的事（不能确认它们是否曾在别的容器里）。
8. **`moderation.test.ts` 失败、`mock/avatar.mock.ts:195` 的隐藏字符**。都不是 e600006 的内容（`git show --stat e600006` 里没有这两个文件）。

## 阻塞：0 条

## 与任务书"要检查的"逐项对应的结论

| 要检查的 | 结论 |
|---|---|
| 请求形状、路径与契约、后端文件 | 一致；额度包接口的形状是暂定做法，已在问题文件第一条列出 |
| 每个按钮的权限码 | 正确，见上；记录 1 是链接指向的目标页需要的码 |
| 调账审核规则 | 本人判断、`me.id` 缺失、后端兜底都对；通过 / 驳回的失败在弹窗里显示 `error.<码>`，INVALID_STATE 时刷新列表 |
| 防重复提交 | 对 |
| 错误显示 | 对；记录 4 是字段详情在两处丢失 |
| 长字符串布局 | 代码里每个自由文本单元格都是 `EllipsisPopoverText`（`overflowWrap: anywhere`、两行截断、最大宽度）或 `AccountLink`（同样截断），`dir="auto"`；我没有在浏览器里重新量，只读了代码和单元测试 |
| null 与 0 | 对 |
| UTC | 对 |
| 数字精度、负余额、数字筛选 `min` | 对 |
| 硬编码文字 | 额度文件通过扫描，无字面文字 |
| 语言键与占位符一致 | 对 |
| 第三方产品名、参照项目名 | 额度的全部提交文件里没有 |
