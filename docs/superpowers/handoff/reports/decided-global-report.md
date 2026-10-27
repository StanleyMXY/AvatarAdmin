立即修未修 0、记录项 5、未运行 3、阻塞 0

# 已定变更项报告：区域 global（请求层与全局）

分支 `claude/jolly-dirac-4pq9g6`，Node 24.22.1。依据：`docs/superpowers/handoff/decisions-2026-10-27.md` 的"全局行为"一节。没有推送。提交哈希见主会话回复（报告和代码在同一个提交里）。

## 四个数字怎么来的

- **立即修未修 0**：做的过程中自己发现并当场修了两条（见"自检发现"），都带了测试。
- **记录项 5**：见"记录项"一节，每条有文件行号和触发步骤。
- **未运行 3**：全量测试（按规矩留到全部任务做完后跑一次）；构建（同上）；浅色模式下的真实浏览器检查只看了暗蓝、深青、浅色三种模式的主色文字，没有逐个页面看一遍（只看了 `/users/list`、`/dashboard`、`/system/audit`、`/stat/daily`）。另外 `npx tsc --noEmit` 整个项目在我收尾时是 0 个报错。
- **阻塞 0**。

## 做了什么

### 1. 请求超时（普通 30 秒，上传和导出下载 5 分钟，下载可取消，超时显示"请求超时，请重试"）

- 新文件 `src/request/timeout.ts`：`DEFAULT_TIMEOUT_MS = 30_000`、`TRANSFER_TIMEOUT_MS = 300_000`、`startDeadline(ms, outerSignal)`（返回合并了调用方取消信号的 `signal`、`timedOut()`、`dispose()`）、`timeoutError()`。调用方自己取消仍是 `AbortError`，只有时间到了才是新错误码 `REQUEST_TIMEOUT`（`httpStatus` 0）；两者靠 `timedOut()` 区分。
- `src/request/apiClient.ts`：`apiRequest` 加可选 `timeoutMs`，30 秒，计时覆盖"等响应头加读完响应体"，请求结束或失败都清计时器；信号已经取消时不发请求（`throwIfAborted`）。`transportFailure(cause, deadline)` 不保留浏览器自己的错误信息（它可能带请求地址）。
- `src/request/download.ts`：`downloadFile` 加 `signal`、`timeoutMs`，5 分钟，计时覆盖整个下载包括响应体；读完最后一块时才取消也不保存；超时或取消都不保存文件。
- `src/request/upload.ts`：`xhr.timeout = 300000`，`ontimeout` 现在是 `REQUEST_TIMEOUT`（原来和网络错误混在一起）；可传 `timeoutMs`。
- `src/components/ExportButton.tsx`：下载进行中多一个"取消"按钮（`pages.common.cancel`），取消后提示"已取消导出"（新键 `pages.export.cancelled`），不显示错误；离开页面（组件卸载）会取消下载且不提示。
- 文案：`error.REQUEST_TIMEOUT`（zh-CN"请求超时，请重试"，en-US"Request timed out. Please try again."），两个语言文件都加了。
- `src/request/errors.ts`：`timeoutError()` 和 `ApiError` 文档里补上新码。

### 2. 网关 502/503/504 的页面和"重试"

- `src/request/envelope.ts`：没有信封的 502、503、504 应答是 `GATEWAY_UNAVAILABLE`（原来是 `INVALID_RESPONSE`），信息里不带网关页面的内容，只带状态码；500、501、505 和 2xx 的 HTML 页仍是 `INVALID_RESPONSE`；带信封的 503（如 `TEMPORARILY_UNAVAILABLE`）仍按后端的码。上传、下载走同一个函数，同样生效。
- 文案：`error.GATEWAY_UNAVAILABLE`（zh-CN"服务暂时不可用，请稍后重试"，en-US"The service is temporarily unavailable. Please try again later."）。
- 新文件 `src/request/serviceStatus.ts`：只记一个布尔值"网关是否说服务不可用"。`apiRequest` 里：GET 遇到网关页面置为不可用；任何成功或后端自己的错误应答（不是网络错误、超时、无法识别的应答）置回可用。POST、PUT、DELETE 遇到网关页面不置位，上传、下载也不置位，所以"重试"只对读请求出现。
- 新文件 `src/components/layout/ServiceNotice.tsx`，挂在 `TabManager.tsx` 页面上方：警告条写 `error.GATEWAY_UNAVAILABLE`，带"重试"按钮；按钮把当前页面重新载入（同标签页右键"刷新"用的同一个机制），警告条随之消失；打开别的页面也会消失。

