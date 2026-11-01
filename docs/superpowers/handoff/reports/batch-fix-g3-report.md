立即修未修 0、记录项 1、未运行 3、阻塞 0。

范围：任务 11 到 14（订阅与权益、额度、记忆服务与系统监控与告警与客服、形象与装扮与照片里的人投诉），加上 `backend-d1-ops-report.md` / `backend-d1-ops-review.md` 里仍开着的记录项。清单来自 `task-11-report.md` 到 `task-14-report.md`、`task-11-review.md` 到 `task-14-review.md`、`backend-d1-ops-*`。核对都是读当前代码，不是照报告抄；其中三条当前代码里已经被别的提交修好，写“已不存在”并给了证据。

- 记录项 1：任务 14 报告的第 4 条（打开抽屉时整页 `scrollWidth` 比窗口宽 8 像素，报告自己写“还没查清原因”）。这台机器上没有任何浏览器（没有 Playwright、Chromium），happy-dom 不排版，我没有办法复现，更谈不上修。已读到的只有：抽屉打开时 `@rc-component/portal/lib/useScrollLocker.js:19-26` 会给 `body` 写 `width: calc(100% - <滚动条宽度>)`，这和 8 像素的量级相符，但我没有量过，**不能当结论**。需要在有头浏览器里打开服装目录的抽屉量 `document.documentElement.scrollWidth` 与 `clientWidth`。不是阻塞（不影响数据，也不是别人才能给的输入，只是这个环境里没有浏览器）。
- 未运行 3：（1）真实浏览器：上一条的 8 像素、以及抽屉标题换行、确认气泡换行、原生选文件框隐藏（改成共用控件自己的内联样式）这几处的实际外观，都只有 happy-dom 里读到的样式属性，没有真看；（2）全量测试和构建，按规则由主会话统一跑；（3）真实后端联调（没有后端）。
- 发现的新问题：见文末“新发现”。

## 提交

| 提交 | 内容 |
|---|---|
| `696f759` | 共用表格 `PagedListTable`：没有筛选列时不画搜索区；`defaultCollapsed` 允许 `false` |
| `d9c2c94` | 共用 `DangerConfirmButton`：确认问题限宽并换行 |
| `c89c581` | 共用 `UploadField`：隐藏的选文件框加内联 `display: none` |
| `a169bac` | 三个小工具（只认最新一次读取的 `useLatestCall`、带明细的一行失败文字 `failureLine`、测试里扣住一次回答的 `tests/heldRequests.ts`）；另带进了形象与投诉问题文件的第六节（缓存头） |
| `915a021` | 任务 14 的记录项（形象、装扮、投诉页和它们的接口、语言文件） |
| `0d7dd9d` | 任务 11 的记录项（订阅与权益页） |
| `8afed69` 和 `a31692a` | 任务 12 的记录项（额度页、额度接口、问题文件） |
| `a87a36b` | 任务 13 的记录项（记忆、监控、客服页，语言文件里的未用键，问题文件） |
| 本提交 | 这份报告 |

## 核对表

状态：已修／已不存在／改判为变更／写成问题文件。“变异”指改坏被测代码，新测试必须变红；每条测试缺口和修复都做过，写在“证据”里。

