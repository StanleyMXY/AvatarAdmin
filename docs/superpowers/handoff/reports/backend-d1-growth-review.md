立即修未修 0、记录项 5、未运行 4、阻塞 0（另有 1 条变更候选，见"变更"一节，不计入记录项）

# 后端第一批交付：投放、成本价格、审核文本规则、漏斗、投放效果（区域 growth，提交 2c02187）的独立评审

评审对象：提交 2c02187（分支 claude/jolly-dirac-4pq9g6）。对照后端改动清单 a8 第二条、a9、a10、a13、e4、e5 和 GROUP B 里投放效果的范围错误，逐句核对页面、假后端和测试。不信实现者报告，自己读了代码、跑了测试、做了变异检查、在真实浏览器里走了每个分支。语言：界面只有中文和英文，浏览器检查两种都做了；文本规则的样例规则是泰语、阿拉伯语等七种语言的已有数据，我没有再造多语言输入，涉及文字的结论除了规则页的样例外只覆盖中文和英文。

## 方法和结果

- 测试：`npx vitest run mock` 全部通过（37 个文件、1054 条）。页面侧 `src/pages/campaign analytics moderation cost stat config dashboard`、`activity/signinStats`、`activity/taskStats`、`push/stats`、`src/locales`、`tests/noHardcodedText.test.ts`：50 个文件 1394 条，1393 通过；唯一一条失败是 `src/pages/campaign/accounts.batch.test.tsx:184`（`findByText` 默认 1 秒，机器负载约 18，同时有十几个 vitest 在跑），单独重跑 29 条全部通过，不是代码问题。
- 变异检查（只在草稿目录的 HEAD 拷贝里改，改完用 `git show HEAD:<路径>` 还原；共享检出里我没有留下任何改动，`git status` 里列出的 push 相关改动是别的会话的）：
  1. `PendingTab.tsx` 把 `disabled={needsCurrency}` 改成 `disabled={false}`：`prices.test.tsx` 里 "asks for a currency when the one of the batch is not an allowed one…" 变红，测试有效。
  2. `funnel.tsx` 删掉 `finally { setQuerying(false) }`：原有的 32 条漏斗测试全部仍然通过，见记录项 3。
- 真实浏览器：Playwright Chromium，从草稿目录拷贝起 `max dev`（端口 8852），用请求拦截制造后端的各种回答，用完按进程号 19079、19056 停止（`ss` 确认端口已释放）。

## 清单逐行核对

### a9 / e4 成本币种锁：做到了
- 归因参数页（`/campaign/settings`）上方有提示条；投放成本页签有同样提示（`CostsTab.tsx`）。系统配置页没有提示条，但币种那一行的说明里本来就有"只要有成本行就不能改：先逐行删除成本，再改"（浏览器里看到），清单 5.15 的要求由它满足；实现者报告把它写成"没落实"是过于保守，不是缺陷。
- 保存被拒（假后端真有成本行，输入 EUR 保存）：币种那一行输入框下面出红字"已有成本行，不能改币种。请先在“投放成本”页签里逐行删除全部成本，再改币种。"，英文同样位置同样意思；整页不含后端 message。
- 重置被拒：用拦截让 `DELETE /config/attribution.cost_currency` 答 400 加 `details:[{ref:attribution.cost_currency,reason:OUT_OF_RANGE}]` 并带一段自造的后端 message（`MSG_FROM_BACKEND_XYZ`），重置按钮的确认框点确定后，红字出现在同一行（输入框和"默认值"之间），中英都是，页面内容不含自造 message。截图在草稿目录的 `gr-A-reset-zh-CN.png`。重置按钮对从未保存过的键是灰的（`updatedAt` 为空），所以真实流程里只有"保存过非默认币种之后又录入了成本"才会碰到重置被拒，浏览器里是用拦截把该键改成已修改来走的。
- 单条和批量成本录入仍要求币种等于设置：核对了 `mock/campaign.mock.ts` 的 `costFields`、`CostModal.tsx`、`parseCostBatch.ts`，与报告一致。

### a8 第二条 确认待审批次的币种：页面所有分支都走了一遍
"允许列表"来自 `GET /meta` 的 `allowedCurrencies`（`prices.tsx:44`、`PendingTab.tsx`），请求体的 `currency` 来自卡片上的选择框，批次自己的币种是它的初始值。

