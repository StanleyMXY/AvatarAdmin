立即修未修 0、记录项 0、未运行 3、阻塞 0

# 批量修复 g4 报告：任务 15 到 18（内容审核、用户、日报与留存、游客统计）的记录项，以及 backend-d1-growth 里属于审核文本规则的记录项

范围：`task-15…18-report.md`、`task-15…18-review.md` 里的记录项（含评审里标成"立即修"、后来已修掉的两条），加上 `backend-d1-growth-report.md`、`backend-d1-growth-review.md` 里属于审核文本规则的仍开着的记录项。每条都先读当前代码核对，再修；修的带先红后绿的测试，测试缺口类做了变异检查（改坏代码，新测试必须变红）。

提交：

| 提交 | 内容 |
|---|---|
| `b8db906` | 共用件：原因对话框关闭中不再发送、`useLeaveGuard`、`ConfigForm` 的 `exclude` 和地址片段滚动、落地条的中途失败提示、`ReportHelper` 按页面键重读、`cellTint` |
| `1857890` | 内容审核（任务 15）和新的问题文件 |
| `961198f` | 用户（任务 16）和两个假后端 |
| `9e160dd` | 日报、留存、游客统计（任务 17、18） |
| 末次提交（见回复） | 报告，和两个测试里的等待改成等到行数对（`detailTabs.test.tsx` 的三处原来读到第一行就往下走，`guest.test.tsx` 三处落地用例的等待放宽到 5 秒） |
| `9b127d1`（别的会话的提交，带走了我的片段） | `src/request/apiClient.ts` 的 `cache` 参数和它的测试：别的会话提交这个文件时把我已经写在工作区里的片段一起提交了 |
| `9c0c064`（同上） | `src/components/ReasonModalForm.tsx` 里"关闭中不再发送"的片段；它的测试在 `b8db906` |

## 逐条

### 任务 15（内容审核）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 测试分不出 `trimSpec` 和 `String.prototype.trim`（U+0085、U+001C 到 U+001F）：备注、规则词表、服务三处 | 已修 | `1857890`。`detail.test.tsx`、`ruleRows.test.ts`、`moderation.test.ts` 各加 U+0085 的输入；三处分别换成 `.trim()` 后各自变红 |
| "过期响应不覆盖新响应"（`ContentPanel.tsx`）和图片 `referrerPolicy="no-referrer"` 没有测试 | 已修 | `1857890`。新文件 `ContentPanel.test.tsx`；去掉判断、去掉属性后各自变红 |
| 409 `INVALID_STATE` 时弹窗只有通用文字，没写当前状态，确认按钮还可点 | 已修 | `1857890`。`DecisionModal.tsx` 按 `data.status` 写"这条记录已被别人先处理了，它现在的状态：已拒绝"（中英文），记录不再待复核后确认按钮禁用；去掉禁用后变红；没有 `data.status` 时仍是按码文字（有测试） |
| 队列"记录 ID"列在链接里放了按钮 | 已修 | `1857890`。`queue.tsx` 改成纯文字链接加省略号样式和 `title`；测试断言链接里没有按钮 |
| 内容请求可能被浏览器 HTTP 缓存 | 已修 | `1857890`（服务和测试）加 `9b127d1`（`apiRequest` 的 `cache` 参数）。`getModerationContent` 带 `cache: 'no-store'`；问题文件第一条问后端是否带 `Cache-Control: no-store` |
| 内容类型筛选的 `contentType` 不在契约查询参数里，后端忽略时列表不过滤 | 已修加写成问题文件 | `1857890`。页面对返回的行再按类型过滤一次（后端忽略参数时用拦截验证：去掉过滤后变红）；问题文件第二条问后端对未知参数是忽略还是 400 |
| 进入队列页时取两次统计 | 已修 | `1857890`。去掉进入时的那次，表格的请求带出；测试断言进入时 1 次、之后每次新列表 +1 |
| 没有用到的键 `moderation.queue.reload` | 已修 | `1857890`，两个语言文件都删了 |
| 服务、页面、路由的测试没有先看到"功能不存在"时的红 | 不是缺陷 | 已经做完的流程记录，无法回补；这些测试有效性已由评审的 25 个以上变异证明（`task-15-review.md` 变异清单），我这次新增的测试都先红后绿 |
| 规则词表有未保存的编辑时离开页面没有提示 | 已修（改判为变更，按业界做法定） | `b8db906`（`useLeaveGuard`）加 `1857890`（`rules.tsx` 用它）。做法：有未保存编辑时，关闭或刷新页面由浏览器确认；站内跳转弹"离开这个页面？"（离开、留下），问题期间再次跳转不开第二个；保存后放开 |
| 规则页参数区有 10 行（多出一行指向本页自己的 `moderation.text_rules`） | 已修 | `b8db906`（`ConfigForm` 加 `exclude`，有测试）加 `1857890`（规则页排除该键，测试改成 10 行且没有指向本页的链接） |
| 详情页标签标题不带记录 ID | 已不存在 | `src/components/layout/pageIndex.ts:70-103`（`pageIdentifier`、`titleWithIdentifier`，`/moderation/42` 的标签是"审核详情 · 42"），决定文件"参数页标签标题带标识" |
| 假后端的词表不同步到 `GET /config` | 不是缺陷 | 评审不是缺陷第 4 条：只是假后端；真后端是否同步在原问题文件第六条里问了 |

