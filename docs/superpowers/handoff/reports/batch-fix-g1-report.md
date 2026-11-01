立即修未修 0、记录项 1、未运行 3、阻塞 0。

范围：任务 1 到 5（脚手架与钩子、纯函数工具、请求层、权限与路由与菜单与检查脚本、假后端核心）。清单来自 `task-1-report.md` 到 `task-5-report.md`（任务 1 到 10 的评审结果写在报告里，没有单独的评审文件）。环境：Node 24.22.2（默认的 22.22.0 低于项目下限 22.22.1，用 `npm install --prefix ~/.local/node24 node@24` 装了一份）。

- 记录项 1：任务 2 的第 6 条（链接规则里 IPv6 主机写得比客户端宽还是窄，没有原文可对照）。我们这边没有办法改好，已有问题文件 `docs/contract-requests/2026-10-26-admin-frontend-link-pattern.md`，等后端给出 `HttpsLink.PATTERN` 原文；拿到后让 `src/utils/linkRule.test.ts` 逐字对照。不是阻塞（契约缺口）。
- 未运行 3，都是原报告里就有、这一批没有碰的：任务 3 两点（Safari 对 10 秒后撤销对象地址的下载；原始 UTF-8 字节的 `filename=` 被当 Latin-1 解码），任务 4 一点（`max dev` 里 ProLayout 对无路径分组的真实渲染）。三者都要真实浏览器，happy-dom 看不到。

## 提交

| 提交 | 内容 |
|---|---|
| `0a3d9f3` | 任务 4 的测试缺口（路由表检查不再对着空表空转、菜单过滤、强制改密码、检查脚本） |
| `8938752` | 任务 2 的测试缺口，加上 `formatBytes` 取整修正和 `formatBytesPair`，创意表单接入 |
| `ebaad9f` | 任务 1：Umi 替身的行为测试；README 的依赖审计一节 |
| `d968a72` | 任务 3 的代码类和测试类记录项（请求层 `src/request/*`） |

## 核对表

状态：已修／已不存在／写成问题文件。“变异”指改坏被测代码，新测试必须变红；每条都做过。

### 任务 1

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 替身 `tests/stubs/umi-max.tsx` 的 `useAccess`、`useModel`、`useLocation`、`Link`、`getLocale`/`setLocale` 没有自己的行为测试（只靠页面测试碰到） | 已修 | `ebaad9f`，`tests/umiStub.test.tsx` 16 条。变异 19 处（去掉各个 store 的 reset、`useSyncExternalStore` 换成直接读取、updater 不传前值、延迟提交、未知命名空间不抛、位置合并变覆盖、`Link` 丢属性/丢 search、`setLocale` 空操作、默认语言错），一开始 1 处活下来（`initialStateStore.reset()`），补了用例后全部变红 |
| `npm audit` 85 条未分析 | 已修（分析完写进仓库） | `ebaad9f`，README“Dependency audit”。现在 64 条（1 严重、16 高、37 中、10 低）涉及 70 份包；全部在锁文件里是 `dev`，没有一份经 `dependencies` 进来。构建工具本身是开发依赖，其中会进浏览器包的部分逐个看了：`react-router` 6.3.0（开放重定向，唯一来自外部的跳转地址是登录回跳，`src/session/returnUrl.ts:21-33` 拒绝 `//`、反斜杠、编码斜杠、控制字符）、`path-to-regexp` 8.2.0（路径模式来自 `config/routes`，访客输入不会变成模式）、`@babel/runtime` 7.23.6（`src/pages/system/auditDetail.ts:228-229` 的命名分组用函数做替换，不是 `$<name>` 字符串）；`immer`、`axios` 对应的插件没开（`config/config.ts`）；其余是构建、检查、开发服务器、测试工具。`dist` 里搜到的 `elliptic` 是图表库的 `ellipticalArc`，不是加密库。没有跑真实的包分析工具，所以“进不进包”这一层是读依赖关系得出的，不是测出来的 |
| 部分暂存时 tsc 看的是工作区不是暂存区 | 已不存在（已写明） | `scripts/typecheck-staged-core.mjs:22` 的注释和 `README.md:158` 都写了；这是已知的做法，不是缺陷 |
| 端到端用例的默认 5 秒超时 | 已不存在 | `scripts/typecheck-staged.test.ts:180` 已是 `{ timeout: 60_000 }` |

