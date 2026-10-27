立即修未修 0、记录项 3、未运行 4、阻塞 0

# 任务 32 步骤 2：规格 §12 验收清单逐条对照，和语言文件全量对照

范围：规格快照 `docs/shared-snapshots/admin-frontend-design.md` 第 578 行起的 §12 全部条目和每个分句，加上计划步骤 1 里"语言文件对照收紧到全量"这一项。快照没有改。分支 `claude/jolly-dirac-4pq9g6`。

## 先说结论

- §12 有 31 条验收条目，按全角分号拆成 114 个分句，另有最后"测试"一段的 6 项。114 个分句每一个都在表里有一行（意思相同的相邻分句合在一行里），写了对应的测试（文件:行号 测试标题）或手工检查方法。
- 原来没有测试的地方补了测试：真实路由表对规格路由总表的逐页对照和各类管理员看到的菜单；语言文件对四类来源的全量对照；列表表格的加载态和空状态；切换语言后表单校验文字；配置键承载页的路由存在。细节在"本次补的测试"一节。
- 切换语言后表单校验文字这一组测试发现了一个真实缺陷（已经显示在屏幕上的校验提示不会跟着换语言），记为记录项 1，对应的那条测试用 `it.fails` 标记，修好后 vitest 会提醒去掉标记。
- 语言文件的四类对照（路由名称、权限码、错误码和原因码、225 个配置键）都没有发现缺文字，不需要改语言文件。
- 四个只能在真实浏览器或真实后端里看的地方记为"未运行"，写在"未运行项"一节。浏览器走查由另一份报告负责，这里不替代。

测试运行：见"运行记录"一节。

## 对照表

结果一栏的写法：`已运行：成功` 是指这条所列的测试在本次运行里全部成功；`补测试后已运行：成功` 是原来没有测试，这次补了；`未运行（手工）` 见"未运行项"；`有缺陷` 见"记录项"。路径里的 `src/pages/x/y.test.tsx:123` 是该测试的起始行号。

### 一、权限、登录、会话

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 持有不同权限码的管理员登录后，菜单只出现其有权的项 | `config/menuByPermission.test.ts`（新）：以规格路由总表为准，support、finance、reviewer、newhire、fresh 五个预置管理员和"没有任何权限码"的管理员，在真实路由树上看到的菜单页面集合恰好等于"路由总表里 access 为空或在其权限码内的页面"；`src/access/canAccess.test.ts:149` hides a parent whose children are all without permission、`:154` shows a parent with the one child that has permission；`config/routes/*.test.ts` 逐模块（如 `campaign.test.ts:56`、`cost.test.ts`、`credits.test.ts`）按页面核对 access。变异：把渠道包页的 access 改成别的码、让菜单过滤忽略权限，新测试都失败 | 补测试后已运行：成功。菜单在真实 ProLayout 里的渲染见未运行项 1 |
| 超级管理员看到全部菜单 | `config/menuByPermission.test.ts`（新）a super administrator sees every page that is a menu entry；`src/access/canAccess.test.ts:105` answers true for every code for a super administrator | 补测试后已运行：成功 |
| 直接访问无权的地址得到权限提示，不是白屏 | `src/pages/pages.test.tsx:46` is not blank: it says there is no permission and why、`:53` names the permission that the page needs；`src/app.test.tsx:57` shows the 403 page and the 404 page from the language files、`:82` shows the 403 page only to someone who is signed in；`config/menuByPermission.test.ts`（新）a page behind a code is denied by the access object to an administrator without it, hidden pages included（对规格里每个有权限码的页面，Umi 查的 access 对象在没有该码时给 false） | 补测试后已运行：成功。真实地址栏里的 403 页见未运行项 1 |
| 登录：未带验证码 → 出现验证码框 | `src/pages/user/login/login.test.tsx:64` shows the code box after ADMIN_TOTP_REQUIRED and signs in again with the same name, password and the code | 已运行：成功 |
| 登录：验证码错误 → 提示并清空 | `login.test.tsx:170` says the code is wrong for ADMIN_TOTP_INVALID and empties the code box | 已运行：成功 |
| 登录：未绑定 → 进入绑定页 | `login.test.tsx:191` goes to the setup page for ENROLL_REQUIRED, with the token in memory and not in the address or any storage | 已运行：成功 |
| 登录：绑定成功才进入应用 | `src/pages/user/enroll/enroll.test.tsx:54` sends the token and the code, then signs in and goes on；`:90` keeps the token and empties the box when the code is wrong（错误时不进入应用）；`:125` goes to sign-in at once when there is nothing to set up | 已运行：成功 |
| `mustChangePassword` 时只能进改密码页 | `src/session/session.test.ts:86` keeps someone who must change the password on the change-password page, from every other page；`src/app.test.tsx:101`（keeps an account that must change its password out of every page of the shell）；`login.test.tsx:142` sends an account that must change its password to that page；`src/access/canAccess.test.ts`（mustChangePassword 的账号对任何码都是 false） | 已运行：成功 |
| 令牌过期后任意请求跳登录页 | `src/request/apiClient.test.ts:194` 401 ADMIN_INVALID_TOKEN clears the token and calls onExpired；`src/session/SessionBridge.test.tsx:58` clears the token and the account, forgets the tabs, and goes to sign-in with the page it was on、`:77` goes once however many requests report it | 已运行：成功 |
| 登录后回到原页面 | `SessionBridge.test.tsx:105` brings the person back to the page afterwards；`login.test.tsx:111` goes to the page the person came from, when it is a page of this site、`:355` is sent to the page named in the address、`:362`（地址指向本站以外时回到总览） | 已运行：成功 |
| 403 `ADMIN_FORBIDDEN` 提示无权限且不跳转 | `apiClient.test.ts:241` 403 ADMIN_FORBIDDEN calls onForbidden, throws, and keeps the token；`SessionBridge.test.tsx:115` says so, stays where it is, and reads the permissions again once、`:133` 三个同时的拒绝只提示一次 | 已运行：成功 |

