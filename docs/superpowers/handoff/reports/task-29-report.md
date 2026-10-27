立即修未修 0、记录项 6、未运行 4、阻塞 0

# 任务 29 报告：应用版本与渠道包

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：实现、测试、假后端、路由、文字、问题文件和这份报告在同一个提交里（哈希见交回的简报）。

- 记录项：见下面"记录项"六条（其中两条要改共享文件：上传控件不把失败告诉页面、渠道列表的字段名）。
- 未运行：见"未运行"四条（非 Chromium 浏览器、对着真后端、真实的 100 MB 上传、中文界面只看了渲染）。
- 阻塞：无。契约和后端文件没写的点写成了问题文件，本任务按最小做法继续。

## 做了什么

两个页面，路由取规格 5.0 的"系统管理"里两行，页面权限码按规格：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/system/app-versions` 应用版本 | `APPVERSION:VIEW` | 顶部写明判定规则（四句，照规格的次序和意思）；筛选渠道包、平台、状态；列渠道包（名称加渠道码）、平台、版本名、版本号、最低版本号、状态、商店链接或 APK（DIRECT 渠道显示文件大小和 SHA-256 前 8 位）、创建人、激活时间，生效中的排前面；新建、编辑草稿（`APPVERSION:MANAGE`）、删除草稿（行内确认）、激活和下线（`APPVERSION:ACTIVATE`，下线行内确认"下线后该渠道将不再提示更新"）；已归档的没有操作 |
| `/system/channels` 渠道包 | `CHANNEL:MANAGE` | 列渠道码、名称、平台、分发方式、包名、启用开关、创建时间；新建弹窗（渠道码 `^[a-z0-9_-]{2,32}$`、名称、平台、分发方式、包名，渠道码、平台、分发方式创建后只读）；编辑只改名称和包名；启用只有开关（关掉先问）；没有删除 |

表单、激活和上传的细节：

- **版本表单**：渠道包创建后只读（编辑时是文字）；停用的渠道在下拉里灰掉；版本名 `x.y.z`；版本号整数，旁边写"该渠道当前生效的版本号 N（取自列表，仅供参考，以后端为准）"，输入不大于它就在字段下提示（创建、编辑草稿、激活三处，激活处是对话框里的警告）；最低版本号 ≥ 1 且不超过版本号，旁边写"低于此版本号的用户将被强制更新"；更新说明按语言分页签，英文第一个且必填，其余是 `GET /meta` 的 `supportedLocales` 加上草稿已有的语言，空语言不发。
- **STORE 渠道**：商店链接，输入时就校验（`validateStoreUrl`，见下），用所选渠道包的包名对照；没有 APK 控件；请求里没有 `apkUploadId`。
- **DIRECT 渠道**：APK 控件，旁边写类型和 `apkMaxBytes` 的上限，选好文件后、上传前检查扩展名、压缩包头和大小，显示上传进度；上传中提交按钮灰掉、表单提交也不发；上传成功后地址、大小、SHA-256 是文字（不是输入框）；请求只带 `apkUploadId`，不带地址、大小、校验和，也没有 `storeUrl`；编辑草稿没换文件时带当前的 `apkUploadId`，换了就带新的；后端说上传编号不能用时清掉文件、要求重新上传、不再发请求。上传返回 503 `DEPENDENCY_UNAVAILABLE` 时在控件旁写"先在系统配置里设置 `upload.public_base_url`"，持有 `CONFIG:MANAGE` 的管理员带 `/config` 链接，其余人只看到文字。
- **激活**：弹对话框。STORE 渠道写"激活后将成为该渠道唯一生效版本"和后果，必须勾选"新版本已经在商店对用户可见"才能点激活（按钮是灰的），请求带 `confirmStoreLive: true`；新最低版本号大于当前生效版本的版本号时用强提示（红色），读不到生效版本时也提示（黄色，不假装安全）；对话框每次打开都是空的（只在打开时挂载）。DIRECT 渠道不弹商店确认，只写"激活后该渠道的用户将被提示下载此 APK"，请求不带 `confirmStoreLive`。
- **`validateStoreUrl(platform, url, packageName?)`**（`src/pages/appVersions/storeUrl.ts`）：先过 `validateServerLink`；Android 必须是 `https://play.google.com/store/apps/details?id=<包名>`，主机不分大小写、路径精确、查询只许 `id`（必填一次，等于包名）、`hl`、`gl`（各至多一次，值是语言或地区），不许端口、用户信息、片段；没有包名时只检查 `id` 像不像应用包名；iOS 主机 `apps.apple.com`、路径两种形状。返回 `{ ok: true } | { ok: false; reasonKey }`，`reasonKey` 是语言文件里的键。

