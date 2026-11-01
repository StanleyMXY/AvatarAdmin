立即修未修 0、记录项 7、未运行 3、阻塞 0

# 最终评审：认证、会话、请求层（含系统管理、短信渠道凭据、两套假后端文件）

评审对象：分支 `claude/jolly-dirac-4pq9g6` 的 `cc89d91`，对比 `origin/main`。深度评审（按 `CLAUDE.md`：认证和会话、请求层、凭据类字段不回显）。我没有信实现者的结论，读了代码本身和三份批次报告（`batch-fix-g1-report.md`、`batch-fix-g2-report.md`、`batch-fix-g7-report.md`）里“我自己定的”和变更的每一句，再对着 `decisions-2026-10-27.md` 看有没有回退。没有改任何实现代码；所有改坏代码的检查和探针测试都在草稿目录里的 `HEAD` 拷贝中做，共享检出没有留下改动（`git status` 为空，评审结束时再确认过一次）。

读过的范围：`src/request/*` 全部；`src/session/*` 全部非测试文件；`src/pages/user/*` 三个页面和 `AuthFrame`；`src/components/layout/ChangePasswordForm.tsx`、`signOut.ts`、`ExportButton.tsx`；`src/pages/system/*` 全部非测试文件；`src/pages/sms/ChannelModal.tsx`、`channelRules.ts`（凭据）；`src/services/auth`、`src/services/system`；`mock/auth.mock.ts`、`mock/system.mock.ts`、`mock/_core/auth.ts`。

## 一、结论

- 立即修项：没有。输出错误、崩溃（在契约保证的数据上）、数据丢失、令牌或凭据或被审核内容的文件地址进入日志、错误文字、界面，这几类我都没有找到能在现有调用路径上触发的实例。
- 记录项 7 条，见第二节，每条写了文件行号、触发步骤、错误结果、带着它上线的后果和建议修法。
- 三份批次报告里“我自己定的”和变更的每一句都核对过，全部与代码一致；没有回退 `decisions-2026-10-27.md` 里的任何一条决定（第四节、第五节）。
- 改坏代码的检查：40 处，全部被现有测试发现（变红）；其中 1 处只在最窄的测试范围里存活（登录请求里的密码被去空白：只跑 `src/services/auth` 不红，登录页的测试红），整体没有存活的（第六节）。

## 二、记录项（7 条）

### 1. 退出登录之后，一个迟到的 403 会让界面再弹一条“登录已过期”

- 位置：`src/session/loadSession.ts:55-60`（`readMeAgain` 在令牌已经没有时仍然发 `GET /me`）；触发它的是 `src/session/SessionBridge.tsx:43`（收到 403 就读一次账号）。对比同文件 `loadSession` 在 `:19-20` 对“没有令牌”直接返回，这里漏了同样的判断。
- 触发步骤：1) 页面发出一个写请求（带令牌 A，例如封号）；2) 请求还在路上时，人点“退出登录”（令牌被清掉）；3) 这个请求回来是 403 `ADMIN_FORBIDDEN`。
- 错误结果：外壳弹“没有权限”，并调用 `readMeAgain`，它发出不带 `Authorization` 的 `GET /me`；后端答 401 `ADMIN_INVALID_TOKEN`；`handleTokenExpired(null)`（`src/request/session.ts:73-79`）看到“当前令牌是 null、发送时的令牌也是 null”，认为相同，于是调用 `onExpired`：再弹“登录已过期”的警告，并 `history.replace` 到登录页。我在草稿拷贝里用探针复现：发出的 `Authorization` 头依次是 `["Bearer A", null]`，`onExpired` 被调用 1 次。
- 带着它上线的后果：退出之后偶尔在登录页多出两条不真实的提示（“没有权限”“登录已过期”）；不泄露任何数据，不影响再次登录。
- 为什么不是别的分类：`review7.test.tsx:73` 明确要求“没带令牌的请求被 401 拒绝，仍然结束会话”，这条行为是有意的；缺的只是 `readMeAgain` 在没有令牌时本来就不该发请求。
- 建议：`readMeAgain` 在 `started === null` 时直接返回 `Promise.resolve(undefined)`，并加一条测试“令牌已清掉时收到 403，不发 `/me`”。

### 2. 角色编辑框遇到没有 `permissionCodes` 的行，对非超级管理员会整页崩