本任务发现的新问题（立即修，已修，`1857890`）：`DecisionModal` 在判定成功、弹窗还在关闭动画里时再点"确认"，会再发一次判定（得到 409）。原因：关闭中的对话框内容不再重绘，处理函数拿到的 `decision` 是旧值。改成从 ref 读；测试先红（第二次请求发出）后绿。同一类问题在共用的 `ReasonModalForm` 里是任务 16 的记录项，见下。

### 任务 16（用户）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| "已封禁"这一列的接线没有测试（发放、新建额度申请、指派模型） | 已修 | `961198f`。`detailPanels.test.tsx` 三个页签各加已封禁账号的用例；把门禁改成 `status !== 'ACTIVE'` 后三条都变红 |
| 提交 be645eb 带进了别的模块的文件，分支顶端 parity 测试曾红 | 已不存在 | `src/locales/en-US/activity.ts` 现有 196 行，`src/locales` 412 个测试全绿 |
| 封禁时 409 且页面重读后按钮换成"解封"，弹窗消失，看不到"账号现在的状态" | 已修 | `961198f`。`BanUserModal.tsx` 在 409 时除了弹窗里的提示再发一条消息（弹窗被卸载后仍在）；去掉这条后新测试变红 |
| 多开检测的"付费"判断对缺失、null、字符串值默认放行封禁 | 已修 | `961198f`。只有 `paid === false` 才有封禁按钮，"付费"列对非布尔值显示"—"；改回旧判断后变红 |
| 时间为空时单元格是空白（用户列表、认证事件） | 已修 | `961198f`。显示"—"；去掉后两条测试变红 |
| 共用 `ReasonModalForm` 提交成功后、关闭动画结束前再点"提交"会再发请求 | 已修 | `b8db906`（测试）加 `9c0c064`（组件）。从 ref 读"是否打开"，关闭中的提交不发；去掉后变红。两个用户弹窗里各自的保护保留（有自己的测试） |
| 概览的"人设审核"显示后端原始状态码 | 已修 | `961198f`。契约现在写明取值 `NONE`、`PENDING_REVIEW`、`REJECTED`，加了中英文译文；不认识的值照原样显示；假数据里不在契约里的 `APPROVED` 改成 `NONE` |
| 三个没有被使用的语言键 | 已修 | `961198f`，删掉 `users.avatars.name`、`users.avatars.looks`、`users.deletions.noReason`（两个语言文件） |
| 假后端对用户模块的账号在"订阅与权益""记忆"页签得到 404 | 已修 | `961198f`。`mock/subscriptions.mock.ts`、`mock/memory.mock.ts` 的读接口认用户模块的账号（空列表、没有分层）；仍不认识的 ID 回 404（有测试） |
| 报告记录项 3：`AccountEntitlementsPanel` 的 `load` 没有"晚到的旧响应不覆盖新响应"判断 | 未动（属任务 11 的范围） | 评审不是缺陷第 9 条：在用户详情里整个视图按账号 `key` 重建；该文件的缺口在任务 11 评审里已记，由任务 11 那组处理 |
| 报告记录项 5：详情页不显示宽限期截止时间和发起删除的管理员 | 不是缺陷 | 评审不是缺陷第 7 条：规格没要求，后端没给字段，已在 `2026-10-26-admin-frontend-users.md` 第三条 |

