立即修未修 0、记录项 4、未运行 0、阻塞 0

# 任务 32 步骤 3：浏览器走查

走查的是提交 `8a4d1b7` 的源码（走查开始时的 HEAD）：把 HEAD 导出到临时目录，`node_modules` 用符号链接，在 8332 端口起 `npm run dev:mock`，用 Playwright 的 Chromium 操作，没有改任何源码。之后到现在 HEAD 多出的三个提交只动了测试、文档和脚本（`git diff --name-only 8a4d1b7..HEAD` 里没有页面、请求层、路由、语言文件的源码），所以结论对现在的 HEAD 同样成立。开发服务器已按监听进程的 PID 停掉，端口确认已关闭。

页面数：路由表里有 83 个页面路由（不含登录、绑定验证器、修改密码三个无布局页面）。83 个都走查了，没走查的页面数 0。其中 81 个有菜单项，另外两个是没有菜单项的详情页（`/users/:id` 打开 `/users/ip-a-01`，`/moderation/:id` 打开 `/moderation/5001`），直接打开。

走查范围的限制：只做了"打开、看、读"，没有点各页面里的写操作按钮（新增、保存、删除、发送等）；英文界面走了全部页面，中文界面只在总览、用户列表、后端参数三个页面核对过；没有在中文界面下核对浏览器标题以外的其余 80 个页面。

## 一、root 的走查（步骤 1）

每个页面用 root 登录后直接输入地址打开，分别在 1440x900 和 390x844 两个宽度各开一次（共 166 次），检查：不是空白页（页面主体文字不少于 30 个字符）、没有错误结果页、页面没有横向滚动（`scrollWidth` 不大于 `clientWidth`）、页面文字、浏览器标题、占位符、`aria-label` 里没有语言文件的键（用 4131 个英文键逐一比对，另外查 `menu.`、`pages.`、`auth.`、`error.`、`permission.`、`reason.` 开头的字串）、控制台没有错误。每次都截了图。

另外用真实点击把侧边菜单逐项点了一遍：23 个菜单组、81 个菜单项全部点进去，每次点击后的地址都等于路由表里的路径，没有漏掉的、多出的菜单项。

结果：166 次打开都没有空白、没有横向滚动、没有漏翻的键、没有未预期的控制台错误。登录前的 401（`POST /api/admin/auth/login`，没有验证码时后端要求第二步）是预期的，没有算进去。例外只有下面"发现"里的四条记录项和两处说明。