- 位置：`src/pages/system/RoleModal.tsx:61` 调 `codesNotHeld(role.permissionCodes, grantable)`，`src/pages/system/permissionTree.ts:240` 用 `for (const raw of roleCodes)` 遍历。同一个页面的列表 `src/pages/system/roles.tsx:76` 和同一个对话框的 `held` 计算（`RoleModal.tsx:70`）都先判断了 `Array.isArray` 或用 `?? []`，只有这一处没有。
- 触发步骤：以只有 `ROLE:MANAGE` 的非超级管理员登录；`GET /roles` 返回的某一行没有 `permissionCodes`（或为 `null`）；点这一行的“编辑”。
- 错误结果：`TypeError: roleCodes is not iterable`，对话框渲染时抛出，仓库里没有自己的错误边界（`grep ErrorBoundary` 为空），所以渲染异常会让该页面不可用，具体是只换掉页面还是整个应用，取决于 Umi 默认的错误页，我没有在浏览器里看。超级管理员不受影响（`grantable` 为 `null`，函数在遍历前就返回了）。我用探针复现了这个异常信息。
- 带着它上线的后果：契约保证每一行都带 `permissionCodes`（`src/services/system/types.ts:26-33` 也这样写），所以只有后端偏离契约时才发生；发生时，该非超级管理员打不开任何角色的编辑框，且看到的是整页崩溃而不是一句话。之前的批次已经把管理员对话框、重置密码对话框改成“行数据类型不对也不崩”（`batch-fix-g7-report.md` 系统管理一节），这一处是漏网。
- 建议：`codesNotHeld` 的参数在 `RoleModal` 里先写成 `Array.isArray(role.permissionCodes) ? role.permissionCodes : []`；加测试。

### 3. 请求体序列化失败被说成“网络错误”，写请求被说成“结果不确定”

- 位置：`src/request/apiClient.ts:193`，`JSON.stringify(o.body)` 写在传给 `fetch` 的对象里，而这一段在 `:187-201` 的传输 `try` 里面，失败走 `catch` 的 `transportFailure`（`:200`），返回 `NETWORK_ERROR`。
- 触发步骤：给 `apiRequest` 一个不能序列化的请求体（有环的对象，或含 `BigInt`）。我用探针试了这两种。
- 错误结果：抛出的是 `ApiError{code:'NETWORK_ERROR', httpStatus:0}`，`isOutcomeUnknown` 为真，页面对写请求会说“可能已经执行，请先确认”；实际上请求根本没有发出（`fetch` 调用 0 次）。
- 带着它上线的后果：目前仓库里没有任何调用会传这样的请求体（我对所有 `src/services/*/index.ts` 的导出函数做过带怪字符参数的调用，见第六节），所以现在没有人会看到；以后有人写错时，错误文字会误导排查。
- 建议：把 `JSON.stringify` 移到 `try` 外面，让编程错误直接抛 `TypeError`（与地址校验同样“早失败”）。

### 4. 页面层把任何非 `ApiError` 都说成“网络错误”，与请求层的 `describeError` 不一致

- 位置：`src/session/describe.ts:14`（`describeFailure` 把非 `ApiError` 换成 `networkError()`），而 `src/request/errors.ts:103` 的 `describeError` 对同样的值给 `error.UNKNOWN`；`describe.ts` 的注释把这个行为写成了有意的（“shown as a network failure”），但它是在请求层加入会抛 `TypeError` 的早失败检查之前写的。
- 触发步骤：`apiRequest({ method:'GET', url:'/users', params:{ when:new Date() } })` 抛 `TypeError: query parameter "when" must be a string, number, boolean or array`（这是请求层 g1 第 8、9 条要的行为）；任何用 `describeFailure` 的页面（几乎全部）显示“网络错误”。探针结果：`describeFailure` 给 `NET`，`describeError` 给 `error.UNKNOWN`。
- 带着它上线的后果：同第 3 条，现在没有调用会触发；以后的编程错误会显示成网络错误。
- 建议：`describeFailure` 对非 `ApiError` 返回 `UNKNOWN`（并且和请求层的 `AbortError` 区别开），改注释。

### 5. 没有调用方的 `reportSession` 选项和过时的注释

- 位置：`src/request/apiClient.ts:165-169`（注释说是给绑定认证器的请求用的，那里的令牌是绑定令牌）、`:144-150`、`:209`。绑定和登录现在都用 `anonymous: true`（`src/services/auth/index.ts:22、31`），全仓库 `reportSession` 只在测试里出现（我 `grep` 过）。
- 触发步骤：无（代码整理）。
- 错误结果：读代码的人以为有第二条“不报告会话”的路径，实际上只有 `anonymous` 一条；`o.anonymous ? false : o.reportSession` 里 `reportSession` 那一支在生产里永远是默认值 `true`。
- 带着它上线的后果：没有运行时后果；以后有人用 `reportSession:false` 绕过会话过期报告时，没有测试说这是允许的。
- 建议：删掉选项和注释，测试里改用 `anonymous`。

### 6. 新建权限节点的代码可以是 `.` 或 `..`，建出来之后在界面上无法编辑或删除