## 改了哪些文件

- 接口：`src/services/appVersions/{index,types,appVersions.test}.ts`（版本的六个接口、`readActiveVersion`、没有 `total` 或比页长的列表在浏览器里切页）；`src/services/channelPackages/{index,channelPackages.test}.ts`（渠道包的读、建、改，没有删除函数；读 `code`，没有再读 `channelCode`）。**没有改** `src/services/channels/getChannels.ts`（任务 9），渠道包页用自己的读取函数。
- 页面：`src/pages/appVersions/` 下 `versions.tsx`、`VersionModal.tsx`、`ActivateModal.tsx`、`ApkUpload.tsx`、`ChangelogField.tsx`、`storeUrl.ts`、`versionRules.ts`、`distribution.ts`、`useActiveVersion.ts`，从广告模块抄来的小件 `useServerPage.ts`、`PagedTable.tsx`、`FailureBar.tsx`、`useLatestRead.ts`、`texts.ts`、`uploadSlot.ts`（见记录项 2），测试辅助 `testSetup.ts`，和 `storeUrl.test.ts`、`versionRules.test.ts`、`distribution.test.ts`、`messages.test.ts`、`versions.test.tsx`、`versions.form.test.tsx`、`versions.activate.test.tsx`、`versions.upload.test.tsx`。`src/pages/channels/` 下 `channels.tsx`、`ChannelModal.tsx`、`channelRules.ts`、`channelRules.test.ts`、`channels.test.tsx`。
- 假后端：`mock/appVersions.mock.ts`、`mock/appVersions.mock.test.ts`、`mock/_core/appVersionsData.ts`（状态挂在 `globalThis`，`resetAppVersionsStore` 重置）、`mock/_core/channelsData.ts`（同样，`resetChannelsStore`）、`mock/channels.mock.test.ts`。**改了** `mock/channels.mock.ts`（任务 9 的文件）：加了 `POST /channels`、`PUT /channels/{code}` 和内存状态，`GET /channels` 的预置三行和字段保持不变（另外每行多一个 `code`，见记录项 3）。这是执行约定裁决 7 明文允许任务 29 做的；任务交代里说"不要改任务 9 的文件"，两处冲突，我按裁决 7 只改了这一个假后端文件（不改会让开发用假后端里新建的渠道不出现在列表里，也会让同一个路径在两个文件里重复，Umi 只警告并按文件顺序取后一个）。如果负责人不同意，撤回这个文件的改动即可，其余不依赖它。
- 路由：`config/routes/appVersions.ts`、`config/routes/channels.ts`（原来的空文件）、`config/routes/appVersions.test.ts`（两个页面一个测试）。
- 文字：`src/locales/{zh-CN,en-US}/appVersions.ts`、`channels.ts`（原来的空文件；`menu.system.appVersions`、`menu.system.channels` 在这两个文件里）。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-app-versions.md`。

## 测试数量

任务 29 路径下 15 个测试文件、261 个测试，全部通过：`storeUrl` 27、`versionRules` 16、`distribution` 3、`messages` 7、版本列表 22、版本表单 41、激活 17、上传进度 1、`channelRules` 9、渠道包页 34、版本接口 16、渠道包接口 8、版本假后端 40、渠道假后端 15、路由 5。另跑了 `src/locales`（两边键相同、没有重复键）、`tests/noHardcodedText.test.ts`（文字扫描）和 `mock/stats.mock.test.ts`（用到渠道假后端）：20 个文件 713 个测试全部通过。`npx biome check` 本任务路径没有错误（21 条 `noNonNullAssertion` 警告在测试文件里，见记录项 6）；`npx tsc --noEmit` 本任务路径没有报错。没有 `hardcodedText.allow.json`（扫描没有需要放行的条目）。

## 红到绿

先写测试，确认因"功能不存在"而红，再实现，再绿。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task29/` 的 `red-*.txt`。

