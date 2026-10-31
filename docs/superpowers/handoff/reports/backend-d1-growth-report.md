立即修未修 0、记录项 4、未运行 3、阻塞 0

# 后端第一批交付：投放、成本价格、审核文本规则、漏斗、投放效果（区域 growth）的报告

范围：清单 a9/e4、a8 第二条、a13、a10，以及 GROUP B 里投放效果（`GET /attribution/performance` 和它的导出）的范围错误。计划文件没有改（docs 区域统一改）。按负责人的规则，已知错误码时界面只显示按码翻译的文字，不显示后端 message。

## 逐行

### a9 / e4 投放成本币种锁
- 落实：
  - `src/pages/campaign/settings.tsx`：归因参数页在表单上方加提示（`campaign-settings-currency-lock`）“已有成本行时不能改币种；先逐行删除成本再改。”
  - `src/pages/campaign/CostsTab.tsx`：投放成本页签同样的提示（`campaign-costs-currency-lock`）。
  - 改币种（保存或恢复默认）被拒时，按码文字写在币种那一行：键 `config.attribution.cost_currency.reject.OUT_OF_RANGE`（`src/locales/{zh-CN,en-US}/campaign.ts`），由 cfg 区域的 `ConfigForm` 拒绝处理按 `config.<键>.reject.<原因>` 取用（本区域一度在 `ConfigRow.tsx` 里自己做了同样的查找，cfg 区域重写后已并入它的做法，我这边没有留下对 `ConfigRow.tsx` 的改动）。
  - 假后端：`mock/config.mock.ts` 的 `costCurrencyLock`：有任何成本行时，`PUT` 改成不同币种、`DELETE` 回默认值而当前不是 USD，都 400 `INVALID_REQUEST`，`details` 为 `[{ref:'attribution.cost_currency',reason:'OUT_OF_RANGE'}]`，message 按清单，什么都不存；保存相同的值永远通过。（这段已经被 cfg 区域的提交 c6a83e3 一并提交，我没有再单独提交这个文件。）
  - 批量和单条成本录入仍要求币种等于该设置，核对现有已满足：`mock/campaign.mock.ts` 的 `costFields`（`body.currency !== costCurrency()` → `currency:OUT_OF_RANGE`）和批量里每行同样检查；页面 `CostModal.tsx:72` 发设置里的币种，`parseCostBatch.ts:146-190` 对每行比较（不一致 `CURRENCY_MISMATCH`）。
- 测试：`mock/campaign.costCurrency.mock.test.ts`（5 条：被拒的形状和不存储、相同值通过、恢复默认被拒、删光成本后可改且之后单条和批量要求新币种）；`src/pages/campaign/settings.test.tsx` 末尾 describe（中英提示、被拒的按码文字不含后端 message、恢复默认被拒同样、删光后可改）；`src/pages/campaign/accounts.costs.test.tsx` 末尾 describe（成本页签提示中英）。已有覆盖：`mock/campaign.mock.test.ts` “takes the currency from attribution.cost_currency”、批量“currency:OUT_OF_RANGE”那条。
- 没落实的：系统配置页（`/system/config`）上这一行没有页面级提示条（只有 cfg 区域写在字段说明里的一句话和被拒文字）；清单只要求投放成本页签和归因参数页面。

### a8 第二条 确认待审批次的币种
- 落实：
  - `mock/cost.mock.ts` 的确认接口：检查顺序改成批次不存在 404 → 日期 → 币种（请求体给的，没给就是批次自己的，必须在 `usage_price.allowed_currencies` 里，现在读设置值，读不到才用 `GET /meta` 的列表）→ LLM 档位 → 状态（409）；每一步第一个不通过就答，被拒的批次保持 `PENDING_REVIEW`、什么都不改（假后端没有审计日志，所以“不写审计”只能由“什么都不改”体现）。币种被拒：400 `INVALID_REQUEST`，`details` 为 `[{ref:'currency',reason:'OUT_OF_RANGE'}]`。手工录入价格用同一个允许列表函数。
  - 页面原来已经把确认框的币种选项限于 `GET /meta` 的允许列表，批次自己的币种不在列表里时不让点“确认”（`PendingTab.tsx` 的 `PendingCard`，已有测试 `prices.test.tsx` “gives the currency select only the allowed currencies”和“asks for a currency when the one of the batch is not an allowed one”），这一行本来就满足。
  - 新增：被拒时按码文字：`ActionModal` 加 `refTexts`（`src/pages/cost/ActionModal.tsx`、`failure.ts` 的 `failureLines`），`PendingTab.tsx` 把 `currency` 对到 `cost.pending.currencyRefused`：“这个批次最终使用的币种不在允许币种（usage_price.allowed_currencies）里，批次仍待审核。请选一个允许的币种再确认。”（中英）。
