立即修 2、记录 10、变更 3、不是缺陷 6、阻塞 0

# 任务 13 评审：记忆服务、系统监控与告警、客服

评审对象：提交 13a687b、ed410be、1ec40e5（分支 claude/jolly-dirac-4pq9g6）。评审者只读代码和提交历史，没有改任何源文件，没有提交。

## 先说结论

- 任务报告开头写"立即修未修 0"，这不对：下面有 2 条立即修，都是我复现过的。报告里的记录项 3（共用配置行对未设置的 JSON 项显示红色"不是合法 JSON"）在当前 HEAD 上不存在（见"不是缺陷"第 1 条）。
- 任务书 Tests 一节的每一条在测试里都有对应；我自己重跑了任务相关的 13 个测试文件：13 个文件 176 个测试全部通过，和报告一致。
- 权限码、请求路径和请求体、告警关闭确认文字、静态文字、中英文键对照、品牌名和韩文扫描：未发现问题（细节在下面各节）。

## 怎么验证的

- 复现和变异检查都在 HEAD 的干净副本里做（`git archive HEAD` 解到会话临时目录，`node_modules` 用符号链接），没有动共享检出里别的任务的未提交文件。每次变异后立刻把原文件内容写回，共享检出里本任务的路径 `git status` 为空，说明没被碰过。这样做的原因：同一检出里其他任务的会话在跑测试和提交钩子，原地改源文件会让它们的测试和类型检查随机变红；任务书说的"改了再 `git checkout` 恢复"在共享检出里有这个风险，所以换成了副本。
- 复现用的临时测试文件只放在副本里，已删除，不在仓库里。

## 立即修（2）

### 1. 档位页的"新建档位"对话框里填一个已存在的名字，会不经确认地用 default 档的值覆盖那个档位的全部五项设置

- 位置：`src/pages/memory/TierForm.tsx:121-139`（`submit`）。新建对话框 `creating` 为真、`loaded.current` 为空；名字在列表里时 `isNew` 为假，走到第 139 行 `send.run(name, settings, false)`，`settings` 是表单里的全部五项，而表单在新建模式下是用 default 档的值预填的（第 61 行 `starting ?? FALLBACK`）。
- 触发步骤：以有 `MEMORY:TIER_CONFIG` 的管理员打开 `/memory/tiers`，点"新建档位"，名字填 `premium`（列表里已有，topK 10、近期通道条数 5、合并开、阈值 500），不改别的，点"保存"。
- 错误结果：没有"将新建档位"确认，没有任何提示；发出 `PUT /memory/tiers/premium`，请求体是 `{"topK":5,"recencyChannelEnabled":true,"recencyChannelCount":3,"consolidationEnabled":false,"consolidationThreshold":200}`；提示条写"档位已保存"。我在副本里用假后端跑过：`premium` 在假后端里从 `{topK:10, recencyChannelCount:5, consolidationEnabled:true, consolidationThreshold:500}` 变成 default 档的值。真后端的合并语义下，这五项都是"给出的字段"，全部被覆盖，立即影响 premium 档下所有账号。
- 为什么是立即修：这是任务书要求的"修改只发改动的项、新建发全部五项"之外的第三条路径，它同时绕开了两个保护（并发修改安全；"立即影响所有账号"只在对话框顶部提示一句，没有二次确认），后果是对线上运行参数的静默覆盖。报告自检第 1 条修的是同一类问题，但只修了"修改"入口。相关的另一条路径：列表是页面加载时读的，别的管理员在这之后新建了同名档位时，新建流程会弹"将新建档位 X"的确认，确认后同样用全部五项覆盖对方刚建的档位（概率低，同一处修法）。
- 测试把错误行为固定住了：`src/pages/memory/tiers.test.tsx:253`"does not ask when the name is already in the list, and updates that tier"只断言发了一次写请求，没看请求体，名字用的是现成的 `premium`。
- 带着它上线的后果：运营想新建一个档位，手滑填成已有的名字，该档位所有账号的检索条数、合并开关立即被改成 default 的值；除审计日志外没有可见痕迹，也没有撤销。
- 建议修法（最小）：新建对话框里名字已存在时不发请求，在名字项下提示"这个档位已存在，请在列表里用修改"；补一个断言请求数为 0 的测试，把第 253 行的测试改成这个行为。

### 2. 客服反馈详情抽屉：`context` 里有一个值不是字符串，整个抽屉渲染时抛错

