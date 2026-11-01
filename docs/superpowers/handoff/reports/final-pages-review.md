立即修未修 2、记录项 7、未运行 5、阻塞 0

（记录项 7 是这次评审新发现的；批量修复各报告自己登记、现在仍开着的记录项不重复计入，列在第五节。）

# 批量修复 g2 到 g8 里用户能看到的行为：独立评审（页面和报表类，一次评审，不加复审轮次）

评审对象：`batch-fix-g2-report.md`（外壳、主题、对比度、语言存储、403 页标签栏、标签右键菜单、主题预加载脚本、登录绑定页版式）、`g3`（订阅、额度、记忆、形象）、`g4`（内容审核离开提示、用户、日报留存游客统计）、`g5`（通话质量、埋点、总览、推送）、`g6`（邀请、活动、投放、成本价格）、`g8`。分支 `claude/jolly-dirac-4pq9g6`，被评审的是 HEAD `cc89d91`。没有改任何实现代码。

做法：
- 读了六份报告和 `decisions-2026-10-27.md`，再读对应代码。
- 真实浏览器：Playwright Chromium 153。把 HEAD 导出到草稿目录 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/fp`（`node_modules` 用链接，`MFSU=none`，端口 8420 的 `max dev`，假后端）；另导出一份 `fpb`，跑 `max build`，用小的静态服务（端口 8430，带 `docs/deploy.md` 里的内容安全策略，`/api` 转给 8420）看生产包。脚本和截图都在同一个草稿目录，名字以 `fp-` 开头（例如 `fp-email.png`、`fp-tabs-kbd.png`）。用完按进程号停掉了开发服务器和静态服务。
- 两处"改变异"只在草稿拷贝里做，做完已还原并用 `diff` 确认和仓库一致：给标签页外包装换 `display`（确认第一节第 1 条的根因）、给图表坐标轴文字加 `labelOpacity: 1`（确认第二节第 5 条里图表坐标轴文字的根因）。

## 一、立即修未修 2

### 1. 键盘菜单键、Shift+F10、没有原生右键事件的长按（例如 iOS 的手指长按）打开的标签菜单在屏幕外面，看不见

- 位置：`src/components/layout/TabManager.tsx:198`，包装用的 `<span style={{ display: 'contents' }}>`；菜单由 `open={menuPath === path}` 受控打开（第 183 行起的 `Dropdown`，第 187 行 `autoFocus`）。
- 后果：g2 报告把"标签页的右键菜单只有鼠标能开：键盘没有入口，触屏不触发右键"标成"已修"，但这两条新路径打开的菜单画在 `(-12000, -8000)`，用眼睛看的键盘用户看不到，焦点却已经进了菜单（`autoFocus`）。继续按方向键和回车会在看不见的菜单里执行"关闭""关闭全部"，按 Esc 之后焦点落到页面最前面（`document.activeElement` 没有类名）。右键（鼠标）和 Android Chromium 的长按能用，是因为浏览器自己发了 `contextmenu` 事件，菜单按点的位置摆放；这是原来就有的路径。
- 触发步骤（都复现了）：
  1. 登录 root，打开几个页面让标签栏有 4 个标签，回到总览。
  2. 用键盘聚焦第三个标签（`.ant-tabs-tab-btn`），按 `ContextMenu` 键。测得 `.ant-dropdown` 的位置是 `[-12000, -8000, 116, 200]`，视口 1200x800，截图里没有菜单。Shift+F10 同样。
  3. 另一路：给页面加一个捕获阶段的 `contextmenu` 监听并 `stopImmediatePropagation()`（模拟 iOS 长按不发原生 `contextmenu`），用 CDP 在第三个标签上发 `touchStart`，等 700 毫秒，菜单位置同样是 `[-12000, -8000, 116, 200]`。
- 根因（做了变异确认）：`display: contents` 的元素没有盒子，`Dropdown` 的定位目标是个零大小的矩形，就一直放在屏幕外面。草稿拷贝里把它改成 `display: 'inline-flex'` 后，同样两条路径的菜单位置变成 `[452, 124, 116, 200]`，在第三个标签的正下方。
- 单元测试为什么没看到：`TabManager.test.tsx` 在 happy-dom 里不排版，只断言菜单项出现在文档里。
- 修法建议：给菜单一个有盒子的锚点（把监听挂在 `node` 本身或给包装一个真实的盒子，改完要看标签栏的排版有没有变），再加一条用真实浏览器或读 `getBoundingClientRect` 的检查；Esc 之后把焦点还给标签。变异检查：把包装改回 `display: contents`，新的检查必须变红。
- 带着它上线的后果：键盘用户按菜单键后失去焦点并可能误关标签；iOS 长按没有任何反应。不影响数据。

### 2. 页面顶上的"重试"（网关不可用通知条）会把当前页的未保存编辑清掉，不经过离开提示

- 位置：`src/components/layout/TabManager.tsx:256-259`（`ServiceNotice` 的 `onRetry` 调 `refresh(active ?? pathname)`）；`refresh` 在第 127 行，靠换 `Fragment` 的 `key`（第 261 行）把整个页面卸载再挂载。`src/hooks/useLeaveGuard.ts` 只拦路由跳转和浏览器关闭、刷新，管不到这条路。
- 后果：规则词表页（唯一用 `useLeaveGuard` 的页面，`src/pages/moderation/rules.tsx:170`）正是为了不丢未保存的编辑才加的离开提示。但保存时页面会先读一遍当前列表（第 118 行），这次读如果遇到 502、503、504 的网关页，页面顶上出现"服务暂时不可用"和"重试"；点它之后页面重新挂载，运营在词表里改的行全部没了，没有任何提示。标签右键菜单的"刷新"同样绕过（那是主动操作，不单独算缺陷；这里只说通知条这一条）。
- 触发步骤（复现了）：
  1. 登录 root，打开 `/moderation/rules`，点"添加规则"，在新行的第一个输入框写 `typed-but-unsaved`。
  2. 让 `GET /api/admin/moderation/text-rules` 回 503 的 HTML（Playwright `route`），点"保存列表"。页面顶上出现"服务暂时不可用，请稍后重试"和"重试"，输入框里的字还在。
  3. 把 503 去掉，点通知条上的"重试"。结果：没有离开提示，"有未保存的更改"消失，任何输入框里都没有 `typed-but-unsaved`。
- 修法建议：让 `ServiceNotice` 的重试在页面有未保存的编辑时先问（`useLeaveGuard` 可以登记"当前有编辑"，`TabManager` 的 `refresh` 看到登记就弹同一个确认），或者通知条的重试只重发失败的那个读请求而不重挂页面。变异检查：去掉检查后，一条"有编辑时点通知条重试要先确认"的测试必须变红。
- 带着它上线的后果：词表很长时，一次网关抖动加一次顺手的"重试"会丢掉全部未保存的行。

## 二、记录项 7（这次新发现，文件行号、触发步骤、错误结果）

1. **标签页关闭有未保存编辑的当前页：弹出离开提示，选"留下"后标签栏里这个标签没了，页面还在。** `TabManager.tsx:114-117`：`closeTabs` 先 `setTabs(next)`，再 `open(goTo)`；`open` 是 `history.push`，被 `useLeaveGuard` 拦下。触发：规则词表页点"添加规则"，点这个标签的 ×（或右键菜单"关闭全部""关闭其他"里把它关掉）。结果：弹出"离开这个页面？"，点"留下"，页面和编辑还在，标签栏只剩"总览"，没有任何标签是激活的（`.ant-tabs-tab-active` 为 0），标签列表（`localStorage` 的 `avatar-admin.tabs`）也不再有它；同一地址再点一次菜单不会补回来，要先去别的页再回来。g4 报告写"标签页的'关闭标签'不经过 `history`，所以关标签仍不会提示"，对"当前标签"这一条不对。建议：先调用 `history.push`，确认离开之后再改 `tabs`；非当前标签的关闭没有这个问题。
2. **浏览器把站点数据整个拒绝（读 `window.localStorage` 就抛 `SecurityError`）时，语言下拉选了新语言没有任何变化，并抛出未捕获的异常。** g2 把"浏览器禁用站点数据时选语言界面不变"标成"已修"，报告里的测试是让 `getItem/setItem` 抛，而真实浏览器（Chrome、Firefox 的"阻止所有 Cookie 和站点数据"）是 `window.localStorage` 的读取本身抛。位置：`src/components/layout/LangSwitch.tsx:18` 调的 Umi `setLocale`，它里面的 `navigator.cookieEnabled && typeof window.localStorage != "undefined" && 标志 && setItem(...)` 在检查"是否保存到 localStorage"的标志之前先读了 `window.localStorage`，`config/localeConfig.ts` 的 `useLocalStorage: false` 管不到这一步。触发（复现了，生产包）：在页面加载前把 `window.localStorage` 定义成读取就抛 `DOMException('SecurityError')`，登录（能登录），在语言下拉里选"简体中文"。结果：菜单、`<html lang>`、下拉显示都不变，控制台有 `Uncaught denied`（栈在 Umi 的 `setLocale`）。只让 `setItem` 抛（配额满）则正常切换。对照：`sessionStorage` 同时被拒时登录仍可用，同样切不了语言。这属于"对真实故障的健壮性"类，所以是记录项，但 g2 表里的"已修"对这一情形不成立。建议：不调用 Umi 的 `setLocale`，直接用应用自己的 `activeLocale` 和 Umi 的语言上下文更新；测试里改成让 `window.localStorage` 的读取抛。
3. **操作列在 1440 宽度下在可见范围之外，涉及的页面比 g8 报告记的四个多。** g8 已记为记录项 1（邮件模板、广告单元、告警、短信模板）。我在生产包上量了所有带表格的页面（表头最后一格右边缘减去表格容器右边缘，1440x900，侧栏展开）：邮件模板 894、客户端配置 887、广告位 329、订阅列表 269、广告单元 271、告警 308、短信模板 103、广告计划 84。数字和 g8 报告里的 269/197/75/28 不同（我这里的假数据和等待时间不同，量的是表头右缘），但结论一样：这些页面的"编辑、删除、解决"按钮要先横向滚动才能看到，页面里没有任何可见提示。邮件模板页最明显：只有一列"模板"，它的说明文字不换行，表格宽到 2030 像素，页面主要的动作"编辑、恢复默认"都在右边外面（截图 `fp-email.png`）。没有任何一页在操作列上用 `fixed`（`push/templates` 和 `campaign/accounts` 的操作列在 1440 下可见，是因为够窄，不是因为固定）。位置：各页的操作列定义和 `scroll={{ x: 'max-content' }}`（如 `src/pages/email/templates.tsx`、`src/pages/config` 的客户端配置表、`src/pages/ads/placements.tsx`、`units.tsx`、`campaigns.tsx`、`src/pages/subscriptions/list.tsx`、`src/pages/monitor/alerts.tsx`、`src/pages/sms/templates.tsx`）。建议和 g8 一样：全部修（操作列 `fixed: 'right'`，长文字列给宽度和省略），每页一条读列定义的测试。
4. **打开任何弹窗或抽屉时，整页变宽 8 像素（g3 的"服装抽屉 8 像素"、g8 之外的"共用外壳 390 宽弹层溢出 8 像素"是同一件事），根因已找到。** 触发（复现了）：1360 宽和 1440 宽下，在订阅列表点"详情"（抽屉）、投诉、客服反馈、服装目录的编辑（弹窗），`document.documentElement.scrollWidth` 都比 `clientWidth` 多 8；390 宽下打开"修改密码"弹窗，`scrollWidth` 398 对 390。页面没有纵向滚动条的（记忆档位页）不受影响。根因：`document.body` 有浏览器默认的 `margin: 8px`（`src/global.css` 里没有重置；整个应用外框 `.ant-pro-layout` 的 `x` 就是 8，宽度 1344），弹层打开时 `rc-util` 的滚动锁给 `html body` 加 `overflow-y: hidden; width: calc(100% + 0px)`，body 的宽度变成 100% 加上两边的 margin，于是多出 8 像素，`body` 变成 `overflow-x: auto`，出现 8 像素的横向滚动。g8 只改了登录三页的 `AuthFrame`。建议：在 `src/global.css` 里 `body { margin: 0 }`（先看外壳各处有没有依赖这 8 像素），加一条在真实浏览器或读样式的检查。后果：弹窗打开时页面能横向拖 8 像素，不影响数据。
5. **对比度：仍有几类文字低于 4.5:1，和 g2 报告的"状态色的标签和文字色移到 4.5:1"不完全一致。** 方法：生产包上用脚本对页面里每个可见文字节点算（颜色叠到背景上）的对比度，三个主题各 45 个页面（`fp-contrast2.cjs`）。扫描时机器负载高，有十几个页面出现了错误条，条里红色的"重试"按钮（3.27 到 3.84）是请求超时的结果，不是页面常态，没有计入下面的数字。已达标并验证的：选中日期、范围两端（7.05:1）、圆角单选选中和悬停（浅色 4.78、暗蓝 5.82、深青 6.73）、查询表单"展开"（浅色 4.78）、主按钮（7.05）、成功、警告、危险、信息四种标签和 `Typography` 状态文字（4.57 到 6.2）、次要文字（浅色 4.57）、页头头像。`global.css` 的覆盖在生产包里确实压过了 Ant Design 运行时样式。还不达标的：
   - 预设颜色的标签（`StatusTag` 传 `color: 'green'/'orange'/'gold'` 等，`grep` 数到约 36 处用法）：浅色里"启用"3.37、"已取消"3.34、"宽限期"2.76、"超级管理员"2.76（`/users/list`、`/subscriptions/list`、`/system/admins` 等 11 页）。`src/global.css:49-64` 只覆盖 `success/warning/error/processing` 四种。
   - 危险按钮的文字（`danger` 的链接按钮"删除""关闭"）：浅色 3.27、暗蓝 3.32、深青 3.84，`/monitor/alerts` 的"关闭"、`/push/templates` 的"删除"等（40 个文件用了 `danger`），三个数字依次是浅色、暗蓝、深青里同一个按钮（`/monitor/alerts` 的"关闭"）的值。
   - 信息或错误底色的提示条里的链接 4.27、4.37，行内 `code` 文字 4.35。
   - 图表坐标轴文字：G2 的轴文字默认 `labelOpacity: 0.45`，`labelFill` 虽然设成 `#52606D`，叠出来是 `#B1B7BD`，约 2.0:1。位置：`src/components/stat/TrendChart.tsx:79-80` 和另外 10 个文件里的 `labelFill`（`RetentionTrendChart`、`SummaryTab`、`signinStats`、`sessions/charts`、`ReactivationCharts`、`GuestCohortTab`、`GuestQuotaTab`、`monitor/pipeline`、`FissionTab`、`CostChart`）。草稿拷贝里加 `labelOpacity: 1` 后轴文字是 `#52606D`。
   决定文件只点名了主色文字和暗色下的链接色；g2 自己把状态文字也做了，所以这里按"g2 自己报告的范围没有做全"记录。建议全部修。
