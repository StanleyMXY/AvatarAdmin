立即修 0、记录 12、变更 1、不是缺陷 9、阻塞 0

# 任务 26（成本报表与价格管理）评审

评审对象：提交 `5284e6e`、`0483233`（分支 `claude/jolly-dirac-4pq9g6`）。评审方式：独立只读评审；变异和模糊测试都在 `git archive HEAD` 的副本里做（脚本前缀 `t26r-`，在 scratchpad），共享检出里没有改任何文件；这份报告是我写的唯一文件，没有提交。

深度：钱和价格流程，按"钱页"的标准评审（不是认证类，不做多轮复审）。未运行：浏览器里把鼠标放到图上看提示框；对着真实后端；中文界面的浏览器布局；全量测试和构建（按规则留到任务 32）。我另做了一次生产构建（只在副本里）看十进制工具的打包结果，见 1.5。

共享检出里有任务 27 的未跟踪文件（`mock/_core/adsData.ts`、`mock/ads.mock.test.ts` 等），不属于这次评审，我没有动。

## 1. 十进制与钱（a）

1.1 **模糊测试对照独立参考**（参考用 Python `decimal`，精度 5000 位）：
- 6000 组随机十进制（正负、前导零、尾随零、1 到 60 位整数部分、最多 25 位小数、`0`、`0.0000000001`、`12345678.1234567890`），逐项对照 `addDecimals`（值和小数位数＝较大者）、`compareDecimals`、`sumDecimals`（1 到 6 项）、`roundDecimal`（0 到 11 位，四舍五入远离零）、`formatAmount`（最多 6 位、至少 2 位、`<0.000001`、负数为 null）、`toDecimalString`（字符串原样）：**不一致 0 处**。唯一的差别是负零：参考给 `-0.000`，实现给 `0.000`，实现更合理，不算缺陷。
- 3000 个随机 JS 数（指数 -30 到 +30，另有 `5e-324`、`1.7976931348623157e308`、`0.1+0.2`、`2**53`）经 `toDecimalString`，值与参考相等且不含指数：0 处不一致。带指数的字符串（`1e-10`、`6E-6`、`-1.5E+3`、`0e5`、`1e400` 通过、`1e401` 和 `1e-401` 为 null）符合预期。
- 两个各 40000 位的十进制相加，用时远低于 3 秒，结果与参考相等。
- `isValidPrice`：`0`、`00`、`0.0000000001` 通过；`0.`、`.5`、`1e3`、` 1`、`+1`、十一位小数、全角数字、`1_0`、`\n1` 都不通过（JS 的 `$` 不会匹配末尾换行）。

1.2 **没有钱经过 Number 或浮点**（逐处读代码，搜 `Number(`、`parseFloat`、`toFixed`、`Math.`、`JSON.parse`）：`decimal.ts` 里的 `Number(match[4])` 是指数，不是钱；`index.ts:29-33` 的 `Number(raw.inputMinTokens)` 是 token 数；`ManualTab.tsx:28` 是档位边界（整数）；`costRows.ts:203` 的 `value: Number(exact)` 只给柱子的高度，提示框用 `text`（精确文字，`CostChart.tsx:55`）。卡片、表格、导出参数、手填请求体、待审对比、当前价格全部是十进制文字（`Price` 组件原样显示）。结论：**钱只在画柱子的高度时变成浮点**，见不是缺陷 2。

1.3 **币种从不相加；无费用组只计次数**：`summarize`（`costRows.ts:84-99`）按币种分开加，`toLine`（`costRows.ts:47-67`）把空币种归 `NONE` 并把它的费用置 null，`groupLines` 的键含币种，图表每个币种一张。变异 X1（表格分组键去掉币种）被测试抓住（3 个失败）。

1.4 **导出、落地、权限**：`ExportButton name="usage-cost" viewCode="COST:VIEW"`（`report.tsx:286`）要 `STATS:EXPORT` 加 `COST:VIEW`，`LandBar name="usage-cost"`（`report.tsx:288`）；变异 M8（换成 `STATS:VIEW`）、M9（落地名换掉）被抓住。

