# 任务 11：订阅与权益 报告

**立即修未修 0、记录项 2、未运行 2、阻塞 0**

- 记录项：见下面"记录项"两条（共用的开发服务器目录、表格搜索区折叠）。
- 未运行：账号权益页签（`AccountEntitlementsPanel`）没有在真实浏览器里看过，因为现在没有页面挂载它（任务 16 的用户详情才会用）；只有单元测试和对着假后端的页面测试。界面语言 zh-CN 没有在真实浏览器里看过，只在 en-US 下看了（zh-CN 靠两边键一致的测试保证文字存在）。
- 阻塞：无。契约和后端文件没写的点写成了问题文件（见下），本任务按最小做法继续。

## 改了哪些文件（都在任务 11 的路径内）

- 接口：`src/services/subscriptions/{index,types}.ts`、`subscriptions.test.ts`（12 个测试）
- 页面：`src/pages/subscriptions/` 下 `list.tsx`（订阅列表）、`SubscriptionDrawer.tsx`（详情抽屉和事件时间线）、`entitlements.tsx`（权益定义与功能值）、`gates.tsx`（功能开关）、`products.tsx`（商品映射）、`events.tsx`（事件重处理）、`stats.tsx`（订阅统计）、`AccountEntitlementsPanel.tsx`（给用户详情用的账号权益页签，含发放和撤销）、`FeatureValueEditor.tsx`、`FeatureValueText.tsx`、`QuotaWarnings.tsx`、`FailureAlert.tsx`、`featureRules.ts` 和各自的测试
- 假后端：`mock/subscriptions.mock.ts`、`mock/_core/subscriptionsData.ts`、`mock/subscriptions.mock.test.ts`（28 个测试）
- 路由：`config/routes/subscriptions.ts`、`config/routes/subscriptions.test.ts`（9 个测试）
- 语言：`src/locales/{zh-CN,en-US}/subscriptions.ts`
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-subscriptions.md`

## 测试数量

任务 11 路径下 12 个测试文件、202 个测试：featureRules 19、FeatureValueEditor 10、订阅列表和抽屉 9、功能开关 27、权益 25、商品映射 21、事件 14、统计 11、账号权益页签 17、接口 12、假后端 28、路由 9。另外跑了 `src/locales` 和 `tests/noHardcodedText.test.ts`（414 个，全绿，含别人的文件）。`npx biome check` 本路径无诊断；`npx tsc --noEmit` 本路径无错误。

## 红到绿

每个测试文件都先写、先跑，确认红的原因是"被测的模块不存在"：

- `npx vitest run mock/subscriptions.mock.test.ts` → `Failed to resolve import "./subscriptions.mock"`；实现后 28 个绿。
- `npx vitest run src/services/subscriptions` → 找不到 `./index`；实现后 12 个绿。
- `gates.test.tsx`、`entitlements.test.tsx`、`products.test.tsx`、`events.test.tsx`、`stats.test.tsx`、`AccountEntitlementsPanel.test.tsx` 都是 `Failed to resolve import "./<页面>"`（0 个测试）；实现后分别 27、25、21、14、11、17 个绿。
- `config/routes/subscriptions.test.ts`：路由文件是空数组时 5 个失败（`expected [] to deeply equal [ …(6) ]`）；填好后 9 个绿。
- 例外（要照实写）：`featureRules.test.ts`、`FeatureValueEditor.test.tsx`、`list.test.tsx` 的 RED 没有单独跑出"模块不存在"：前两个是先写的纯规则和组件、紧接着写测试，订阅列表是先写页面后写测试。它们靠下面的变异检查证明测试会变红。
- 绿的过程里修过的测试问题（不是功能问题）：单选按钮 `pointer-events: none` 要点标签文字；按钮在加载中时名字带"loading"所以按正则找；统计页测试里令牌要在设定假时间之后签发；搜索区折叠时只显示前两个筛选项。

## 真实浏览器检查（Playwright，端口 8301，登录 root）

打开了六个页面。看到的：

- 订阅列表：20 行加分页、状态标签、沙盒标签、账号链接、无账号的行显示"—"；详情抽屉里事件时间线按商店事件时间倒序，有错误的事件左边红线。
- 功能开关：两条红条（通话额度、文字额度）都在；把 `call.daily_minutes` 默认值改成 30 后通话红条消失、文字红条还在；额度单价单元格的启用和禁用对；`call.lifetime_minutes` 的说明文字显示，原来是单行被截断，已改成可换行（`gates.tsx`）。
- 权益：权益 `basic` 的功能值抽屉 14 行（没有 `call.lifetime_minutes`），三种状态的按钮清楚；通话额度默认值已配置后只剩文字额度的提醒。
- 商品映射：新增商品对话框能打开；事件重处理：点"重新处理"、确认后，失败事件少一条；订阅统计：UTC 提示、"金额是标价不是实收，沙盒订阅不计入"、卡片和表格，缺的快照显示"—"。
- 控制台：只有登录第一步的 401（认证流程自己的，不是本任务）。没有别的错误。
- 过程中发现：同一个检出里几个开发服务器共用 `src/.umi`，后启动的会让先启动的页面变白（`Invalid hook call` 或 `Can't resolve src/.umi/...`），重启自己的服务器就恢复。已停掉自己的服务器（按监听进程）。