### 3. 颜色对比度专用文字色

- `src/theme/contrast.ts`：新增 `mixHex`、`readableText(color, backgrounds, min = 4.5)`（颜色已经达到就原样返回；否则沿"离背景远"的方向一点点混合，直到所有背景上都达到 4.5:1）、导出 `luminance`。
- `src/theme/modes.ts`：`ModeTokens` 新增 `colorLink`、`colorLinkHover`、`colorLinkActive`（对容器、页面、悬浮三种背景都 ≥ 4.5:1，悬浮和按下越来越离开背景）。给 Ant Design 的 `colorLink*` 和 `colorPrimaryText*` 用这些色，另外 `Menu`（选中、子菜单选中、横向选中）、`Tabs`（选中、悬浮、按下）、`Pagination`（当前页、悬浮）的选中色也用它们。原来的 `colorPrimary` 仍用于按钮底色、边框这类填充。`getModeTokens(mode, primary?)` 可以传构建变量里的另一套主色，测试用它验证任意主色。
- 真实情况：暗色算法会自己重算链接色和主色文字色，把我们给的盖掉（最先写的测试在暗蓝、深青里红了，4.42 和 4.38），所以 `keepPrimary` 现在会把这几个种子色放回去。原来的实际值也有问题：浅色模式默认链接色 `#1677ff` 在白底上 4.09:1，悬浮色 `#69b1ff` 更低；暗色默认链接色 `#1668dc`；主色 `#0ABAB5` 在白底上 2.41:1，暗蓝里的按下色 `#089A96` 只有 4.06:1。
- 浏览器里测到的结果（`/users/list`）：暗蓝里选中标签页文字 5.82:1，深青 6.73:1，浅色 4.78:1；浅色里页码、链接、子菜单标题都变成 `rgb(7,128,125)`（`#07807D`，白底 4.78:1）。

### 4. 参数页标签标题带标识

- `src/components/layout/pageIndex.ts`：`pageIdentifier(pages, pathname)`（参数路由取参数值，如 `/users/42` 得 `42`；固定路径没有标识；解码百分号编码；去掉控制字符和方向控制字符；超过 20 个码点截成前 19 个加 `…`）和 `titleWithIdentifier(title, id)`（`用户详情 · 42`）。
- `src/components/layout/TabManager.tsx`：标签标题用它们，所以 `/users/42` 和 `/users/43` 是"用户详情 · 42"、"用户详情 · 43"。
- 浏览器窗口标题：新文件 `src/components/layout/pageTitle.ts` 的 `pageTitleRender`，由 `src/app.tsx` 的 `layout` 里的 `pageTitleRender` 用：`用户详情 · 42 - Admin`。没有页面名的（路径不是页面）不加标识。
- 路由顺序：没有动 `config/*`。`mergeMenus` 仍把参数路由排在固定路径之后（`config/assembleRoutes.test.ts` 的顺序测试没动，也没红）；标识只在渲染时根据实际地址算，和路由顺序无关，`pageIdentifier` 对"固定路径优先于参数路径"有测试（`/users/list`、`/users/abuse` 在参数路由排在最前时仍不带标识）。

### 5. 假后端 `supportedLocales`

- `mock/_core/meta.ts`：`['en', 'zh-Hans', 'th', 'ar', 'id', 'vi', 'es']`（泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，英文在最前），注释写明这是和契约默认值（只有 `en`）的唯一差别。`README.md` 里同一句话已更新。

## 测试文件和行号

