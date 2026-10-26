# 任务 5 报告：假后端核心与认证接口

立即修未修 0、记录项 0（评审的 16 项全部已处理，见下）、未运行 0、阻塞 0。另有契约里没写清的几处已写成问题文件，等后端回复。

提交：`3ff7719`（实现）、`dd081a5`（问题文件）、`60c9e61`（评审后的修复和补测试）。环境：Node 24.22.1。

## 文件

- `mock/_core/`：`http.ts`（信封、`ok`/`fail`、`MockHttpError`、`toUmi`）、`auth.ts`（`authenticate`、`guard`、`hasPermission`）、`store.ts`（内存里的管理员、令牌、绑定令牌）、`permissions.ts`（权限树、预置管理员的权限集合）、`permissionTree.generated.json`、`paginate.ts`、`fixtures.ts`、`meta.ts`、`testing.ts`（测试用的 `call`、`adminOf` 等）。
- `mock/auth.mock.ts`（`login`、`totp/enroll`、`change-password`、`me`、`meta`）、`mock/system.permissions.mock.ts`（`GET /permissions`）。
- `scripts/permissionTree.ts`（从规格 5.0 表派生权限树）、`scripts/gen-permission-tree.ts`（`npm run gen:permission-tree -- <规格路径>` 重写 JSON）。
- `config/config.ts` 加了 `mock: { exclude: ['mock/_core/**', 'mock/**/*.test.ts'] }`；`config/proxy.ts` 只在 `MOCK=none`（`dev:api`）时才转发。
- README 加了"Mock backend"一节：6 个预置账号、假密码（`mock-password-<用户名>`）、假验证码 `000000`，注明它们只对假后端有效、不是密钥。

## 做了什么

- 契约 §17.2 的每个分支：密码错、用户不存在、已停用的管理员三者回答完全相同（401 `ADMIN_INVALID_CREDENTIALS`）；已绑定未带验证码 401 `ADMIN_TOTP_REQUIRED`；验证码错 401 `ADMIN_TOTP_INVALID`；未绑定 200 `ENROLL_REQUIRED`（`enrollToken`、`otpauthUri`）；`enroll` 的错误和成功；`change-password` 成功后令牌版本加一，旧令牌 401。连续 5 次错验证码锁定该用户名 5 分钟（契约 17.5 的默认值），429 `RATE_LIMITED` 带 `data.retryAfterSeconds`。
- `me`：`{id, username, superAdmin, mustChangePassword, permissions, passwordMinLength}`，超级管理员 79 个码；强制改密码状态下 `me` 和改密码照常，其余（包括 `meta`）403 `ADMIN_FORBIDDEN`。
- `meta`：平铺 20 个字段，12 个配置值取契约 17.5 的默认值（逐个核对过），8 个上传限制取后端第三份回复。
- `GET /permissions`：79 个节点，`{items: [...]}`，每个页面一个 `MENU`、其余码是 `FUNCTION` 子节点；父子关系从规格 5.0 表派生并提交成静态 JSON，测试保证和规格快照一致。
- `paginate`：`page` 从 1，`pageSize` 1 到 200，越界和非整数返回 400 `INVALID_REQUEST` 带 `details`，不静默截断。
- 假数据：泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文各 4 条，含 300 个字符不带空格的长串、组合符、ZWJ 序列、BMP 以外的 emoji。

## 红到绿

- 红：先写测试，再把实现挪走跑一次——6 个测试文件都报 `Failed to resolve import ... Does the file exist?`。**说明：这一次我是先写了实现、后写的测试**（违反了"先写失败的测试"的顺序），补救办法是上面的"挪走实现"确认测试因功能不存在而红，再靠评审和加大的变异检查补强。
- 绿：`npx vitest run mock config src/locales scripts/permissionTree.test.ts` → 15 个文件、530 个测试通过（含评审修复后的）；`tsc --noEmit` 退出 0；`biome check` 无警告。第一次跑绿时发现并修了一个真缺陷：`meta` 只做浅拷贝，改一次响应里的数组就污染默认值（现在 `structuredClone`）。
- **门槛（真实 Umi 开发服务器）：** 用 `npm run dev:mock` 启动，用循环等到服务就绪，然后 `curl`：无令牌 `GET /me` → 401 信封；`root` 加假密码和假验证码登录 → 令牌；带令牌 `GET /me` → 79 个权限码、`passwordMinLength` 12；`GET /meta` → 20 个字段；`GET /permissions` → 79 个节点；错验证码 → 401 `ADMIN_TOTP_INVALID`；`fresh` 登录 → `ENROLL_REQUIRED`。输出保存在 `docs/superpowers/handoff/reports/task-5-gate-output.txt`。评审修复后又在真实服务上重做了一遍（见下）。

## 评审（一次独立评审，35 个变异，另起真实服务验证）