### 任务 17（日报与留存）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 评审"立即修"1：留存矩阵没有人数和绿色热力底色 | 已不存在 | `49067d4`；`src/components/stat/RetentionMatrix.tsx:55-66` 每格"人数 · 百分比"并带底色 |
| 评审"立即修"2：多选 N 是 N 张图而不是一张图多条线 | 已不存在 | `49067d4`；`RetentionTrendChart` 收 `days`，`retention.tsx` 一处调用 |
| `ReportHelper` 只在第一次挂载读关闭状态 | 已修 | `b8db906`。按 `pageKey` 重读；页面里绕开用的 `key` 去掉（`retention.tsx`）；组件新测试，去掉重读后组件测试和页面测试都变红 |
| 留存趋势图纵轴和提示框是小数没有百分号 | 已不存在 | `src/components/stat/RetentionTrendChart.tsx:52-66`（纵轴和提示框都是百分比），`73aba5f` |
| 图表提示框的名字是英文字段名、数值是长小数：回流两张图，日报的人均通话分钟 | 已修 | `9e160dd`。`ReactivationCharts.tsx` 的提示框有名字和格式（百分比、千分位）；`dailyColumns.ts` 的 `chartRow` 把图里的分钟数取到一位小数，和表一致；新文件 `ReactivationCharts.test.tsx`、`dailyColumns.test.ts`、`daily.test.tsx` 用例 |
| `load` 的依赖数组里有 `intl`，切换语言整页重读 | 已修 | `9e160dd`。日报、留存、游客统计（`useReport`）都改用 ref；三处各一条测试（切换语言后请求数不变、内容不被清空），改回后变红 |
| 默认范围不校验 `stats.max_range_days` | 已修 | `9e160dd`。日报 7 天、留存 30 天、游客四个页签用现成的 `src/pages/analytics/defaultRange.ts`（取 7 或 30 与后端上限里小的）；各页签测试；另有日期选择器收到上限的接线测试（日报、留存） |
| 选了渠道包时"有效订阅"整列是"—"，提示只说"当天和没有快照的日子" | 已修 | `9e160dd`。两个语言的提示补一句"选了渠道包时一律显示—（快照没有渠道维度），不是快照缺失"，有测试 |
| 对后端行顺序的假设没有问过 | 写成问题文件 | `1857890` 里的 `docs/contract-requests/2026-11-01-admin-frontend-moderation-and-reports-order.md` 第三条；前端不预先排序 |
| 日报测试没有测纵轴、主题 | 已修 | `9e160dd`。`daily.test.tsx`：暗色、亮色下的 `theme`、轴文字颜色、系列和颜色，模式切换后跟着变 |
| 面板可关闭的用例最后一步验证不了"互不影响" | 已修 | `9e160dd`。`retention.test.tsx` 改成先关回流面板、检查留存面板仍在，再关留存面板、检查回流面板仍关；把 `ReportHelper` 的重读去掉后变红 |
| 落地条没有自己的测试，页面没有"连点只发一次"和"失败后不重读" | 已不存在 | `src/pages/stat/CheckDayLandBar.tsx` 删除，留存页用共用的 `LandBar`（带自己的日期文字和提示）；共用件的测试 `LandBar.test.tsx` 有连点只发一次、首个失败不通知页面、中途失败；把"首个失败也通知页面"的变异跑了，两条变红 |
| 趋势图的 `from`、`to` 取已提交的范围，没有测试 | 已修 | `9e160dd`。`daily.test.tsx`：改了日期但没点查询图的横轴不变，点查询后才变；改成 `draft` 后变红 |
| `maxDays` 接线没有测试 | 已修 | `9e160dd`。日报、留存各一条：上限 10 天时选"最近 30 天"被拒并提示 |
| 报告记录项：当天的值是临时值没有标识 | 已不存在 | `src/pages/stat/daily.tsx` 里的 `ProvisionalTag`、图上空心点和说明（`9c3f678`） |
| 报告记录项：不同量纲共用一个纵轴 | 不是遗留（决定文件"趋势图量纲（保持现在的分图方式）"） | `decisions-2026-10-27.md` |

