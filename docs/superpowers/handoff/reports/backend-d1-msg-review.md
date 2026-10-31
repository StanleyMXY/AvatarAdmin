立即修未修 2、记录项 5、未运行 0、阻塞 0

# 评审：msg 区域（推送模板、短信模板、邮件模板；清单 a5、a14、e1、a6、e2、c1），提交 e6a2ad9

评审对象：提交 e6a2ad9 在 HEAD（d2a1c00）上的状态；e6a2ad9 之后没有再动这三个页面和它们的假后端文件（`git diff e6a2ad9 HEAD` 在 `src/pages/push`、`src/pages/email`、`mock/push.mock.ts` 上没有差异；`mock/sms.mock.ts` 和 `src/pages/sms/` 之后只有渠道凭据的改动）。方法：读清单、计划（任务 22、27）、代码和测试；在草稿目录的 HEAD 拷贝里写探针测试、做变异检查、起 `dev:mock` 用 Playwright Chromium 看真实页面；共享检出没有改动（`git status` 干净），用完按进程号停了服务。语言覆盖：界面文字的检查只覆盖英文和中文（产品只有这两种界面语言）；被拒文字里的默认语言名用泰语和带标记的字符串试过。

## 立即修（2 条，未修）

### 1. 真后端的模板列表没有 `total` 时，推送模板页会无限请求，或者表格丢行

清单 a14 和计划任务 22 写的响应是 `{items, missingLocales}`，没有 `total`；页面却靠 `total` 分页。实现者把它记成记录项 2（"多请求一页、总数显示不了"），实际后果更重。我用没有 `total` 的响应验证了三种情形：

- 后端按 `page`/`pageSize` 分页但不给 `total`（探针 3 条模板、45 条模板两组）：`listAllTemplates`（`src/services/push/index.ts:56-67`，判断 `items.length >= answer.total` 恒为假）总是多请求一页，直到读到空页才停；请求序列是 `page=1&pageSize=200`、`page=2&pageSize=200`，再加表格自己的 `page=1&pageSize=20`。表格（`src/components/PagedListTable.tsx:54`，`total: page.total`）没有总数：3 条模板时显示"第 1-3 条/总共 3 条"（碰巧对）；45 条模板时显示"第 1-20 条/总共 20 条"，下一页按钮禁用，第 21 到 45 条在表格里翻不到（矩阵读到了全部，所以矩阵是对的，只有表格错）。
- 后端不分页，不管 `page` 是几都返回全部模板（清单说响应"从 `{"items":[…]}` 变成……"，这种可能不能排除）：`listAllTemplates` 每次都拿到非空页，永远不满足停止条件。探针里我让第 41 次请求才返回空页，一共发了 42 次请求；第一次没有这个上限时，测试进程在几秒内内存耗尽退出（`FATAL ERROR: Ineffective mark-compacts near heap limit`）。真浏览器里就是页面卡住、请求不停、内存涨到标签页崩溃。实现里的"空页就停"保护只对"后端会分页"成立。
- 假后端仍然带 `total`（`mock/push.mock.ts` 的列表），所以所有现有测试都看不到这个问题。

后果：真后端按清单的形状上线时，推送模板页要么卡死，要么表格少行。分类依据：崩溃，和输出错误（丢行）。建议的修法：`total` 不是数字时，一页的条数小于 `pageSize` 就停，并且这一页里没有新的 `id` 也停；表格在没有 `total` 时按"读到的全部"显示；加两条用没有 `total` 的响应的页面测试（分页的和不分页的各一条，后一条断言请求数有上限）。

### 2. 矩阵：召回原因没有任何启用模板时，每一格（包括默认语言那一格）都写"回退到默认语言"，计划要求的"没有启用的模板"行标记没有做