### 任务 11（订阅与权益）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 评审立即修：Google 购买令牌显示完整并可复制 | 已不存在（早已修） | `4f34619`；`SubscriptionDrawer.tsx:25,129-131` 只显示末 6 位，无复制；`list.test.tsx` 有测试 |
| 评审 R1：订阅详情抽屉、账号权益页签、商品映射、功能开关、权益定义的读取没有“只认最新一次”的保护，响应乱序时显示别的对象的数据 | 已修 | `0d7dd9d`。新增 `useLatestCall`，五处读取接入。每处先写会红的测试（抽屉：先开 A 的回答被扣住，再开 B，放行 A；页签：换账号；三张列表：连续两次写后第一次重读晚到），再把 `isCurrent()` 全改成 `true` 做变异，五个测试都变红 |
| 评审 R2：新增/编辑权益、新增/编辑商品映射、额度单价保存三处，去掉防重复提交后测试仍全绿 | 已修 | `0d7dd9d`。原来的“点三下”测试点不出来（表单本身会合并同一刻的提交）。改成：扣住写请求的回答，等它发出后再点保存两次，断言只发了一次。三处各把 `useSingleFlight` 换成直接调用做变异，各变红 1 个 |
| 评审 R3：新增/编辑权益对话框把名字不在三个表单项里的后端字段错误吞掉 | 已修 | `entitlements.tsx` 的 `DefDialog`：只把 `key`/`name`/`priority` 放到表单项，其余（含 409 `data.field` 是别的名字）显示在表单上方的失败条里。测试 2 个，变异（恢复旧写法）变红 |
| 评审 R4：5000 字符无空格的权益名撑宽“功能值”抽屉标题 | 已修 | 标题包一层 `overflowWrap: 'anywhere'`；测试断言样式，变异变红。**只读了样式，没有在浏览器里量**（见未运行 1） |
| 评审 R5：额度单价保存、商品在售开关失败时只显示总说明，不显示 `reason.<码>` | 已修 | 新增 `src/session/failureLine.ts`（总说明加每条明细“名称：原因”）；两处接入；两个页面测试在改前红（`creditCost` 超范围、`entitlementKey` 的明细） |
| 评审 R6：统计表行键没有币种，同一天同商店同商品两种币种时行键重复，少一行 | 已修 | `stats.tsx` 的 `rowKey` 加币种；测试在改前红（只剩 1 行，不是 2 行） |
| 评审 R7：订阅列表“商店”筛选是自由文本，只有输入完全一致的大写标识才有结果 | 已修 | 改成 `APPLE`/`GOOGLE` 的下拉（常量 `SUBSCRIPTION_STORES` 放在 `services/subscriptions/types.ts`，商品映射页同用）；测试在改前红 |
| 评审 R8 / 报告记录项 2：订阅列表四个筛选折叠时只露出前两个（共用表格 `defaultCollapsed` 只能为 `true`） | 已修 | `696f759` 允许 `false`；`list.tsx` 用 `defaultCollapsed={false}`；测试断言四个筛选都可见 |
| 报告记录项 1：同一检出里同时开几个开发服务器互相覆盖 `src/.umi` | 已不存在（不是代码缺陷） | 开发流程，不是代码行为（评审 `task-11-review.md` 不是缺陷第 3 条已同意）；没有代码可改 |

### 任务 12（额度）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 评审 1：账号 ID 链接不看 `USER:VIEW`，没有权限的人点进去被路由守卫拦下 | 已修 | `8afed69` 和 `a31692a`。`AccountLink.tsx` 按 `USER:VIEW` 决定链接还是纯文字；新增 `AccountLink.test.tsx` 3 条（改前有 1 条红）；`accounts.test.tsx` 补“没有 `USER:VIEW` 是纯文字”，原来的链接测试改成带 `USER:VIEW` |
| 评审 2：备注超长、商品 ID 超长都提示“理由需要 1 到 N 个字符”，字段是“备注（可选）” | 已修 | 通过备注改用新键 `credits.requests.noteLength`（中英文都加）；商品 ID 的提示随第 3 条去掉。测试在改前红 |
| 评审 3：商品 ID 长度上限 200 是前端自己定的，契约没有 | 已修 + 写成问题文件 | 去掉前端的上限，后端的 400（`ref` 为 `productId`）显示在输入框下（测试用一个 300 字符的 ID，在改前红）；问题文件 `2026-10-26-admin-frontend-credits.md` 第一条加了第 5 问 |
| 评审 4：通过备注、在售开关失败时丢掉字段详情 | 已修 | 用 `failureLine`；两个测试在改前红 |
| 评审 5：用列表里可能已过期的整行去 PUT，会覆盖别人刚改的值 | 已修（前端那一层）+ 写成问题文件 | 保存前（开关和编辑对话框）先重新读一遍，和列表上的 `credits`/`enabled`/`sortOrder`/`surfaces` 比，不一致不发 `PUT`，提示并重新读（`freshPack.ts`）。这是变更决定第 3 条的同一做法，按业界做法自己定。读和写之间仍有时间窗，问题文件加了第 6 问（`updatedAt` + `expectedUpdatedAt`）。两个测试在改前红 |
| 评审 6：额度包弹窗关闭动画期间标题和字段变成“新建” | 已不存在（不是缺陷，先修后撤） | 我先按评审写了一个绕过（`8afed69`），把有绕过和没有绕过的测试都跑了：没有绕过时测试也通过。原因：`node_modules/@rc-component/dialog/lib/Dialog/Content/Panel.js:137-139` 把内容放进 `MemoChildren`（`MemoChildren.js:17-20`），`shouldUpdate` 只在对话框可见时为真，关闭中的对话框内容不更新，标题不会变。`a31692a` 撤掉绕过，测试留着（它描述想要的行为，库升级后若改了会变红）。任务 14 评审“不是缺陷”第 5 条是同一个观察 |
| 评审 7：额度包页有一个空的搜索框和“重置/查询” | 已修 | `696f759`（没有筛选列时不画搜索区）；`PagedListTable.test.tsx` 加 2 条，变异（恒画）变红 |
| 评审 8：切换语言会重新请求并清空统计 | 已修 | `stats.tsx`、`AccountCreditsPanel.tsx` 把 `intl` 放进 ref；用一个能在页面不卸载时切换语言的测试外壳（`localeHost.tsx`）写了 2 个测试；把 `intl` 放回依赖做变异，两个都变红 |
| 报告记录项 1：`me.id` 缺失时本人的申请审核按钮不禁用 | 已不存在（不是缺陷） | 任务书明文要求（评审“不是缺陷”第 2 条）；`requests.tsx:62-66` 与测试 `requests.test.tsx` “does not disable anything when the account has no id yet” |
| 报告记录项 2：额度包列表假定后端不分页，自己切页 | 已修 | 新增 `listAllCreditProducts`（一页 200 条读到拿全；响应没有 `total` 且不满一页就当整张表；没有新行就停）；页面测试（后端分页、共 250 条）在改前红；3 个接口测试随函数一起写；问题文件第一条补了说明 |
| 报告记录项 3：`store` 下拉只有 `APPLE`、`GOOGLE`，后端增加渠道要改 `types.ts` | 已不存在（不是缺陷） | 契约 15.9 只列这两个；新增商店本来就要客户端先支持；已存的其他商店在编辑弹窗里仍能显示（`ProductModal.tsx` 下拉并集） |
| 报告记录项 4：happy-dom 不触发动画结束，弹窗关闭后留在页面里 | 已不存在（不是缺陷） | 测试环境限制，`testSetup.ts` 的 `dialogsClosed()` 已处理 |
| 报告记录项 5：两个开发服务器（8302、8312）没停掉 | 已不存在 | `ss -ltnp` 里没有监听这两个端口的进程 |
| 报告“需要改共享文件”：流水页四个筛选窄屏要点展开 | 已修 | `transactions.tsx` 用 `defaultCollapsed={false}`；测试断言四个都可见；`testSetup.ts` 的 `expandSearch` 改成对已展开的表单不再点 |

