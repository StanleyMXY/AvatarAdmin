立即修未修 0、记录项 4、未运行 3、阻塞 0。

# 任务 30 报告：站内通知与客户端配置

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：`a6c51b5`（服务、假后端、两个页面、路由、文字、测试），本报告所在的提交（浏览器检查和变异检查之后的修正、补测试、问题文件、报告）。本模块 18 个测试文件共 266 个测试；加上语言文件的两边键一致检查、文字扫描、菜单和页面清单检查，一次跑 24 个文件 693 个，全部通过。整个项目的 `npx tsc --noEmit` 对本模块路径 0 个错误（输出里只有别的会话正在做的渠道包页面的类型错误）；`npx biome check` 对本模块路径没有诊断。没有 `hardcodedText.allow.json`（文字扫描没有需要放行的条目）。

## 做了什么

两个页面，路由取规格 5.0 的两行，菜单文字两种语言都有：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/users/notifications` 站内通知（用户菜单） | `NOTIFICATION:VIEW`（发送按钮和弹窗要 `NOTIFICATION:SEND`） | 顶部提示条"这里只发给指定账号，要给全体用户发消息请用推送管理里的手动推送任务"（有 `PUSH:SEND` 时带一个到 `/push/tasks` 的链接）；筛选：账号 ID（去首尾空白）、类别、是否已读、时间范围（UTC 日，可清空，页面注明）；列：账号 ID、类别、标题（en）、是否已读、发送人（系统事件写"系统"）、创建时间、详情；点一行或"详情"打开抽屉；服务端分页，旧答案不盖新答案 |
| `/config/client` 客户端配置（系统配置菜单） | `CLIENTCONFIG:VIEW`（保存和重置要 `CLIENTCONFIG:MANAGE`） | 顶部提示"未配置的链接类入口在 App 里不显示"；一张表列出接口给的全部键（不分页，顺序取后端）：键（只读的带"只读"标签）、说明、类型、按语言区分、是否已配置（只读的键写"由 X 配置决定，在系统配置里改"，有 `CONFIG:MANAGE` 时带到 `/config` 的链接）、客户端使用点；点一行打开编辑抽屉 |

**详情抽屉**：账号、类别、是否已读、发送人、创建时间、去向；模板键和模板参数（运营发送的显示"—"并写"运营发送的消息不使用模板"）；每种语言一块：语言标签、标题、正文，英文在最前，其余按标签排序；系统事件没有逐语言文字时写明"收件人读取时由模板键和参数生成"。标题正文、模板参数、语言键不是文字或对象时照样显示（`plainText`），不会崩。抽屉只在打开时挂载；它读的答案只认当前这一条。

**发送弹窗**（只在点按钮后挂载，关掉再开是空的）：
- 收件账号：每行一个 ID，每行用契约 1.9 的 29 个码点去首尾空白（不是 `String.trim`），去掉空行，同一个 ID 只留第一次出现，大小写不同当作不同；实时写"共 N 个账号"和"已合并 M 行重复"；`useAdminMeta().maxRecipients` 是正数时写"每批最多 N 个账号"，超过就在字段下说"一次最多 N 个，现在有 M 个"并且不发；没有这个值（缺项、`null`、没有 meta）就不检查，交给后端。数字按合并后的个数算。
- 标题和正文：按语言页签，`en` 必填、不能移除；标题 ≤ 100、正文 ≤ 500，先用 `trimSpec` 去首尾空白再按码点数，输入时实时计数（`3 / 100`，超过变红并写"现在有 N 个"），空的在按"发送"后报；可添加语言（建议项来自 `meta.supportedLocales`，标签要符合契约的格式且 ≤ 35 个字符，同一个标签大小写不同当作重复）；**一种语言没通过，整批不发**，那个页签标"有错误"并切过去；每种语言标题和正文都要填。
- 链接：共用的 `LinkTargetField`（无、页面、网址）加 `linkTargetRule`；页面下拉就是 `SCREEN_TARGETS`，网址走 `LinkInput` 的检查（§1.7：`http://`、空值都不能发）；没有链接时请求里没有 `linkType`、`linkTarget`。
- "同时推送"勾选，旁边的字正是任务书那句"推送遵守用户的公告类通知偏好，偏好关闭的用户只收到收件箱消息"。
- 后端 400：`data.details` 里每个账号一行（"账号 X：账号不存在/账号状态不是正常"），写明"这一批没有发送，一条都没有写入"，填的内容保留；标题或正文某种语言被拒绝时，原因放到那个语言的页签和字段下；`linkTarget` 等字段写字段名加原因；不认识的 `ref` 原样写、没有译文的原因码写"输入内容不合法"；**一律不显示后端的 `message`**（负责人的决定）。完全没有收到回复（断网、不是 JSON）时不说"没有发送"，改说"不知道这一批有没有发出去，重发之前请先在列表里查看"。
- 发送中按钮禁用，连按只发一个请求；成功提示"已发送 N 条通知"，关闭，列表重新读第一页。