### 二、通用列表与脱敏

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 每个列表页：分页 | 共用表格 `src/components/PagedListTable.test.tsx` asks for page 1 with 20 rows、uses the page sizes 10, 20, 50 and 100、goes to page 2 with the same page size、shows the answer of the newest request；页内自带分页表格的 7 个文件夹 `src/pages/pagedTables.test.tsx`（新）；各页的翻页参数在各自页面测试里（如 `src/pages/system/roles.test.tsx:133` asks for the page by number, and starts from page 1 again when the page size changes） | 补测试后已运行：成功 |
| 每个列表页：筛选 | `PagedListTable.test.tsx` passes the search form fields to the request；各页测试里各自核对筛选字段到请求参数（如 `src/pages/users/list.test.tsx`、`src/pages/moderation/queue.test.tsx:156`、`src/pages/credits/transactions.test.tsx:120`） | 已运行：成功 |
| 每个列表页：空状态 | `PagedListTable.test.tsx` shows an empty state for no rows；`src/pages/pagedTables.test.tsx`（新）每个自带表格的空文字和空状态 | 补测试后已运行：成功 |
| 每个列表页：加载状态 | `PagedListTable.test.tsx` shows the loading state while a page is being read, and not after the rows came（新；变异：给表格写死 `loading={false}` 即失败）；`src/pages/pagedTables.test.tsx`（新）ads、appVersions、campaign、notifications、sms 的同款表格和 system、users 两个自读表格的加载态（变异：三处各改成 `loading={false}` 都失败）。报表类页面（`analytics/summary`、`campaign/stats`、`cost/*`、`invite/InviteOverview`、`invite/ShareChannelsTab`、`subscriptions/stats`）的表格自己没有 `loading`，页面在读数据时整页显示 `Spin` 或 `ReadState`（代码读过，没有逐页的加载态测试） | 补测试后已运行：成功；报表页的整页加载态没有逐页测试，见记录项 3 |
| 邮箱：没有 `USER:EMAIL_VIEW` 时显示掩码，有则显示完整 | `src/pages/users/list.test.tsx:91` shows the mask the backend gave to an administrator without the two view codes, and says how to see the whole value、`:102` shows the whole values … to an administrator who holds the view codes；`src/pages/users/detail.test.tsx:347`；`mock/users.mock.test.ts:138` masks e-mail and phone for an administrator without the two view codes, and shows them whole to one with them | 已运行：成功 |
| 手机号同理（`USER:PHONE_VIEW`，掩码只留末 4 位） | `mock/users.mock.test.ts:48` keeps the first character … and only the last four digits of a phone number、`:138`；`users/list.test.tsx:91`（`****5678`） | 已运行：成功 |
| 封禁：理由必填 | `src/pages/users/BanUserModal.test.tsx:70` refuses an empty reason and one over 500 code points without sending anything | 已运行：成功 |
| 封禁：旁边有"写给用户看的文字"说明 | `BanUserModal.test.tsx:47` says that the reason is shown to the user in one language, and what a ban does and does not do、`:54` says it in the words of the spec in Chinese | 已运行：成功 |

### 三、内容审核、订阅、额度

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 内容审核队列按等待时长排序 | `src/pages/moderation/queue.test.tsx:29` lists the oldest waiting record first, with its type, source, status and how long it has waited | 已运行：成功 |
| 顶部显示最老一条的等待时长 | `queue.test.tsx:81` shows the longest wait at the top of the page、`:89` says that nothing is waiting, and does not show a zero | 已运行：成功 |
| 判定前展示后果文字 | `src/pages/moderation/detail.test.tsx:306` 起的参数化用例 tells what %s %s does before it is confirmed（生成图、动作片段、消息、人设、伴侣名、头像上传与被举报、声音上传与被举报，每种都分通过和驳回，并断言确认前没有写请求）；`src/pages/moderation/effects.test.ts:8` has a text in both languages for every content type, source and decision | 已运行：成功 |
| `BLOCKED` 记录不显示内容区 | `detail.test.tsx:153` shows no content area for a record that was blocked automatically, and asks for nothing | 已运行：成功 |
| 订阅功能值编辑：未配置、具体值、不限三种状态能区分 | `src/pages/subscriptions/FeatureValueEditor.test.tsx:33` shows "Not configured", a value and "No limit" as three different selections、`:203` tells a number, "No limit" and "Not configured" apart, and never shows a missing number as 0 | 已运行：成功 |
| 三种状态正确保存 | `FeatureValueEditor.test.tsx:69` serializes the three states as {mode:UNSET}, {mode:UNLIMITED} and {mode:VALUE,value}；`src/pages/subscriptions/featureRules.test.ts:185` asks for a value for every kind | 已运行：成功 |
| 额度：余额为负时醒目显示并带说明 | `src/pages/credits/NegativeBalance.test.tsx:10` shows a negative balance with the warning colour and says what it means；`src/pages/credits/accounts.test.tsx:38` shows a negative balance in the warning colour | 已运行：成功 |
| 调账申请人不能审核自己的申请 | `src/pages/credits/requests.test.tsx:129` disables approve and reject on a request the administrator submitted, says why, and leaves the others usable。变异：把"是否本人申请"的判断改成永远 false，该测试失败 | 已运行：成功 |

### 四、统计页

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 每个统计页：标注"UTC" | 所有用 `DateRangeUtc` 的报表页都带 `UtcNotice` 或自己的 UTC 文字，逐页的测试：日报 `src/pages/stat/daily.test.tsx:124`、留存和游客统计 `stat/retention.test.tsx:118`、`stat/guest.test.tsx:187`、埋点 `analytics/summary.test.tsx:35`、`analytics/detail.test.tsx:55`、`analytics/funnel.test.tsx:315`、额度统计 `credits/stats.test.tsx:22`、订阅统计 `subscriptions/stats.test.tsx:71`、审核统计 `moderation/stats.test.tsx:28`、推送 `push/stats.test.tsx:109`、通话 `sessions/analytics.test.tsx:107`、`sessions/quality.test.tsx:168`、邀请 `invite/stats.test.tsx:113`、`invite/shareStats.test.tsx:112`、投放 `campaign/stats.test.tsx:58`、`campaign/attribution.clicks.test.tsx:52`、广告 `ads/report.test.tsx:111`、成本 `cost/report.test.tsx:120`、看板 `dashboard/overview.test.tsx:564`。活动管理的两个统计页按规格 5.22 用用户本地日，测试反过来断言它们不写 UTC（`activity/signinStats.test.tsx:44`、`activity/taskStats.test.tsx:70`） | 已运行：成功 |
| 落地条只对 `STATS:LAND` 显示 | `src/components/stat/LandBar.test.tsx:29` is not drawn without STATS:LAND；各页：`stat/daily.test.tsx:453`、`stat/retention.test.tsx:271`、`stat/guest.test.tsx:288`、`ads/report.test.tsx`、`campaign/stats.test.tsx:283`、`cost/report.test.tsx:595`、`activity/signinStats.test.tsx:282` | 已运行：成功 |
| 趋势图缺失日期补 0 | `src/components/stat/TrendChart.test.tsx:22` has a point for every day of the range, with 0 for a day that has no row；`stat/daily.test.tsx:207`、`stat/retention.test.tsx:368`、`ads/report.test.tsx:313` | 已运行：成功 |
| 留存未到期格子显示"—" | `src/components/stat/RetentionMatrix.test.tsx:23` shows a dash for a day that has not come yet and 0% for a day with nobody back；`stat/retention.test.tsx:202`；`stat/guest.test.tsx:447` | 已运行：成功 |
| 去重人数没有跨日合计 | `stat/daily.test.tsx:290` has no total, no sum row and no sum card: weekly and monthly actives cannot be added over days；`analytics/funnel.test.tsx:528` says … the distinct counts are not added over days | 已运行：成功 |
| 日报：平台不是 `ALL` 时业务类列显示"—" | `stat/daily.test.tsx:397` for a platform other than All: every business cell is a dash …；`stat/dailyColumns.test.ts:154` shows a dash in every business cell when the platform is not ALL, even if a number came | 已运行：成功 |
| 漏斗：预设只读 | `analytics/funnel.test.tsx:98` lists … the presets with the tag "System preset"、`:124` gives a preset no Edit and no Delete, but Save as stays | 已运行：成功 |
| 漏斗：自定义可保存、编辑、删除 | `funnel.test.tsx:155` saves the current steps and window under a new name、`:236` changes a custom funnel with PUT、`:262` deletes a custom funnel after the inline question | 已运行：成功 |