1.5 **打包相关**：`decimal.test.ts` 末尾那条扫描只读 `decimal.ts` 并滤掉注释行，找 `**`；我把 `BigInt('1' + '0'.repeat(n))` 改回 `10n ** BigInt(n)`（变异 M2），那条测试变红。除 `decimal.ts` 外，本模块的源码里没有别处用 BigInt（`mock/cost.mock.ts:34` 的 BigInt 只在 node 里跑，不进浏览器包）。我在副本里跑了一次 `max build`，打开含 `not a decimal` 的产物：BigInt 字面量被转成 `BigInt(0)`、`BigInt(2)`，`pow10` 是 `BigInt("1".concat("0".repeat(e)))`，没有 `Math.pow`，乘除取余保持运算符，产物是对的。没有发现别的会被打包器改坏的 BigInt 写法。

1.6 **JSON 数的来回**：请求体里价格是字符串（`mock/cost.mock.ts` 的 `priceOk` 要求字符串，页面测试和假后端测试都通过）；读进来的 JSON 数会被 `toDecimalString` 展开成文字，但"JSON 解析时已丢的精度"补不回来，这点已在问题文件第一条里问了后端。

## 2. 价格流程（b）

- 状态与动作：待审（确认、驳回，都要 `COST:PRICE`）、生效（撤回，只有 `ACTIVE` 有，含生效日在将来的）、被取代/已驳回/已撤回（历史里只读，没有任何编辑入口，`prices.test.tsx` 有测试）、手填（只有 `COST:PRICE` 有页签，地址里写 `?tab=manual` 也进不去，`prices.tsx:32-36`）、改模型登记（`ModelsTab.tsx`，非 LLM 适配器下拉不可用）。变异 M12（任何状态都有撤回）、M21（没有 `COST:PRICE` 也能用 `?tab=manual`）、M22（待审页把权限写成恒真）、M13（没有 `MONITOR:VIEW` 也显示告警条）、M19（非 LLM 也能选适配器）都被抓住。
- 每个转换在确认前写明后果：确认（从该日起计费、同日旧批被取代、生效日已到则事后补算无价格请求且已存费用不改、生效日在将来则告警不关闭、币种没能核对由后端检查；变异 M18 把"已到/将来"判断反过来被抓住）；驳回（`rejectHint`）；撤回（`retireHint`，含"没有别的生效价格则之后的请求没有价格"）；手填（马上生效、不能再改、取代同日旧批、补算）；改登记（`editHint`）。对照契约 §14.2 逐句核对，说法一致。
- 驳回、撤回的备注由共享的 `ReasonModalForm` 去首尾空白后按码点数 1 到 500 检查，提交 `{ note }`；契约也是 1 到 500。
- 币种：下拉只含 `allowedCurrencies`；缺失时下拉不可用并提示，确认不发币种（`PendingTab.tsx:330-335`，由后端检查，任务书同样写法）；批次的币种不在允许列表里时要求重选且确认按钮不可用（变异 M11 被抓住）。
- 逐档对比：按下限配对，新价在上、当前价在下，数值不同时加粗，尾随零不同不算不同（`compareDecimals`），只在新批次里有的档位当前价为"—"；非 LLM 对比单价和单位。币种不同时的问题见记录 1。
- 双人复核：我读了 `docs/shared-snapshots/` 两份快照、`docs/backend-inputs/` 四份文件和计划。`SELF_REVIEW_FORBIDDEN` 只出现在契约错误码表（`backend-task-java-backend.md:121`）和额度调账（§15.9、规格 5.19 的核对项 `admin-frontend-design.md:590`）；§14.2 写明 `PENDING_REVIEW` 只能由价格同步生成、手填直接是 `ACTIVE`，`retire`/`reject` 只要求状态和备注。**没有价格批次的双人复核规则，实现没有加是对的**（不是缺陷 1）。

