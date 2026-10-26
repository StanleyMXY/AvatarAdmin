立即修未修 0、记录项 5、未运行 3、阻塞 0。另有一份给后端的问题文件（统计和分享接口没写清的响应形状，不阻塞）。

# 任务 23 报告：邀请与分享

环境：Node 24.22.1。一次独立评审还没做（按 CLAUDE.md：页面、报表、新增测试做一次独立评审，由主会话安排）。

## 做了什么

- `src/services/invite/`：七个接口各一个带类型的函数：`GET /invites/codes`、`/records`（可按 `rewardStatus` 筛）、`/stats`（`from`、`to`、`limit`）、`/depth-stats`、`/chain`（`rootAccountId`、`maxDepth`）、`/share-funnel`、`/share-channels`（可带 `shareChannel`）。类型字段名取后端第一份回复第 10 条、契约 §17.4 和 §17.6。
- `src/pages/invite/`：
  - `codes.tsx` 邀请码：邀请码、所有者账号 ID、所有者账号创建时间（后端回复写明 `createdAt` 是所有者账号的创建时间，所以列名写全）；服务端分页，长串、非文字值不撑破表格也不崩。
  - `records.tsx` 邀请记录：邀请人和被邀请人只显示掩码标识（`inviterLabel`、`inviteeLabel`），页面上任何地方都不出现完整账号 ID；兑换时间、奖励状态（待满足条件、已奖励、不符合）、不符合原因（六个原因都有译文，不认识的值原样显示）、邀请人和被邀请人已发额度两列（0 显示 0，没有或不是数字显示"—"，负数不显示）；按奖励状态筛选；导出 `invite-records`，带的是已经查询的状态而不是表单里正在改的。
  - `stats.tsx`、`InviteOverview.tsx`、`FissionTab.tsx` 邀请统计，两个页签共用日期范围（UTC）和排行名次，按"查询"才重读：
    - 概览：六个数（总邀请注册、活跃邀请人数、邀请参与率 = `activeInviters / registeredAccounts`、人均邀请数、已奖励邀请数、已发放额度；没有 K-Factor），人均邀请数为 `null`、分母缺失或为 0 显示"—"，负数不显示；趋势图是一张图两条线（每日邀请注册、每日活跃邀请人）；排行（Top N，默认 50，只接受 1 到 200 的整数，否则写出原因且不发请求）每行有"查看裂变"，切到"裂变层级"页签并载入该账号的邀请链；导出 `invite-stats`。
    - 裂变层级（切到页签才读）：平均链路深度（一位小数）、最大链路深度、链数（`totalChains`，根账号数，不叫"节点数"）；柱状图"深度分布"横轴"N 级"、纵轴人数，中间没有人的层级补 0，纵轴只有整数刻度；邀请链：账号 ID 输入框、深度 1 到 `inviteChainMaxDepth`（`useAdminMeta` 给；缺失时不限上界、默认 3，上限小于 3 时默认取上限），树只显示掩码标识和邀请时间，头部写后代数和实际深度；后发的请求赢（先发的后到不覆盖）；账号不存在等错误只显示错误码的译文。
  - `shareStats.tsx`、`ShareOverview.tsx`、`ShareFunnelTab.tsx`、`ShareChannelsTab.tsx` 分享统计，三个页签共用日期范围、"查询"、导出、"重新落地该日"（同时落地 `share-funnel` 和 `share-channel`，落地后两张表都重读）：
    - 总览：四张卡片（总分享 PV、链接点击 PV、下载点击、邀请注册数，都是可相加的计数），没有任何 UV 合计卡片（页面写明原因），每日分享 PV 一条折线。
    - 裂变漏斗：漏斗图 分享 → 链接点击 → 下载点击 → 注册，比率 = 本步 ÷ 上一步（上一步为 0 显示"—"）；四条序列在同一张图里；明细表六列（日期、分享 PV、分享 UV、链接点击 PV、下载点击、注册），逐日显示 UV，没有合计行。
    - 渠道分析：分享渠道下拉（"全部"加数据里出现过的渠道）；饼图和趋势线都是按分享 PV 最多的前 5 个渠道加"其他"（"其他"是各日、各渠道自己的行相加，不是总数减前五，所以不会是负数；并列按名字排）；明细表（日期、分享渠道、PV、UV）；导出：总览和裂变漏斗页签导出 `share-funnel`，渠道页签导出 `share-channel`（选了渠道就带 `shareChannel`）。
    - 没有行的日子：趋势图补 0，合计和卡片不算；一个数缺失、不是数字或为负数时当作"不知道"显示"—"，不进合计；一个合计里没有任何有效数字显示"—"，不显示 0。
  - `rewards.tsx` 奖励设置：`<ConfigForm editPermission="INVITE:CONFIG" />`（9 个 `invite.*` 键，含 `invite.chain_max_depth`），页面写明"金额在发放时记入邀请记录，之后修改只影响之后发放的。"
  - 公用小模块：`numbers.ts`（有效计数、合计、比率）、`chainRules.ts`（深度上限和默认值）、`channelGroups.ts`（前 5 加其他）、`chainTree.ts`、`shareRows.ts`、`useRead.ts`、`ReadState.tsx`（本模块自己的读取钩子，因为不能改共享文件，也没有去引用别的模块的同类文件）、`testSetup.ts`。
