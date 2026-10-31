立即修未修 0、记录项 3、未运行 3、阻塞 0

# 后端第一批交付：系统配置页（区域 cfg）的报告

范围：清单 a4、a8、a9 的设置键部分、a6 里 `auth.phone_login_enabled` 的错误、e3、e5、(d) 节 d1–d18 和后面列的 7 个更早的额外键、GROUP B 的四处范围和保存规则。推送模板规则 e1 与 `push.default_locale` 的文字由 msg 区域负责，没碰。

"记录项 3"：三项都是契约缺口，写在 `docs/contract-requests/2026-10-31-admin-frontend-config-refusal-reasons.md`，当前按最小做法继续：(1) 开启手机号登录被拒时缺的是哪几项，只能给固定的一句话（该文件第一节）；(2) `attribution.facebook_graph_version` 格式不对时的原因码清单没写，前端和假后端按 `OUT_OF_RANGE`（第二节，`src/pages/config/extraConfigKeys.ts` 的 `pattern`，`src/pages/config/configSchema.ts` 的 `validateValue`）；(3) 旧的两键关系（`retry.*`、`moderation.review_score`/`block_score`、`generation.voice_*`、`export.lease/job_timeout`、`auth.access_ttl/refresh_ttl`）后端是否也在 `details` 里列两个键没写，假后端的 `relationProblem`（`mock/config.mock.ts` 第 56 行起）仍只列保存的键（第三节）；前端对两种形状都能处理。

"未运行 3"：全量测试和构建（按规则留到最后）；真实浏览器只看了英文 1440 宽，没看 zh-CN、没看 390 宽。

## 做了什么（按清单的行）

**设置页的拒绝文字（a4、a6、a8、a9、GROUP B、d14、d16 共用的机制）**
- 原来的处理（`ConfigRow.tsx` 旧版）：只有 `ref` 等于本行键的 `details` 才显示在本行，其它情形显示"错误码文字: 后端 message"。后果：a8 和 GROUP B 的另一行没有任何提示；a6 的 `ref=SmsTemplate` 对不到任何行，只剩一句泛泛的"输入不合法"加英文 message；后端 message 违反负责人的规则。
- 现在：`src/pages/config/refusal.ts` 的 `refusalTexts` 按每个 `detail` 的码生成文字，从不用后端 message。`ref` 是设置键且该行在表单里：显示在该行（`config.<键>.reject.<原因码>`，没有就用 `reason.<原因码>`），所以一次拒绝点名两个键就在两行都显示；`ref` 不是设置键（`SmsTemplate`）：显示在表单顶部（`config.refusal.<ref>.<原因码>`，`ConfigForm.tsx` 的 `TopRefusals`，出现时滚动到可见处，`data-testid="config-refusals"`）。被保存的行如果没有自己的文字，显示按码翻译的 `error.INVALID_REQUEST`。
- 拒绝以失败对象本身存放在 `ConfigForm` 的状态里，文字在渲染时算，所以切换语言时跟着变；下一次保存或重置开始时、保存成功时清掉。保存和重置走同一条路（重置被拒，例如成本币种，也显示同样的文字）。
- 沿用了 campaign 区域已写在工作区里的 `config.<键>.reject.<原因码>` 命名和 `mock/config.mock.ts` 的 `costCurrencyLock`（a9 的成本币种锁：假后端、`config.attribution.cost_currency.reject.OUT_OF_RANGE` 文字在 `src/locales/*/campaign.ts`，它们的未提交修改）；我把它们原来写在 `ConfigRow.tsx` 里的查找并入 `refusal.ts`，它们的 `src/pages/campaign/settings.test.tsx` 里关于拒绝文字的测试（含重置被拒）在我的实现上通过。我没有重复写成本币种的拒绝文字，只在 `config.attribution.cost_currency.desc` 加了一句"有成本行就不能改"。
- 文件：`src/pages/config/refusal.ts`（新）、`ConfigForm.tsx`、`ConfigRow.tsx`、`src/locales/{zh-CN,en-US}/config.ts`。
- a4：`app.supported_locales` 被拒显示"每种语言都要有随版本发布的通知模板文件（现在只有英文），列表里必须保留 en；先发布文件再加语言"，`data.missingLanguages` 有就补一句"没有模板文件的语言：…"，没有也成立（页面不依赖它）。e3 的顺序同时写进了这个键的说明。
- a6：`auth.phone_login_enabled` 的 `SmsTemplate`/`EMPTY_NOT_ALLOWED` 显示在表单顶部（固定一句，对应 e2 的规则），后端 message 不显示。写不清缺哪几项的部分写成了问题文件（见上面的记录项）。短信模板页那一侧的 a6 不在我的区域。
- a8、e5：默认币种、允许币种两行都显示"允许的币种必须包含默认币种；要改默认币种先加进允许列表，要去掉当前默认币种先改默认币种"；两个键的说明里也写了这条顺序。
- a9 设置键部分：见上，由 campaign 的改动和我的 `refusal.ts` 一起完成，已核对。
- GROUP B：`chat.moderation_deadline_ms` 100–2500（新键，直接按新范围）、`recall.window_minutes`、`recall.scan_interval_minutes` 1–1440、`push.schedule_catchup_minutes` 1–10080（`configSchema.ts` 的条目加了 `max`）；`push.schedule_catchup_minutes` 和 `push.task_poll_seconds` 两行都有常显的提示（`config.<键>.hint`，"catch-up 分钟数×60 须 ≥ 600 + 轮询秒数；默认值下至少 11"；`ConfigRow.tsx` 新增 hint 行），保存被拒时两行都显示按码的文字。没有在前端预先检查这条关系（后端裁决）。
- d14、d16 与 `stats.land_window_days`（以及 `events.ttl_days`）：被拒时两个键的行都显示；`stats.land_window_days` 的拒绝文字列出依赖它的三项。