6. **`src/components/layout/ChangePasswordForm.tsx:53`：改密码被拒、错误码是 `INVALID_REQUEST` 时，把后端的 `message` 接在译文后面。** 这是 g8 记录项 2，我读了代码，仍在，同意分类。触发：让后端对改密码回 400 `INVALID_REQUEST`，中文界面里看到中文译文加英文句子，违反"错误码已知时只显示译文"。
7. **`index.html` 的视口标签是 Umi 默认的 `user-scalable=no, maximum-scale=1.0`（`dist/index.html` 里能看到，`config/config.ts` 没有覆盖）。** 手机上不能双指放大，低视力的人没有办法放大字（WCAG 1.4.4）。不是这批改动引入的，但 g8 和 g2 都在测手机宽度，所以一并记。建议：用 `metas` 覆盖成 `width=device-width, initial-scale=1`。

## 三、逐项验证 g2 到 g8 报告里"未运行：真实浏览器"的项

| 报告里的未运行项 | 结果 |
|---|---|
| `global.css` 的颜色覆盖是否压过 Ant Design 运行时样式（g2 未运行 1） | 压过了，在 `max build` 的生产包里验证：选中日期 7.05:1，圆角单选选中和悬停、"展开"、状态标签都达标，三个主题（数字见第二节第 5 条）。 |
| `headScripts` 和 `global.css` 是否进了 `dist`（g2 未运行 2） | 进了：`dist/index.html` 的 `<head>` 里有 `<script src="/preload-theme.js">`，`dist/preload-theme.js` 和 `public/preload-theme.js` 逐字节相同，`umi.*.css` 里有 `html[data-theme] .ant-radio-group…` 等规则。 |
| 预加载脚本第一帧（g2 未运行 1） | 正确。把 `umi.*.js` 拖慢 1.5 秒，脚本跑完而应用还没挂载时（`#root` 里 0 个子元素）`<html>` 的背景是 `rgb(21,32,43)`（暗蓝）、`rgb(250,250,250)`（浅色）、`rgb(10,23,27)`（深青），`color-scheme` 也对；应用接手后不变。 |
| 预加载脚本在内容安全策略下可用吗 | 可用：用 `docs/deploy.md` 里那一条策略（`script-src 'self'; style-src 'self' 'unsafe-inline'` 等）提供生产包，登录页和之后的页面没有任何违规；脚本是同域外部文件，通过 `style.backgroundColor` 等 DOM 属性设置，不受 `style-src` 管。 |
| 保存的主题值被篡改时是否安全 | 安全。`public/preload-theme.js` 只在值严格等于 `dim`、`deep`、`light` 之一时才用，其余一律用 `dim`，只把这三个常量写进 `data-theme`，不拼进 HTML 或 URL。逐个试了 `"><img src=x onerror=window.__pwn=1>`、`__proto__`、`constructor`、`toString`、`LIGHT`、` light`：都落到 `dim`，没有 `img`、没有执行（`window.__pwn` 未定义）。`src/theme/modes.ts` 的 `readStored` 同样白名单。读 `localStorage` 抛错时脚本用 `try/catch` 落到 `dim`，整个页面正常。 |
| 脚本不带哈希，更新会不会被浏览器缓存住 | `docs/deploy.md` 已写要 `no-cache`（`index.html` 同一规则）；`dist/preload-theme.js` 确实没有哈希。部署时核对，不是代码缺陷。 |
| 手指长按标签、键盘菜单键（g2 未运行 1） | 见第一节第 1 条：菜单键、Shift+F10、没有原生右键的长按都打开了菜单但位置在屏幕外；右键和带原生 `contextmenu` 的长按位置对；长按后抬手没有当作点击标签（地址没变）；手指移动超过 10 像素不触发（试了移动 30 像素再停留，菜单没开）。 |
| 403 页有标签栏（g2） | 通过：`reviewer`、`support`、`finance` 三个账号直接打开 `/system/admins`，页面是"没有权限"，标签栏里有"总览"。 |
| 未登录时不画壳（g2） | 通过：未登录打开 `/dashboard`，到登录页的整个过程里 `.ant-pro-layout`、`.ant-pro-sider`、`.ant-pro-global-header`、`.ant-tabs` 都没出现过（`MutationObserver`）。 |
| 语言放进应用自己的状态，存储被拒不崩（g2） | 部分：`setItem` 抛时正常，读 `window.localStorage` 就抛时不行，见第二节第 2 条。读 `localStorage` 抛错时登录页、主题、总览都不崩。 |
| 1440 宽度四个页面的操作列溢出（g8 记录项 1） | 复现，范围比报告大，见第二节第 3 条。 |
| 服装抽屉打开时整页比窗口宽 8 像素（g3 记录项 1） | 复现，根因找到，见第二节第 4 条（不只服装，是所有弹窗和抽屉）。 |
| 共用外壳 390 宽弹层溢出 8 像素（g8） | 复现，同一根因，见第二节第 4 条；390 宽的页头头像完整可见，没有溢出（`headerRight` 395 是页头右边容器的边框盒，头像在 366 到 378 之间）。 |
| 通话质量成功率 94.96% 不进位（g5） | 通过：把 `/stats/session-quality` 换成 9496 通、504 失败，卡片显示 `94.96%`，旁边 `低于 95% 时红框`，中文同。用 `tsx` 对 `en-US`、`ar-EG`、`th-TH`、`es-ES`、`zh-CN` 逐个算 `percentAgainst`：`94.96%`、`٩٤٫٩٦٪؜`、`94,96 %` 等都对；边界 `0.95` 写 `95%`、`0.9504` 写 `95.04%`、`0.94999` 写 `94.999%`。 |
| 某天负数或缺失显示"—"并写出天数（g5） | 通过：换成一天 `connected: -5`、一天缺 `agentUnavailable`，卡片是"—"，页面写出"有些日子的数字缺失或不合法（2026-10-26, 2026-10-27）……需要它们的合计和比率显示为'—'"，中英文都对；`limitReached` 等不受影响的卡片仍显示 0。 |
| 成本图悬停提示框（g6 未运行 2） | 通过：悬停柱子，提示框是 `2026-10-27 / render-1 / 4.1912`（完整模型名、十进制文字）。 |
| 邀请和分享计数图纵轴刻度（g6 未运行 2） | 通过：邀请统计图纵轴只有 0、1、2。 |
| 手填价格草稿保留（g6） | 通过：在"手填价格"填提供方（泰文）、模型（带重音）、单价，切到"模型"页签再切回，字段都在；地址写成 `?tab=manual`。 |