- 测试：`mock/cost.mock.test.ts` 末尾 describe（5 条：批次自己的币种不允许、请求体币种覆盖、从设置读列表、检查顺序、被拒不改批次）；`src/pages/cost/prices.test.tsx`（原“backend refuses the currency”加了按码文字断言；新增“列表不可知、批次币种不允许、后端拒绝”和中文各一条）；`src/pages/cost/failure.test.ts`（`refTexts`）。
- 没落实的：后端清单没写这次 400 的 `details`，写成问题文件 `docs/contract-requests/2026-10-31-admin-frontend-growth-confirm-currency-details.md`；后端若没有 `details`，页面只显示“输入内容不合法，请检查后重试”。

### a13 文本规则匹配说明
- 落实：`src/locales/{zh-CN,en-US}/moderation.ts`：子串、整词的说明补“规范化之后还会做形近字折叠”，正则的说明补“不做形近字折叠”；`rules.tsx` 在说明下加一条提示（`rules-folding-note`），写折叠规则（сука 同时命中 сука 和 СУКА，西里尔、希腊、土耳其无点 ı）、正则不折叠，并把已知副作用写进去（全大写俄语词 КОТ 命中规则 kot，土耳其语规则 sik 命中 “sık sık”），以及“折叠后为空会被拒绝”。
- pattern 规范化折叠后为空仍是 `EMPTY_NOT_ALLOWED`：核对现有，页面本来把后端的行级 `EMPTY_NOT_ALLOWED` 显示成“不能为空”，对一个看着不空的文本（只有零宽字符）会误导；现在在这种行上（文本去首尾空白后不为空，后端仍答 `EMPTY_NOT_ALLOWED`）改写成“匹配文本在规范化并折叠之后是空的（例如只有零宽字符），不能保存”（`rules.tsx` 保存失败处理，键 `moderation.rules.patternFoldsEmpty`）。真正空白的文本仍在发送前被页面挡住。
- 假后端：`mock/moderation.mock.ts` 的 `ruleProblems`：子串、整词的文本去掉零宽字符后为空 → `EMPTY_NOT_ALLOWED`；正则不处理。
- 测试：`src/pages/moderation/rules.test.tsx`（英文说明、中文说明、零宽字符行的按码文字、空白文本不发请求）；`mock/moderation.mock.test.ts`（零宽字符三种）。

### a10 漏斗 429
- 核对现有：`funnel.tsx` 的失败走 `describeFailure`，已知码 `RATE_LIMITED` 只显示 `error.RATE_LIMITED`（“请求过于频繁，请稍后再试”），没有读 `data.retryAfterSeconds`，没有倒计时；查询按钮和“重试”在失败后保持可点，表单保留。这一行页面代码本来满足，没有改页面。
- 假后端：`mock/analytics.mock.ts`：检查顺序改成 steps → windowHours → from/to 与范围 → 并发上限 → 计算；在途数 `analyticsStore.funnelInFlight`（`mock/_core/analyticsData.ts`，重置为 0）达到 `analytics.funnel_max_concurrency`（没设置按 2）时答 429 `RATE_LIMITED`，没有 data，没有 Retry-After；保存的漏斗路由不受限。
- 测试：`mock/analytics.mock.test.ts`（5 条）；`src/pages/analytics/funnel.test.tsx`（选预设漏斗查询成功，再占满名额按查询得到按码文字、无数字倒计时、按钮可点、再按“重试”成功；中文）。