## 变异检查（改一处判断，看测试是否变红；全部在检查后还原）

被杀死（红）的：
1. 默认值允许对任何开关选"未配置" → featureRules、功能开关各 1 个红
2. `avatar.looks_max` 的额度单价可编辑 → 红
3. 通话红条改成"任何一个未配置就显示" → 11 个红
4. 保存提醒不看默认值 → 3 个红
5. 保存提醒的"两个键都未配置"改成"任一未配置" → 4 个红
6. `credits.period_grant` 能选"不限" → 红
7. 权益里显示 `call.lifetime_minutes` → 红
8. 事件页没有 `SUBSCRIPTION:GRANT` 判断 → 2 个红
9. 撤销按钮对任何限时权益显示（不看状态） → 3 个红
10. 撤销按钮对商店来源的行也显示 → 3 个红
11. 抽屉里不排序事件 → 1 个红
12. "未配置"序列化时带了 `value: null` → 4 个红
13. 活跃订阅卡片不再只取最后一天 → 1 个红
14. 商品在售开关不看 `SUBSCRIPTION:CONFIG` → 1 个红
15. 路由里事件重处理页的权限改成 CONFIG → 4 个红
16. 假后端对任何开关都允许"未配置" → 1 个红
17. 功能开关页的"参数"区去掉权限判断 → 1 个红
18. 去掉防重复提交：功能开关对话框、权益抽屉、商品映射、账号权益发放各一次 → 各 1 个红（账号权益发放原来的测试没有杀死这个变异，因为响应太快对话框已关；已改成慢响应的测试，再测变红）

## 覆盖的语言

假数据和测试含泰语、阿拉伯语、越南语、西班牙语、英语、中文，加 emoji 和 5000 字符无空格串（权益名称、限时权益理由、事件错误、商品 ID、功能开关说明）；表格里都用 `EllipsisPopoverText`，测试断言它们会在格内换行截断。印尼语只出现在假数据的样本里（`sampleAny` 轮换），没有单独的印尼语断言。界面只有 zh-CN 和 en-US。

## 对应任务书 Tests 的每一条