### 任务 2

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 1 文件头读取的测试拦不住整文件读入 | 已修 | `8938752`。新用例让 `arrayBuffer`、`stream`、`text`、`FileReader` 全部抛错，并要求记录的字节数大于 0、块数不超过 8。变异：`readImageSize`/`sniffFileKind` 改成整文件读（变红）、块大小 1 和 8 MiB（变红） |
| 2 `yesterdayUtc` 没有夏令时用例 | 已修 | `8938752`。洛杉矶 2026-03-08、2026-11-01 和欧洲 03-29、10-25 前后；`lastNDaysUtc(30)` 跨夏令时。变异：本地 `setDate(-1)` 版本只有新用例变红 |
| 3 `formatBytes` 在 1024 倍数附近显示 “1,024 KB”，实际大小和上限显示成同一个值 | 已修 | `8938752`。`src/utils/format.ts`：取整后到 1024 的进下一档；新增 `formatBytesPair`，两个值取整后相同而数值不同就都写成精确字节数。`src/pages/ads/mediaSpec.ts` 的 `bytesProblemTexts` 供 `CreativeModal.tsx:355` 的“文件太大”提示使用（这是仓库里唯一把实际大小和上限并排写的地方）。变异 3 处全变红 |
| 4 文件签名被削弱时测试不变红 | 已修 | `8938752`。PNG 八个签名字节逐个差一位、IHDR 长度和名字、JPEG 三字节、ZIP 四字节、MP4 `ftyp` 四字节、`length < 7`。变异 9 处，8 处变红；`if (length < 2) return null;` 去掉后测试仍绿，原因：长度字段是 `00 xx`，长度 0 或 1 时 `pos += length` 落回长度字段自身，那里不可能是 `0xFF`，下一轮必然返回 null，所以这一行在结果上等价（等价变异，不是缺口） |
| 5 `formatInstant` 的严格 ISO 正则没有测试 | 已修 | `8938752`，`2026-10-21`、无时区的时刻、空格分隔、纯数字原样返回。变异（删掉 `if (!ISO_INSTANT.test(iso)) return iso;`）变红 |
| 6 IPv6 主机比真 IPv6 宽，无原文可对照 | 写成问题文件，仍待后端 | `docs/contract-requests/2026-10-26-admin-frontend-link-pattern.md`，快照里仍只有文字版（`docs/shared-snapshots/backend-task-java-backend.md:249-251`） |

### 任务 3

提交 `d968a72`。请求层是共享基础，改完后用变异检查逐条验证（共 56 处，下面只写分类结果）。

