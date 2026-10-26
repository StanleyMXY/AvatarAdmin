立即修 0、记录 9、变更 3、不是缺陷 10、阻塞 0

# 任务 16（用户）独立评审

评审对象：提交 04796e4 和 be645eb；对规格 5.7、5.7a、5.0，契约 §2.8、§13.1、§17.4（用户管理、认证事件、多开检测三行和"账号状态与后台操作"矩阵），后端回复第 6–9 条逐项对照。深度按权限和隐私敏感模块（同认证页）做：复现、变异、探针测试。

方法：用 `git archive be645eb` 在草稿目录做了一份副本（`.../scratchpad/t16r-copy`，`node_modules` 软链），所有变异和探针都在副本里做，主检出里没有改任何源文件，也没有提交；唯一写入主检出的是这份报告。副本里先跑任务 16 自己的 14 个文件：265 个测试全绿（与报告一致）；`tests/noHardcodedText.test.ts`（31 个）绿；`npx biome check` 无诊断；`npx tsc --noEmit` 整个项目退出码 0，没有一条在用户模块路径下。没有启动开发服务器，没有看真实浏览器（布局只能凭代码和测试断言判断，这一项我没有核实）。

## 一、结论先说

- 没有发现会输出错误、泄露个人数据或破坏契约的问题（立即修 0）。
- 状态矩阵、权限显示、校验、防重复、页签选择、换账号过期响应：我自己做了 37 个变异，35 个测试变红，2 个存活（都是同一个测试缺口，见记录 1）。
- 规格 5.7、5.7a 和任务书的每个元素逐条对过，页面都有；没有"规格写了而页面缺"的元素。
- 需要负责人看的有三处"变更"（解封的行内确认、改了任务 11 的文件、`?tab=` 取值），和一处"记录"里的提交卫生问题（be645eb 带进了活动模块的未提交文件，当前分支顶端 `src/locales/parity.test.ts` 有 3 个测试红，见记录 2）。

## 二、逐项回答评审要求

### (a) 掩码与隐私

- 邮箱、手机号：列表（`list.tsx` 的 `Cell`）和详情（`OverviewTab.tsx` 的 `MaskedText`）都只显示后端给的值，没有任何客户端还原；缺 `USER:EMAIL_VIEW` / `USER:PHONE_VIEW` 时在值旁边（详情）或列表上方（列表）写明要哪个权限。测试覆盖 `support` 角色和 root 两种。
- 筛选：邮箱、手机号只经 `trimSpec` 去首尾空白后整串发送（`list.tsx` `committedFilters`），不截取、不改大小写；输入框占位文字写"完整邮箱地址（精确匹配）""完整的 E.164 号码（精确匹配）"。页面没有任何"点掩码值去筛选""模糊搜索""提示前缀"的入口，不帮助反推掩码值。变异 `不去空白` 变红。
- 设备哈希前 8 位、推送令牌末 6 位：页面显示后端给的 `deviceIdHashPrefix`/`ipHashPrefix`/`tokenSuffix`，没有复制按钮，令牌前面加"…"。没有在前端再截一次，见"不是缺陷 3"。
- 没有店内购买令牌、第三方登录标识：`UserDetail` 类型和页面都没有这些字段（后端回复第 6 条不返回）；没有凭据类字段，没有任何输入框回显凭据。
- 预览图地址：`AvatarsTab` 只在页签打开时读取（`detail.tsx` 的 `active === 'avatars'`），每次打开重读，地址不写日志、不进 URL、不放本地存储；`grep console` 在用户模块无命中。变异 `一直挂载` 变红。
- 错误文字：已知错误码只显示翻译，不显示后端 `message`（`text.ts` `actionFailure`），有测试。
- 隐藏字符、韩文、en-US 里的中日韩字符：我用脚本扫了用户模块全部文件，0 处。

### (b) 账号状态与后台操作矩阵，逐格核对