- 位置：`src/pages/system/permissionRules.ts:46-57`（`codeProblem`）只拒绝空白、控制符、格式符、分隔符和超过 100 个码点；`src/services/system/index.ts` 的 `updatePermission`、`deletePermission` 把代码放进路径 `/permissions/${enc(code)}`。`encodeURIComponent('.')` 仍然是 `.`。
- 触发步骤：权限树页点“新建”，代码填 `..`（或 `.`），保存。我用探针确认 `codeProblem('..', [])` 和 `codeProblem('.', [])` 都返回 `null`（通过），并且 `new URL('/api/admin/permissions/..', base).pathname` 是 `/api/admin/`，`.` 对应 `/api/admin/permissions/`。
- 错误结果：创建（`POST`，代码在请求体里）会被后端接受还是拒绝，我没有查清（契约没有给代码的格式）；如果接受，之后“编辑”“删除”发出的是 `PUT/DELETE /api/admin/`（`..`）或 `/api/admin/permissions/`（`.`），后端不会把它当成这个节点；这个节点在界面上变成一个动不了的节点。
- 带着它上线的后果：只会影响手滑填了这两个值的人，不涉及权限放大；拒绝 `.` 和 `..` 只要一行。
- 建议：`codeProblem` 加 `'.'`、`'..'` 为 `invalid`；`docs/contract-requests/` 里已有的系统管理问题文件可以顺带问后端代码的格式规则（我没有改任何文档）。

### 7. 审计详情遮蔽的已知缺口（第二道防线）

契约（`docs/shared-snapshots/backend-task-java-backend.md` 13.1 一节）要求后端不把凭据和用户内容写进 `detail`，前端的遮蔽是第二道防线。我用 40 多种形状的探针试了 `src/pages/system/auditDetail.ts`，大多数都遮住了（`newPassword`、`facebookAccessToken`、`client_secret`、`totpSecret`、`recoveryCodes`、`mật_khẩu`、`contraseña`、`kata_sandi`、`X-Amz-Signature=…`、`postgres://u:pw@h/db`、`Bearer …`、网页令牌、设置名为凭据的 `{field, before, after}` 等）。下面这些没有遮住，复现输入和输出都是探针里的真实结果：

- 键名是 `auth_key`、`creds`、`refresh`（本身不含 `token`）、`sig` 出现在链接的查询串里（`"…a.png?sig=abc123"`，只有键名叫 `sig` 时才遮）：值原样显示。
- 自由文本 `reset password for user x to Hunter2!`（“password”后面不是分隔符，是 for）、`set sms.api_key from AAA to BBB`、`config sms.api_secret changed from old123 to new456`：值原样显示。
- `password=hunter two`：只遮第一个词，`two` 仍显示（`batch-fix-g7-report.md` 已写明这个歧义）。
- PEM 私钥块的正文：只有键名是 `private_key` 时才遮，放在自由文本里不遮。
- 值是数字的凭据（`{"password":123456}`）：不遮，这是决定文件里“布尔、数字不遮”的字面结果。

带着它上线的后果：只有后端违反契约把这些写进 `detail` 时才会显示给有 `AUDIT:VIEW` 的管理员；不是前端的输出错误。建议：把 `auth`、`creds` 作为凭据键词、把 `sig`、`api[_-]?key`（设置名里的）加进自由文本的词表，并加一条“`from … to …` 形状”的规则或者明确写进文档“不覆盖”。这是增强遮蔽范围，我把它归为记录项而不是变更，因为它修的是决定文件已经要求的行为（“键名匹配敏感词”）里漏掉的几个词。

## 三、不是缺陷（写了理由和行号，防止下一位评审重复查）