计划任务 22（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md` 第 728 行）写："某个原因的所有列都在 `missingLocales` 里（没有任何启用的模板）时，该行标'没有启用的模板'"。`src/pages/push/TemplateMatrix.tsx`、`coverage.ts` 里没有这一行标记（源码里搜"没有启用的模板"/"no enabled template"没有文字键，测试里也没有）。

触发步骤（真浏览器，假后端的示例数据，不用改任何东西）：打开推送模板页，`streak_at_risk` 这一行只有停用的泰语、印尼语等模板，后端 `missingLocales.streak_at_risk` 是整个语言清单（包括默认语言 `en`）。页面显示 `en` 格"Uses default language"，`vi`、`ar` 格同样。`en` 就是默认语言，它没有启用的模板，这个原因实际上谁都不会收到推送；说它"回退到默认语言"是错的，运营会以为有兜底。再用探针响应（整个清单）确认：七种语言格全是"Uses default language"。

分类依据：页面对运营显示错误的状态，且是计划写明的行为缺失。建议的修法：某原因的 `missingLocales` 覆盖了全部支持的语言时，该行整行标"没有启用的模板"（中性提示），格子里不再写"回退到默认语言"；加页面测试，用整个清单的响应。

## 记录（5 条）

3. 被拒文字比计划写的少。计划任务 22（第 729 行）要求的文字写出做法："先启用默认语言的模板；要停用、删除或改掉默认语言的模板，先停用同一原因下其他语言的模板；唯一启用的模板是默认语言时不能把它改成别的语言，请保持它为默认语言并启用，另建其他语言的新模板"，并且模板页顶部写明运营怎么用（第一条要启用的模板必须是默认语言的；整体关掉一个原因先停其他语言最后停默认语言；改 `push.default_locale` 前先启用新语言的模板；往 `app.supported_locales` 加语言不用先动召回模板）。实际是一句话（`src/locales/en-US/push.ts:76` `push.templates.defaultLanguageRequired`："……enable or keep it first, then change the other languages"）和一句顶部说明（`push.templates.note`，只写规则和回退，没有做法）。这句话对三种情形都不假，也没有显示后端 `message`；但"先停其他语言再停默认语言"这个最常见的做法没有写出来。实现者在报告里把这条列为"变更（自己定）"，没有经过负责人确认，实际上是偏离计划。建议补全文字，或者由负责人明确改计划。已有的问题文件（`docs/contract-requests/2026-10-31-admin-frontend-push-default-language-case.md`）要求后端给 `case`，不影响这条。
4. 短信模板页没有做计划要求的操作前提示。计划任务 27（第 846 行）："模板页顶部同样写出这条规则，并在拿掉最后一个合格模板的操作之前提示（前端按当前列表算，后端为准）"。实现者的报告把它判为"不是缺陷"，理由是"e2 只要求新规则操作前不预判"，但清单 e2 没有这样说，计划说的相反。现在的行为：把唯一的 `en`、不限国家的验证码模板（假后端里是 `otp_en`）停用或改语言，请求照发，被拒后顶部提示出现按码的文字（我在真浏览器里看到了，没有后端 `message`）；没有操作前的确认。后端仍然是最终裁决，所以不会产生错误结果。建议：要么按计划加提示（`src/pages/sms/templates.tsx:159` 附近已有"最后一个验证码模板"的确认，可以参照），要么由负责人把计划第 846 行改成"不预判"。
5. 短信页的测试抓不住被拒判断里的两个条件。变异检查：把 `isEnglishFallbackRefusal`（`src/pages/sms/templateFailure.ts:18`）里的 `d.ref === ENTITY && d.reason === REASON` 改成只判 `d.reason === REASON`，或只判 `d.ref === ENTITY`，`src/pages/sms/templates.test.tsx` 37 条全部通过。改坏之后，后端对 `country` 字段的普通 `OUT_OF_RANGE`（`details: [{ref:'country', reason:'OUT_OF_RANGE'}]`）会被显示成"必须保留英文验证码模板"的句子。缺的测试：400 带 `ref` 为 `country`、`reason` 为 `OUT_OF_RANGE` 时，页面显示字段错误而不是这句话；带 `ref` 为 `SmsTemplate`、`reason` 为 `EMPTY_NOT_ALLOWED` 时同样不是这句话。
6. 推送假后端"默认语言比较区分大小写"没有测试。变异检查：把 `mock/push.mock.ts:213` 的 `t.locale === lang` 改成不分大小写比较，`mock/push.mock.test.ts` 48 条全部通过。清单 e1 写明"语言标签区分大小写地精确比较"。缺的测试：默认语言 `en`，同一原因只有启用的 `EN` 模板，写入应被拒。
7. 实现者已记录、我复核属实、保持记录：短信页测试"asks inline for a template that is not the last, and deletes with one request"在满载并行时超过默认等待（`src/pages/sms/templates.test.tsx`，报告记录项 3）。另外实现者的记录项 4（假后端的 `PUT` 接受请求体里的 `locale`、`triggerReason`，页面从不发）属实，已写进问题文件第四节，不再计数。

## 不是缺陷

- 提交 e6a2ad9 里带了不属于本区域的一行：`src/locales/{en-US,zh-CN}/push.ts` 的 `push.tasks.missed` 文字（属于推送任务的错过说明，另一个区域）。原因：同一个语言文件里两个区域的改动按路径提交时无法分开；文字本身正确，HEAD 上没有影响。
- `describeError` 对未知错误码会在括号里附后端 `message`（`src/request/errors.ts:119`）。用 `CONFLICT` 这类未登记的码试，推送文字函数会把 `message` 带出来。这是请求层对未知码的统一规定，召回规则的拒绝是 `INVALID_REQUEST`，不受影响。

## 对你特别要查的几点逐条回答

### 推送矩阵"回退到默认语言"是否完全由后端 `missingLocales` 决定

是。`src/pages/push/coverage.ts:40` 的 `fallback` 只来自 `missingLocales[reason].includes(locale)`，没有从模板推算（变异检查：改成由模板推算，`templates.test.tsx` 变红）。用探针响应（3 种语言，`en` 有启用模板）逐种试，格子状态如下（"无"是中性的"没有模板"）：

| 后端给的 `missingLocales` | 没有模板的格子 | 有模板但停用的格子 |
|---|---|---|
| 没给这个字段 | 无 | 只有"未启用" |
| 给 `{}`、`null`、`[]` | 无 | 只有"未启用" |
| 每个原因给空数组 | 无（页面不推算） | 只有"未启用" |
| 部分，例如 `daily_recall:['ar']`、`streak_at_risk:['en','ar','vi']` | 列出的显示"回退到默认语言"，没列出的是"无" | 列出的显示"未启用"加"回退到默认语言" |
| 值不是列表，或列表里夹着数字、`null` | 非列表的原因按没给；夹杂的只留文字项 | 同上 |
| 整个清单（原因没有任何启用模板） | 全部显示"回退到默认语言"，包括默认语言那一格 | 见上面立即修第 2 条 |

没有红色；回退用蓝色标签（变异检查：改红，测试变红）。

### 被拒提示是否只用 `data.defaultLocale` 和 `data.reason`、不泄漏 `message`

是。`src/pages/push/recallRule.ts` 的 `templateFailureText` 在 `INVALID_REQUEST` 且两项都是非空文字时用它们填按码的句子；否则走按错误码的通用文字。我用 `message` 里放 `LEAK-` 标记的错误对象试了十种 `data`（完整、泰语默认语言名、未知原因、`data` 为 null、只有一项、空串、数字、设置页的形状、带未知 `details`、带 HTML 的语言名），英文和中文各一遍：`INVALID_REQUEST` 下 `message` 一次都没有出现；HTML 语言名按纯文字原样显示。真浏览器里行内开关和行内删除的提示都是按码的句子。变异检查：让函数返回 `error.message`，8 条测试变红。

### 旧的"每种语言都要有"逻辑是否彻底删除

是。搜 `missingWarning`、`matrix.missing`、`missingFor`、`completeFor`、"every supported language"、"每种…语言"在 `src`、`mock`、`tests` 里：没有残留的文字键、警告、函数；唯一的命中是 `src/pages/push/templates.test.tsx:124` 的反向断言（旧文字不出现）和 `mock/push.mock.test.ts:274` 的"不要求每种语言"的测试。`src/locales/*/config.ts` 里"每种语言都要先有通知模板文件"是 `app.supported_locales` 的另一条规则（a4），不是召回模板，属于 cfg 区域。

### 短信规则在假后端的判断

`mock/sms.mock.ts:99-123`：`isEnglishFallback` 是 启用 且 `smsType === 'OTP'` 且 `locale.toLowerCase() === 'en'` 且 `!country`；只有"拿掉最后一个合格模板"才拒绝，并且只在手机号登录开着或有手机号账号时；旧的"最后一个 OTP 模板"守卫先判，消息不变。变异检查：去掉 `toLowerCase`（1 条变红，`EN` 不算了）、去掉 `!country`（2 条变红）、改成前缀匹配（`en-GB` 也算，2 条变红）。所以 `en`、`EN` 算，`en-GB`、`en-US`、只服务一个国家的 `en` 不算，`country` 为 null 算。页面层的判断条件没有被测试钉住：见记录第 5 条。

### 邮件模板第六项的占位符和必含项是否来自后端

是。`src/pages/email/TemplateEditor.tsx:40-41` 读 `template.placeholders`、`template.requiredPlaceholders`，必含检查（`placeholders.ts`）用数组里的原样字符串在正文里找；源码里没有 `LOGIN_METHOD_ADDED`、`{method}` 的判断，只有语言文件里的用途说明（`email.code.LOGIN_METHOD_ADDED`，中文与清单 c1 给的原文逐字相同）和占位符说明（`email.placeholder.method`）。真浏览器里编辑 `LOGIN_METHOD_ADDED`：可用 `{method} {time} {appName}`，必含 `{method} {time}`。不识别的模板码仍显示、可编辑（计划要求，原有测试覆盖）。

### 没有 `total` 的列表响应

见立即修第 1 条（多请求一页；45 条模板时表格显示"总共 20 条"且翻不了页；后端不分页时无限请求）。

## 运行过的命令（都在草稿目录拷贝里）

- `npx vitest run mock/push.mock.test.ts mock/sms.mock.test.ts mock/email.mock.test.ts src/pages/push/coverage.test.ts src/pages/push/recallRule.test.ts src/services/push`：165 条通过。
- `npx vitest run src/pages/email src/pages/push/templates.test.tsx src/pages/sms/templates.test.tsx`：123 条通过。
- 变异检查 11 次：8 次变红（短信去 `toLowerCase`、去 `!country`、前缀匹配；推送泄漏 `message`；回退标签改红；没列出的格子当回退；`readMissingLocales` 收下非列表；`missingLocales` 不从第一页取）；3 次存活（短信页 `ref` 条件、`reason` 条件，推送假后端大小写比较），对应记录第 5、6 条。每次改完立即还原，共享检出 `git status` 干净。
- 探针测试（读 `total` 缺失、`missingLocales` 七种形状、`message` 泄漏十种 `data`）写在草稿目录，没有提交；真浏览器脚本和截图在草稿目录。
