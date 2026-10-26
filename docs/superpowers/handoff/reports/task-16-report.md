立即修未修 0、记录项 5、未运行 2、阻塞 0

# 任务 16：用户（列表、详情、导出、删除任务、多开检测）报告

- 立即修未修 0：我自己的测试、变异检查和真实浏览器里没有留下会输出错误、崩溃、泄露数据或破坏契约的问题。
- 记录项 5：见"记录项"一节。
- 未运行 2：（1）全量测试和构建，按项目规则留到全部任务做完后跑一次；（2）真实浏览器里没有点到的几个操作：导出下载、从多开检测页封禁、赠送服装、发放限时权益、新建额度申请的提交（这些在单元测试和对着假后端的页面测试里测过；浏览器里只看了它们的按钮和对话框的位置）。中文界面在浏览器里只看了渲染，没有点操作。
- 阻塞 0：契约和后端文件没写的点写成了问题文件（见下），本任务按最小做法继续。

## 改了哪些文件

提交 04796e4（主体），之后的小改动（窄屏布局、删除任务页操作列固定在右边、一条新测试）和这份报告在第二个提交里。

- 接口：`src/services/users/{index,types}.ts`、`users.test.ts`（8 个测试）
- 假后端：`mock/users.mock.ts`、`mock/_core/usersData.ts`、`mock/users.mock.test.ts`（49 个测试）
- 路由：`config/routes/users.ts`、`config/routes/users.test.ts`（5 个）。四个页面 `/users/list`（USER:VIEW）、`/users/abuse`（ABUSE:VIEW）、`/users/:id`（USER:VIEW，不进菜单）、`/users/deletions`（USER:DELETION）；站内通知不在这里。
- 语言：`src/locales/{zh-CN,en-US}/users.ts`（两边键相同，`parity` 测试通过）
- 页面 `src/pages/users/`：
  - `list.tsx`（用户列表、七个筛选、导出）、`detail.tsx`（详情页和页签选择）、`deletions.tsx`（删除任务）、`abuse.tsx`（多开检测）
  - 页签：`OverviewTab`、`AvatarsTab`、`AttributionTab`、`SessionsTab`、`DevicesTab`、`AuthEventsTab`、`EntitlementsTab`、`CreditsTab`（订阅与权益、额度、记忆三个页签用任务 11、12、13 的现成组件）
  - 写操作：`BanUserModal`（属性 `{accountId, status, onDone, compact?}`，多开检测页复用）、`StartDeletionModal`、`AccountActions`（封禁/解封/发起/取消删除四个按钮）、`ConfirmActionButton`
  - 共用小件：`accountState.ts`（账号状态矩阵）、`text.ts`（状态和错误的文字、时长、计数）、`useRead.ts`、`ServerTable.tsx`、`Cell.tsx`、`UserLink.tsx`、`statusColors.ts`、`testSetup.ts`
  - 各自的测试：`accountState`（19）、`text`（12）、`useRead`（5）、`BanUserModal`（19）、`AccountActions`（22）、`list`（19）、`detail`（34）、`detailTabs`（22）、`detailPanels`（15）、`deletions`（17）、`abuse`（19）
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-users.md`
- **改了别的模块的文件（需要负责人知道）：** `src/pages/subscriptions/AccountEntitlementsPanel.tsx`（任务 11）。规格要求账号待删除或删除中时"发放限时权益"按钮禁用，撤销在删除中时也被后端拒绝（契约 17.4 状态矩阵），但这个组件只收 `accountId`，没有办法从外面禁用。我只加了两个可选属性 `grantDisabled`、`revokeDisabled`（默认 `false`，不带时行为不变），没有加文字，没有动它的测试和语言文件；新行为的测试在我自己的 `detailPanels.test.tsx` 里。如果不接受，回退这一处，影响是待删除账号的权益页签里发放按钮可点（后端仍会拒绝并显示 `error.ACCOUNT_DELETION_SCHEDULED`）。

测试合计：任务 16 自己的 14 个文件、265 个测试全绿；另跑了 `AccountEntitlementsPanel.test.tsx`（17，没变）、`src/locales`（parity、错误码、权限）、`tests/noHardcodedText.test.ts`（我的文件没有发现；该测试现在红是因为别的模块的 `mock/activity.mock.test.ts:170、452` 有隐藏空白字符，不是我的文件）。`npx biome check` 我的路径无诊断；`npx tsc --noEmit` 我的路径无错误。

## 红到绿

每个测试文件都先写、先跑，确认红是因为"被测模块不存在"，不是拼写或配置：

- `npx vitest run src/services/users` → `Failed to resolve import "./index"`；实现后 8 绿。
- `npx vitest run mock/users.mock.test.ts` → `Failed to resolve import "./_core/usersData"`；实现后第一次 47 个里 7 个红（测试里把页大小写成了数字 `200`，假后端的分页只认字符串，改测试），随后 47 绿，补导出两个测试后 49 绿。
- `npx vitest run config/routes/users.test.ts` → 路由文件还是空数组，4 个红（`expected [] to deeply equal [ [ '/users/list', …`）；填好后 5 绿。
- `src/pages/users/accountState.test.ts` → 把实现文件移走再跑：`Failed to resolve import "./accountState"`；放回后 19 绿。
- `text.test.ts`、`useRead.test.tsx`、`BanUserModal.test.tsx`、`AccountActions.test.tsx`、`list.test.tsx`、`detail.test.tsx`、`detailTabs.test.tsx`、`detailPanels.test.tsx`、`deletions.test.tsx`、`abuse.test.tsx` 都是 `Failed to resolve import "./<被测文件>"`（0 个测试）；实现后分别 12、5、19、22、19、34、22、15、17、19 个绿。
- 实现过程中测试发现并改正的几处：封禁弹窗在关闭动画里被再点一次"提交"会发第二次请求（`BanUserModal.test` 红：`onDone` 被调用 2 次），在两个弹窗里加了"成功后不再发"的保护；设备令牌的省略样式放错了元素（`detailTabs` 红）；删除任务的 409 文字要说"任务现在的状态"而不是"账号"（`deletions` 红，给 `actionFailure` 加了 `about` 参数，`text.test` 先红后绿）。

## 真实浏览器检查

端口 8316，从 `…/scratchpad/task16/app`（仓库副本，`node_modules` 用硬链接，起服务前清掉了 `node_modules/.cache`，否则出现两份 React）起 `npm run dev:mock`，Playwright 登录 `root`。看了：用户列表（21 行、导出按钮在、无横向滚动）、详情的九个页签（英文，逐个截图）、`?tab=credits` 选中"额度"、形象与服装页签里预览图真的加载（`naturalWidth` 240）、第二个形象没有外观、外观的 `null` 预览显示占位图、封禁（弹窗里有两句说明，提交后状态和按钮变成"解封"）、解封（行内确认）、发起删除后出现待删除横幅且封禁按钮禁用、取消删除、待删除账号的额度页签里"新建额度申请"禁用、删除任务页（失败次数 5 和 8 的行整行高亮并带"告警"标记，2 的行不高亮；点"重试"后该任务变为执行中，剩下的重试按钮少一个）、多开检测（两条说明、两个页签、展开聚类，7 个免费账号有"封禁"，2 个付费账号没有；按 IP 页签）、中文界面的列表、详情、形象页签、多开、删除任务和封禁弹窗（渲染）、手机宽度 390（列表、详情、多开、删除任务页面都没有横向滚动）。

发现并修了：
1. 手机宽度下概览的"标签列固定 220 像素"把值挤成一个字一行：窄屏改成标签在上、值在下（`Grid.useBreakpoint`）。
2. 删除任务页的"重试"在 1400 宽度下在表格最右边要横向滚动才看到：操作列固定在右边。

控制台只有预期的请求失败：登录第一步的 401（要验证码），以及假后端里别的模块不认识账号 `…a1` 时权益和记忆页签的 404（见记录项 2）。没有 React 报错。

## 变异检查

34 个，每个改一处关键判断，跑对应的测试文件：

- 状态矩阵：封禁允许待删除账号；取消删除不按状态禁用；发放不禁用；新建额度申请不禁用；撤销不禁用 —— 都红。
- 权限显示：封禁按钮不查 `USER:BAN`；额度页签只要 `USER:VIEW`；记忆页签只要 `USER:VIEW`；导出只要 `USER:VIEW`；删除任务路由改成 `USER:VIEW` —— 都红。
- 校验：封禁理由上限 500 改 5000；删除理由 200 改 500；筛选值不去首尾空白 —— 都红。
- 防重复：封禁和发起删除的"成功后不再发"拿掉；解封/取消删除的行内确认拿掉 —— 都红。
- 页签选择：`?tab=` 任何非空值都接受 —— 红。
- 过期响应：`useRead` 不丢过期的答案 —— 红；详情页去掉按账号的 `key` —— 第一次存活（页大小/页码会带到下一个账号），补了"下一个账号从第一页开始"的测试后红。
- 形象页签不在隐藏时读取、每次打开重读：改成一直挂载 —— 红。
- 数字和文字：负数显示成负数；409 不说当前状态；设备令牌多显示内容 —— 都红。
- 导出：参数用空筛选（不是提交过的筛选）—— 红。
- 删除任务：高亮判断 `>=` 改 `>`；阈值写死 5；重试按钮对所有行都显示 —— 都红（第一次"重试对所有行"的替换因为格式没有生效，改了替换文本后红）。
- 多开检测：付费账号也显示封禁；阈值永远发送（留空发 0）；日期范围改成本地日 —— 都红。
- 假后端：任何状态都能封禁；邮箱筛选改成模糊；邮箱永远不打码 —— 都红。
- 存活 1 个：假后端的"取消删除不查账号状态"（只查有没有预定任务）。账号不是待删除时不会有预定中的任务，所以这个改动不改变任何结果，是等价变异，不是测试缺口。

## 覆盖的语言

界面只有 zh-CN 和 en-US，两边键相同；规格要求的几句话在中文下逐字断言：封禁理由"这是写给用户看的文字，只有一种语言"、封禁后果"封禁会立即结束该账号进行中的通话，不作废登录令牌，解封后原令牌继续可用"、"预览图是用户的脸，查看会被记录"、"没有归因记录"、"发放限时权益不影响商店里的订阅"、多开检测的两条说明、"与用户自己申请相同，有宽限期，不会立即删除；核对用户身份是客服流程的责任"。
假数据和测试覆盖泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文（假后端的伴侣名字、测试里的封禁理由和各个页签的长文字），另有 300 字符无空格串、5000 字符无空格串、emoji（BMP 以外）和类型不对的值（对象、数字）；每个页面的单元格都有"任何文字不撑破表格"的测试。

## 与任务书、规格对照时做的决定

- 邮箱、手机号：列表和详情都原样显示后端给的值；缺 `USER:EMAIL_VIEW` / `USER:PHONE_VIEW` 时列表上方、详情的字段旁写明要哪个权限。
- 设备哈希只显示后端给的前 8 位，推送令牌只显示末 6 位（前面加"…"），没有复制按钮；形象预览每次打开页签重新取，不缓存地址。
- 伴侣名字为空时显示"—"（规格写"显示为空"，按项目的空值规则用"—"）。
- 删除任务页的高亮按规格字面：任何状态的行，重试次数达到 `GET /meta` 的 `deletionAlertAfterFailures` 就高亮；取不到数字（缺项、`null`、不是数字、小于 1）一律不高亮，也不显示阈值说明。
- 409 `INVALID_STATE` 在文字后面写"账号现在的状态：…"（删除任务写"任务现在的状态：…"），并让页面重读；已知错误码只显示翻译，不显示后端的 `message`。
- 取消删除只在账号状态是 `PENDING_DELETION` 时可用（这个状态本身就是宽限期，宽限期满后账号是 `DELETING`）；账号详情不返回宽限期截止时间，见问题文件第三条。

## 问题文件清单

`docs/contract-requests/2026-10-26-admin-frontend-users.md`：（一）`GET /users` 和导出的七个筛选参数名；（二）`GET /users/{id}/sessions` 的字段和分页；（三）账号删除任务按账号筛选，或详情带删除任务，好让详情页显示宽限期截止时间；（四）封禁、解封、发起/取消删除、重试的成功响应；（五）多开检测 `from`/`to` 的格式。都写了暂定做法，假后端和前端按暂定做法做。

## 需要改共享文件

- `src/components/ReasonModalForm.tsx`：提交成功后弹窗还在关闭动画里时，再点一次"提交"会再发一次请求（组件里的防重复只在请求进行中有效）。我在 `BanUserModal`、`StartDeletionModal` 里各自加了保护。建议在组件里加"成功后不再提交"，两处的保护就可以拿掉。
- `src/components/PagedListTable.tsx`：不能给行加 `rowClassName`，所以删除任务页的整行高亮用每一列的 `onCell`。建议加 `rowClassName` 属性。

## 规格需要在 main 上修改的地方

1. 规格 5.7a 末尾"设备列表不在管理后台，是用户自己的功能（Java 2.9）"与 5.7 的"设备"页签、契约 17.4 的 `GET /users/{id}/devices` 矛盾，请删去或改写。
2. 规格 5.0 的用户详情路由没有写页签怎么选；额度页面已经链接 `?tab=credits`。我定的取值：`overview`、`avatars`、`attribution`、`sessions`、`devices`、`authEvents`、`entitlements`、`credits`、`memory`；没有查看权限或不认识的取值打开概览。请写进 5.0 或 5.7。

## 记录项清单

1. `src/components/ReasonModalForm.tsx` 的防重复只在请求进行中有效（见"需要改共享文件"）：触发步骤是提交成功后、弹窗关闭动画结束前再点"提交"；错误结果是第二次请求（对封禁会得到 409）。我的两个弹窗已自行保护，组件本身没改。
2. `mock/subscriptions.mock.ts:263`、`mock/memory.mock.ts:158`：这两个假后端只认各自的账号 ID，用户模块的账号 `…a1` 在"订阅与权益""记忆"页签得到 404 并显示加载失败。只影响假数据下的演示，真实后端里账号存在时不会 404。用户模块的假账号已经包含这两个模块用的 ID（`10000000001`…、`2001`…），用那些账号看这两个页签有数据。
3. `src/pages/subscriptions/AccountEntitlementsPanel.tsx:185-197`（任务 11 评审已记过）：`load` 没有"晚到的旧响应不覆盖新响应"的判断。我用 `key={accountId}` 让换账号时重新挂载，所以换账号不会受影响；同一账号里发放后重读和手动重读重叠时仍可能被旧响应覆盖。
4. `src/pages/users/OverviewTab.tsx` 的"人设审核"一格显示后端给的原始状态码（如 `APPROVED`），没有翻译：契约没有列出这个字段的取值，我没有猜。
5. `src/pages/users/detail.tsx`：账号详情不显示宽限期截止时间和发起删除的管理员（后端没有给，问题文件第三条）；客服只能看到状态。后端给出后加到横幅里。

## 变更候选（需要负责人确认，我没有擅自扩大）

- 解封按钮我加了行内确认（"解封这个账号？它原来的登录令牌会继续可用。"），因为解封会让原来的令牌重新可用；规格只写了封禁要确认。如果不要，去掉 `AccountActions.tsx` 里解封的 `ConfirmActionButton`，改成直接点。
- 删除任务页和多开检测页的时间显示按浏览器时区（同别的页面）；多开检测的日期范围按 UTC 日选，发 `[from, to)` 的 UTC 时刻。

## 开发服务器

我起的端口 8316 的服务已按监听进程的 PID（11844）停掉，停止后端口无监听。（第一次起的 PID 10779 也已按 PID 停掉。）