| 记录项 | 状态 | 证据 |
|---|---|---|
| 1 会话回调抛异常时，`apiRequest`/`downloadFile` 抛的是回调的错误，`uploadFile` 永不结束 | 已修 | `session.ts` 新增 `runHandler`：回调的异常带 `[avatar-admin]` 标签记一行错误日志（不含令牌），不再传给调用方。测试：`session.test.ts`（两个回调、之后仍能再次过期）、`apiClient.test.ts`、`download.test.ts`、`upload.test.ts`（上传以 `ApiError` 结束）。变异：去掉保护后 6 条变红 |
| 2 `describeError` 收到非 `ApiError` 会崩；`downloadFile` 的 `Blob`/对象地址失败抛无 `code` 的普通错误 | 已修 | `errors.ts` 的 `describeError(e: unknown)`：非 `ApiError` 只给 `error.UNKNOWN`，不带它的 `message`（可能带地址）；`download.ts` 把 `new Blob`、`createObjectURL`、`click` 的失败变成 `ApiError{code:'UNKNOWN'}`。变异：两处各变红 |
| 3 文件名清理漏掉不可见字符 | 已修（ZWJ/ZWNJ 除外，见“我自己定的”） | `download.ts:14-19` 的 `INVISIBLE_CHARACTERS`：C1 控制符、U+061C、U+200B、方向标记和嵌入、U+2028/2029、U+2060-206F、U+FEFF、标签字符。测试逐个字符；变异 10 处（每个区间缩小或去掉）全变红 |
| 4 `download.ts` 源码里直接写了原始方向控制字符 | 已不存在 | `download.ts:14-19` 全是 `\u` 转义 |
| 5 0 字节的 xlsx 也被保存 | 已修 | 0 字节 → `INVALID_RESPONSE`，不保存、不建对象地址。变异变红 |
| 6 进度回调抛异常被说成 `NETWORK_ERROR`，响应流不取消 | 已修 | 回调的异常原样抛出（不被说成网络错误），并 `reader.cancel()`。变异：去掉原样抛出、去掉 cancel 各变红 |
| 7 `abort('原因')` 带非 `AbortError` 的原因被当 `NETWORK_ERROR`，上传里却是 `AbortError` | 已修 | 请求层现在把调用方的合并信号接给 `fetch`，真实浏览器里拒绝值是合并信号的 `AbortError`（这一条后来的超时改动已经间接解掉）；另外 `transportFailure` 加了保险：信号已取消且不是超时，无论拒绝值是什么都按取消处理。测试用拒绝值为字符串和 `Error` 的桩。变异变红 |
| 8 `resolveUrl`/`buildQuery` 对错误形式的地址静默发错请求 | 已修 | `apiClient.ts`：地址必须以单个 `/` 开头，`//`、`/\`、完整地址、`#` 抛 `TypeError`（不发请求）；地址已有 `?` 时用 `&` 接参数（新函数 `requestUrl`，`apiRequest` 和 `downloadFile` 都用它）。查了仓库里所有调用点：没有一处传无前导斜杠、带 `#` 的地址。变异 5 处变红 |
| 9 查询参数里数组的边界 | 已修 | 空数组整项去掉，数组里的 `undefined`/`null`/`''` 去掉，数组里的对象抛 `TypeError`。变异 3 处变红 |
| 10 多个 `details` 的原因代码都不认识时每一行都显示同一条后端 `message` | 已修（我定的做法） | 只有一个 detail 时仍显示后端 `message`；多个 detail 时不认识的原因显示它自己的原因代码。`errors.test.ts`，变异变红 |
| 11 `Accept-Language` 默认来源没有测试，存储键与语言切换是否对齐没查清 | 已修 | 键已经是 `umi_locale`（`apiClient.ts:12`），`src/locales/initLocale.ts:2` 和 `src/app.tsx:25` 用同一个常量。新增 5 个用例：已存的选择、浏览器第一语言（zh 开头为中文，其余为英文，没有为英文）、存的值不是两种界面语言、存储抛异常、外壳设置的提供函数优先。变异（换键、不读浏览器语言）变红 |
| 12 `upload.ts` 的 `xhr.ontimeout = xhr.onerror` 是死代码 | 已不存在 | `upload.ts:35-42`：`xhr.timeout` 已设置，`ontimeout` 单独给 `REQUEST_TIMEOUT` |
| 13 `error.test.ts` 里直接写了韩文范围 | 已不存在 | `src/locales/error.test.ts:105` 是 `\u` 转义；全仓库（除 `node_modules`、`.umi`、`dist`、`.git`）用 UTF-8 正则搜韩文字符零命中 |
| 14 错误码清单的原始输出没保存 | 已不存在 | `docs/superpowers/handoff/reports/task-3-error-codes-raw.txt` 在 |
| 15 变异后仍通过的行为 | 已修 | 新增用例并逐项变异：对象地址的生命周期（立刻撤销、1 秒、从不撤销）、`<a>` 挂载与移除、`rel`、`click` 抛错时仍移除并撤销、`Accept` 头、Blob 类型、下载不带 JSON `Content-Type`、GET/DELETE 不带 `Content-Type`、`filename*` 字符集（含字节恰好是合法 UTF-8 的 ISO-8859-1）、`utf8`/`UTF-8` 大小写、引号内转义、无 `body` 流的读取和进度、读错误体失败、下载与上传收到旧令牌的 401 不过期、启动后第一个调用是 `clearToken` 且存储删除失败、数字类型的 `ref`。“并发 401 只触发一次”的两层保护（旧令牌保护和锁存）各自被不同用例杀死：去掉锁存 → `session.test.ts` “没带令牌”用例变红；去掉旧令牌保护 → 4 条变红 |