**客户端配置编辑抽屉**（只在打开时挂载）：
- 说明、客户端使用点、类型、最后修改人和时间；只读键写"由 X 配置决定，在系统配置里改"（X 在语言文件里按键索引：`clientConfig.<键>.source`，没有时写"由系统配置决定"），是否只读**由接口的 `readOnly` 决定，页面里没有写死哪六个**；`STRING_LIST` 类型即使接口没标只读也不能编辑。
- 没有 `CLIENTCONFIG:MANAGE`，或键只读，或是列表类型：只显示各语言的值（文字、"是/否"、列表项），没有输入框、保存、重置、添加语言。
- 可编辑：页签"默认"加各语言；类型决定控件——`URL`、`EMAIL` 单行框，`STRING` 多行框，`BOOLEAN` 开关，`INT` 数字框；`URL` 按 §1.7 检查（`http://`、空值、空白值都不能存，去首尾空白后才检查和发送），`EMAIL` 检查格式且不能空，`STRING` 空文字是合法的值，`INT` 必须是整数，`BOOLEAN` 只收布尔；**整个键作为一个整体保存**：每种语言先检查，只要有一种不通过，整个键不发请求，出错的页签标"有错误"并切过去，顶部写"有 N 种语言的值没有通过检查，整个键没有保存"；后端 400 的 `details` 按 `ref`（语言标签，默认值是空串）放到对应页签和字段下，写"后端没有接受，整个键没有保存"；保存只发这一个键，没有改动时保存按钮是灰的；保存发整个 `values` 映射（所有语言），请求里的值的 JSON 类型和字段类型一致；添加语言（标签格式检查、重复检查）、移除一种语言的值（"保存后这种语言改用默认值"，只剩一个值时不能移除）、没有默认值时可添加默认值。
- 重置：行内确认"删除"X"全部语言的值？客户端会回到默认"；取消不发请求；确认发一个 `POST …/reset`；没有配置的键灰掉并写"这个键没有配置，没有可重置的值"。
- 预览：选一种语言（建议项来自本键的语言和 `meta.supportedLocales`），显示客户端实际会拿到的值，来源标成"该语言（取自语言 X 的值）""默认值（取自不带语言的默认值/登记的默认值）""未配置（没有值，客户端按入口不显示处理）"；按契约 1.2 和 26.1 的顺序算（完整匹配、同一主语言、请求标签的前缀、`zh` 的文字变体、不带语言的值、登记的默认值），含未保存的改动时写明。
- 保存、重置成功后列表重新读；重新读期间旧行留在屏幕上，更早发出的读的答案不盖新的；重置失败写 `error.<码>` 的译文，抽屉保持打开。