| 操作 | ACTIVE | BANNED | PENDING_DELETION | DELETING | 代码位置 | 测试/变异 |
|---|---|---|---|---|---|---|
| 封禁 | 可用 | 不渲染（改显示"解封"） | 禁用 | 禁用 | `accountState.ts` canBan、`BanUserModal.tsx:36` | AccountActions 矩阵测试 + 变异 M1、N13 变红 |
| 解封 | 不渲染 | 可用 | 不渲染 | 不渲染 | `AccountActions.tsx:43-50` | 矩阵测试 + 变异 M20 变红 |
| 发起删除 | 可用 | 可用 | 禁用 | 禁用 | `StartDeletionModal.tsx:36` | 矩阵测试 + N14 变红 |
| 取消删除 | 禁用 | 禁用 | 可用 | 禁用 | `AccountActions.tsx:56-62` | 矩阵测试 + M2 变红 |
| 发放限时权益 | 可用 | 可用 | 禁用 | 禁用 | `EntitlementsTab.tsx:22` | PENDING/DELETING 有测试，M3 变红；BANNED 格没有页面级测试（M6 存活），探针 P2b 实测可用 |
| 撤销限时权益 | 可用 | 可用 | 可用 | 禁用 | `EntitlementsTab.tsx:23` | DELETING/PENDING 有测试，M5、M8 变红；BANNED 格同上 |
| 新建额度申请 | 可用 | 可用 | 禁用 | 禁用 | `CreditsTab.tsx:18` | PENDING/DELETING 有测试，M4 变红；BANNED 格没有页面级测试（M7 存活），探针实测可用 |
| 指派 embedding 模型 | 可用 | 可用 | 禁用 | 禁用 | `AccountMemoryTab.tsx:115`（任务 13 的组件，详情页传 `accountStatus`） | PENDING/DELETING/ACTIVE 有测试；BANNED 格没测 |
| 查看（含 DELETING） | 是 | 是 | 是 | 是 | 详情页不因状态拒绝；`USER.deleting` 账号能打开 | 测试覆盖 |

单元层 `accountState.test.ts` 把 4 个状态 × 全部谓词逐格断言了，并断言未知状态（`SUSPENDED`、`undefined`）不开放需要已知状态的写操作。缺口只在"页面把谓词接到组件上"这一步对 BANNED 列没有断言（记录 1）。

### (c) 理由、确认与防重复

- 封禁理由：`ReasonModalForm` 去首尾空白用 `trimSpec`（29 个码点集合），按码点数 1..500；弹窗里有"这是写给用户看的文字，只有一种语言。"和"封禁会立即结束该账号进行中的通话，不作废登录令牌，解封后原令牌继续可用。"（zh-CN 逐字与规格一致，测试逐字断言）。emoji 500 个按 500 算，5000 字符无空格被拒。变异 M14（上限改 5000）变红。
- 发起删除理由 1..200，说明"与用户自己申请相同，有宽限期，不会立即删除；核对用户身份是客服流程的责任"，并写"理由只进审计日志，不要写用户的内容"。变异 M15（改 500）变红。
- 解封的行内确认不在规格里：见变更 1。
- 409 `INVALID_STATE`：`actionFailure` 在已知文字后加"账号现在的状态：X。"（删除任务写"任务现在的状态"），并让页面重读；变异 N12（不带状态）变红。例外见记录 3。
- 连点只发一次：`ReasonModalForm`（`useSingleFlight`）+ 弹窗自己的"成功后不再发"。我拿掉两个弹窗里的本地保护（M16 `if (banned.current) return;`、M17 `if (started.current) return;`）都变红，证实"弹窗关闭动画里第二次点击由两个弹窗在本地保护"这一说法属实；这个缺陷其实在共用组件里（记录 6）。解封、取消删除用 `useSingleFlight`，测试用 `dblClick` 断言只发一次。
- 请求途中令牌过期不重发：封禁弹窗有测试。

### (d) 页签与 `?tab=`