### 任务 13（记忆服务、监控与告警、客服）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 评审立即修 1：新建档位填已有的名字会用 default 档的值静默覆盖 | 已不存在（早已修） | `ed09e65`；`TierForm.tsx:124-139` 先问再发 |
| 评审立即修 2：反馈 `context` 里有非字符串值时抽屉渲染抛错 | 已不存在（早已修） | `ed09e65`；`FeedbackDrawer.tsx:129,142` 经 `plainText` |
| 评审 1：修改对话框加载中被关闭后，新建对话框的“保存”一直灰着 | 已修 | `a87a36b`。`TierForm.tsx` 新建分支把 `loading` 置回 `false`；测试扣住档位的读取、关闭、再开新建，在改前红 |
| 评审 2：账号“记忆”页签换账号时晚到的旧响应覆盖新账号 | 已修 | `AccountMemoryTab.tsx` 接入 `useLatestCall`；测试扣住第一个账号的回答、换账号、再放行；把 `isCurrent()` 改成 `true` 变红 |
| 评审 3 / 报告记录项 1：所有列都 `search: false` 时画一张只有两个按钮的空搜索卡片 | 已修 | `696f759`；`feedback.test.tsx` 加“没有搜索区”，改前红 |
| 评审 4 / 报告记录项 2：确认气泡没有宽度上限 | 已修 | `d9c2c94`；`alerts.test.tsx` 补了驱动资源包那句的限宽断言。**只读了样式，没有在浏览器里量** |
| 评审 5 / 报告记录项 4：管线页来源下拉只有这次返回的点里出现过的来源 | 写成问题文件 | 来源列表是后端的数据；问题文件 `2026-10-26-admin-frontend-memory-monitor-support.md` 新增第七节（要 `sources`）。页面已把会话里看到过的来源累加（`pipeline.tsx:61,80-82`） |
| 评审 6：`MEMORY_MODEL_CONFLICT` 的 `detail` 只从 `data.detail` 读 | 已不存在 | `c2f7473` 起页面只显示按错误码翻译的文字，不再读 `detail`（负责人规则）；后端结构化字段的请求在 `2026-11-01-admin-frontend-translated-error-texts.md`，`ModelForm.tsx` 里已没有 `data.detail` |
| 评审 7：告警 `detail` 假设是字符串 | 已不存在 | `alerts.tsx:40` 经 `plainText`；`alerts.test.tsx:86,245` 有对象型 `detail` 的测试 |
| 评审 8：提交 `13a687b` 带进了别的任务的文件 | 已不存在 | 历史提交，改不了；它造成的“只有中文有审核键”的失败现在不存在（`src/locales` 键一致测试全过，见测试结果） |
| 评审 9：6 个语言键没有任何代码引用 | 已修 | 删了 `support.note`、`monitor.alert.autoNote`、`monitor.alert.status`、`monitor.alert.type`、`memory.model.conflictTitle`、`memory.account.title`（中英文都删；带 `.OPEN`/`.${type}` 后缀的同前缀键是在用的，没动）；语言文件测试全过 |
| 评审 10：问题文件里三个问题契约 17.4 通则已经回答 | 已修 | 问题文件的一、二节去掉分页、`{items,total}`、倒序的问题，保留没写清的 |
| 报告记录项 3：未设置的 JSON 配置行显示红色“不是合法 JSON” | 已不存在 | 评审已确认：`ConfigRow.tsx:147` `allowEmpty={item.value === null}` |