## 3. validateBands（c）

签名：`validateBands(bands: readonly BandBounds[]): { ok: true } | { ok: false; reasonKey: string }`，`BandBounds = { inputMinTokens: number | null; inputMaxTokens: number | null }`。任务书写的 `Band[]` 可直接传入（`Band` 有这两个字段，类型兼容）；表单传入的是未填时为 null 的草稿，所以参数类型放宽是必要的（不是缺陷 6）。九个 `cost.bands.*` 键两种语言都有。

- 每条规则正反例：`validateBands.test.ts` 有；我变异了第一档不为 0（M4）、缺口（M3）、重叠（M6b，整行删掉）、最后一档有上限（M5）、安全整数（M6，换成 `Number.isInteger`）：各被抓住 1 个失败。
- 模糊测试：20000 组随机档位（包含 `NaN`、负数、小数、`2**53`、`2**53+2`、`MAX_SAFE_INTEGER`、`Infinity`、`1e21`、缺下限、乱序、中间档上限为空），对照我写的独立参考：**不一致 0 处**（其中有效组 9040 个）。
- 表单入口 `parseBound`（`ManualTab.tsx:25-30`）：先用 `trimSpec` 去 29 种空白，空串为 null，只有 ASCII 数字串才转数，其余（负号、小数点、指数、全角数字、`0x`、空格夹在中间）是 NaN，由 `validateBands` 报"边界是不小于 0 的整数"；超过 2^53 的数字串转出来不是安全整数，被拒绝。这时提示写的是"整数"，对一个很大的整数不准确，但这个数没有实际用途，不算缺陷（不是缺陷 7）。

## 4. 报表页（d）与规格 5.23 逐句对照

| 规格或任务书的要素 | 页面 | 结论 |
|---|---|---|
| 顶部那句（费用按各组件上报…分摊价格） | `cost.report.note.body`，中英各有测试 | 一致；"阿里云账单"按任务书和仓库规则写成"云厂商账单"（不是缺陷 5） |
| "没有价格的请求只计次数" | `cost.report.note.unpriced` | 有 |
| 统计日是 UTC 日 | `UtcNotice` | 有 |
| 日期范围默认 7 天 | `lastNDaysUtc(7)` | 有 |
| 筛选：资源类型、模型、来源（通话、文字对话、形象生成）、使用者类型（五种）、币种（含无费用） | `report.tsx:222-285`，`NONE` 随币种筛选发出 | 有 |
| 卡片：总费用、请求数、没有价格的请求数；点击跳价格页"模型"页签并筛"没有生效价格" | `report.tsx:304-343`，链接 `/cost/prices?tab=models&hasPrice=false`；价格页 `prices.tsx:29-38` 真的读 `tab` 和 `hasPrice`，`ModelsTab` 的初始勾选取自它 | 有；变异 M10（链接改到 `tab=current`）被抓住 |
| 趋势图：每日费用，按模型堆叠，不同币种分开 | `CostChart.tsx`，每个有费用的币种一张，缺日补 0，纵轴写币种 | 有 |
| 表：资源类型、模型、来源、使用者类型、请求数、输入、缓存输入、输出（仅 LLM）、数量与单位（其余）、费用 | `report.tsx:134-190` 另加币种和"没有价格的请求"两列 | 有；非 LLM 行是"数量 + 单位"，token 列为"—" |
| 重新落地该日（`STATS:LAND`）、导出（`STATS:EXPORT` + `COST:VIEW`） | 见 1.4 | 有 |
| 路由 `COST:VIEW` | `config/routes/cost.ts` | 有（`config/routes/cost.test.ts`） |

