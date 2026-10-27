立即修 0、记录 6、变更 1、不是缺陷 6、阻塞 0

# 任务 20（埋点管理）评审：提交 ab7efa1

评审方式：先读 CLAUDE.md、执行约定、模块任务说明、任务书（`brief.sh 20`）、规格 5.6、契约 §7 和 §17.4、后端回复第 13 条，再逐句对照三个页面的实际渲染；跑了本任务的 97 个测试（全绿）和对本任务路径的 `biome check`（无报错）；在 `git archive ab7efa1` 的副本里做了 22 个变异；还写了一个临时探针测试（已删，不在仓库里）。没有改共享检出里的任何源文件，没有起开发服务，没有访问其他仓库。仓库里的 `tests/noHardcodedText.test.ts` 有一项是红的，红在 `mock/invite.mock.test.ts:162` 和 `mock/push.mock.test.ts:156`（别的任务的文件），本任务的文件没有被扫描到问题。

## 规格 5.6 逐句对照

事件汇总（`summary.tsx`）
- 日期范围默认 7 天（`summary.tsx:26`），`maxDays` 取 `analyticsLiveMaxRangeDays`：有。
- 查询按钮：有。表格列事件名、触发次数（`pv`）、去重账号数（`uv`）：有；三列都可排序，默认 `pv` 降序（`defaultSortOrder`），前端分页 50（`PAGE_SIZE`）：有。
- 无落地条：没有落地条，页面底部写明"现查"：有。
- 事件汇总接口不分页、一次全部：服务函数和页面都按这个做。

事件明细（`detail.tsx`）
- 筛选账号 ID、设备 ID、事件名（联想来自 `event-names`）、时间范围：有；范围选择器 `allowClear={false}`，不能清空，默认 7 天，等于"必填"。
- 列：事件名、账号（匿名显示"—"）、设备、接收时间、客户端时间、平台、App 版本、国家、IP：九列都有。平台、App 版本读 `context`，读不到显示"—"。
- 客户端时间的"不可信"：表头带问号提示"客户端自报，不可信，仅供排查"（见记录 2）。接收时间的提示"统计用的是这个时间"：有。
- IP：`value || DASH`，原样显示后端给的值，前端没有任何自己的掩码或解掩码逻辑；是否完整由后端按 `ANALYTICS:IP_VIEW` 决定（假后端 `mock/analytics.mock.ts` 的 `present` 按权限掩码，变异 M20 变红）。
- 展开行显示格式化的 `params`、`context`：有（`JSON.stringify(value, null, 2)`，`pre`，`pre-wrap` 加 `overflow-wrap: anywhere`、`dir="auto"`，最高 320 像素可滚动）。React 文本节点渲染，没有 `dangerouslySetInnerHTML`；非字符串值（数字、嵌套对象、数组）走 JSON.stringify；`null`/缺失显示"—"；`JSON.stringify` 抛错（例如 BigInt）有兜底。阿拉伯语、泰语、emoji、2500 个泰文字符（5000 个 UTF-16 单位）的串在测试里都有。

漏斗分析（`funnel.tsx`）
- 已保存漏斗选择框，预设带"系统预设"标签：有（`optionLabel`）。
- 日期范围、步骤（`mode="tags"` 可输入的多选，选项来自 `event-names`）、`windowHours`（默认 24）：有。
- 按钮查询、另存为、编辑、删除：有。另存为需要 `ANALYTICS:FUNNEL_MANAGE`；编辑、删除需要该码，并且选中的是非预设的已保存漏斗（`funnel.tsx` 里 `canManage && selected && !selected.isPreset`）；预设没有编辑、删除，只能另存为复制。没有写权限的管理员三个按钮都不渲染，仍可查询。
- 校验：步骤 2 到 10、窗口 1 到 720 的整数、步骤不含逗号、不为空（先按契约 1.9 的 `trimSpec` 去空白）；不合格时查询、另存为、编辑都禁用并写出原因。请求里 `steps` 用逗号连成一个值（变异 M11 变红）。
- 结果：漏斗图加表格（序号、事件名、去重账号数、相邻步骤转化率）；转化率直接取响应的 `conversionFromPrevious`，`null` 显示"—"，页面没有自己算比率（变异 M3、M19 变红）。
- 提示面板：有"同一账号按顺序在窗口内依次完成各步骤才算"、去重人数不跨日聚合、没有账号的事件按设备串联（措辞见记录 4）。
- 重名：另存为发 `POST`，重名由后端返回 409 `DUPLICATE_RESOURCE`，对话框保持打开、只显示 `error.DUPLICATE_RESOURCE` 的译文；页面从不覆盖已有漏斗，所以不存在"没问就覆盖"。
- 双击：名称对话框用 `useSubmitOnce`（变异 M10 变红），删除用 `DangerConfirmButton`（行内确认加单飞）。