## 四、对"最危险的改动"的深度核对

- **金额和比率**：
  - `src/services/cost/decimal.ts`（g6 没有动，我只当它是下游）用 `tsx` 跑了 30 个输入：`12345678901234567890.1234567890`、`0.0000000001`（显示 `<0.000001`）、科学计数法 `1e-7`、`1E+2`、`1e400`（超过 400 位指数被拒绝的边界之内，输出很长的整数但不崩）、`-1.5`、`-0`、`999999.9999995`（四舍五入进位到 `1000000.00`）、`1e21`（数）、`0.1+0.2`、`NaN`、`Infinity`、空串、阿拉伯数字、`1,234.5`、`0x10`、`.5`、`5.`：全部要么精确输出要么为 `null`，没有一个丢精度或显示错数；`addDecimals('0.1','0.2')` 是 `0.3`，`9007199254740993 + 1` 是 `9007199254740994`。
  - 手填价格输入：`1e5`、`0.00000000001`（11 位小数）、`-1`、`١٢٣`、`1,5`、`.5`、`5.` 都被页面的提示拦下；`12345678901234567890.1234567890`（长整数加 10 位小数）和只带前后空白的 ` 7 ` 通过（后端判断上限，`isValidPrice` 的注释写明）。请求体里价格是字符串，不经 `Number`。
  - 投放页的金额（`src/pages/campaign/figures.ts`）是 JSON 数转 `Number` 再 `Intl.NumberFormat`，这是契约要的（金额 JSON 数，手填表单只放行 13 位整数加 2 位小数，`CostModal.tsx:39`、`parseCostBatch.ts:69`），没有精度问题；第三方回传成本最多 6 位小数，不足两位补到两位。
  - 通话质量比率：用 `percentAgainst` 逐一检查，没有发现显示的数字和红框矛盾，只有一个理论上的边界：比率比阈值只小到 1e-8 以内（要上亿次通话的量级）时仍写 `95%` 并画红框，见第六节"不是缺陷"。