- 位置：`src/pages/support/FeedbackDrawer.tsx:128`（`{context[field] || DASH}`）和第 141 行（`{line}`，`recentErrors` 的每一项）。`context` 是 App 端提交的 JSON（契约 12 只规定了 `recentErrors` 最多 20 条、每条 500 字符，`appVersion` 等字段的类型没规定），页面按"都是字符串"直接当 React 子节点渲染。
- 触发步骤（在副本里复现）：假后端里让一条反馈的 `context` 为 `{"appVersion":{"a":1},"recentErrors":["x"]}`，或 `{"appVersion":"1","recentErrors":[{"code":1}]}`；在 `/support/feedback` 点这一行的"详情"。
- 错误结果：控制台 `Error: Objects are not valid as a React child (found: object with keys {a})`，抽屉里没有正文也没有任何内容，页面被路由错误页顶掉，需要刷新。`recentErrors` 是字符串（不是数组）时静默显示"—"；是数字时显示数字（这两种不崩溃）。
- 为什么是立即修：这是整个后台里最典型的"别人写的、管理员必须能看"的内容（任务书 Review Focus 要求的异常输入），一条异常反馈就让客服没法打开它的详情，而且正是客服最需要看的故障反馈。触发需要后端把非字符串的 `context` 值存下来；契约没有禁止，所以按"可能"处理，不按"不可能条件"。
- 建议修法：渲染前把值转成字符串（非字符串显示"—"，或 `JSON.stringify` 后截断），`recentErrors` 只取字符串项；补测试用上面两个例子。

## 记录（10）

每条都是真实存在、不影响数据正确性的缺陷，建议全部修。

1. **新建档位对话框在"修改对话框加载中被关闭"之后卡死。** `src/pages/memory/TierForm.tsx:78-80`：`.finally(() => { if (live) setLoading(false); })`，对话框关闭时 `live` 变为假，`loading` 永远停在真；新建模式（第 60-63 行的分支）不碰 `loading`。触发：点某档位的"修改"，对话框出现后在 `GET /memory/tiers/{name}` 还没返回时点"取消"（慢网络下很容易），再点"新建档位"。错误结果：对话框里的加载转圈一直不消失，"保存"按钮（第 164 行 `disabled: send.pending || loading || !ready`）一直灰着，直到重新打开某个档位的"修改"并等它加载完，或刷新页面。我在副本里给 `GET /memory/tiers/premium` 加 600 毫秒延迟复现，连续 6 次都是卡死（冷启动的第一次因为时序没卡住，已排除）。
2. **账号"记忆"页签换账号时，晚到的旧响应会覆盖新账号的数据。** `src/pages/memory/AccountMemoryTab.tsx:53-65`：`load` 里 `setMemory(await getAccountMemory(accountId))` 没有"这个请求还属于当前账号"的判断（同目录 `tiers.tsx` 的抽屉和 `TierForm` 都有 `live` 标志，这里没有）。触发：用户详情页在同一个组件实例上从账号 A 切到账号 B（父组件没有给页签加 `key`），A 的响应比 B 的慢。错误结果：B 的页签显示 A 的档位和指派历史。这一条是读代码得出的，没有跑；用户详情页由别的任务做，是否触发取决于它是否给页签加 `key`。
3. **共用文件 `src/components/PagedListTable.tsx:81`：所有列都 `search: false` 时仍画一张只有"重置""查询"的空搜索卡片。** 触发：打开 `/support/feedback`（契约没有给反馈列表的筛选参数）。我在副本里渲染确认：表格上方有 `.ant-pro-table-search` 卡片，里面只有这两个按钮，点了只是重新请求第一页。共用文件，本任务不能改，报告记录项 1 描述准确。
4. **共用文件 `src/components/DangerConfirmButton.tsx:25`：确认文字没有宽度上限。** 触发：`/monitor/alerts` 里 LOOK_PACKAGE_PREPARE_FAILED 行点"关闭"。antd 6.6.7 的气泡样式是 `width: max-content; maxWidth: 100vw`（`node_modules/antd/es/popover/style/index.js:49-50`），确认句子不换行，英文约 120 个字符时一行很长，窗口更窄时气泡占满整个窗口宽度。我没有开浏览器量过像素，结论来自样式源码；报告里的"约 800 像素"是它自己在浏览器里量的。按钮仍可点，不影响操作，所以不是立即修。
5. **管线页的来源下拉只有"这次返回的点里出现过的来源"。** `src/pages/monitor/pipeline.tsx:61, 80-82`。触发：一个来源停止上报后，在较短的时间范围里没有点，它既不在图里也不在下拉里。契约 14.1 没有"列出上报来源"的接口，所以彻底解决需要后端回复；报告记录项 4 描述准确，但问题文件没有单独问这一条。
6. **`MEMORY_MODEL_CONFLICT` 的 `detail` 只从 `data.detail` 读。** `src/pages/memory/ModelForm.tsx:34`。契约 16.3 只写"原样展示其 `detail`"，没写它在响应的哪里；问题文件第四条已问。如果后端把这句话放在 `message` 里，用户只会看到通用的"embedding 模型冲突：同名模型已注册但维度不同"，看不到原来登记的维度，页面也没有退路。分类为记录而不是立即修，因为位置取决于后端的回复；回复为 `message` 时这里要改成读 `error.message`。
7. **告警的 `detail` 假设是字符串。** `src/pages/monitor/alerts.tsx:82`（`EllipsisPopoverText text={row.detail}`）。问题文件第一条问的是 `detail` 是字符串还是 JSON 对象；如果后端回对象，整张告警表格会因为"对象不能当 React 子节点"崩溃，和立即修第 2 条同一类原因。回复前不改行为，回复后若是对象要补一个转字符串的步骤。
8. **提交 13a687b 带进了别的任务的文件。** 该提交包含 `src/locales/zh-CN/moderation.ts`（176 行新增，审核模块的中文文字），这个路径不在任务 13 的路径里，违反 CLAUDE.md"每次只提交自己任务的路径"。后果：在 13a687b、ed410be、1ec40e5 这三个提交上，zh-CN 有审核模块的键而已提交的 `src/locales/en-US/moderation.ts` 没有，`npx vitest run src/locales/parity.test.ts` 在 HEAD 上有 3 个用例失败（"have the same keys""use the same placeholders""same file keys, file by file"）；我在 HEAD 副本里跑过。共享检出里现在因为审核任务的 en-US 文件已改（未提交）所以看不出来。审核任务提交它的 en-US 文字后恢复；在那之前，任何人对这三个提交单独跑地基测试都会看到红。
9. **6 个语言键没有任何代码引用**：`support.note`、`monitor.alert.autoNote`、`memory.model.conflictTitle`、`monitor.alert.status`、`monitor.alert.type`、`memory.account.title`（中英文各一份，键对照没问题，只是没有用）。我用 `grep` 在 `src` 下除语言文件外查过，引用数都是 0。清理即可。
10. **问题文件里有三个问题契约 17.4 通则已经回答了。** `docs/contract-requests/2026-10-26-admin-frontend-memory-monitor-support.md` 第一条的 1、3 和第二条的 1（分页参数、`{items,total}`、默认按创建时间倒序）：`docs/shared-snapshots/backend-task-java-backend.md:2289` 写明所有列表接口统一 `page`/`pageSize`、响应 `{"items":[…],"total":N}`、没有特别写明排序的按创建时间倒序。没写的（不带 `status` 是不是全部、`detail` 的类型、反馈能不能筛选）仍然要问。