- `src/request/timeout.test.ts`（整个文件：两个时限、`timeoutError`、`startDeadline` 的到点、跟随调用方、已取消、`dispose`）。
- `src/request/apiClient.test.ts:380` 请求时限（29.999 秒不断、30 秒断；写请求也受限；读响应体也算；自定义时限；调用方取消仍是 `AbortError`；信号已取消不发请求；正常应答、失败后计时器清零；超时不碰会话），`:481` 令牌和被审核文件地址不出现在错误和控制台里（网关页、无法识别的应答、网络错误、超时四种），502/503/504 映射在 `:297` 附近。
- `src/request/download.test.ts:257` 网关页，`:269` 5 分钟（299.999 秒不断）、读响应体途中超时不保存、等应答时超时、自定义时限、响应体途中取消、等应答时取消、信号已取消不发请求、最后一块时取消不保存、完成后计时器清零、错误里没有令牌和地址。
- `src/request/upload.test.ts`：5 分钟、自定义时限、超时是 `REQUEST_TIMEOUT` 且不碰会话、504 页是 `GATEWAY_UNAVAILABLE`。
- `src/request/envelope.test.ts`：502/503/504 的 HTML、空体、纯文本；500/501/505/400/404/200 仍是 `INVALID_RESPONSE`；带信封的 503 保持后端的码。
- `src/request/serviceStatus.test.ts`：布尔值与监听、GET 遇 502/503/504 置位、写请求不置位、500、超时、断网不置位、成功和后端错误应答复位、超时和 HTML 不复位、上传下载不置位。
- `src/components/ExportButton.test.tsx:199` 取消、中文、离开页面、5 分钟超时文字、网关文字。
- `src/components/layout/TabManager.test.tsx:160` 标识（两种语言），`:449` 警告条（语言、重试重新载入页面、自动消失、换页消失）。
- `src/components/layout/pageIndex.test.ts:91`、`:138` 标识的各种输入（泰语、阿拉伯数字、emoji、无法解码、方向控制字符、5000 字符、20 码点边界）。
- `src/app.test.tsx:75`、`:99` 窗口标题。
- `src/theme/contrast.test.ts:82`、`:94`（`mixHex`、`readableText`：已达标原样返回、浅色变深、暗色变浅、任意颜色都能达到、可传别的下限）；`src/theme/modes.test.ts:212`（三个模式 × 六个 Ant Design 实际解析出的链接和主色文字色，对三种背景按公式算对比度 ≥ 4.5；六套构建主色；悬浮、按下离背景越来越远；Menu、Tabs、Pagination 用专用色）。
- `src/locales/error.test.ts:75` 两个新文案的文字，新码也进了"没有多余键"检查。
- `mock/auth.mock.test.ts:361` 起：七种语言、英文在最前、不重复、返回的是副本。
- `tests/httpStubs.ts`：`FakeXHR` 加 `timeout` 属性（共享测试辅助，见"需要改共享文件"）。

## 运行过的命令和结果

红（实现之前，同一批测试）：
- `npx vitest run src/request`：`Test Files 5 failed | 2 passed`，`Tests 26 failed | 135 passed`（26 条都是"功能不存在"：没有 `timeout` 模块、网关页仍是 `INVALID_RESPONSE`、`xhr.timeout` 没设）。
- `npx vitest run mock/auth.mock.test.ts`：`3 failed | 49 passed`。
- 主题：把 `modes.ts`、`contrast.ts` 临时换回 `HEAD` 版本再跑 `npx vitest run src/theme`：`34 failed`（`mixHex`、`readableText`、`colorLink*` 都不存在）。
- 另外，第一次实现后 `src/theme/modes.test.ts` 在暗蓝、深青里因暗色算法覆盖链接色红了（4.42、4.38），修 `keepPrimary` 之后变绿。

绿：
- `npx vitest run src/request src/theme src/components/layout src/components/ExportButton.test.tsx src/locales/error.test.ts src/locales/parity.test.ts src/app.test.tsx tests/noHardcodedText.test.ts mock/auth.mock.test.ts`：`Test Files 22 passed (22)`，`Tests 714 passed (714)`。
- `npx vitest run mock`：`Test Files 35 passed (35)`，`Tests 924 passed (924)`（`supportedLocales` 改动之后）。
- 用到默认 `META` 的页面：`npx vitest run src/pages/ads/creatives.test.tsx src/pages/appVersions/versions.form.test.tsx src/pages/appVersions/versions.test.tsx`：`3 passed`，`133 passed`；用到导出按钮的 `src/pages/sms/records.test.tsx`、`src/pages/invite/records.test.tsx`、`src/pages/cost/report.test.tsx`：`68 passed`。
- `npx tsc --noEmit`：0 个报错。`npx biome check`（我改的所有路径）：干净。注意：`biome check --write` 曾把我写在正则里的 `‎` 转义改成原始的方向控制字符，被"禁止写死文字"扫描抓到；已改回转义，之后只用 `biome format --write`。
- 看到但不是我的：`src/locales/switch.test.tsx` 的"sign-in form: a message that is already on screen is written again in the new language"在我这边是红的；它属于别的代理正在改的"切换语言后重新校验"（`src/hooks/useRevalidateOnLocaleChange*`、登录页都有未提交的改动），我没有碰。

## 变异检查（每个都把代码改坏，跑相关测试，再还原）