1. 下载拒绝 0 字节（`src/request/download.ts:170`）会误伤合法的空导出吗：不会。一个“没有数据行”的导出仍然是带表头的工作簿：假后端 `buildXlsx([['statDate','value']])` 是 2282 字节（探针结果），契约（17.6 导出一节）要求的是 `.xlsx`。0 字节的 xlsx 打不开。也试了 HTTP 204 带 xlsx 类型：同样走 `INVALID_RESPONSE`，契约里管理后台接口没有 204。
2. 文件名清理（`download.ts:14-31`）对波斯语、印地语、emoji：探针结果，波斯语 `گزارش‌روزانه.xlsx`（含 U+200C）、印地语 `रिपोर्ट‍्.xlsx`（含 U+200D）、家庭 emoji `👨‍👩‍👧 report.xlsx`（含 U+200D）都原样保留；阿拉伯语里的从右到左标记 U+200F 被去掉（`تقرير 2026.xlsx`，不影响阅读）；`a‮gnp.xlsx` 里的反转字符被去掉；U+00AD、U+3164 保留（不改变显示顺序，伪装扩展名靠的是方向字符）。英格兰旗这类用标签字符 U+E0067… 拼的 emoji 会被去成普通的黑旗 `🏴`，只改外观，文件名来自后端的 `filename=`（契约给的是 `<name>-<from>-<to>.xlsx`），不会出现。
3. 会话回调抛异常后被吞掉（`src/request/session.ts:57-67`）：行为符合报告。回调的异常带 `[avatar-admin]` 标签只记一行 `error.message`，不记对象、不含令牌；之后同一个请求仍以 `ApiError` 结束；去掉保护会让 13 条测试变红（第六节 M3）。`onExpired` 里的顺序是先清标签、清状态，最后才 `history.replace`（`SessionBridge.tsx:25-35`），所以即使后面的步骤抛了，门页也会因为状态是空的而送人去登录；这时 `expiredLatch` 已经为真，后面的 401 不会再触发它，这是有意的（只触发一次）。记录里的 `error.message` 理论上可能带当前页面地址（历史接口的异常信息会带），不是文件地址，也不是令牌。
4. 登录和绑定请求不带旧令牌会不会影响其它匿名请求：不会。全仓库只有这两个调用用 `anonymous`（`grep` 结果：`src/services/auth/index.ts:22、31`），没有别的匿名请求；`anonymous` 还会让这两个请求的 401 不触发 `onExpired`、不清掉令牌，这是要的行为（改成不匿名后相关测试变红，M1、M2、M15、M20）。
5. 请求层新增的 `TypeError`（地址、查询参数）会不会在生产路径里炸：不会。三条证据：a) 我 `grep` 了所有 `url:` 字面量和模板：全部以单个 `/` 开头，所有放进路径的变量都过了 `encodeURIComponent`（`enc`/`path`）或是联合类型（`ads/report/${name}`）或数字（`evidence/${index}`）；上传的端点来自 `src/utils/uploadLimits.ts` 的常量；两个导出地址是常量；b) 对 `src/services/*/index.ts` 的全部导出函数（1124 次调用）传了含 `# / ? \ %2e ../`、emoji、泰语、阿拉伯语的 id：编码过的路径从未抛地址错误，也没有一个发出的地址里含原始 `#`；抛错的只有我故意传错类型的（枚举名、数字下标）；c) 在拷贝里给 `resolveUrl`/`queryValue` 加了记录，再跑 `src/pages`、`src/components`、`src/services`、`src/hooks` 的测试：机器负载高，跑了约 690 条（页面测试约 5000 条）后我停掉了，这约 690 条里来自页面、组件、钩子的 `TypeError` 记录为 0；其余没有跑，所以这一条是 a、b 两条静态和调用证据加一个部分的运行证据，不是全量运行的结论。
6. 改密码表单把后端的 `INVALID_REQUEST` 消息原样接在译文后面（`src/components/layout/ChangePasswordForm.tsx:53`）：这是页面注释里写明的例外（浏览器不知道的规则只有后端那句话能说明）。要变成泄漏，需要后端把提交的密码写进消息；契约里这些消息是常量句子。`docs/contract-requests/2026-10-26-admin-frontend-auth-and-permissions.md` 已向后端问了改密码失败的码。不是缺陷。
7. 页面对未知错误码显示后端消息（`src/request/errors.ts:110、114`）：只发生在 `src/locales/*/error.ts` 的表里没有的码上，契约的 79 个码都有译文（`src/locales/error.test.ts` 守着）。要让被审核内容的文件地址出现在界面，需要后端用一个契约外的码，并把地址写进消息；不是缺陷，但系统管理页和短信页的注释“从不显示后端消息”只在“码已知”时成立。
8. 数字人数据里的凭据以数字形式写进审计详情不遮：决定文件里“布尔、数字不遮”的字面结果；`batch-fix-g7-report.md` 已改判为不是缺陷。
9. 假后端先查锁再查密码（`mock/auth.mock.ts:75`）：只有开发用的假后端，真实后端怎么答由后端决定。
10. 令牌放在内存和 `sessionStorage`，其它存储里没有令牌：`grep` 全部 `sessionStorage`、`localStorage` 使用点，令牌只在 `src/request/session.ts`；`localStorage` 里只有语言、主题、标签页路径、报表说明的折叠状态。绑定页的认证器密钥和绑定令牌只在内存（`src/session/pendingEnroll.ts`），页面刷新就丢，登录时才重新给。
11. 短信渠道凭据（`src/pages/sms/ChannelModal.tsx:188、285-350`，`channelRules.ts:106-125`）：打开对话框时凭据行永远为空，无论后端发了什么；值框是密码框且没有显示按钮；请求只在写满整行时才带 `credentials`；失败文字用码的译文，不显示后端消息。符合“凭据类字段永不回显”。

## 四、对照三份批次报告的逐句核对

### `batch-fix-g1-report.md`（请求层）“我自己定的”四条

