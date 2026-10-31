立即修未修 0、记录项 3、未运行 0、阻塞 0

# 区域 msg 报告：推送模板、短信模板、邮件模板（后端第一批交付清单 a5、a14、e1、a6、e2、c1）

范围：只做这三个页面和它们的假后端。短信渠道的凭据规则（authsys）和设置页里保存 `push.default_locale`、`app.supported_locales` 被拒的文字（cfg）不在这里。

## 逐行

### a5 + a14 + e1：推送模板

落实了什么：
- 列表响应：`GET /push/templates` 现在返回 `{items, total, missingLocales}`。`src/services/push/index.ts` 的 `readMissingLocales` 只收"值是文字列表"的原因，其余丢掉；`listAllTemplates` 返回 `{items, missingLocales}`（`missingLocales` 取第一页，后端说它不受分页和筛选影响）。类型在 `src/services/push/types.ts`。
- 矩阵（`src/pages/push/coverage.ts`、`TemplateMatrix.tsx`、`templates.tsx`）：格子是否"回退到默认语言"完全由后端的 `missingLocales` 决定，前端不从模板自己推算（这是"前端不复刻规则"的体现）。有启用的模板显示"已启用"；有模板但停用显示"未启用"，后端同时列出该语言时再加蓝色的"回退到默认语言"信息标签；没有模板且后端列出显示"回退到默认语言"；没有模板而后端没有列出，或后端根本没给列表，显示中性的"没有模板"。没有红色。说明文字改成了新规则。
- 删掉旧逻辑：`missingFor`、列表开关上的启用前警告（`message.warning`）、对话框里的黄色警告，以及语言文字 `push.templates.missingWarning`、`push.templates.matrix.missing`。旧测试里的"缺失/红色/会拒绝启用"断言一并改掉。
- 被拒的文字（`src/pages/push/recallRule.ts`）：400 `INVALID_REQUEST` 且 `data` 里有非空文字 `defaultLocale` 和 `reason` 时，显示按码翻译的文字，不显示后端 message。中文：触发原因“{reason}”需要默认语言 {defaultLocale} 的启用模板：先启用或保留它，再改其他语言。英文：{reason} needs an enabled template in the default language ({defaultLocale}): enable or keep it first, then change the other languages. 三种 message 情形无法仅由 `data` 区分，所以用这一句通用而准确的话。保存 `push.default_locale` 的拒绝（`data.reasons`，没有单数 `reason`）不匹配这个函数，留给设置页。用在：行内开关（`EnabledSwitch.tsx` 新增 `failureText`）、行内删除、新建/编辑对话框（`TemplateModal.tsx`）。
- 问题文件：`docs/contract-requests/2026-10-31-admin-frontend-push-default-language-case.md`，请后端在这类 400 的 `data` 里加结构化的 `case`（三个固定值），并确认 `PUT` 是否真的接受改语言和改原因。
- 假后端（`mock/push.mock.ts`）：新响应；规则 `enforceDefaultLanguage` 读 `push.default_locale`（默认 `en`），在写入之后的状态上判断，只在写入前或写入后有启用的模板时才判；创建（`enabled=true`）、编辑、停用、删除都判；三种 message 与清单一致；被拒时什么都不写，上传记录也不消耗。保存 `app.supported_locales` 不看召回模板（假后端本来就不做）。
- 旧的"每种语言都要有"的假后端函数 `completeFor` 已删除。

测试：
- 假后端：`mock/push.mock.test.ts`，新增两组"missingLocales"测试和九条"默认语言规则"测试（创建/启用被拒、默认语言先于其他语言、不要求每种语言、停用和删除默认语言被拒、最后一个启用的模板可以走、其他语言随时可改、停用状态不判、第三种 message、改原因时旧原因也判、读 `push.default_locale`、被拒时不消耗上传）。
- 服务：`src/services/push/push.test.ts`（`missingLocales` 的读取、四种非法形状）。
- 矩阵逻辑：`src/pages/push/coverage.test.ts`；被拒的文字：`src/pages/push/recallRule.test.ts`（含泰语作默认语言名、未知原因按码显示、中文）。
- 页面：`src/pages/push/templates.test.tsx`：矩阵（回退格子是信息而非错误、后端没列出时中性、`fr` 这种只在支持列表里的语言、没有列表）；"规则"一组九条（对话框不预警、先建默认语言再启用泰语、行内开关被拒、行内删除被拒、中文文字、默认语言改成 `th`、不明数据只显示按码的通用文字且不泄露后端 message）。

