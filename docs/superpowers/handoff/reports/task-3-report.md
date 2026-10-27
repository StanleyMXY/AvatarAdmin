# 任务 3 报告：请求层

立即修未修 0、记录项 15、未运行 1、阻塞 0；另有 3 项"变更"等负责人决定（不阻塞，本任务按计划的行为完成）。复审（只验证上一轮的发现）的结果见末尾。

提交：`81f761f`（请求层、语言文件、错误码清单、测试）、`5ed838b`（评审的立即修项）。环境：Node 24.22.1。

## 文件

- `src/request/`：`envelope.ts`（信封解析和判成功）、`errors.ts`（`ApiError`、`Page`、`describeError`）、`session.ts`（令牌：内存加 `sessionStorage`，过期和无权限的处理）、`apiClient.ts`（`apiRequest`、地址和查询、请求头、会话信号）、`download.ts`（xlsx 下载）、`upload.ts`（带进度的上传）；每个都有同名测试。
- `src/locales/`：`zh-CN/error.ts`、`en-US/error.ts`（契约 §1.4 的 79 个码加 `NETWORK_ERROR`、`INVALID_RESPONSE`、`UNKNOWN`，各 82 条）、`zh-CN/reason.ts`、`en-US/reason.ts`（14 个原因代码）、`errorCodes.generated.json`、`error.test.ts`。
- `tests/httpStubs.ts`：`fetch` 和 `XMLHttpRequest` 的桩。
- 错误码清单的原始输出：`docs/superpowers/handoff/reports/task-3-error-codes-raw.txt`（79 行，每行一个码）。生成命令：`sed -n '/^### 1\.4 通用错误码/,/^### 1\.5/p' docs/shared-snapshots/backend-task-java-backend.md | grep -o -E '^\| [A-Z][A-Z_]+ \| [0-9]{3} ' | awk '{print $2}'`，行数 79，与规划时一致；测试 `error.test.ts` 每次从契约快照重新取一遍并逐项逐序对比。

## 红到绿

- 红：`npx vitest run src/request src/locales`，7 个测试文件都报 `Failed to resolve import ... Does the file exist?`（模块不存在）。
- 绿：实现后一次通过，7 个文件 320 个测试；补了 1 个文件名方向字符用例后 321 个；`tsc --noEmit` 退出 0（中途修了测试里 mock 的类型）；`npm run lint` 干净。评审修复后 `src/request` 下 123 个测试通过。
- 我自己做的变异检查（改源码副本，看测试是否变红），全部被拦住：去掉旧令牌保护、去掉只触发一次的锁存、任何 401 都过期、下载不看状态码、下载不看内容类型、忽略 HTTP 状态判成功、保留空字符串参数、上传不处理已取消的信号。

## 与计划的对应

- 成功判断 `code === "200"` 且 HTTP 2xx；HTTP 200 但码不是 200 → `ApiError`；错误状态带成功码 → `INVALID_RESPONSE`；429 没有信封 → `RATE_LIMITED`；其他非信封 → `INVALID_RESPONSE`；`fetch` 抛异常 → `NETWORK_ERROR`；取消 → 原样的 `AbortError`。
- 401 `ADMIN_INVALID_TOKEN` 清令牌并调用 `onExpired`，并发只一次；登录页的三个 401 码不触发。额外加了一条保护：慢响应带着旧令牌回来、而此时已经用新令牌登录，则不清新令牌。
- 403 `ADMIN_FORBIDDEN` 调用 `onForbidden`，不清令牌。
- 下载：只有 2xx 且内容类型是 xlsx 才保存；JSON 错误体变成 `ApiError`，一律不保存；文件名取 `filename*`（含泰语、阿拉伯语、中文、emoji），去掉路径、控制字符、方向控制字符；进度回调收到累计字节数。
- 上传：`XMLHttpRequest` 的 multipart，字段名 `file`，不手设 `Content-Type`，进度、取消（发送前、发送中、完成后）。
- 令牌只在内存和 `sessionStorage`，从不写 `localStorage`、地址、日志、错误对象。
- `url` 是 `/api/admin` 之后的路径（`/users` → `/api/admin/users`），以 `/api/` 开头的原样使用。当前语言由 `setLocaleProvider` 提供，默认读 `localStorage` 的 `avatar-admin.locale` 再按浏览器语言；任务 6 的外壳要调用它。