**d1–d18 和 7 个更早的额外键（共 25 个，全部在 schema 里，没有一个落入"未识别的配置项"）**
- `src/pages/config/extraConfigKeys.ts`（新）是"契约采纳前的后端额外键"这一份单独的清单（类型、范围、编辑权限、分组），文件头写了采纳后怎么删；`configSchema.ts` 把它接在契约条目后面，导出 `EXTRA_CONFIG_KEYS`。编辑权限按清单：d13 `ATTRIBUTION:MANAGE`、d18 `MODERATION:CONFIG`、`push.task_poll_seconds` `PUSH:CONFIG`、`attribution.postback_enabled`/`facebook_graph_version` `ATTRIBUTION:MANAGE`，其余 `CONFIG:MANAGE`。布尔键 d10–d13。
- 先 grep 过：schema 里原来没有这 7 个早期键；`recall.window_minutes`、`recall.scan_interval_minutes`、`push.schedule_catchup_minutes` 原来就在契约条目里，只改了范围。
- `configSchema.ts` 新增 `zeroOrMin`（d14：0 或 ≥ 32；d16：0 或 ≥ 91）和 `pattern`（`^v[0-9]{2}\.[0-9]$`）；`guest.device_retention_days`（d16）标为风险键并写了风险文字（清单写的"警告"：删记录后设备会重新拿到游客额度），所以风险键从 6 个变 7 个。
- 每个键的 label 和 desc 中英文都写了（`src/locales/*/config.ts`），默认值不进 schema，页面显示的是 `GET /config` 的 `defaultValue`；文字里没有第三方产品名（广告平台接口版本一项只写"广告平台"）。
- `scripts/configKeysCheck.ts` 的 `compareConfigKeys` 多一个 `extras` 参数：schema 必须是契约表加额外键；额外键出现在生成文件里报错；额外键已经出现在契约里报"is in the contract now: remove it from the list of backend extra keys"；额外键重复报错。`scripts/check-config-keys.ts` 传入 `EXTRA_ENTRIES`。
- 假后端：`mock/_core/configExtraDefaults.ts`（新，25 个默认值，契约生成的默认值在两者都有时优先）、`mock/_core/configStore.ts` 合并；`mock/config.mock.ts` 新增 `refusalFor`：a4（只有 `en` 有文件，比较不分大小写，400 带 `data.missingLanguages`）、a8（两个键，保存的键在前，DELETE 按默认值判断）、GROUP B（`catchup×60 ≥ 600 + poll`，PUT 和 DELETE 都判，两键）、d14/d16/`events.ttl_days` 与 `stats.land_window_days`（两键）、a6（`SmsTemplate`/`EMPTY_NOT_ALLOWED`，读短信假数据里的模板）；值范围含 `zeroOrMin`、`pattern`。拒绝里的 `data.missingLanguages` 有；`data.defaultLocale`、`data.reasons` 属 `push.default_locale`，是 msg 区域的，我没做。

## 测试（红、绿、变异）

