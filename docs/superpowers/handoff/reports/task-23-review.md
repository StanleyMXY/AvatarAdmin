立即修 0、记录 5、变更 2、不是缺陷 8、阻塞 0

# 任务 23（邀请与分享，提交 710e21b）独立评审

评审方式：只读 diff 和任务书；在 `git archive 710e21b` 的副本里跑测试和变异（副本在 scratchpad，共享检出里没有改任何源文件）；不起开发服务；没有访问其他仓库。规格 5.12/5.0、契约 §9.1–§9.2、§17.4、后端第一份回复第 10 条逐句对过页面实际渲染的元素。

## 先说结论

- 规格 5.12 和任务书里写到的元素，页面都有（逐项见下面的对照表），没有发现"规格写了页面没有"的情况，所以立即修是 0。
- "链路节点数"与"链数"的冲突：契约对，页面的"链数"对（依据在下面"不是缺陷 1"）。
- 变异：做了 19 个。18 个测试变红；1 个（`useRead` 的"后发请求赢"）测试仍然全绿，也就是报告里说的缺口属实，我另外写了一个探针测试证明这个守卫可测（记录 2）。
- 活动菜单：`config/routes/invite.ts` 里声明的 `menuGroup('activity', …)` 与 `config/routes/activity.ts` 合并正常（验证见"不是缺陷 3"）。
- 本次实际跑的测试：副本（710e21b）上 `src/pages/invite src/services/invite mock/invite.mock.test.ts` 10 个文件 131 个测试全绿；`config/` 全部 20 个文件 163 个测试全绿（其中 activity 路由用的是共享检出里还没提交的 `activity.ts` 加占位页面）；`npx biome check` 本模块 36 个文件无报错。共享检出里 `config/routes/activity.test.ts` 的 5 个失败和 `tests/noHardcodedText.test.ts` 的 2 个失败都来自任务 24 还没完成的文件（`src/pages/activity/*` 页面不存在、`mock/activity.mock.test.ts:170,452` 的特殊空格、`src/pages/activity/texts.test.ts:59` 的韩文字符），不是邀请模块的文件；邀请模块的路径在这两个扫描里没有任何报错。

## 逐句对照（规格 5.12 和任务书 vs 页面实际渲染）