| 文件 | 红 | 绿 |
|---|---|---|
| `storeUrl.test.ts` | `Failed to resolve import "./storeUrl"` | 27（含两个独立写法的对比：3 万条随机生成的 Android 链接、2 万条 iOS 链接、2 万条在合法链接上随机改字符的链接，抽样里合格和不合格都够多） |
| `versionRules.test.ts` | `Failed to resolve import "./versionRules"` | 16 |
| 两个接口测试 | `Failed to resolve import "./index"` | 24 |
| `mock/channels.mock.test.ts` | 把 `mock/_core/channelsData.ts` 挪走：`Failed to resolve import` | 15 |
| `mock/appVersions.mock.test.ts` | 把 `mock/appVersions.mock.ts` 挪走：`Failed to resolve import` | 40 |
| `config/routes/appVersions.test.ts` | 路由数组为空，3 个断言失败 | 5 |
| `versions.test.tsx` | `Failed to resolve import "./versions"` | 22 |
| `versions.form.test.tsx`、`versions.activate.test.tsx` | 同上 | 41、17 |
| `channels.test.tsx` | `Failed to resolve import "./channels"` | 34 |
| `channelRules.test.ts` | `Failed to resolve import "./channelRules"` | 9 |
| 页内把生效中的排前面 | 加测试后断言失败（`['d1','a1','x1','d2','x2']` 不等于 `['x1','x2','d1','a1','d2']`），再改页面 | 绿 |

要照实写：`messages.test.ts`、`distribution.test.ts`、`versions.upload.test.tsx`（上传进度）是实现之后写的，没有单独跑红；变异检查后补的测试（同一瞬间按两次、编辑已停用渠道、换渠道不带走链接、上传中的编辑草稿不发旧文件）是在对应变异活下来之后加的，加完再跑变异确认变红（下面"变异检查"）。

## 真实浏览器检查（Playwright，Chromium，端口 8329）

在 `scratchpad/task29/app` 的一份拷贝里跑（`config/config.ts` 关了 MFSU、换了缓存目录，`node_modules` 是链接，`src/.umi` 一起复制；拷贝里多一个 `mock/zzT29Reset.mock.ts` 用来在两次跑之间把样例数据放回，只在拷贝里）。脚本 `t29-browser.cjs`、日志 `t29-browser.log` 和 `t29-browser-final.log`、截图 `t29-*.png` 在同一目录。服务按监听进程的 PID（21200，先看了它的工作目录是我的拷贝）停掉，端口 8329 已空。看到的：

- 菜单"系统管理"下有"应用版本"和"渠道包"；页面标题正确；顶部四句规则在表上方。
- 版本列表：三个渠道的生效版本排最前；STORE 行有链接和"打开商店页面"，DIRECT 行是"19.72 MB · SHA-256 9a54550f"；操作列固定在右边，窄屏之外一直看得到（浏览器里发现原来要横向滚动才看得到，加了 `fixed: 'right'`，两个页面都改了）。
- 筛选：选渠道 `direct` 加状态"草稿"后只剩 1 行。
- 新建 STORE 版本：选渠道后"该渠道当前生效的版本号：110"出现；版本号 110、最低版本号 120、链接用 `play.google.com.evil.com`，三条错误都在字段下面；改对后提交，请求体 `{"versionName":"1.3.0","versionCode":130,"minVersionCode":130,"changelog":{"en":"Faster calls ⚡"},"storeUrl":"…&hl=th","channelCode":"play"}`，没有任何关于文件的字段；列表里出现新行。
- 新建 DIRECT 版本：浏览器自带的"选择文件"框不可见；旁边写"Accepted: APK · Max 100 MB"；没选文件提交提示"先上传 APK"；选 `.txt` 在上传前被拦（没有上传请求）；上传 APK 后地址、大小、SHA-256 显示为文字（里面没有输入框）；创建请求是 `{"versionName":"1.3.0","versionCode":130,"minVersionCode":1,"changelog":{"en":"Direct build"},"apkUploadId":"up-000001","channelCode":"direct"}`。
- 503：把 `POST /uploads/apk` 拦成 503 后控件旁出现"先在系统配置里设置 `upload.public_base_url`"，root 看到链接 `/config`。
- 激活：iOS 草稿（最低版本号 311 大于生效的 310）的对话框有唯一生效版本的说明、后果、红色强提示和勾选框；没勾时"激活"是灰的，勾上后双击只发了一个 `PUT …/status {"status":"ACTIVE","confirmStoreLive":true}`，旧的生效版本变成已归档；DIRECT 草稿的对话框没有勾选框，写"激活后该渠道的用户将被提示下载此 APK"。
- 下线的行内问句是"After it is taken down, this channel will no longer prompt users to update"，只发一个 `PUT … {"status":"ARCHIVED"}`；删除先问"Delete this draft?"，只发一个 `DELETE`。编辑草稿时对话框是这条草稿自己的值（版本名、渠道只读、英文说明）。
- 渠道包页：三行预置，没有删除按钮；渠道码填 `unknown` 被拦并说明；选 iOS 后"直接下载"灰掉；创建一个名称有 300 个泰文字符加阿拉伯语加 emoji 的渠道，请求体正确，页面没有横向滚动，名称在单元格里两行截断；开关关掉先问（问句里带名称和后果），确认后 `PUT {name, packageName, enabled:false}`；再打开不问；编辑弹窗里渠道码、平台、分发方式是文字，只能改名称和包名；新建的渠道出现在版本表单的渠道下拉里（读同一份列表）。
- 390 宽：两个页面都没有页面级横向滚动。zh-CN：两个页面的表头、规则、按钮都是中文，没有把语言键当文字显示。
- 控制台：只有登录第一步的 401 和我故意拦成 503 的上传，没有别的错误或警告。