## 评审（深度：不同上下文的评审者，约 130 个变异，逐项复现）

结论：立即修 1（已修）、记录 15、变更 3、不是缺陷 5、阻塞 0、未运行 1。

### 立即修（已修，`5ed838b`）

- `src/request/session.ts` 的 `resetSessionState()` 注释说它用于"退出登录"，但它不清 `sessionStorage`：`setToken('abc'); resetSessionState(); getToken()` 得 `'abc'`。后果：任务 7 照注释实现退出登录，用户点退出后令牌仍在，下一次请求又带上它。已把注释改为"测试辅助，退出登录用 `clearToken()`"，加两个测试固定两种行为，并用变异验证（让 `clearToken` 不清存储，3 个测试变红）。

### 记录（15 项，建议最后一批全部修）

1. 会话回调（`onExpired`、`onForbidden`）抛异常时，`apiRequest`、`downloadFile` 抛出的是回调的错误而不是 `ApiError`；`uploadFile` 的 Promise 永远不结束（`src/request/upload.ts:34-41`、`apiClient.ts:73-90`）。步骤：回调里 `throw`。后果：进度条一直转，无法重试。
2. `describeError` 收到非 `ApiError`（`TypeError`、`DOMException`）会崩，`e.details.map` 读 undefined（`errors.ts:82`）；`downloadFile` 在 `new Blob`、`createObjectURL` 失败时抛的是没有 `code` 的普通错误（`download.ts:132`）。后果：页面 `catch` 里调 `describeError` 时错误处理本身再抛，用户看不到任何提示。
3. 文件名清理漏掉不可见字符：U+061C、U+200B、U+200D、U+2060、U+2028、U+2029、U+0085、U+E0001（`download.ts:13-20`）。名字由后端生成，风险低。
4. `download.ts:13` 的源码里直接写了原始方向控制字符，应改成 `\u` 转义（扫描器会告警，评审者看不出正则含义）。
5. 0 字节的 xlsx 也会被保存（`download.ts:132`）。步骤：200、xlsx 类型、空体。后果：用户得到打不开的 0 字节"报表"。
6. 进度回调抛异常被说成 `NETWORK_ERROR`，响应流不取消（`download.ts:75、:126-130`）。
7. `controller.abort('原因')` 带了非 `AbortError` 的原因时被当作 `NETWORK_ERROR`，而上传里一律是 `AbortError`，两处不一致（`errors.ts` 的 `isAbortError`、`apiClient.ts:80-81`）。后果：组件卸载时取消请求，页面弹出网络错误。
8. `resolveUrl`、`buildQuery` 对错误形式的地址不报错，静默发出错误请求：`'users'`（无前导斜杠）→ `/api/adminusers`；`'/users?status=A'` 加参数 → `?status=A?page=2`；`'/users#frag'` 加参数落进片段；`'https://evil.com/x'` → `/api/adminhttps://evil.com/x`（`apiClient.ts:37-54`）。令牌不会发到别的源，都是同源路径。
9. 查询参数里数组的边界：`{a: []}` 发出 `?a=`；`[1, undefined, null]` 得 `1,,`；嵌套数组里的对象得 `[object Object]`（`apiClient.ts:50-54`）。
10. 多个 `details` 的原因代码都不认识时，每一行都显示同一条后端 `message`（`errors.ts:86`）。
11. `Accept-Language` 的默认来源没有测试；存储键 `avatar-admin.locale` 与任务 6 的语言切换是否对齐我没有查清（Umi 的默认键是 `umi_locale`）（`apiClient.ts:9、:23-29`）。
12. `upload.ts:47` 的 `xhr.ontimeout = xhr.onerror` 是死代码，`xhr.timeout` 从未设置。
13. `src/locales/error.test.ts:99` 的检测正则里直接写了韩文字符范围，应改成 `\u` 转义，否则仓库里 grep 韩文会命中。
14. 任务书要求保存错误码清单的原始输出和行数：我第一次提交漏了，现已补在 `task-3-error-codes-raw.txt` 和本报告。
15. 变异后仍通过、说明行为没被测试固定的项：`saveBlob` 的对象地址生命周期（从不撤销、立刻撤销、`<a>` 不挂载或不移除）；下载请求的 `Accept` 头和 Blob 类型；下载请求误带 JSON `Content-Type`；`filename*` 的字符集检查；引号内转义；响应无 `body` 流时的进度分支；读错误体失败转 `NETWORK_ERROR`；下载和上传"收到旧令牌的 401 不过期"的保护（只有 `apiRequest` 有测试）；GET 误加 JSON `Content-Type`；启动时 `clearToken` 且存储删除失败后令牌被重读；数字类型的 `ref` 被接受。另外"并发 401 只触发一次"的测试实际靠旧令牌保护通过，锁存只被"没带令牌"的用例覆盖。