### 五、系统配置、管理员、语言与主题

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 系统配置：只有持有该键所需权限的管理员能编辑 | `src/pages/config/ConfigForm.test.tsx:36` shows only the keys of a permission, a prefix or a list、`:57` shows only the keys of the permission when that is all the administrator has、`:66` shows nothing … to an administrator without any config permission；`mock/config.mock.test.ts`（写接口按键的权限码返回 403） | 已运行：成功 |
| 系统配置：JSON 值格式错误时不提交 | `ConfigForm.test.tsx:258` disables Save for a JSON key whose text is not JSON；`src/components/JsonField.test.tsx:31` reports an error and tells the parent form when the text is not JSON | 已运行：成功 |
| 系统配置：未识别的键有警告 | `ConfigForm.test.tsx:113` warns about a key the schema does not know, and shows it read-only | 已运行：成功 |
| 承载配置键的页面路由都存在（执行裁决 8，任务 32 断言） | `config/configHosts.test.ts`（新）has a route for every host page named in CONFIG_HOSTS、names a host for every edit permission other than CONFIG:MANAGE that a key uses | 补测试后已运行：成功 |
| 管理员：不能停用自己 | `src/pages/system/admins.test.tsx:197` disables disable and delete on the own row；`:223`（超级管理员的本人行）；`adminRules.test.ts:45`。变异：把本人行的保护改成 false，五个用例失败 | 已运行：成功 |
| 管理员：删除仍分配给管理员的角色时展示 `ROLE_IN_USE` | `src/pages/system/roles.test.tsx:426` shows ROLE_IN_USE as its text, not the words of the backend, and keeps the row | 已运行：成功 |
| 切换语言后菜单标题随之变化 | 菜单标题的文字：`src/locales/parity.test.ts`（收紧）every page route has a menu.<chain> text，两种语言；标签标题：`src/components/layout/TabManager.test.tsx:386` shows the titles in the current language and changes them when the language changes、`:396`；侧边菜单在真实布局里重绘：未运行（手工） | 文字已运行：成功；真实布局见未运行项 2 |
| 切换语言后表单校验文字随之变化，没有残留的另一种语言 | `src/locales/switch.test.tsx`（新）：切换后再触发的校验提示是新语言（登录表单、原因对话框）；已经显示在屏幕上的提示在切换后仍是旧语言，这条断言用 `it.fails` 标记 | 有缺陷，见记录项 1 |
| 切换主题模式不整页刷新 | `src/components/layout/layout.test.tsx:44` changes the mode and keeps it, without reloading the page；`src/theme/modes.test.ts:165` changes the mode without a reload and sets the data-theme attribute on <html>；`src/theme/ThemeRoot.test.tsx:55`；`layout.test.tsx:69` changes the language through Umi without a page reload | 已运行：成功。真实浏览器里的观感见未运行项 2 |

### 六、活动管理（5.22）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 发布或启用签到活动先探测重叠，确认框列出将被停用的活动 | `src/pages/activity/signinConfig.test.tsx:233` a draft that overlaps asks with the names of the activities that will be stopped、`:251` after Confirm the same request goes again with confirm=true、`:271` enabling a stopped activity is probed the same way | 已运行：成功 |
| 草稿以外的活动没有删除按钮 | `signinConfig.test.tsx:167` a draft: View, Edit, Publish, Delete; a live one: View, Edit, Stop …、`:191` has no Delete for any activity that is not a draft | 已运行：成功 |
| 奖励阶梯至少一行 | `signinConfig.test.tsx:573` has one step to begin with …、`:595` … the last one cannot be removed | 已运行：成功 |
| 任务配置删除失败时提示改用停用 | `src/pages/activity/taskConfig.test.tsx:268` a task that has records is not deleted: TASK_HAS_RECORDS is shown in words, telling to stop it instead | 已运行：成功 |
| 已有记录的任务配置的类型和目标值只读 | `taskConfig.test.tsx:574`（后端回 409 后只读）、`:606`（行上标明有记录时一开始就只读） | 已运行：成功 |
| 编辑生效中的签到活动的日期范围也先探测重叠 | `signinConfig.test.tsx:874` changing the end day of a live activity is probed first (confirm=false)、`:892`、`:919` | 已运行：成功 |
| 任务记录列显示任务名称不是数字 | `src/pages/activity/taskRecord.test.tsx:43` lists the records … with the NAME of the task, never its number | 已运行：成功 |
| 统计页有落地条和导出 | `signinStats.test.tsx:255`（无 `STATS:EXPORT` 无导出）、`:282`、`:289`（落地并重读）；`taskStats.test.tsx:218`、`:225`、`:241` | 已运行：成功 |
| 没有 `CHECKIN:MANAGE`、`TASK:MANAGE` 的管理员看不到新建和编辑 | `signinConfig.test.tsx:201` without CHECKIN:MANAGE there is no New button and no Edit …；`taskConfig.test.tsx:184` without TASK:MANAGE there is no New button and no Edit … | 已运行：成功 |

### 七、成本（5.23）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 没有 `COST:VIEW` 看不到成本报表和价格页 | `config/routes/cost.test.ts`（两页的 access）；`config/menuByPermission.test.ts`（新，路由表对规格总表逐页核对 access） | 补测试后已运行：成功 |
| 没有 `COST:PRICE` 看不到确认、驳回、撤回、手填和改模型登记的按钮 | `src/pages/cost/prices.test.tsx:85`（无手填页签和参数）、`:296` shows no confirm, reject or editable control to someone without COST:PRICE、`:672` has no Withdraw, and nothing to edit、`:1126`（手填页没有该码时不存在）、`:1211` has no edit button without COST:PRICE | 已运行：成功 |
| 没有 `STATS:EXPORT` 看不到导出，没有 `STATS:LAND` 看不到重新落地 | `src/pages/cost/report.test.tsx:555` shows neither button to someone with only COST:VIEW、`:562` export needs STATS:EXPORT together with COST:VIEW、`:595` re-landing needs STATS:LAND | 已运行：成功 |
| 待审批次确认前页面写明不会按新价格计费 | `prices.test.tsx:160` says that nothing is charged at a pending price before it is confirmed、`:171`（中文）；`:322` shows the consequence before anything is sent | 已运行：成功 |
| 档位有缺口或重叠时表单拦住 | `prices.test.tsx:850` a gap, an overlap, a first band not from 0 …: each is said、`:884` disables the save button while the bands are wrong；`src/services/cost/validateBands.test.ts:40`、`:48` | 已运行：成功 |
| 币种下拉只有 `usage_price.allowed_currencies` 里的值 | `prices.test.tsx:261` gives the currency select only the allowed currencies、`:826` offers only the allowed currencies, and a disabled select with the reason when they are unknown | 已运行：成功 |
| 不同币种分开显示、不相加 | `cost/report.test.tsx:252` shows each currency on its own line and never adds one currency to another、`:448`；`cost/costRows.test.ts:85` | 已运行：成功 |
| 费用为空的请求归在"无费用" | `report.test.tsx:434` puts the requests that had no price in a group called "No cost"；`costRows.test.ts:42` | 已运行：成功 |
| 价格保存后没有编辑入口，只有"撤回"和再填一批 | `prices.test.tsx:680` has no way to edit a saved price, even with COST:PRICE、`:651` has a Withdraw button for an ACTIVE batch …、`:784` says that prices are only added, never edited | 已运行：成功 |
| 系统监控页没有成本图，只有跳到成本报表的链接 | `src/pages/monitor/pipeline.test.tsx:58` draws GPU utilization, error count and error rate as three charts, and no chart of cost、`:119` has a link to the cost report for an administrator who may open it | 已运行：成功 |