| 报告里的话 | 代码里看到的 | 结论 |
|---|---|---|
| 会话回调抛异常：记日志（带标签、不含令牌）并吞掉 | `src/request/session.ts:57-67`；去掉保护后 13 条测试变红（M3） | 做到了 |
| 地址写错：抛 `TypeError`，已查全仓库调用点，没有现有调用受影响 | 见第三节第 5 条，我独立查了一遍，结果一致 | 做到了 |
| 文件名清理不去掉 U+200C、U+200D | `download.ts:14-20` 的范围里没有这两个；把它们加进去后测试变红（Q2） | 做到了 |
| `formatBytes` 进位和 `formatBytesPair` | 不在本次范围（工具函数） | 未核对 |

g1 的其它句子：0 字节拒绝（M4 变红）、方向字符（M5 变红）、`//`（Q5）、查询参数数组边界（Q3）、`&` 接已有 `?`（Q7）、进度回调异常原样抛出并取消读取（Q4、Q10）、超时标志（Q8）、504（Q9）、迟到的取消不保存（M18）、上传超时（M19），全部改坏后有测试变红。

### `batch-fix-g2-report.md`（登录、会话）

| 报告里的话 | 代码里看到的 | 结论 |
|---|---|---|
| 登录和绑定是匿名请求，不带旧令牌，答复不当作会话信号 | `apiClient.ts:98-104、209`；M1、M2、M15、M20 都变红 | 做到了 |
| `/me` 的 403 不再多弹一条也不多读一次 | `src/services/auth/index.ts:73` 传 `reportForbidden:false` | 做到了 |
| 登录或绑定失败后不残留 `unavailable`、不留令牌 | `src/session/useSession.ts:37-43`；M22 变红 | 做到了 |
| 读 `/me` 失败而令牌还在时给 `{unavailable:true}`，不退出 | `loadSession.ts:22-28`；M21 变红 | 做到了 |
| `readMeAgain` 在令牌变了时返回 `undefined` | `loadSession.ts:58`；M13 变红 | 做到了；缺的是“令牌一开始就没有”这一种，见记录项 1 |
| 重试和退出的竞态：退出后旧读取回来不写状态 | `SessionGate.tsx:35-41`；M12 变红；`SessionGate.test.tsx:247-315` 三条 | 做到了 |
| 登录后令牌被拒或被换时 `establish` 不写状态 | `useSession.ts:36`；M11 变红 | 做到了 |

### `batch-fix-g7-report.md`（系统管理、短信、并发保存）与变更

| 报告里的话 | 代码里看到的 | 结论 |
|---|---|---|
| 非超级管理员看超级管理员行：整行没有操作，写一句原因 | `admins.tsx:80、105、228-236`；M17 变红（8 条） | 做到了 |
| 权限树：清单外的内置节点可勾、保存时保留；自定义节点不可勾 | `permissionTree.ts:17-33`；Q16 改成只认清单后测试变红 | 做到了 |
| 审计详情遮蔽：只遮字符串，数字和布尔不遮，日期不遮，设置名为凭据时遮旧值和新值 | `auditDetail.ts:286-345`；M14、Q14 变红；探针 40 多种形状（记录项 7 列出缺口） | 做到了，缺口见记录项 7 |
| 自己那一行：编辑、重置密码、重置二次验证禁用，对话框里也锁 | `admins.tsx:111-143`；`AdminFormModal.tsx:82`；Q11、Q12、Q15 变红 | 做到了 |
| 先勾功能时带上上面的页面；取消后代保留页面 | `permissionTree.ts:183-208`；Q13 变红 | 做到了 |
| 禁用原因写成行内小字，不放悬停 | `admins.tsx:79-97、228-244` | 做到了 |
| 对话框遇到类型不对的行不崩 | `AdminFormModal.tsx:73-76`、`ResetPasswordModal.tsx:37` 做到；`RoleModal.tsx:61` 漏了 | 部分：记录项 2 |
| 变更没做的四条（导出按钮文字、禁用原因的 `aria-describedby`、渠道包写回陈旧值、回复丢了再保存） | 不在我的范围，代码里确实没有 | 与报告一致 |

## 五、与 `decisions-2026-10-27.md` 的对照：没有回退

请求超时 30 秒、上传和导出 5 分钟（`timeout.ts:6、9`）、下载可取消（`ExportButton.tsx:37-52、105`、`download.ts` 的 `signal`）、超时文字“请求超时，请重试”（`src/locales/zh-CN/error.ts:82`）；网关 502/503/504 的提示和只对读请求的重试（`envelope.ts:22`、`apiClient.ts:221-233`、`ServiceUnavailable.tsx`）；强制改密码页的退出入口（`change-password/index.tsx:33-37`）；审计的管理员筛选无权限时不画（`AuditAdminFilter.tsx:16`、`audit.tsx` 的 `search: canFilterByAdmin ? undefined : false`）；新建节点排序放在同级末尾（`permissionRules.ts:63`）；自定义节点不能勾给角色；超级管理员行对非超级管理员关闭；自己那行禁用重置密码和二次验证；解封行内确认和并发保存的版本检查不在本范围；假后端 `supportedLocales` 多语言不在本范围。表单校验文字跟随语言：登录、绑定、管理员、重置密码、角色、权限节点、短信渠道对话框都放了 `RevalidateOnLocaleChange`。