- 九个页签的查看权限（`detail.tsx` `TAB_CODE`）：概览、形象与服装、归因、会话、设备、认证事件只要 `USER:VIEW`；订阅与权益和额度要 `SUBSCRIPTION:VIEW`；记忆要 `MEMORY:VIEW`——与规格 5.0 的接口栏一致。变异 M9、M10、M11（把三个改成 `USER:VIEW`）都变红。
- `?tab=`：取值 `overview, avatars, attribution, sessions, devices, authEvents, entitlements, credits, memory`；空、未知（含 `constructor`）、无权限的取值都回到概览（用数组 `includes`，不会被原型属性绕过）；点页签写回 `history.replace`；地址变化时跟随。变异 N1（任何非空值都接受）变红。取值本身见变更 3。额度页的链接 `AccountLink.tsx:10` 用 `?tab=credits`，和这里对得上。
- 换账号：`UserDetailPage` 用 `key={id}` 包住整个视图，所有页签、分页、`useRead` 的计数器随之重建；`useRead` 丢弃晚到的旧响应。变异 N3（去掉过期判断）变红；N2（去掉 `key`）变红（"下一个账号从第一页开始"那条新测试，不是旧的慢响应测试）。记忆页签和权益面板自己没有过期判断，靠这个 `key` 保证不串账号（记录见"不是缺陷 9"）。

### (e) 导出

`list.tsx` 的 `ExportButton` 用 `requiredCodes={['USER:EXPORT','USER:VIEW']}`，`url='/users/export'`，参数是"最后一次查询提交的筛选"（`committed`），不是输入框里还没提交的内容。变异 M12（去掉 EXPORT）、M13（去掉 VIEW）、N11（参数用空对象）都变红；两次点击只发一次、被拒绝不存文件有测试（共用组件）。

### (f) 多开检测

- 两个页签（设备、IP），日期范围默认最近 7 个 UTC 日，阈值留空不发参数、填 0 发 `0`，`abuseClusterMinFreeAccounts` 有值时做占位提示，两条说明存在。变异 N5（永远发阈值）变红。
- 免费账号行有"封禁"（`BanUserModal compact`，要 `USER:BAN`），付费行没有；变异 N4（付费也显示）变红。非 ACTIVE 的免费账号行按钮禁用（N13 变红）。
- 完整不透明 key：只作为 `rowKey` 和传给 `GET /abuse/clusters/accounts` 的参数；屏幕上只显示前 8 位（变异 N16 去掉截取，11 个测试变红）；不写日志。key 会出现在表格行的 `data-row-key` 属性里（探针 P4 证实），见"不是缺陷 2"。

### (g) 其他

- 时间：用 `formatInstant`（浏览器时区），多开检测的日期范围明写"UTC 日"并按 UTC 日发 `[from, to)`；计划第 43 行就是这个约定，见"不是缺陷 4"。
- 空值与 0：`countText`/`formatSeconds` 把 `null`、负数、非数字显示"—"，0 显示 0；伴侣名字为空显示"—"（规格写"显示为空"，按项目规则）。
- 非字符串值：所有单元格经 `plainText`/`Cell`，有对象、数字当值的测试；`Thumb` 对 null 显示占位图。
- 布局：`Cell`（3 行截断、`overflowWrap:anywhere`、`maxWidth`）、`UserLink`（2 行）、`EllipsisPopoverText`（封禁原因、最近错误）、标题 `overflowWrap:anywhere`；测试覆盖泰语、阿拉伯语、emoji、5000 字符无空格串的伴侣名字、封禁理由、形象名字、错误文字。真实浏览器布局我没看。
- 写死文字：`noHardcodedText` 扫描通过，没有 `hardcodedText.allow.json`，也不需要。
- 语言文件：`src/locales/{zh-CN,en-US}/users.ts` 键相同、占位符相同（用户模块自己的文件）。第三方名字见"不是缺陷 5"。

### 规格 5.7a 末尾那句的核对

规格 5.7a 最后一条确实写"设备列表不在管理后台，是用户自己的功能（Java 2.9）"，而 5.7 的详情页签里有"设备（平台、App 版本、最近活跃、token 末 6 位）"，契约 §17.4 用户管理行有 `GET /users/{id}/devices`（"推送 token 的平台、App 版本、最近活跃时间，token 值只显示末 6 位"），后端回复第 8 条给了响应字段。契约 2.9 的"设备列表"是用户自己的登录会话 `GET /api/account/sessions`，和后台看的"推送注册"不是一回事，所以报告里的说法属实，前端按 5.7 + 契约 17.4 + 回复第 8 条做设备页签是对的。5.0 没有写 `?tab=` 也属实（5.0 的详情行只列接口），见变更 3。

