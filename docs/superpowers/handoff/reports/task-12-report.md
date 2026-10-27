# 任务 12：额度 报告

**立即修未修 0、记录项 5、未运行 1、阻塞 0**（变更候选 3 条、契约问题 5 条见下；"未运行"指没有用真实后端跑，只对着假后端和真实浏览器验证）

## 做了什么（一句话）

额度模块的五个页面（额度包、调账申请与审核、额度账户、额度流水、额度统计）、给用户详情用的"账号额度"面板和 `NegativeBalance` 展示组件、对应的接口函数、假后端、路由和两种语言的文字，全部加入"订阅与额度"菜单。

## 改了哪些文件

- 接口函数：`src/services/credits/index.ts`、`types.ts`、`credits.test.ts`。
- 页面（`src/pages/credits/`）：`products.tsx`、`ProductModal.tsx`、`requests.tsx`、`AdjustRequestModal.tsx`、`ApproveModal.tsx`、`accounts.tsx`、`transactions.tsx`、`stats.tsx`、`groupSpent.ts`、`AccountCreditsPanel.tsx`、`NegativeBalance.tsx`、`AccountLink.tsx`、`ledgerColumns.tsx`、`format.ts`、`testSetup.ts`（页面测试共用的登录和等待辅助）及各自的测试。
- 假后端：`mock/credits.mock.ts`、`mock/_core/creditsData.ts`（状态挂在 `globalThis`，`resetCreditsStore()` 可重置）、`mock/credits.mock.test.ts`。
- 路由：`config/routes/credits.ts`（`menuGroup('subscriptions', …)`，五个页面，路径、顺序、权限码取规格 5.0）、`config/routes/credits.test.ts`。
- 语言：`src/locales/{zh-CN,en-US}/credits.ts`（菜单名键 `menu.subscriptions.credit*`）。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-credits.md`。

## 给任务 16（用户详情）用的东西

- `AccountCreditsPanel({ accountId })`（`src/pages/credits/AccountCreditsPanel.tsx`）：就是"额度"页签的内容，没有额度账户的账号显示三个 0 和空流水；账号变了用 `key={accountId}` 重新挂载。页签要由 `SUBSCRIPTION:VIEW` 控制，调用方负责。
- `AdjustRequestModal({ open, accountId?, onClose, onCreated })`：新建申请弹窗，给了 `accountId` 就固定账号；"待删除 / 删除中时按钮禁用"由调用方判断。
- `getAccountCredits`、`createAdjustRequest`、`approveAdjustRequest`、`rejectAdjustRequest`、`NegativeBalance`（`src/pages/credits/NegativeBalance.tsx`）按任务书的签名导出。
- 额度账户页和额度流水页的账号 ID 链接到 `/users/<id>?tab=credits`：任务 16 需要读 `tab=credits` 选中额度页签（规格没有写页签怎么选，见下面"规格需要在 main 上修改的地方"）。

## 红到绿

RED（先写测试，功能不存在）：

```
npx vitest run mock/credits.mock.test.ts src/services/credits src/pages/credits config/routes/credits.test.ts
 Test Files  11 failed (11)     Tests  4 failed | 1 passed (5)
```

11 个文件里 10 个因 `Failed to resolve import`（`mock/_core/creditsData`、`./index`、`./NegativeBalance`、`./groupSpent` 等不存在）失败，路由测试 4 条因 `config/routes/credits.ts` 是空数组失败，不是拼写或配置错。

GREEN：

```
npx vitest run mock/credits.mock.test.ts src/services/credits src/pages/credits config/routes/credits.test.ts
 Test Files  11 passed (11)     Tests  145 passed (145)
