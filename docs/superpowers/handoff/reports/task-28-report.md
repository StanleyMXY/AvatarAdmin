立即修未修 0、记录项 5、未运行 4、阻塞 0。

# 任务 28 报告：短信管理与邮件模板

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：`49bea0c`（服务、假后端、四个页面、路由、文字、测试、问题文件）、本报告所在的提交（自检后的修正：删除和停用被拒绝时一律说明原因、几条测试补强、报告）。本模块 17 个测试文件共 277 个测试；加上语言文件的两边键一致检查、文字扫描、菜单和页面清单检查，一次跑 23 个文件 704 个全部通过。整个项目的 `npx tsc --noEmit` 0 个错误，`npx biome check` 对本模块路径没有诊断。没有 `hardcodedText.allow.json`（文字扫描没有需要放行的条目）。

## 做了什么

四个页面，路由取规格 5.0"短信管理"三行和"邮件模板"一行，菜单文字两种语言都有：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/sms/channels` 渠道 | `SMS:CHANNEL`（写和测试发送要 `SMS:CHANNEL:CONFIG`） | 列：编码、名称、供应商、类型、国家（空写"全部国家"）、优先级、启用开关（立即发 `PUT …/enabled`）、凭据（只有"已设置/未设置"标签）；页面顶部两条说明（怎样选通道、凭据只写不读）；新建和编辑对话框；测试发送对话框；删除（行内确认）；没有写权限的管理员看到只读提示、灰掉的开关、没有任何按钮 |
| `/sms/templates` 模板 | `SMS:TEMPLATE` | 页面顶部写明选模板的规则；列：编码、名称、类型、语言、国家、内容、供应商模板编号、启用开关；新建、编辑、删除 |
| `/sms/records` 发送记录 | `SMS:RECORD`（完整号码要 `SMS:RECORD:PHONE_VIEW`，导出要 `SMS:RECORD:EXPORT` 和 `SMS:RECORD`） | 十个筛选（消息 ID、供应商消息 ID、号码、投递渠道、通道、用途、发送状态、送达状态、是否已使用、UTC 日期范围，默认最近 7 天）；十四列；号码原样显示后端给的串；导出按钮 |
| `/email/templates` 邮件模板 | `EMAIL:TEMPLATE` | 列表（模板编码加说明、标题、已修改/默认、最后修改人和时间，顺序取后端）；编辑对话框（标题 1 到 200 个字符并计数、正文、后端给的可用占位符和必含占位符、实时检查、默认文案、恢复默认） |

渠道、凭据：
- 凭据框永远是空的（`type=password`、`autoComplete="new-password"`、没有显示按钮），不管后端的回复里有什么；编辑时留空（或只有空白）请求体里**没有** `credentials` 这个键；输入了才带一次，去掉首尾空白。页面只读 `hasCredentials` 这一个字段，列表、悬浮提示、标题、对话框、失败提示里都不会出现别的凭据字段（测试让假后端在回复里夹带 `credentials`、`credentialsEnc`、`apiSecret`、`accessToken`、`secret`、`password`，整个页面的 HTML 里都找不到）。
- 供应商下拉来自 `GET /sms/meta`；选了供应商后，接口地址下面写明它允许的主机；地址必须 https、主机在名单里、不带用户名密码。
- 测试发送：对话框打开时读 `GET /sms/meta`，显示"今天还能测试发送的条数"（不会是负数或小数，后端没给就显示"—"）；为 0 时发送按钮灰掉；429 后重新读次数；号码输入框是对话框自己的，发送后关闭，号码不留在页面上。
- 最后一个启用的验证码通道（契约 §23.4，`auth.phone_login_enabled` 为真**或存在手机号账号**）：停用、删除、改类型、改国家使它不再是最后一个覆盖的启用验证码通道之前，页面先问。页面读全部通道，按国家算（一个启用的验证码通道只要有一个国家没有别的启用的验证码通道覆盖就算最后一个，空国家表示全部），读不到全部通道时一律当作最后一个。问的时候现读 `GET /config` 的 `auth.phone_login_enabled`：读到就写"已开启/已关闭"，读不到（没有 `CONFIG:MANAGE`）写"读不到"；三种情况都写明"存在手机号账号时后端同样拒绝，本页看不到有没有"。确认后请求照发，后端拒绝时显示 `INVALID_REQUEST` 的译文，后面加一句固定的"什么都没有改变……"。取消则什么都不发。
- 模板同理：最后一个启用的验证码模板的停用、删除、改类型先问。

模板：内容里验证码（OTP）类型缺 `{code}` 时输入时就报错并且不能保存，`code`、`{CODE}`、`{ code }`、`{Code}`、少一个花括号都不算；改成营销类型错误消失；可用占位符 `{code}`、`{minutes}`、`{appName}` 写在输入框下面；编码创建后只读；已有的编码在发请求前就被拦住。

邮件模板：占位符和必含占位符全部取后端的 `placeholders`、`requiredPlaceholders`，原样带花括号显示；保存前用数组里的原样字符串在正文里找（区分大小写，不去花括号，不折叠大小写），缺的按顺序写出来（缺一个就只写那一个）；页面里没有任何模板编码对应的规则；后端多返回一个页面不认识的模板编码，照样显示、可编辑；"恢复默认"：编辑框里一直显示默认标题和默认正文，没改过时按钮灰掉并说明，改过的点一下行内确认再发 `POST …/reset`；标题按去首尾空白后的码点数计（emoji 算一个）。

文件：
- 服务：`src/services/sms/{index,types,sms.test}.ts`、`src/services/email/{index,types,email.test}.ts`
- 页面：`src/pages/sms/` 下 `channels`、`templates`、`records`，对话框 `ChannelModal`、`TestSendModal`、`TemplateModal`，纯函数 `channelRules`（地址检查、国家码、请求体）、`templateRules`、`lastOtp`（最后一个验证码通道或模板怎么算），`useLastOtpPrompt`（操作前的提示和失败文字）、`StatusSwitch` 以及本地的小件（见记录项 1）；`src/pages/email/` 下 `templates`、`TemplateEditor`、`placeholders` 以及本地的小件；各自的测试和 `testSetup.ts`
- 假后端：`mock/sms.mock.ts`、`mock/email.mock.ts`、`mock/_core/smsData.ts`、`mock/_core/emailData.ts`（状态挂在 `globalThis`，`resetSmsStore`、`resetEmailStore` 重置）及两个测试文件。通道的凭据假后端存着，任何回复都不带；供应商名字是编的（`gateway-a`、`gateway-b`、`test-stub`）
- 路由和文字：`config/routes/{sms,email}.ts` 及测试、`src/locales/{zh-CN,en-US}/{sms,email}.ts`
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-sms-email.md`