### 任务 4

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 1 `config/routes.test.ts` 的几条在模块文件为空时空转 | 已修 | `0a3d9f3`。现在断言 83 个页面、23 个菜单；根跳转在第一个菜单之前、`/users/abuse` 在 `/users/:id` 之前不再有“若存在”的条件。变异（改根跳转目标、页面数）变红 |
| 2 变异后仍通过的几处 | 已修 | `0a3d9f3`。`isMenuEntry` 的 `redirect`/`layout:false` 条件（各一例）、`filterMenu` 对 `routes: []`、`flattenPages` 对 `component`/`redirect`/`layout`/`*`、`mustChangePassword`（`canAccess` 和 `access` 工厂各一组：超级管理员、无码页面、`'true'` 字符串、缺省）。变异 17 处，1 处（`flattenPages` 的 `redirect` 条件）一开始活下来，补了“有组件又有跳转的路由”用例后变红 |
| 3 检查脚本的测试缺口 | 已修 | `0a3d9f3`。缺失的路由不再同时算访问差异（去掉 `continue` 变红）、前缀对路由一侧也生效（变红）、多个前缀；`check-permission-codes` 对过期排除项退出 1 并点名，另一个用例证明真实排除表退出 0。变异两处变红 |

### 任务 5

任务 5 的报告里评审的 16 条都已在 `60c9e61` 处理，核对现状如下，没有仍存在的。

| 记录项 | 状态 | 证据 |
|---|---|---|
| R1 保存 mock 文件清空内存状态 | 已不存在 | `mock/_core/store.ts:50` 状态挂在 `globalThis`，只在首次加载播种；`mock/_core/store.test.ts:39,47` |
| R2 处理函数忘了 `return` 会让开发服务退出 | 已不存在 | `mock/_core/http.ts:61-68` 兜成 500 `INTERNAL_ERROR`；`http.test.ts:67,74,88` |
| R3 异常被吞，终端没有栈 | 已不存在 | `http.ts:67` 带 `[avatar-admin]` 标签输出；`http.test.ts:45` |
| R4 `dev:mock` 下没做 mock 的接口落到代理 | 已不存在 | `config/proxy.ts:8-9` 只在 `MOCK=none` 转发；`config/proxy.test.ts` |
| R5 锁定时长 15 分钟 | 已不存在 | `mock/_core/store.ts:15`（5 分钟）、`mock/auth.mock.ts:48`；`auth.mock.test.ts:176` |
| R6 锁定的 429 是否带 `retryAfterSeconds` 契约没写 | 已写成问题文件 | `docs/contract-requests/2026-10-26-admin-frontend-auth-and-permissions.md` 第三节；`mock/auth.mock.ts:37` |
| R7 `enroll` 超过错误次数后绑定令牌未作废 | 已不存在 | `mock/auth.mock.ts:47`；`auth.mock.test.ts:224-240,258` |
| R8 权限树父节点是推断的 | 已写成问题文件 | 同上文件第四节 |
| R9 JSON 没有重新生成的命令 | 已不存在 | `package.json:17` 的 `gen:permission-tree` |
| R10 到 R15 测试缺口 | 已不存在 | `mock/auth.mock.test.ts`、`mock/_core/*.test.ts`、`mock/config.test.ts:20`（`mock.exclude`）已补，`config/config.ts:29` 的排除项被测试读取 |
| R16 测试里直接写韩文 | 已不存在 | `mock/_core/fixtures.test.ts:35` 是 `\u` 转义 |
| “限制”：`supportedLocales` 只有 `en` | 不是记录项（已由负责人决定改成七种语言） | `mock/_core/meta.ts:7` |