- `mock/invite.mock.ts`、`mock/_core/inviteData.ts`：七个接口的假后端。样例是按当天 UTC 日算出来的森林（102 个账号、88 条邀请，三种奖励状态、六种不符合原因、一条 6 层的邀请链、一个邀请 16 人的邀请人、一个没邀请过人的账号、一个 320 字符无空格的标识、泰语、阿拉伯语、越南语、西班牙语、中文、印尼语的掩码标识、一对相隔一秒但跨 UTC 日的邀请）；统计、深度、邀请链、分享漏斗的 `registered` 都从同一批邀请记录算出，所以互相对得上；今天没有分享汇总行（还没落地）；`maxDepth` 上限跟着 `/config` 里 `invite.chain_max_depth` 的当前值；权限、分页、范围、`rewardStatus`、`limit`、`maxDepth`、`shareChannel` 的 400 都带参数名；账号不存在 404 `RESOURCE_NOT_FOUND`。本模块没有写接口，所以没有需要重置的状态，`resetInviteStore` 只清缓存（测试里改了时钟要调用）。
- `config/routes/invite.ts`：邀请菜单四个页面（`INVITE:VIEW`）；奖励设置 `/invite/rewards`（`INVITE:CONFIG`）挂在"活动管理"菜单下，用 `menuGroup('activity', …)` 在本文件里声明，菜单按名字合并（`config/routes.ts` 里本来就注明"奖励设置在活动管理菜单里"），所以 `config/routes/activity.ts` 一个字都没有动，任务 24 填它的页面不会冲突。菜单文字键 `menu.activity.inviteRewards`。
- `src/locales/{zh-CN,en-US}/invite.ts`：本模块所有文字，键相同；没有放行清单（`hardcodedText.allow.json`）。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-invite.md`。

## 红到绿

先写测试，再实现。分三批，每批红的原因都是"功能不存在"（模块不存在、路由是空数组）：

```
npx vitest run mock/invite.mock.test.ts src/services/invite config/routes/invite.test.ts
 ❯ mock/invite.mock.test.ts (0 test)         Failed to resolve import "./_core/inviteData"
 ❯ src/services/invite/invite.test.ts (0 test)  Failed to resolve import "./index"
 ❯ config/routes/invite.test.ts (6 tests | 4 failed)  expected [] to deeply equal [ …(4) ]
 Test Files  3 failed (3)    Tests  4 failed | 2 passed (6)

npx vitest run src/pages/invite config/routes/invite.test.ts      （页面测试，页面和语言文字还没有）
 FAIL  codes.test.tsx / records.test.tsx / rewards.test.tsx / shareStats.test.tsx / stats.test.tsx
       Failed to resolve import "./codes" … "./records" … "./rewards" … "./shareStats" … "./stats"
 FAIL  config/routes/invite.test.ts > point at components that exist / have a menu text in both languages
 Test Files  6 failed (6)    Tests  2 failed | 4 passed (6)

npx vitest run src/pages/invite/numbers.test.ts src/pages/invite/chainRules.test.ts src/pages/invite/channelGroups.test.ts
 FAIL  Failed to resolve import "./numbers" / "./chainRules" / "./channelGroups"
 Test Files  3 failed (3)    Tests  no tests
```

实现之后：

```
npx vitest run src/pages/invite src/services/invite mock/invite.mock.test.ts config/routes/invite.test.ts
 Test Files  11 passed (11)    Tests  137 passed (137)