**测试里的 `fetch` 替身是否符合契约 §17.6 的 `usage-cost`**：符合。替身行的列是 `statDate、resourceType、provider、model、unit、source、tier、currency、requests、inputTokens、cachedInputTokens、outputTokens、quantity、costAmount、unpricedRequests`，与 §17.6 汇总表一一对应；LLM 行有 token 且 `quantity` 为 null，非 LLM 行相反，`NONE` 行 `costAmount` 为 null、`requests` 等于 `unpricedRequests`，与 §14.2 一致。`costAmount` 用字符串、`quantity` 用数，两种类型契约都没定，两种页面都收（`costRows.test.ts` 有）。共享假后端 `mock/stats.mock.ts:157-205` 的形状不符合（资源类型是 `TTS`、`STT`，来源是 `CHAT`，金额是数），所以才用替身；这个出入已在实现者的报告里列为需要改共享文件，我同意，见记录 9。

## 5. 权限、重复提交、过期应答、布局、文字（e）

- 每个按钮的权限：确认、驳回（`PendingTab`）、撤回（`CurrentTab`）、手填页签（`prices.tsx`）、改登记（`ModelsTab`）都要 `COST:PRICE`，没有就不渲染（有测试）；告警条数要 `COST:PRICE` 加 `MONITOR:VIEW`；参数区 `<Can code="COST:PRICE">`。
- 重复提交：`ActionModal`（确认、手填、改登记）和 `ReasonModalForm`（驳回、撤回）都走 `useSingleFlight`，第二次点击不再发请求（页面测试里各有一条；变异 M17 之类未涉及）；导出和落地用共享组件，实现者在浏览器里双击验证过一次请求，我没有重做。
- 过期应答：`useLatestRead`（`useLatestRead.ts`）用计数丢弃旧的成功和失败，页面测试有"第一次慢、第二次快"；变异 M17（去掉计数判断）被页面测试和钩子测试同时抓住。`ManualTab`、`AlertsLine`、报表的模型提示用 `alive` 标志。四份同类钩子的事见记录 10。
- 非字符串值：报表和批次读取都经 `plainText`/`normalizeBatch`，有"对象或数字当模型名不崩"的测试；**模型页签的登记对话框没有**，见记录 5。
- 布局：模型名用 `WrapText`（任意长度无空格串可折行并限三行）、`EllipsisPopoverText`（报表）；我对 5000 字符的模型名没有发现问题，但发现两处在合同允许的长度内会撑宽的地方，见记录 3、4。
- 硬编码文字：`tests/noHardcodedText.test.ts` 在副本里通过（31 个）；只有协议值 `DASHSCOPE_INTL` 作为适配器下拉的显示（规格 5.23 自己就写了这个值）。
- 语言文件：`cost` 键 zh-CN 和 en-US 各 204 个，键、占位符完全相同，en-US 无中日韩字符，zh-CN 无韩文（我用脚本逐键核对）。
- 第三方名称：`src/pages/cost`、`src/services/cost`、两种语言的文字、`mock/cost.mock.ts`、`mock/_core/costData.ts`、两个测试、路由、问题文件里，没有厂商或模型名出现在标识符、注释、文字里；只有适配器协议值 `DASHSCOPE_INTL`（不是缺陷 3）。假数据里的提供方是 `provider-a.example` 这类占位。
- 语言覆盖：假数据含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文和 emoji、5000 字符串；界面只有 zh-CN 和 en-US。实现者自己承认印尼、越南、西班牙语只作为短模型名出现，我同意这一点的说明。

## 6. 变异检查：我自己做了 27 个（实现者报告写 37 个），26 个被抓住，1 个活下来（X5，见记录 12），1 个是等价变异（M7）

在副本里改源码，跑对应测试，每次改完都 `git checkout -- .` 还原：