### 八、投放管理（5.13）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 投放账户没有删除按钮 | `src/pages/campaign/accounts.campaigns.test.tsx:106` has no button to delete a campaign anywhere | 已运行：成功 |
| Facebook 访问令牌编辑时不回显 | `accounts.campaigns.test.tsx:126` does not show the token even when the backend sends it by mistake、`:490`、`:545`。变异：编辑时用行里的令牌做初值，`:545` 失败 | 已运行：成功 |
| 批量录入任一行不合法整批拒绝并按行显示原因 | `src/pages/campaign/accounts.batch.test.tsx:169` lists each bad row with its line and the reason in words, imports nothing、`:239` shows what the backend refused, row by row | 已运行：成功 |
| 投放效果比率分母为 0 显示"—" | `src/pages/campaign/stats.test.tsx:155` shows a dash for every rate and every cost per unit whose denominator is 0；`campaign/figures.test.ts:47` | 已运行：成功 |
| 有"未归因"行 | `stats.test.tsx:190` has a row for the unattributed installs with its share | 已运行：成功 |
| 点击明细的 IP 默认掩码 | `src/pages/campaign/attribution.clicks.test.tsx:128` shows the IP address exactly as the backend gave it: masked for an administrator without ANALYTICS:IP_VIEW, with a note；`mock/campaign.mock.test.ts:668` | 已运行：成功 |
| 没有 `ATTRIBUTION:MANAGE` 的管理员看不到账户与成本、归因参数页 | `config/routes/campaign.test.ts:56`、`:64` keeps the accounts, the costs and the parameters from an administrator who can only view；`campaign/settings.test.tsx:29` | 已运行：成功 |

### 九、应用内广告（5.17）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 投放检查清单显示 | `src/pages/ads/campaigns.test.tsx:87` opens with the delivery checklist …；`ads/creatives.test.tsx:102`、`ads/placements.test.tsx:61`、`ads/units.test.tsx:76`、`ads/report.test.tsx:111` | 已运行：成功 |
| 激励广告位的频控不能提交 0 | `src/pages/ads/placements.test.tsx:489` does not take a cap of 0 on the rewarded placement, and says why, and sends nothing | 已运行：成功 |
| 已通过的素材没有编辑和删除按钮，只有暂停 | `src/pages/ads/creatives.test.tsx:172` gives an approved creative no Edit and no Delete, only the switch、`:472` pauses and resumes an approved creative at once with the switch | 已运行：成功 |
| 素材先上传再创建 | `creatives.test.tsx:844` uploads first and then creates with the upload id and nothing about the file、`:717` asks for the file first when none was uploaded | 已运行：成功 |
| 规格不符时在表单里给出原因 | `creatives.test.tsx:587`、`:597`；`src/pages/ads/mediaSpec.test.ts:8`–`:45` | 已运行：成功 |
| 报表没有"独立用户" | `ads/report.test.tsx:135` has no "unique users" anywhere: no card, no column, no text、`:335` | 已运行：成功 |
| 有"游客展示"卡片和按国家页签 | `report.test.tsx:167` are fourteen, in the order of the spec, including the guest impressions、`:329` are four, by placement, campaign, creative and country | 已运行：成功 |
| 无广告原因枚举（含 `NOT_FOR_GUEST`）都有本地化说明 | `report.test.tsx:472` explains each of the eleven reasons in words、`:500` has a text for every reason in both languages | 已运行：成功 |

### 十、短信管理（5.18）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 渠道的凭据永远不回显 | `src/pages/sms/channels.form.test.tsx:136` keep the box empty when a channel is edited, also when the backend sends the credentials by mistake、`:193`；`channels.test.tsx:109`。变异：编辑时用行里的凭据做初值，三个用例失败 | 已运行：成功 |
| 编辑时留空表示不修改 | `channels.form.test.tsx:183` are not in the request of an edit where only blanks were typed；`src/pages/sms/channelRules.test.ts:59` | 已运行：成功 |
| 供应商下拉来自 `GET /sms/meta` | `channels.form.test.tsx:275` takes the providers from the meta of the backend | 已运行：成功 |
| 测试发送显示当天剩余次数 | `src/pages/sms/channels.testsend.test.tsx:62` shows how many test messages are left today | 已运行：成功 |
| 没有 `SMS:RECORD:PHONE_VIEW` 时号码掩码 | `src/pages/sms/records.test.tsx:109` shows the number as the backend gives it: masked to the last four digits, with a note、`:118`、`:124`；`mock/sms.mock.test.ts:599` | 已运行：成功 |
| `OTP` 模板缺 `{code}` 时不能保存 | `src/pages/sms/templates.test.tsx:178` gets an error as it is typed when {code} is not there … and cannot be saved；`templateRules.test.ts:5`；`mock/sms.mock.test.ts:505` | 已运行：成功 |
| 没有"查看验证码" | `records.test.tsx:95` shows the text with the code already replaced by **** and no way to see a code | 已运行：成功 |
| 有 `SMS:RECORD:EXPORT` 才显示导出按钮 | `records.test.tsx:361` has no button without SMS:RECORD:EXPORT、`:366`、`:371` | 已运行：成功 |
| 导出的号码按权限掩码 | `mock/sms.mock.test.ts:737` writes the rows of the filter, with the number masked unless the administrator may see it（导出文件由后端写，前端只负责请求；真实后端未验证） | 已运行：成功（mock）；真实后端见未运行项 4 |

### 十一、额度账户与流水（5.10）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 没有 `SUBSCRIPTION:VIEW` 看不到这两个页面 | `config/routes/credits.test.ts` are the five pages with the paths and permission codes of the table；`config/menuByPermission.test.ts`（新） | 补测试后已运行：成功 |
| 账号 ID 筛选是精确匹配 | `src/pages/credits/accounts.test.tsx:55` asks for the account id exactly as typed, whole and trimmed；`credits/transactions.test.tsx:120` sends the account id exactly as typed | 已运行：成功 |
| 余额为负的行用醒目颜色 | `accounts.test.tsx:38` | 已运行：成功 |
| 流水类型筛选"获得"只出现正的变动、"消耗"只出现负的变动 | `transactions.test.tsx:87` sends type=earn for "Earned" and type=spend for "Spent"、`:105` shows only positive changes for "Earned" and only negative ones for "Spent" | 已运行：成功 |