规格里写了而页面没有的元素：我没有找到。

## 变异检查（我在副本里自己做的，22 个）

每个都是改一处判断、跑相关测试、还原；还原后 `diff -r` 与 ab7efa1 一致。

变红（21 个）：M1 `canManage` 恒为真；M2 预设显示编辑和删除；M3 `null` 转化率当 0 显示；M4 步骤上限 11；M5 去掉逗号检查；M6 窗口上限 721；M7 去掉空步骤检查；M8 汇总页大小 20；M9 去掉默认 `pv` 降序；M10 名称对话框去掉防重复提交；M11 `steps` 用分号连接；M12 另存为不受表单合法性限制；M13 展开行用 `String(value)`；M14 汇总页忽略 `analyticsLiveMaxRangeDays`；M15 明细默认范围 6 天；M16 默认窗口 25；M17 编辑不受表单合法性限制；M18 去掉客户端时间提示；M19 页面自己重算转化率；M20 假后端 IP 一律不掩码；M21 明细路由权限码改成 `ANALYTICS:IP_VIEW`。

没变红（1 个，M22）：把 IP 列表头的提示 `analytics.detail.ipTip` 换成空串，15 个明细测试仍全绿（见记录 5）。

## 发现

### 记录（6）

1. 漏斗结果在表单改动后不清除，结果和表单对不上。位置：`src/pages/analytics/funnel.tsx` 的 `choose`、步骤和窗口的 `onChange`、日期范围的 `onChange` 都没有清 `result`（`result` 只在查询失败时清）。触发：选预设"注册漏斗"并查询，再选"激活漏斗"（或加删一个步骤、改窗口、改日期）；我写了探针测试确认：表单里的步骤已是 4 步，下面的图和表仍是注册漏斗的 `app_open`、`register_completed` 两步，且没有"这是旧结果"的标记。后果：管理员可能把上一次的数字当成当前表单的结果，尤其是只改了窗口或日期时，表里的步骤名一样、数字却是按旧窗口算的。建议修：改动表单时清掉结果或标记过期。
2. "客户端时间不可信"只靠表头问号的悬停提示。位置：`src/pages/analytics/detail.tsx` 的 `TitleWithTip`（问号图标 `QuestionCircleOutlined` 包在 `Tooltip` 里，不可聚焦），列单元格里的时间和接收时间看起来一样。触发：只用键盘或触屏设备打开事件明细。后果：看不到"客户端自报，不可信"的警告，可能把客户端时间当事实用。建议修：把"自报"字样放进可见的表头文字或单元格。
3. 默认日期范围不看后端的上限。位置：`summary.tsx:26`、`detail.tsx:75`、`funnel.tsx:62` 都是 `lastNDaysUtc(7)`，没有取 `min(7, analyticsLiveMaxRangeDays)`；规格 5.6 写"默认 7 天，不超过 `analytics.live_max_range_days`"。触发：运营把 `analytics.live_max_range_days` 改成小于 7（契约没写下限，默认 31），打开事件汇总。后果：页面一打开就发超限的请求，显示 `INVALID_REQUEST` 的通用文字，得手动缩小范围才有数据。建议修。
4. 提示文字里有契约没有写的语义。位置：`src/locales/zh-CN/analytics.ts` 的 `analytics.summary.tip`（"去重账号数里每个已登录的账号只算一次"）和 `analytics.funnel.help.anonymous`（"按同一台设备串到它之后登录的账号上"），en-US 同；契约 §17.4 对 `uv` 只写"去重账号数"，没有写匿名事件算不算；漏斗的"主体"是账号，没有账号时取同一设备在窗口内带账号的事件的账号，仍没有就用设备本身（"之后"也不是契约的限定）。触发：后端实际把仅有设备的匿名主体计入 `uv` 或漏斗人数。后果：表头叫"去重账号数"（规格的叫法），提示又说只算已登录账号，运营会把匿名设备误读成账号。建议修：提示只写契约写了的内容，或向后端确认后再写；并把漏斗的"主体可能是仅有设备"写进提示面板。
5. `analytics.detail.ipTip`（IP 列表头提示，说明按后端给的原样显示）没有测试。位置：`src/pages/analytics/detail.test.tsx`；触发：把 `detail.tsx` 里 `tip={t('analytics.detail.ipTip')}` 换成空串（变异 M22），15 个测试全绿。后果：提示丢失没人发现。这条实现者的报告里已经记了，我复现了。建议修。
6. 漏斗页"连续输入多个步骤"的路径没有自动测试。位置：`src/pages/analytics/funnel.test.tsx` 的 `addStep`（实现者说在 happy-dom 里同一个多选框第二次输入加不上，多步骤测试靠先存到假后端再选择）；触发：把测试里的 `seed` 换成连续 `addStep`。后果：步骤上限、逗号、空白的页面级测试是对"选择已保存漏斗"的路径做的，手输路径只有规则函数的单元测试和实现者的一次浏览器检查。建议修。