评审者的结论：认证流程的每个分支、20 个字段、12 个默认值、状态码与契约和后端回复一致；没有发现会让前端拿到错误答案的缺陷。给出 16 项"记录"、3 项"不是缺陷"。

**我对其中三项的分类和评审者不同**：R1、R2、R4 我归为"立即修"（后面 25 个以上模块任务建立在这个基础包装上；R2 是崩溃），其余按评审者的"记录"处理，但也都修了：

- R1 保存任何 mock 文件（含测试文件）就清空全部内存状态，开发者被踢回登录页。**已修**：状态挂在 `globalThis` 上，只在第一次加载时播种；在真实服务上验证：保存 mock 文件后同一个令牌仍是 200；单元测试用 `vi.resetModules()` 模拟重载。
- R2 处理函数返回 `undefined`（忘了 `return`）会让整个 dev 服务进程退出。**已修**：`toUmi` 检查返回值的形状，写 JSON 失败也兜住，一律 500 `INTERNAL_ERROR` 信封；真实服务上验证：忘了 `return` 的接口返回 500，服务仍然在。
- R3 处理函数的异常被吞掉、终端没有栈。**已修**：用 `[avatar-admin]` 标签输出一行 `console.error`（`MockHttpError` 不输出）。
- R4 `dev:mock` 下没做 mock 的 `/api` 路径落到代理，返回 504，甚至悄悄发给本机 8080 的真后端。**已修**：`config/proxy.ts` 只在 `MOCK=none` 时转发；真实服务上验证没做 mock 的接口不再是 504（返回应用的 HTML 页，请求层会报 `INVALID_RESPONSE`）。
- R5 锁定时长 15 分钟，契约默认 5 分钟。**已修**为 5 分钟，加测试。
- R6 锁定的 429 是否带 `retryAfterSeconds`、第几次错误开始拒绝，契约没写。**已写问题文件**（`docs/contract-requests/2026-10-26-admin-frontend-auth-and-permissions.md` 第三节），暂定做法写在里面。
- R7 `enroll` 超过错误次数后绑定令牌没有作废。**已修**，加测试。
- R8 权限树里 `COSMETIC:GRANT`、`STATS:EXPORT`、`STATS:LAND` 的父节点是推断的。**已写问题文件**（第四节）并在 README 注明是推断。
- R9 JSON 没有重新生成的命令。**已修**：`npm run gen:permission-tree -- <规格路径>`。
- R10 到 R15 测试缺口：登录里"先校验密码再提示验证码"的顺序、`meta` 默认值的独立断言（12 个值从契约重新敲入）、锁定的时长和过期、`enroll` 受锁定和停用的影响、改密码"与用户名相同"分支（用一个长用户名构造出来）、超级管理员的 `me` 不依赖存储的列表、`mock.exclude` 的检查（每个测试和工具文件被排除、每个端点文件不被排除、每个端点文件的键形如 `METHOD /api/admin/...`）。**全部已加**，并用 9 处变异验证（锁定时长、重载重新播种、状态不挂在 globalThis、不检查返回形状、令牌不作废、登录不查锁定、`enroll` 不查锁定、超级管理员只给存储的码、代理常开）。
- R16 `fixtures.test.ts` 和 `error.test.ts` 里直接写了韩文字符（检测用的范围边界）。**已修**为 `\u` 转义，全仓库扫描韩文零命中。

不是缺陷（评审者给了理由，我同意）：被锁定的用户名配错密码得到 429 而不存在的用户得到 401，契约的锁定就是按用户名键的；`Bearer` 方案名区分大小写、urlencoded 登录被接受，真后端的做法契约没写，不影响前端代码；`supportedLocales` 默认 `["en"]` 会让 mock 里的多语言页签只显示一种（任务书要求取契约默认值；要在 mock 里验证多语言排版需要"变更"，先问负责人）。

## 已知的限制

- 因为 `supportedLocales` 取默认 `["en"]`，涉及语言页签的模块任务（推送模板、客户端配置、站内通知等）在假后端上只会看到英语一种。若你想在假后端上验证多语言排版，需要你决定把假后端的默认改成多种语言（这偏离契约的默认值）。
- 契约里没写清而按最小做法继续的两处，见问题文件：权限树的响应形状（假后端用 `{items: [...]}`）、改密码失败的形状。

## 给后面任务的提醒

- 任务 6、7：登录相关的前端代码对着 `mock-password-<用户名>` 和 `000000` 开发；`fresh` 走绑定流程，`newhire` 走强制改密码流程；锁定后 429 带 `data.retryAfterSeconds`（契约没写，读不到时显示通用文字）。
- 所有模块任务：mock 文件写成 `export default { 'METHOD /api/admin/path': guard(权限, handler) }`；`guard` 给出契约的 401 和 403；用 `paginateQuery(rows, req)` 做分页；测试用 `mock/_core/testing.ts` 的 `call` 直接调 handler。