| 规格/任务书的句子 | 页面实际 | 结论 |
|---|---|---|
| 邀请码：列邀请码、所有者账号 ID、创建时间 | `codes.tsx`：三列，创建时间列名写成"所有者账号创建时间"（后端回复写明 `createdAt` 是所有者账号的创建时间） | 有 |
| 邀请记录：邀请人、被邀请人、兑换时间、奖励状态、不符合原因、已发额度；可按奖励状态筛选 | `records.tsx`：邀请人/被邀请人只用 `inviterLabel`/`inviteeLabel`，兑换时间，状态标签，原因译文（六种，未知值原样），已发额度分成"邀请人/被邀请人"两列（契约有两个字段），状态下拉筛选，导出 `invite-records` 带已查询的状态 | 有 |
| 奖励设置：9 个键 + 写明"金额在发放时记进邀请记录，之后修改只影响之后发放的" | `rewards.tsx`：`<ConfigForm editPermission="INVITE:CONFIG" />` + 提示条；`configSchema.ts:752-804` 里 9 个 `invite.*` 键都在（reward_enabled、两个金额、reward_trigger、first_call_min_seconds、max_rewarded_per_inviter、chain_max_depth、reward_start_at、reward_end_at）；测试断言恰好这 9 个行 | 有 |
| 分享统计 `/invite/share-stats`，`INVITE:VIEW`，读汇总表，"重新落地该日"，落地 `share-funnel` 和 `share-channel` | `shareStats.tsx`：`LandBar name={['share-funnel','share-channel']}`，要 `STATS:LAND`，落地后两张表重读 | 有 |
| 总览：四张卡片（总分享 PV、链接点击 PV、下载点击、邀请注册数），无 UV 合计，每日分享 PV 折线 | `ShareOverview.tsx`：四张卡片都是 `sumCounts`，没有 UV 卡，一张图一条线，UV 说明文字 | 有 |
| 裂变漏斗：漏斗图 分享→链接点击→下载点击→注册，比率=本步÷上一步；四条序列趋势线；明细表六列 | `ShareFunnelTab.tsx`：`Funnel` + 标签含比率（第一步无比率，上一步为 0 显示"—"）；一张图四条线；表六列（日期、分享 PV、分享 UV、链接点击 PV、下载点击、注册），逐日 UV，无合计行 | 有 |
| 渠道分析：分享渠道下拉（数据里出现过的 + 全部）、占比饼图、前 5 个渠道趋势线（其余并入"其他"）、明细表（日期、分享渠道、PV、UV）、导出 Excel | `ShareChannelsTab.tsx`：下拉、饼图（前 5 + 其他）、一张图多条线（前 5 + 其他）、四列明细表；导出在页面上方，渠道页签导出 `share-channel`，总览/漏斗导出 `share-funnel` | 有（下拉作用范围见变更 2） |
| 邀请统计：日期范围；KPI 总邀请注册、活跃邀请人数、邀请参与率、人均邀请数；另加已奖励邀请数、已发放额度；没有 K-Factor | `InviteOverview.tsx` 六张卡片，参与率=`activeInviters/registeredAccounts`（分母缺失或 0 为"—"），人均邀请数 `null` 为"—" | 有 |
| 趋势图（每日邀请注册、每日活跃邀请人） | 一张图两条线，`null` 的一天留空、没有行的一天补 0 | 有 |
| 排行（Top N，默认 50）；每行"查看裂变"切到裂变层级页签并载入该账号的邀请链 | 默认 50，只接受 1..200 整数否则写原因且不发请求；"查看裂变"切页签并带账号和深度 | 有 |
| 裂变层级：平均链路深度（一位小数）、最大链路深度、链路节点数（→链数） | `FissionTab.tsx`：三个 `Statistic`，平均深度固定一位小数，第三个"链数"（`totalChains`）带说明 | 有（标签见不是缺陷 1） |
| 柱状图"深度分布"，横轴"N 级"，纵轴人数 | `Column`，横轴"N 级"，纵轴"人数"，空层补 0，纵轴只留整数刻度 | 有 |
| 邀请链树：账号 ID 输入框、深度 1..`invite.chain_max_depth`（默认 3）、`Tree` 展示后代（掩码标识和邀请时间）、头部显示后代数和实际深度 | 账号框、深度框（上限来自 `useAdminMeta().inviteChainMaxDepth`，缺失不限上界、默认 3、上限小于 3 取上限）、`Tree` 只显示 `label` 和时间、头部"后代 N 人，实际深度 N 级" | 有 |
| 导出名 `share-funnel`、`share-channel`、`invite-stats`、`invite-records` | 四个都有，权限为 `STATS:EXPORT` + `INVITE:VIEW` | 有 |
| 路由 `/invite/rewards`（`INVITE:CONFIG`）挂在"活动管理"下 | `config/routes/invite.ts` 用 `menuGroup('activity', …)`；菜单文字 `menu.activity.inviteRewards` 两种语言都有 | 有 |

其他检查：

- 掩码：邀请记录页、邀请链树都只渲染 `…Label`/`label`，节点的 `accountId` 不进 DOM，树的 key 用位置；过滤器只有 `rewardStatus`，没有任何能反推完整标识的筛选。
- UTC 日：默认范围用 `lastNDaysUtc`，选哪天发哪天；页面标注 UTC；新加坡 01:30 的测试覆盖三个页面；兑换时间等时刻按浏览器时区显示（规格的时刻字段如此）。
- null 与 0：`numbers.ts:count/sumCounts/rateOf` 统一把缺失、非数字、负数当"不知道"显示"—"；没有任何一天有数据行时合计显示"—"；0 显示 0。
- 非字符串值：所有渲染点经 `plainText`（表格、树、下拉、排行），`funnelRowsOf/channelRowsOf` 过滤没有日期的行。
- 写入/落地/导出按钮防重复：本模块没有写接口；落地和导出用共用的 `LandBar`、`ExportButton`（内部 `useSingleFlight`，各自有测试，`LandBar.test.tsx`、`ExportButton.test.tsx`）。读取按钮（查询、载入邀请链）不是写操作，由"后发的赢"守卫保护。
- 硬编码文字：`src/pages/invite/*.tsx` 里没有写死的文字（扫描通过，也没有 `hardcodedText.allow.json`）；zh-CN/en-US 键相同、占位符相同（`src/locales/parity.test.ts` 通过）。
- 语言覆盖：假数据含泰语、阿拉伯语、越南语、西班牙语、中文、印尼语的掩码标识，一个 320 字符泰文无空格标识，5000 字符所有者 ID；页面文字本身只有 zh-CN/en-US。