## 与任务书和规格的出入

1. **后端的 `message` 一律不显示**（负责人的决定：错误码已知时只显示译文）。任务书写"原样展示后端文字"（通道、模板的 `INVALID_REQUEST`）和"在表单下展示 `message`"（邮件模板），这里改成译文：`INVALID_REQUEST` 的译文是"输入内容不合法"，看不出原因，所以通道和模板的删除、停用被拒绝时，译文后面加一句固定的说明（什么都没有改变，手机号登录开启或存在手机号账号时后端会拒绝）；邮件模板靠保存前的检查指出缺哪个。字段明细里后端的原因码没有译文时，字段下写"输入内容不合法"，不显示后端的话。
2. 渠道和模板的"启用"开关只在**创建**对话框里（默认关），编辑对话框没有：编辑用列表里的开关（`PUT …/enabled`），这样停用不会绕过操作前的提示。
3. 渠道列表比规格多一列"类型"。
4. 渠道编码页面只接受字母、数字、连字符、下划线，1 到 64 个字符（它进回调路径，见问题文件）。
5. 邮件模板的标题和正文发出去前去首尾空白（契约通则 4：后端存去掉空白后的值），正文去空白后不能为空。
6. 页面对"改模板类型"也先问（契约只写停用和删除），后端不拒绝时只是多问一次。
7. 没有直接用共用的 `JsonField`：它不接收表单传来的 `id`，在 `Form.Item` 里标签关联不上；扩展配置框用自己的文本域加同样的检查（见记录项 2）。
8. 导出按钮的文字是共用控件的"导出"，规格写"导出 Excel"（见记录项 3）。

## 红到绿