文件：
- 服务：`src/services/notifications/{index,types,notifications.test}.ts`、`src/services/clientConfig/{index,types,clientConfig.test}.ts`
- 页面：`src/pages/notifications/` 下 `list`、`NotificationDrawer`、`SendModal`、纯函数 `recipients`、`compose`、本地小件 `texts`、`useServerPage`、`PagedTable`、`FailureBar`（见记录项 1）、`testSetup`；`src/pages/clientConfig/` 下 `list`、`ClientConfigEditor`、`ValueControl`、`PreviewBox`、纯函数 `valueRules`、`editorState`、`preview`、`texts`、`useItems`、`testSetup`；各自的测试
- 假后端：`mock/notifications.mock.ts`、`mock/clientConfig.mock.ts`、`mock/_core/notificationsData.ts`、`mock/_core/clientConfigData.ts`（状态挂在 `globalThis`，`resetNotificationsStore`、`resetClientConfigStore` 重置）及两个测试文件。收件账号对着用户假后端的账号校验（存在、`ACTIVE`），六个只读键的值取自系统配置假后端（改了 `auth.phone_login_enabled` 它跟着变）
- 路由和文字：`config/routes/{notifications,clientConfig}.ts` 及测试、`src/locales/{zh-CN,en-US}/{notifications,clientConfig}.ts`
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-notifications.md`

未运行（3）：全量 `npx vitest run`（按约定要等全部任务做完后跑一次）；`npm run build`（同上）；对真实后端的联调（只有假后端）。

## 与任务书和规格的出入

1. 后端的 `message` 一律不显示（负责人的决定：错误码已知时只显示译文）。`INVALID_REQUEST` 的译文看不出原因，所以发送被拒绝时页面自己把 `details` 的每一项翻成文字列出来。
2. 规格 5.21 写"重置删除该键全部语言值"，契约 26.1 写"缺省语言可重置（删除该语言的行）"，26.3 的 `reset` 是"删除该键全部行"。页面两种都做了：行内确认的"重置"删全部；"移除这种语言的值"加保存等于删一种语言的行。
3. 任务书写"类型决定控件和校验"，登记里每个键的限制（整数范围、`inviteShareText` 500 字符和占位符、`inviteLinkBase` 不带查询）接口没给：页面只按类型检查，限制写在各键的"说明"文字里，超限由后端拒绝，原因放到那个语言的页签下（问题文件二.3）。
4. 页面里多了几处任务书没写的小东西：到 `/push/tasks` 和 `/config` 的链接（有对应权限才显示）；每批最多 N 个账号的说明；"没有收到回复"时的提示；每种语言标题和正文都要填。没有加别的功能。
5. 时间范围用 antd 的 `DatePicker.RangePicker`（可清空）而不是共用的 `DateRangeUtc`（必须有值），见"需要改共享文件"。

## 红到绿

先写测试，确认因"功能不存在"而红（`Failed to resolve import …` 或路由数组为空），再实现，再绿。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task30/`：`red-services.txt`、`red-mocks.txt`、`red-routes.txt`、`red-pure-notifications.txt`、`red-pure-clientconfig.txt`、`red-list.txt`、`red-send.txt`、`red-clientconfig-pages.txt`、`final-run.txt`。

| 文件 | 红 | 绿 |
|---|---|---|
| `src/services/notifications/notifications.test.ts`、`src/services/clientConfig/clientConfig.test.ts` | 两个都 `Failed to resolve import "./index"` | 5、5 |
| `mock/notifications.mock.test.ts`、`mock/clientConfig.mock.test.ts` | `Failed to resolve import "./_core/notificationsData"`、`"./_core/clientConfigData"` | 13、13 |
| `config/routes/notifications.test.ts`、`clientConfig.test.ts` | 路由数组为空，10 个断言失败 | 5、5 |
| `src/pages/notifications/recipients.test.ts`、`compose.test.ts` | `Failed to resolve import "./recipients"`、`"./compose"` | 13、13 |
| `src/pages/clientConfig/valueRules.test.ts`、`editorState.test.ts`、`preview.test.ts` | 三个都 `Failed to resolve import` | 20、19、13 |
| `src/pages/notifications/list.test.tsx` | `Failed to resolve import "./list"` | 29 |
| `src/pages/notifications/send.test.tsx` | `Failed to resolve import "./list"` | 39 |
| `src/pages/clientConfig/list.test.tsx`、`editor.test.tsx` | `Failed to resolve import "./list"` | 18、46 |
| `src/pages/notifications/messages.test.ts`、`src/pages/clientConfig/messages.test.ts` | 一致性检查（每条文字能解析、每个用到的键两种语言都有），写在语言文件之后，没有单独的红 | 3、5 |
| `src/pages/notifications/NotificationDrawer.test.tsx` | 变异检查之后补的（见下），没有单独的红 | 2 |