| 分支 | 页面显示 | 能不能确认 | 请求体 | 浏览器核实 |
|---|---|---|---|---|
| 列表已知，批次币种在列表里（USD） | 选择框预选批次币种 | 能 | 带 `currency: USD` | 是；请求体 `{"effectiveFrom":"2026-10-26","currency":"USD"}` |
| 列表已知，批次币种不在列表里（列表 `['EUR']`） | 选择框空，红字"这批价格的币种不在允许的币种里，请选择一个" | 不能（确认按钮灰），选一个后才能 | 选了才带 | 是（按钮灰） |
| 列表已知但是空数组 | 同上，选择框没有选项 | 永远不能 | 无 | 是（按钮灰）；后端若允许列表为空是不可能的配置，不算缺陷 |
| 列表未知（`GET /meta` 失败） | 选择框灰色，预填批次币种，黄字"读不到允许的币种，所以这里无法核对币种"；确认框里多一句"币种由后端核对" | 能 | 不带 `currency`，用批次自己的 | 是；请求体 `{"effectiveFrom":"2026-10-26"}` |
| 确认被后端 400 且 `details` 有 `ref: currency` | 对话框留着，标题"输入内容不合法…"，下面一行按码文字"这个批次最终使用的币种不在允许币种（usage_price.allowed_currencies）里，批次仍待审核。请选一个允许的币种再确认。" | 对话框里可重按，但没有地方改币种（要取消后回卡片改） | | 是（列表已知和列表未知两种都走了，中英），页面不含后端 message |
| 确认被后端 400 但 `details` 为空 | 只显示"输入内容不合法"（加列表未知时的那句"币种由后端核对"） | | | 是（英文） |

检查顺序（404、日期、币种、档位、状态 409）和"被拒不改批次"：假后端和 `mock/cost.mock.test.ts` 核对一致。

发现两处不贴切，见记录项 1、2。

### a10 漏斗 429：做到了
- 浏览器里拦截 `GET /analytics/funnel` 答 429（`RATE_LIMITED`，没有 data，message 自造为 "Too many funnels"）：红条"加载失败：请求过于频繁，请稍后再试"（英文 "Too many requests. Please try again later."），没有倒计时，没有后端 message。
- 失败之后：转圈数量 0；"查询"按钮可点（再按一次发出第二个请求，仍是红条，转圈 0）；条上的"重试"可点；放开拦截后按"重试"出结果，红条消失，转圈 0。
- 代码：`funnel.tsx` 的 `query` 在 `finally` 里复位 `querying`；`describeFailure` 不读 `data.retryAfterSeconds`（`session/describe.ts`），这个值只给登录的锁用。
- 测试缺口见记录项 3；按钮在查询进行中不禁用的问题见"变更"。

### a13 文本规则匹配说明：说法准确，有一处我没能核实
- 说明文字（中文、浏览器里读到的全文）：子串和整词都写了"规范化之后还会做形近字折叠"；正则写"不做形近字折叠，只按规范化后的文字匹配"；另有提示条写折叠规则、两个已知副作用（КОТ 命中 kot，sik 命中 "sık sık"）和"折叠后为空会被拒绝"。逐句对过清单 a13：775 条/Unicode 16.0.0 没写进页面（页面不需要）；"ASCII 和同一文字内的字母不折叠""REGEX 不折叠"与清单一致；没有出现清单没有的断言。
- 对 REGEX "只按规范化后的文字匹配"：清单只说 "REGEX 规则不折叠，行为不变"，规则页的总说明本来就写"匹配前会先规范化被审核的文字：不分大小写，并去掉零宽字符"，两者一致；规则文本自身（正则的写法）是否也被规范化，清单没写，页面也没说，我没有断言。
- 折叠后为空：代码 `rules.tsx` 只对"文本去首尾空白后不为空、后端仍答 `EMPTY_NOT_ALLOWED`"的行改写成"匹配文本在规范化并折叠之后是空的…"；真正空白的行仍在发送前被页面挡住。我在浏览器里这一步没有走通（添加行的按钮定位失败），靠代码和 `rules.test.tsx`、`moderation.mock.test.ts` 核对，计入未运行。