| 页面 | 浏览器标题（英文） | 1440 | 390 | 菜单点击进入 | 备注 |
|---|---|---|---|---|---|
| /dashboard | Overview - Admin | 通过 | 通过 | 通过 | — |
| /users/list | User list - Admin | 通过 | 通过 | 通过 | — |
| /users/abuse | Multi-account detection - Admin | 通过 | 通过 | 通过 | — |
| /users/:id | User detail - Admin | 通过 | 通过 | — | 打开 /users/ip-a-01 |
| /users/deletions | User detail - Admin | 通过 | 通过 | 通过 | 浏览器标题显示“User detail”（记录项 1） |
| /users/notifications | User detail - Admin | 通过 | 通过 | 通过 | 浏览器标题显示“User detail”（记录项 1） |
| /moderation/queue | Review queue - Admin | 通过 | 通过 | 通过 | — |
| /moderation/:id | Review detail - Admin | 通过 | 通过 | — | 打开 /moderation/5001 |
| /moderation/rules | Review detail - Admin | 通过 | 通过 | 通过 | 浏览器标题显示“Review detail”（记录项 1） |
| /moderation/stats | Review detail - Admin | 通过 | 通过 | 通过 | 浏览器标题显示“Review detail”（记录项 1） |
| /avatar/cosmetics | Outfits and backgrounds - Admin | 通过 | 通过 | 通过 | — |
| /avatar/actions | Actions - Admin | 通过 | 通过 | 通过 | — |
| /avatar/declarations | Upload declaration - Admin | 通过 | 通过 | 通过 | — |
| /avatar/renderer-models | Renderer models - Admin | 通过 | 通过 | 通过 | — |
| /avatar/generation-tasks | Generation tasks - Admin | 通过 | 通过 | 通过 | — |
| /avatar/default-avatars | Default avatars - Admin | 通过 | 通过 | 通过 | — |
| /complaints/likeness | Likeness complaints - Admin | 通过 | 通过 | 通过 | — |
| /sessions/list | Session list - Admin | 通过 | 通过 | 通过 | — |
| /sessions/analytics | Call analytics - Admin | 通过 | 通过 | 通过 | — |
| /sessions/quality | Call quality - Admin | 通过 | 通过 | 通过 | — |
| /companionship | Companionship settings - Admin | 通过 | 通过 | 通过 | — |
| /subscriptions/list | Subscriptions - Admin | 通过 | 通过 | 通过 | — |
| /subscriptions/entitlements | Entitlements - Admin | 通过 | 通过 | 通过 | — |
| /subscriptions/gates | Feature switches - Admin | 通过 | 通过 | 通过 | 页面顶部两条红色提示“呼叫/文字额度未配置”，来自假数据，是页面设计的提示 |
| /subscriptions/products | Product mapping - Admin | 通过 | 通过 | 通过 | — |
| /subscriptions/events | Event reprocessing - Admin | 通过 | 通过 | 通过 | — |
| /subscriptions/stats | Subscription statistics - Admin | 通过 | 通过 | 通过 | — |
| /credits/products | Credit packs - Admin | 通过 | 通过 | 通过 | — |
| /credits/requests | Credit adjustments - Admin | 通过 | 通过 | 通过 | — |
| /credits/accounts | Credit accounts - Admin | 通过 | 通过 | 通过 | — |
| /credits/transactions | Credit transactions - Admin | 通过 | 通过 | 通过 | — |
| /credits/stats | Credit statistics - Admin | 通过 | 通过 | 通过 | — |
| /ads/campaigns | Campaigns - Admin | 通过 | 通过 | 通过 | — |
| /ads/placements | Placements and global settings - Admin | 通过 | 通过 | 通过 | — |
| /ads/units | Units - Admin | 通过 | 通过 | 通过 | — |
| /ads/creatives | Creatives - Admin | 通过 | 通过 | 通过 | — |
| /ads/report | Ad report - Admin | 通过 | 通过 | 通过 | — |
| /push/templates | Templates - Admin | 通过 | 通过 | 通过 | — |
| /push/tasks | Manual tasks - Admin | 通过 | 通过 | 通过 | — |
| /push/schedules | Periodic pushes - Admin | 通过 | 通过 | 通过 | — |
| /push/records | Send records - Admin | 通过 | 通过 | 通过 | — |
| /push/stats | Push results - Admin | 通过 | 通过 | 通过 | 开发模式控制台有 antd 的 rowKey 废弃警告（记录项 2） |
| /push/recall | Recall parameters - Admin | 通过 | 通过 | 通过 | — |
| /invite/codes | Invite codes - Admin | 通过 | 通过 | 通过 | — |
| /invite/records | Invite records - Admin | 通过 | 通过 | 通过 | — |
| /invite/stats | Invite statistics - Admin | 通过 | 通过 | 通过 | — |
| /invite/share-stats | Share statistics - Admin | 通过 | 通过 | 通过 | — |
| /act/act-signin-config | Check-in setup - Admin | 通过 | 通过 | 通过 | — |
| /act/act-signin-record | Check-in records - Admin | 通过 | 通过 | 通过 | — |
| /act/act-signin-stats | Check-in statistics - Admin | 通过 | 通过 | 通过 | — |
| /act/act-task-config | Task setup - Admin | 通过 | 通过 | 通过 | — |
| /act/act-task-record | Task records - Admin | 通过 | 通过 | 通过 | — |
| /act/act-task-stats | Task statistics - Admin | 通过 | 通过 | 通过 | — |
| /invite/rewards | Reward settings - Admin | 通过 | 通过 | 通过 | — |
| /campaign/stats | Campaign results - Admin | 通过 | 通过 | 通过 | — |
| /campaign/accounts | Campaigns and costs - Admin | 通过 | 通过 | 通过 | — |
| /campaign/attribution | Attribution details - Admin | 通过 | 通过 | 通过 | — |
| /campaign/settings | Attribution parameters - Admin | 通过 | 通过 | 通过 | — |
| /stat/daily | Daily report - Admin | 通过 | 通过 | 通过 | — |
| /stat/retention | Retention report - Admin | 通过 | 通过 | 通过 | — |
| /stat/guest | Guest statistics - Admin | 通过 | 通过 | 通过 | — |
| /analytics/summary | Event summary - Admin | 通过 | 通过 | 通过 | — |
| /analytics/detail | Event detail - Admin | 通过 | 通过 | 通过 | — |
| /analytics/funnel | Funnels - Admin | 通过 | 通过 | 通过 | — |
| /support/feedback | Feedback - Admin | 通过 | 通过 | 通过 | — |
| /memory/tiers | Tiers - Admin | 通过 | 通过 | 通过 | — |
| /memory/models | Embedding models - Admin | 通过 | 通过 | 通过 | — |
| /monitor | Pipeline - Admin | 通过 | 通过 | 通过 | — |
| /monitor/alerts | Alerts - Admin | 通过 | 通过 | 通过 | — |
| /cost/report | Cost report - Admin | 通过 | 通过 | 通过 | — |
| /cost/prices | Prices - Admin | 通过 | 通过 | 通过 | — |
| /config | Backend parameters - Admin | 通过 | 通过 | 通过 | 页面上以代码样式显示的配置键名（如 auth.access_ttl_minutes），是配置键本身，不是漏翻的文案 |
| /config/client | Client configuration - Admin | 通过 | 通过 | 通过 | 页面上以代码样式显示的配置键名（如 auth.access_ttl_minutes），是配置键本身，不是漏翻的文案 |
| /email/templates | Email templates - Admin | 通过 | 通过 | 通过 | — |
| /sms/channels | Channels - Admin | 通过 | 通过 | 通过 | — |
| /sms/templates | Templates - Admin | 通过 | 通过 | 通过 | — |
| /sms/records | Send records - Admin | 通过 | 通过 | 通过 | — |
| /system/admins | Administrators - Admin | 通过 | 通过 | 通过 | — |
| /system/roles | Roles - Admin | 通过 | 通过 | 通过 | — |
| /system/permissions | Permission tree - Admin | 通过 | 通过 | 通过 | — |
| /system/app-versions | App versions - Admin | 通过 | 通过 | 通过 | — |
| /system/channels | Channel packages - Admin | 通过 | 通过 | 通过 | — |
| /system/audit | Audit log - Admin | 通过 | 通过 | 通过 | — |
备注里没有写"记录项"的几条说明：`/subscriptions/gates` 顶部的两条红色提示来自假数据（呼叫和文字额度没配置），是页面设计要显示的业务提示；`/config`、`/config/client` 上被我的键名扫描命中的 `auth.access_ttl_minutes` 之类，是页面以代码样式显示的配置键本身（旁边有中英文名称和说明），不是漏翻的文案。

