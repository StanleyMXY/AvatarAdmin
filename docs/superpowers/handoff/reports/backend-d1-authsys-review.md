立即修未修 0、记录项 5、未运行 2、阻塞 0（另有变更 1，不算在这四个数里）

# 区域 authsys（登录、绑定认证器、管理员、角色、权限树、审计、短信渠道凭据）后端第一批交付的独立评审

评审对象：提交 `cf6b3bb`、`aa7e65f`、`d2a1c00`，报告 `reports/backend-d1-authsys-report.md`。依据：后端改动清单 `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 的 a1、a2、a3、e6 和追加节 W2a；`decisions-2026-10-27.md`。评审深度：认证、权限判断、凭据类字段，按深度评审做（读全部实现、读提交、自己写探针复现、变异检查、真实浏览器）。分支 `claude/jolly-dirac-4pq9g6`，评审时 HEAD 是 `d2a1c00`。

## 结论先说

立即修项：没有。你点名的四件事，每一件我都用真实输入核过：

1. **凭据**：打开时不回显、提交后不回显、值不进日志/错误文字/表单默认值，都成立；名称重复、空名称、只填一边在页面里被拦下，页面发不出 null 值或空名称。浏览器自动填充的最终行为我没能验（见未运行 1）。
2. **a1 的 403 文字和"不显示后端 message"**：角色新建/编辑、删除角色、管理员对话框、重置密码对话框、管理员行内操作（停用、启用、重置二次验证、删除）每个调用点都成立。有一个调用点的句子没有测试守着（记录 1）。
3. **权限树对非超级管理员**：用"持有部分后代"的非超级管理员构造了反例，保存出的权限码合理，不会悄悄拿走角色里操作者没持有的码；有一处没有测试守着（记录 2）。
4. **与上一轮决定的冲突**：五条决定都没有回退，没有互相冲突（逐条见第四节）。

下面的记录项建议全部修。

## 一、凭据（短信渠道新表单）

做法：先读 `ChannelModal.tsx`、`channelRules.ts`、`mock/sms.mock.ts`，再跑实现者的测试，再自己在真实浏览器里走一遍，最后用变异检查。

**浏览器（Playwright Chromium，草稿目录拷贝，`dev:mock` 端口 8793，用完按进程号停；只覆盖英文界面，值里含西班牙语、泰语、中文、越南语）：**

| 步骤 | 结果 |
|---|---|
| 以 root 打开渠道页，点第一行的"Edit" | 凭据行数 0；对话框 HTML 里没有 `seed-secret`（假后端里这一行存着 `{apiKey:'seed-secret-1'}`） |
| 点"Add a credential" | 值输入框 `type=password`、`autocomplete=new-password`、没有 `name` 属性；名称输入框 `autocomplete=off`；没有显示/隐藏按钮 |
| 只填名称 `apiKey` 提交 | 出现"Enter a value for this name"，没有发请求（请求计数不变） |
| 补值，再加一行名称 ` apiKey `（前后有空格）值 `dup` 提交 | 出现"This name is used twice"，没有发请求 |
| 删掉重复行，提交 | 一个 PUT，请求体 `credentials` 为 `{"apiKey":"ñandú-ผู้ใช้-密钥-ÐÃ"}`（名称去了空格），对话框关闭 |
| 保存后查整页 HTML、`sessionStorage`、`localStorage` | 都没有这个值 |
| 重新打开同一行的编辑 | 凭据行数 0，对话框 HTML 里没有这个值 |
| 控制台 | 没有页面错误 |

**测试里的覆盖（读了，且用变异验证有效）：** 后端错误不显示后端文字（`channels.form.test.tsx` 242 行起，用带标记的 message 验证）；后端发来 `credentials`、`credentialsEnc`、`apiSecret` 等字段时页面任何位置都没有（`leakSecrets`）；null 值和空名称：页面层 `credentialProblems` 在提交前拦下，假后端对 7 种非法形状（null 值、非文本值、空名称、只有空白的名称、null、文本、列表）创建和更新都答 400 `EMPTY_NOT_ALLOWED`。

**我自己做的变异（只在草稿目录拷贝里改，改完立刻还原；共享检出 `git status` 干净）：**

| 变异 | 结果 |
|---|---|
| 凭据值不再去首尾空白 | 变红（2 条） |
| 没有完整行时也发 `credentials: {}` | 变红（4 条） |
| 值输入框 `autocomplete` 改成 `on` | 变红（1 条） |
| 值输入框加回显示/隐藏按钮 | 变红（1 条） |
| 打开编辑时用渠道上的 `credentials` 预填一行 | 变红（7 条） |
| 失败文字改成显示后端 `message` | 变红（2 条） |

结论：凭据这一块没有立即修项。两点不算缺陷的说明：

- **凭据值被去首尾空白**（`channelRules.ts` 的 `trimSpec(row.value)`）：管理员自己的密码是"原样不去空白"，而渠道凭据值去了。不是缺陷：真实会遇到的是复制时带进的多余空格，去掉才对；供应商密钥首尾本来就带空白的情形不现实，旧版（单个文本框）也是去空白，且有测试固定。
- **审计详情里的凭据映射**：`credentials` 现在是对象。我核过 `maskDetail`：键名含 `credential` 时标志向下传，`{credentials:{apiKey:'S1',ผู้ใช้:'S2'}}` 里的字符串全部变成 `********`，`apiKey`、`appSecret` 作为单独的键也被遮；`tokenVersion: 3` 这类数字照旧不遮。和"审计遮蔽只遮字符串"的决定没有冲突。

## 二、a1 的四类 403：每个调用点

方法：不信测试里的"never the words of the backend"，自己写探针（草稿目录，已删）：把所有写请求改成 403 `ADMIN_FORBIDDEN`，`message` 写成唯一标记 `LEAKMARK-ñandú-ผู้ใช้-x7`，在每个调用点触发，检查整个 `document.body.textContent` 不含标记，再检查句子在不在。中英文各跑一遍（zh-CN、en-US，4 条探针全部通过）。

| 调用点 | 英文 | 中文 | 标记漏出 |
|---|---|---|---|
| 删除角色（`roles.tsx:38`，消息条） | 有按码的一句 + `system.scopeHint` | 有 | 没有 |
| 角色对话框保存（`RoleModal.tsx:95`） | 有 | 有 | 没有 |
| 管理员行内：停用（`texts.ts:60` `protectedFailureText`） | 有 `system.admins.forbiddenHint` | 有 | 没有 |
| 管理员行内：重置二次验证、删除 | 走同一个函数，标记没有漏出；句子我只在"停用"上核了文字，其余两个共用同一函数 | 同 | 没有 |
| 重置密码对话框（`ResetPasswordModal.tsx:52`） | 有，探针里读到：`You do not have permission to do this. Administrators can only grant permissions they hold. … Nothing was changed.` | 有 | 没有 |
| 管理员对话框保存（`AdminFormModal.tsx:121`） | 实现者的测试覆盖（编辑）；创建走同一行代码 | 同 | 没有（同一函数） |

另外：403 不跳转、不退出（`SessionBridge` 只提示一次并重取一次 `/me`，没有改请求层）；浏览器里角色对话框 403 之后对话框和页面都留着、地址不变。

变异检查（我做的）：

| 变异 | 结果 |
|---|---|
| 删除角色不加句子 | 变红 |
| 管理员对话框不加句子 | 变红 |
| 行内操作不加 `forbiddenHint` | 变红 |
| **重置密码对话框不加句子** | **存活** → 记录 1 |

假后端的四条规则，我对每条规则的检查分别删掉做了变异：`POST /admins` 的 `roleIds`、`status`、`reset-password`、`DELETE /admins`、`DELETE /roles` 五处检查，删掉后都变红。实现者列的其他变异（`POST/PUT /roles`、`reset-totp`、`PUT /admins` 的 `roleIds`）我没有重做，读测试看是对应的。

## 三、角色权限树对非超级管理员（"持有部分后代"的反例）

先读 `permissionTree.ts:170-200` 的 `toggleCode`，再用真实权限树（`mock/_core/permissions.ts`，两层：页面码下面是功能码）直接调函数，并在浏览器里用真实页面复现。

**纯函数结果（`grantable` 是操作者持有的码）：**

| 情形 | 结果 | 评价 |
|---|---|---|
| 持有 `USER:VIEW`、`USER:BAN`；新建角色，勾页面 `USER:VIEW` | `[USER:BAN, USER:VIEW]`，没有 `USER:EXPORT` | 合理，只带持有的后代 |
| 同上，只勾功能 `USER:BAN` | `[USER:BAN, USER:VIEW]` | 合理，持有的祖先自动勾（"勾功能自动勾祖先"保留） |
| 只持有 `USER:BAN`（不持有页面码），勾 `USER:BAN` | `[USER:BAN]`，页面码没有勾（它灰着、不能勾） | 不是缺陷：操作者授不出页面码，发出去后端也会 403；浏览器里同样结果 |
| 同上，点页面 `USER:VIEW`（灰） | 不变 | 合理 |
| 持有 `USER:VIEW`、`USER:BAN`；角色含 `USER:VIEW`、`USER:BAN`、`USER:EXPORT`，取消页面 `USER:VIEW` | `[USER:EXPORT]`：去掉了页面码和持有的功能码，**保留**没持有的 `USER:EXPORT`（灰、仍勾） | 这就是"不悄悄拿走没持有的码"，成立 |
| 持有 `USER:VIEW`、`USER:BAN`；角色是 `[VIEW, BAN]`，取消功能 `USER:BAN` | `[USER:VIEW]` | 合理，取消后代保留祖先 |
| 持有集合为空 | 任何点击都不变 | 合理 |

**浏览器（root 建了几个角色，把 `reviewer` 改成只持有 `ROLE:MANAGE, USER:VIEW, USER:BAN, STATS:VIEW`，`finance` 只持有 `ROLE:MANAGE, USER:BAN`）：**

- `reviewer` 新建角色，`USER:EXPORT`、`COST:VIEW` 灰；勾 `USER:VIEW` → 请求体 `permissionCodes: ["USER:BAN","USER:VIEW"]`。
- `reviewer` 编辑"全部持有"的角色，取消 `USER:BAN` → `PUT` 体 `["USER:VIEW"]`。
- `reviewer` 编辑含 `USER:EXPORT` 的角色，取消 `USER:VIEW` → 页面上 `USER:EXPORT` 仍勾且灰；保存发出 `["USER:EXPORT"]`，后端（假后端按清单规则②）答 403，对话框显示按码的一句加通用句，**角色在 root 视角下仍是 `["USER:BAN","USER:EXPORT","USER:VIEW"]`，什么都没有变**。
- `finance` 新建角色，勾 `USER:BAN` → 请求体 `["USER:BAN"]`（页面码灰、没带）。

所以：保存出的码永远是操作者持有的子集（新建）或"原有的码里没持有的保留 + 持有的按操作改"（编辑，且编辑含没持有码的角色，按清单规则②后端必拒）。不会悄悄拿走没持有的码，也不会悄悄多给没持有的码。

`roles.tsx` 里 `held.dropped`（角色里不是树上系统节点的码，保存时会被去掉）是另一回事：页面用警告条列出这些码并写明"保存时会被去掉"（`system.roles.unknownCodes`），不是静默，也不是本次改动。

变异检查（我做的）：

| 变异 | 结果 |
|---|---|
| 取消父节点时连没持有的后代一起去掉（`permissionTree.ts:191`） | 变红 |
| 勾选时把没持有的后代也勾上（`:194`） | 变红 |
| **勾选时把没持有的祖先也勾上（`:197`，`mayChange` 改回 `selectable.has`）** | **存活** → 记录 2 |
| **对没持有的节点点击仍然生效（`:186`）** | **存活** → 记录 2 |

## 四、与上一轮决定的对照

| 上一轮的决定 | 现状 | 证据 |
|---|---|---|
| 超级管理员行对非超级管理员整行关闭 | 没回退。`admins.tsx` 不在这三个提交的改动里；`isClosedTo` 仍在 `actionsOf` 和 `reasonsOf` 最前面返回空 | `git show --stat` 无 `admins.tsx`、`adminRules.ts`；`admins.tsx` 当前 `isClosedTo` 调用 |
| 自己那一行禁用重置密码、重置二次验证 | 没回退。新加的 `forbiddenHint` 里"这是你自己的账号"只是 403 的可能原因之一，按钮仍然禁用 | `admins.tsx` `resetPassword.disabled: own`、`resetTotp.disabled: own` |
| 权限树取消保留祖先 | 没回退，且非超级管理员的取消分支只多了"只去掉持有的后代" | `permissionTree.ts:188-191`；浏览器：取消 `USER:BAN` 保留 `USER:VIEW` |
| 勾功能自动勾祖先 | 没回退。祖先只在操作者持有时才自动勾；不持有时不勾（这是新增限制，不是回退，见第三节） | `permissionTree.ts:197`；纯函数结果 |
| 审计遮蔽只遮字符串 | 没回退。本次对 `auditDetail.ts` 没有改动；新的凭据映射由现有规则遮住（第一节） | `git show --stat` 无 `auditDetail.ts`；探针 |

决定里"角色页：自己那一行的编辑按钮禁用"实际指管理员列表（`decided-sys-report.md` 已写明）；本次的"不能预先禁用编辑自己持有的角色"说的是角色页，两者不是一回事，没有冲突。

## 五、a2、a3、e6 的核对

- **a2**：`login/index.tsx:70-75` 对 `ADMIN_TOTP_INVALID` 清空验证码框、保留用户名、显示 `auth.login.totpInvalid`（中英文都有"无法校验"和"联系超级管理员重置你的二次验证"）；5 次后 429 走 `failureNotice`。浏览器里实现者看过，我读了代码和测试，没有重做。
- **a3**：`enroll/index.tsx` 对 `ADMIN_INVALID_TOKEN` 清掉内存里的绑定信息、提示"绑定已过期"、回登录页并保留 `redirect`；绑定请求 `reportSession: false`，不会触发"会话结束"。未改前端，补了测试。读了代码，和清单一致。
- **e6**：前端做法不变（进入时取一次 `/me`，403 `ADMIN_FORBIDDEN` 时重取一次，不轮询）。`SessionBridge.tsx` 的 `onForbidden` 提示 key 固定，多个 403 同时到只提示一次。读了代码，没有重做。
- **W2a 节点类型**：`updatePermission`（`services/system/index.ts:149-161`）请求体只有 `nameZh`、`nameEn`、`sortOrder`，非内置节点才带 `parent`，没有 `type`；假后端不同类型 400 `type`。核过。
- **W2a 审计长度**：`audit.tsx` 三个输入框 `maxLength` 64/64/255；浏览器 `maxlength` 属性实现者已看。`maxLength` 按 UTF-16 单位计，后端按字符，所以超过 32 个非 BMP 字符（如 emoji）的输入会被浏览器提前截断，比后端更严；不是缺陷：动作、对象类型是代码标识，对象 ID 是 UUID，不会是这类字符，且被截断不会发出会被拒绝的请求。

## 六、我自己跑的

- 草稿目录是 HEAD 的 `git archive` 拷贝（`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/rv-authsys` 和 `…/rv-authsys-b`），共享检出里没有留下任何改动（`git status` 干净）。
- 基线：`npx vitest run src/pages/sms/channelRules.test.ts src/pages/system/roles.test.tsx src/pages/system/permissionTree.test.ts` → 3 个文件、77 条通过（机器负载平均 10 以上，用了 175 秒）。
- 探针（已删除）：403 标记探针 4 条通过；权限树纯函数探针；审计遮蔽探针。
- 变异检查：19 个变异，16 个变红，3 个存活（记录 1、2）。
- 真实浏览器：一次完整脚本，凭据流和三个非超级管理员的角色流，控制台无页面错误。

## 记录项（建议全部修）

1. **重置密码对话框的 403 句子没有测试守着。** 代码：`src/pages/system/ResetPasswordModal.tsx:52`。测试缺口：`src/pages/system/admins.test.tsx:1292` 起的新测试只有"行内停用"和"编辑对话框"两条，没有一条打开重置密码对话框收到 403。触发（变异）：把该行改成 `setFailure(placed.text)`，`npx vitest run src/pages/system/admins.test.tsx -t "within what they hold"` 仍是 2 条通过。后果：将来有人改这一行，重置密码时 403 会只显示"你没有执行此操作的权限"，没有人发现。行为本身现在是对的（我的探针读到了完整句子）。
2. **`toggleCode` 的 `grantable` 参数没有直接的单元测试，两个保护存活变异。** 代码：`src/pages/system/permissionTree.ts:186`（"点没持有的节点不改变"）和 `:197`（"自动勾祖先时只勾持有的"）。`permissionTree.test.ts` 和 `PermissionTreeSelect.test.tsx` 里没有 `grantable`，只有 `roles.test.tsx` 从页面侧间接测。触发（变异）：把 `:197` 的 `mayChange(c)` 改回 `selectable.has(c)`，或把 `:186` 的 `!mayChange(code)` 改回 `!selectable.has(code)`，`npx vitest run src/pages/system/roles.test.tsx src/pages/system/permissionTree.test.ts -t "hands out only|toggle|click"` 仍全绿。后果（`:197` 回退后）：只持有 `USER:BAN` 的操作者新建角色时勾 `USER:BAN`，请求里多带没持有的 `USER:VIEW`，后端 403，操作者授不出这个角色。（`:186` 回退后，因为复选框本身已禁用，页面上点不到，只是函数自己的"点了不变"承诺没人守。）
3. **中文的 403 文字是两句话用空格拼在一起，没有标点。** 代码：`src/pages/system/texts.ts:46`（`withScopeHint`）和 `:60-61`（`protectedFailureText`）都是 `${text} ${hint}`。触发：中文界面，重置密码对话框收到 403，对话框里显示"你没有执行此操作的权限 管理员只能授出自己持有的权限；……"（探针读到）。英文有句号隔开，中文没有。`error.ADMIN_FORBIDDEN` 的中文无句号（`src/locales/zh-CN/error.ts:37`），既有的 `refusedHint` 拼接方式也一样，不是这次新引入的，只是现在 403 比以前更常见。后果：可读性，不影响正确性。
4. **报告对短信渠道凭据的分类前后不一致。** `reports/backend-d1-authsys-report.md:9` 把"短信渠道凭据由一个文本框改成名称加值若干行"列在"变更"，同一份报告第 49 行（W2a 第 4 条）却写"属于协议对不上，按立即修处理"。按 CLAUDE.md 的分类，这个改动是协议对不上（旧版发字符串，清单写的是映射），应归"立即修（已修）"，不该又算"变更"。后果：只是文档，负责人按开头一段数变更项会多数一条。
5. **短信渠道表单的 `<Form>` 没有表单级 `autoComplete="off"`，和本仓库其他对话框不一致。** 代码：`src/pages/sms/ChannelModal.tsx:179` 附近的 `<Form … name="smsChannel">`；`RoleModal.tsx:120`、`AdminFormModal.tsx:148`、`ResetPasswordModal.tsx:78`、`CampaignModal.tsx:189` 都设了。浏览器里量到该表单 `autocomplete` 为 `on`（值输入框自己是 `new-password`、名称输入框是 `off`）。这样会不会让真实 Chrome 把"凭据名称"当用户名、提示保存密码，我没查清（无头浏览器没有密码管理器，见未运行 1）。建议和别的对话框一致，加上这一项。

## 变更（不计入四个数）

1. **角色里含有操作者没持有的码时，"保存"必被后端拒绝，页面可以预先说明。** 按清单规则②，编辑这样的角色一律 403；页面现在是照常打开、允许点保存、再显示 403 的通用句子（浏览器里"Probe mixed"那一步就是这样）。页面已有"角色的码"和 `me.permissions`，可以在打开时就写明"这个角色含有你没持有的权限，你不能修改它"。这是新增页面行为，不是缺陷；要不要做、文字怎么写，请负责人定。

## 未运行

1. **真实 Chrome 的密码管理器和自动填充。** 本机只有无头 Playwright Chromium，没有保存的登录和密码管理器；所以"凭据值不被浏览器自动填充/不弹出保存密码"只验了属性（`type=password`、`autocomplete=new-password`、无显示开关、无 `name`），没有验行为。需要在装了保存登录的真实 Chrome 里点一遍渠道编辑对话框。
2. **全量测试和构建。** 规则是全部任务做完后由主会话跑一次，这里只跑了相关测试。

## 语言覆盖

403 文字探针：en-US 和 zh-CN 都跑了（界面只有这两种语言）。凭据的浏览器流程只用了英文界面；输入的值含西班牙语（ñandú）、泰语、中文、越南语（Đ）；阿拉伯语和印尼语只在实现者原有的测试数据里（`channels.form.test.tsx` 的 `كلمة-السر`、角色"Pengguna baru"），我没有另外加。界面文字检查只覆盖中文和英文。