## 六、验证过程

- 局部测试：`src/request`、`src/services/auth`、`src/services/system`、`src/pages/system/auditDetail.test.ts`、`adminRules.test.ts`：13 个文件 360 条全部通过（`--testTimeout=90000`，机器负载 10 到 18）。
- 改坏代码的检查，共 40 处，每处只改一个判断，只跑守它的测试，结果都是变红：
  - 登录或绑定不匿名、匿名仍带令牌、匿名请求仍报告会话（M1、M2、M15、M20）；会话回调异常向外传（M3）；0 字节放行（M4）；反转字符不去掉（M5）；ZWNJ/ZWJ 被去掉（Q2）；`#`、`//` 放行（M6、Q5）；数组里放对象放行（Q3）；已有 `?` 时仍加 `?`（Q7）；取消带原因时当网络错误（M7）；迟到的取消仍保存（M18）；进度回调异常被说成网络错误（Q10）、读取不取消（Q4）；超时标志（Q8）；504 不算网关（Q9）；上传没有超时（M19）；非 `ApiError` 带出消息（M9）。
  - 过期报告忽略被换掉的令牌（M8）；`loadSession` 读完 `/me` 不核对令牌（M10）；`establish` 不核对令牌（M11）；重试总是写状态（M12）；`readMeAgain` 不核对令牌（M13）；`unavailable` 不设置（M21）；`establish` 失败后留着令牌（M22）；绑定令牌失效不回登录（Q17）；返回地址放行 `//`（Q18）；登录密码被去空白（Q19）。
  - 审计遮蔽去掉 `token` 词（M14）；日期不再豁免（Q14）；超级管理员行不关闭（M17）；自己行的角色不锁（Q11）；按用户名认自己去掉（Q12）；自己行的补丁照发（Q15）；勾功能不带上页面（Q13）；清单外内置节点不可勾（Q16）。
  - 登录请求里的密码被去空白（Q19）：只跑 `src/services/auth` 时没有变红（那里的测试密码两端没有空白），跑登录页和改密码页的测试时变红（2 条）。改密码请求里的两个密码被去空白（Q21）：服务层、改密码页和 `src/components/layout` 合跑时变红（2 条）。结论：“密码原样发出”有测试守着，但登录这一条守在页面层，服务层少一条“两端有空白的密码原样发出”的用例；不影响正确性，我没有单独列记录项。
  - 另有 Q20（登录的验证码被改动）变红。
  - 存活的：0。
- 探针（都在草稿拷贝里，没有进仓库）：文件名 10 种、遮蔽 40 多种形状和 14 种长文本耗时（最慢 286 毫秒，宽对象 5 万个键）、无令牌的 401、`TypeError` 的文字、空导出和 204、有环或 `BigInt` 的请求体、角色行缺 `permissionCodes`、退出之后的迟到 403、对 `src/services/*/index.ts` 全部导出函数的怪字符调用。
- 语言覆盖：探针和文件名用了泰语、阿拉伯语、波斯语、印地语、西班牙语、越南语、俄语、中文、emoji；印尼语只在 `kata_sandi` 键名一个例子里。界面文字只有 zh-CN 和 en-US，我检查了错误码文字两种语言都有，没有逐页点界面。

## 七、未运行（3）

1. 真实浏览器：Safari 对 10 秒后撤销对象地址的下载（`download.ts:65` 的 `setTimeout`）、`filename=` 里原始 UTF-8 字节被当 Latin-1 解码、认证页面和系统管理页面的版式；`happy-dom` 看不到这些。这三点在 `batch-fix-g1-report.md` 里已经列为未运行，我没有碰。
2. 全量测试和构建：按 `execution-conventions.md` 留到全部任务做完后由主会话跑一次。我只跑了第六节写的局部；`src/pages`、`src/components`、`src/services`、`src/hooks` 的带记录的页面测试因为机器负载高只跑了约 690 条就停了（见第三节第 5 条 c），所以“全部页面测试里没有 `TypeError`”这一句我不能写，只能写“已跑过的约 690 条为 0”。
3. 对着真实后端：改密码旧密码错时返回哪个码（`ADMIN_INVALID_CREDENTIALS` 是暂定，已有问题文件）、导出没有数据时是不是仍然给带表头的工作簿、新建权限节点的代码格式（记录项 6）；契约没有写，我没有后端可问，也不能读其它仓库。

## 八、修复（针对第二节的 7 条记录项；前面的内容没有改）