## 变异检查（在副本里，每个变异改一处、跑相关测试、还原；还原后用 `cmp` 对过 710e21b 的原文件）

我自己做了 19 个，其中报告里列出的 17 个（编号 1–17）加 2 个新的：

| 编号 | 变异 | 结果 |
|---|---|---|
| 1 | 参与率分子改成 `totalInvitees` | 红（stats 1 个） |
| 2 | 邀请记录邀请人列显示 `inviterAccountId` | 红（records 5 个） |
| 3 | 漏斗比率分母改成第一步 | 红（2 个） |
| 4 | 渠道保留 6 个 | 红（2 个） |
| 5 | 落地只落 `share-funnel` | 红（1 个） |
| 6 | 渠道页签与其他页签的导出名对调 | 红（2 个） |
| 7 | Top N 上限 201 | 红（1 个） |
| 8 | `count()` 接受负数 | 红（4 个以上，numbers/records/stats/shareStats） |
| 9 | 平均深度不固定一位小数 | 红（1 个） |
| 10 | 深度上限多放 1 | 红（chainRules + stats 各 1 个） |
| 11 | 总览多加一张 UV 合计卡片 | 红（2 个） |
| 12 | "查看裂变"不切页签 | 红（1 个） |
| 13 | 邀请链去掉"先发后到不覆盖" | 红（1 个，就是补强后的那条） |
| 14 | 记录导出不带已查询的状态 | 红（1 个） |
| 15 | 深度柱状图空层补 7 而不是 0 | 红（1 个） |
| 16 | 假后端 `stats` 不查权限 | 红（1 个） |
| 17 | 奖励设置路由权限改成 `INVITE:VIEW` | 红（2 个） |
| 18（新） | "链数"的英文文字改成"Nodes" | 红（1 个）：节点数/链数的区别有测试守着 |
| 19（新，任务要求） | `useRead.ts:27,31` 两处 `if (mine !== counter.current) return;` 全部拿掉 | **仍然全绿**：`stats.test.tsx` + `shareStats.test.tsx` 54 个测试通过。守卫没有测试，见记录 2 |

## 记录（5）

1. 以阿拉伯字母开头的掩码标识显示顺序反了：邮箱 `م***@y***.com` 在表格和邀请链树里都显示成 `y***.com@***م`。位置：共用组件 `src/components/EllipsisPopoverText.tsx:47`、`:60`（两处 `dir="auto"`，邀请记录页、邀请码页、排行表用它显示标识）；本模块自己的 `src/pages/invite/FissionTab.tsx:150`（`<bdi>` 没写 `dir`，默认也是自动判断）。触发步骤：假后端的样例里有 `م***@y***.com`（`mock/_core/inviteData.ts` 的第三种格式），打开邀请记录页看第一列，或在邀请统计里载入含它的邀请链。我用无头 Chromium 渲染静态页面逐字符取位置验证：`<button dir=auto>` 给出 `y***.com@***م`，`<bdi>`（自动方向）给出同样的 `y***.com@***م · 2026-10-20`，`<bdi dir="ltr">` 给出正确的 `م***@y***.com`。所以报告里"树里用了 `<bdi>` 已隔离"只对了一半：隔离了后面的时间，没有修标识内部的顺序。分类理由：文字内容和复制出的内容是对的，只是阅读顺序错，掩码标识用来辨认而不是核对，所以不是"输出错误"的立即修；但阿拉伯语是目标市场，客服会把域名先读到。带着它上线的后果：阿拉伯语邮箱的客服把 `y***.com@***م` 当成另一个地址或认不出来。建议修：树里改成 `<bdi dir="ltr">`（本模块内可改）；共用组件加一个固定从左到右的选项或对标识类文字默认 `dir="ltr"`（需要改共享文件）。
2. `useRead` 的"后发的请求赢"没有测试：`src/pages/invite/useRead.ts:27`、`:31`。触发步骤：把这两行判断删掉，`stats.test.tsx`、`shareStats.test.tsx` 54 个测试照样全绿（我做了这个变异）。错误结果：邀请统计概览、深度统计、分享统计的两张表共用这个钩子，用户改日期范围后快速再改一次并按"查询"时，先发的慢答案会盖掉新答案，页面显示旧范围的数字，而日期框显示新范围。我另写了一个 25 行的探针测试（副本里，没有提交）：渲染一个用 `useRead` 的小组件，先读 a、切到 b、让 b 先返回、再让 a 返回，断言仍显示 b；在 710e21b 上通过，删掉两行判断后失败（`expected 'old' to be 'new'`）。建议修：把这个测试补进 `src/pages/invite/`（用 `renderPage` 渲染一个小探针组件即可）。
3. 计数趋势图纵轴出现 0.5、1.5 这样的人数刻度：共用组件 `src/components/stat/TrendChart.tsx:56`（`y` 轴没有整数刻度限制，`FissionTab.tsx` 的柱状图自己做了）。触发步骤：邀请统计概览，范围内每天最多 2 人。错误结果：人数轴上有小数刻度。本模块无法单独修（需要共享文件），建议修：给 `TrendChart` 加"整数刻度"选项，邀请和分享的图打开。
4. 漏斗图小块里的标签难读：`src/pages/invite/ShareFunnelTab.tsx:43,62`。比率只出现在图的标签里（明细表的列由规格固定，没有比率列）。作者在真实浏览器截图里看到最后几步数字远小于第一步时，标签压在颜色上不好读；我没有起开发服务，没有复现，按作者的描述记录。触发步骤：下载点击、注册远小于分享时看漏斗页签。错误结果：比率（本任务要求展示的数字）难以读清。建议修前先让负责人看过，因为"加一行文字写三个比率"属于新增显示（按 CLAUDE.md 是变更，所以这里只记录现象，不由我们顺手加）。
5. 邀请链请求被后端以 400 拒绝时只显示通用文字：`src/pages/invite/FissionTab.tsx:82` 用 `describeFailure(intl, error).text`，丢掉了 `fields`（哪个参数、什么原因）。触发步骤：深度上限来自登录时取的 `/meta`；另一位管理员把 `invite.chain_max_depth` 从 5 改成 3 之后，这个页面还拿着 5，填深度 5 载入邀请链，后端返回 400 `INVALID_REQUEST`（`details` 的 `ref` 为 `maxDepth`）。错误结果：页面只显示"输入有误，请检查各字段"，不说是深度、不说上限是多少，而页面上并没有哪个字段被标红。建议修：把 `fields` 的文字拼进失败提示。