### 变更（1）

1. 事件明细和其他两个页面的时间范围只到 UTC 日。规格写的是"时间范围（必填）"，排查常常要精确到分钟；是否加时间选择取决于后端对 `from`、`to` 格式的回答（问题文件第一条）。这是新增行为，要先和负责人确认；现在的做法（`YYYY-MM-DD` 含两端，同 `/stats/*`）是按契约缺口取的最小做法。

### 不是缺陷（6）

1. 没有导出：规格 5.6 没有给埋点管理三个页面任何导出，任务书也没有。
2. 事件明细的行键用 `id`（`detail.tsx` 的 `rowKey="id"`）：契约没有写这个接口的响应字段，问题文件第二条第 3 问已经向后端问了有没有 `id`；按契约缺口的规则这不是阻塞，回复后再改。
3. 时间用浏览器时区显示（`formatInstant`）：规格第 28 行和计划第 43 行都规定"时刻按浏览器时区显示，统计日是 UTC 日并标注 UTC"，三个页面都放了 `UtcNotice`。
4. 另存为遇到重名不覆盖：页面只发 `POST`，后端 409 时对话框保持打开并只显示 `error.DUPLICATE_RESOURCE`；编辑时改成别的漏斗的名字同样 409。没有"静默覆盖"的路径。
5. 页面不判断 `ANALYTICS:IP_VIEW`：IP 是否完整完全由后端决定，页面原样显示，这是契约的规定（`ip` 默认掩码，持有 `ANALYTICS:IP_VIEW` 才返回完整）；页面只在表头提示里说明。
6. 假数据里登录方式值写了 `google`、`apple`（`mock/_core/analyticsData.ts:130`）：这是契约 §2 的登录接口 `/google`、`/apple` 对应的方式值，不是参照项目名或第三方产品名的引用；仓库里没有出现参照项目名（我对提交的全部文件搜了 dramaBox 等词，没有命中）。

### 立即修（0）、阻塞（0）

我没有找到输出错误、崩溃、数据丢失、隐私暴露或契约被破坏的问题。已核对没有问题的项：硬编码文字（`src` 下 `.tsx` 没有写死文字，没有 `hardcodedText.allow.json` 也没有需要的条目）；zh-CN 与 en-US 各 62 个键、键相同、占位符相同；没有韩文；没有调试日志；没有 `localStorage`、`sessionStorage`；没有第三方产品名；`mock/analytics.mock.ts` 只有默认导出，状态挂在 `globalThis`，有重置函数；写接口的权限（`ANALYTICS:FUNNEL_MANAGE`）、预设只读（409 `INVALID_STATE`）、404、400 的 `ref` 都按契约缺口文件里的暂定做法实现。

## 没有核实的

漏斗图（`@ant-design/plots` 的 `Funnel`）在所有步骤人数都是 0 时画成什么样，我没有核实：测试里图被桩替换，我没有起开发服务做浏览器检查。表格在这种情况下显示 0 和"—"（有测试），图的这一种情形我还没查清。