负责人规则：记录项全部修，修法按业界通行做法自己定。每条先写会失败的测试并看到红，再修；认证和请求层的改动再对每条规则做改坏代码的检查。7 条各一个提交，在分支 `claude/jolly-dirac-4pq9g6` 上，没有推送。

### 提交和修法

| 第二节的条目 | 提交 | 修法 | 红（修之前） | 改坏检查 |
|---|---|---|---|---|
| 1 退出后迟到的 403 | `6ff7861` | `readMeAgain`（`src/session/loadSession.ts`）在没有令牌时直接返回 `undefined`，不发 `/me`。 | 2 条新测试红：没有令牌时仍发出了 1 次 `GET /me`（期望 0 次） | 把判断改成恒假：2 条红 |
| 2 角色没有 `permissionCodes` | `0f8ecba` | `codesNotHeld` 的参数改成 `unknown`，不是数组就当没有；`RoleModal` 里 `held` 的 `wanted` 也用 `Array.isArray`（原来只防 `null`，字符串会抛 `filter is not a function`）。 | 4 条红：`roleCodes is not iterable`（缺、`null`），`wanted.filter is not a function`（字符串），单元测试 1 条 | 只还原 `wanted` 的防护：字符串那条红 |
| 3 请求体序列化失败 | `38f57ee` | 选 `TypeError`（不是 `ApiError`），理由：与地址、查询参数的早失败一致，这是调用方的编程错误，不是后端或网络的结果，页面不应把它当成“结果不确定”。新函数 `serializeBody` 在读令牌、开计时器之前执行；消息固定（“the request body cannot be written as JSON”），不带原始异常文字，也不设 `cause`（请求体可能含密码，`toJSON` 里抛出的文字也可能含）。返回 `undefined` 的体（函数、符号）同样拒绝。 | 7 条红（环、BigInt、`toJSON` 抛错、函数、符号、不是 `NETWORK_ERROR`、没有计时器）；全部断言 `fetch` 调用 0 次 | 4 处：去掉 `undefined` 检查（7 红）、把原异常抛出去（2 红：消息含 `hunter2`、不是 `TypeError`）、把序列化放回传输 `try`（7 红）、失败时抛 `networkError()`（7 红） |
| 4 `describeFailure` 与 `describeError` 不一致 | `6bcbed5` | `describeFailure` 对非 `ApiError` 返回 `unknownError()`（新，`src/request/errors.ts`，码 `UNKNOWN`，固定消息，`httpStatus` 0，所以 `isOutcomeUnknown` 仍为真，与之前的 `networkError()` 一样保守），文字因此是 `error.UNKNOWN`，与 `describeError` 相同。`AbortError` 没有特殊处理：和 `describeError` 一样给 `UNKNOWN`（调用方在显示前本来就过滤取消）。注释已改。 | 新增 `src/session/describe.test.ts` 14 条红，另有 4 个旧测试（`failureLine`、`users/text`、`cost/failure`、`system/formFailure`）原来把“网络错误”写成期望，改成 `error.UNKNOWN` 后红；`failureToForm.test.tsx` 的 `code` 期望由 `NETWORK_ERROR` 改成 `UNKNOWN`（全仓库没有按这个码分支的代码，已 `grep`） | 把 `unknownError()` 换回 `networkError()`：15 红 |
| 5 无调用方的 `reportSession` | `38f57ee` | 从 `apiRequest` 的选项里删除，`anonymous` 是唯一不报告会话的做法（`unwrapAndReport` 的内部参数改由 `!o.anonymous` 决定）；过时注释改成说明 `anonymous` 的含义；`review7.test.tsx` 里唯一的用法改成 `anonymous: true`。 | 新增 1 条测试，带 `@ts-expect-error`（选项不存在）并断言遗留的 `reportSession:false` 被忽略、`onExpired` 被调用 1 次：修之前红 | 把 `!o.anonymous` 改成 `true`：2 红 |
| 6 权限码 `.`、`..` | `c41fb7d` | `codeProblem`（`permissionRules.ts`）新增结果 `dots`：去空白后以 `.` 开头或结尾（含只由点组成）。字符集仍是原来的（不含空白、控制符、格式符、分隔符，不超过 100 码点）：评审说明里没有给出别的字符集，泰语、阿拉伯语、中文等的码和中间有点的码（`a.b`、`v1.2.3`）照常放行。检查顺序：必填、字符、点、重复。新增中英文提示 `system.permissions.field.code.dots`。 | 17 条红（单元 + 对话框里 4 条：`.`、`..`、`.hidden`、`trailing.`） | 3 处：只查开头、只查结尾、只拒绝 `..`：4、4、11 条红 |
| 7 审计详情遮蔽 | `89a8f75` | 见下 | 59 条红（其中 2 条是我写错的断言：`tokenVersion`、`mustChangePassword` 的字符串值本来就会被遮，已从“不遮”清单里删掉） | 31 处，全部变红；其中 3 处第一次存活（见下） |