### 十二、渠道包与应用版本（5.19）

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 渠道包：没有删除按钮 | `src/pages/channels/channels.test.tsx:114` has an enabled switch for each channel and no delete anywhere；`mock/channels.mock.test.ts:191` has no DELETE handler；`src/services/channelPackages/channelPackages.test.ts:134` has no way to delete | 已运行：成功 |
| 渠道码、平台、分发方式创建后只读 | `channels.test.tsx:223` opens empty and says that the code, the platform and the distribution cannot be changed afterwards、`:406` changes only the name and the package name；`mock/channels.mock.test.ts:159` refuses to change the code, the platform or the distribution | 已运行：成功 |
| 各统计页和版本列表的渠道包下拉都有数据 | `src/components/stat/PlatformChannelFilter.test.tsx:56` offers All plus the channels from the backend；日报 `stat/daily.test.tsx:150`、`ads/report.test.tsx`（sends a channel code that was chosen）、`appVersions/versions.test.tsx:237` filters by channel package | 已运行：成功 |
| 没有 `CHANNEL:MANAGE` 的管理员看不到渠道包管理页 | `config/menuByPermission.test.ts`（新）：规格路由总表里 `/system/channels` 的 access 对真实路由逐页相等，变异改 access 即失败；`mock/channels.mock.test.ts:79`、`:184` | 补测试后已运行：成功 |
| 应用版本：DIRECT 渠道的表单有 APK 上传控件 | `src/pages/appVersions/versions.form.test.tsx:548` has the APK control and no store link, and beside it the limit and the type | 已运行：成功 |
| 上传中不能提交 | `versions.form.test.tsx:610` cannot be sent while the file is still uploading、`:628` | 已运行：成功 |
| 文件地址、大小、SHA-256 只读 | `versions.form.test.tsx:581` uploads first, shows the address, size and checksum as text that cannot be edited | 已运行：成功 |
| STORE 渠道没有 APK 控件 | `versions.form.test.tsx:119` opens empty, with the store link and no APK control once a STORE channel is chosen、`:742` | 已运行：成功 |
| 激活必须勾选"新版本已经在商店对用户可见" | `src/pages/appVersions/versions.activate.test.tsx:76` cannot be sent until the box is ticked; then it sends confirmStoreLive=true, once、`:261`（DIRECT 渠道不问） | 已运行：成功 |
| 已归档的版本没有操作 | `versions.test.tsx:420` gives a draft edit, activate and delete, an active version take down, and an archived version nothing | 已运行：成功 |
| 更新说明缺 `en` 不能保存 | `versions.form.test.tsx:351` cannot be saved without English update notes, whatever other languages say | 已运行：成功 |
| 只有 `APPVERSION:ACTIVATE` 的管理员看到激活和下线按钮 | `versions.test.tsx:412` shows activate and take down only with APPVERSION:ACTIVATE、`:397`（新建、编辑、删除只在 MANAGE）；`versions.activate.test.tsx:252` | 已运行：成功 |

### 十三、站内通知、客户端配置

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 站内通知：收件账号不存在或非正常状态，整批不发并列出这些账号 | `src/pages/notifications/send.test.tsx:572` lists each bad account with its reason, says nothing was sent, and keeps what was typed；`mock/notifications.mock.test.ts:212`（ACCOUNT_NOT_FOUND 与 ACCOUNT_NOT_ACTIVE 一批列出） | 已运行：成功 |
| 标题正文缺 `en` 或超长不能提交 | `send.test.tsx:245` requires English、`:331` blocks the whole send when one language fails、`:348` … too long；`notifications/compose.test.ts:33` | 已运行：成功 |
| 列表点开能看到全部语言 | `src/pages/notifications/list.test.tsx:378` shows the title and the body in every language、`:397` shows all seven languages of the sample data | 已运行：成功 |
| 客户端配置：`URL` 类型填 `http://` 或空值不能保存 | `src/pages/clientConfig/editor.test.tsx:87` refuses http:// and says why; nothing is sent、`:100` refuses an empty value and a value of spaces only, for a URL | 已运行：成功 |
| 预览显示每个键的来源 | `editor.test.tsx:746` shows the value of the chosen language and marks the source as that language、`:760`；`clientConfig/preview.test.ts:25` | 已运行：成功 |
| 六个键（`phoneLoginEnabled`、`accountDeletionGraceDays`、`conversationLanguages`、`voiceTranscriptMaxChars`、`voiceMinSeconds`、`voiceMaxSeconds`）只读 | `src/pages/clientConfig/list.test.tsx:119` marks exactly the keys the interface says are read only（列出的恰好是这六个）；`editor.test.tsx:509` shows a read-only key with its value, says where it comes from, and has no inputs, Save or Reset；`mock/clientConfig.mock.test.ts:65` marks exactly the six keys of the system configuration read only | 已运行：成功 |
| 一个语言的值校验失败时整个键不保存 | `editor.test.tsx:136` refuses the whole key when one language fails, marks that language on its tab, and sends nothing | 已运行：成功 |

