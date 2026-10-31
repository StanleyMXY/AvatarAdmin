立即修未修 0、记录项 6、未运行 3、阻塞 0

# 后端第一批交付：系统配置页（区域 cfg）的独立评审

评审对象：提交 c6a83e3（25 个额外设置键、拒绝文字机制、检查脚本、假后端）和 6b3b698（保存或重置 `push.default_locale` 被拒的文字）；实现者的报告是 `backend-d1-cfg-report.md`。对照的清单是 `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 的 (d) 节、a4、a5（后半）、a6、a8、a9、e2、e3、e5 和追加的 GROUP B。我没有采信报告里的结论，下面都是自己读代码、跑假后端、改草稿拷贝复现得到的。

方法：在草稿目录 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/cfgrev/draft`（HEAD 的拷贝）里做变异、写临时测试、起 `dev:mock`（端口 8199，用完按进程号停掉）；共享检出里没有留下任何改动（`git status` 为空）。

## 一、结论（逐条回答负责人点名要查的事）

1. 25 个键与清单 (d) 表逐项一致：一致。我对着清单原文逐键核了 `src/pages/config/extraConfigKeys.ts` 和 `mock/_core/configExtraDefaults.ts`：
   - 整数键范围：聊天审核全局并发 1–512；导出并行度 1–4；三个公开文件限流、App Attest 每设备密钥数、两个 App Attest 每 IP 每小时限额都是最小 1 无上限；漏斗并发 1–32；聊天消息保留天数为 0 或不小于 32；游客设备保留天数为 0 或不小于 91；声音样本、客服反馈、审核记录保留天数最小 0；`push.task_poll_seconds`、`memory.call_timeout_seconds`、`ratelimit.events_per_ip_per_minute` 最小 1；`chat.moderation_concurrency` 1–32；`chat.moderation_deadline_ms` 100–2500（GROUP B 的新上限，不是 2900）。
   - 布尔键：`integrity.app_attest_unsupported_allowed`、`events.store_client_ip`、`ads.store_client_ip`、`attribution.store_click_ip`（清单 d10–d13）、`attribution.postback_enabled`，类型都是布尔；字符串键 `attribution.facebook_graph_version` 带 `^v[0-9]{2}\.[0-9]$`（前端用 JavaScript 正则，末尾换行 `v26.0\n` 被拒，和 Java 的整串匹配一致，测试里有）。
   - 编辑权限：`attribution.store_click_ip`（d13）是 `ATTRIBUTION:MANAGE`，`moderation.record_retention_days`（d18）是 `MODERATION:CONFIG`，`push.task_poll_seconds` 是 `PUSH:CONFIG`，`attribution.postback_enabled` 和 `attribution.facebook_graph_version` 是 `ATTRIBUTION:MANAGE`，其余 20 个是 `CONFIG:MANAGE`。
   - 默认值：25 个全部与清单一致（64、3、30、120、120、2、3、60、20、真、真、真、真、0×5、15、10、假、`v26.0`、600、16、2000）；GROUP B 里已在契约表中的三个键（`recall.window_minutes`、`recall.scan_interval_minutes` 1–1440，`push.schedule_catchup_minutes` 1–10080）范围也对。
   - 数量：9 + 4 + 5 + 7 = 25，页面真实浏览器里是 250 行，没有“未识别的配置项”警告。