- 账号权益页签：`AccountEntitlementsPanel.test.tsx`（每个开关一行、来源三种、撤销只对 PROMO 且 ACTIVE 且有 GRANT）
- 订阅详情抽屉的事件时间线：`list.test.tsx`（倒序，含服务器乱序、红色错误、需关注标记）
- `FeatureValueEditor`：`FeatureValueEditor.test.tsx`、`featureRules.test.ts`、`gates.test.tsx`、`entitlements.test.tsx`
- 额度单价单元格：`gates.test.tsx`；红条：`featureRules.test.ts`、`gates.test.tsx`
- 通话和文字额度提醒：`featureRules.test.ts`、`entitlements.test.tsx`、`products.test.tsx`
- `call.lifetime_minutes` 说明：`gates.test.tsx`
- 事件重处理页：`events.test.tsx`；路由权限：`config/routes/subscriptions.test.ts`；参数区：`gates.test.tsx`；订阅统计：`stats.test.tsx`

## 问题文件清单

`docs/contract-requests/2026-10-26-admin-frontend-subscriptions.md`，八条：商品映射的响应和请求体；权益定义创建和修改的请求体；额度单价的请求体和拒绝；订阅列表的筛选参数名；事件列表的行、`status` 取值、"失败"的定义和重处理、已处理的响应；限时权益发放和撤销的细节；订阅统计里金额的类型；功能值上限不在 `GET /meta` 里。

## 需要改共享文件

没有必须改的。

## 规格需要在 main 上修改的地方

- 5.10"权益定义与功能值"：只写了列表和功能值编辑，没有写新增、编辑权益（`key`、名称、优先级）。契约有 `POST/PUT /entitlement-defs`，权益也是"由运营在后台创建"。建议补一句：新增和编辑权益（需 `SUBSCRIPTION:CONFIG`）。
- 5.10"商品映射"：只写了列，没有写新增和编辑一条映射；建议补："新增、编辑映射和在售开关（需 `SUBSCRIPTION:CONFIG`）"。
- 5.10"功能开关"：额度单价怎么保存没写；建议写成"`PUT …/credit-cost` 需 `SUBSCRIPTION:CONFIG`"。
- 5.10"事件重处理"："列表看 `FAILED`，每行重新处理"没有说"失败"的定义；等后端回复第五条后写清。
- 5.10 保存权益功能值时的提醒只写了通话；文字额度"同样提醒"一句我按两个键对称做了（`QuotaWarnings`）；建议把文字提醒的文字也写进规格。

## 记录项

1. 同一个检出里同时开几个 `npm run dev:mock` 会互相覆盖 `src/.umi`，先启动的页面变白（`Invalid hook call` 或找不到 `src/.umi/...`）。触发：两个会话各起一个开发服务器，后起的重新生成 `src/.umi`。后果：浏览器检查的人以为是自己的页面坏了，重启就恢复。属开发流程，不是代码缺陷；建议并行时给每个会话单独检出或错开启动。
2. `PagedListTable` 的 `defaultCollapsed` 只能为 `true`（`src/components/PagedListTable.tsx` 的属性类型），订阅列表有四个筛选项，折叠时只露出前两个（账号 ID、状态），商店和商品要点"展开"。我把状态排在商店前面了。共用组件，我没改。

## 变更候选（要负责人确认）

- 我加了"新增、编辑权益"和"新增、编辑商品映射"两个对话框，因为契约有对应的 `POST/PUT`，没有它们这两页只能看不能建。任务书和规格没有写，属于新增行为；请确认保留还是去掉（去掉只涉及 `entitlements.tsx` 的 `DefDialog`、`products.tsx` 的 `ProductDialog` 和对应测试）。请求体是暂定的（问题文件第一、二条）。
- `AccountEntitlementsPanel` 里带了"发放限时权益"对话框和"撤销"，任务书的接口清单和规格 5.0 用户详情行都有这两个动作，我放进了页签组件里；任务 16 直接 `import { AccountEntitlementsPanel }` 用，传 `accountId`。
- 订阅详情抽屉里显示商店侧订阅标识（Apple 的 `originalTransactionId`、Google 的 `purchaseToken`，可复制），因为客服查商店后台要用；Google 的 `purchaseToken` 能不能让持有 `SUBSCRIPTION:VIEW` 的人看到，请负责人决定，不想显示就删掉 `SubscriptionDrawer.tsx` 里 `key: 'ref'` 那一行。