## 变异检查

脚本 `t29-mutate.py`，变异清单 `t29-muts1.json` 到 `t29-muts4.json`，日志 `t29-mut1.log` 到 `t29-mut4.log`。每个变异改一处判断，只跑守这条判断的测试文件（`--bail=1`），确认变红再还原。**89 个变异，88 个被杀死（红），1 个是等价变异**（见下）。第一轮活下来 6 个，处理如下：

- "上传中提交（表单提交，去掉 `if (slot.busy) return`）"：新建 DIRECT 版本时没有 `uploadId`，本来就发不出去，测试看不出；这条守卫真正挡的是"编辑 DIRECT 草稿时上传新文件的途中提交，会带着旧文件发出去"。补了这个测试，变异变红。
- "换渠道后不清掉上一个渠道的商店链接"：补了"先填 Android 链接再换 iOS 渠道，链接是空的"的测试，变红。
- "激活对话框读不到生效版本时不用列表里的做后备"：第一次的替换文字没对上格式化后的源码（没有应用），改对后变红。
- "编辑渠道包时 `enabled` 写成 `true`"：测试只编辑了本来就启用的渠道；补了"编辑已停用的渠道，请求里 `enabled:false`"，变红。
- "`useSingleFlight` 去掉重复调用的守卫"：测试里第二次按在按钮已经转圈之后，Ant Design 的按钮自己就不理，所以守卫没被证明；补了四条"在同一瞬间（同一个 `act` 里）按两次"的测试（激活、删除确认、渠道包编辑提交、关闭开关的确认），去掉守卫后这些测试变红。
- "换渠道后别的渠道的生效版本提示还显示一帧"（去掉 `useActiveVersion` 里 `data.channel !== channelCode` 的比较）：**等价变异**。读取的新旧由 `useLatestRead` 的计数保证（那条变异被杀死），这一句只防换渠道那一次渲染里旧数据闪一下，副作用跑完之后数据已经清空，在 DOM 里看不到。留着当作双保险。

变异清单（结果都是变红，除上面写的）：