### 十四、形象与装扮（5.24）、投诉（5.25）、用户详情、其他

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| 形象与装扮：没有对应权限码的管理员看不到对应页面 | `config/routes/avatarComplaints.test.ts:45` show each page only to the one permission code of its row；`config/menuByPermission.test.ts`（新） | 补测试后已运行：成功 |
| 服装和动作的 key 创建后只读 | `src/pages/avatar/cosmetics.test.tsx:435` shows the key and the type but does not let them change, and sends neither；`avatar/actions.test.tsx:264`（编辑对话框里 `Key` 被禁用） | 已运行：成功 |
| 适用的端不选任何一项时显示"所有端" | `src/pages/avatar/SurfacesPicker.test.tsx:34` shows "All ends" when nothing is chosen, and the value stays the empty list | 已运行：成功 |
| "给已有外观补生成"有费用提示 | `avatar/actions.test.tsx:102` asks first, and the question says that it costs money; nothing is sent before it is confirmed | 已运行：成功 |
| 上传声明"设为生效"前有确认 | `src/pages/avatar/declarations.test.tsx:98` puts a version in force after a question that says old versions are refused, and only then | 已运行：成功 |
| 系统默认数字人新建必须勾选肖像授权 | `src/pages/avatar/defaultAvatars.test.tsx:357` cannot be sent without the confirmation about the portrait licence | 已运行：成功 |
| 同一时刻只有一个生效 | `defaultAvatars.test.tsx:204` Set active asks first, in words that say … what happens to the active one，并断言原来生效的变为可删除；`:142` active: Rename only；`mock/avatar.mock.test.ts:314`（声明版本同样只有一个生效） | 已运行：成功 |
| 投诉：没有 `COMPLAINT:VIEW` 看不到投诉页 | `config/routes/avatarComplaints.test.ts:45`；`config/menuByPermission.test.ts`（新，reviewer 有该码、finance 没有） | 补测试后已运行：成功 |
| 没有 `COMPLAINT:MANAGE` 看不到状态流转和删除形象按钮 | `src/pages/complaints/likeness.test.tsx:510` shows nothing to change without COMPLAINT:MANAGE, but the evidence and the history、`:524` | 已运行：成功 |
| 过期未结案的行高亮 | `likeness.test.tsx:64` marks the rows that are overdue and not closed, and only those、`:81` shows the whole row in the colour of the mark、`:123` does not mark a closed complaint | 已运行：成功 |
| 删除形象的确认框写明后果 | `likeness.test.tsx:558` asks first, with words that say it deletes looks, clips and files, notifies the uploader and cannot be undone; nothing is sent before | 已运行：成功 |
| 投诉处理：状态下拉只有 `INVESTIGATING`、`RESOLVED_NOT_FOUND`、`REJECTED` | `likeness.test.tsx:350` offers only Investigating, No such avatar found and Rejected as the new state | 已运行：成功 |
| 已结案的投诉不显示状态流转和删除形象按钮 | `likeness.test.tsx:490` has no change or remove button for a closed complaint, whichever way it was closed、`:465` | 已运行：成功 |
| 详情的处理记录与 `LikenessComplaintEvent` 一致（每次流转一行：原状态、新状态、备注、管理员、时间） | `likeness.test.tsx:308` shows the changes oldest first with the state before and after, the note and the administrator；`mock/complaints.mock.test.ts:135` moves an open complaint, records an event with the administrator and the note | 已运行：成功 |
| 用户详情"形象与服装"页签：列出形象（含形象名字）及其外观（风格、状态、预览图、创建时间） | `src/pages/users/detailTabs.test.tsx:371` shows the avatars newest first with the look previews taken from previewUrl, and a placeholder where it is null（名字 Sakura、风格、"In use"、预览图）；`:395` shows the owned outfits and backgrounds with where each came from | 已运行：成功 |
| 持有这个页面所需的权限就能看，没有则 403 | `detailTabs.test.tsx:430` shows the tab to USER:VIEW alone；`mock/avatar.mock.test.ts:105`（support 得 200，finance 得 403） | 已运行：成功 |
| 每次查看都有审计日志 | 前端只能验证提示文字（`detailTabs.test.tsx:364` says … viewing is recorded）和审计页能显示这类记录（`src/pages/system/audit.test.tsx:128`，行 `USER_VIEW_AVATAR`）；mock 里读形象页签不写审计行，真实后端未验证 | 未运行（手工）：见未运行项 3；mock 的缺口见记录项 2 |
| 没有 `COSMETIC:GRANT` 看不到赠送按钮 | `detailTabs.test.tsx:430`；`src/pages/avatar/GrantCosmetic.test.tsx:34` shows the button only to COSMETIC:GRANT | 已运行：成功 |
| 赠送必填理由 | `GrantCosmetic.test.tsx:96` requires a reason of 1 to 500 code points and an item | 已运行：成功 |
| 内容审核队列显示生成的标准图、动作片段两种内容类型，来源筛选有"投诉" | `moderation/queue.test.tsx:156` has Complaint among the sources and the generated image and the action clip among the content types, and sends what is chosen | 已运行：成功 |
| 成本报表能按资源类型筛选 | `cost/report.test.tsx:182`（q.get('resourceType') 为 IMAGE_TO_VIDEO）、`:190`；导出带该参数 `:591` | 已运行：成功 |
| 非 LLM 的行显示数量与单位而不是 token | `report.test.tsx:378` shows the quantity and the unit of a type that is not LLM, and dashes in the token columns、`:407` shows calls and minutes for the other units | 已运行：成功 |
| 全仓库没有写死的 `token=123`、MD5、外部 CDN 地址、未走语言文件的文案 | `tests/noHardcodedText.test.ts`：扫描整个仓库的 `.tsx` 文案、固定 token、MD5、公共 CDN 地址、参照项目名（规则表见该文件 `PatternRule` 列表） | 已运行：成功 |

### 十五、"测试"一段

| 条目 | 对应测试或检查方法 | 结果 |
|---|---|---|
| `access` 判断有单元测试 | `src/access/canAccess.test.ts`（canAccess、filterMenu、access 工厂，共 40 余个用例） | 已运行：成功 |
| 响应封装有单元测试 | `src/request/envelope.test.ts`、`src/request/apiClient.test.ts`、`src/request/errors.test.ts` | 已运行：成功 |
| 分页组件的响应适配有单元测试 | `src/request/errors.test.ts:132` is a list with a total；`PagedListTable.test.tsx:16` asks for page 1 with 20 rows, and shows the rows and the total | 已运行：成功 |
| 配置 schema 校验有单元测试 | `src/pages/config/configSchema.test.ts`（键、权限、类型校验、风险键）；`scripts/configKeys.test.ts` | 已运行：成功 |
| 日期口径转换有单元测试 | `src/utils/utcDay.test.ts`、`src/components/stat/DateRangeUtc.test.tsx:26`（新加坡 01:30、洛杉矶 21:00 等时区）、`tests/smoke.test.tsx:45`（withTimeZone） | 已运行：成功 |
| 登录与权限过滤有组件测试 | 登录：`src/pages/user/login/login.test.tsx`、`enroll.test.tsx`、`change-password/changePassword.test.tsx`；权限过滤：`src/components/Can.test.tsx`、`TabManager.test.tsx:157` opens no tab for a path that is not a page, or for a page the administrator may not see、`config/menuByPermission.test.ts`（新） | 已运行：成功 |
| `lint` 与类型检查在提交前执行 | `.husky/pre-commit`（lint-staged 加 `scripts/typecheck-staged.mjs`）；`scripts/typecheck-staged.test.ts` 测钩子的判断逻辑；本任务的每次提交都经过了这个钩子。钩子本身是否被 git 调起，靠提交时看到的输出确认，没有写成测试 | 已运行：成功（钩子在提交时执行） |

## 语言文件对照收紧到全量

计划步骤 1 要求每个路由 `name`、每个权限码、每个错误码、每个配置键都有两种语言的文字，且每一类都对照来源，不用手写清单。检查前的状况和收紧后的做法：