```

137 个测试：假后端 36（`mock/invite.mock.test.ts`）、服务 7、路由 6、小模块 17（数、深度规则、渠道分组）、邀请码页 5、邀请记录页 9、邀请统计页 27、分享统计页 27、奖励设置页 3。另跑了 `src/locales`（两种语言键相同）和 `tests/noHardcodedText.test.ts`：本模块没有问题；全仓库的"隐藏字符"扫描现在红，原因是别的任务的文件 `mock/activity.mock.test.ts:170`、`:452` 里有非 ASCII 空格，不是本任务的文件（我自己的测试里的阿拉伯语、泰语判断用 `\p{Script=…}`，没有原始特殊字符）。`npx biome check` 对本任务路径没有报错；`npx tsc --noEmit` 对本任务路径没有报错。

## 真实浏览器检查（Playwright，端口 8323，时区 Asia/Singapore）

从暂存区之外的副本（scratchpad 下 `t23/app`，只在副本里给别的任务还没做的页面放了空页面）起 `max dev`，登录 `root`：
- 邀请码：20 行一页，翻到第二页有数据，列头正确；邀请记录：掩码标识、状态标签、原因译文、额度两列；选"不符合"再查询得 20 行，导出下载得到 `invite-records-2026-10-20-2026-10-26.xlsx`。
- 邀请统计：六个数（9.8% 的参与率 = 10 / 102）、一张图两条线、排行 10 行；点第一行的"查看裂变"后切到裂变层级、账号框填了那个 ID、深度 3、树显示 16 个后代、头部"16 descendants, 1 level deep"；深度填 7 显示"The depth must be a whole number from 1 to 5"且没有请求；填 5 能查；填不存在的账号显示"The item was not found."（浏览器控制台里那条 404 是这个请求本身）。
- 分享统计：四张卡片、漏斗图、四条线、明细表（逐日 UV）、渠道页签的饼图和线（前 5 个加"其他"）、下拉 11 项（"全部"加 10 个渠道）、选 line 后明细表只剩 line；导出 `share-channel-…xlsx`；"重新落地该日"发出 `POST /stats/land/share-funnel?date=2026-10-25` 和 `…/share-channel?date=2026-10-25` 两个请求，提示"Re-landed 2026-10-25"。
- 奖励设置：9 个键、提示条；菜单里"活动管理"下有"奖励设置"。
- zh-CN：菜单、提示条、页签、数字标题都是中文；手机宽度 420：四个页面都没有页面级横向滚动（`scrollWidth` 等于 420）。
- 看过截图后修了四处：`InputNumber` 的 `addonBefore` 弃用警告（改成文字加输入框）；`Table` 的 `rowKey` 函数带 `index` 的弃用警告（渠道明细表）；柱状图纵轴出现 0.5、1.5 这种人数刻度（只留整数刻度）；邀请链树里阿拉伯语标识把后面的时间一起打乱（标识放进 `<bdi>`）；饼图的标签挤在小块里，改成在外侧。修完后在浏览器里复查过。
- 停服务：按监听 8323 的进程 PID 结束（`killport.py 8323`，没有用 `pkill -f`），之后 8323 不再响应。浏览器里每次登录前都有一条 401 的控制台提示，是登录页读 `/me` 的请求，不是本模块的请求。

## 变异检查（26 个，每个都跑整个模块的测试）

每个都是改一处判断、跑测试、还原。25 个第一次就变红；1 个第一次没抓到，查清后加强测试再重跑，三次都变红。

- 变红：邀请记录显示账号 ID 而不是掩码标识；额度不检查有效性；导出不带状态；奖励设置页用错权限码（`INVITE:VIEW`）；奖励设置路由权限写错；参与率分子写错（用总邀请注册）；人均邀请数不检查负数；平均深度不要小数；深度上限多一；默认深度不看上限；"查看裂变"不切页签；Top N 上限 201；计数接受负数；漏斗比率拿第一步当分母；渠道保留 6 个；并列不按名字排；落地只落一张表；导出名对调；渠道下拉不筛明细；不认识的原因被隐藏；深度柱状图空层级不补 0（补成 7）；总览里多一张"UV"卡片；假后端 `stats` 不查权限；假后端 `registered` 不来自邀请记录；假后端邀请链默认深度改成 4。
- 第一次没抓到：邀请链的"先发的后到不覆盖"（去掉 `mine === counter.current`）。原因是原来的测试只等了 20 毫秒，整套测试在机器忙时没等到旧答案落地；现在改成在 `act` 里等 80 毫秒，三次都变红。
- 同时把"导出带的是已查询的状态"那条测试改成等到请求发出后再点导出（机器忙时曾偶发变红，是测试的竞争，不是页面的缺陷）。

## 覆盖的语言

界面只有 zh-CN 和 en-US，键相同（`src/locales/parity.test.ts` 通过）。假数据和测试覆盖泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：掩码标识里七种语言的都有（`ส***@h***.co.th`、`م***@y***.com`、`ng***@g***.vn`、`ñ***@c***.es`、`李***@q***.cn`、`a***@d***.id`、电话和账号前 8 位）；320 字符无空格的泰文标识、5000 字符无空格的所有者 ID、非文字的值（数字、对象、`null`）在表和树里不崩也不撑破；UTC 日边界（新加坡 01:30 发的是 26 日，三个页面的测试都有；假后端里相隔一秒跨日的两条邀请各归各的日子）。界面文字本身只在 zh-CN 和 en-US 里看过。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-invite.md`：（1）`share-funnel`、`share-channels` 的外层形状、字段名、没落地的日子怎么办、渠道为空；（2）`chain` 的子节点形状、响应里 `maxDepth` 是实际深度还是请求深度、账号不存在和参数错的错误；（3）`depth-stats` 范围内没有被邀请人时的值；（4）`stats` 的 `limit` 超限、`registeredAccounts` 的口径、`daily` 是否每天一行；（5）记录里额度为 0 还是 `null`、导出的参数；（6）规格 5.12 里渠道下拉作用在哪几块（页面的解读：只筛明细表和导出）。都有暂定做法。