最终一次：`npx vitest run src/pages/clientConfig src/pages/notifications src/services/notifications src/services/clientConfig mock/notifications.mock.test.ts mock/clientConfig.mock.test.ts config/routes/notifications.test.ts config/routes/clientConfig.test.ts src/locales tests/noHardcodedText.test.ts config/menus.test.ts src/pages/pages.test.tsx` → 24 个文件 693 个测试全部通过（`final-run.txt`）；只跑本模块的 18 个文件是 266 个。

写测试和实现时测试自己找到的问题：
- 页面测试发现 `editorState.addLanguage` 用 `options.initial ?? ''`，把"整数框为空"的 `null` 变成了空串，于是整数键新加的默认值会被当作文字、错误提示是"必须是整数"而不是"不能为空"。改成 `'initial' in options`，并补了单元测试。
- 页面测试发现"发送"的收件账号如果取自上一次绘制的状态，连点时会发出旧的列表：改成从表单当下的值解析。
- `biome check --write` 把测试里用转义写的不可见字符（U+0600、U+3000、U+200D）改成了原始字符，被文字扫描抓到：改成 `\p{Script=…}` 和 `String.fromCharCode`，之后每次格式化都用脚本 `t30-hidden.py` 扫一遍（0 处）。
- antd 的 `Button` 在 `loading` 结束后（happy-dom 不触发动画结束）名字还是"loading Save"：测试里用 `/Save$/`。
- 重新读期间表格 `loading` 会让整张表 `pointer-events: none`，保存第二个键时点不到行：重新读时不再让表格转圈，旧行留着（只有第一次读才转圈）。

## 真实浏览器检查

Playwright（Chromium，浏览器时区 `Pacific/Auckland`，en-US，然后 zh-CN）对着 `PORT=8330` 的 `npm run dev:mock`，在 `scratchpad/task30/app` 的一份拷贝里跑（拷贝里的 `config/config.ts` 关了 MFSU、换了缓存目录，`node_modules` 是链接，`src/.umi` 一起复制）。脚本 `t30-browser.cjs`、`t30-narrow.cjs`、日志 `t30-browser.log`、`t30-browser-final.log`、截图 `t30-*.png` 在同一目录。浏览器检查跑的是提交 `a6c51b5` 的代码加之后的页面小改动（表格列宽、每批最多 N 个账号的说明、"移除"按钮的间距），最终代码的一次完整重跑结果相同。服务按监听进程的 PID 停掉（第一次 20948 是为了清掉假后端里第一轮操作留下的状态而重启，第二次 1023 是最后停止），每次都检查了它的工作目录是我的拷贝，端口 8330 已空。看到的：