### GROUP B 投放效果的范围错误
- 核对现有：假后端已用共用的 `rangeOf`，`from` 晚于 `to` 本来就是 `ref: from`、`from is after to`；格式错误本来就是 `OUT_OF_RANGE`；代码和测试里没有 `INVALID_FORMAT`（`grep -rn INVALID_FORMAT mock src` 无结果，只在文档里），所以没有“旧的 INVALID_FORMAT 测试”要改。要改的两处：范围过长的 message 改成 “The range exceeds stats.max_range_days”（`mock/_core/statRange.ts`，所有统计页和导出共用，与清单说的“和其它统计页一致”相符）；年份小于 1 原来被当成合法日期，现在 `validDay` 拒绝。
- 页面：原来 `stats.tsx` 只显示总的失败条（丢掉 `details`）。现在 `details` 的 `ref` 是 `from` 或 `to` 时，在日期控件下面写一行按码文字：“起始日期：超出允许的范围。起始日期必须是有效的一天，并且不能晚于结束日期。”/“结束日期：…范围不能超过统计允许的最大天数（stats.max_range_days）。”（键 `campaign.stats.range.*`）；别的 `ref` 不出这一行；失败条和重试照旧。
- 导出：`ExportButton`（共用组件，我没改）对 `INVALID_REQUEST` 显示“输入内容不合法”加“缩小范围试试”的提示，不按字段对；见记录项。
- 测试：`mock/campaign.performanceRange.mock.test.ts`（报表和导出各 7 条：反向、过长、四种坏日期、恰好最长）；`src/pages/campaign/stats.test.tsx`（from、to、中文且重试后消失、别的 ref 不出现）。

## 红到绿、命令和结果
- 红（实现前）：`npx vitest run mock/campaign.mock.test.ts`（先把锁的测试放在这里）4 失败；`mock/cost.mock.test.ts` 3 失败；`mock/moderation.mock.test.ts` 1 失败、`rules.test.tsx` 4 失败（说明两条、零宽字符行）；`stats.test.tsx -t range…` 3 失败；`mock/campaign.performanceRange.mock.test.ts` 4 失败（过长的 message、年份 0，报表和导出各 2）。页面里币种按码文字、漏斗 429、和 mock 的漏斗并发测试是在实现之后才补进了红的证据，用下面的变异检查证明测试会红。
- 说明：负载很高时有页面测试超过默认 5 秒而失败（`accounts.costs`、`accounts.batch` 各一条），单独用 `--testTimeout=60000` 重跑全部通过，不是代码问题。`settings.test.tsx` 的键数（9→12）和 `rules.test.tsx` 的审核键数（10→11）是 cfg 区域加了新键后的改动，随我的提交一起带上。
- 绿：`npx vitest run mock/analytics.mock.test.ts mock/cost.mock.test.ts mock/moderation.mock.test.ts mock/campaign.mock.test.ts mock/campaign.costCurrency.mock.test.ts mock/campaign.performanceRange.mock.test.ts mock/stats.mock.test.ts mock/export.mock.test.ts src/pages/campaign src/pages/analytics src/pages/moderation src/pages/cost/failure.test.ts src/pages/cost/prices.test.tsx src/locales tests/noHardcodedText.test.ts`，结果见回复；`npx biome check`（涉及的目录）无问题；`npx tsc --noEmit` 在我的路径下没有报错。

## 变异检查（每个都恢复了原文件；全部变红）
1. 锁不看成本行 → 币种锁测试 3 条红。2. 去掉“相同值通过” → 2 条红。3. 确认接口不查币种 → mock 5 条红。4. 确认接口把状态检查提前 → 3 条红。5. `PendingTab` 去掉 `refTexts` → 页面 2 条红。6. 漏斗并发检查拿掉 → mock 3 条加页面 1 条红。7. `validDay` 不拒绝年份 0 → 4 条红。8. `stats.tsx` 不识别 from/to → 3 条红。9. `rules.tsx` 不改写空文本 → 1 条红。10. `ruleProblems` 对正则也折叠 → 1 条红。11、12. 设置页、成本页签的提示拿掉 → 红。13. 把币种按码文字的语言键改名 → 2 条红。

## 真实浏览器（Playwright Chromium，草稿目录的拷贝起 `dev:mock`，端口 8741，用完按进程号 25406 停止）
- 归因参数页：提示条在；改成 EUR 点保存，币种行下出现按码文字；截图看过，布局正常。成本页签：提示在。待审价格页：四个确认按钮在。文本规则页：折叠提示在，加一条只有零宽字符的规则保存，该行显示“规范化并折叠之后是空的”，没有“不能为空”。漏斗页：用浏览器拦截请求返回 429（假后端要在测试里占名额），失败条写“请稍后再试”，查询按钮可点。投放效果页：拦截请求返回 `from` 的 400，日期下出现那一行，英文模板里原来多一个句号（“range..”），已改。控制台只有登录探测的 401 和我自己拦截返回的两个 400。

## 覆盖的语言
零宽字符和规则文本用泰语、阿拉伯语等已有样例（规则页打开就是七种语言的样例规则）；折叠说明的例子含西里尔、希腊、土耳其语。界面文字只有中文和英文。成本价格、漏斗、币种检查没有涉及多语言输入，只覆盖中文和英文。