| 编号 | 变异 | 结果 |
|---|---|---|
| M1 | `addDecimals` 改成 `Number(a)+Number(b)` | 5 个失败 |
| M2 | `pow10` 改回 `10n ** BigInt(n)` | 扫描测试失败 |
| M3 | 缺口判断放宽 | 失败 |
| M4 | 第一档只要不小于 0 | 失败 |
| M5 | 最后一档不再要求上限为空 | 失败 |
| M6 | `isSafeInteger` 换 `isInteger` | 失败 |
| M6b | 去掉重叠判断 | 失败 |
| M7 | 去掉 `summarize` 里跳过 `NONE` 的那行 | **没有失败**，是等价变异，见不是缺陷 4 |
| M15 | `toLine` 对 `NONE` 不再置空费用 | 失败 |
| M8 | 导出的查看权限换成 `STATS:VIEW` | 失败 |
| M9 | 落地名换成 `daily-event` | 失败 |
| M10 | 没有价格卡片的链接改到 `tab=current` | 失败 |
| M17 | `useLatestRead` 旧应答可覆盖新应答 | 页面和钩子测试各失败 1 个 |
| M11 | 币种不在允许列表时仍可确认 | 失败 |
| M12 | 任何状态都有撤回按钮 | 失败 |
| M13 | 告警条只看 `COST:PRICE` | 失败 |
| M14 | 档位有错时保存按钮仍可用 | 失败 |
| M18 | 确认后果里"已到/将来"判断反过来 | 2 个失败 |
| M19 | 非 LLM 也能选适配器 | 失败 |
| M21 | 没有 `COST:PRICE` 也能打开 `?tab=manual` | 失败 |
| M22 | 待审页的权限判断写成恒真 | 失败 |
| X1 | 表格分组键去掉币种 | 3 个失败 |
| X4 | 分页读取的停止条件放宽 | 2 个失败 |
| X2 | 当前价格把生效日在将来的批次也当成当前价格 | 3 个失败 |
| X3 | 图表不再按币种分图（全部归一个币种） | 4 个失败 |
| X5 | 价格页告警条里两种告警的类型互换（`AlertsLine.tsx:26`） | **没有失败**，见记录 12 |
| X6 | 确认时不发 `effectiveFrom` | 3 个失败 |

## 7. 发现（只用五个分类）

### 立即修

无。我逐条找过"输出错误、崩溃、数据丢失、安全或隐私、契约被破坏"，在 5.23 逐句对照、十进制模糊测试、档位模糊测试、双人复核核对里都没有发现规格或任务书写了而页面没有的元素，也没有发现钱经过浮点。

### 记录