命令和结果：
- 假后端、服务、`coverage`、`recallRule`：`npx vitest run src/pages/push/coverage.test.ts src/pages/push/recallRule.test.ts src/services/push mock/push.mock.test.ts`，87 条通过。
- 页面：`npx vitest run src/pages/push/templates.test.tsx`，45 条通过。
- 实现前的失败：假后端实现前 9 条失败（`mock/push.mock.test.ts`），服务 7 条失败（`src/services/push/push.test.ts`）；页面层没有单独留下"实现前"的失败输出，用下面的变异检查补了失败证据。

### a6 + e2：短信模板

落实了什么：
- 假后端（`mock/sms.mock.ts` 的 `refuseLastTemplate`、`isEnglishFallback`）：手机号登录开启或存在手机号账号时，把"启用、OTP、`locale` 等于 `en`（不分大小写）、`country` 为空"的最后一个模板拿掉（停用、删除、改语言、加国家、改类型都算）返回 400 `INVALID_REQUEST`，`details=[{ref:'SmsTemplate',reason:'OUT_OF_RANGE'}]`，message 与清单一致。原来的"最后一个 OTP 模板"守卫先判，消息不变，没有 `SmsTemplate` 细节。创建不受影响；已经缺合格模板的旧状态不拦无关的编辑。`en-GB` 或只服务一个国家的模板不算替代。
- 页面不预判（`src/pages/sms/templateFailure.ts`）：请求照常发出，后端裁决。`ref` 为 `SmsTemplate`、`reason` 为 `OUT_OF_RANGE` 时，显示按码的文字 `sms.templates.englishRefused`（中英文），位置：行内开关和删除的顶部提示（`templates.tsx`），以及编辑对话框顶部的错误条（`TemplateModal.tsx`，此时不再重复列出"超出允许的范围"那一行）。后端 message 不显示。
- 短信模板页顶部的规则说明加了一句这条规则（中英文）。

测试：`mock/sms.mock.test.ts` 新增一组七条（拿掉的五种方式、大小写和相近模板、还有别的合格模板时放行、守卫条件两种、旧状态不拦无关编辑、旧守卫先判）；原有的"最后一个 OTP 模板"测试按新规则补了一步。`src/pages/sms/templates.test.tsx` 新增：开关不预判、删除被拒、对话框顶部显示、中文显示、给另一个模板加国家照常成功，并把原来"关掉 otp_en 不用确认"的测试改成关掉 `otp_th`。

命令和结果：`npx vitest run mock/sms.mock.test.ts` 56 条通过；`npx vitest run src/pages/sms/templates.test.tsx` 37 条通过；`npx vitest run src/pages/sms/channels.form.test.tsx` 33 条通过（只为确认，见记录项 3）。实现前的失败：假后端 4 条失败。

### c1：邮件模板

落实了什么：假后端 `mock/_core/emailData.ts` 加第六项 `LOGIN_METHOD_ADDED`（占位符 `{method} {time} {appName}`，必含项 `{method} {time}`，默认英文标题和正文），列表按 `templateCode` 升序（原本就是排序后输出）。页面是数据驱动的，占位符和必含项仍来自后端的 `placeholders`、`requiredPlaceholders`，没有写死。语言文字：用途说明（`email.code.LOGIN_METHOD_ADDED`）中文照负责人给的原文，英文是对应译文；加了占位符说明 `email.placeholder.method`。核对"五个模板"的写死处：源码里没有，只有测试里的"5 行"，已改成 6 行（未知模板码那条是 7 行）。

测试：`mock/email.mock.test.ts`（六项、占位符顺序、保存缺 `{time}` 的 400 与恢复默认）；`src/pages/email/templates.test.tsx`（六行、中英文用途说明、编辑页占位符和必含项来自后端、缺 `{time}` 的提示）。命令：`npx vitest run mock/email.mock.test.ts src/pages/email src/locales`，463 条通过（含邮件页其他测试和语言文件的 parity）。实现前 11 条失败。