- 红：命令 `npx vitest run src/pages/config scripts/configKeys.test.ts mock/config.mock.test.ts`，在没有实现的状态下 4 个文件失败，46 个用例失败（输出：`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/cfg/red.txt`）；失败原因是键数 225（期望 250）、额外键不存在（`specOf` 为 `undefined`）、没有两行拒绝等，不是拼写或配置错误。
- 绿：`npx vitest run src/pages/config scripts mock/config.mock.test.ts mock/config.test.ts src/locales tests/noHardcodedText.test.ts src/services/config src/pages/campaign/settings.test.tsx src/pages/push/recall.test.tsx` → 18 个文件，633 通过，1 跳过。`npx tsc --noEmit` 退出码 0（全项目）。`npx biome check` 本区域路径无问题。`npx tsx scripts/check-config-keys.ts docs/shared-snapshots/backend-task-java-backend.md` → "contract: 225 keys, generated file: 225, backend extra keys: 25, schema: 250 … agree"。
- 新测试位置：
  - `src/pages/config/configSchema.test.ts` 第 43、50、66 行（25 个额外键的类型、权限、范围；GROUP B 范围）、第 87 行（7 个风险键）、第 117 行（键数 250）、第 144、165 行（范围和版本格式）。
  - `scripts/configKeys.test.ts` 第 111 行起（额外键通过、缺失、已被契约采纳、生成文件含额外键、权限不同、重复）。
  - `mock/config.mock.test.ts` 第 210–440 行（25 个默认值、d13/d18 的权限范围、范围检查、a4、a8、GROUP B、d14/d16、a6）。
  - `src/pages/config/ConfigForm.test.tsx` 第 363 行起（25 个键中英文都有名称和说明；开关；风险；一个归因权限的键保存），第 434 行起（两行都显示、不显示后端 message、中文、清除、切换语言、提示、catch-up 与轮询两行、保留天数与回溯天数），第 580 行起（`SmsTemplate` 顶部、中文、清除、没有顶部框），第 632 行起（支持语言，含没有 `missingLanguages` 的情形）。
  - 键数的更新：`ConfigForm.test.tsx` 的 225→250、moderation 10→11；`src/locales/parity.test.ts`（额外键也要有名称、说明、分组标题，风险键 7 个）；`src/pages/push/recall.test.tsx`（12→13，加 `push.task_poll_seconds`）；`src/pages/campaign/settings.test.tsx`（9→12，加三个归因键）；`src/pages/moderation/rules.test.tsx` 第 440 行（10→11）。
- 变异检查（改一处、跑相关测试、恢复），12 个都被抓到：只给被保存的行显示文字（5 个红）；假后端去掉 catch-up 规则（3）；去掉表单顶部框（2）；改成显示后端 message（9）；去掉 `zeroOrMin`（1）；检查脚本不报已采纳的键（1）；漏掉一个额外键（4）；假后端接受没有文件的语言（4）；去掉提示（2）；默认币种不对照允许列表（6）；开启手机号登录不要求模板（4）；保留天数不对照回溯天数（3）。
- 语言：测试数据里的中文、英文各自覆盖；该页的数据主要是数字和开关，泰语、阿拉伯语、印尼语、越南语、西班牙语只出现在语言列表（`app.supported_locales` 的 `th`、`ar`、`id`、`vi`、`es`、`zh-Hans`）和短信模板假数据里，别的检查只覆盖中文和英文。
- 真实浏览器：从草稿目录的拷贝起 `dev:mock`（端口 8133，关了 MFSU，用完按进程号停掉），用 root 登录打开 `/config`：250 行，没有"未识别的配置项"警告；依次操作 catch-up 改 10（两行都出现按码的文字）、允许币种改 `["THB"]`（默认币种行同样出现，截图 `scratchpad/cfg/shots/currency.png` 排版正常）、支持语言改成七种语言（出现固定文字加"th, ar, id, vi, es, zh-Hans"）、开启手机号登录（种子里有英文不限国家的模板，保存成功）；控制台只有预期的 401（登录前）和三次 400（三次被拒的保存），没有别的错误。

## 没落实的和原因

- e1、`push.default_locale` 的前端文字、短信模板页的 a6 一侧、成本页的 a9 一侧：不在我的区域。
- 清单 a1 写的"展示后端 message"：按负责人的规则改成按码文字，没有展示 message（见 `refusal.ts` 文件头）。
- 需要改共享文件：无需要被拒绝的修改；我按最小增量改了 `src/locales/parity.test.ts`（额外键纳入检查）和三个别的区域的测试里的键数（见上）。

## 给主会话的提交说明