### 变更（3 项，等负责人决定；本任务按计划完成，不阻塞）

1. 已知错误码只显示固定的本地化文字，后端 `message` 被丢掉（`errors.ts:68-77`）。例：导出超行数时后端返回 400 `INVALID_REQUEST` 且没有 `details`，用户只看到"输入内容不合法"，不知道要缩小日期范围，而计划 Review Focus 第 1 条要"展示后端提示"。需要定：由 `describeError` 对没有 `details` 的 `INVALID_REQUEST` 附带后端 `message`，还是由任务 8 的导出组件自己展示 `e.message`。我倾向后者；任务 8 做到时按这个走，除非你另有决定。
2. 没有任何超时，后端挂起时请求永远不结束；`downloadFile` 连 `signal` 参数都没有，下载无法取消。超时值和提示文字计划里没有。
3. 网关在发布期间返回的 502/503/504 HTML 页统一显示"服务器返回了无法识别的内容"，没有"稍后重试"。这是任务书的原文要求（非 JSON → `INVALID_RESPONSE`），是否按状态码映射成可重试的文字，要你定。

### 不是缺陷（5 项，理由）

- `setItem` 失败而 `getItem`、`removeItem` 正常，且存储里已有旧令牌时，旧令牌会在重载后复活：存储被禁用时三个调用都会抛，不出现这种组合（`session.ts:31-36`）。
- 文件名不强制 `.xlsx`、Windows 保留名不处理：名字由后端按固定格式生成，保存的字节是 xlsx，浏览器自己清理保留名。
- `filename="x; filename*=UTF-8''evil.xlsx"` 被解析成 `evil.xlsx"`：需要后端自己把这种串放进头里。
- 206 响应也会保存：后端不带 `Range` 不会发 206。
- 绑定认证器一步里无效的 `enrollToken` 返回 `ADMIN_INVALID_TOKEN`，此时 `sentToken` 为 `null`，也会触发 `onExpired`：规格第 73 行"过期则回登录页重来"，行为一致。**给任务 7 的提醒**：处理函数要容忍已经在登录页。

### 未运行（1 项）

- 真实浏览器里的两点在 happy-dom 里测不了：Safari 对 10 秒后撤销对象地址的下载是否受影响；原始 UTF-8 字节的 `filename=` 被 fetch 当 Latin-1 解码后的名字。

## 给后面任务的提醒

- 任务 6：外壳启动时调用 `setLocaleProvider(() => 当前语言)`；若沿用 Umi 的存储键，要么改 `LOCALE_STORAGE_KEY`，要么保证先调用它。
- 任务 7：退出登录用 `clearToken()`，不要用 `resetSessionState()`；`onExpired` 要带回跳地址去登录页，并容忍已经在登录页。
- 任务 8：导出失败时展示 `e.message`（见"变更"第 1 项）。

## 复审

同一个评审者只验证上一轮的立即修项：注释属实；两个新测试在三种变异下都变红（`clearToken` 不清存储、`resetSessionState` 清存储、`resetSessionState` 不再重读存储）；`81f761f` 到 `5ed838b` 之间 `src/request` 只改了 `session.ts` 的注释和 `session.test.ts`。结果：立即修未修 0、新发现 0、未运行 0、阻塞 0。复审时 `src/request`、`src/locales` 共 7 个文件 323 个测试通过。