- 通知页：菜单"用户"下有"站内通知"；七列和规格一致；20 行；没有页面级横向滚动；顶部提示条带链接。点系统事件那一行：抽屉写模板键 `notification.moderation.rejected` 和参数、"系统事件没有逐语言文字"；点有六种语言的运营消息：英文在前，`en ar es id th vi` 各有标题和正文（含阿拉伯语、泰语、emoji）。筛选：账号去了空白、类别，请求是 `accountId=…&category=SYSTEM_EVENT`。
- 发送弹窗：收件框填入带空白、空行、重复、不存在账号、被封禁账号的一串，显示"3 个账号，已合并 1 行重复"；英文标题的计数 `20 / 100`（含 emoji、泰语、阿拉伯语）；加泰语、阿拉伯语页签；阿拉伯语标题 101 个字符、正文空：点发送没有请求，`ar` 页签标"有错误"，字段下写"标题最多 100 个字符，现在有 101 个"和"不能为空"；移除阿拉伯语，勾"同时推送"，**双击发送只发出一个 POST**，后端 400：列出"账号 ghost-1：账号不存在""账号 2005：账号状态不是正常"，写明"这一批没有发送"，填的内容都还在；改成一个好账号再发：提示"已发送 1 条通知"，弹窗关闭，列表第一行就是新消息；再开弹窗收件框是空的；选"网址"填 `http://…` 点发送：没有请求，字段下写"链接必须以小写的 https:// 开头"。
- 客户端配置页：19 行（没有 `inviteShareSubtitle`），七列，没有页面级横向滚动；六个只读键带"只读"标签、各写出自己的系统配置键和到系统配置的链接。编辑 `privacyPolicyUrl`：四个页签；默认值填 `http://…` 点保存：没有请求，"默认"页签标"有错误"；改对，加 `es` 语言填值；预览依次输入 `es-MX`（该语言 es）、`th-TH`（该语言 th）、`zh-CN`（该语言 zh-Hans）、`vi`（默认值）、`ar`（该语言 ar）；**双击保存只发一个 PUT**，请求里是全部五种语言的映射。重置 `termsOfServiceUrl`：行内确认，取消没有请求，确认一个 POST，列表里变成"未配置"。整数键 `drivingLookaheadMs` 填 1.5：没有请求，"必须是整数"。只读的 `phoneLoginEnabled` 抽屉：只有值"否"、来源说明、到系统配置的链接，没有保存、重置、输入框；`conversationLanguages` 显示三十种语言的列表。
- 390 像素宽：两个页面都没有页面级横向滚动。**发送弹窗打开时有 8 像素的横向滚动**：量过，是共用外壳的顶栏（右侧内容宽 429）加弹层锁滚动时的补偿，推送模板页的"新建"弹窗同样出现，短页面（短信渠道）不出现，不是本模块的元素（记录项 3）。
- zh-CN：两个页面的表头、弹窗、抽屉都是中文，没有把语言键当文字显示出来。
- 控制台：只有登录第一步的 401 和我故意触发的后端拒绝（400），没有别的错误。
- 没有发现页面的缺陷（第一次脚本里点行中心点到了标题的悬浮按钮，是设计：点标题开悬浮框，不开抽屉，脚本改成点第一格）。

## 变异检查

脚本 `t30-mutate.py`（在 `scratchpad/task30`），日志 `mutate-run1.out`、`mutate-run2.out`、`mutation-<序号>.log`。每个变异改一处判断，只跑守这条判断的测试文件（`--bail 1`），退出码非零且不是语法或找不到模块的错误才算被杀死，然后还原。66 个，全部被杀死。第一轮的分类脚本只认 `AssertionError` 这类文字，漏掉了 `toBeDisabled` 和"pointer-events"的失败信息，报出 7 个"活下来"，处理如下：

- "发送：不防第二次按"：第一次写的变异语法不对；改好后只去掉最里面一层（单飞）仍活着，因为外面还有两层（表单校验遇到新的校验会作废旧的、按钮在发送中禁用），是等价变异；三层一起去掉（加上不做校验）后被杀死。
- "抽屉：旧答案盖新答案"：页面里换一条通知必须先关抽屉（遮罩挡着表格），抽屉重新挂载，所以这条守卫在页面里走不到。补了 `NotificationDrawer.test.tsx`（同一个抽屉被要求读另一条，两个顺序都测），之后被杀死。
- "抽屉：模板键不显示"：第一次改的是 antd 不认的属性，是无效变异；改成把模板键那格改成"—"后被杀死。
- "预览：跳过请求标签前缀这一步"：原测试里文字变体那一步恰好得出同一个答案；补了 `pt-PT-1996` 在 `pt-BR`、`pt-PT` 里取 `pt-PT` 的测试，之后被杀死。
- "保存在没有改动时可用""重置在没有配置时可用""重新读时整张表转圈"：只是分类脚本漏判，用新的判法重跑后被杀死。