2. 风险键从 6 个变 7 个：合理。清单对 `guest.device_retention_days` 的说明里有一句加粗的“警告”（记录被删后设备按新设备重新发放游客额度，所以设得太短会让额度被绕过），这是清单明确要求给运营看的话，用风险提示条显示就是对这句话的落实；风险文字（`config.guest.device_retention_days.risk` 中英文）和清单一致，没有多说。别的保留期键（聊天消息、声音样本等）清单没有写警告，没有加。不是缺陷，不算变更（行为来自清单）。小问题见记录项 5（旧测试的名字没跟着改）。
3. 检查脚本的额外键清单逻辑：真的会在契约采纳后报“从清单删掉”，我用真实快照和伪造的采纳场景验证了：
   - 真实快照（`docs/shared-snapshots/backend-task-java-backend.md`）：输出“contract: 225 keys, generated file: 225, backend extra keys: 25, schema: 250 … agree”，退出码 0。
   - 伪造一：在契约 17.5 表里加 `export.parallelism` 和 `attribution.store_click_ip`（后者权限故意写成 `CONFIG:MANAGE`）：退出码 1，输出“export.parallelism is in the contract now: remove it from the list of backend extra keys”、同样一行给第二个键、两行“generated file is missing …”、一行“schema: attribution.store_click_ip needs ATTRIBUTION:MANAGE but the contract says CONFIG:MANAGE”。
   - 伪造二，按文件头写的步骤真走一遍（只采纳 `export.parallelism`）：先报“is in the contract now”；`gen:config-keys` 后仍报一行；把它从 `extraConfigKeys.ts` 删掉、加进 `configSchema.ts` 的契约条目（放在表里的位置）后，检查脚本退出码 0，输出“backend extra keys: 24”。随后 `configSchema.test.ts` 里“键的清单与额外键清单”的那一条按预期变红（它的期望表里还有这个键，需要同步删），这是采纳时本来就要做的维护，不是缺陷。
   - 变异：报告里说“检查脚本不报已采纳的键”被抓到，我复核了单元测试 `scripts/configKeys.test.ts` 的对应用例确实覆盖。
4. 被拒文字里 `details` 的 `ref`：
   - 是设置键：每个被点名且在本表单里显示的键，各自的行都显示按码文字。我在真实浏览器里验证了 `push.schedule_catchup_minutes` 保存 10 被拒：catch-up 行和轮询秒数行两行同时显示各自的文字；成本币种（默认币种和允许币种）的两行由临时测试和实现者的测试验证；重置（DELETE）被拒同样两行都显示（我自己用已保存的“允许币种含 THB、默认币种 THB”造出重置允许币种被拒，两行都有，切换到中文后两行都变中文）。
   - 是 `SmsTemplate`：显示在表单顶部（`data-testid="config-refusals"`），被保存的那一行另有一句泛泛的“输入不合法”；`ref` 同时含 `SmsTemplate` 和一个设置键时，顶部框和那个键的行同时显示，没有丢（临时测试 D）。顶部框会滚动到可见处（jsdom 里没法验证滚动本身，见未运行）。
   - 点名了本表单不显示的键：被保存的行有自己的文字时，那条不显示（设计如此）；被保存的行没有自己的文字时，那条文字显示在顶部（临时测试 H）。
5. 后端 message 是否漏出界面：
   - 已知的原因码和已知的错误码：不漏。我用真实输入（`details` 的 `ref`/`reason` 取清单里的各种组合，`message` 写成可搜索的暗号）验证，设置键行、顶部框、被保存行的泛泛提示里都找不到暗号；真实浏览器里 `push.default_locale` 保存 `fr` 被拒，只有按码拼出的句子（“…没有 fr 的启用模板：每日召回…”），没有英文 message。
   - 未知的原因码或错误码：会漏，见记录项 1。清单里写明的所有拒绝情形都不触发它，所以没有归“立即修”。
6. 切换语言后拒绝文字是否跟着变：跟着变。拒绝以 `ApiError` 本身存放在 `ConfigForm` 的状态里，文字在渲染时算（`ConfigForm.tsx` 的 `refusalTexts(intl, …)`）。真实浏览器（只测了 en-US 与 zh-CN 两种）里：catch-up、轮询秒数、`push.default_locale` 三处在被拒后切换语言，文字立即变成中文；顶部框和两行的成本币种（重置被拒）在临时测试里也跟着变。1440 宽和 390 宽都看了。

## 二、记录项（真实但不影响正确性；建议全部修）