```

分文件：假后端 40、接口函数 12、路由 5、账号额度面板 7、NegativeBalance 5、额度账户 7、消费分组 5、额度包 11、调账申请 35、额度统计 9、额度流水 9。另跑了 `src/locales`、`tests/noHardcodedText.test.ts`、`config/`，一起 691 条通过。`npx biome check`（我的路径）无诊断；`npx tsc --noEmit` 我的路径下无错误。

写测试时发现并修掉的一个真问题：ProTable 的数字筛选框默认 `min: 0`，余额下限填 `-50` 会被改成 0（账号余额可以为负，筛选整个失效）；测试先红，页面里改成 `min: Number.MIN_SAFE_INTEGER`。

## 任务书 Tests 一节逐条对应

| 任务书的要求 | 测试 |
|---|---|
| `me.id` 有值且申请人是本人时审核按钮禁用并提示；缺字段不禁用；`SELF_REVIEW_FORBIDDEN` 展示 | `requests.test.tsx` "reviewing your own request" 两条；假后端两条 |
| 驳回备注必填（`trimSpec` 后至少 1 个码点），通过备注选填 | `requests.test.tsx` "rejecting"（空、空格、全角空格）、"approving"（无备注不带字段、带备注去首尾空白）；`credits.test.ts` |
| GRANT 额度必须为正，ADJUST 可正可负（不为 0） | `requests.test.tsx` "a new request"（0、负数、小数、空；调整 0 被拒、±30 通过、改类型后重新检查） |
| 余额为负的行用警示色 | `NegativeBalance.test.tsx`、`accounts.test.tsx`、`AccountCreditsPanel.test.tsx` |
| 流水筛选获得发 `type=earn`、消耗发 `type=spend`（全部不发） | `transactions.test.tsx` 断言发出的参数 |
| 账号额度页签对没有额度账户的账号显示三个 0 和空流水 | `AccountCreditsPanel.test.tsx`；假后端 `accounts/:id/credits` |
| 账号 ID 筛选精确匹配、提交完整值 | 三个页面各一条，另有假后端按前缀不匹配的测试；只去首尾空白，不加通配、不截取 |
| 额度统计按 `spendKind` 分，服装再按 `itemKey` 分；沙盒说明存在 | `groupSpent.test.ts`、`stats.test.tsx` |
| 没有 `SUBSCRIPTION:VIEW` 看不到账户、流水页；没有 `SUBSCRIPTION:GRANT` 看不到"新建申请"；没有 `CREDIT:REVIEW` 看不到通过 / 驳回 | `config/routes/credits.test.ts`（菜单按码过滤）；`requests.test.tsx` "which buttons an administrator sees" |

每个写操作（新建申请、通过、驳回、额度包的开关、新建和编辑）另测：后端拒绝时显示文字、连点只发一次、请求途中令牌过期（401）不重发。Review Focus：UTC 日边界（新加坡 01:30 的默认范围用 UTC 日期）、空值显示"—"、5000 字符无空格串与泰语 / 阿拉伯语 / 越南语 / emoji 在各表格里不撑破（单元格有最大宽度和 `overflow: hidden`）。

## 真实浏览器检查

按 brief 用 Playwright（Chromium）登录 `root`，开发服务器是任务目录的一份副本（原因见"记录项"第 5 条）。看了五个页面的英文和中文、手机宽度（390，页面无横向滚动）。点了：通过（带备注）、对"账号待删除"的申请点通过（弹窗里显示宽限期提示）、驳回（空备注被拒、填写后通过）、新建申请（负数的发放被拒、空理由被拒、改后提交，列表出现新行，申请人是自己的行审核按钮禁用并有提示）、账号 ID 筛选、账号额度页的余额上限 -1（只剩负余额账号）、流水的类型和 UTC 日范围（发出的参数是 `from=2026-10-24T00:00:00Z&to=2026-10-26T00:00:00Z`）、额度包开关、新建重复额度包（409 显示在弹窗里）、账号额度面板（负余额、无账户、长流水；面板用一个临时的演示路由在副本里看，没进仓库）。控制台只有两类预期的失败请求日志：登录第一步的 401（要验证码）和故意触发的 403 / 409。发现并修了两处：`AccountCreditsPanel` 用 `PagedListTable` 时多出一个空的搜索框和"重置 / 查询"按钮（改成自己用 antd 的 `Table` 分页）；调账申请和额度包的"操作"列在窄屏要横向滚动才看得到（改成固定在右边）。

## 变异检查

35 个，对权限显示、自己不能审核、不显示在已处理的行、备注选填的序列化、GRANT / ADJUST 的数字检查、连点保护（新建弹窗、额度包开关）、类型筛选的映射与对调、账号 ID 截断和不去空白、时间范围终点、余额为 0 不算负、负余额不标、统计默认日按本地日、沙盒说明、服装不按条目分、面板先显示 0、额度包编辑带 `productId` 和丢掉适用端、路由权限码、余额下限被截成 0，以及假后端的七处（本人可审、驳回不要备注、发放可为负、无账户 404、按前缀匹配账号、沙盒计入、通过不写流水）。结果：第一轮 33 个红；"额度包编辑丢掉适用端"这个变异存活，补了一条测试（开关和弹窗两处都断言带回 `surfaces`），重做后两处都红；"假后端本人可审"这个变异因为 biome 重排了代码文字没有应用上，改成按代码块匹配重做后红。最终 35 个都被抓到。变异期间我的源文件被临时改过几分钟；同一检出里有别的会话在跑 `vitest run src/pages`，那段时间它们跑到我的页面测试可能见过假的失败，没有留下任何改动。

## 覆盖的语言

假数据（备注、理由）有泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，另有 300 个字符无空格串；页面测试里 5000 字符无空格串、七种语言和 emoji 进了申请理由、审核备注、流水备注、商品 ID、账号 ID、统计的功能键和条目键。界面文字只有 zh-CN 和 en-US，两边键相同（`src/locales/parity.test.ts` 通过）。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-credits.md`，5 个问题：（一）`/credit-products` 的响应形状、`PUT` 路径和请求体、重复的错误、`surfaces` 保留；（二）流水 `from` / `to` 的格式和 `to` 是否包含；（三）额度统计 `from` / `to` 和默认范围；（四）申请理由、备注的长度范围，`delta` 的范围；（五）通过 / 驳回几个检查的先后。都已写明暂定做法，假后端和前端按暂定做法做。