## 二、support、finance、reviewer 的走查（步骤 2）

各登录一次，各用一个会话：

1. 用真实点击把侧边菜单全部点开并点进每一项，得到的菜单路径集合与"路由表里 `access` 为空或在该账号权限码里的非隐藏页面"逐一比对，缺的 0、多的 0。
2. 83 个页面路径逐个直接输入打开：有权限的页面正常显示，没权限的页面显示"无权限"页（`.ant-result-403`，标题 No permission，副标题写明需要的权限，如 Permission needed: View users），没有一个页面判错；没权限的页面没有发出被后端拒绝的接口请求（403 为 0）。

权限码来自 `mock/_core/permissions.ts` 的 `PRESET_PERMISSIONS`，页面所需的码来自 `config/routes/*.ts`。

| 账号 | 菜单组数 / 菜单项数 | 能打开的页面 | 显示无权限页的页面 | 与权限码的差异 | 每个模块至少打开的页面 |
|---|---|---|---|---|---|
| support | 8 / 14 | 15（含用户详情） | 68 | 0 | 总览、用户列表、站内通知、照片里的人投诉、通话列表、推送效果、签到统计、日报、反馈 |
| finance | 7 / 22 | 22 | 61 | 0 | 总览、通话分析、订阅与额度 11 项全部、推送效果、签到统计、统计报表三项、成本报告、价格 |
| reviewer | 3 / 5 | 6（含审核详情） | 77 | 0 | 总览、审核队列、文本规则、审核统计、照片里的人投诉、审核详情 |