- **`useLeaveGuard`**（`src/hooks/useLeaveGuard.ts`）：
  - 没有编辑：点别的标签、`page.reload()` 都不弹，也没有 `beforeunload`。
  - 有编辑：点别的标签弹"离开这个页面？"，再点一次不开第二个，选"留下"后还在页面、编辑还在、标记还是"有未保存的更改"；选"离开"才走；`page.reload()` 触发 `beforeunload`；浏览器后退（在同一文档里）弹同一个提示。
  - 保存成功后（新增一行并保存）："有未保存的更改"消失，之后点别的标签不弹。
  - 切换语言：不弹，行和编辑都保留（`html lang` 变成 `zh-CN`）。退出登录：直接去登录页，不弹（有意的操作）。
  - 多标签页：站内多标签（`TabManager`）——切到别的标签会弹（经过 `history.push`）；关闭当前标签有问题，见第二节第 1 条；"刷新"和通知条的"重试"会静默丢编辑，见第一节第 2 条。浏览器的多个窗口互不影响（`beforeunload` 是按文档的）。
  - 只有规则词表页用它；其他有表单的页面按决定文件"已有的未提交表单保护不动"不接。
- **主题预加载脚本**、**语言存储**：见第三节。

## 五、各报告自己登记、现在仍开着的记录项（核对后同意分类，不重复计入）