## 需要改共享文件

- `src/components/PagedListTable.tsx`：没有一个可搜索的列时仍然画一个空的搜索框（只有"重置 / 查询"按钮）。建议加 `search={false}` 的开关（或没有可搜索列时不画）。现在 `AccountCreditsPanel` 绕开它，自己用 antd `Table` 分页。
- 同一个组件的 `defaultCollapsed` 类型写死成 `true`；流水页有 4 个筛选，窄屏时第 3、4 个要点"展开"才看得到。建议允许 `defaultCollapsed={false}`，页面不用靠展开。

## 规格需要在 main 上修改的地方

1. 5.10"额度包"列没有"适用的端"（`surfaces`）；契约 `CreditProduct` 有。若运营要设，需要补这一列和编辑方式；现在页面不显示、不改，保存时原样带回。
2. 5.10"额度流水"的时间范围没有写是 UTC 日还是别的；契约 §15.9 只写"`from`、`to` 按 `createdAt`"（见问题文件第二条）。
3. 契约 §17.4 额度行末尾写"消费额度按功能开关分"，而同一句里的响应形状 `spent` 先按 `spendKind` 再按功能或条目分；规格 5.10 写按消费类别。以响应形状和规格为准，契约这句话需要改。
4. 规格 5.10"额度账户：账号 ID 点开进用户详情的'额度'页签"：5.0 的用户详情路由没有页签参数。本任务用 `?tab=credits`，需要规格或任务 16 把页签怎么选写下来。

## 记录项（5 条）

1. `src/pages/credits/requests.tsx:62-66`：`me.id` 缺失时（真后端还没上线 `GET /me` 的 `id`）本人的申请审核按钮不禁用，点下去由后端回 `SELF_REVIEW_FORBIDDEN`，弹窗里显示"不能审核自己提交的申请"。这是任务书要求的行为，记下来是因为后端上线 `id` 后可以去掉这个降级的说明。
2. `src/pages/credits/products.tsx` 的额度包列表假定后端不分页，前端自己切页（`request` 里 `slice`）：如果真后端按页返回，超过一页的额度包会显示不全。依据问题文件第一条，等后端回复。
3. `src/pages/credits/ProductModal.tsx`：`store` 下拉只列 `APPLE`、`GOOGLE`（契约说"可扩展"）；后端增加渠道后要在 `types.ts` 的 `CREDIT_STORES` 加一项；已有额度包的商店不在列表里时编辑弹窗仍能显示。
4. 测试里 happy-dom 不触发动画结束事件，antd 弹窗关闭后一直留在页面上（带 `-leave` 类），所以用 `testSetup.ts` 的 `dialogsClosed()` 判断"已开始关闭"；是测试环境的限制，不是页面的缺陷。
5. 开发服务器：这个检出里同时跑着几个 `max dev`（共用 `src/.umi` 和 MFSU 缓存），我按分配的端口 8302 起的服务在这个检出里模块解析失败（浏览器控制台 `Can't resolve 'umi'`），所以改为把仓库复制到任务临时目录（`node_modules` 用硬链接，不含 `.cache`）再起了端口 8312 的服务做浏览器检查。**这两个服务我都没能停掉**：停进程的命令被自动审批拒绝了。需要负责人或主会话停掉：端口 8302（进程 4494，我起的，从检出里起）和端口 8312（我起的，从 `…/scratchpad/task12/app` 里起）。

## 未运行（1 条）

没有对着真后端跑（后端还没上线），额度包的管理接口形状和三处参数格式都是暂定做法；所以第一条风险是"契约问题文件的五条后端回复之后，字段名或形状可能要改"。

## 变更候选（不是遗留项，要先和负责人确认再做）

1. 额度包页显示和编辑"适用的端"（需要规格补充，见上）。
2. 账号额度页签里加"新建额度申请"按钮（`AdjustRequestModal` 已导出，位置和禁用规则由任务 16 定）。
3. 额度流水导出（规格没有写，计划里没有，没做）。