### 第 7 条：补了什么、没有误遮什么

补的（`src/pages/system/auditDetail.ts`）：

- 键名：`auth_key`、`authKey`、`creds`、`cred`、`refresh`（只有键名整个就是 `refresh` 才遮，`refreshInterval`、`lastRefresh`、`autoRefresh` 不遮），其余沿用原来的数字、布尔、日期不遮规则。
- 链接查询串：`?sig=`、`&sign=`、`;hmac=` 等签名参数（只认 `?`、`&`、`;` 之后的参数名，所以 `design=blue`、`assign=me`、“sign in to continue”、路径里的 `/sig/` 不受影响）。
- 自由文本里的改变：`reset password for user x to Hunter2!`（`for/of` 后面最多三个词再接 `to/into`），“password was/has been changed/reset/updated to x”，西班牙语（`de … a`）、印尼语（`untuk … menjadi`）、越南语（`cho … thành`）、中文（`密码改为x`、`重置为`）各一种说法；`from A to B` 两个值都遮，条件是名字像设置名（有点、横线或下划线，如 `sms.api_key`）或前面有变更动词（`changed password from a to b`）。`moved token from header to body`、`role changed from support to admin`、`changed sms.daily_cap from 100 to 200` 不遮。
- `password=hunter two`：等号后面如果值是一个只含字母的词，再向后吃最多 5 个只含字母的词，遇到功能词（for、to、by、and、de、para、untuk、cho 等多语言）、带数字或符号的词、逗号、分号、引号就停。`set password=hunter2 for anna` 照旧只遮 `hunter2`。冒号和 `is` 后面不吃（`password: wrong again`、`password is incorrect for user x` 保持原样），这是有意的取舍：这类句子里后面的词多半是普通话。
- 其他：`access_key`、`auth_key`（自由文本）、`creds`（自由文本）、私钥块（`-----BEGIN … PRIVATE KEY-----` 到 `END`，没有结束行就遮到文本末尾；公钥和证书不遮）；`password was changed from …` 里的 `changed` 不再被当成密码（`is/was` 后面是变更动词时不遮）。

不遮、测试守着的：`permissionCodes`、`tokenVersion: 3`、`mustChangePassword: true`、`tokenVersion=3 updated`、`passwordChangedAt=2026-10-01`、`author`、`authors`、`authority`、`credit(s)`、`monkey`、`screds`、`keyCount`、各种密码重置的普通说明（`Password reset by admin for user 42`、`reset password for user x was done by admin`、泰语、越南语、中文、西班牙语的“已重置”）等共 50 多个。

没有补的（有意）：值是数字的凭据（`{"password":123456}`，决定文件规定数字不遮）；冒号后面的多词口令；`password is …` 后面的多词口令。

线性：200000 个字符的 16 种对抗输入（重复的 `password for `、`password for user x to `、`password=a b c d … `、`set sms.api_key from a to `、`?sig=`、`-----BEGIN PRIVATE KEY-----`、`creds `、`密码`、`api_key from "` 等），每条先后经 `detailText` 的字符串和对象两种路径，测试里的上限是 1500 毫秒；本机（负载约 10）实测每条 0.3 到 32 毫秒，最慢的是 200000 个字符的 `密码`（约 300 毫秒，改动前同样的输入约 145 毫秒，来自原来就有的“键名后跟最多 40 个字母”的有界回溯）。另有一条“长度乘 4，耗时之比小于 12”的线性检查。

改坏检查（31 处）：每条新规则单独改坏，都有测试变红。第一次存活的 3 处：“等号后的词吃到 5 个为止”改成 500（补了“第 6 个词不吃”的断言后变红）、“自由文本里的 access_key”去掉（补了 `access_key=`、`accessKey:` 的断言后变红）、“等号后吃词”整体去掉（上一次改坏时语法错误没有真的运行，重新改成 `if (false)` 后 13 条红）。

### 验证

提交前按要求跑的：见本节最后一行（结果出来后补写）。`npx tsc --noEmit` 没有报错；`npx biome check` 对我改的文件没有报错；每次提交的钩子（lint-staged、暂存文件的类型检查）都通过，没有 `--no-verify`。

### 没有做、需要说明

- 第 4 条里评审说“和请求层的 `AbortError` 区别开”：`describeError` 对 `AbortError` 也给 `UNKNOWN`，我没有另加分支，因为所有调用方在显示前已经把取消过滤掉了；如果以后有页面要对取消说另一句话，那是新行为。
- 第 6 条：评审建议顺带去问后端权限码的格式规则。我没有改 `docs/contract-requests/` 里的文件（任务限定了文件），这一问仍然开着；前端只做了“不以点开头或结尾”这一条最小规则。