- g3 记录项 1（抽屉整页 8 像素）：根因见本次第二节第 4 条，登记的"没有浏览器所以没查清"已经可以改成"body 默认外边距"。
- g3 新发现：`src/pages/push/UploadBox.tsx`、`src/pages/ads/UploadBox.tsx` 的复制品：现在这两个文件已经不在（`ls src/pages/ads src/pages/push | grep -i upload` 无输出），页面用共用的 `UploadField`；弹窗里的原生选文件框在服装、广告素材、推送模板三个页面都是隐藏的（`display: none`）。这一条可以关闭。
- g5 记录项 1（几份相同的小件）：HEAD 上 `cc89d91` 前后的提交说明里已有合并（"Use the shared switch…"、"Use the shared test helpers…"），我没有逐个核对，留给合并报告的评审。
- g6 记录项 1（投放账户页的"活动"页签筛选在切页签后回到默认）：没有复核，页面代码没变；按 g6 原文保留。
- g6 记录项 2（别的模块里的读取钩子、失败条、开关副本）：同上。
- g8 记录项 1（操作列）：见本次第二节第 3 条。
- g8 记录项 2（改密码拼后端 message）：见本次第二节第 6 条。
- g8 记录项 3（`reportLoading.test.tsx` 缺 `kept`）：HEAD 上 `ModelsTab` 的属性 `kept`，我在第三节的"手填价格草稿"里实际走通了页面；测试文件的类型问题没有单独复核。

