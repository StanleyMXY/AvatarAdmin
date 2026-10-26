立即修 0、记录 10、变更 5、不是缺陷 8、阻塞 0

# 任务 28 评审：短信渠道、短信模板、发送记录、邮件模板（提交 49bea0c、6395ceb）

评审深度：凭据和个人数据专项，多轮、复现缺陷、变异检查。评审者没有改任何源文件，也没有提交；所有实验在 `git archive HEAD` 解出的拷贝里做（拷贝带 node_modules 链接和共享的 `src/.umi`），共享检出里 `git status` 对 sms、email 路径没有任何变化。脚本都以 `t28r-` 开头，放在评审者的临时目录 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/t28r/`（`t28r-mutate.py`、`t28r-muts.py`、`t28r-muts2.py`、`t28r-muts3.py`，输出 `mutate-run.out`、`mutate-run2.out`、`mutate-run3.out`，以及 `mytests/` 下的属性测试、模糊测试和泄露测试）。

没有发现需要立即修的缺陷：没有任何路径把已保存的凭据、验证码或自己算出来的号码显示出来，"最后一个启用的验证码通道"的判断与独立参照一致，权限按钮、写操作防重复、对话框只在打开时挂载、非字符串值都经得住实验。下面的 10 条记录项里 3 条是"变异后测试仍然全绿"的测试缺口，2 条是真实的小缺陷（邮件编辑框里保存和恢复默认可以同时在途；失败行用重复的 React key），其余是实现者已记录并经我确认的项目。

## 一、我跑了什么

| 项 | 方法 | 结果 |
|---|---|---|
| 基线 | 拷贝里 `npx vitest run src/pages/sms src/pages/email src/services/sms src/services/email mock/sms.mock.test.ts mock/email.mock.test.ts`，另外连续 3 次跑 channels、records、templates 三个页面测试 | 15 个文件 267 个测试全绿；三次重复各 80 个测试全绿，没有偶发失败 |
| 类型和 lint | 拷贝里整个项目 `npx tsc --noEmit`，只看 sms、email 路径；`npx biome check` 对本模块全部路径 | 本模块路径 0 个类型错误，biome 49 个文件无诊断 |
| 变异检查 | 在拷贝里改一处判断，跑本模块全部测试（`--bail 1`），确认是断言失败（脚本排除了语法错误和找不到模块），还原 | 实现者的 60 条里我复核了其中 36 条同类变异（M01 至 M35，含 M12a、M12b），另加我自己设计的 12 条（N01 至 N12）和 2 条假后端变异（P01、P02）：共 50 个变异，46 个变红；3 个存活（N01、N05、N09，见记录项 8、9、10）；1 个是等价变异（N12，我给一个固定的 key，行为不变，不算） |
| 独立参照的属性测试 | `mytests/t28r-lastotp.prop.test.ts`：随机生成 1 到 5 个通道（启用与否、验证码或营销类型、国家为空、`null`、缺失、含大小写和两端空白的重复国家码），参照实现用"逐国家加一个代表其它国家的哨兵"自己算，对比 `isLastOtpChannel` 与 `keepsCoverage`（各 20000 组），模板的 `isLastOtpTemplate` 2000 组 | 全部一致。我还把 `lastOtp.ts` 里的大写转换拿掉再跑，两个属性测试立刻变红，说明参照有牙齿 |
| 凭据空白模糊测试 | 对整个 Unicode 里"看起来像空白或不可见"的码点（White_Space、Cc、Cf、Zs、Zl、Zp、Default_Ignorable）逐个放进 `buildChannelBody` 的 `credentials` | 见下面 (a) |
| 泄露测试 | `mytests` 下：让假后端在列表行、详情、`PUT`、`POST` 的回复里夹带 14 种凭据形状，翻遍整个 DOM（`outerHTML`、文字、每个元素的每个属性、输入框当前值）、`sessionStorage`、`localStorage`、`console.*`、地址栏、请求日志 | 见下面 (a) |
| 乱形状测试 | 对四个页面的列表，把每个字段换成嵌套对象、数组、数字、布尔、`null`、带 `toString` 的对象六种形式，再点开第一行的编辑对话框 | 24 个用例都没有崩，也没有出现错误边界 |
| 整个仓库的文字扫描 | 在共享检出里只读地跑 `tests/noHardcodedText.test.ts` | 失败的 2 项指向别的实现者的文件（`src/pages/appVersions/storeUrl.ts:58`、`mock/notifications.mock.test.ts:103`），本模块路径没有命中 |
| 韩文、第三方名、禁用词 | 对两个提交的全部文件逐字符找谚文，对源码、假数据、问题文件找 Twilio、Vonage、Aliyun、dramaBox、Laaffric 等，对问题文件和报告找"工单""台账""阶段""里程碑" | 0 命中 |
| 语言文件 | 两种语言的键、占位符名称、en-US 里的中日韩字符 | 键相同、占位符相同、en-US 没有中日韩字符；语言文件里没有字面的 `{code}`、`{minutes}`、`{appName}`，唯一叫 `{code}` 的占位符是 `sms.channels.switchLabel` 和 `sms.templates.switchLabel` 里的通道或模板编码，传入的值就是编码，不会和验证码占位符混淆 |

没有运行的：真实浏览器（环境里没有 Playwright 和 Chromium，也不能起开发服务器，所以布局只能按 CSS 规则推断，见记录项 7）；真实后端；Firefox 和 Safari。

## 二、按任务书逐项（a）到（e）

### (a) 凭据只写不读

- 输入框永远是空的：`ChannelModal.tsx:172` 初值写死 `''`，`Input.Password`（`type=password`，`autoComplete="new-password"`，`visibilityToggle={false}`，第 271 行）。泄露测试里编辑每一行都读到 `value === ''`。
- 留空、只有空白：`channelRules.ts:80` 用 `trimSpec`，空则整个键不进请求体。我对所有"像空白"的码点做了模糊测试，**页面视为空白的恰好是契约 §1.9 的 29 个码点**：U+0009 到 U+000D、U+001C 到 U+0020、U+0085、U+00A0（不换行空格）、U+1680、U+2000 到 U+200A、U+2028、U+2029、U+202F、U+205F、U+3000（全角空格）。只含这些的输入，请求体里没有 `credentials` 这个键。**零宽空格 U+200B、U+FEFF、U+2060、U+180E、U+200C、U+200D、U+00AD、方向控制符以及 NUL 等控制字符不算空白**：只输入其中一个，请求体里会是 `credentials: "​"`，也就是把保存的凭据改成这个不可见字符。这与契约 §1.9 的定义一致（后端用 Python `str.strip()` 的集合，U+200B 也不在里面），所以按"不是缺陷"处理（下面不是缺陷 1）。两端的空白会被去掉：`'  abc  '` 发 `"abc"`，中间的空格保留。
- 任何地方都不显示：泄露测试给列表行、`GET` 详情、`PUT`、`POST` 的回复都夹带了 `accessKeySecret`、`access_key_secret`、`apiSecret`、`api_secret`、`token`、`password`、`authKey`、`privateKey`、`secret`、`x-api-key`、`credentialsEnc`、嵌套的 `credentials: {key, nested: {deeper}}`、数组 `credentialList`、`extra: {auth: {token}}`，值里都带标记串。页面读列表、逐行点开编辑、输入新凭据保存、再关闭，每一步之后翻整个 DOM（文字和所有属性和输入框当前值）、`sessionStorage`、`localStorage`、`console.*`、地址栏，都找不到标记串。页面只读 `hasCredentials`（`channels.tsx` 凭据列），其它凭据字段没有任何代码读。
- 请求侧：编辑时请求体只有 `name`、`providerCode`、`apiUrl`、`extConfig`、`countries`、`smsType`、`priority` 加输入了才有的 `credentials`；启用开关的请求体是 `{enabled}`，测试发送的请求体是 `{mobile}`（`services/sms/index.ts`）。输入的凭据只出现在对应的 `PUT`、`POST` 请求里。
- 失败后的错误文字：故意让后端的 `message` 和字段明细的原因码里夹带标记串，页面只显示 `error.INVALID_REQUEST` 的译文和（原因码没有译文时的）通用句，标记串不出现。
- 保存失败后输入的凭据：留在密码框里（DOM 里是 `type=password` 输入框的 `value`，因为 antd 的表单仓库在对话框打开期间保存它，好让用户改正别的字段后重试）；关掉对话框就随组件卸载，再打开是空的。按"不是缺陷 2"处理。
- 扩展配置的文本框会显示后端给的 `extConfig`（`ChannelModal.tsx` 的 `extConfigText`）：规格写扩展配置含 `appId` 和发送方 ID，属于非凭据，只有持有 `SMS:CHANNEL:CONFIG` 的管理员能打开这个对话框；这个"凭据永不回显"依赖后端不把凭据放进 `extConfig`，问题文件第一节第 1 条已经问了"供应商需要两三个凭据时形状怎样"（不是缺陷 7）。

### (b) 号码与验证码

- 号码列只做 `orDash(row.mobile)`（`records.tsx:152`），页面不掩码也不解码；变异 M04（页面自己掩成后四位）、N10（权限码写成小写）都被测试打红。`seesPhone`（第 100 行）**只用来决定要不要在表格上方写"号码已打码"的说明**（第 318 行），从来不影响号码的值；大小写敏感由共用的 `canAccess` 精确匹配，号码的真假完全由后端决定（不是缺陷 4）。
- 没有"查看验证码"：对 `src/pages/sms`、`src/pages/email`、`src/locales/*/sms.ts`、`email.ts` 搜 `验证码`、`verification`、`otp`、`viewCode`、`reveal`、`unmask`，命中的只有通道、模板的类型名"验证码（OTP）"和"发验证码只用 OTP 通道"这类说明；记录页只有 `contentRedacted`（后端已替换成 `****`）。没有任何导出列的定义在前端（导出由后端生成）。
- 验证码走推送的行：供应商消息 ID 和送达状态列在 `row.channel === 'PUSH'` 时一律是"—"，不管后端给了什么（`records.tsx:141-146` 与送达状态列）；变异 M05、M06 变红。
- 导出：`ExportButton` 的 `requiredCodes={['SMS:RECORD:EXPORT','SMS:RECORD']}`（`records.tsx:313`），变异 M07 变红；导出参数是最近一次点"查询"的筛选（`records.tsx:106`），变异 M30 变红。

### (c) 最后一个启用的验证码通道、模板

- 契约 §23.4：删除、停用，或改 `smsType`、`countries` 使它不再是最后一个覆盖的启用 `OTP` 通道时，若 `auth.phone_login_enabled=true` 或存在手机号账号，后端返回 `INVALID_REQUEST`；模板同理，不能停用或删除最后一个启用的 `OTP` 模板。页面的判断是逐国家的（空国家表示全部国家），读不到全部通道时一律当作最后一个，只决定"要不要先问"，后端有最后决定权。这比"整个系统只剩一个"的读法问得更多，不会少问：凡是后端按"只剩一个"拒绝的情形，页面也会先问。
- 属性测试（上面）显示 `isLastOtpChannel`、`keepsCoverage`、`isLastOtpTemplate` 与独立参照在 4 万多组随机输入上完全一致，覆盖：国家为空、`null`、缺失、重复国家码、大小写和两端空白不同的国家码、停用的通道、营销类型的通道、同一国家多个通道。
- 操作入口：开关停用（`channels.tsx` 开关列）、行内删除、编辑里改类型或国家（`ChannelModal.tsx` 提交前）、模板改类型（`TemplateModal.tsx`）。取消就什么都不发（变异 M10 变红）；读不到全部通道时先问（`channels.tsx:71` 起的 `isLast`，`all === null` 返回 `true`）。
- `auth.phone_login_enabled` 的读取（`useLastOtpPrompt.tsx:18`）：读到布尔值就写"已开启/已关闭"，读不到（没有 `CONFIG:MANAGE` 时 `GET /config` 不返回该键，契约 §17.4 写明不返回 403；请求失败；值不是布尔）一律写"读不到"；三种情况都写明"存在手机号账号时后端同样拒绝，本页看不到有没有"。变异 M13（不读）变红。`GET /config` 不返回 403，所以不会触发共用层的"没有权限"提示。
- 被拒绝后的说明：删除、停用启用中的验证码行失败时，译文后面加一句固定的"什么都没有改变，……后端拒绝"（M29 变红）；但**行内确认的删除路径**（`channels.tsx:105`、`templates.tsx:97`）把说明的开关拿掉，所有测试仍然通过（变异 N05 存活，见记录项 9）。

### (d) 邮件模板

- 必含占位符：`placeholders.ts` 用 `body.includes(原样字符串)` 在正文里找，区分大小写、不去花括号（变异 M19、M35、N08 变红）；`code`、`{CODE}`、`{ code }` 都报缺 `{code}`，缺失的原样带花括号写在文字里，缺一个就写那一个。数组缺失或不是数组时不检查，交给后端。
- 标题 1 到 200 个码点按去空白之后计（变异 M20a 变红）；默认文案在编辑框里一直显示；没改过时"恢复默认"灰掉并说明（M21 变红）；改过的点一下行内确认再发 `POST …/reset`；后端多返回的模板码照样显示和编辑（既有测试）；顺序取后端（N11 变红）。
- 路由权限码 `EMAIL:TEMPLATE`（M23 变红），邮件模板的三个写操作都用同一个码，所以没有逐个按钮的权限差别。
- 未保存的编辑在"取消"和"恢复默认"时直接丢掉，不问：取消本来就是放弃，恢复默认是替换，确认问句已经说明"为这个模板保存的文字会被替换"（不是缺陷 3）。
- 缺陷：编辑框里"保存"和"恢复默认"可以同时在途（记录项 5）。

### (e) 其它

- 按钮权限：渠道页写操作和测试发送都由 `canConfig` 一个值控制（`channels.tsx:46`）；没有 `SMS:CHANNEL:CONFIG` 时没有"新建通道"、没有行内按钮、开关灰掉并写"只读"提示（M22 变红）。模板页和邮件页只有一个权限码。记录页的导出要 `SMS:RECORD:EXPORT` 加 `SMS:RECORD`。
- 测试发送：剩余次数在对话框打开时读，后端没给、给负数、非有限数一律是 `null` 显示"—"，小数向下取整（`services/sms/index.ts` 的 `getSmsMeta`，变异 M18 变红）；为 0 时发送按钮灰掉并有警告（M17 变红）；429 后重读（N02 变红）；号码去两端空白再发（M32 变红）；发送后关闭对话框，号码输入框随组件卸载。
- 写操作防重复：创建、编辑（渠道、模板）、测试发送、开关（M24 变红）、行内删除、导出都经 `useSingleFlight`；唯一的漏洞是邮件编辑框里保存与恢复默认之间（记录项 5）。
- 过期的答案：`useServerPage` 和 `useLatestRead` 只收最新一次读（M25 变红）。
- 对话框只在打开时挂载：渠道（新建、编辑、测试发送）、模板、邮件编辑框都是 `x !== null ? <Modal/> : null`；我实际做了"编辑 A，改名并输入凭据，取消，编辑 B"和"编辑模板，取消，新建模板"，第二个对话框里都是干净的值（不是任务 27 的复用缺陷）。
- 非字符串值：见上面乱形状测试，24 个用例不崩。
- 语言：en-US 与 zh-CN 键和占位符一致；表格里无空格的长串：名称、内容、失败原因用 `EllipsisPopoverText`，几个编码列没有（记录项 7）。
- 后端的 `message` 不外泄：对 `src/pages/sms`、`src/pages/email`、`src/services` 搜 `.message`，没有任何命中；`failureToForm` 把字段明细换成 `reason.<原因码>` 的译文，没有译文时写"输入内容不合法"；邮件页、记录页、导出都走译文。共用的 `describeError`（`src/request/errors.ts:76-81`）只在错误码没有译文时才拼上后端的 `message`，本模块的接口会返回的码（`INVALID_REQUEST`、`DUPLICATE_RESOURCE`、`RESOURCE_NOT_FOUND`、`RATE_LIMITED`、`PHONE_INVALID`、`SMS_SEND_FAILED`、`ADMIN_FORBIDDEN`、`EMAIL_SEND_FAILED`、`INVALID_STATE`）我逐个确认都在 `error.ts` 里有译文。
- UTC：筛选把所选的 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`（`utils/utcDay.ts` 的 `utcDayRangeToInstants`），`DateRangeUtc` 不允许清空；页面写明是 UTC。

## 三、规格 5.18、5.18a 与任务书逐句核对

渠道：列（渠道编码、名称、供应商、服务的国家、优先级、启用开关、是否已配置凭据）全有，多一列"类型"（变更 5）；表单的十个字段（编码、名称、供应商、接口地址、凭据、扩展配置、国家、类型、优先级、启用）全有，"启用"只在创建里（变更 1）；供应商下拉和主机白名单来自 `GET /sms/meta`；创建后编码只读；测试发送按钮和弹窗（固定文案、剩余次数）有；删除、停用前的提示有。模板：八列、七个表单字段加启用、顶部的选模板规则说明、`{code}` 实时校验、可用占位符 `{code}`、`{minutes}`、`{appName}` 都有。记录：十个筛选、十四列（消息 ID、供应商消息 ID、号码、国家、用途、投递渠道、通道、发送状态、送达状态、是否已使用、失败原因、正文、创建时间、发送时间）、没有"查看验证码"、导出按钮、导出进度（共用按钮显示已收到的字节数）。邮件：列表（编码、标题、是否改过、最后修改人、时间）、编辑页（标题 1 到 200、正文、可用占位符和必含项、默认文案、恢复默认）都有。没有发现规格或任务书写了而页面没有的元素。唯一的措辞差别是导出按钮的文字（记录项 3）。

## 四、发现

### 记录（10）

1. `src/pages/sms/{useServerPage.ts,PagedTable.tsx,FailureBar.tsx,texts.ts,useLatestRead.ts,StatusSwitch.tsx,formFailure.ts}` 和 `src/pages/email/{FailureBar.tsx,texts.ts,useLatestRead.ts,formFailure.ts}`：来自广告、投放模块的同名文件的本地副本。触发：共用的失败文字、分页、开关处理以后改了，副本不跟着变。结果：同一件事在不同模块表现不同。实现者的记录 1，我确认分类不变。
2. `src/pages/sms/ChannelModal.tsx` 的扩展配置文本域没有用 `JsonField`（`JsonField` 不接收表单传来的 `id`）。触发：在扩展配置框里写不是 JSON 的文字。结果：错误文字是本模块自己的"扩展配置不是合法的 JSON"，其它页面是共用的"JSON 格式不对"。实现者的记录 2，确认。
3. `src/pages/sms/records.tsx:310-314`（`ExportButton`，共用的按钮文字 `pages.export.button`）：规格写"导出 Excel"，按钮写"导出"。触发：持有 `SMS:RECORD:EXPORT` 的管理员打开发送记录页。结果：文字与规格不同，功能一致。实现者的记录 3，确认；要改的是共享文件，写在报告的"需要改共享文件"里。
4. `src/pages/sms/lastOtp.ts`（`uniqueCoverage`、`isLastOtpChannel`、`keepsCoverage`）：页面按契约文字逐国家算"最后一个"，假后端（`mock/sms.mock.ts:66-98`）用的是同一个读法，所以全部页面测试对着假后端通过并不能证明和真后端一致。触发：后端的算法不同（例如只在整个系统只剩一个启用验证码通道时才拒绝，或按 `sms.allowed_country_codes` 算）。结果：页面在后端不拒绝的操作前多问一次；反过来后端拒绝而页面没问时，删除和停用仍带固定说明，改类型或国家时没有说明，用户只看到"输入内容不合法"。我的属性测试证明代码实现了这个读法，没有证明这个读法就是后端的。实现者的记录 4（问题文件第一节第 11 条），确认。
5. `src/pages/email/TemplateEditor.tsx:66`（`restore`）、`:87`（"提交"按钮 `disabled: pending`，只看保存的状态）、`:88`（"取消"同）：恢复默认在途时"提交"和"取消"仍然可用。**已复现**：打开一个改过的模板，点"恢复默认"、确认（请求被扣住），再点"提交"，两个写请求都发出（`POST …/reset` 和 `PUT …/email/templates/REGISTER_CODE`，我的实验输出 `writes started: 2`）。反过来保存在途时恢复默认是灰的（`:215` 的 `|| pending`），所以不对称。结果：两个写入到达后端的先后不定，最终的模板可能是用户编辑过的文字，而界面已经提示"已恢复默认文字"并关闭；恢复在途时点"取消"关闭对话框后，成功提示仍会弹出。修法：恢复在途时同样禁用"提交"和"取消"。
6. `src/pages/sms/ChannelModal.tsx:367`、`src/pages/sms/TemplateModal.tsx:247`、`src/pages/email/TemplateEditor.tsx:183`：失败条里把未归到字段的明细逐行渲染，用文字本身做 `key`。**已复现**：渠道编辑时 `PUT` 返回 400 `INVALID_REQUEST`，`details` 里三个页面不认识的 `ref`、三个没有译文的原因码，页面显示三行一样的"输入内容不合法"，控制台出现 React 的"两个子元素同一个 key"警告（可能导致重复或丢行）。结果：用户看到三行相同的话，对修正没有帮助，开发时有警告。修法：用位置加文字做 key，并把相同的行合并。
7. 编码类的列没有宽度上限，只靠 `overflowWrap: 'anywhere'`：`channels.tsx:122、134`，`templates.tsx:113、147`（模板编码、供应商模板编号），`records.tsx:136、145、152、186`，`email/templates.tsx:41`。表格设了 `scroll={{ x: 'max-content' }}`，宽度取内容的最大宽度，`overflow-wrap` 只影响最小宽度。触发：某个模板编码或供应商模板编号是 5000 个无空格字符（表单对模板编码和供应商模板编号没有长度限制，后端是否限制契约没写）。结果（按 CSS 规则推断，未在浏览器里量）：该列极宽，表格在自己的容器里横向滚动，其余列和操作列被推得很远，页面本身不横向滚动。名称、内容、失败原因、正文已经用 `EllipsisPopoverText`。
8. `src/pages/sms/ChannelModal.tsx:271` 的 `visibilityToggle={false}` 没有测试守着：把它改成默认值（凭据框右边出现"显示"眼睛图标），本模块全部测试仍然通过（变异 N01 存活）。触发：以后有人去掉这个属性。结果：写入专用的密码框可以显示用户自己输入的文字（不是已保存的凭据，因为框永远是空的，所以不是泄露，但与实现者报告里"没有显示按钮"的说法不符，也无人守护）。
9. `src/pages/sms/channels.tsx:105`、`src/pages/sms/templates.tsx:97`（行内确认的删除路径，`remove(row, servesCodes(row))`）：把第二个参数改成 `false`（不加"什么都没有改变……"这句说明），全部测试仍然通过（变异 N05 存活，模板那一处我没单独变异，写法相同）。触发：删除一个启用中的验证码通道（不是最后一个）被后端拒绝。结果：现在用户看到译文加说明；没有测试时回归会悄悄退成只有"输入内容不合法"。
10. `src/pages/email/TemplateEditor.tsx:54`（`body: trimSpec(values.body)`）：改成不去空白，全部测试仍然通过（变异 N09 存活）；对应的标题（M28）有测试。触发：正文两端有空白时保存。结果：契约通则 4 规定后端存去掉空白后的值，所以今天没有可见的错误结果；回归后请求体与契约约定的不同，没有测试发现。

### 变更（5，已经实现，需要负责人确认）

这五项实现者已在报告的"变更候选"里列出，CLAUDE.md 要求先把关键设计点交给负责人确认；代码里已经是这样做的，我确认这些行为确实存在：

1. 渠道和模板的"启用"只在创建对话框里，新建默认停用；编辑只能用列表里的开关（`ChannelModal.tsx`、`TemplateModal.tsx` 的 `editing ? null : <Switch/>`）。后果：新建的验证码通道或模板在手动打开开关之前不会被选中；好处是停用不会绕过操作前的提示。
2. 渠道编码页面只接受字母、数字、连字符、下划线，1 到 64 个字符（`ChannelModal.tsx` 的 `CODE_FORMAT`）。后果：后端若允许别的字符（比如点），页面会拦住合法编码。
3. 改模板类型也先问（`TemplateModal.tsx`）；契约只写停用和删除。后果：后端不拒绝时多问一次。（渠道改类型或国家先问是契约的明文。）
4. 发送记录默认只读最近 7 个 UTC 日，日期选择器不可清空（`records.tsx` 的 `DEFAULT_DAYS`，`DateRangeUtc` 的 `allowClear={false}`）。后果：用消息 ID 或号码查一条 7 天前的记录，必须先把日期拉宽；记录保留 30 天。
5. 渠道列表多一列"类型"（规格 5.18 没列）。后果：无功能影响，是规格之外的一列。

### 不是缺陷（8）

1. 零宽空格、U+FEFF 等不可见字符单独作为凭据会被发送（`channelRules.ts:80`，`utils/trimSpec.ts:5-17`）：页面对"空白"的定义就是契约 §1.9 的 29 个码点，后端用同一个集合；要让这条出错，管理员得在密码框里恰好只粘贴一个不可见字符，且这个字符按契约本来就不算空白。
2. 保存失败后输入的凭据还在密码框里（`ChannelModal.tsx` 的 antd 表单仓库）：是为了让用户改正别的字段后重试；对话框关闭即卸载（我的实验：关闭后再打开凭据框是空的，DOM 里没有这串字符）；框是 `type=password`，页面其它任何地方都不出现它。
3. 邮件编辑框里取消或恢复默认时丢掉未保存的输入（实现者的记录 5，我改判）：取消的意思就是放弃，恢复默认的确认句说明会替换；`mask={{ closable: false }}` 已经防住误点遮罩；项目里没有"关闭前问是否保存"的统一约定（只有审核规则页自己有）。
4. 号码说明用 `canAccess('SMS:RECORD:PHONE_VIEW')` 决定要不要写（`records.tsx:100、318`）：只影响一句说明，不影响号码本身；权限码精确匹配是共用层的行为。
5. 导出用最近一次"查询"的筛选而不是输入框里还没提交的值（`records.tsx:106`）：导出内容与表格一致；变异 M30 证明有测试守着。
6. 记录表格里的时间按浏览器时区显示，而筛选按 UTC 日（`utils/format.ts:7-19`）：这是全项目共用的格式函数（任务 2 的约定），页面在筛选旁边写明了"按 UTC 日"。
7. 编辑框会显示后端给的 `extConfig`（`ChannelModal.tsx` 的 `extConfigText`）：规格明写扩展配置是 JSON、含 `appId` 和发送方 ID，不是凭据；只有持有写权限的管理员能打开；凭据是否会被放进去取决于后端，问题文件第一节第 1 条已经问了。
8. 共用的 `describeError`（`src/request/errors.ts:76-81`）在错误码没有译文时拼上后端的 `message`：这是共用层的行为，本模块会遇到的错误码都有译文（见上），页面自己的代码里没有任何路径读取 `.message`。

### 阻塞（0）

没有。契约没写的地方都已经写进 `docs/contract-requests/2026-10-26-admin-frontend-sms-email.md`，当前做法是最小可继续的做法。

## 五、变异检查明细

实现者报告里的 60 条，我复核了同类的 36 条，另加 14 条自己的。判断是"改一处判断，只看测试是否变红"：

变红（46）：M01 凭据框用后端的值填充、M02 空凭据发空键、M03 只有空白也当作输入、M04 页面自己掩号码、M05 推送行显示供应商消息 ID、M06 推送行显示送达状态、M07 导出不要导出权限、M08 开关停用从不问、M09 每个启用的验证码通道都问、M10 取消了还是发请求、M11 覆盖算法不看国家、M12a 改国家丢掉覆盖时不问、M12b 改类型丢掉覆盖时不问、M13 不读 `auth.phone_login_enabled`、M14 模板停用从不问、M15 `{code}` 不区分大小写、M16 营销类型也要 `{code}`、M17 次数为 0 时不灰掉发送、M18 次数为负数照样显示、M19 占位符去掉花括号再比、M20a 标题按 UTF-16 单元计数、M21 没改过的模板也能恢复默认、M22 没有配置权限也有写按钮、M23 邮件路由权限码换掉、M24 开关连按发两次、M25 列表旧答案盖新答案、M26 号码说明永远不写、M27 渠道编码重复不拦、M28 邮件标题不去空白、M29 拒绝后不说明、M30 导出用没提交的筛选、M31 凭据标签反过来、M32 测试发送号码不去空白、M33 非验证码通道也走覆盖计算、M34 国家码不转大写、M35 邮件必含检查不区分大小写；N02 429 后不重读次数、N03 模板改类型不问、N04 模板删除从不问、N06 国家码不转大写（创建）、N07 接受 http 地址、N08 邮件缺必含项不检查、N10 权限码写成小写、N11 邮件列表自己排序；P01 假后端不拦最后一个通道、P02 假后端更新时清空凭据。

存活（3）：N01 凭据框恢复显示按钮（记录项 8）、N05 行内删除不加说明（记录项 9）、N09 邮件正文不去空白（记录项 10）。等价（1）：N12。

## 六、覆盖的语言

界面只有 zh-CN 和 en-US。我的泄露、乱形状、重用实验跑在 en-US 界面上；假数据与测试沿用实现者的七种语言（泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，含 5000 个泰文字符和 emoji 标题）。语言文件的两边键和占位符一致用脚本检查过。浏览器里的 zh-CN 表头只信实现者报告，没有复核。

## 七、需要负责人决定的事

- 变更 1 到 5 要确认，其中变更 2（渠道编码格式限制）和变更 4（默认只读 7 天）会让一部分管理员看到与后端不一致的行为。
- 记录 5 和 6 是真实的小缺陷，建议与其它记录项一起在一批里修；记录 8、9、10 是补测试，不改行为。