先写测试，确认因"功能不存在"而红（`Failed to resolve import …` 或路由数组为空），再实现，再绿。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task28/`：`red-base.txt`（服务、假后端、路由、纯函数）、`red-pages.txt`（六个页面测试和文字检查）、`green-all-*.txt`、`final-run.txt`。

| 文件 | 红 | 绿 |
|---|---|---|
| `src/services/sms/sms.test.ts` | `Failed to resolve import "./index"` | 11 |
| `src/services/email/email.test.ts` | `Failed to resolve import "./index"` | 4 |
| `mock/sms.mock.test.ts` | `Failed to resolve import "./_core/smsData"` | 49 |
| `mock/email.mock.test.ts` | `Failed to resolve import "./_core/emailData"` | 13 |
| `config/routes/sms.test.ts`、`email.test.ts` | 路由数组为空，3 + 4 个断言失败 | 5、5 |
| `src/pages/sms/lastOtp.test.ts`、`channelRules.test.ts`、`templateRules.test.ts` | `Failed to resolve import "./lastOtp"` 等 | 12、8、4 |
| `src/pages/email/placeholders.test.ts` | `Failed to resolve import "./placeholders"` | 6 |
| `src/pages/sms/channels.test.tsx`、`channels.form.test.tsx`、`channels.testsend.test.tsx` | 三个都是 `Failed to resolve import "./channels"` | 25、30、11 |
| `src/pages/sms/templates.test.tsx` | `Failed to resolve import "./templates"` | 31 |
| `src/pages/sms/records.test.tsx` | `Failed to resolve import "./records"` | 24 |
| `src/pages/email/templates.test.tsx` | `Failed to resolve import "./templates"` | 32 |
| `src/pages/sms/messages.test.ts` | 2 个失败（语言文件还是空的） | 7 |

最终一次：`npx vitest run src/pages/sms src/pages/email src/services/sms src/services/email mock/sms.mock.test.ts mock/email.mock.test.ts config/routes/sms.test.ts config/routes/email.test.ts src/locales tests/noHardcodedText.test.ts config/menus.test.ts src/pages/pages.test.tsx` → 23 个文件 704 个测试全部通过（`final-run.txt`）。

写测试和实现时测试自己找到的问题：
- 语言文件里 `{code}` 被当成占位符，提示里的 `{code}` 没有显示出来：改成 `{required}`，值传 `'{code}'`，并加了 `messages.test.ts`（每条文字都能解析并填空，含用占位符名称写 `{code}` 的几条）。
- 确认框（`modal.confirm`）把标题在 DOM 里写两遍：测试改成取全部。
- 旧答案测试偶发失败（三次，之后连续 30 多次通过）：原因是慢的读还在路上时表格被灰掉（`pointer-events: none`），第二次点击有时点不进去；第二次按键改成发事件，已稳定。
- 全量并行时页面测试默认 5 秒不够：六个页面测试文件开头 `vi.setConfig({ testTimeout: 30000 })`。
- 测试源码里工具把 `　` 写成了真正的全角空格，被文字扫描抓到：改成 `String.fromCharCode(0x3000)`。

## 真实浏览器检查

Playwright（Chromium，浏览器时区 `Pacific/Auckland`，en-US，然后 zh-CN）对着 `PORT=8328` 的 `npm run dev:mock`，在 `scratchpad/task28/app` 的一份拷贝里跑（拷贝里的 `config/config.ts` 关了 MFSU、换了缓存目录，`node_modules` 是链接，`src/.umi` 一起复制）。脚本 `t28-browser.cjs`、日志 `t28-browser.log`、截图 `t28-*.png` 在同一目录。浏览器检查跑的是提交 `49bea0c` 的代码。服务按监听进程的 PID 停掉（第一次 30785、第二次 31018，都检查了它的工作目录是我的拷贝），端口 8328 已空。看到的：

- 菜单：短信管理下三个页面，邮件模板一级菜单。五个页面都没有页面级横向滚动，390 像素宽也没有。
- 渠道：九列和规格一致；编辑时凭据框是空的、`type=password`、`autocomplete=new-password`，页面 HTML 里没有种子数据里的任何凭据；留空保存的请求体没有 `credentials`；输入后保存，请求里带一次，页面和重开的对话框里都没有；操作前的提示窗（最后一个验证码通道）写了两个条件，取消后没有请求，确认后请求发出、后端拒绝，显示译文加说明，开关仍是开；把全国家的备用通道打开后再停泰国通道，没有提示；备用通道又成了最后一个，关它时又问；测试发送显示剩余 5，发送后请求是 `{"mobile":"+66812345678"}`，再开显示 4；新建对话框空提交五个必填项都有提示，坏地址和不在名单里的主机各自说错在哪，创建请求的名字是 300 个字母。
- 模板：九列；`Your code is code`、`{CODE}`、`{ code }` 都报缺 `{code}`，`{code}` 通过；把另外六个验证码模板停掉后，停最后一个先问，确认后后端拒绝，开关仍开。
- 发送记录：十四列；号码列是完整号码（`root` 持有查看权限）；推送行的供应商消息 ID 和送达状态是"—"；导出请求是 `from`、`to`，搜索投递渠道为推送后导出的请求多了 `channel=PUSH`，文件名 `sms-records-2026-10-20-2026-10-27.xlsx`；页面文字里没有"查看验证码"。
- 邮件模板：五行按后端的顺序；编辑框里占位符带说明、必含项、默认文案；正文四种写法的检查结果和测试一致；标题计数 `74 / 200`（泰语、阿拉伯语、emoji）；保存请求 `{"subject":…,"body":"Your code is {code}"}`，状态变"已修改"，修改人 `root`；恢复默认行内确认后发 `POST …/reset`，状态回到"默认"。
- zh-CN：四个页面的表头都是中文，没有把语言键当文字显示出来。
- 控制台：只有登录第一步的 401 和我故意触发的后端拒绝（400），没有别的错误。
- 没有发现页面的缺陷（脚本里一处点击被没处理的提示窗挡住是脚本的问题，已改）。

## 变异检查

脚本 `t28-mutate.py`，日志 `mutate-run1.out`。每个变异改一处判断，只跑守这条判断的测试文件（`--bail 1`），确认是断言失败（脚本检查输出里没有语法错误或找不到模块）再还原。60 个，全部变红；第一轮有两个因为代码被格式化成多行而没改成功，改了匹配文字后重跑变红。

凭据：凭据框用回答里的值填充；空凭据框发空键；只有空白也当作输入了；凭据标签的标题带上凭据；凭据框 `autocomplete` 改成 off；"已设置"提示反过来；失败提示带上后端 `message`；假后端回答带凭据；假后端更新时没带凭据就清空。
号码和记录：页面自己把号码掩成后四位；假后端不掩码；推送行显示供应商消息 ID；推送行显示送达状态；导出按钮不要 `SMS:RECORD:EXPORT`；导出按钮不要 `SMS:RECORD`；导出用的是还没点查询的筛选；"未使用"不发 `used=false`；默认范围改成 30 天；列表旧答案盖新答案；没有权限时不写掩码说明；假后端用号码的一部分匹配。
操作前的提示：渠道开关从不问；每个启用的验证码通道都问；打开开关时也问；取消了还是发请求；删除最后一个通道不问；覆盖算法不看国家；改类型或改国家丢掉覆盖时不问；不读 `auth.phone_login_enabled`；不写"存在手机号账号"这个条件；拒绝后不说明什么意思；模板从不问；模板改类型不问；模板的"最后一个"不看别的模板；开关连按发两次；假后端不拦最后一个通道；假后端放过最后一个模板。
模板和渠道表单：`{code}` 不区分大小写；营销类型也要 `{code}`；编辑模板时带编码；模板编码重复不拦；渠道编码重复不拦；地址主机不检查。
权限：没有 `SMS:CHANNEL:CONFIG` 也有写按钮；也能点开关；也有"新建通道"；渠道路由的权限码换成别的；邮件路由的权限码换成别的。
测试发送：次数为 0 时不灰掉按钮；次数为负数时照样显示；次数不是在打开对话框时读。
邮件模板：占位符不区分大小写；占位符去掉花括号再比；编辑框里不检查必含占位符；标题按 UTF-16 单元计数；没改过的模板也能恢复默认；不显示默认正文；页面自己给列表排序；保存时标题不去空白；假后端的必含检查不区分大小写。

## 覆盖的语言

界面只有 zh-CN 和 en-US：邮件模板页有中文渲染测试，短信三页的单元测试只覆盖英文界面（中文在浏览器里看了表头，两边键相同由语言文件检查守住，en-US 里没有中日韩字符）。假数据和测试含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：通道名称、模板名称和内容、记录的正文，邮件标题；另有 300 个字母无空格的通道名称、5000 个泰文字符的模板内容、记录正文和失败原因（表格里用 `EllipsisPopoverText`，测试断言 `overflow-wrap: anywhere`；表单里 5000 字能填入）、emoji（标题计数按码点）。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-sms-email.md`：凭据请求字段的名字和形状、`PUT` 是整条还是部分、`…/enabled` 的请求体、`extConfig` 的形状、渠道编码格式、主机名单的匹配规则、测试发送的响应、删除停用被拒绝时请求换一个专用错误码、页面怎样知道"存在手机号账号"（建议 `GET /sms/meta` 加两个字段）、"最后一个"怎么算；模板的分页和请求体、缺 `{code}` 的原因码；记录的筛选参数名、时间范围、号码格式、推送行；邮件模板的 `PUT` 和 `reset` 的响应、缺必含项的细节、占位符说明。没有一处是阻塞。