## 六、不是缺陷（写理由）

- `percentAgainst`（`src/pages/sessions/qualityMetrics.ts:88`）在比率和阈值相差不到 1e-8 时写 `95%` 却画红框：需要上亿次通话且恰好落在这个差里，现实不会出现；`value === limit` 的情形走第一个分支，不会误框。
- 预加载脚本不带哈希：`docs/deploy.md:37` 已写 `no-cache`，是部署约定。
- 5c 里"编辑后浏览器后退没有弹窗"：是我脚本的问题（后退越过了文档边界，触发的是 `beforeunload`，我的对话框处理器自动接受了）；在同一文档内后退（`fp-back.cjs`）弹出了离开提示。
- 退出登录时有编辑不弹：用户主动退出，`signOut` 清令牌直接去登录页，符合预期。
- 通知条"重试"和右键菜单"刷新"是主动操作：右键菜单的"刷新"丢编辑是它的意思；通知条的"重试"丢编辑是第一节第 2 条。

## 七、对照 `decisions-2026-10-27.md` 逐句核对没有回退

方法：读对应代码，加上相关测试（`npx vitest run src/hooks src/components/layout src/theme src/locales src/pages/sessions src/pages/moderation/rules.test.tsx src/pages/system src/pages/clientConfig src/app.test.tsx src/pages/campaign src/pages/cost --testTimeout=60000`，结果见第八节），能在浏览器里看的看了。