变异列表（序号：内容，全部 KILLED）：
收件账号：0 用 `String.trim`；1 不合并重复；2 保留空行；3 上限差一；4 meta 没有上限时也检查。
标题正文：5 标题上限 101；6 正文上限 501；7 按 UTF-16 单元数；8 不去首尾空白；9 用 `String.trim`（测试里用 U+0085 和 U+FEFF 区分）；10 允许空文字；11 语言标签不限 35 个字符；12 重复判断区分大小写；13 没有链接也发链接字段；14 发出去的文字不去空白。
发送弹窗：15 收件账号不重新解析；16 不检查 meta 的上限；17 一种语言有问题仍发送；18 所有失败都说"没有发送"；19 没有回复时不提示；20 英文可以移除；21 不列有问题的账号；22 显示后端的 `message`；23 不防第二次按（三层）；24 弹窗一直挂着；25 推送勾选不发。
列表和抽屉：26 账号筛选不去空白；27 已读筛选反过来；28 类别筛选丢掉；29 发送按钮只要查看权限；30 旧答案盖新答案；31 英文不排第一；32 抽屉旧答案盖新答案；33 模板键不显示。
客户端配置规则：34 空 URL 通过；35 `http://` 通过；36 URL 用 `String.trim`；37 空文字被拒绝；38 带小数的整数通过；39 开关收任何值；40 只报第一个问题；41 新加语言用空串代替初始值；42 没改动也算改动；43 保存的映射去掉默认值。
预览：44 跳过前缀；45 跳过文字变体；46 不按语言区分的键也用语言行；47 `false`、`0`、空文字当作没有。
编辑器和页面：48 有问题仍保存；49 没改动时保存可用；50 没配置时重置可用；51 最后一个值也能移除；52 显示后端的 `message`；53 被拒绝的语言不放到页签下；54 预览不写未保存；55 只读键可编辑；56 没有 MANAGE 也可编辑；57 只读键靠页面里的名单；58 重新读时整张表转圈；59 旧读盖新读；60 只读键不写来源；65 保存不防第二次按。
路由和假后端：61、62 两个路由的权限码换成别的；63 被拒绝的一批仍写入好的；64 一种语言不通过仍保存。

## 覆盖的语言