全部变红（括号里是变红的测试数），脚本在 scratchpad，不进仓库：
- 默认时限 30 秒改 31 秒（1）；传输时限 5 分钟改 30 秒（1）；计时到点不标记超时（1）；`dispose` 不清计时器（1）；调用方取消时不清计时器（1）；不跟随调用方信号（1）；`apiRequest` 给 fetch 的是调用方信号而不是合并信号（6）；`transportFailure` 不看计时（4）；`apiRequest` 不 `dispose`（2）；信号已取消仍发请求（1）。
- 下载不把信号给 fetch（6）；下载读完后不检查取消（1）；下载读响应体出错不看计时（3）；上传不设 `xhr.timeout`（2）；上传超时当网络错误（1）。
- 网关状态少 504（1）；网关状态多 500（1）；写请求也置位（3）；后端错误应答不复位（1）；成功不复位（1）。
- 导出按钮取消不中止（2）；离开页面不中止（1）；取消显示失败文字（2）；不传信号（3）。
- 标签页：换页不清警告条（1）；重试不重新载入页面（1）；标题不带标识（2）；标识不截断（1）；标识保留方向控制字符（2）；固定路径也带标识（7）；窗口标题不带标识（1）。
- 主题：链接色取原主色（6）；`keepPrimary` 不放回种子色（2）；`readableText` 下限 4.5 改 4.0（3）；悬浮色等于基色（3）；菜单选中色取原主色（1）。
- 假后端 `supportedLocales` 改回一种语言（3）。
- 一个没红：把 `readableText` 的两个方向顺序对调仍绿，因为第一个方向混到头也达不到时会自动试另一个方向，结果相同（等价变异，不是测试漏洞）。

## 令牌和被审核内容的文件地址（深度评审范围）

- `src/` 下除自动生成的 `.umi*` 外没有 `console.*`、`debugger`。
- 新增的错误信息都是固定英文：`The request took too long.`、`The service is temporarily unavailable (HTTP 502).`；不带地址、不带网关页面内容、不带浏览器抛出的原始错误（`transportFailure` 丢弃 `cause`）。测试里用带令牌和带签名参数的文件地址（`?X-Signature=...`）跑网关页、无法识别的应答、网络错误（浏览器的错误信息里故意带了地址和令牌）、超时四种失败，断言 `String(e)`、`message`、`JSON.stringify(e)`、`data` 里都没有令牌、`X-Signature`、域名，控制台五个方法都没被调用（`apiClient.test.ts:481`）；下载超时同理（`download.test.ts` 最后一条）。
- 令牌仍只在 `Authorization` 头里；超时、取消、网关页不触发会话过期处理（有测试）。
- 标签页标识来自地址路径，会存进 `localStorage` 的标签列表（原来就存路径，没有新增的存储）。

## 真实浏览器检查

`PORT=8391 npm run dev:mock`，Playwright（Chromium，zh-CN），登录 `root`，服务按监听进程的 PID 停掉。看到：
- `/users/42`：标签"用户详情 · 42"，窗口标题"用户详情 · 42 - Admin"；`/users/` 加泰语和阿拉伯数字的标识：标签和窗口标题都对；`/users/list`："用户列表 - Admin"，没有标识。
- 发现并修了一条：未登录或路径不是页面时窗口标题是"Admin · 42"（页面名退化成产品名也被加了标识），现在只有"页面名 - 产品名"的形式才加。
- 把 `GET /api/admin/users?...` 拦下来返回 503 HTML：出现"服务暂时不可用，请稍后重试"的警告条加"重试"，同时表格自己的错误条也出现（见记录项 4）；放行后点"重试"：警告条消失，表格有 21 行。
- 统计日报页：导出请求永不返回，点"导出"后出现"取消"按钮，点它出现"已取消导出"。
- `GET /api/admin/users?...` 永不返回：33 秒后出现"请求超时，请重试"（30 秒加页面渲染）。
- 控制台错误只有：第一次登录的 401（需要二次验证码）、两个不存在的用户 ID 的 404（假后端）、故意注入的 503。
- 三种主题模式的选中标签页、页码、链接：见上面第 3 条。只覆盖了中文界面（`zh-CN`），英文界面只有单元测试。

## 没做的和原因

- 没有给 PagedListTable 去重：网关页时列表页会同时出现全局警告条和表格自己的错误条，各有一个"重试"（见记录项 4）；去重要改 `src/components/PagedListTable.tsx`，不在这一项的范围里。
- 没有给读请求的超时（30 秒）出重试按钮：决定里只写了网关页要"重试"；读请求超时只显示文字，列表页本来就有自己的"重试"。
- 浅色模式下还有两处主色文字没能用主题 token 修掉（见记录项 1、2）。
- 5 分钟的上传时限是决定里的值；200 MB 的上传限制（`uploadMaxBytes`）在约 5.5 Mbps 以下的网速上会在 5 分钟内传不完，显示"请求超时，请重试"。这是这个时限的直接后果，不是缺陷，按决定保留。