## 三、语言和主题（步骤 3）

- 语言：在总览、用户列表、后端参数三个页面，从英文切到简体中文再切回英文。切换后页面文字变成中文、`<html lang>` 变成 `zh-CN`、浏览器标题变成中文（总览、用户列表、后端参数）、没有漏翻的键、没有控制台错误、没有横向滚动；刷新后仍是中文；`localStorage` 里只有 `umi_locale` 和标签缓存。
- 主题：在总览、用户列表、通话质量三个页面，把浅色、深青、暗蓝各点一遍：选中状态跟着变，截图里背景、卡片、表格、图表颜色都随主题变，没有控制台错误、没有横向滚动。选浅色后刷新仍是浅色（`localStorage` 的 `avatar-admin.theme-mode`）。

## 四、登录流程（步骤 4）

| 检查 | 结果 |
|---|---|
| 没登录直接开 `/users/list` | 跳到 `/user/login?redirect=%2Fusers%2Flist`；登录后回到 `/users/list` |
| 空表单提交 | 显示"Enter your user name"、"Enter your password" |
| 错误密码、不存在的用户名 | 都显示"Incorrect username or password."，不出验证码输入框（不泄露用户名是否存在） |
| 密码对 | 出验证码输入框（此时那一次 401 是预期的） |
| 错误验证码 | "The verification code is wrong, already used, or expired."，没有令牌 |
| 正确验证码 `000000` | 进入页面；令牌只在 `sessionStorage`，`localStorage` 没有、Cookie 为空、地址里没有 |
| 连续错误验证码 | 第 5 次起显示"Too many attempts. Try again in 5 minutes."，锁定期间验证码对也被拒；和 README 一致 |
| 已登录时打开 `/user/login` | 跳到 `/dashboard`；带 `?redirect=%2Fsessions%2Flist` 时跳到 `/sessions/list`；带外部地址 `https://evil.example/x` 时跳到 `/dashboard`，没有离开本站 |
| 已登录时打开 `/user/enroll` | 跳到 `/dashboard` |
| 没登录打开 `/user/enroll`、`/user/change-password`、`/` | 都到登录页 |
| 必须先改密码的账号 `newhire` | 登录后被送到 `/user/change-password`；直接打开 `/users/list`、`/dashboard` 都被送回改密码页；校验提示：少于 12 位、与用户名相同、两次不一致、旧密码错，文字都对；改成功后回登录页并提示"Password changed. Sign in again with the new password."，令牌已清；用新密码能登录进总览 |
| 还没有验证器的账号 `fresh` | 登录后到 `/user/enroll`，显示二维码区域和验证码输入；错误码有提示，`000000` 通过后进总览 |
| 退出登录（头像菜单 Sign out） | 回 `/user/login`，令牌清除；浏览器后退回到登录页，再开 `/dashboard` 仍到登录页 |
| 头像菜单里的 Change password | 打开改密码对话框（不是换页），字段与说明正确 |
| 令牌失效（后端回 401 `ADMIN_INVALID_TOKEN`）：登录后给之后的请求带上一个已失效的令牌，再点菜单 | 跳到 `/user/login?redirect=<原页面>`，出现提示"Your session has expired. Please sign in again."，`sessionStorage` 里的令牌被清；重新登录后回到原页面（`/users/list`、`/cost/report` 试了；无效令牌打开 `/stat/daily` 见下一行） |
| 清掉 `sessionStorage` 的令牌后刷新页面 | 到 `/user/login?redirect=%2Fusers%2Flist`，登录后回原页面 |
| `sessionStorage` 里放一个无效令牌后打开 `/stat/daily` | 到 `/user/login?redirect=%2Fstat%2Fdaily`，令牌被清，登录后回 `/stat/daily` |
| 地址不存在（`/nope/xyz`）、不存在的用户 `/users/does-not-exist`、不存在的审核记录 `/moderation/999999` | 分别显示"Page not found"、"This account does not exist."、"There is no such moderation record"，都带返回入口 |

## 五、发现

### 记录（4）