界面只有 zh-CN 和 en-US：两个页面各有中文渲染测试（表头、弹窗、一行的文字、没有语言键露出）；浏览器里两种语言都看了。假数据和测试含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：通知的标题正文（七种语言加 `zh-Hans`）、客户端配置的各语言链接和分享文案、emoji（标题计数按码点：100 个 emoji 通过、101 个不行）、5000 个泰文字符或 5000 个 `x` 的无空格串（表格里用 `EllipsisPopoverText` 或 `overflow-wrap: anywhere`，抽屉里同样）、阿拉伯语长文。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-notifications.md`：列表筛选参数的格式；`send` 被拒绝时 `details` 的 `ref` 和原因码（账号、`accountIds`、`titleI18n.<语言>`、链接）；`details` 是否被截断；没有链接时省略两个字段；语言标签的大小写；一种语言只写标题；账号 ID 的大小写；客户端配置的保存和重置的响应、默认值的 `ref` 是空串、各原因码、登记里每个键的限制（整数范围、文字长度、占位符）、同时编辑会丢数据（要求 `expectedUpdatedAt`）、只读键的来源字段、`EMAIL` 的格式规则、预览用的语言排序和后端直接算预览的建议、`STRING` 的空字符串。没有一处是阻塞。

## 需要改共享文件的地方

1. `src/components/stat/DateRangeUtc.tsx`：必须有值、不能清空；通知列表的时间范围要"没选就不筛"。现在用 antd 的 `RangePicker` 加 `pickedDay`、`utcDayRangeToInstants` 自己做。建议给它一个可清空的模式。
2. `src/components/LinkTargetField.tsx`：两个下拉没有可访问名称（测试只能靠外面包一个 `data-testid`）。建议给"类型"和"页面"两个 `Select` 加 `aria-label`。
3. 列表用的 `useServerPage`、`PagedTable`、`FailureBar`（短信模块里有一份，通知模块复制了一份并给 `PagedTable` 加了 `onRow`；邮件模块还有 `useLatestRead` 的一份）：建议放进 `src/hooks`、`src/components` 共用，见记录项 1。
4. 共用外壳顶栏在 390 像素宽、长页面打开弹层时多出 8 像素横向滚动（记录项 3）。

## 规格需要在 main 上修改的地方

1. 5.20：发送表单"最多 1000 个"是 `notification.max_recipients`，页面取 `GET /meta` 的 `maxRecipients`，应改成"最多 `maxRecipients` 个（默认 1000）"；"标题 ≤ 100、正文 ≤ 500 个字符"应写成"先按契约 1.9 去首尾空白，再按 Unicode 码点数"。
2. 5.21："`URL` 只允许 https"应写成"符合契约 1.7 的链接规则"（大写 `HTTPS`、空端口、非 ASCII 主机或路径、用户信息等都不行）；"重置删除该键全部语言值"和契约 26.1"缺省语言可重置"不一致，应写清两种操作各叫什么；"保存只提交改动过的键"应写成"一次只保存一个键，没有改动时不能保存"。
3. 5.21 和契约 26.1：只读键的"X"（系统配置键）不在接口里，页面把六个对应关系放在语言文件里；建议接口给 `source`（问题文件二.5）。

## 记录项（4，建议全部修）

1. `src/pages/notifications/useServerPage.ts:1`、`src/pages/notifications/PagedTable.tsx:1`、`src/pages/notifications/FailureBar.tsx:1`、`src/pages/notifications/texts.ts:1`：是短信模块同名文件的拷贝（`PagedTable` 多了 `onRow`），`src/pages/clientConfig/list.tsx:9`、`texts.ts:3` 又引用了通知目录的 `FailureBar`、`texts`，`src/pages/clientConfig/editorState.ts:4` 引用了通知目录的 `isLanguageTag`。触发步骤：改短信列表的分页或失败提示，通知页不跟着变。后果：同一份逻辑在三个目录里各改各的。建议：放进共用目录后三处都改成引用。
2. `src/pages/clientConfig/ClientConfigEditor.tsx:204`（抽屉的 `onClose`）：改了一个值后按 Esc 或点关闭，输入的改动直接丢掉，没有询问。触发步骤：打开 `privacyPolicyUrl`，改默认值，按 Esc。结果：抽屉关闭，改动没有了。建议：有未保存的改动时先问（行内确认）。
3. `src/pages/notifications/SendModal.tsx:299`（弹窗的 `onCancel`）：同上，写了半天的多语言消息按 Esc 或点"取消"就没了。触发步骤：填收件账号和三种语言的标题正文，按 Esc。建议同上。
4. 共用外壳：390 像素宽、页面有纵向滚动条时，任何弹层（本模块的发送弹窗和客户端配置抽屉，推送模板页的"新建"弹窗）打开后 `document.scrollingElement.scrollWidth` 是 398，页面可以横向拖 8 像素；顶栏右侧内容 `ant-pro-global-header-right-content` 宽 429 超出视口。触发步骤：把浏览器宽度设成 390，打开 `/push/templates` 点"新建模板"。不是本模块的文件，写在这里是为了让负责人看到。

## 变更候选（要先给负责人确认设计点）

- **保存前先确认没有被别人改过**：客户端配置的保存是整体替换，请求里没有"我读到的版本"。两个管理员同时打开同一个键，后保存的会把先保存的新加的语言删掉，没有提示。页面可以在发 `PUT` 前再读一次这个键，和打开时的值比较，不同就拒绝并提示重新打开（多一次请求，仍有很小的时间窗）。更好的做法是后端加 `expectedUpdatedAt`（问题文件二.4）。要确认：是否让页面先做前一种；不同时的文字怎么写。
- **预览由后端直接算**（问题文件二.7）：现在页面按契约文字自己算一个请求语言；后端给一个预览接口后，页面不再有自己的一份算法。