## 需要改共享文件

没有。

## 规格需要在 main 上修改的地方

1. 规格 5.12 裂变层级页签写"链路节点数"，契约冲突表已定为"链数"（`totalChains`，范围内不同根账号的数量，不是节点数）；页面用"链数"，规格正文建议改成同一个说法。
2. 规格 5.12 渠道分析没有写下拉选的渠道作用在饼图、趋势线、明细表中的哪几块，见问题文件第六条。

## 记录项（5）

1. `src/components/EllipsisPopoverText.tsx` 的 `dir="auto"`：以阿拉伯字母开头的掩码邮箱（`م***@y***.com`）在表格里按从右到左排，看上去是"y***.com@***م"。触发：邀请记录页第一列、邀请码页，遇到这样的标识。后果：读起来像乱的，内容没有错。这是共享组件，本任务没改；邀请链树里已经用 `<bdi>` 隔离。建议修（共享组件里把文字放进 `<bdi>`，或加一个强制从左到右的选项）。
2. `src/components/stat/TrendChart.tsx`：纵轴在数值很小时出现 0.5、1.5 这样的刻度（邀请趋势图里每天最多 2 个人时可见）。触发：邀请统计概览，数据里最大值是 2。后果：人数出现小数刻度。共享组件，本任务没改。建议修（对计数的图只留整数刻度）。
3. `src/pages/invite/useRead.ts:25`、`:33`（"后发的请求赢"的判断）：只有邀请链的同类判断有测试，这个钩子本身（邀请统计概览、深度统计、分享统计共用）没有"先发的后到不覆盖"的测试。触发：把两处 `mine !== counter.current` 拿掉，现有测试不变红（没有做这个变异）。后果：改了范围又很快改回去时，旧答案可能盖掉新答案。建议修（补一个两次读取、先发后到的测试）。
4. `src/pages/invite/ShareFunnelTab.tsx` 的漏斗图：最后几步的数字远小于第一步时，小块里的标签（"Download click 535 (37.6%)"、"Sign-up 12 (2.2%)"）压在块的边上，字叠在颜色上不好读（真实浏览器截图里可见）。后果：数字和比率仍在，只是不好读；表格里没有这一列。建议修（在漏斗图下面加一行三个比率的文字，或把标签放到图外）。这是新增显示，按 CLAUDE.md 要先让负责人确认，所以没有自己加。
5. `src/pages/invite/stats.tsx`：改了日期范围或排行名次但没按"查询"就切到裂变页签，读的是上一次查询的范围（这是有意的，范围只在按"查询"时生效），页面没有提示"有未查询的修改"。后果：以为已经换了范围。建议修（在"查询"按钮旁标出有未应用的修改，和日报页一起统一做）。

## 未运行（3）

1. 全量测试和构建：按规则最后一起跑。
2. 用不是 `root` 的管理员做真实浏览器检查（只有查看权限、没有 `STATS:EXPORT`、没有 `STATS:LAND`）：这几点在页面测试里用权限码覆盖（没有 `STATS:EXPORT` 不显示导出、没有 `STATS:LAND` 不显示落地条、只有 `INVITE:CONFIG` 看到 9 个键），真实浏览器里只用 `root` 看过。
3. 真实后端、Firefox、Safari；用 Microsoft Excel 打开导出样例（假后端的样例只有日期和一个数）。

## 变更候选

- 分享统计的渠道下拉如果要同时筛饼图和趋势线，要等规格确认（见问题文件第六条）；这是改变行为，要先和负责人确认。