| 决定 | 结果 |
|---|---|
| 先做 1：非超级管理员不能对超级管理员行操作；自己那一行禁用重置 | 系统管理页未在浏览器里逐个账号走（mock 里没有"非超级管理员能打开系统管理"的账号）；`src/pages/system/admins.test.tsx` 覆盖，见第八节结果。 |
| 先做 2：权限树取消规则 | 同上，`PermissionTreeSelect.test.tsx`、`permissionRules.test.ts`。 |
| 先做 3：并发保存的乐观检查，含重置 | 规则词表页的保存前重读（`rules.tsx:118`）在浏览器里走过：重读失败时保存被拦下并保留编辑（第一节第 2 条的前半）；客户端配置的 `conflict` 分支在 `ClientConfigEditor.tsx:84、400-408`，测试通过。 |
| 先做 4：当天未过完的数据标临时值，涨跌用中性灰 | 通话质量页的"临时值"标签在浏览器里看到（`Provisional`，浅色 4.59:1）；总览卡片上的"临时值"和灰色涨跌在截图里看到。 |
| 先做 5：表单校验文字切换语言后保留输入只刷新提示 | 44 个文件在用 `useRevalidateOnLocaleChange`；规则页切换语言时行和编辑保留（第四节）。 |
| 全局行为：超时、网关页只对读重试、对比度、不保活、参数页标签标题带标识、强制改密码页退出登录、假后端多语言 | 网关页（读请求 503）显示并带"重试"；不保活（`TabManager.tsx` 注释和 `Fragment` 重挂载）；标签标题带标识（`pageIdentifier`）；对比度见第二节第 5 条（决定点名的"浅色主色文字、暗色链接色"达标，范围外的留有缺口）。超时 30 秒和 5 分钟在 `apiClient`，没有改动。 |
| 模块行为：订阅统计"活跃订阅数"标出是哪一天；默认数字人"生成中"轮询 5 秒、最多 5 分钟；选漏斗后自动查询；批量导入写新增和覆盖几行 | 订阅统计的 `subscriptions.stats.activeAsOf` 文字在；轮询的 5 分钟边界有 `defaultAvatars.polling.test.tsx`；漏斗、批量导入没有在浏览器里走，靠测试。 |
| 补充决定：系统管理对超级管理员行整行无操作；权限树勾功能同时勾上面所有可选页面；禁用原因行内小字 | 同"先做 1"，未在浏览器里验证。 |
| 补充决定：客户端配置重置做同一层版本检查 | 同"先做 3"。 |