## 三、记录（9 条）

1. **页面接线对"已封禁"这一列没有测试（变异 M6、M7 存活）**。位置：`src/pages/users/EntitlementsTab.tsx:22`、`src/pages/users/CreditsTab.tsx:18`，测试 `src/pages/users/detailPanels.test.tsx` 只有待删除、删除中、正常三种。触发步骤：把 `grantDisabled={grantBlocked(status)}` 改成 `grantDisabled={status !== 'ACTIVE'}`（或把 `newRequestBlocked(status)` 改成 `status !== 'ACTIVE'`）后跑 `detailPanels.test.tsx` 和 `detail.test.tsx`，49 个全绿。错误结果：已封禁的账号（客服最常处理的情形）发放权益、新建额度申请的按钮被禁用，没有任何测试发现。当前代码本身是对的（探针 P2/P2b：已封禁账号上发放、撤销、新建额度申请均可用）。指派 embedding 模型的 BANNED 格同样没有页面级断言。
2. **提交 be645eb 带进了别的模块的文件**。位置：`src/locales/zh-CN/activity.ts`（+191 行，活动管理模块的未提交工作），任务 16 的第二个提交只应含用户模块路径和报告。触发步骤：`git show --stat be645eb`；在该提交的检出上跑 `npx vitest run src/locales`，`parity.test.ts` 3 个测试红（`activity` 的 zh-CN 有 174 个键，en-US 为空）。错误结果：分支顶端在活动模块提交 en-US 之前一直是红的；如果活动任务被撤销，分支里留着半份文件。自愈条件：活动任务提交 en-US 之后。需要负责人在推送前确认活动模块已提交。
3. **封禁时 409 且重读后状态变成已封禁：弹窗消失，看不到"账号现在的状态"**。位置：`src/pages/users/BanUserModal.tsx:51`（`onDone()`）与 `src/pages/users/AccountActions.tsx:43-53`（状态变成 `BANNED` 后封禁按钮换成解封按钮，`BanUserModal` 被卸载）。触发步骤：详情页打开着一个正常账号，别的管理员先封禁了它；点"封禁"、填理由、提交。错误结果：后端回 409，弹窗随页面重读被卸载，那句"账号现在的状态：已封禁"没有机会被看到（探针 P1：DOM 里没有这句话）；页面最终显示的状态是对的，没有数据错误。待删除、删除中的 409 不受影响（弹窗留着，测试覆盖）。
4. **多开检测的"付费"判断对非布尔值默认放行封禁**。位置：`src/pages/users/abuse.tsx:69`（`row.paid === true ? null : <BanUserModal/>`）。触发步骤：`GET /abuse/clusters/accounts` 的某行 `paid` 缺失、为 `null` 或是字符串 `"true"`（契约要求布尔，所以只在后端出错时发生）。错误结果：探针 P4 里三种行都出现"封禁"按钮，而后端的 `POST /users/{id}/ban` 本身并不拒绝付费账号，付费账号"不处理"只靠这个按钮判断。更稳的写法是只有 `paid === false` 才显示。
5. **时间为空时单元格是空白而不是"—"**。位置：`src/pages/users/list.tsx:120`（`createdAt`）、`src/pages/users/AuthEventsTab.tsx:44`（`at`）。触发步骤：返回的 `createdAt` 或 `at` 为 `null`/空串（契约里这两个字段非空，只在后端出错时发生）。错误结果：`formatInstant('')` 返回空串，单元格空白；同一个模块的其他页面都用"—"。
6. **共用的 `ReasonModalForm` 提交成功后、关闭动画结束前再点"提交"会再发一次请求**（实现者的记录项 1，我用变异 M16、M17 复现：去掉两个弹窗的本地保护后，两个测试变红）。位置：`src/components/ReasonModalForm.tsx`（`useSingleFlight` 只在请求进行中有效）。触发步骤：提交成功后约 200 毫秒内再点"提交"。错误结果：第二次请求——封禁得到 409，发放权益之类不幂等的用法会重复。用户模块的两个弹窗已本地保护；其他用到该组件的模块（任务 11 的发放、任务 12 的驳回等）我没有审，需要在共享组件里修，由地基任务的负责人决定。
7. **概览的"人设审核"显示后端原始状态码**（实现者的记录项 4）。位置：`src/pages/users/OverviewTab.tsx:109`。触发步骤：打开任何有人设审核状态的账号（如 `APPROVED`）。错误结果：英文界面和中文界面都显示同一个未翻译的代码；契约没列取值，所以没有翻译表可对。
8. **三个语言键没有被使用**。位置：`src/locales/zh-CN/users.ts:183`（`users.avatars.name`）、`:187`（`users.avatars.looks`）、`:223`（`users.deletions.noReason`），en-US 同名键 `:187`、`:191`、`:230`。触发步骤：在 `src/pages` 下搜这三个键，零引用。错误结果：无，是死文字；`users.deletions.noReason` 本该用在"原因为空"的提示上，页面现在只显示"—"。
9. **假后端对用户模块的账号 `…a1` 在订阅与权益、记忆页签得到 404**（实现者的记录项 2）。位置：`mock/subscriptions.mock.ts:263`、`mock/memory.mock.ts:158`。触发步骤：开发服务器里打开假账号 `…a1` 的这两个页签。错误结果：显示加载失败。只影响假数据演示。