## 其余命令和结果

- 全区域相关测试一次：`npx vitest run src/pages/push src/pages/email src/pages/sms mock/push.mock.test.ts mock/sms.mock.test.ts mock/email.mock.test.ts src/services/push src/services/email src/services/sms tests/noHardcodedText.test.ts src/locales`，32 个文件，3 条失败、968 条通过。三条失败：`src/pages/push/templates.test.tsx` 里我新增的两条（"默认语言改成 th"、中文文字）和 `src/pages/sms/templates.test.tsx` 原有的"asks inline for a template that is not the last, and deletes with one request"。三条都只在满载并行时失败（默认的 1 秒等待不够；短信那条用了 5.8 秒）。单独重跑：推送页面 45 条通过，短信页面 37 条通过。我给推送页面新加的那组测试把等待上限放到 6 秒（`configure({ asyncUtilTimeout: 6000 })`，用完还原），之后推送页面整份 45 条通过。短信那条是原有测试，没有改。
- `src/pages/sms/channels.form.test.tsx` 早先一次目录运行里有一条超时，这次整批运行里没有失败，单独跑 33 条全过，说明是负载造成（authsys 在改这份表单，我没有碰）。
- `npx tsc --noEmit` 只看我的路径：无诊断。`npx biome check --write`：我的文件已通过。
- 禁止写死文字扫描（`tests/noHardcodedText.test.ts`）和 `src/locales` 的 parity：都在上面那次整批运行里，通过。

## 变异检查（把判断改坏，看测试是否变红）：14 次，全部变红

| 改坏的地方 | 变红的测试 |
|---|---|
| 推送：`recallRuleOf` 恒为 null | `recallRule.test.ts` 4 条 |
| 推送：格子的"回退"改成由模板自己推算 | `coverage.test.ts` 2 条 |
| 推送假后端：规则整体放行 | 6 条 |
| 推送假后端：去掉"默认语言被拿走"的判断 | 2 条 |
| 推送页面：删除提示改回通用文字 | 页面 1 条 |
| 推送页面：行内开关不带 `failureText` | 页面 4 条 |
| 短信假后端：语言比较改成区分大小写 | 1 条 |
| 短信假后端：去掉"还有别的合格模板"的条件 | 4 条 |
| 短信假后端：去掉"无国家"条件 | 2 条 |
| 短信假后端：去掉"手机号登录/手机号账号"守卫 | 1 条 |
| 短信页面：`isEnglishFallbackRefusal` 恒为 false | 页面 4 条 |
| 邮件假后端：必含项去掉 `{time}` | 2 条 |

做这些变异时我是备份、改、还原共享文件 `mock/sms.mock.ts`；还原后核对了另一个代理在该文件里的凭据改动都还在。变异输出另存：`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/msg/mut-*.txt`。

## 真实浏览器检查

做法：把仓库拷贝到草稿目录（`.../scratchpad/msg/app`，node_modules 用硬链接拷贝），`PORT=8461 npm run dev:mock`，Playwright Chromium 以 `root` 登录，脚本 `.../scratchpad/msg/browse.cjs`，截图在 `.../scratchpad/msg/shots/`。用完按监听进程的号停了服务（未用 `pkill -f`）。

看到的：
- 邮件模板：6 行，顺序 DELETION_CONFIRM、LIKENESS_COMPLAINT_RECEIVED、LOGIN_METHOD_ADDED、PASSWORD_CHANGED、PASSWORD_RESET、REGISTER_CODE；编辑 `LOGIN_METHOD_ADDED` 时可用占位符是 `{method} {time} {appName}`，必含 `{method} {time}`，各带说明。
- 短信模板：把 `otp_en` 的开关关掉，页面不弹确认，顶部提示就是 `sms.templates.englishRefused` 的英文；编辑 `otp_en` 把语言改成 `th` 提交，对话框保持打开，顶部错误条显示同一句，没有后端原文。
- 推送模板：矩阵里 `daily_recall` 全是"On"；`streak_at_risk` 里没有模板的 en、ar、vi 显示蓝色"Uses default language"，有但停用的 zh-Hans、th、id、es 显示"Off"加蓝色标签；没有红色。关掉英文 `daily_recall` 的开关，提示是“Daily recall needs an enabled template in the default language (en): …”；切到中文后矩阵格子是“回退到默认语言”，提示是“触发原因“每日召回”需要默认语言 en 的启用模板：先启用或保留它，再改其他语言。”
- 控制台错误：只有三次预期的 400（三次被拒），没有别的。布局：推送矩阵在窄屏下横向滚动（宽标签），没有撑破页面。
- 过程中的坑（不是缺陷）：mfsu 对符号链接的 node_modules 会报"does not exist in container"，改成硬链接拷贝后正常；登录请求需要带 `Accept: application/json`，否则假后端答页面 HTML。