## 问题文件
- `docs/contract-requests/2026-10-31-admin-frontend-growth-confirm-currency-details.md`：确认批次币种被拒时请后端在 `details` 里给 `ref: currency`。

## 需要改共享文件
- `mock/_core/statRange.ts`（共用的日期范围检查）：过长的 message 和年份小于 1，已改，影响所有统计页的假后端（与后端清单一致）。
- `mock/_core/analyticsData.ts`：加 `funnelInFlight`。

## 记录项（建议全部修）
1. `src/components/ExportButton.tsx:68-75`：导出被 400 `INVALID_REQUEST` 拒绝（包括投放效果导出的范围错误）时，只显示“输入内容不合法”和“缩小范围试试”，不按 `details[].ref` 说是起始日期还是结束日期。触发：绕过日期控件的限制（`GET /meta` 读不到时没有最大天数检查）选超长范围再导出。后果：提示只对“范围过长”准确，对“起始日期晚于结束日期”不准确（日期控件本身不允许选反的范围，所以正常操作碰不到）。
2. `mock/_core/meta.ts:9`：`GET /meta` 的 `allowedCurrencies` 是写死的 `['USD']`，不跟随 `usage_price.allowed_currencies` 的保存值。触发：在假后端把允许币种改成 USD、EUR，价格页的币种选项仍只有 USD，而确认接口已经按设置接受 EUR。只影响假后端的联动，真后端不受影响。
3. `mock/analytics.mock.ts`（漏斗）：并发上限只能靠测试或手工设 `analyticsStore.funnelInFlight` 触发，浏览器里的 `dev:mock` 没有办法点出 429（我用拦截请求验证了页面）。
4. 系统配置页（`/system/config`）里 `attribution.cost_currency` 那一行没有页面级的“已有成本行时不能改币种”提示条，只有字段说明里的一句话；按清单只要求归因参数页和投放成本页签，所以没有加。

## 未运行（3）
1. 全量测试和构建（按规则留到最后一次性跑）。
2. 真实浏览器里没有走通“确认待审批次时币种被拒”（假后端的待审批次币种都是允许的，这条在页面测试里覆盖）。
3. 导出的范围错误没有在真实浏览器里触发。

## 变更候选
无。

---

## 追加：按独立评审修复（评审文件 `backend-d1-growth-review.md` 的五条记录项和一条变更候选）

负责人已授权按业界通行做法修，下面每条先写了会失败的测试，再改代码，并做了变异检查（改坏实现，看测试是否变红）。

1. **待审批次的币种被拒，而允许列表读不到时，提示叫人"选一个"但选择框是灰的**（`src/pages/cost/PendingTab.tsx`）。选了更简单准确的一种：列表未知时用另一句话，"币种不在允许的币种里，批次仍待审核。页面读不到允许的币种列表，请先在系统配置里检查 usage_price.allowed_currencies，然后刷新页面。"（键 `cost.pending.currencyRefusedNoList`，中英文）。列表已知时仍用原来那句。测试：英文、中文各一条（`prices.test.tsx`），断言文字含 `usage_price.allowed_currencies`、不含"选一个允许的币种"。变异：把两种情形都用原句，两条测试变红。
2. **允许列表只在登录时读一次**（`src/pages/cost/prices.tsx`、`PendingTab.tsx`）。不动 `src/session`：价格页自己读 `GET /meta`（`getAdminMeta`，读不到或没有列表就沿用手里的）。读的时机有两个：页面打开时，和打开确认对话框时。对话框里的"确认价格"在读回来之前是灰的；读回来后如果卡片上选的币种已不在新列表里，对话框写"按现在的列表，这个币种不是允许的币种。请取消，再在卡片上选一个允许的币种。"，确认仍是灰的，不发请求；列表原来未知、现在读到了，则请求带上币种。卡片上的币种由"人选的或批次自己的"按当前列表算出，列表变了选择框和确认按钮跟着变。测试六条（`prices.test.tsx`）：对话框打开时重读并拦下；原来未知后来读到；重读失败沿用旧列表；读回来之前按钮灰；页面打开时重读（登录后在别处改了列表）。变异：不重读（三条变红）、不拦被移出的币种（一条）、读回来之前不灰（一条）、去掉页面打开时的读（两条）。
   - 评审里"同页下方的配置表单改 `usage_price.allowed_currencies`"：我核对了，价格页下方的表单只含 `COST:PRICE` 的键（`usage_price.max_bands`），`usage_price.allowed_currencies` 需要 `CONFIG:MANAGE`、在系统配置页改。所以真实路径是"在系统配置页改了再回到价格页"，页面打开时重读正好覆盖；价格页下方表单的 `onChanged` 不接，因为它的键不影响允许币种。