## 变更（3）

三条都是报告"变更候选"里列出的，我同意它们是新增或改变行为，需要负责人确认，不是遗留项：

1. 管线页的时间范围按钮（1 小时到 7 天）和"刷新"按钮：规格 5.14 没写，契约 14.1 默认只有最近 24 小时。
2. 成本报表链接对没有 `COST:VIEW` 的管理员显示为纯文字：规格写的是"页面上有一个链接"。
3. 告警页默认筛选"未处理"：规格没写默认筛选。

## 不是缺陷（6）

1. **报告记录项 3 / 任务指定检查的"未设置的 JSON 配置行显示红色'不是合法 JSON'且保存禁用"在当前 HEAD 上不存在。** `src/pages/config/ConfigRow.tsx:140` 已经是 `allowEmpty={item.value === null}`（提交 105deaa，2026-10-26 09:38，早于任务 13 的提交 10:03，报告里看到的是更早的状态）；`src/pages/config/ConfigForm.test.tsx:306-315` 有专门的测试。我在副本里渲染了 `/memory/models` 的参数区：`memory.tei_allowed_hosts`（未设置、无默认值）没有红色提示，"保存"在没输入时灰着（因为没有改动，正常），输入 `["tei.internal.example"]` 后"保存"变为可点、也没有红色提示。所以没有阻止保存一个本来就未设置的键。报告"需要改共享文件"的第三条可以删除。
2. **告警页的关联账号链接不按 `USER:VIEW` 判断。** `src/pages/monitor/alerts.tsx:62-63`。规格 5.14 要求"点关联账号跳用户详情"，没有写权限条件；没有查看权限时点进去会被路由守卫拦到 403 页，不泄露数据。和成本链接不同（成本链接是报告自己选择的行为，见变更第 2 条）。
3. **管线图的时间轴按浏览器时区显示，没有标 UTC。** 规格第 28 行：时刻是 ISO-8601 UTC 字符串、按浏览器时区显示，只有统计日才是 UTC 日历日并要标注；页面已在图上方写明"时间按浏览器所在时区显示"（`monitor.pipeline.timeZone`）。
4. **凭据类字段不回显：本任务没有这类字段。** 记忆服务的两把密钥（`AVATARMEMORY_API_KEY`、`AVATARMEMORY_ADMIN_KEY`）只在后端环境里，不出现在任何 `/api/admin` 响应里；`MEMORY:MODEL_REGISTER` 的参数区只有 `memory.tei_allowed_hosts`（主机白名单，不是密钥）；`ModelForm.tsx:14-25` 拒绝带用户名或密码的 `teiBaseUrl`。管线上报的签名密钥也不出现在读接口里。
5. **`tests/noHardcodedText.test.ts` 的"隐藏字符"一条当前红，不是本任务造成的。** 红的位置全在 `mock/avatar.mock.test.ts`、`mock/moderation.mock.test.ts`、`src/pages/avatar/avatarName.ts`、`src/pages/moderation/*` 等别的任务的未提交文件里；我扫描了本任务所有文件（源码、测试、语言文件、问题文件、报告），没有隐藏字符、没有韩文、en-US 里没有中日韩字符、没有品牌名或参照项目名。
6. **新建档位的"保存"按钮连点不会弹出两个确认。** 我在副本里对新建路径用 `fireEvent.click` 同一刻点两次，对话框数量和点一次一样（主对话框加一个确认）。