1. `src/pages/cost/PendingTab.tsx:42-60`（`PriceCompare`）和 `:86-125`（`CompareTable`）：对比两批价格时不看币种，也不显示"当前"价格的币种。触发：待审批次是 USD 的 0.4，当前生效批次是 EUR 的 0.4；页面显示新价和"当前：0.4"，没有加粗，卡片里找不到 `EUR`（我在副本里用 `fetch` 替身跑过：被标为已改的元素 0 个，卡片文字不含 EUR）。结果：币种变了但看起来价格没变，运营只能凭币种下拉去猜；同步生成的批次币种是默认币种，当前批次币种可由运营填成别的，所以这是会发生的。建议全部修：在"当前"旁写币种，币种不同时标为已改。
2. `src/pages/cost/PendingTab.tsx:366-385`（驳回）和 `src/pages/cost/CurrentTab.tsx:260-278`（撤回）：两个理由对话框只有标题和备注框，没有写是哪个模型、哪个生效日期、哪个币种（确认对话框有，`PendingTab.tsx:322-363` 的摘要）。触发：当前价格页展开历史后点某个旧 `ACTIVE` 批次的"撤回"，对话框和点当前行的一模一样。结果：撤回会让之后入库的记录改按别的批次计价或没有价格，操作的对象却看不出来。`ReasonModalForm` 有 `hint` 参数，可以把摘要放进去。
3. `src/pages/cost/PendingTab.tsx:189-191`：提供方放在 `<Tag>` 里，antd 的标签是 `white-space: nowrap`（`node_modules/antd/es/tag/style/index.js:27`），`WrapText` 的 `overflow-wrap: anywhere` 在不换行的容器里不起作用。触发：提供方是 128 个泰文字符（契约允许 1 到 128 个）。我用 Chromium 在 390 像素宽的页面里量同样的结构：标签宽 944 像素，页面横向滚动宽 960 像素。结果：待审价格页在手机宽度出现整页横向滚动。实现者的 5000 字符检查只覆盖了模型名。
4. `src/pages/cost/CurrentTab.tsx:138`：历史表的备注列 `<WrapText value={b.reviewNote} lines={4} />` 没有最大宽度，而表是 `scroll={{ x: 'max-content' }}`（`:251`），列宽取内容的最大宽度，四行截断不起作用。触发：一个被驳回的批次备注是 500 个泰文字符（契约上限）。我用 Chromium 量同样的结构：不加最大宽度时单元格宽 4845 像素、高 27 像素（一行），加 320 像素最大宽度后折行。结果：展开历史后整张表要横向拖很远才能看到后面的列；模型名列已经有 `maxWidth`（`:156`），备注列漏了。
5. `src/pages/cost/ModelsTab.tsx:54`（`useState(model.syncModelId ?? model.model)`）、`:63`（`model.model.length`）以及 `src/services/cost/index.ts:104-113`（`listUsageModels` 不做规整，是本模块唯一不规整的读取函数）：登记对话框直接使用原始字段。列表的单元格用 `WrapText`，不会崩；对话框会。触发：`/usage/models` 的某一项 `syncModelId` 是数组或 `model` 是对象，点"改登记"。我在副本里复现了：`TypeError: s.charCodeAt is not a function`（`trimSpec`），换成对象模型名则是 `Objects are not valid as a React child`，整页白屏。契约把这些字段定为字符串，所以只是对非契约数据不稳；报表和批次读取都有这类测试，模型页签没有。
6. `src/pages/cost/prices.tsx:75`（`destroyOnHidden`）和 `:38`（预设筛选只在页面挂载时读一次）：切换页签会销毁页签内容。触发一：在手填页签填了半张档位表，点一下"当前价格"再点回来，表单是空的（草稿丢失）。触发二（我在副本里跑过）：从报表卡片进入，模型页签预设勾上"只看没有生效价格"，取消勾选，切到"当前价格"再切回，又被勾上，行数从 2 变回 1。另：页签不写进地址，刷新回到"待审价格"（实现者记录项 4 同一件事）。
7. `src/pages/cost/report.tsx:112` 和 `:122-130`：币种下拉由 `allowedCurrencies` 加"页面里出现过的币种"组成，出现过的币种取自当前应答。`allowedCurrencies` 缺失时（`useAdminMeta()` 允许缺项），按币种筛选后下拉只剩被筛的那个。触发（副本里跑过）：无 `allowedCurrencies`，先选 EUR 再点"查询"，再打开下拉，选项从 `USD、EUR、无费用` 变成 `EUR、无费用`。结果：只能先清除筛选才能切到另一种币种；有 `allowedCurrencies` 时不受影响。
8. `src/pages/cost/labels.ts:25-34`（`legendLabels`）和 `src/pages/cost/CostChart.tsx:22-27、55`：图例和提示框都只用截到 24 个码点的名称，撞名的加 ` (2)`，但没有任何地方说明哪个是哪个。触发：两个模型名前 24 个码点相同（例如同一个长前缀加不同日期后缀）；`report.test.tsx` 的"gives a model with a very long name a short, unique legend entry"测试的就是这种情形。结果：提示框里把一笔钱归到"…… (2)"，对不上表里的完整模型名。
9. `src/services/stats/types.ts:103-118`（任务 9 的共享类型）：`UsageCostRow` 把 `quantity`、`costAmount` 写成 `number | null`，而本模块和问题文件第一条都是"字符串或数"；`costRows.ts:47-49` 要先 `as unknown as Record<string, unknown>` 才能收。类型说的和实际处理的不一致，以后别的代码按类型当数用就会走浮点。加上实现者记录项 1（`mock/stats.mock.ts:157-205` 的假数据形状不符合契约，开发用假后端打开成本报表看到的是 `TTS`、`STT`），两处都是任务 9 的共享文件，本任务不能改，要交给任务 9 的负责人。
10. `src/pages/cost/useLatestRead.ts`：与任务 16、18、19 的三份同类钩子重复（实现者报告"需要改共享文件"第 3 条；我只核对了本模块这一份，另外三份的存在我没有逐个打开）。行为一致，只是维护成本；`src/components/` 或 `src/hooks/` 里应该有一份共用的。
11. `docs/contract-requests/2026-10-26-admin-frontend-cost.md`：漏问一件事。后端第一份回复第 12 条（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:134`）写"其他类型 `unitPrice` 是数"，同一条又写"价格一律是字符串形式的十进制数"，自相矛盾；问题文件第一条只问了 `costAmount` 和 `quantity`。页面两种都收所以不影响行为，但应该在问题文件里补一条，请后端说明非 LLM 批次的 `unitPrice` 在 JSON 里是字符串还是数。

12. `src/pages/cost/prices.test.tsx:119-132`（测试）和 `src/pages/cost/AlertsLine.tsx:26`：测试用的假数据里两种告警各有 1 条未关闭（`mock/_core/monitorData.ts:104-116` 各一个种子），期望文字里两个数相同，所以把 `count('USAGE_PRICE_MISSING')` 和 `count('LLM_PRICE_SYNC_FAILED')` 的位置互换（变异 X5）后 84 个测试全部通过。触发：互换后页面写"模型没有价格 N 条，LLM 价格同步失败 M 条"时两个数对调；当两种告警的条数不同，运营会把同步失败当成没有价格。建议在测试里让两种的条数不同（例如多加一条 `USAGE_PRICE_MISSING`）。

另外，实现者自己列的记录项里：第 3 条（`useLatestRead.test.tsx`、`failure.test.ts` 没有单独记红，靠变异检查），我没法验证红的原始输出，只验证了这两个测试能抓住变异（M17 抓住了钩子测试）；第 5 条（分页读取最多 50 页）X4 变异被测试抓住；第 6 条（提示框没有悬停看过）仍然没有人看过，我也没有。

### 变更

1. 确认待审批次前，用 `validateBands` 先检查那批的档位，把"缺口"或"重叠"这样具体的原因写在确认对话框里。现在的做法（后端拒绝后只显示错误码的文字和已有译文的原因，`reason.OUT_OF_RANGE`）符合规格 5.23 "档位不连续时'确认'被后端拒绝并显示原因"，所以这不是遗漏，是新增行为，要先问负责人（涉及：是否在前端重复一份后端规则）。

### 不是缺陷

1. **价格批次没有双人复核**：见第 2 节。`SELF_REVIEW_FORBIDDEN` 只属于额度调账（契约 `:121`、§15.9）；§14.2 没有任何"填的人不能确认"；问题文件第六条已经把这个问题交给负责人。`PriceBatch` 有 `confirmedBy`、`reviewedBy`，页面显示它们，但没有据此拦截。如果以后加规则，应由契约先写成完整规则。
2. **图表里的 `Number(exact)`**（`costRows.ts:203`）和纵轴刻度 `toDecimalString(value)`（`CostChart.tsx:46`）：柱子要有数才能画，高度的几十分之一像素误差看不见；金额文字（提示框、卡片、表格）都来自十进制文字。纵轴刻度是图表库给的浮点刻度，只是坐标标签，不是账面金额。我没有悬停看过提示框（未运行）。
3. **适配器值 `DASHSCOPE_INTL`**（`types.ts:35`、两个测试、假数据）：是契约和规格 5.23 里的协议值，页面只能原样显示；除此之外模块里没有第三方名称（我用一串厂商、模型、产品名的正则搜过全部本模块文件）。
4. **M7 是等价变异**：`costRows.ts:84-90` 里 `if (line.currency === NO_COST) continue` 去掉后测试不变红，因为 `toLine`（`:47-67`）已经把 `NONE` 行的费用置成 null，`sumDecimals` 本来就跳过 null。它是多一道防线，不是漏测。
5. **"云厂商账单"与规格里的"阿里云账单"的出入**：任务书、`CLAUDE.md` 都不许出现第三方产品名，页面和测试按任务书的写法；规格在 AvatarApp main 上要不要改，已在实现者报告"规格需要在 main 上修改的地方"里写了。
6. **`validateBands` 的参数类型比任务书的 `Band[]` 宽**（`validateBands.ts:2、17`）：`Band` 可以直接传（有 `inputMinTokens`、`inputMaxTokens`），放宽是因为表单草稿里下限可以是 null；返回值与任务书逐字相同。
7. **超过 2^53 的档位边界被说成"不是整数"**（`ManualTab.tsx:28`、`validateBands.ts:6`）：被拒绝是对的（Number 已经不精确了），提示的措辞不够准，但没有真实场景会填这么大的 token 数，也没有误放行。
8. **缺少币种列表时确认仍然可以点**（`PendingTab.tsx:330-335`）：任务书写的是"下拉不可用并提示"，没有写"禁止确认"，后果提示里写了"币种没能核对，由后端检查"，后端是最终裁决。
9. **`fetch` 替身的形状**：与 §17.6 一致，见第 4 节；它存在的原因是共享假后端的形状不符合，那条是记录 9，不在替身上。

### 阻塞

无。

## 8. 评审者检查过但没有发现问题的地方（供对照）

- `ActionModal`、`ReasonModalForm` 失败时只显示错误码的译文和有译文的原因，不显示后端原话（`failure.ts`，有测试）。
- 手填的价格以 `trimSpec` 后的文字提交，空缓存价提交 `null`，档位边界提交整数，单位由资源类型决定（`ManualTab.tsx:126-142`，`prices.test.tsx` 有）。
- 当前价格的"生效中"判定用 UTC 日（`CurrentTab.tsx:40` 与契约一致：`effectiveFrom` 不晚于 UTC 今天的最晚一批）；生效日在将来的 `ACTIVE` 批次进历史并带"尚未生效"。
- 假后端：状态 409 带 `data.status`、404、400 的 `details`、同模型同生效日旧批被取代、价格要字符串且最多十位小数且不超过 1000000，与契约 §14.2 一致；状态在 `globalThis`，有重置函数。
- 路由、菜单键、权限码（`config/routes/cost.ts`）：`COST:VIEW`，写入权限由页面内部检查。
- `biome check` 在本模块路径下无报错；副本的 `tsc` 因为 `.umi` 类型不全不可用，我在共享检出里跑了只读的 `tsc --noEmit --incremental false`，本模块路径下 0 个诊断（共享检出里有别的任务的未跟踪文件产生的诊断，与本任务无关）。
- 全部本任务测试在副本里重跑：`npx vitest run src/pages/cost src/services/cost mock/cost.mock.test.ts config/routes/cost.test.ts src/locales`（610 个通过）加 `tests/noHardcodedText.test.ts`（31 个通过），共 641 个，与实现者报告的数字一致。


## 主会话复核（分类调整）

按 CLAUDE.md 的分类，评审的记录 1 和记录 5 改判为**立即修**，都已修复并带测试：

- 记录 1（待审对比不看币种）：钱页面上把"同一个数字、不同币种"显示成"没变"，是输出错误，确认价格批次时恰恰需要看出币种变了。修复：对比两边都写出币种，币种不同也标为"有变化"。新测试在把待审批次币种改成 EUR、数字不变时断言标记和两个币种都出现，去掉币种比较后变红。
- 记录 5（模型登记对话框遇到非文字的字段整页白屏）：属于崩溃。修复：对话框里的名字都经 `plainText`。新测试在 `syncModelId` 是数组、`model` 是对象时断言对话框能打开，修复前报 `s.charCodeAt is not a function`。

其余记录项（2、3、4、6、7、8、9、10、11、12）维持评审的分类，进批量修复。