## 变更（2）

1. 规格 5.12 总览段落写"UV……只在趋势图和明细表里逐日显示"，页面的趋势图（总览：每日分享 PV 一条线；漏斗：四条步骤线；渠道：前 5 个渠道的 PV 线）里都没有 UV 序列，UV 只在漏斗和渠道页签的明细表里。我把这句话读成"UV 只能逐日显示、不能合计"，不是"必须在趋势图里画 UV"，因为同一段对各个趋势图的内容已经写了具体序列。如果负责人的意思是趋势图里也要有 UV 线，那是新增序列，需要先确认：画在哪张图、几条线、是否和 PV 同一张图（量纲相同，都是人次/人数）。
2. 渠道下拉的作用范围（作者在问题文件第六条已提）：页面让下拉只筛明细表和导出，饼图和前 5 趋势线始终是全部渠道。契约 §17.4 的 `share-channels` 接口有 `shareChannel` 参数，说明后端的筛选是接口级的，而页面总是不带这个参数、在前端筛明细行。若规格的意思是三块都筛，需要改成"选了渠道就带参数重新读，饼图只有一块"并决定下拉选项在选中后是否仍取自未筛选的数据。需要负责人（或改规格的会话）确认后再改。

## 不是缺陷（8）

1. 规格的"链路节点数"与契约的"链数"：契约对，页面用"链数"是对的。依据：契约 §17.4 邀请管理行 `backend-task-java-backend.md:2302` 写明 `totalChains` 是"范围内不同根账号（没有邀请人的账号）的数量"；契约自检清单 `:3158` 写"`depthDistribution` 各深度的 `count` 之和等于范围内被邀请人数（`totalChains` 是范围内不同根账号数，两者只有每个根账号恰好邀请一人时才相等）"，也就是说它不是节点数；计划的冲突表第 135 行已裁决"页面显示'链数（根账号数）'"。页面标签是"链数"，旁边的说明文字写"所选范围内被邀请人所属的不同根账号（没有邀请人的账号）的数量"（`src/locales/zh-CN/invite.ts:55-56`、`en-US/invite.ts:55-57`），含义对；标签没有把"（根账号数）"写进括号，但任务书的写法"链数（`totalChains`，根账号数）"里括号是对含义的说明，说明文字已承担。假后端 `depth-stats` 的 `totalChains` 也是范围内被邀请人所属根账号的去重数（`mock/invite.mock.ts` depth-stats 处）。规格 5.12 正文该改成"链数"（作者已列入"规格需要在 main 上修改的地方"）。
2. 假数据和测试里的渠道名（`whatsapp`、`facebook`、`line`、`telegram`、`instagram`、`messenger`、`twitter`、`tiktok`、`sms`、`unknown`，在 `mock/_core/inviteData.ts` 的 `SHARE_CHANNELS` 与 `shareStats.test.tsx`）：这是 `shareChannel` 这个数据字段的取值（用户在系统分享面板里选的目标应用的短码），契约 §9.2 和事件表 `backend-task-java-backend.md:1264` 自己就以 `whatsapp`、`telegram`、`copy_link` 为例；其余是同类短码；页面文字、标识符、文件名里都没有第三方名字；没有应用商店名。按规格允许处理，不算违反"仓库里不出现第三方产品名"。
3. 活动菜单合并：`config/routes/invite.ts` 的 `menuGroup('activity', […奖励设置])` 与 `config/routes/activity.ts`（共享检出里的未提交版本，六个签到/任务页面）合并正常。验证：在副本里放入 `activity.ts` 与占位页面和 activity 语言文件，`config/` 全部 20 个测试文件 163 个测试通过；临时探针打印 `routes` 里只有一个 `key==='activity'` 分组，子路由顺序为六个 `/act/...` 加 `/invite/rewards`（等于 `config/menus.ts:91-97` 的 `ROUTE_ORDER`），分组文字"活动管理"，页面文字"奖励设置"。在 710e21b 本身（`activity.ts` 为空数组）`config/routes` 测试全绿。
4. 漏斗的步骤比率可以超过 100%：`ShareFunnelTab.tsx:36-39`。比率按规格定义是本步÷上一步；"注册"是当日 `InviteRecord` 的创建数（契约 §9.2），不一定来自分享链接的点击（手动输入邀请码也算），所以注册÷下载点击可以大于 100%。页面如实显示，不截断，不是"占比"。邀请参与率（`activeInviters/registeredAccounts`）是子集÷全体，一致数据下不会超过 100%；饼图占比的分母是各渠道之和，不会超过 100%，"其他"由各日各渠道自己的行相加，不会是负数。
5. 邀请链响应里的 `maxDepth` 含义：契约只写了字段名，没写它是"实际到达的深度"还是"请求深度的回显"；页面按规格"头部显示后代数和实际深度"的字面理解、并在响应值不是数字时自己从树里数。这一条已经作为问题文件第二部分第 2 问提给后端（`docs/contract-requests/2026-10-26-admin-frontend-invite.md`），契约的缺口不是阻塞，也不是页面的缺陷。
6. 改了日期范围或排行名次没按"查询"就切到裂变页签，读的是上一次查询的范围：这是任务书和规格要求的"查询才生效"，与其他统计页一致；不是缺陷（作者的记录项 5 我不接受为记录）。
7. 排行表显示完整的邀请人账号 ID：契约 `stats.ranking` 的字段只有 `inviterAccountId`、`inviteCount`，没有掩码标识；规格要求"查看裂变"带上账号，邀请链的输入框也要账号 ID。"不显示完整账号 ID"的要求只针对邀请记录列表（任务书原文），页面照此做了。邀请链节点的 `accountId` 没有显示。
8. 深度分布里出现极大的 `depth`（例如 1e9）会让 `Array.from({length})` 卡住（`FissionTab.tsx:97-110`），或数组元素为 `null` 时 `row.depth` 会抛错：需要后端返回契约不可能出现的值（深度受邀请链长度限制，数组元素是对象），不算缺陷。

## 判断

- 立即修未修 0、记录项 5、未运行 3（作者报告里列的：全量测试和构建、非 `root` 管理员的真实浏览器检查、真实后端/其他浏览器；我也没有起开发服务或做浏览器检查，其中视觉类的发现——记录 4——只引用作者的描述）、阻塞 0。
- 建议五条记录全部修：记录 1 的树部分和记录 2、5 可以在本模块内改；记录 1 的共用组件部分和记录 3 需要改共享文件，由负责人决定谁改。
- 变更两条需要负责人确认后再动。

## 需要改共享文件（我的补充，作者报告里是"没有"）

- `src/components/EllipsisPopoverText.tsx`：为标识类文字提供固定从左到右的方向（记录 1）。
- `src/components/stat/TrendChart.tsx`：计数图只留整数刻度（记录 3，作者已记）。