## 覆盖的语言

测试数据：短信模板和推送模板沿用已有的七种语言样例（泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，含长串无空格和 emoji）；邮件新测试用了泰语和西班牙语的主题；推送新测试里用泰语 `th` 作默认语言。新增断言的界面文字只覆盖 zh-CN 和 en-US（产品只有这两种界面语言）。

## 发现的问题（按 CLAUDE.md 分类；一条不是缺陷，三条记录项）

1. 不是缺陷：短信模板页原来的"这是最后一个启用的验证码模板"确认弹窗仍是页面预判（`src/pages/sms/useLastOtpPrompt.tsx` 的 `useLastOtpPrompt`，`src/pages/sms/templates.tsx` 的 `isLast`、`src/pages/sms/TemplateModal.tsx` 的 `isLastOtpTemplate`），新的"英文、不限国家"规则没有预判。理由：旧规则的后端判断和 message 没变，弹窗是已定的现有行为；e2 只要求新规则"操作前不预判，后端裁决"。
2. 记录项：`GET /push/templates` 的响应在清单 a14 里是 `{items, missingLocales}`，没有 `total`，而页面表格（`src/pages/push/templates.tsx` 的 `PagedListTable`）和 `listAllTemplates`（`src/services/push/index.ts`）靠 `total` 分页。触发步骤：真后端的响应不带 `total` 时，`listAllTemplates` 会多请求一页直到读到空页才停（有"空页就停"的保护），表格的总数和页数则无法显示。假后端仍带 `total`（沿用 2026-10-26 问题文件第一节第 2 条的暂定做法）。建议：向后端确认是否保留 `total`；已有的问题文件 `docs/contract-requests/2026-10-26-admin-frontend-push.md` 覆盖了分页形状，需要后端回复时一并问。
3. 记录项：`src/pages/sms/templates.test.tsx` 里原有的"asks inline for a template that is not the last, and deletes with one request"在整批并行运行里失败一次（5.8 秒，默认 1 秒等待不够），单独跑通过。触发步骤：和 20 个左右的其他 vitest 进程同时跑。我新增的推送页面测试已把等待上限放到 6 秒；这条原有测试没有改。建议全部修：给它同样加等待上限。
4. 记录项（假后端）：`mock/push.mock.ts` 的 `PUT /push/templates/:id` 接受请求体里可选的 `locale`、`triggerReason`，只为能做出清单 a5 里"改语言、改原因"触发的第三种拒绝；页面从不发这两项。真后端是否接受还没有答复，已写进问题文件第四节。

## 变更（按业界通行做法自己定）

- 矩阵没有后端列表时显示中性的"没有模板"，不装作知道回退；有模板但停用的格子同时显示"未启用"和"回退到默认语言"，因为后端把停用的语言也列在 `missingLocales` 里。
- 被拒的文字统一为一句，三种情形不再分开（`data` 区分不出来；要分开需要后端给 `case`，见问题文件）。
- 短信的被拒文字只在 `ref` 为 `SmsTemplate`、`reason` 为 `OUT_OF_RANGE` 时出现，别的 400 照旧显示按码的通用文字。

## 需要改共享文件的地方

没有。

## 规格需要在 main 上修改的地方

没有新增（清单第 5.2 节已列：5.11 推送模板第 307 行、5.18 短信模板第 377 行、5.18a 邮件模板第 382 行的"五个模板"）。

## 问题文件

- `docs/contract-requests/2026-10-31-admin-frontend-push-default-language-case.md`（本区域新写）。

## 提交说明