### GROUP B 投放效果的范围错误：做到了
- 假后端（共用的 `mock/_core/statRange.ts`）：`from` 晚于 `to` → `ref: from`，message "from is after to"；范围过长 → `ref: to`，message "The range exceeds stats.max_range_days"；日期格式错误或年份小于 1 → `OUT_OF_RANGE`（`validDay` 加了年份判断）。`grep INVALID_FORMAT mock src` 没有任何结果，报告所说"没有旧测试要改"属实。
- 页面（拦截返回 400，只给 `ref` 和 `reason`，message 自造）显示位置：日期选择、投放账户、查询、导出那一行的正下方，红字一行（`data-testid="campaign-stats-range-error"`）；下面照旧有"加载失败：输入内容不合法，请检查后重试"加"重试"的红条。文字：
  - `ref: from`（无论是起始晚于结束、格式错误还是年份小于 1，后端给的 reason 都是同一个 `OUT_OF_RANGE`，页面无法也不需要区分）：中文"起始日期：超出允许的范围。起始日期必须是有效的一天，并且不能晚于结束日期。"，英文 "Start date: The value is outside the allowed range. The start date must be a valid day and not after the end date."
  - `ref: to`（范围过长或 `to` 格式错误）：中文"结束日期：超出允许的范围。结束日期必须是有效的一天，并且范围不能超过统计允许的最大天数（stats.max_range_days）。"，英文对应。
  - `details` 为空或 `ref` 是别的：不出这一行，只有红条。
  - 四种后端情形在页面上只有这两种文字，因为后端对它们给同一个 reason；两句话都是几种原因的合并说法，没有错。页面日期控件本身不会选出反的或过长的范围（`GET /meta` 读不到时才会），这些行在正常操作里碰不到。截图 `gr-B-full.png`。
- 导出（`ExportButton.tsx:68-75`）：400 `INVALID_REQUEST` 只显示"输入内容不合法"加"缩小范围试试"，不按字段说，同意实现者的记录项，见记录项 4。
- 共用文件对其它统计页的影响：全部 mock 测试（37 个文件）和用到 `statRange` 的页面测试（`stat`、`activity/signinStats`、`activity/taskStats`、`push/stats`、`dashboard`、`analytics`、`campaign`）通过；`grep` 确认没有页面代码依赖旧 message 或旧 ref（`src` 里只有测试自造的信封带 "range is longer than 31 days"，与假后端无关）。别的统计页的错误形状只变了两处：过长的 message 文字、年份小于 1 的日期现在被拒；`from` 晚于 `to` 的 ref 本来就是 `from`（`git show 2c02187` 里是上下文行，不是改动）。

## 发现

### 立即修
无。

### 记录

1. 确认待审批次被后端拒绝币种、而页面的允许列表未知时，提示叫人"请选一个允许的币种再确认"，但选择框是灰的、没有办法选。
   - 位置：`src/pages/cost/PendingTab.tsx:214`（`disabled={!listKnown}`）和 `cost.pending.currencyRefused`（`src/locales/zh-CN/cost.ts`、`en-US/cost.ts`）。
   - 触发：`GET /meta` 失败（登录时 meta 读不到会得到空对象），打开价格页的待审价格，对一个币种不被允许的批次点"确认"、再点"确认价格"；后端按 a8 答 400 加 `ref: currency`。浏览器里用拦截复现，中文对话框确实写着"请选一个允许的币种再确认"，卡片上的选择框是灰的，对话框里也没有选择框。
   - 后果：提示告诉运营做一件页面上做不到的事；出路只有刷新页面重新取 meta。建议：列表未知分支改用不要求选择的说法（例如"请在系统配置里核对允许币种后刷新页面"），文字走语言文件。
2. 允许列表只在登录时读一次，价格页自己改允许币种后待审批次不会跟着变。
   - 位置：`src/session/loadSession.ts:30`（meta 只在 `loadSession` 里读）、`src/pages/cost/prices.tsx:77-79`（同一页下方有 `usage_price.*` 的配置表单，保存后没有任何重读 meta 的动作；`ConfigForm` 的 `onChanged` 在这里没用上）。
   - 触发：待审批次的币种是 EUR，允许列表是 USD；在同页下方把 `usage_price.allowed_currencies` 改成 USD、EUR 保存。卡片仍显示"这批价格的币种不在允许的币种里"，确认按钮仍是灰的，直到重新登录。反方向：从允许列表里去掉某币种后，选择框仍提供它，确认被后端拒绝，对话框叫人"选一个允许的币种"，可选项还是旧的。
   - 后果：清单 e5 写的先加后确认的流程在同一页上走不通，要重新登录；不丢数据。这条我是读代码得出的，浏览器里没有复现（假后端的 `GET /meta` 写死 USD，改设置不会联动，见实现者记录项 2），所以计入未运行。