没有发现 g2 到 g8 的改动回退了这些决定里的任何一句。

## 八、测试

- 在共用工作区上跑：`npx vitest run src/hooks src/components/layout src/theme src/locales src/pages/sessions src/pages/moderation/rules.test.tsx src/pages/system src/pages/clientConfig src/app.test.tsx --testTimeout=60000 --reporter=dot --maxWorkers=4`：49 个文件、1444 条，1415 通过、29 失败（`src/pages/sessions/list.test.tsx` 11、`src/pages/system/permissionRules.test.ts` 13、`roles.test.tsx` 3、`formFailure.test.tsx` 1、`permissionTree.test.ts` 1）。
- 这 29 条失败不是 HEAD 的问题：跑的时候共用工作区里别的会话在改 `src/pages/system/` 下的文件（`git status` 里 `RoleModal.tsx`、`permissionTree.ts`、`permissionRules.test.ts` 等有未提交改动，HEAD 在这期间也从 `cc89d91` 前进到 `6ff7861`），机器负载也高。把被评审的 HEAD（`cc89d91`，草稿目录 `fp`）里这 5 个文件单独重跑：`npx vitest run src/pages/sessions/list.test.tsx src/pages/system/formFailure.test.tsx src/pages/system/permissionRules.test.ts src/pages/system/permissionTree.test.ts src/pages/system/roles.test.tsx --testTimeout=60000`：5 个文件、138 条全部通过。
- 其余 44 个文件（含 `useLeaveGuard`、标签栏、主题、语言、规则词表页、客户端配置、通话质量页）都通过。
- 我自己写的浏览器脚本不是测试，没有进仓库；它们能复现第一节的两条和第二节的各条。

## 九、未运行 5

1. 屏幕阅读器读标签菜单、省略文字弹出层：这台机器没有读屏软件。
2. 系统管理页（超级管理员行、权限树）在浏览器里的实际走查：mock 里没有"非超级管理员能打开系统管理"的账号，只靠测试。
3. 漏斗页所有步骤人数都是 0 时画成什么样（g5 的未运行）；5000 个字符的权益名在"功能值"抽屉标题里换行（g3 的未运行）：都需要先造数据，没有做。
4. 真实后端联调：后端还没上线。
5. 全量测试：按约定留到最后一次；本次只跑了第八节那一批相关范围。

## 十、阻塞 0

没有只有别人能给的输入。