| 类别 | 收紧前 | 收紧后（测试在 `src/locales/parity.test.ts` 的 `full coverage of the texts against the sources of truth`） | 发现的缺口 |
|---|---|---|---|
| 路由名称 → `menu.<名称链>` | 已有（遍历 `config/routes`），但只看有 `name` 的路由，漏掉没有 `name` 的页面路由，页签标题会退成父级标题 | 加两条：每个页面路由（`indexPages`）的 `titleKey` 在两种语言里都有文字；每个页面路由都有自己的 `name` | 0 |
| 权限码 → `permission.<码>` | 以手写常量 `PERMISSION_CODES` 为准 | 改为从两份快照（规格第 3、4、5 节，契约 17.3、17.4、22.9、23.6、24.2、25.7、26.3、28）按 `extractPermissionCodes` 加排除清单现取，并断言它与 `PERMISSION_CODES` 相等，再逐个查两种语言 | 0 |
| 错误码 → `error.<码>` | `error.test.ts` 已经与契约 1.4 表对照（`errorCodes.generated.json`），但表里读不出来的行会被静默跳过 | 新增 `scripts/contractErrors.ts` 的 `errorTable`：1.4 表的每一行都必须读得出错误码（读不出的列在 `unread` 里，要求为空）；读出的 79 个码必须等于 `errorCodes.generated.json`；逐个查两种语言。契约里 1.4 表以外还出现的大写词（如 `NOT_FOUND`、`REF_CONFLICT`、`PAYLOAD_TOO_LARGE`）是后端调引擎时的错误码，不回给客户端，不在 1.4 表里，不需要文字 | 0 |
| 原因码 → `reason.<码>` | `error.test.ts` 里手写了 14 个原因码的清单 | 改为从契约 1.4 表 `INVALID_REQUEST` 一行里"`reason` 是代码"到"人看的说明"之间的词现取（去掉括号里的解释词，`reasonCodes`），得 14 个；两种语言各自恰好有这 14 个 `reason.*`，没有多余；`error.test.ts` 的清单也改成同一来源。契约里其他地方出现的原因（`OUT_OF_RANGE`、`NOT_AN_INTEGER`、`EMPTY_NOT_ALLOWED`、`INVALID_PATH`、`TOO_LONG`、`INVALID_PATTERN`）都在这 14 个之内 | 0 |
| 配置键 → 名称、说明 | 没有任何测试查 `config.<键>.label` 和 `.desc`；配置页缺文字时静默退回显示键名（`src/pages/config/ConfigRow.tsx:147`） | 从契约 17.5 表（`parseConfigRows`）现取 225 个键，并断言与 `configKeys.generated.json` 顺序相同；两种语言逐键查 `label` 和 `desc`；每个键的前缀组都有 `config.group.<组>`；语言文件里没有不属于这 225 个键的 `config.*.label/desc/risk`；六个风险键两种语言都有 `.risk` | 0 |
| 文字里的隐藏字符 | 整个仓库的扫描里有（`tests/noHardcodedText.test.ts`），但不是对语言文件的值和键 | 加一条：两种语言的每个键和值都不含 `\p{Cf}`、行分隔符、段分隔符，键里不含空白 | 0 |

变异检查（每一类删除两种语言里同一个键，旧的"两种语言键相同"测试看不出来，新测试失败）：
`config.auth.refresh_ttl_days.desc` 删掉 → 配置键对照两条失败；`config.group.sms` 删掉 → 组标题两条失败；`config.guest.call_minutes_total.risk` 删掉 → 风险键失败；`error.ROLE_IN_USE` 删掉 → `error.test.ts` 失败；`reason.INVALID_PATTERN` 删掉 → 失败；`menu.system` 删掉 → 失败；往一个值里放零宽字符 → 隐藏字符测试失败。

结论：语言文件没有缺口，不需要改 `src/locales/{zh-CN,en-US}/` 下任何文件。

## 记录项

记录项 1，已经显示在屏幕上的表单校验提示在切换语言后仍是旧语言。
- 位置：所有用 Ant Design `Form` 且把 `message` 写成当前语言字符串的表单，例如 `src/pages/user/login/index.tsx:86`、`:93`、`:101`；`src` 下有 57 个含表单的文件、121 处 `validator`。
- 触发步骤：打开登录页（英文），什么都不填就点"Sign in"，出现"Enter your user name"；在页头把语言切到 zh-CN。
- 错误结果：按钮和标签变成中文，但红色提示仍是"Enter your user name"，直到该字段再次被校验（输入内容或再次提交）才变成中文。规格 §12 要求"表单校验文字随之变化，没有残留的另一种语言"。
- 原因：Ant Design 把已经产生的提示文字存在表单字段状态里，换语言时字段规则变了但不会重新校验。
- 影响：只在"先触发了校验错误，再切语言"这一刻可见，下一次输入或提交就自动变对；不丢数据，不影响提交结果。
- 测试：`src/locales/switch.test.tsx` 的 `sign-in form: a message that is already on screen is written again in the new language` 现在是 `it.fails`（红灯被预期）；修好后 vitest 会报"预期失败的测试成功了"，那时去掉 `.fails`。同一文件里另外两条（切换后再触发的校验是新语言，登录表单和原因对话框各一条）是成功的。
- 建议：修，选项需要负责人定：一是在语言切换处通知所有已挂载的表单重新校验有错误的字段（需要一个共用的 hook，57 个文件接入）；二是切换语言时让页面内容按语言重新挂载（简单，但会丢掉对话框里已经输入的内容，`TabManager.test.tsx:296` 明确要求切语言不重挂载页面，所以与现有约定冲突）。这是改变页面行为，需要先确认，我没有改。

记录项 2，mock 里读"用户详情的形象与服装"页签不写审计行。
- 位置：`mock/avatar.mock.ts` 里 `GET /api/admin/accounts/:id/avatars` 的处理；`mock/_core/systemData.ts:305` 的 `writeAudit` 只被 `mock/system.mock.ts` 的写接口调用，审计页里 `USER_VIEW_AVATAR` 那一行是固定的样例数据（`systemData.ts:137`）。
- 触发步骤：`npm run dev:mock`，用 root 登录，打开任一用户详情的"形象与服装"页签，再去系统管理的审计日志页。
- 错误结果：没有新增"查看形象"的审计行。规格 §12 要求"每次查看都有审计日志"，mock 不体现，所以这一条无法在 mock 上演示，真实后端也还没验证（未运行项 3）。
- 建议：修（让 mock 在这个读接口里写一行，并在 `mock/avatar.mock.test.ts` 加断言）。这个文件属于形象模块的 mock，本次没有改。

记录项 3，报表类页面里的表格没有逐页的加载态测试。
- 位置：`src/pages/analytics/summary.tsx:54`、`campaign/stats.tsx:331`、`cost/CurrentTab.tsx:226`、`cost/ModelsTab.tsx:255`、`cost/report.tsx:349`、`invite/InviteOverview.tsx:126`、`invite/ShareChannelsTab.tsx:113`、`subscriptions/stats.tsx:125`。
- 现状：这 8 个表格自己不传 `loading`，页面在数据没到时整页显示 `Spin` 或 `ReadState`（代码读过：`campaign/stats.tsx:304`、`cost/CurrentTab.tsx:217`、`subscriptions/stats.tsx:102` 等），不是缺陷；但没有测试把"数据没到时有加载提示"钉住。
- 触发步骤：让接口一直不返回，打开这些页面，应当看到加载提示；没有测试断言。
- 建议：记录；要补的话每个报表页加一条"请求未返回时有 Spin"。

## 未运行项