## 需要改共享文件的地方

1. `src/components/JsonField.tsx`：接收并传给文本域 `id`（`Form.Item` 传来的），标签才能关联；改好后扩展配置框可以换成它。
2. `src/components/ExportButton.tsx` 和 `src/locales/*/pages.ts` 的 `pages.export.button`：规格写"导出 Excel"，现在是"导出"（见记录项 3）。

## 规格需要在 main 上修改的地方

1. 5.18 渠道："删除或停用前提示：它是唯一启用的通道且手机号登录已开启时不能删除、不能停用"应按契约 §23.4 写成"手机号登录已开启**或存在手机号账号**"，并把"改类型、改国家使它不再是最后一个覆盖的启用验证码通道"也写进去；模板同理。
2. 5.18 和 5.18a："原样展示后端文字""展示 `message`"与"错误码已知时只显示译文"的决定不一致，应改成译文。
3. 5.18 渠道表单：写明"启用"只在创建时，编辑用列表里的开关。
4. 5.18 发送记录："导出 Excel"按钮的文字与共用控件不同；筛选的参数名没有写。

## 记录项（5，建议全部修）

1. 本模块有一批共用事情的本地副本：`src/pages/sms/{useServerPage.ts,PagedTable.tsx,FailureBar.tsx,texts.ts,useLatestRead.ts,StatusSwitch.tsx,formFailure.ts}`、`src/pages/email/{FailureBar.tsx,texts.ts,useLatestRead.ts,formFailure.ts}`（来自广告、投放模块的同名文件）。触发：共用的失败文字、分页、开关处理以后改了，副本不会跟着变。建议移到共用目录后删副本。
2. `src/pages/sms/ChannelModal.tsx`（扩展配置的文本域和它的检查）：没有用 `JsonField`（见"需要改共享文件"第 1 条）。触发：在扩展配置框里写不是 JSON 的文字，错误文字是本模块的"扩展配置不是合法的 JSON"，别的页面是共用的"JSON 格式不对"。
3. 发送记录页的导出按钮写"导出"，规格写"导出 Excel"（`ExportButton` 是共用的）。触发：持有 `SMS:RECORD:EXPORT` 的管理员打开发送记录页。
4. `src/pages/sms/lastOtp.ts`（`uniqueCoverage`、`isLastOtpChannel`、`keepsCoverage`）：页面按契约文字"最后一个覆盖的启用验证码通道"逐国家算，没有对着真后端验证。触发：后端的算法不同（例如只在整个系统只剩一个启用的验证码通道时才拒绝）：页面会在后端不拒绝的操作前多问一次；反过来后端拒绝而页面没问，用户看到译文加固定说明（删除、停用时一律带说明，改类型或国家时没有）。
5. `src/pages/email/TemplateEditor.tsx`：点"取消"、或确认"恢复默认"时，编辑框里还没保存的输入直接丢掉，不问。触发：改了正文不保存，点取消。结果：输入没了，不是错误结果。

## 变更候选（需要负责人确认的设计点）

- 新建通道、模板默认停用，启用开关只在创建对话框里（出入第 2 条）。
- 渠道编码格式的限制（出入第 4 条）。
- 改模板类型也先问（出入第 6 条）。
- 发送记录默认读最近 7 个 UTC 日（可以改日期；记录保留 30 天）。
- 建议后端在 `GET /sms/meta` 加 `phoneLoginEnabled`、`phoneAccountCount`，页面可以直接写出结论，不必写"读不到"或"本页看不到"（问题文件第一节第 10 条）。

## 未运行（4）

- 非 Chromium 浏览器（Firefox、Safari）：对话框、下拉、文件保存。
- 对着真后端：请求体、`PUT` 的语义、字段明细的原因码、测试发送的响应、"最后一个"的算法、`GET /sms/meta` 的真实形状，都是按假后端和契约做的。
- 真实的 `.xlsx` 导出内容和真实发送短信（假后端只给样例工作簿，不发任何东西）。
- 全量测试和 `npm run build`（按约定在全部任务做完后跑一次，这里只跑了本模块的测试、整个项目的 `tsc` 和本模块的 `biome`）。