1. 未知的原因码或错误码时，后端英文 message 会显示在界面上。
   - 位置：`src/pages/config/refusal.ts:78`（该行没有自己的按码文字时取 `fields[index]?.text`），它来自 `src/request/errors.ts:125`（原因码没有 `reason.<码>` 文字时用 `e.message`）；被保存行的泛泛提示走 `src/request/errors.ts:119`（错误码没有 `error.<码>` 文字时写成“未知错误 (message)”）。
   - 触发步骤和结果（临时测试，真实输入）：后端对保存 `chat.moderation_deadline_ms` 回 400，`details` 为 `[{ref:'chat.moderation_deadline_ms', reason:'WEIRD_REASON'}]`，`message` 为 `BACKEND-MSG-A`：该行的提示文字就是 `BACKEND-MSG-A`。`ref` 为 `SmsTemplate`、原因码未知：顶部框文字就是 message。回 409、错误码 `SOMETHING_NEW`、无 `details`：被保存行显示“Something went wrong. (BACKEND-MSG-C)”。
   - 什么时候会真实出现：清单里写明的每种拒绝都有对应的按码文字，不会触发；目前唯一可能触发的是 `attribution.facebook_graph_version` 格式不对时后端的原因码（问题文件第二节里没写，页面提交前自己拦了所以通常到不了后端），或后端以后新增原因码。这是共享的原因码回退（`describeError`）的设计，不是本区域独有；但本区域的页面目标是“不显示 message”，建议在 `refusal.ts` 里对没有按码文字的原因直接用 `reason.OUT_OF_RANGE` 的通用句或原因码本身，不再取 `e.message`，并加一个测试。
2. 测试缺口：点名了本表单不显示的键、以及 `ref` 不是设置键且被保存的行自己有文字的路径，改坏了测试仍然全绿。
   - 位置：`src/pages/config/refusal.ts:93`，`rows.has(origin) ? notKeys : [...notKeys, ...hiddenKeys]`。
   - 变异：改成 `top: notKeys`（不显示隐藏键的文字）后 `ConfigForm.test.tsx`、`src/pages/campaign/settings.test.tsx`、`src/pages/push/recall.test.tsx` 共 54 个用例仍全部为绿；把 `if (!isKey) notKeys.push(text)` 去掉（让非键的文字改走隐藏键那一支）同样全部为绿。现有用例里被保存的行要么没有点名别的键，要么没有自己的文字，所以这条分支没人守。
   - 具体步骤：只显示 `push.schedule_catchup_minutes` 的表单里保存它、后端只回 `[{ref:'push.task_poll_seconds'}]`（我用临时测试 H 验证了现在的结果是顶部框出现轮询秒数的文字，行上出现泛泛提示）；改坏后没有测试变红。
   - 另有一个等价问题：`refusal.ts` 里同一个 `ref` 出现两次时只取第一条的守卫（`if (!rows.has(detail.ref))`）去掉后测试也全绿；后端不会这样回，影响更小。
3. 轮询秒数那一行在“保存的是 catch-up 分钟数”被拒时，文字说错了原因。
   - 位置：`src/locales/en-US/config.ts:835`、`src/locales/zh-CN/config.ts:756`（`config.push.task_poll_seconds.reject.OUT_OF_RANGE`）。
   - 触发：把 catch-up 改成 10 保存（10×60 小于 600+15）：轮询秒数那一行（值是 15，没改）显示“没有保存。取值不能小于 1，并且 catch-up 分钟数×60 须保持 ≥ 600 + 这个轮询秒数。”——“取值不能小于 1”针对的是一个没问题的 15，读的人会以为轮询秒数填错了。真实浏览器截图：`scratchpad/cfgrev/shots/w390-poll-zh.png`。catch-up 那一行的句子（先说范围、再说关系）是对的。建议轮询秒数这一行只说关系那半句（范围错误在这个键自己被保存时由前端提交前检查拦住）。
4. 支持语言被拒的文字里有两处说法没有依据。
   - 位置：`src/locales/en-US/config.ts:826`、`src/locales/zh-CN/config.ts:747`（`config.app.supported_locales.reject.OUT_OF_RANGE`）。
   - “列表里必须保留 en”：清单 a4、e3 和契约 17.5 对 `app.supported_locales` 的说明里都没有这条；它来自页面原来的校验（`configSchema.ts:54` 起，保存前自己拦），后端对“缺模板文件”回的原因码是同一个 `OUT_OF_RANGE`，所以用户因为缺法语文件被拒时也会读到一句与原因无关的话。
   - “现在只有英文”：是部署现状，哪个语言的文件随版本发布了这句话就过时（清单写的是“现在随版本发布的文件只有 en”）。
   - 建议：删去这两处，只写“每种语言都要先有随版本发布的通知模板文件；先让文件随版本发布，再把语言加进来”。实现者自己在问题文件第四节里也承认第一条是猜的。