1. 菜单和无权限地址在真实 Umi 布局里的表现（对应第一组前三条）：真实的 ProLayout 菜单过滤由 Umi 按路由的 `access` 做（`src/access/canAccess.ts:53` 的 `filterMenu` 只被测试使用，生产里的过滤是 Umi 内置行为，任务 4 的评审在 Umi 草稿拷贝上验证过一次）。需要的条件：浏览器，`npm run dev:mock`，分别用 `support`、`finance`、`reviewer` 登录，看侧边菜单是否恰好是 `config/menuByPermission.test.ts` 里算出的页面；再在地址栏直接输入一个无权的页面地址（如 `support` 打开 `/cost/prices`），应看到权限提示页。浏览器走查由另一份报告负责。
2. 切换语言和主题后真实布局的表现：侧边菜单、页签标题、页头是否同时换成新语言，没有残留；切主题时页面是否整页刷新。单元测试覆盖了文字和不重载的调用，但真实重绘需要浏览器。
3. "每次查看形象与服装页签都有审计日志"：需要真实后端（Java 契约里该读接口的审计行为）；mock 不写，见记录项 2。
4. 短信记录导出文件里的号码是否按权限掩码：导出文件由后端写，前端只发请求；需要真实后端和一个没有 `SMS:RECORD:PHONE_VIEW` 的账号导出后打开文件看。

## 本次补的测试

新增用例合计 59 个（含 1 个预期失败）。

| 文件 | 内容 | 用例数 |
|---|---|---|
| `config/menuByPermission.test.ts`（新） | 真实路由树对规格路由总表：页面集合、每页 access 逐一相等；超级管理员、无码管理员、五个预置管理员看到的菜单页面集合（以规格表为准）；父菜单无可见子页时不出现；Umi 的 access 对象对每个有码页面的判断 | 11 |
| `config/configHosts.test.ts`（新） | `CONFIG_HOSTS` 里每个承载页都是真实路由；每个非 `CONFIG:MANAGE` 的编辑权限都有承载页（执行裁决 8） | 2 |
| `scripts/contractErrors.ts`、`scripts/contractErrors.test.ts`（新） | 读契约 1.4 表的错误码和 `INVALID_REQUEST` 行的原因码；读不出的行单独报出 | 7 |
| `src/locales/parity.test.ts`（改） | 上一节的全量对照 | 新增 16 |
| `src/locales/error.test.ts`（改） | 原因码清单改为从契约现取 | 原有用例，数据来源变了 |
| `src/locales/switch.test.tsx`（新） | 切换语言后的校验文字（见记录项 1） | 3（含 1 个 `it.fails`） |
| `src/components/PagedListTable.test.tsx`（改） | 加载态 | 1 |
| `src/pages/pagedTables.test.tsx`（新） | 页内自带表格的加载态、空文字、有数据时无加载态 | 19 |

RED→GREEN 证据（每一类至少一条变异，在改动源码后跑相关测试，看到失败，再还原）：

- `config/menuByPermission.test.ts`：把 `config/routes/channels.ts` 的 `access` 改成 `APPVERSION:VIEW` → `has every page of table 5.0 once, no other page, and the access code of its row` 失败；把 `src/access/canAccess.ts:53` 的菜单过滤改成忽略权限 → 6 个用例失败（无码管理员、support、finance、reviewer 等）；去掉 `config/routes/cost.ts` 里一个页面的 `access` → 6 个用例失败。
- `src/components/PagedListTable.test.tsx`：给 `ProTable` 加 `loading={false}` → `shows the loading state while a page is being read` 失败。第一次写这条测试时多断言了"加载中没有空状态"，失败，原因是 ProTable 在加载时仍画空状态占位，于是去掉了那条错误的断言。
- `src/pages/pagedTables.test.tsx`：把 `sms/PagedTable.tsx`、`system/PagedTable.tsx`、`users/ServerTable.tsx` 的 `loading` 各改成 `false` → 各自对应的用例失败。
- `src/locales/parity.test.ts`：见上一节的变异清单，两种语言同时删一个键时旧测试不报，新测试报。
- `src/locales/switch.test.tsx`：第一次写时直接断言"已显示的提示换成新语言"，失败，DOM 里仍是 `Enter your user name`，由此确认记录项 1；随后改成 `it.fails`。
- 安全相关的变异（验证现有测试能抓住）：给短信渠道表单的凭据框用行里的凭据做初值 → `channels.form.test.tsx` 3 个用例失败；给投放账户表单的令牌框用行里的令牌做初值 → `accounts.campaigns.test.tsx:545` 失败；把调账"本人申请"判断改成 false → `requests.test.tsx:129` 失败；把令牌写到 `localStorage` → `session.test.ts` 4 个用例失败；管理员本人行的保护改成 false → `admins.test.tsx` 5 个用例失败；导出按钮的权限码改成 `STATS:VIEW` → `ExportButton.test.tsx:55` 失败。每次都已还原，`git status` 里没有源码文件留下改动。

## 运行记录

按文件夹分组跑了对照表里引用的全部测试，命令都是 `npx vitest run <路径…>`，Node 24，各组退出码均为 0：

| 组 | 路径 | 结果 |
|---|---|---|
| 配置 | `config` | 46 个文件，515 个用例，全部成功 |
| a | `scripts tests src/access src/app.test.tsx src/session src/request src/services/auth src/components src/locales src/theme src/utils` | 66 个文件；1330 成功、1 个预期失败（`switch.test.tsx` 的 `it.fails`，即记录项 1）、1 个跳过（`scripts/typecheck-staged.test.ts:293`，只在 Windows 上跑） |
| b | `src/pages/user src/pages/pages.test.tsx src/pages/users src/pages/moderation src/pages/subscriptions src/pages/credits src/pages/config src/pages/system` | 51 个文件，857 个用例，全部成功 |
| c | `src/pages/stat src/pages/analytics src/pages/dashboard src/pages/sessions src/pages/invite src/pages/push src/pages/monitor src/pages/memory src/pages/support src/pages/email` | 44 个文件，784 个用例，全部成功 |
| d | `src/pages/activity src/pages/cost src/pages/campaign src/pages/ads src/pages/sms src/pages/channels src/pages/appVersions src/pages/notifications src/pages/clientConfig src/pages/avatar src/pages/complaints src/pages/companionship src/pages/pagedTables` | 77 个文件，1489 个用例，全部成功 |
| e | `mock src/services` | 68 个文件，1238 个用例，全部成功 |

没有跑的测试文件：`src/hooks/useSingleFlight.test.tsx`、`src/buildVars.test.ts`（对照表没有引用）。全量测试、`npm run lint`、`npm run tsc`、`npm run build` 是步骤 1 的内容，不在这份报告里。

第一次想一条命令把这些路径一起跑时，进程在启动阶段输出 `connect ECONNREFUSED 127.0.0.1:3000` 后一直不结束（我没有查清原因，端口 3000 不是本仓库测试用的；同一时间机器上有开发服务器和浏览器走查在运行）。杀掉后改成上面的分组跑，没有再出现。这一条是我没有查清的现象，不是结论。

提交：测试和读契约的脚本 b26d0d9；加载态测试和这份报告见下一次提交。