1. 四个页面的浏览器标题是别的页面的标题。步骤：打开 `/users/deletions`（或 `/users/notifications`、`/moderation/rules`、`/moderation/stats`）读 `document.title`。看到：前两个是 "User detail - Admin"，后两个是 "Review detail - Admin"；应该是各自页面的标题（账号删除任务、站内通知、文本规则、审核统计）。页面内容和页面里的标签页名称是对的（侧边栏高亮我只在 `/moderation/rules` 上看过，是对的），只有浏览器标签页和历史记录里的标题错。原因我读了 `node_modules/@ant-design/pro-layout/es/getPageTitle.js` 的 `matchParamsPath`：它按路由表顺序取第一个匹配的路径，而合并后的路由表里 `/users/:id`、`/moderation/:id` 排在这几个固定路径之前（顺序来自规格表 5.0，`config/menus.ts` 的 `ROUTE_ORDER`），所以 `/users/deletions` 先匹配到 `/users/:id`。只在英文下看了这四个页面的标题；中文界面下总览、用户列表、后端参数三页标题对，这四页我没有在中文下读标题。后果：用户在多个浏览器标签页里分不清哪个是哪个页面，没有数据或权限影响。
2. 登录、绑定验证器、改密码三个无布局页面有一圈 8px 的浏览器默认边距，页面出现竖向滚动条。步骤：1440x900 打开 `/user/login`，`body` 的 `margin` 为 8px，外框从 (8, 8) 开始、宽 1424、高 932，文档 `scrollHeight` 948 大于 `clientHeight` 900；390x844 下 892 对 844。边上还露出一圈和卡片背景不同色的边（暗蓝和浅色主题都有）。没有横向滚动。应该是外框贴满窗口、页面不滚动。后果：登录页多出一条竖向滚动条和一圈边，不影响登录。这三个页面在 `src/pages/user/AuthFrame.tsx` 里。
3. 390 宽度下页头右侧（语言选择、主题切换、头像加用户名）总宽超出窗口，用户名被截掉。步骤：390x844 登录后看任何页面的页头，页头右侧容器的右边缘在 454（窗口宽 390）。头像在 355 到 379，仍能点开，菜单里"Change password"、"Sign out"可用，页面没有横向滚动。后果：窄屏看不到账号名。
4. `/push/stats` 在开发模式的控制台里有一条 antd 的废弃警告（记为 error 级别）：`Warning: [antd: Table] \`index\` parameter of \`rowKey\` function is deprecated. There is no guarantee that it will work as expected.`。步骤：打开 `/push/stats`（support、finance、root 都复现）。位置：`src/pages/push/stats.tsx` 第 197 行 `rowKey={(row, index) => …}`，同一个表的 `dataSource` 里已经给每行加了 `__key`，把 `rowKey` 改成 `"__key"` 即可消除。后果：只是开发模式的警告，生产构建里 antd 不输出；表格行 key 目前仍然唯一。

### 不是缺陷（说明，不计入数量）

- 用 support 走 83 个页面时，有 6 次（support 的总览、通话质量、任务统计、日报、留存报表，finance 的总览）第一次测量得到 `scrollWidth` 大于 `clientWidth`。我用 0.5 秒和 2.5 秒后重新量，并逐个元素找右边缘超出窗口的，1440 宽度下一个也没有（`scrollWidth` 等于 `clientWidth`，等于 1440），root 的 166 次测量也都没有；所以是页面还在加载时的瞬时读数（竖向滚动条出现前后的差），不是横向滚动。390 宽度下超出窗口的只有第 3 条记录项里的页头。
- 清掉 `sessionStorage` 里的令牌但不刷新，继续点菜单不会被送去登录：令牌还在内存里（`src/request/session.ts` 的 `getToken`、`setToken`、`hydrated`），这是"令牌放内存和 `sessionStorage`"的设计，刷新后才从 `sessionStorage` 读；刷新后的行为见上表，是对的。
- 以 root 打开 `/user/change-password`（已登录、不需要改密码）会被送到 `/dashboard`，改密码走头像菜单的对话框，符合设计。

## 六、没走查的页面

没走查的页面数 0。没有做的事：页面里的写操作没点；中文界面只核对三个页面；没有拿泰语、阿拉伯语等界面语言验证（界面只有 zh-CN 和 en-US，假数据里的各种语言文字在页面上都能正常显示，没有截断出错，这一点是看截图确认的，没有逐页比对）。

截图都在临时目录（`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/t32walk/shots/`），不进仓库。