- `src/pages/campaign/settings.test.tsx` 和 `src/pages/moderation/rules.test.tsx` 里我只改了键数，但这两个文件里还有 campaign、moderation 区域未提交的修改，所以我没有把它们放进我的提交；键数的修改留在工作区，由它们的区域一起提交。
- `mock/config.mock.ts` 里有 campaign 区域的 `costCurrencyLock`（已是完整可用的代码），随这次提交一起进去。

## 问题文件

- `docs/contract-requests/2026-10-31-admin-frontend-config-refusal-reasons.md`（新）：手机号登录被拒缺哪几项的结构化字段；`attribution.facebook_graph_version` 的原因码；成对的键是否都列两个键；`app.supported_locales` 的同一原因码是否另有用途。

## 变更候选

- `guest.device_retention_days` 标为风险键（清单只写了"警告"）：按业界通行做法，会让游客额度被绕过的设置要有醒目警告，所以加了；负责人不要的话在 `extraConfigKeys.ts` 去掉 `risk: true`、删两条风险文字、把两处"7 个风险键"的测试改回 6。
- 拒绝的顶部框会滚动到可见处（页面很长）；如不需要，删 `TopRefusals` 里的 `scrollIntoView`。

# 追加：保存或重置 `push.default_locale` 被拒（清单 a5 的后半）

之前 cfg 和 msg 两个区域都认为这一条在对方，实际没人做；现在归设置页，已落实。立即修未修 0、记录项 0（本节新增）、未运行 0（本节新增，全量测试和构建仍留到最后）、阻塞 0。

- 清单 a5：保存 `push.default_locale` 时，某个有启用模板的召回原因没有新语言的启用模板，400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"push.default_locale","reason":"OUT_OF_RANGE"}]`，另有 `data.defaultLocale`、`data.reasons`（字母序）。
- 前端：`src/pages/config/refusal.ts` 的 `defaultLocaleWords`。显示在该键的行下，不附后端 message。有语言和原因时："默认语言不能改为 {lang}：这些召回原因有启用的模板、但没有 {lang} 的启用模板：{reasons}。先为每个原因启用 {lang} 的模板。"（英文同义，`config.push.default_locale.reject.OUT_OF_RANGE`）。`reasons` 逐个经 `plainText`，有 `push.reason.<码>` 的用它的文字，没有就显示原码；最多 50 个，用语言对应的列表连接词连起来，作为文本显示，不会被当成标记。没有语言或原因时退回一句通用的规则（`….OUT_OF_RANGE.general`），页面不依赖这两个字段。同一个键的其他原因码（例如空值）仍走原来的按码文字。
- 键的说明（`config.push.default_locale.desc`，中英文）写了操作顺序：先在推送模板页为每个有启用模板的召回原因启用新语言的模板，再改默认语言。
- 假后端：`mock/config.mock.ts` 的 `refusalFor` 读 `mock/_core/pushData.ts` 的模板数据（`pushState.templates`；没有复用 `mock/push.mock.ts`，因为 mock 文件只能默认导出，那里的规则是私有函数，这里按同一条规则另写）：只判有启用模板的召回原因（`daily_recall`、`streak_at_risk`），新语言必须有该原因的启用模板，标签精确比较（区分大小写），PUT 和 DELETE（按默认值 `en` 判）都判，返回 `data.defaultLocale`、`data.reasons`（字母序）。
- 红：`npx vitest run src/pages/config/ConfigForm.test.tsx mock/config.mock.test.ts -t "default language|push.default_locale"` 9 个失败（输出 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/cfg/red2.txt`）。绿：`npx vitest run src/pages/config mock/config.mock.test.ts src/locales` 7 个文件 505 通过；`npx tsc --noEmit` 退出码 0；biome 无问题。
- 测试位置：`mock/config.mock.test.ts` 文件末尾的 `describe('PUT and DELETE /config/push.default_locale …')`（原因、字母序、只判有启用模板的原因、只算启用的模板、区分大小写、重置、空值）；`src/pages/config/ConfigForm.test.tsx` 文件末尾的 `describe('ConfigForm: the push default language')`（英文、中文、逐个纯文本含 `<b>x</b>`、数字、对象、泰文、缺字段时的通用规则、保存成功、说明里有顺序）。
- 变异检查 6 个都被抓到：去掉假后端的规则（8 个红）；停用的模板也算（2）；标签不分大小写（1）；页面一律显示通用句（3）；原因显示原码（3）；原因不经 `plainText`（1）。
- 覆盖的语言：中文、英文、泰文（原因列表里的一项）；其余语言这里不涉及。