### 任务 18（游客统计）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 评审"立即修"：累计值下降时转化分布和堆叠图出现负数 | 已不存在 | `src/pages/stat/guest/conversion.ts:35、76`（`Math.max(0, …)`），`conversion.test.ts`（`e6abc1a`） |
| 落地后只刷新当前页签，已打开的别的页签保留旧数据 | 已修 | `9e160dd`。`guest.tsx` 持有"落地次数"，三个页签的 `useReport` 随它重读；没打开过的页签不读（有测试）；去掉后变红 |
| 中途失败的提示不说哪一步失败、前面哪些已落地 | 已修 | `b8db906`。共用的 `LandBar` 在已有步骤落地后失败时写"已重新落地：A。在 B 处停止：原因"（中英文），原因仍是按码文字；首个失败时只有原因；变异后变红 |
| `GuestLandBar` 是共用 `LandBar` 的重复实现 | 已修 | `9e160dd`。`GuestLandBar.tsx` 变成共用件加三个名字和自己的文字的薄封装；留存页的 `CheckDayLandBar` 同样删除 |
| `/config#guest.call_minutes_total` 不滚到那一行 | 已修 | `b8db906`。`ConfigRow` 根元素加 `id`，`ConfigForm` 在行画出后按地址片段滚动一次；不认识的片段不滚（有测试） |
| 额度使用页签没有写日期范围按"设备第一次出现的日期"过滤 | 已修 | `9e160dd`，两个语言各一句，有测试 |
| 额度卡片的提示只挂在标题上，没有提示图标 | 已修 | `9e160dd`。五张有定义的卡片加问号图标（`tip-quota-card-<名>`），"设备数"那张没有；变异后变红 |
| 假后端的游客转化累计值不单调 | 已不存在 | `mock/_core/statData.ts:161-172`；这次补了测试 `statData.guestCohort.test.ts`（60 个队列日，去掉累计后变红） |
| 落地第一个汇总就失败也会清空并重读（变异 X1 存活） | 已不存在 | 逻辑已是共用 `LandBar`，`LandBar.test.tsx` 守着，上面的变异两条变红 |
| 去掉天数排序（变异 X3 存活） | 已修 | `9e160dd`。`guest.test.tsx`：先选小的天数，矩阵列和折线系列仍按天数顺序；去掉排序后变红 |
| `DeviceCohortMatrix` 是共用 `RetentionMatrix` 的本地副本，基数为 0 时一个显示"120 · —"一个显示"—" | 已修（重复的部分）／不是缺陷（显示差异） | 颜色底色的算法抽成共用的 `cellTint`，两个矩阵共用（`b8db906`）；游客矩阵的"增量"、自己的文字、基数 0 时仍显示人数不显示百分比，是有测试的设计（`guest.test.tsx` 的"size 0"用例），数字是后端给的真实值，不隐藏 |
| 游客留存的平台筛选没有 `unknown` | 写成问题文件（已有） | `docs/contract-requests/2026-10-26-admin-frontend-guest-stats.md` 第三条，后端还没答复；当前按规格只有 ALL、ANDROID、IOS |

### backend-d1-growth（审核文本规则部分）

报告和评审里的记录项共 5 条（导出范围错误按字段说明、假后端 `GET /meta` 写死、漏斗 429 的测试、系统配置页没有提示条、成本币种格式），全部属于投放、成本、漏斗、导出，不是审核文本规则；追加段落里已经按评审修完。属于审核文本规则（a13：匹配说明、折叠后为空）的内容：报告和评审都没有留下记录项，只有"未运行：规则页零宽字符行保存后的按码文字"（不计记录项）。核对：`src/pages/moderation/rules.test.tsx` 有零宽字符行的按码文字用例，`mock/moderation.mock.test.ts` 有零宽字符三种用例，全部通过。所以这一块记录项为 0，没有改动。

## 新发现

- 立即修（已修）：`DecisionModal` 关闭中再点确认会再发一次判定，见任务 15。
- 记录：无。
- 变更：无新增；`useLeaveGuard` 是上面"离开页面提示"一条改判后的做法，按业界通行做法定。
- 契约缺口：新问题文件 `docs/contract-requests/2026-11-01-admin-frontend-moderation-and-reports-order.md`（内容接口的缓存头、`contentType` 不被认识时的行为、报表行顺序）。

## 未运行（3）

1. 真实浏览器：这个环境里没有浏览器。`useLeaveGuard` 的站内跳转拦截用 `history.block`，Umi 的 `history` 带这个方法（`src/.umi/core/history.ts` 展开了 `history` 对象），测试里用桩模拟；在真实 Umi 路由里是否拦得住、图表提示框（G2）的实际样子，都没在浏览器里看。标签页的"关闭标签"不经过 `history`，所以关标签仍不会提示（共享的标签层，不在本范围）。
2. 全量测试和构建（按规则最后一起跑）。本次跑过的：`src/pages/moderation`、`src/services/moderation`、`src/pages/stat`、`src/pages/users`、`src/pages/config/ConfigForm.test.tsx`、`src/components/stat`、`src/components/ReasonModalForm.test.tsx`、`src/hooks`、`src/locales`、`tests/noHardcodedText.test.ts`、`src/request/apiClient.test.ts`、`config/routes`、三个假后端测试，机器负载在 20 以上，有几条因默认的一秒或三十秒超时偶尔变红，单独重跑都通过。
3. 对着真实后端的检查：后端还没上线。

## 不碰的东西

- 没改 `docs/shared-snapshots/`、没访问别的仓库。
- 共享文件只做了最小增量：`ConfigForm`/`ConfigRow`、`LandBar`、`ReportHelper`、`RetentionMatrix`、`ReasonModalForm`、`apiClient`、`pages.ts` 和 `stats.ts` 的语言文件；别的会话同时改的文件（`TrendChart`、`PagedListTable`、`mock/stats.mock.ts` 等）没碰。