3. **漏斗 429 测试补"没有残留加载态"**（`src/pages/analytics/funnel.test.tsx`）：用评审给的选择器 `.ant-spin-spinning, [aria-busy="true"]`，在 429 之后和"重试"成功之后各断言为空。变异：删掉 `funnel.tsx` 的 `finally { setQuerying(false) }`，该测试变红（另有同类共 6 条变红，因为按钮现在也跟着 `querying`）；只保留 `finally` 删除、撤掉第 6 条的按钮禁用后，仍是这条测试因 `aria-busy` 变红，说明新断言本身有效。
4. **导出被 400 拒绝时按 `details[].ref` 区分起始/结束日期**（`src/components/ExportButton.tsx`，键 `pages.export.range.from`、`pages.export.range.to`，中英文）。`ref` 为 `from`：说起始日期必须是有效的一天并且不晚于结束日期；`to`：说结束日期必须有效且范围不超过 `stats.max_range_days`；两者都有则都说；两者都没有（行数过多等）仍是原来的"缩小范围试试"。后端自己的 message 不显示。测试五条（`ExportButton.test.tsx`），变异：只认 `from`，`to` 和"两者"两条变红。
5. **成本币种被拒的文字**（`src/pages/config/configSchema.ts`、`ConfigRow.tsx`、`src/locales/*/campaign.ts`）。`attribution.cost_currency` 加格式检查 `^[A-Z]{3}$`（三位大写字母）：不合格时保存按钮灰、框下面写"币种必须是三位大写字母的币种码（ISO 4217），例如 USD。"（键 `config.attribution.cost_currency.invalid.OUT_OF_RANGE`，页面自己拦下的话；后端拒绝的话仍走 `.reject.`），请求不发出。因此页面发出的值总是格式合法的，后端对这个键答 `OUT_OF_RANGE` 时说"已有成本行"是对的。没有新增 `reason.*` 码，因为 `reason.*` 的清单被契约表锁住（`src/locales/error.test.ts`、`parity.test.ts` 会检查），我一开始加了一个就被它们拦下，已撤回。测试四条（`settings.test.tsx`）：`usd`、`euro`、`US`（中英文）不发请求且有格式提示、不说"已有成本行"；`THB` 合格且有成本行时被锁拦下并说"已有成本行"。变异：去掉格式检查，四条变红。后端对格式错误币种答什么清单没写：`docs/contract-requests/2026-10-31-admin-frontend-cost-currency-format.md`。
6. **变更：漏斗"查询"按钮在查询进行中禁用**（`funnel.tsx`）。按钮 `disabled={!valid || querying}`，`ask` 也在查询进行中直接返回（所以条上的"重试"同样不会重复发）；答案回来或 429 之后恢复可点。测试一条（`funnel.test.tsx`）：进行中按钮灰、点按钮（真点和脚本点）不多发请求；答案回来后可点；下一次被 429 后可点、无残留加载态。红的证据：改前该测试在 `expect(queryButton()).toBeDisabled()` 失败。变异：撤掉禁用和 `ask` 的判断，该测试变红。

### 本轮改动的文件
`src/pages/cost/PendingTab.tsx`、`prices.tsx`、`prices.test.tsx`；`src/pages/analytics/funnel.tsx`、`funnel.test.tsx`；`src/components/ExportButton.tsx`、`ExportButton.test.tsx`；`src/pages/config/configSchema.ts`、`ConfigRow.tsx`；`src/pages/campaign/settings.test.tsx`；`src/locales/{zh-CN,en-US}/{cost,pages,campaign}.ts`；`docs/contract-requests/2026-10-31-admin-frontend-cost-currency-format.md`。

### 这一轮之后
- 不是缺陷但留意：价格页的"手工录入"页签（`ManualTab`）用同一份刷新后的列表，所以页面打开时的重读对它同样生效；它没有"打开对话框时再读"（它不是确认写入，不在这次范围）。
- 假后端的 `GET /meta` 仍写死 `['USD']`（上一轮记录项 2），页面测试用自己的 `/meta` 回答来模拟列表变化。