### 任务 14（形象、装扮、照片投诉）

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 评审立即修：渲染模型列表缺登记时间列 | 已不存在（早已修） | `89e12c1`；`rendererModels.tsx:76-79` |
| 评审 1：测试里留着 `console.log` | 已不存在 | `src/pages/complaints/*` 里没有 `console.log`（只有 `likeness.test.tsx` 里 `vi.spyOn(console, …)` 用来断言没有日志） |
| 评审 2：未知媒体类型时用 `<a href={签名地址}>` | 已修 | `915a021`。改成“这种类型的文件不能在这里查看”的提示（中英文新键，删了 `complaints.evidence.open`）；测试断言页面里没有该地址的链接、`src`、文字；改前红 |
| 评审 3：请求没带 `cache: 'no-store'`，证据、签名图片地址可能被浏览器缓存 | 已修（前端）+ 写成问题文件 | `915a021`。证据、目录分页读取、默认数字人、账号形象的读取都带 `cache: 'no-store'`（共用 `apiRequest` 的 `cache` 选项是请求层那一组加的，已在 HEAD）；4 个服务测试，去掉后变红；后端补 `Cache-Control: no-store` 写在 `2026-10-26-admin-frontend-cosmetics-complaints.md` 第六节 |
| 评审 4：`uploadSlot.ts` 的 `onCleared` 没有测试 | 已修 | `915a021`，`cosmetics.test.tsx` 新增：先传 A 成功，再选超大文件 B，提交被“请先上传”挡住且没有写请求；把 `onCleared` 改成空函数变红 |
| 评审 5：证据查看器的“迟到回答丢弃”没有测试 | 已修 | `likeness.test.tsx` 新增（点文件 1 被扣住，再点文件 2，放行 1，文件 2 仍显示）；去掉 `mine === latest.current` 变红 |
| 评审 6：`cleanAssetIds` 的去空白、去重没有测试，测试名与断言不符 | 已修 | 新增对 `cleanAssetIds` 的直接测试，页面测试名去掉“trimmed, once each”；把它改成原样返回变红 |
| 评审 7：赠送服装的选择框只读目录第一页（200 条） | 已修 | 新增 `listAllCosmetics`（读到 `total`，空页即停）；`GrantCosmetic.tsx` 用它；2 个服务测试和 1 个页面测试（第 201 条能选到）；页面测试在改回只读第一页时变红 |
| 报告记录项 1：上传控件在表单里露出原生选文件框 | 已修 | `c89c581`：共用 `UploadField` 的输入框加内联 `display: none`（比表单样式优先），删了 `avatar/UploadBox.tsx` 和四个对话框里的包装；测试在改前红。`push/`、`ads/` 里还各有一份复制的 `UploadBox`，不是我的范围，已写在文末“新发现” |
| 报告记录项 2：`PagedListTable` 没有 `rowClassName`，整行样式只能逐列 `onCell` | 改判为变更（不做） | 这是给共用组件加新口子，不是缺陷：现在的做法（`likeness.tsx:39-44` 每列 `onCell`）输出正确，`likeness.test.tsx:70-86` 钉住了。没有第二个使用者，按业界做法不预先加 |
| 报告记录项 3：渠道列表一次页面加载只读一次 | 已修 | `SurfacesPicker.tsx` 每次出现时先清共用缓存再读；测试：添加渠道后再开选择器，新渠道在列表里，改前红 |
| 报告记录项 4：抽屉打开时整页 `scrollWidth` 比窗口宽 8 像素 | **仍未修**（记录项 1） | 见开头：这个环境没有浏览器，无法复现 |
| 报告记录项 5：PDF 证据测试输出 `connect ECONNREFUSED 127.0.0.1:3000` | 已修 | 测试里给 happy-dom 的取数据加拦截器，iframe 的请求在本地回答；输出不再有连接拒绝 |