## 自检发现（按分类）

- **立即修，已修**：(1) 暗色算法覆盖链接色，使暗色的链接色测试红（4.42 和 4.38），已修（`keepPrimary` 放回种子色）；(2) 页面名退化成产品名时窗口标题错成"Admin · 42"，已修并加了测试（`src/app.test.tsx:99` 起）。
- **记录**（各带文件行号和触发步骤）：见下。
- **变更**：无新增。
- **不是缺陷**：把 `readableText` 两个方向对调测试仍绿：`src/theme/contrast.ts` 的 `readableText` 先试一个方向，混到头仍不够会试另一个方向，两种顺序的结果相同，等价变异。
- **阻塞**：无。

## 记录项

1. 浅色模式下选中的圆角单选按钮（`optionType="button"` 的 Radio）文字仍是原主色 `#0ABAB5`，白底 2.41:1。`src/pages/dashboard/TrendSection.tsx:103`；触发：浅色模式，打开 `/dashboard`，看趋势图的时间范围单选。Ant Design 的这个样式直接用 `colorPrimary`，没有对应的组件 token，要么改成别的控件，要么写一条全局样式。
2. 浅色模式下查询表单的"展开/收起"链接文字仍是原主色，白底 2.41:1。`src/components/PagedListTable.tsx:81`（`search={{ ... }}`）；触发：浅色模式，打开 `/users/list` 或 `/system/audit`，看查询表单右侧的"展开"。这个样式来自 pro-form 自己的 `token.colorPrimary`。
3. 次要文字和占位文字（`colorTextDescription`、`colorTextTertiary`，Ant Design 默认是 45% 透明度）按公式算，浅色白底 3.35:1，暗蓝 4.09:1，深青 4.34:1，都低于 4.5:1。`src/theme/modes.ts` 的 `toAntdTheme` 里没有覆盖这两个 token；触发：任何页面里表格空状态的"暂无数据"、输入框占位文字。决定里只写了主色文字和暗色链接色，这一条超出，所以只记录。我没有在浏览器里逐个确认哪些组件在用它们。
4. 网关页时列表页出现两个"重试"：`src/components/layout/ServiceNotice.tsx`（全局警告条）加 `src/components/PagedListTable.tsx:57` 起的表格自己的错误条。触发：把列表接口拦成 503 HTML，打开 `/users/list`，两条提示各一个"重试"。功能都对，只是重复。
5. 假后端 `GET /config` 里 `app.supported_locales` 默认还是 `["en"]`（`mock/_core/configDefaults.generated.json:132`），和现在 `GET /meta` 的七种语言不一致，`PUT /config/app.supported_locales` 也不影响 `GET /meta`（`mock/auth.mock.ts:141` 每次返回 `META_DEFAULTS` 的副本）。触发：在假后端上进"系统配置"页看"支持的界面语言"是一种语言，而推送模板的语言矩阵是七列。

## 需要改共享文件（已按最小做法改了，请知悉）

- `tests/httpStubs.ts`：`FakeXHR` 加 `timeout = 0`（上传超时的测试要读 `xhr.timeout`）。
- `src/locales/zh-CN/error.ts`、`src/locales/en-US/error.ts`：各加 `error.REQUEST_TIMEOUT`、`error.GATEWAY_UNAVAILABLE`；`src/locales/zh-CN/pages.ts`、`src/locales/en-US/pages.ts`：各加 `pages.export.cancelled`；`src/locales/error.test.ts` 的本地码列表加两个码。
- `src/request/*`（请求层，本来就是这一项的范围）、`src/app.tsx`（加 `pageTitleRender`）、`src/components/ExportButton.tsx`、`src/components/layout/TabManager.tsx`、`src/theme/*`、`mock/_core/meta.ts`、`README.md` 一句话。

## 规格需要在 main 上修改的地方

无。`GATEWAY_UNAVAILABLE` 和 `REQUEST_TIMEOUT` 是前端自己的本地错误码（和 `NETWORK_ERROR` 同类），不是契约错误码，所以不在 `errorCodes.generated.json` 里；契约里的 `SERVICE_UNAVAILABLE` 一词是安卓安装来源库的状态，不是接口错误码，我故意没有用这个名字。

## 问题文件

无新增（这一项只涉及前端自己的行为）。