## 四、变更（3 条，需要负责人确认）

1. **解封加了行内确认**，规格只要求封禁确认。位置：`src/pages/users/AccountActions.tsx:43-50`（`ConfirmActionButton`），文字 `users.unban.confirm`。这是新增的页面行为；去掉的做法是把 `ConfirmActionButton` 换成直接点击的按钮并删 `users.unban.confirm`，同时改 `AccountActions.test.tsx` 的 "unban" 一节。
2. **改了任务 11 的文件**：`src/pages/subscriptions/AccountEntitlementsPanel.tsx` 加了两个可选属性 `grantDisabled`、`revokeDisabled`（默认 `false`，只控制两个按钮的 `disabled`，没有加文字）。我核对了 diff：只有这两处，默认值下行为不变，`AccountEntitlementsPanel.test.tsx` 17 个测试仍全绿；新行为的测试在 `detailPanels.test.tsx`（拿掉后变红：M3、M5）。执行约定要求"别的模块的文件也不碰，写成需要改共享文件并在自己目录里做本地版本"，这一处没有这样做，是否接受要负责人定；回退的后果是待删除账号的权益页签里发放按钮可点，后端仍会拒绝（`ACCOUNT_DELETION_SCHEDULED`）。
3. **`?tab=` 的取值由实现者定**（`overview, avatars, attribution, sessions, devices, authEvents, entitlements, credits, memory`，不认识或无权限的取值回到概览）。规格 5.0 没有写，额度页已经链接 `?tab=credits`；这些取值会变成其他模块链接过来的地址约定。需要负责人确认名字，并由改规格的人写进 5.0 或 5.7（变更请求在 `docs/contract-requests/2026-10-26-admin-frontend-users.md` 第六节第 2 条）。

## 五、不是缺陷（10 条）

