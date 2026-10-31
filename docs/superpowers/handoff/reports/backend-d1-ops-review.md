立即修未修 0、记录项 4、未运行 3、阻塞 0

# 后端第一批改动：ops 区域（告警、通话详情、订阅统计、投诉、记忆页签、封禁、推送任务）独立评审

评审对象：提交 c1ef340、2684b57（分支 claude/jolly-dirac-4pq9g6，HEAD 为 149fd19 之后的检出，工作区干净），对照 `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 里属于这个区域的行：b1、b2（含 GROUP A 更正）、a7、a11、a12、W2a 告警接口、GROUP A 第 18 种告警和两条结果（封禁、推送任务 MISSED）、GROUP B 记忆服务两个字段。我没有看实现者报告里的结论，自己读了代码、跑了测试、做了变异、起了真实浏览器。没有改实现代码，没有推送。

## 一、重点：标价不经浮点，`Intl.NumberFormat` 对字符串到底怎么处理

结论：在这台机器的 Node 22.22.0（V8 12.4、ICU 77.1）和 Playwright 的 Chromium 153 里，`format(字符串)` 是按精确十进制格式化的（ECMA-402 NumberFormat v3 的规定：字符串先转成"数学值"，不先转 number），不是内部转成数字。反例和对照都在下面，用同一组选项（`maximumFractionDigits: 20`，货币样式）。

| 输入字符串 | 直接把字符串交给 `format`（实现的做法） | 先 `Number()` 再 `format`（旧做法） |
|---|---|---|
| `9007199254740993.01`（大于 2^53，USD） | `$9,007,199,254,740,993.01`（Node 和 Chromium 都一样） | `$9,007,199,254,740,994.00`（Chromium 实测；Node 同） |
| `9007199254740993`（无小数，纯数字） | `9,007,199,254,740,993` | `9,007,199,254,740,992` |
| `123456789012345678901234567890.123456789012345678`（THB） | 一位不差，包括 18 位小数 | `123,456,789,012,345,680,000,000,000,000` |
| `0.1234567890123456789`（19 位小数） | `0.1234567890123456789` | `0.12345678901234568` |
| `12345678901234567890.5` | `12,345,678,901,234,567,890.50` | `12,345,678,901,234,567,000` |
| `-9007199254740993.01` | `-$9,007,199,254,740,993.01` | `-$9,007,199,254,740,994.00` |

另外实测：阿拉伯语（ar-EG，阿拉伯-印度数字）、泰语（th-TH 含泰文数字）、印尼语（`Rp 9.007.199.254.740.993,01`）、越南语（`9.007.199.254.740.993,01 ₫`）、西班牙语（`9.007.199.254.740.993,01 €`）在 Chromium 里都是精确的；页面只有 zh-CN 和 en-US，这几种只是证明浏览器层面没问题，页面测试只覆盖中文和英文界面。

三个必须知道的边界（解释了为什么实现里有 `DECIMAL` 正则，也是变异检查要抓的）：
- `format` 对字符串很宽松：`format('0x10')` 得 `16`，`format('1e3')` 得 `1,000`，`format(' 12 ')` 得 `12`，`format('')` 得 `0`。所以必须先用正则（`stats.tsx` 第 13 行 `^-?\d+(\.\d+)?$`）把非十进制写法挡成"—"；正则改宽后（变异 4）测试会失败，说明挡得住。
- 小数位超过 20 位会被四舍五入到 20 位（`0.12345678901234567890123` 显示为 `…890`）。Google 的 `recurringPrice` 是微单位（最多 6 位小数），到不了这个长度，不是缺陷。
- 老浏览器（Chrome 106 之前、Firefox 116 之前、Safari 15.4 之前）不认字符串参数，会内部转成数字，十五位以上的有效数字会丢位。Google 标价到不了十五位有效数字，所以对真实数据没有后果；我没有在 Firefox、Safari 里跑，列在未运行里。

页面层面（真实 Chromium，用路由改写 `/subscriptions/stats` 的响应，en-US 和 zh-CN 各一遍）：
- `9007199254740993.01`/USD 显示 `$9,007,199,254,740,993.01`（zh-CN 为 `US$9,007,199,254,740,993.01`）；`0.1234567890123456789`/EUR 显示 `€0.1234567890123456789`；`123456789012345678901234567890.123456789012345678`/THB 显示 `THB 123,456,789,012,345,678,901,234,567,890.123456789012345678`；负数带负号；`149000`/IDR 为 `IDR 149,000`；`199000`/VND 为 `₫199,000`。
- `listPriceAmount` 和 `listPriceCurrency` 都为 null：`—`；只有币种没有金额：`—`；有金额没有币种（`24.99`）：`24.99`；`1e21`：`—`。没有出现 `NaN`、`null`、`undefined`。

## 二、清单逐行核对

- **b1 客服反馈转发告警**：类型在 `ALERT_TYPES`（`alertTypes.ts`）、中英文文字有；`detail` 为 `attempts_exhausted` 时显示"转发次数已用尽（attempts_exhausted）"，后面不附后端 message（真实浏览器和页面测试都看过，没有 message 来源可漏）；同样的值出现在别的类型（`POSTBACK_CREDENTIAL_FAILED`、一个未知类型 `FUTURE_TYPE_X`）时原样显示，不翻译；`Object.hasOwn` 挡住了 `constructor`、`__proto__` 作为类型或 detail。关联账号链接到 `/users/2003`。假后端：对反馈点"重试"成功时同一步把这条告警置为 RESOLVED；再次重试（409）、不存在的反馈（404）时告警保持不动（浏览器里用 API 实测：第一次 200，之后 409 和 404，告警状态 `RESOLVED` 一条）。符合清单。
- **b2 投放回传凭证告警（含 GROUP A 更正）**：`token_unreadable`、`pixel_id_malformed` 按码翻译并带原值；`190` 原样；空显示"—"；无关联账号不出链接。假后端 `raiseAlert`（`mock/_core/monitorData.ts` 第 232 行）：同一对象同类型已有 OPEN 时只有 `POSTBACK_CREDENTIAL_FAILED` 用后到的原因替换 detail，别的类型保留第一次（和契约 17.4"同一对象已有 OPEN 的不重复写"一致）；解决后再失败开新的。两个方向的变异（所有类型都替换、从不替换）都被测试抓住。`PUT /attribution/campaigns/:id` 带新令牌或像素 id 变了才关闭；这是实现者对清单"重新填写"的猜测，已经写进问题文件第二节，不是缺陷。注意 `raiseAlert` 只被测试调用，没有任何假后端的接口会触发它，所以在 `dev:mock` 里看不到"后到的原因替换 detail"，只能靠测试（实现者在注释里写了"Used by the tests and by the other mock endpoints that cause an alert"，目前没有这样的接口；不是缺陷，因为清单没有要求界面里能触发）。
- **SUBSCRIPTION_EVENT_FAILED**：后端清单没给内容，页面把 refType、refId、detail 一律经 `plainText` 原样显示，不编说明（问题文件第一节）。符合清单"先不要自己编它们的说明"。
- **GROUP A 第 18 种 STAT_RELAND_FAILED**：类型和文字"统计重新落库失败 / Statistics re-landing failed"；refType/refId/detail 原样显示。符合。
- **W2a 告警接口**：`ALERT_TYPES` 数了一遍正好 18 个、无重复（14 种契约 + `SUPPORT_FORWARD_FAILED`、`POSTBACK_CREDENTIAL_FAILED`、`SUBSCRIPTION_EVENT_FAILED`、`STAT_RELAND_FAILED`），中英文类型文字各 18 条；筛选的选项取这 18 种；页面对 `status`、`type` 用 `|| undefined`，不会发空字符串。假后端 `GET /alerts` 对 `status=`、`type=`、`status=open`、`type=NOPE` 都是 400 `OUT_OF_RANGE`，分页错误先于它们（真实 dev:mock 里用 API 实测）。未知类型显示原始字符串：真实浏览器里 `FUTURE_TYPE_X` 显示原样，页面不崩；变异"未知类型也走翻译键"被测试抓住。清单正文说"17 种"，GROUP A 说"第 18 种"，实现是 18，一致。
- **a7 通话详情 `maxDurationMinutes`**：抽屉多一行"发起时的最长时长 / Max length when made"，整数分钟，下面一行小字说明；非整数、负数、字符串、缺失显示"—"，0 显示"0 分钟"；会话列表九列不变（实测列表行里没有这个字段，详情 `ses-0008` 为 10）；假后端截止时间按这个分钟数算。中文和英文抽屉都在真实浏览器里看过（60 分钟）。符合。
- **a11 投诉 `status=OPEN`**：筛选第一项"未结案 / Not closed"，默认不选、不带 status；选中发 `status=OPEN`。假后端（实测）：`OPEN` 只返回 RECEIVED 和 INVESTIGATING；`open`、`OPEN,RECEIVED`、` OPEN`（带空白）都是 400 `OUT_OF_RANGE`；空字符串不过滤；分页错误先于 status。符合清单。
- **GROUP B 记忆服务**：`truncated === true` 时历史表上方显示"只显示最新 N 条，共 M 条。"；`totalCount` 缺失（或不是有限数）时只显示"只显示最新 N 条。"，没有编数字；`truncated` 缺失或为假不显示。真实浏览器（改写响应）：`truncated:true` 且无 `totalCount` 显示 `Only the newest 1 are shown.`（中文 `只显示最新 1 条。`）；有 `totalCount: 1234567` 显示 `Only the newest 1 are shown, 1,234,567 in total.`（中文 `只显示最新 1 条，共 1,234,567 条。`）。N 取的是实际显示的行数而不是写死 200，见下面"不是缺陷"。
- **GROUP A 封禁以 BANNED 结束**：结束原因的文字原来就有；假后端封禁成功时把该账号正在进行的通话（通话记录和用户页签两处）以 `BANNED` 结束，实测：封禁前 `ses-0003` 在进行，封禁后 `endReason` 为 `BANNED` 且有结束时间；再封禁一次 409 `INVALID_STATE`，通话不再变动。抽屉里英文"Account banned"、中文"账号被封禁"。
- **GROUP A 推送任务 MISSED**：状态 CANCELLED 加 `note === 'MISSED'` 时显示"错过：执行器停机过久，未发送 / Missed: the push executor was down for too long, nothing was sent"，限宽换行；真实浏览器 1440 宽（en-US）和 390 宽（zh-CN）都没有撑破页面（`scrollWidth` 等于 `clientWidth`）。契约写的是"note（可空，如 MISSED）"，所以别的 note 值不应该显示"错过"，代码是对的，但测试没覆盖，见记录项 3。

## 三、阿拉伯语、泰语等输入（真实 Chromium，改写 `/alerts` 的响应）

refType、refId、detail 用了：阿拉伯语的 refType 加阿拉伯-印度数字的 refId、阿拉伯语 detail；泰语 detail 重复 8 遍；越南语、印尼语、西班牙语混合并带 `{x}`、`<b>b</b>`；refType 和 refId 是对象；detail 是对象、数组、布尔 `true`；refType 是数字 12345 加 refId 数字 0；全是 null 或空串。结果：11 行全部渲染，没有页面错误（`pageerror` 为空）；对象显示成 JSON 文字（`{"a":"ก"}: {"b":1}`、`{"code":"ก","list":[1,2]}`）；`<b>` 作为文字显示，没有被当标签；null 和空串显示"—"；泰语长文本在列里被截断成两行带省略；没有 `[object`、`undefined`、`NaN`。页面宽度没有横向撑开。阿拉伯语的那一行因为 `dir="auto"` 整体按从右到左排，冒号在视觉上跑到词的另一侧，是双向文字的正常显示，不是缺陷。

## 四、变异检查（25 个，只改 `scratchpad/rv/draft` 里的 HEAD 拷贝，每次跑相关测试文件，改完立刻还原）

抓住 21 个，漏掉 4 个。
抓住的：标价改回 `Number()`；去掉 `maximumFractionDigits: 20`；无币种时不保留小数位数；正则放过 `1e21`；固定详情不分类型；`detail` 不经 `plainText`；去掉 `STAT_RELAND_FAILED`；未知类型也走翻译键；记忆页签总数缺失分支取反；`truncated` 改为"有值就显示"；分钟数把 null 当 0；假后端 `raiseAlert` 对所有类型替换 / 从不替换；假后端放过未知 type；假后端 truncated 恒为假 / `totalCount` 被截成 200；封禁不结束通话 / 连已结束的通话也改；改活动时任何保存都关告警；通话详情不返回 `maxDurationMinutes`；筛选里去掉 OPEN。
漏掉的见记录项 2、3、4。

## 五、发现

### 记录项

1. **标价金额若是 JSON 数字（不是字符串）会整格显示"—"。** `src/pages/subscriptions/stats.tsx` 第 26 行（`typeof amount !== 'string'` 就返回破折号）和 `src/services/subscriptions/types.ts` 第 154 行（类型从 `number | string | null` 收窄成 `string | null`）。清单 a12 只保证 Google 行是十进制字符串，原话"苹果行不变"，没有写苹果行的 JSON 类型；`docs/contract-requests/2026-10-26-admin-frontend-subscriptions.md` 第七节问过这个问题，`docs/backend-inputs/` 里没有回答，原来的暂定做法是"数字和字符串都接受"。触发：响应里 `listPriceAmount: 9.99`（数字）的一行，真实 Chromium 实测显示"—"而不是 `$9.99`。后果：只有后端对苹果行发数字时，苹果行的标价全部看不见，没有报错。我没有后端代码，不能确定苹果行发什么，所以记录，不当成立即修；如果后端确认苹果行也是字符串就可以不动。建议：数字类型的值在页面里按 `String(value)`（不是 `Number`，不是精度更高的承诺）接着走同一条格式化路径，或者向后端问清楚后把答案写进问题文件。
2. **没有测试盯住告警"关联对象"列对非字符串 refType、refId 的显示。** `src/pages/monitor/alerts.tsx` 第 84 行 `plainText(row.refType)`、`plainText(row.refId)`；变异把它们改回 `row.refType ?? DASH`、`row.refId ?? DASH` 后 `alerts.test.tsx`（32 条）全过。触发：refId 为对象时，去掉 `plainText` 会显示 `[object Object]` 而不是 JSON 文字（模板字符串不会抛错，所以不是崩溃）。后果：回归时没有测试能发现。建议补一条对象型 refType 和 refId 的页面测试（现有的泰语 refType 测试是字符串，抓不到）。
3. **没有测试盯住推送任务只有 `note === 'MISSED'` 才显示"错过"。** `src/pages/push/tasks.tsx` 第 67 行；变异改成"有任何 note 就显示"后 `tasks.test.tsx`（25 条）全过，因为假数据里除任务 5 外没有带别的 note 的行。契约写"note（可空，如 MISSED）"，别的值是可能出现的。触发：回归成"有 note 就显示"时，一个 note 为别的值的任务会错标成"错过：执行器停机过久，未发送"。建议在假数据或测试里加一个 note 为别的值的任务。
4. **没有测试盯住"对哪一条反馈点重试就关哪一条告警"。** `mock/support.mock.ts` 第 34 行 `resolveAlertsOf('SUPPORT_FEEDBACK', row.id)`；变异把 `row.id` 写死成 `'5003'` 后 `support.mock.test.ts`（12 条）全过，因为假数据里只有 5003 一条失败的反馈。触发：假后端以后多一条失败反馈时，写死的 id 不会被发现。后果仅限假后端，不影响真实后端。建议加第二条失败反馈和对应断言。

实现者报告里的记录项 1（`push.tasks.sendAtHelp` 帮助文字没有写"执行器停机超过 `push.schedule_catchup_minutes`"这个条件，`src/locales/en-US/push.ts` 第 117 行）我核对属实，那一行仍写"A task whose time is long past when it is reached is cancelled as missed."，只是说明不够准，不影响行为；不重复计入。实现者的记录项 2（`likeness.test.tsx` 高负载超时）我没有复现：我在同时有别的评审进程和变异检查在跑的情况下，把本区域相关的 20 个测试文件一起跑，476 条全过（143 秒）。

### 不是缺陷

- 小数位超过 20 位被舍入到 20 位（`stats.tsx` 第 30 行，`maximumFractionDigits: 20`）：Google 的 `recurringPrice` 是微单位，最多 6 位小数，到不了。
- 老浏览器把字符串当数字（见第一节）：真实标价没有十五位以上的有效数字。
- 记忆页签的"最新 N 条"取实际行数，不是写死的 200（`AccountMemoryTab.tsx` 第 197、201 行）：后端规定是 200，假后端也是 200，两者一致；若后端以后改上限，页面仍说真话。
- `raiseAlert` 只被测试调用（见 b2）。
- 实现者报告里说开始时对 `mock`、`src/pages`、`src/services` 整个目录跑过 `biome format --write`（可能碰到别的代理未提交的文件）：只是排版；现在工作区没有任何未提交改动，`npx biome check` 对本区域的 43 个文件无报错，没有后果。

### 变更

无。实现者列的三条"变更候选"（固定详情旁边保留原值、订阅事件告警不加说明、错过标签写完整原因）都是展示层的选择，没有改变清单要求的行为，我没有发现需要再请负责人确认的新增行为。

### 立即修

无。

## 六、我跑了什么

- 测试（本区域 20 个文件一起跑）：`npx vitest run src/pages/monitor src/services/monitor src/pages/subscriptions/stats.test.tsx mock/monitor.mock.test.ts src/pages/memory/AccountMemoryTab.test.tsx mock/memory.mock.test.ts src/pages/sessions src/services/sessions mock/sessions.mock.test.ts src/pages/push/tasks.test.tsx mock/complaints.mock.test.ts src/services/complaints mock/users.mock.test.ts mock/support.mock.test.ts mock/campaign.mock.test.ts mock/subscriptions.mock.test.ts`：20 个文件，476 条通过。`npx biome check` 对本区域 43 个文件无报错。没有跑 tsc 和全量。
- 变异：脚本在 `scratchpad/rv/mut.py`，输出在 `scratchpad/rv/mut.out`（不在仓库里）；共享检出里没有留下改动，`git status` 为空。
- 真实浏览器：Playwright Chromium 153，从 `scratchpad/rv/draft2`（HEAD 的拷贝，node_modules 单独复制）起 `max dev`，端口 8862，用完按进程号停了；脚本和截图在 `scratchpad/rv/`（`br.cjs`、`br2.cjs`、`br3.cjs`、`br4.cjs`、`chromeintl.cjs`）。路由改写的部分（告警的刁钻值、标价、记忆页签）是改的响应，不是假后端本身的数据。

## 语言覆盖

界面只有 zh-CN 和 en-US，页面检查两种都做了（告警、标价、记忆提示、通话详情、推送任务错过标签）；输入数据覆盖了阿拉伯语、泰语、越南语、印尼语、西班牙语、英语、中文的 refType、refId、detail。标价的数字格式在页面里只覆盖中文和英文界面；其他语言的数字格式只在浏览器里直接调用 `Intl.NumberFormat` 看过，没有换界面语言。

## 未运行（3）

1. Firefox、Safari、低于 Chrome 106 的浏览器里标价字符串的格式化没有跑（只有 Node 22.22.0 和 Chromium 153）；原因是这台机器只有 Chromium。
2. 全量测试和构建：按规则由主会话统一跑。
3. 和真实后端联调：没有后端，苹果行 `listPriceAmount` 的真实 JSON 类型（记录项 1）因此不能确认。