- `validateStoreUrl`（12）：不先过链接规则；主机分大小写比较；允许端口；允许片段；允许 `referrer`；`id` 不分大小写；路径只要以它开头；允许重复参数；`hl` 允许一个字母；iOS 主机分大小写；iOS 的 id 可以没有数字；不要求 `id`。
- 版本规则（6）：版本号等于生效版本被接受；最低版本号可以比版本号大 1；整数从 0 起；空白的英文说明被接受；版本名允许第四段；说明里保留空语言。
- 接口（4）：整张表不在浏览器里切页；任何版本都当作生效版本；`confirmStoreLive` 总是发；渠道码只读 `channelCode`。
- 版本假后端（9）：版本号等于生效的被接受；STORE 激活不要 `confirmStoreLive`；任何状态都能编辑、删除、激活；旧的生效版本不被归档；STORE 版本带上传编号被接受；已用的上传被接受；激活只要 `APPVERSION:MANAGE`。
- 渠道假后端（4）：`unknown` 能当渠道码；iOS 可以直接下载；渠道码可以改；渠道码重复被接受。
- 版本表单（14）：STORE 与 DIRECT 的字段对调；上传中提交按钮不灰；上传中表单提交也发；DIRECT 不要文件；编辑时不再带当前文件；503 不认；每个人都有 `/config` 链接；后端拒绝的上传编号被保留；版本号不与生效版本比较；编辑时渠道还能选；英文说明不检查；iOS 渠道用 Android 规则；停用的渠道能选；换渠道时链接不清。
- 激活对话框（8）：不要勾选；DIRECT 也发 `confirmStoreLive`；STORE 不发；相等时也用强提示；读不到生效版本时没有提示；DIRECT 也要勾选；版本号不大于生效版本时没有警告；不用列表里的做后备。
- 版本列表（12）：编辑对所有人；激活要 `MANAGE`；下线要 `MANAGE`；删除不问；下线不问；已归档的也有下线；新建按钮对所有人；显示完整校验和；所有链接都做成链接（`javascript:` 也是）；生效的不排前面；读不出渠道种类时按有文件判断被拿掉；种类不明时当 DIRECT。
- 读取的新旧（3）：旧的一页盖新的一页；旧的读取盖新的读取；别的渠道的生效版本提示还显示一帧（等价变异，见上）。
- 渠道包页（15）：渠道码允许大写；允许一个字符；`unknown` 能用；已有的码能用；iOS 保留直接下载；包名允许空格；关掉不问；没有 `CHANNEL:MANAGE` 开关也能用；编辑按钮对所有人；新建按钮对所有人；编辑也发 `code`；编辑把渠道打开；不把已有的码给表单；包名不转成 `null`；开关发错状态。
- 共用（2）：`useSingleFlight` 去掉守卫（见上）；上传前不检查大小。

## 覆盖了哪些语言

界面只有 zh-CN 和 en-US：三个页面各有一个中文渲染测试（表头、规则、按钮、帮助），两边键相同由 `src/locales` 的检查守住，另有 `messages.test.ts` 检查每条文字都是合法的消息（角括号会被当作标签）、两种语言的占位符相同、页面用到的键都有文字、文字没有闲置。真实浏览器里两个页面都看了中文，只看了渲染，没有在中文界面里逐个点操作（见未运行）。