## 我自己定的（业界通行做法，不请示）

- 会话回调抛异常：记日志（带标签，不含令牌）并吞掉，不传给调用方。理由：回调是外壳的代码，它的错误不能替换请求本身的结果，更不能让上传永远不结束。
- 地址写错：抛 `TypeError` 而不是静默改写。理由：这是调用方的编程错误，早失败；已查全仓库调用点，没有现有调用受影响。
- 文件名清理不去掉 U+200C、U+200D（零宽非连接符、连接符）：波斯语、印地语等文字和 emoji 序列需要它们，它们不改变显示的顺序，伪装扩展名靠的是方向字符，已去掉。原报告列的 U+200D 因此不处理（这一点算“不是缺陷”）。
- `formatBytes` 取整进位而不是提高小数位；并排显示实际值和上限用 `formatBytesPair`。

## 新发现

- 无立即修项。
- `src/pages/moderation/ContentPanel.test.tsx(20,3)` 有类型错误（`MockRecord` 缺 `reviewedByUsername`），在提交钩子里作为“暂存文件之外的诊断”显示；是别的范围里未提交的改动，不是我的，也不阻塞提交。记录：该文件在别的任务的范围，由那边的负责会话处理。

## 测试和检查

- 每组改动前先写测试，请求层 26 条在改代码前是红的（命令 `npx vitest run src/request`：`26 failed | 198 passed`），改完 `223 passed`。纯缺口类（任务 2 的 1、2、4、5，任务 4 全部，任务 1 替身，任务 3 的第 15 条）在原代码上本来就绿，所以用变异证明测试会变红，见上。
- 变异总数：请求层 56 处、任务 2 约 20 处、任务 1 替身 19 处、任务 4 约 20 处；活下来的 4 处：`length < 2`（等价变异）、替身 `initialStateStore.reset`（补用例后变红）、`flattenPages` 的 `redirect` 条件（补用例后变红）、`filename*` 字符集用 `true` 替换（把用例的字节改成合法 UTF-8 后变红）。
- 回归（请求层是共享基础）：改完后跑了 `src/components src/session src/services src/hooks src/locales src/app.test.tsx tests mock`，加上直接读 `describeError` 结果的几份纯函数测试：126 个文件、2456 个测试，6 个失败，全部是 5 秒默认超时（机器同时被别的会话占满，负载 20 到 40）；`tests/noHardcodedText.test.ts`、`AccountMenu`、`PagedListTable`、`ReasonModalForm` 四个文件用 `--testTimeout=90000` 重跑全部通过（37 加 32 条）。页面测试里读 `details` 的几份（内容审核规则页的三条拒绝用例）用长超时单独跑过，通过。页面测试整批没能跑完：各自超时 30 到 120 秒，失败原因是超时和别的会话未提交的改动（`DASH is not defined`、`ConfigForm`），不能用来判断我的改动，那部分没有结论。
- 提交时顺带进了 `docs/contract-requests/2026-10-26-admin-frontend-ads.md` 里别的会话加的一条问题（第 4 条），因为提交钩子的暂存恢复和别的会话的暂存撞了；内容没有改动，属于广告模块那边，只是落在 `d968a72` 里。