## 逐项检查任务指定的内容

### 请求形状和路径（对照契约 §16.2、§16.3、§14.1、§17.4、§12 和后端回复）

- 档位：`GET /memory/tiers`、`GET /memory/tiers/{name}`、`PUT /memory/tiers/{name}`，请求体 camelCase（`topK`、`recencyChannelEnabled`、`recencyChannelCount`、`consolidationEnabled`、`consolidationThreshold`），名字用 `encodeURIComponent`。正确。
- 模型：`GET /memory/embedding-models`、`PUT /memory/embedding-models/{name}` 请求体 `{teiBaseUrl, dimensions}`。正确。
- 账号：`GET /accounts/{id}/memory`、`PUT /accounts/{id}/memory/embedding-model` 请求体 `{modelName}`；响应类型含后端回复第 3 条的 `assignedByUsername`（已删除的管理员为 `null`，页面退到 ID 前 8 位）。正确。
- 告警：`GET /alerts?status=&type=&page=&pageSize=`、`POST /alerts/{id}/resolve`。管线：`GET /monitor/pipeline?from=&to=&source=`（`from`、`to` 是 ISO 时刻，`source` 没选时不发，`buildQuery` 会丢掉空值）。客服：`GET /support/feedback?page=&pageSize=`、`GET /support/feedback/{id}`、`POST /support/feedback/{id}/retry`。正确。

### 每个按钮的权限码（取接口要求的码，不只看页面查看码）

| 按钮 | 用的码 | 契约要求 | 结论 |
|---|---|---|---|
| 告警"关闭" | `MONITOR:MANAGE`（`alerts.tsx:28`，整列在没有权限时不渲染）；已解决的行也不渲染 | `POST /alerts/{id}/resolve` 需要 `MONITOR:MANAGE` | 对 |
| 反馈"重试" | `SUPPORT:MANAGE` 且 `FAILED`（`feedback.tsx:85`） | `SUPPORT:MANAGE` | 对 |
| 新建档位、修改 | `MEMORY:TIER_CONFIG`（`tiers.tsx`） | 同 | 对 |
| 登记模型、参数区 | `MEMORY:MODEL_REGISTER`（`models.tsx`；参数区没有这个码时连 `GET /config` 都不发） | 同 | 对 |
| 指派模型 | `MEMORY:MODEL_ASSIGN`（`AccountMemoryTab.tsx:44`） | 同 | 对 |
| 成本报表链接 | `COST:VIEW` | 路由 `/cost/report` 需要 `COST:VIEW` | 对（见变更第 2 条） |

### 告警处理

- 关闭确认：LOOK_PACKAGE_PREPARE_FAILED 用 `monitor.alert.closeConfirmLookPackage`，zh-CN 原文"关闭这条告警会把这个驱动资源包的失败次数清零并重新排准备任务。确定关闭？"，含任务书要求的句子；其他类型用通用确认。en-US 有对应句子。
- 状态冲突：409 `INVALID_STATE` 显示 `error.INVALID_STATE`（"对象当前的状态不允许这个操作"），并重新读列表；`data.status`（当前状态）不单独显示，列表刷新后行的状态就是当前状态。测试在 `alerts.test.tsx:255`、`feedback.test.tsx:295`。
- 防重复：关闭和重试都经 `RowActions` → `DangerConfirmButton`（`useSingleFlight`，进行中按钮禁用）。
- 未知类型显示原始字符串，14 种类型两种语言都有文字。