1. **规格 5.7a 末尾"设备列表不在管理后台"与 5.7、契约 §17.4 矛盾**：属实，但前端按 5.7 + 契约 17.4 + 回复第 8 条实现是对的；要改的是 AvatarApp main 上的规格，问题文件第六节第 1 条已写成变更请求。
2. **多开聚类完整 key 出现在表格行的 `data-row-key` 属性里**：`src/pages/users/abuse.tsx` 的 `rowKey="key"`。它没有显示、没有写日志，只有管理员自己的浏览器里有；契约就是为了让下一个接口原样传回才返回完整值。
3. **设备哈希和令牌没有在前端再截一次**：`AuthEventsTab.tsx` 的 `hash()`、`DevicesTab.tsx` 的令牌列。字段名 `…Prefix`、`tokenSuffix` 就是后端的保证，任务书要求"显示后端给的前 8 位/末 6 位"；`detailTabs.test.tsx:220` 明确断言"后端给多少显示多少"。
4. **时刻按浏览器时区显示，多开检测的范围按 UTC 日选**：计划第 43 行的约定，范围标签写明"UTC 日"，有测试保证换时区发同样的 UTC 日。实现者列的变更候选不需要确认。
5. **假数据和语言文件里有 Google、Apple、Facebook Ads 等词，`APPSFLYER` 也在假数据里**：它们是契约枚举的登录方式和媒体来源取值（`GOOGLE`、`APPLE`、`source=APPSFLYER`），不是参照项目名；禁用名称扫描通过。
6. **删除任务页对任何状态的行都按重试次数高亮**（`deletions.tsx:46`）：规格 5.7 的字面就是"重试次数超过阈值的行高亮"，不限状态。
7. **详情页不显示宽限期截止时间和发起删除的管理员**（实现者的记录项 5）：规格 5.7 没有要求，后端没有给字段，已写成问题文件第三条，不是页面缺陷。
8. **路由里 `/users/:id` 排在 `/users/deletions` 前面**：我用仓库里的 `react-router` 的 `matchRoutes` 实测，`/users/deletions`、`/users/abuse` 都匹配静态路由，只有其他路径才进详情；顺序是规格 5.0 表的顺序，有测试固定。
9. **任务 11 的 `AccountEntitlementsPanel.tsx:185-197`、任务 13 的 `AccountMemoryTab.tsx:53-60` 没有"晚到的旧响应不覆盖"判断**（实现者的记录项 3）：任务 11 评审已记过；在用户详情里整个视图按账号 `key` 重建，不会串账号。
10. **变异里存活的"取消删除不查账号状态"（假后端）**：`mock/users.mock.ts` 的取消删除同时查账号状态和预定中的任务，去掉账号状态检查不改变任何结果（账号不是待删除时不会有预定中的任务），是等价变异。

## 六、变异清单（37 个，用 `t16r-mut.py` 在副本里每个改一处再跑相关测试文件，每次还原）

红（35）：M1 封禁允许待删除；M2 取消删除不看状态；M3 发放不禁用；M4 新建额度申请不禁用；M5 撤销不禁用；M8 撤销在非正常状态都禁用；M9 额度页签只要 `USER:VIEW`；M10 记忆页签只要 `USER:VIEW`；M11 权益页签只要 `USER:VIEW`；M12 导出只要 `USER:VIEW`；M13 导出只要 `USER:EXPORT`；M14 封禁上限 5000；M15 删除理由上限 500；M16 封禁成功后不再发的保护拿掉；M17 发起删除的同一保护拿掉；M18 封禁按钮不查 `USER:BAN`；M19 发起删除不查 `USER:DELETION`；M20 解封不查 `USER:BAN`；M21 取消删除不查 `USER:DELETION`；N1 `?tab=` 任何非空值都接受；N2 去掉按账号的 `key`；N3 `useRead` 不丢过期响应；N4 付费账号也显示封禁；N5 阈值永远发送；N6 高亮 `>=` 改 `>`；N7 重试按钮对所有行显示；N8 筛选不去首尾空白；N9 409 不让页面重读；N10 形象页签一直挂载；N11 导出参数用空对象；N12 409 不带状态；N13 封禁弹窗不看状态；N14 发起删除不看状态；N15 取不到阈值时用 5；N16 聚类标识显示完整值。

存活（2）：M6 发放按钮在"非正常"时都禁用、M7 新建额度申请在"非正常"时都禁用（见记录 1）。

另有探针测试 `t16r-probe.test.tsx`（只在副本里，已删除）：P1（记录 3）、P2/P2b（已封禁账号的发放、撤销、新建额度申请可用）、P4（记录 4 和 data-row-key）。

## 七、没有核实的

- 真实浏览器里的布局、手机宽度、中文界面渲染：没有启动服务器，没有看。
- 其他用到 `ReasonModalForm` 的模块是否受记录 6 影响：没有审。
- 全量测试和构建：按项目规则留到全部任务做完后；我只跑了任务 16 的 14 个文件、`AccountEntitlementsPanel.test.tsx`、`src/locales` 和 `noHardcodedText`。