假数据和测试：版本的更新说明有泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文（假后端的预置数据，`mock/_core/appVersionsData.ts`，有测试断言七种语言都在）；页面测试里：5000 个无空格泰文字符的渠道名、阿拉伯语加 emoji 的渠道名、300 个 emoji 的渠道名、3000 个字符的包名（表格里两行截断、`overflow-wrap: anywhere`）；表单里 5000 个泰文字符的更新说明、阿拉伯语说明、emoji 说明都能填入并原样发出；泰语渠道名在真实浏览器里创建成功。印尼语、越南语、西班牙语只出现在预置数据里，页面的排版测试没有单独用它们。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-app-versions.md`：渠道包列表的字段名（`code` 还是 `channelCode`）和形状、创建和修改的请求体、`PUT` 是整条替换还是只改带来的字段、名称和包名的限制、错误细节；版本列表分不分页和行里的字段（`apkUrl` 等）、数字的范围、更新说明的限制、字段错误怎样指到字段、激活 DIRECT 版本时文件校验失败的原因、409 `INVALID_STATE` 的几种原因怎样区分、版本号重复的错误、商店链接用的包名取哪个、iOS 链接的形状；APK 上传失败的原因（缺 v2 签名）、503。规格需要改的两处见下面。没有一处是阻塞。

## 需要改共享文件

1. `src/components/UploadField.tsx`：加可选的 `onFailed(error)`（返回 `true` 表示页面自己说这个失败），页面才能在 503 时写"先设置 `upload.public_base_url`"；同时在 Ant Design 表单里原生"选择文件"框会重新露出来（`hidden` 被表单样式盖掉，形象、推送、广告模块都报告过）。本模块在自己目录里放了 `ApkUpload.tsx`（输入框用 `style={{ display: 'none' }}`）。改好后删它。
2. `src/services/channels/getChannels.ts` 第 4、26、27 行和 `src/components/ChannelSelect.tsx` 第 52 行：按 `channelCode` 读渠道，并把没有 `channelCode` 的行丢掉。契约 §24.7 的 `Channel` 实体列是 `code`，后端回复说响应字段按实体列名一字不差；如果真后端返回 `code`，统计筛选、目录、投放账户、广告报表里所有渠道下拉都是空的。我没有查清真后端怎么返回（后端的四份文件没写），所以不当作结论，已在问题文件第一节问了；建议先让这个读取两种都认。
3. `src/locales/*/reason.ts`：如果后端给缺 v2 签名等原因码，要加这些码的译文（共享文件）。等后端回复。

## 规格需要在 main 上修改的地方

1. 5.19 APK 上传一句"文件没有 v2 以上签名时显示后端的错误原因"与已定的"错误码已知时只显示译文"冲突：要么后端给专用的原因码并加译文，要么改成"显示 `INVALID_FILE` 的译文并在上传区旁写明需要 v2 以上签名"（现在页面是后者）。
2. 渠道包的字段名在契约里是 `code`，任务 9 的读取和问题文件写的是 `channelCode`，要统一。

## 记录项（6）

1. `src/pages/appVersions/ApkUpload.tsx`（整个文件）：共用 `UploadField` 的副本，见"需要改共享文件"第 1 条。触发：以后共用控件改了限制文字或检查，这份不会跟着变。
2. `src/pages/appVersions/{useServerPage.ts,PagedTable.tsx,FailureBar.tsx,useLatestRead.ts,texts.ts,uploadSlot.ts}`：广告、投放、成本模块里同样小件的又一份副本，渠道包页也从这里引用。不是错误，是重复；建议移到共用目录后删副本。
3. `mock/channels.mock.ts:20`：开发用假后端的每一行同时有 `code` 和 `channelCode`，所以任务 9 的下拉在假后端上正常，掩盖了"需要改共享文件"第 2 条的问题。触发：真后端只给 `code` 时，假后端上看不到。
4. `src/pages/appVersions/VersionModal.tsx:101`（`uploadRefused`）：版本创建或修改被 409 `INVALID_STATE` 拒绝时，如果请求带了新上传的文件，而 `data.status` 不是草稿、生效中、已归档，就当作"上传编号不能用"，清掉文件并要求重新上传。渠道刚好被停用时同样是 409（契约没有区分），这时文件其实没问题。触发：选了一个渠道、上传了 APK、有人停用了这个渠道、提交。结果：多一次重新上传，同时显示 409 的译文。问题文件第三节第 6 条请后端给确定的取值。
5. `src/services/appVersions/index.ts` 的 `readActiveVersion`：只读 `status=ACTIVE` 的第一页（20 条）并在里面找同渠道的；后端要是不按 `status` 过滤、又不把生效中的排前面，生效版本可能不在这一页，页面会写"该渠道目前没有生效版本"。契约写了排序，所以现在不会发生。触发：后端不按 `status` 过滤且排序不是生效中在前。
6. 测试文件里的 `lint/style/noNonNullAssertion` 警告（`versions.test.tsx`、`versions.form.test.tsx`、`channels.test.tsx` 里 `Map.get(...)!`）：biome 配置里是警告，不拦提交。触发：`npx biome check` 本任务路径。

## 变更候选

- 版本列表和表单里没有地方看非草稿版本的更新说明（规格列的列里没有，表单只对草稿开放）。运营想看生效中或已归档版本发过什么说明时看不到。要加的话是新增行为（行展开或详情抽屉），需要先定。
- 渠道包的"启用"现在只在列表里用开关改；规格"编辑只能改名称、包名、启用"也可以读成编辑弹窗里也有启用。要不要在弹窗里再放一个，需要先定。

## 未运行（4）

- 非 Chromium 浏览器（Firefox、Safari）：APK 控件的文件头读取、`display: none` 的文件输入、固定在右边的操作列。
- 对着真后端：请求体、列表形状、字段名（`code` 还是 `channelCode`）、`apkUrl` 是否在列表行里、错误里的 `details` 和 `data.status`、`POST /uploads/apk` 的真实返回和 503，都是按假后端和契约做的，见问题文件。
- 真实的大文件上传（100 MB 的 APK）：只用了 2 KB 的文件（只有压缩包头），假后端不读文件内容；进度条只在测试里用假的进度回调看过，浏览器里上传一闪而过。
- 中文界面里的操作：中文只在测试和浏览器里看了渲染（表头、规则、按钮、帮助文字），没有在中文界面里逐个点操作（校验文字、激活对话框、关开关的问句只看了英文）。