### 档位修改

- 修改已有档位只发改动的项（`TierForm.tsx:126-137`）：我跑了变异 17（把过滤改成全发），三个相关测试变红；什么都没改时不发请求。新建发全部五项。**例外：立即修第 1 条。**
- 双提交：修改路径、新建路径、模型登记、指派都有单次执行保护（`useSingleFlight` 或 `Popconfirm` 的 loading），测试里有"连点只发一次"。

### 错误显示

- 通用错误走 `describeFailure` → `error.<码>` / `reason.<码>`；校验错误按 `ref` 放到表单项（模型表单）或拼进错误条（档位表单）。用到的 `reason`（`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PATH`、`OUT_OF_RANGE`、`NOT_AN_INTEGER`、`NOT_BOOLEAN`、`EMPTY_NOT_ALLOWED`）两种语言里都有文字。
- 409 `MEMORY_MODEL_CONFLICT` 的 `detail` 从 `data.detail` 读（位置是暂定，见记录第 6 条）。

### 版面（长文字、阿拉伯语、泰语、emoji、5000 字符无空格）

- 没有开浏览器（任务要求不起开发服务器），按代码和样式判断：反馈列表的正文格子用 `EllipsisPopoverText`（`maxWidth`、行数截断、`overflowWrap: anywhere`、`dir="auto"`），完整文字在气泡里（最大高度 320、可滚动）；详情抽屉的正文是 React 文本节点（自动转义，没有 `dangerouslySetInnerHTML`，已 `grep` 确认），`pre-wrap` 加 `overflowWrap: anywhere`、最大高度 360 可滚动、`dir="auto"`。内容不会撑破列表，也不会被当作标记解释。
- 唯一的版面问题是共用确认气泡过宽（记录第 4 条）。
- 零值和空值：管线图里 `null` 的点不画（变异 27 把它改成 0，两个测试变红）；反馈失败次数为空显示"—"，下次尝试、解决时间、关联账号、转发引用为空显示"—"；档位页的 `0`（近期通道条数）是合法值，显示 0。

### 文字和键

- `src` 下的 `.tsx` 没有写死文字（`tests/noHardcodedText.test.ts` 除别的任务造成的一条红之外全过；本任务没有放行清单）。
- 三个模块的 zh-CN / en-US 键各 78、50、33 个，键相同、占位符相同（我用脚本逐键比对）。
- 本任务文件里没有第三方产品名、参照项目名、韩文、隐藏字符，没有调试输出。

## 对报告里 36 条变异的抽查

我在副本里重做了 12 条（报告编号），每条把一个判断改掉后跑对应测试，全部变红，改回后复原：

| 报告编号 | 变异 | 结果 |
|---|---|---|
| 1 | 告警"关闭"不看 `MONITOR:MANAGE` | 1 个测试红 |
| 3 | LOOK_PACKAGE 确认不特殊处理 | 2 个测试红 |
| 7 | "重试"不看 `SUPPORT:MANAGE` | 1 个测试红 |
| 8 | "重试"对所有状态显示 | 2 个测试红 |
| 17 | 修改档位发全部五项 | 3 个测试红 |
| 19 | 模型页丢掉 409 的 `detail` | 2 个测试红 |
| 23 | 待删除 / 删除中不禁用指派 | 2 个测试红 |
| 24 | 没有 `MEMORY:MODEL_ASSIGN` 也显示指派 | 1 个测试红 |
| 27 | 空值画成 0 | 2 个测试红 |
| 29 | 没有 `COST:VIEW` 也显示链接 | 1 个测试红 |
| 31 | 假后端对已解决的告警不报 409 | 1 个测试红 |
| 36 | `ALERT_TYPES` 少 LOOK_PACKAGE_PREPARE_FAILED | 1 个测试红 |

报告说的 36 条里这 12 条属实；其余 24 条我没有验证，不能说它们成立或不成立。**变异检查漏掉的东西**：这些变异都是对"已想到的路径"做的；立即修第 1 条（新建对话框填已有名字）是没想到的路径，而且有一个测试把错误行为当成了期望，所以变异检查不能证明这一块是对的。

## 未运行

- 没有开浏览器看版面（任务要求不起开发服务器）。
- 没有重做其余 24 条变异。
- `AccountMemoryTab` 没有页面放它，只在组件测试里验证（报告同样说明）。