5. 旧测试的名字没跟着风险键从 6 改成 7。
   - 位置：`src/pages/config/ConfigForm.test.tsx:94`，名字“spells out the risk of each of the six risk keys, and of no other”，列表里是 6 个键，且“no other”只对一个键断言；第 7 个键在 `:400` 另测，`configSchema.test.ts` 里“marks the seven risk keys, and no other”和 `parity.test.ts` 的七个键检查才是真正的守卫。只是名字和断言范围说的与事实不符。
6. 报告里写“文字里没有第三方产品名”与事实不符。
   - 位置：`src/locales/en-US/config.ts` 里四个设备校验键（`integrity.app_attest_*`、`ratelimit.app_attest_*`）的名称和说明含“App Attest”，说明里还有“Apple creates a new key on reinstall…”；zh-CN 对应文字同样；键名 `attribution.facebook_graph_version` 本身（以及 `extraConfigKeys.ts`、测试、假后端里的同名字符串）是后端的标识符，改不了，也已经在契约快照里出现。
   - 判断：键名不能改，不算问题；“App Attest”“Apple”写在给运营看的名称和说明里违反 CLAUDE.md 的“不出现任何第三方产品名”，虽然仓库里早已有“Google Play”这类文字（`src/locales/en-US/ads.ts:88` 等，不是本次提交引入）。建议这四个键的名称和说明改成“设备认证”这类通用说法，并把报告里那句话改正。

## 三、验证记录

- 假后端和页面行为：临时测试（草稿拷贝里，已删除）覆盖未知原因码、`SmsTemplate`+设置键同时被点名、重置被拒、语言切换、点名隐藏键；正式测试我在共享检出里跑了 `src/pages/config/configSchema.test.ts`、`scripts/configKeys.test.ts`、`mock/config.mock.test.ts`（69 个用例为绿）和 `src/pages/config/ConfigForm.test.tsx`、`src/locales`（5 个文件 448 个用例为绿）。
- 变异检查（草稿拷贝里改一处、跑相关测试、立刻还原，还原后用 diff 确认）：
  - 25 个键的元数据（编辑权限 d13、d18、轮询秒数；两个保留期的“0 或最小”；两个上限 512 和 32；截止时间上限 2500；布尔变整数；声音样本最小值；图 API 版本的正则）11 个，全部被抓到。
  - 假后端默认值（全局并发 64、图 API 版本、广告 IP 开关、事件上限 600、App Attest 密钥限额 20）5 个，全部被抓到。
  - 拒绝文字 6 个：去掉被保存行的泛泛提示（红）、去掉 `missingLanguages` 补句（红）被抓到；去掉“被保存行”和“成功后”两处清除各自单独改（等价，另一处仍会清除，不算缺口）、同一个 `ref` 只取第一条的守卫、隐藏键与非键的归并路径存活（见记录项 2）。
- 真实浏览器（Playwright Chromium，草稿拷贝起 `dev:mock`，端口 8199，用完按进程号停掉，没有碰别的会话的开发服务器）：1440 宽和 390 宽、英文和中文（只覆盖这两种；界面本来就只有这两种语言）、深色主题。看了 catch-up 与轮询秒数两行、`push.default_locale`（保存 `fr`：“每日召回”缺 fr 模板，被拒；切换语言即变中文）。250 行、无“未识别的配置项”警告；控制台只有预期的 400。泰语、阿拉伯语等语言在该页的拒绝文字里只出现在语言列表和召回原因的名称里，这次没有单独验证，别的检查只覆盖中文和英文。

## 四、没运行的

1. 全量测试和构建（按规则留到全部任务做完）。
2. `SmsTemplate` 顶部框在真实浏览器里的显示（包括滚动到可见处）：假后端种子里 `smsState.phoneAccounts` 大于 0，开发服务器里无法把英文验证码模板停用，造不出“缺模板”的状态；只在 jsdom 里验证了文字、清除和语言切换，滚动本身没验证。
3. 25 个键在真实浏览器里逐行的显示（我只看了 catch-up、轮询秒数、默认语言三处，其余行靠 jsdom 测试和 250 行计数）；亮色主题没看。