本区域的文件里，`mock/sms.mock.ts`、`mock/sms.mock.test.ts`、`src/locales/en-US/sms.ts`、`src/locales/zh-CN/sms.ts` 同时有 authsys（短信渠道凭据）的未提交改动。我只暂存了属于我的改动片段提交；它们的片段留在工作区，不属于这次提交。

---

# 追加：评审（`backend-d1-msg-review.md`，对提交 e6a2ad9）之后的修复

立即修未修 0、记录项 1、未运行 0、阻塞 0

以上第一部分不改。这一部分对应评审的两条立即修和五条记录项。

## 评审立即修 1：响应没有 `total`

- 落实了什么：
  - `src/services/push/index.ts` 的 `listAllTemplates`：`total` 是数字时按它停；不是数字时，一页少于页大小就停，且一页里没有新 id 也停，每行只留一次；读到空页总是停。`src/services/push/types.ts`：`total` 改成可选。
  - `src/pages/push/templates.tsx`：表格的请求在答案没有 `total` 时改用 `listAllTemplates()` 读到的全部，自己切页，总数是读到的条数。
  - 假后端 `mock/_core/pushData.ts`、`mock/push.mock.ts`：可选模式 `pushState.templateList`（`with-total` 默认、`paged-without-total`、`unpaged-without-total`），只给测试用。
- 测试：`src/services/push/push.test.ts` 新增 5 条（分页但无 total 时读到短页为止、第一页就短只请求一次、不分页的后端返回整张表时请求数 ≤ 2 且每行一次、整页都是见过的行就停、`total` 是文字当作没有）；`src/pages/push/templates.test.tsx` 新增 2 条（45 条模板：分页的后端表格显示“第 1-20 条/总共 45 条”并能翻页、请求数 ≤ 8；不分页的后端请求数 ≤ 6）。
- 实现前的失败：服务测试因无限请求内存耗尽而崩溃（`FATAL ERROR: Ineffective mark-compacts near heap limit`）。
- 变异：去掉“短页就停”（3 条变红）；`total` 不判数字（`total: '99'` 的那条变红）；表格改回只用答案里的数（页面 1 条变红，输出 `mut2-1.txt`）。

## 评审立即修 2：整行“没有启用的模板”

- 落实了什么：`src/pages/push/coverage.ts` 的 `CoverageRow.noneEnabled`：后端对该原因列出了全部（至少一个）支持的语言时为真，此时该行没有格子标成回退（默认语言那格是该原因唯一能兜底的，不标）。`src/pages/push/TemplateMatrix.tsx` 在原因名旁加中性标签（`push.templates.matrix.noneEnabled`：“没有启用的模板” / “No enabled template”，测试标识 `row-none-<原因>`）。
- 测试：`src/pages/push/coverage.test.ts`（整行、部分列表、没有语言、没有列表）；`src/pages/push/templates.test.tsx`（示例数据里 `streak_at_risk` 整行标记，格子 `none`/`off` 且 `data-fallback="false"`；有一条启用的模板后标记消失、其他语言回退；`fr` 只在支持列表里时；中文显示“没有启用的模板”）。
- 变异：去掉 `locales.length > 0`、去掉“整行没启用就不标回退”、去掉矩阵里的整行标签，都变红。

## 记录项