3. 漏斗 429 的测试没有断言失败之后没有残留加载态。
   - 位置：`src/pages/analytics/funnel.test.tsx` 新增的 429 测试。
   - 触发（变异）：删掉 `funnel.tsx` 里 `finally { if (mine === counter.current) setQuerying(false); }`，32 条测试全部通过（我在草稿拷贝里跑了）；在测试里加 `document.querySelector('.ant-spin-spinning, [aria-busy="true"]')` 为空的断言后，这个变异变红（只用 `.ant-spin` 会撞到表格自带的 spin 容器，要用这个选择器）。当前代码本身没有残留加载态，真实浏览器里也是 0。
   - 后果：以后有人改动 `query`，加载态残留（失败后一直转圈、结果出来后仍有转圈）不会被测试发现。
4. 导出被 400 拒绝时不按字段说明（同意实现者的记录项 1）：`src/components/ExportButton.tsx:68-75`。触发：绕过日期控件的限制后（`GET /meta` 读不到时没有最大天数检查）选范围过长再导出，得到"输入内容不合法 + 缩小范围试试"，对 `from` 晚于 `to` 不准确；正常操作碰不到。该组件是共用的，不属于本提交，建议和其它 400 一起统一处理。

5. 成本币种被拒的按码文字只按键和 `OUT_OF_RANGE` 取，凡是该键的 `OUT_OF_RANGE` 都显示"已有成本行，不能改币种"；我还没查清后端对格式错误的币种答什么。
   - 位置：`src/locales/zh-CN/campaign.ts` 和 `en-US/campaign.ts` 的 `config.attribution.cost_currency.reject.OUT_OF_RANGE`；该键在页面上是自由文本、没有格式检查（`src/pages/config/configSchema.ts:621-625`），契约说它是 ISO 4217 三位字母。
   - 触发：没有任何成本行时，在归因参数页把币种改成 "usd" 或 "euro" 保存。如果后端对这类值也答 `OUT_OF_RANGE`（`docs/backend-inputs` 和快照里都没有写），页面会说"已有成本行"，是错的；后端答别的 reason 则没有问题。
   - 建议：向后端确认格式错误时的 reason，再决定页面加格式检查（三位大写字母）还是让文字不下结论。

### 变更
- 漏斗的"查询"按钮在查询进行中仍可点（`funnel.tsx` 的按钮只有 `disabled={!valid}`），每按一次就向后端发一个请求，旧的结果被丢弃，但后端的名额照样被占着；`analytics.funnel_max_concurrency` 默认 2，一个人连点两下就能占满，之后自己的请求得到 429。这是新增行为（查询进行中禁用按钮或忽略重复点击），按规则先交负责人确认设计，再做；不是遗留缺陷。

### 不是缺陷
- 实现者报告把系统配置页"没有提示条"列为记录项 4：该页币种那一行的说明已经写了锁的规则（见上），清单 5.15 只要求这一点；理由和行号：`src/locales/zh-CN/config.ts` 的 `config.attribution.cost_currency.desc`。
- `mock/_core/statRange.ts:20-22`：没给 `from` 且 `to` 年份小于 1（如 `0000-01-03`）时，默认的 `from` 往前推 6 天会得到负年份而被判成 `from` 的错误，而不是 `to` 的。页面总是同时发 `from` 和 `to`，真后端的做法清单没写，只影响假后端的一个不可能从页面发出的输入。
- 实现者记录项 2、3（假后端 `GET /meta` 写死 `['USD']`、`dev:mock` 点不出漏斗 429）我同意，是假后端的联动缺口，不影响真后端。

## 未运行（4）
1. 全量测试和构建（规则：全部任务做完后一次性跑）。
2. 记录项 2（允许列表过期）没有在浏览器里复现，只读了代码；假后端的 meta 不联动，要复现得改假后端。
3. 规则页零宽字符行保存后的按码文字，我的浏览器脚本没点到"保存"按钮，没有走通；由 `rules.test.tsx`、`mock/moderation.mock.test.ts` 和实现者的浏览器记录支持，我只读了代码。
4. 导出的范围错误没有在真实浏览器里触发；记录项 5 里后端对格式错误币种的回答也没有核实。

## 草稿文件
截图和脚本在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/` 下（`gr-*.png`、`gr1.js`…`gr8.js`、草稿拷贝 `draft/`），不进仓库。