### 后端第一批改动 ops 区域（`backend-d1-ops-report.md`、`backend-d1-ops-review.md`）

评审给的 4 条记录项和实现者的记录项 1，已由 `6bc51c6` 全部修好（报告“评审后的修复”一节），核对代码仍在：`stats.tsx` 的 `formatListPrice` 接受数字；`alerts.test.tsx` 有对象型关联对象的测试；`tasks.test.tsx` 有 `CANCELLED_BY_ADMIN`、小写 `missed` 等的测试；`mock/support.mock.test.ts` 有“重试哪条关哪条”；`sendAtHelp` 中英文已改。只剩一条：

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 实现者记录项 2：`likeness.test.tsx` 在机器负载高时有一两条超时，每次失败的用例不同 | 已修 | `915a021`：`src/pages/avatar/testSetup.ts`（形象和投诉页测试共用）把 `asyncUtilTimeout` 设为 8000 毫秒（用户页测试 `src/pages/users/testSetup.ts:18` 同样做法）。我这边在负载 40 以上时亲眼见到这类失败，改后同一批测试 255 条全过。这是在忙的机器上的健壮性，**不能证明**以后不会再超时 |

## 测试结果

只跑相关的：
- 订阅：`npx vitest run src/pages/subscriptions src/hooks/useLatestCall.test.tsx src/session/failureLine.test.ts src/services/subscriptions`：12 个文件 206 条，205 条通过，1 条（功能开关页“offers Not configured”，一次开关十个对话框）在负载 40 以上时超过 30 秒；已把这条的超时放宽到 120 秒，单独跑通过，之后和额度一起重跑通过
- 额度：`npx vitest run src/pages/credits src/services/credits`：最后一次（连同订阅功能开关页）11 个文件 146 条全过。中间一次整批跑里 3 条（`AccountCreditsPanel` “account does not exist”、`requests` 的 “-5”“2.5”）在负载下超过 30 秒或被前一条超时留下的 `pointer-events: none` 影响，单独跑和再跑都通过；它们和我的改动无关（那几条测的代码我没碰）
- 记忆、监控、客服加语言文件和写死文字扫描：`npx vitest run src/pages/memory src/pages/monitor src/pages/support src/services/memory src/services/monitor src/services/support src/locales tests/noHardcodedText.test.ts`：15 个文件 594 条全过
- 形象、投诉、上传控件：`npx vitest run src/pages/avatar src/pages/complaints src/services/avatar src/services/complaints src/components/UploadField.test.tsx`：16 个文件 255 条全过
- 共用表格、确认按钮：`src/components/PagedListTable.test.tsx`、`DangerConfirmButton.test.tsx`、`RowActions.test.tsx` 全过
- `npx biome check`（我动过的目录）无诊断；`npx tsc --noEmit` 在我的路径下无报错（别人的路径有：`PagedListTable.test.tsx:252` 等处别人加的 `ApiError` 调用缺 `data`，`moderation/ContentPanel.test.tsx`，`reportLoading.test.tsx`）。

一个说明：机器同时跑着四十多个 vitest 进程，负载 30 到 50。我用 `-t` 单独跑过的用例都在这种负载下通过；整批里出现过的超时（订阅功能开关页“offers Not configured”那条一次开关十个对话框的用例）已把这一条的超时放宽到 120 秒，单独跑通过。

## 新发现（按 CLAUDE.md 分类）

- **记录**：`src/pages/push/UploadBox.tsx`、`src/pages/ads/UploadBox.tsx` 仍是共用 `UploadField` 之前的复制品（`c89c581` 之后可以删，包装它们的 `ContentFields.tsx`、`CreativeModal.tsx` 同改）。不是我的范围，没有碰。后果：多一份无用的样式，没有错误输出。建议由推送和广告那组的人删。
- **记录**：`src/hooks/useLatestRead.ts`（别的组新加）和我加的 `src/hooks/useLatestCall.ts` 是同一类事的两个写法（前者连状态一起管，后者只给“是不是最新”）。各模块里还有四份复制的 `useLatestRead.ts`（`sms`、`email`、`appVersions`、`cost`）。不影响正确性，建议统一。
- **不是缺陷**：任务 13 评审里的“变异检查漏掉了没想到的路径”那段只是方法评语，不是遗留项。