- (a) 被拒文字写出做法，顶部写运营怎么用（`src/locales/{en-US,zh-CN}/push.ts`）：`push.templates.defaultLanguageRequired` 现在写：先启用默认语言的模板；要停用、删除或改掉它，先停用同一原因下其他语言的模板；它是唯一启用的模板时，保持它为默认语言并启用，另建其他语言的新模板。三种情形仅凭 `data` 分不出，所以一条文字写两种做法。中文里 `{reason}` 补成两次，和英文占位符数量一致（parity 里这一条修好）。新增 `push.templates.noteHowTo` 和页面顶部的说明段落（`src/pages/push/templates.tsx`，测试标识 `push-howto`），按计划 729 行写：第一条要启用的必须是默认语言、其他语言任意顺序、默认语言那条最后停、改 `push.default_locale` 之前先启用新语言的模板、往 `app.supported_locales` 加语言不用先动召回模板。测试：`recallRule.test.ts`、`templates.test.tsx` 里英文和中文各一条。
- (b) 短信页在拿掉“最后一个合格的英文验证码模板”之前提示（计划 846 行）：`src/pages/sms/lastOtp.ts` 新增 `isLastEnglishFallbackTemplate`、`keepsEnglishFallback`（启用、OTP、`en` 不分大小写、无国家；按页面读到的列表判断；没读到列表时按“是最后一个”问）。`src/pages/sms/templates.tsx`（停用开关、删除）和 `src/pages/sms/TemplateModal.tsx`（编辑后不再合格：改语言、加国家、改类型）先弹确认，更宽的“最后一个 OTP 模板”弹窗仍然先判。语言文字 `sms.guard.title.englishTemplate`、`sms.guard.intro.englishTemplate`（中英文）。后端仍是最终裁决，被拒后的按码文字照旧。原先我在报告里把“不预判”判成“不是缺陷”，评审指出计划相反；这里改为按计划做，该条原判作废。测试：`lastOtp.test.ts` 新增 5 条；`templates.test.tsx` 新增或改写 6 条（弹确认且取消不发请求、确认后后端拒绝、另有一个 `EN` 合格模板时不问、其余英文是 `en-GB` 或有国家时仍问、删除、给它加国家时问、只改名称并把语言写成 `EN` 时不问）。变异：`lastOtp` 去掉“无国家”条件（3 条变红）、去掉大小写折叠（3 条变红）；`templates.tsx` 去掉英文那一问（3 条变红）；`TemplateModal.tsx` 去掉编辑时的问（3 条变红）。
- (c) 被拒判断的 `ref`、`reason` 两个条件的测试：新文件 `src/pages/sms/templateFailure.test.ts`（9 条）：对 `country`、`smsType` 的普通 `OUT_OF_RANGE`、`SmsTemplate` 配 `EMPTY_NOT_ALLOWED`、设置键作 `ref`、没有 details、`details` 不是列表、别的错误码都不会被显示成“必须保留英文模板”的句子。变异：只判 `reason`（4 条变红）、只判 `ref`（2 条变红）。
- (d) 推送假后端“默认语言区分大小写”：`mock/push.mock.test.ts` 新增一条（默认语言 `en`，只有启用的 `EN` 模板的写入被拒；写成 `en` 后 `EN` 可以随后；`en` 停用而 `EN` 在时被拒）。变异：比较改成不分大小写，该条变红。
- (e) 短信页测试的等待上限：`src/pages/sms/templates.test.tsx` 每条测试前把异步等待上限放到 6 秒，之后还原（`configure({ asyncUtilTimeout })`），和推送那一组一致。

## 命令和结果

- 区域整批：`npx vitest run src/pages/push src/pages/email src/pages/sms mock/push.mock.test.ts mock/sms.mock.test.ts mock/email.mock.test.ts src/services/push src/services/email src/services/sms tests/noHardcodedText.test.ts src/locales`：33 个文件，1009 条通过（含禁止写死文字扫描和语言文件 parity 里我的部分）。
- `npx tsc --noEmit` 只看我的路径：无诊断；`npx biome check --write`：已通过。
- 真实浏览器（草稿目录拷贝，端口 8461，用完按监听进程号停了服务）：短信把 `otp_en` 的开关关掉，先弹确认，标题“This is the last enabled OTP template in English for every country”，说明手机号登录当前关闭、后端也会因手机号账号拒绝；取消后开关仍开、没有请求；再次确认后后端拒绝，提示是按码的英文文字，没有后端原文。推送矩阵：`streak_at_risk` 整行有“No enabled template”标签，格子是 `none`/`off`，没有“Uses default language”；`daily_recall` 全是“On”；关掉英文 `daily_recall` 的开关，提示写出两种做法，切到中文后同样；页面顶部有使用说明；控制台只有两次预期的 400。邮件模板第六项照旧。
- 变异输出：`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/msg/mut3-a.txt`、`mut3-b.txt`、`mut2-1.txt`。

## 记录项（这一轮新发现）

1. 记录项：`src/locales/*/reason.ts` 有别的代理在改，`src/locales/parity.test.ts` 的 `reason.<code>` 两条在满载的整批里曾失败，不是我的路径；本区域的整批 1009 条运行里已通过。触发步骤：别的代理的未提交改动落在 `reason.ts` 时跑 parity。
