立即修未修 0、记录项 1、未运行 1、阻塞 0

# 后端第一批交付：登录、绑定认证器、管理员、角色、权限、审计（区域代号 authsys）

清单行：a1、a2、a3、e6，以及“W2a”节里属于本区域的三条（权限节点类型不可改、审计筛选长度、短信渠道凭据）。邮件模板含 NUL 字符那一条按清单只记录、不做。

**未运行 1：** 全量测试和构建（规则：全部任务做完后由主会话跑一次）。本区域只跑了和改动有关的测试，最后一轮的命令和结果在文末。
**记录项 1：** 邮件模板主题或正文含 NUL 字符时后端答 400（清单 W2a 第 5 条）。正常表单输入不会产生 NUL，没有改动；触发它需要在请求里手工塞入 NUL，结果是 400 `INVALID_REQUEST`，页面显示按码翻译的文字，没有数据损失。邮件模板页由别的区域负责，这里不改。
**变更（按业界通行做法自己定）：** ① 角色权限树里非超级管理员持有以外的节点预先禁用；② 短信渠道凭据由一个文本框改成“名称 + 值”若干行（见下 W2a 第 1 条）。理由都写在对应行。

## a1 管理员只能授出自己持有的权限（四类 403 `ADMIN_FORBIDDEN`）

**落实了什么**
- 文字：按负责人的规则不显示后端 `message`。四类 403 的文字，按码的那一句（`error.ADMIN_FORBIDDEN`，会话层原有的全局提示不变）后面，在会授出或改动角色、管理员的写操作里加一句通用而准确的话，覆盖四条规则：“管理员只能授出自己持有的权限；不能修改自己持有的角色；只能修改权限都在自己持有范围内的角色和管理员。什么都没有改变。”（`system.scopeHint`；管理员页的行内操作用 `system.admins.forbiddenHint`，多一条“这是你自己的账号”，因为同一个码也用于自己账号的保护。）用在：角色对话框（新建、编辑）、删除角色、管理员对话框、重置密码对话框、管理员行内的停用/启用/重置二次验证/删除。权限树页的写操作不加（那里的 403 只是缺权限，不涉及这四条）。文件：`src/pages/system/texts.ts`（`withScopeHint`、`protectedFailureText`）、`RoleModal.tsx`、`AdminFormModal.tsx`、`ResetPasswordModal.tsx`、`roles.tsx`、`src/locales/{zh-CN,en-US}/system.ts`。
- 403 不跳转、不退出：没有改请求层；会话层原有做法（提示一次、重取一次 `GET /me`）不变（见 e6）。
- 角色权限树预先禁用（只作辅助）：非超级管理员，`GET /me` 的 `permissions` 里没有的节点显示但不能勾选或取消；勾选一个父节点时只带上持有的后代和祖先；取消父节点时不去掉没有持有的后代（它们保持勾选且灰色，因为后端本来就不允许这个操作者改动含有它们的角色）。文件：`src/pages/system/permissionTree.ts`（`toggleCode` 加可选的 `grantable`）、`PermissionTreeSelect.tsx`、`RoleModal.tsx`。超级管理员不受影响，没有 `me` 时不禁用。
- 假后端（`mock/system.mock.ts`）按四条规则答 403：① `POST /roles`：请求的码必须都是持有的；② `PUT /roles/{id}`：不能改自己被分配的角色，角色原有的码和请求的码都必须是持有的；`DELETE /roles/{id}`：角色原有的码必须是持有的；③ `POST/PUT /admins` 的 `roleIds`：各角色的码合起来必须是持有的；④ `PUT /admins/{id}`、`…/status`、`…/reset-password`、`…/reset-totp`、`DELETE /admins/{id}`：目标管理员持有的码必须都是操作者持有的（超级管理员当作持有全部）。超级管理员的操作者不受限制。四条英文消息和清单一致，`data` 为 `null`，被拒绝的请求什么都不改。同一个路由里几条检查的先后是假后端自己定的（清单只说“第一个不通过的先答”，来源文件里的顺序我们没有），所以前端不依赖顺序。
- 因此一个以前能通过的情形现在是 403：非超级管理员不能再对最后一个超级管理员（持有全部码）操作；原来用 `ADMIN:MANAGE` 单码测“最后一个超级管理员 409”的三处假后端测试，改成用持有全部码的非超级管理员来到达那条 409。
- 问题文件：`docs/contract-requests/2026-10-31-admin-frontend-admin-forbidden-reason.md`（请后端给结构化的 `data.reason`；`GET /me` 的 `permissions` 是否等于“持有的码”没有核实，所以树的禁用只是辅助；`GET /me` 或 `GET /roles` 缺“哪些角色是我的”，所以不能预先禁用“编辑自己持有的角色”）。

**测试：** `mock/system.mock.test.ts` 末尾 `what an administrator may grant: only what they hold`（9 条，含超级管理员不受限、自定义节点）；`src/pages/system/roles.test.tsx` 末尾 `an administrator who is not a super administrator hands out only what they hold`（6 条）；`src/pages/system/admins.test.tsx` 末尾 `acts only on administrators within what they hold`（2 条）；`src/session/SessionBridge.test.tsx` `treats the refusals of the grant rules …`（403 带消息、无数据时只重取一次、不跳转）。

**命令和结果**
- RED：`npx vitest run mock/system.mock.test.ts` → 9 failed | 39 passed（失败都是“应当 403 却 200”）；`npx vitest run src/pages/system/roles.test.tsx` → 5 failed | 30 passed（找不到句子、`COST:VIEW` 没有禁用、勾选父节点把没有持有的子节点也勾了、取消父节点时没有持有的子节点被去掉）。
- GREEN：同样的命令 → 50 passed（mock）；roles 页 35 passed（第 5 条失败是我的测试数据写错：“Soporte al cliente”并不含 `USER:EXPORT`，改成自建角色后通过）。admins 页新增 2 条一次通过（实现先于测试写，没有 RED，靠变异检查证明有效，见下）。

## a2 登录时 401 `ADMIN_TOTP_INVALID`（密钥解不开）

**核对现有处理：** 登录页对这个码本来就是“清空验证码框、保留用户名、显示文字”，和输错验证码同一条路径，计入锁定次数在后端，前端没有特殊处理，所以前端逻辑不变。5 次后的 429 走 `failureNotice`（“N 分钟后再试”）。
**落实了什么：** 登录页对这个码用自己的一句，涵盖“密钥解不开”并提示联系超级管理员重置二次验证：“验证码错误、已使用或已过期，或者你的二次验证无法校验。如果一直失败，请联系超级管理员重置你的二次验证。”（`auth.login.totpInvalid`，`src/pages/user/login/index.tsx`，两种语言）。绑定页仍用共用的 `error.ADMIN_TOTP_INVALID`（那里是输错码，不涉及密钥解不开，所以共用文字不改）。假后端：管理员的 `totpSecretUnreadable` 标志使登录答 401 `ADMIN_TOTP_INVALID` 并计入锁定，重置二次验证清掉标志（`mock/_core/store.ts`、`mock/auth.mock.ts`、`mock/system.mock.ts`，README 记了）。
**测试：** `mock/auth.mock.test.ts`（密钥解不开计入锁定、5 次后 429；没有验证码时仍先要验证码；重置后重新绑定）；`src/pages/user/login/login.test.tsx`（英文句子、中文句子含“无法校验”和“联系超级管理员重置你的二次验证”、连续 401 之后 429 的锁定文字、不跳转）。
**RED：** `npx vitest run mock/auth.mock.test.ts` → 3 failed；`npx vitest run src/pages/user/login` → 2 failed（文字不存在）。GREEN：auth mock 56 passed，login 27 passed。

## a3 绑定页 401 `ADMIN_INVALID_TOKEN` 且 `enrollToken` 作废 → 回登录页

**核对：** 现有 enroll 页（`src/pages/user/enroll/index.tsx`）已满足：这个码 → 清掉内存里的绑定信息、提示“绑定已过期，请重新登录”、回登录页并保留 `redirect`；绑定请求用 `reportSession: false`（`src/services/auth/index.ts:25`），所以它不会被会话层当成“登录已失效”而清令牌、再弹一次提示。没有改前端代码，补测试。假后端：`enrollSecretUnreadable` 使绑定答 401 `ADMIN_INVALID_TOKEN` 并作废令牌。
**测试：** `src/pages/user/enroll/enroll.test.tsx`（4 条新增：回登录页并显示提示、不触发“会话结束”处理且只发一次请求；保留 `redirect`；作废的令牌不能再用，重新进入页面直接回登录页且不再发请求；对着假后端整条链路）；`mock/auth.mock.test.ts`（令牌作废后同一令牌再用仍 401，重新登录得到新令牌可用）。这些测试在实现之前就是绿的（该行本来就满足），证据是变异检查 M12、M12b、M10 把对应代码拿掉后变红。
**命令：** `npx vitest run src/pages/user/enroll` → 13 passed。

## e6 权限生效

前端做法不变，已满足：进入应用时 `loadSession` 取一次 `GET /me`（`src/session/loadSession.test.tsx` “reads the account and then the shared values”），收到 403 `ADMIN_FORBIDDEN` 时 `SessionBridge` 提示一次并重取一次（`src/session/SessionBridge.tsx:36-46`），不轮询（`SessionBridge.test.tsx` “reads the permissions only once when several refusals arrive together, and does not poll”）。新增一条测试把它写明：a1 的 403（带 `message`、`data` 为 `null`）走同一条路，只重取一次、不跳转、令牌保留（`SessionBridge.test.tsx` 里 `treats the refusals of the grant rules …` 上面有注释写着 `admin.permission_cache_seconds` 的含义）。命令：`npx vitest run src/session/SessionBridge.test.tsx src/session/loadSession.test.tsx` → 22 passed。变异 M24（403 后不重取）变红。

## W2a

1. **`PUT /permissions/{code}` 节点类型不可改。** 前端已满足：编辑时类型下拉框禁用（`PermissionNodeModal.tsx` 的 `disabled={!creating}`），`updatePermission` 的请求体里没有 `type`（`src/services/system/index.ts`；新增 `src/services/system/system.test.ts` 末尾一条：即使调用方多传了 `type` 也不发）。假后端：请求带了与现有不同的 `type` → 400 `INVALID_REQUEST`，`details` 为 `[{ref:'type', reason:'OUT_OF_RANGE'}]`，什么都不改（`mock/system.mock.ts`）；写同一个类型不算改。测试 `mock/system.mock.test.ts` `refuses a new type for a node …`。RED：1 failed；GREEN 通过。
2. **`GET /audit-logs` 输入长度。** 动作、对象类型输入框 `maxLength` 64，对象 ID 255（`src/pages/system/audit.tsx`）；超过的粘贴被浏览器截断，所以不会发出后端会答 400 的请求。假后端对超长参数答 400 `TOO_LONG`，ref 为参数名，按字符（码点）计，64 个 emoji 可以。测试：`audit.test.tsx` `limits the action and the object type to 64 characters …`（泰语、阿拉伯语、5000 无空格以内的长串）和 `mock/system.mock.test.ts` `refuses an action or an object type of more than 64 …`。RED：各 1 failed；GREEN 通过。真实浏览器：打字 100 个字符后框里 64 个，属性 `maxlength` 为 64/255。
3. **邮件模板含 NUL 字符 400：** 记录，不做（见开头）。
4. **短信渠道 `credentials`。** 检查结果：现有渠道表单把 `credentials` 当**一个字符串**发（一个密码框，`buildChannelBody` 里 `trimSpec(values.credentials)`，这是我们早先问题文件里写的暂定做法），而清单写的“值必须是非 null 字符串（null 值或名称 → 400）、不改时省略或发 `{}`”说明后端收的是**名称到值的映射**。字符串形状和后端的映射对不上，渠道凭据会存不进去，属于协议对不上，所以按“立即修”处理（我还没查清后端对字符串的实际反应，所以问题文件里问了；但这个形状必须改）。做法：
   - 表单（`src/pages/sms/ChannelModal.tsx`）：“凭据”是若干行“名称 + 值”（值是密码框、不带显示开关、`autocomplete="new-password"`），有“添加一项凭据”和“删除”。打开时一行也没有，不论后端发什么（凭据永不回显的规则不破坏）；有完整的一行时才发 `credentials: {名称: 值}`（名称和值都去首尾空白），没有行或行都留空就**不带这个键**（后端保持原样）；有条目的映射替换全部已保存的凭据，页面文字写明要把每个名称和值重新填一遍。只填一边、名称重复在页面里拦下（`credentialProblems`，`src/pages/sms/channelRules.ts`），所以页面不会发出 null 值或空名称。后端 400 `EMPTY_NOT_ALLOWED`、`ref` 为 `credentials` 时，文字放在凭据区下面（按码翻译，不显示后端消息）。
   - 假后端（`mock/sms.mock.ts`、`mock/_core/smsData.ts`）：凭据存成映射；null 值、非文本值、空名称或只有空白的名称、不是映射（null、文本、列表）→ 400 `EMPTY_NOT_ALLOWED` on `credentials`，创建和更新都一样、不改任何东西；省略或 `{}` 保持不变；答案里仍只有 `hasCredentials`。
   - 服务类型 `src/services/sms/types.ts`：`credentials?: Record<string,string>`。语言文件两种语言加了六条文字、改了两条（`sms.channels.credentialsSet`、`note.credentials`）。
   - 问题文件：`docs/contract-requests/2026-10-31-admin-frontend-sms-credentials-shape.md`（是否整体替换还是按名称合并；每个供应商需要哪些名称，请在 `GET /sms/meta` 里给 `credentialNames`；字符串的旧写法后端怎么答；长度和条数上限）。
   - 和 msg 区域的分工：只动了渠道表单、渠道规则、渠道的假后端和服务类型，没碰模板、记录；共享的 `mock/sms.mock.ts`、`mock/sms.mock.test.ts`、`src/locales/*/sms.ts` 在我提交时已没有别的代理的未提交改动（对方先提交了），所以第二个提交里只有渠道凭据的改动。
   - 测试：`channelRules.test.ts`（映射、空行不发、不发 null、`credentialProblems`）、`channels.form.test.tsx`（打开无行且无回显、密码框属性、一边空和重名拦下并且不发请求、多种语言的值进请求、重新打开无行、失败不显示凭据和后端文字、后端拒绝放在凭据下）、`mock/sms.mock.test.ts`（7 种非法形状 × 创建和更新、`{}` 保持、任意语言的值）。RED：`npx vitest run mock/sms.mock.test.ts src/services/sms src/pages/sms/channelRules.test.ts` → 18 failed | 69 passed；GREEN：同时加上 `channels.form.test.tsx channels.test.tsx channels.testsend.test.tsx` → 6 个文件 156 passed。真实浏览器：打开编辑时 0 行，只填名称提交时“Enter a value for this name”，补值后请求体是 `{"apiKey":"ñandú-ผู้ใช้-密钥"}`，重新打开 0 行，页面 HTML 里没有这个值。

## 真实浏览器检查（Playwright Chromium，草稿目录拷贝，`dev:mock` 端口 8741/8742，用完按进程号停）

看了：根给 `reviewer` 加角色“Role managers”后，以 `reviewer`（非超级管理员）打开角色页：新建角色的树里持有的节点（`MODERATION:REVIEW`）可勾，没有持有的（`USER:VIEW`、`COST:VIEW`）灰色；编辑“Soporte al cliente”直接保存 → 对话框里“You do not have permission to do this.”加通用句子，没有后端英文消息，对话框和页面都留着，地址不变；审计页输入框截断；登录页错误验证码的英文和中文句子；绑定请求被拦成 401 `ADMIN_INVALID_TOKEN` 后回登录页并显示“The setup has expired. Sign in again.”，直接打开 `/user/enroll` 也回登录页；短信渠道对话框的凭据行。控制台只有预期的 401（登录前、错误验证码）和 403（被拒绝的保存），没有页面错误、没有告警。只覆盖英文和中文的界面检查（界面只有这两种语言）；输入的值含泰语、阿拉伯语、越南语、西班牙语、中文。

## 变异检查（把判断拿掉或反过来，看对应测试是否变红）

脚本 `mutate.py` 在草稿目录，每个变异单独应用、跑相关测试、再还原。全部变红，只有一个最初没抓到：
- 假后端：M1 `POST /roles` 的授出检查拿掉；M2 `PUT /roles` 的“自己持有的角色”拿掉；M5b `PUT /roles` 原有码检查拿掉；M5 `DELETE /roles` 检查拿掉；M3 `reset-totp` 的目标检查拿掉；M4 `PUT /admins` 的 `roleIds` 检查拿掉：都变红。M5c 去掉“超级管理员不受限”：最初**没变红**（等价变异：超级管理员本来就持有全部已知码），补了一条“超级管理员给角色授自定义节点码也成功”的测试后变红。
- 假后端：M6 节点类型可改、M7 审计长度限制拿掉、M8 解不开的密钥不计入失败、M9 绑定的密钥检查拿掉、M10 绑定令牌不作废、M21 凭据映射校验拿掉、M22 `{}` 当成替换：都变红。
- 页面：M11 登录页文字退回通用文字、M12 绑定页不再回登录页、M12b 绑定请求报告会话结束、M13 审计输入框不限长、M14 角色对话框没有句子、M15 管理员页 403 没有句子、M16 勾选忽略持有范围、M17 树不禁用、M18 对话框不传持有的集合、M19 空行也发、M20 重名不拦、M23 值缺失不拦、M24 403 后不重取权限：都变红。
- 变异脚本运行期间（13:22–13:30）临时改过 `src/pages/sms/channelRules.ts`、`ChannelModal.tsx`、`mock/sms.mock.ts` 各一小段，每次几十秒；如果 msg 区域的代理恰好在这段时间跑短信测试，可能见到一次偶发失败，重跑即可恢复（不是缺陷）。

## 覆盖的语言

新增的测试和假数据含泰语、阿拉伯语、越南语、西班牙语、中文、英语（凭据名称和值、审计筛选输入、角色名）；印尼语只在原有的假数据里（角色“Pengguna baru”）。界面文字检查只覆盖 zh-CN 和 en-US。

## 问题文件

- `docs/contract-requests/2026-10-31-admin-frontend-admin-forbidden-reason.md`（新）
- `docs/contract-requests/2026-10-31-admin-frontend-sms-credentials-shape.md`（新）

## 需要改共享文件

没有。改动的共享文件都是最小增量：`mock/_core/store.ts`（管理员加两个可选标志）、`mock/_core/smsData.ts`（凭据存成映射，属于渠道）、`src/locales/*/{auth,system,sms}.ts`（只加或改本区域的键）、`README.md`（一句）。

## 规格需要在 main 上修改的地方

清单第 5.2 节已经列了设计文档的改动，这里没有新增；只补一条：设计文档 5.16 说角色页对 403 “展示后端 message”的地方，按负责人的规则应改成“显示按码翻译的文字，需要区分时由后端给 `data.reason`”（对应上面第一个问题文件）。

## 最后一轮测试

命令：`npx vitest run mock/system.mock.test.ts mock/auth.mock.test.ts mock/sms.mock.test.ts src/pages/system src/pages/user src/pages/sms/channelRules.test.ts src/pages/sms/channels.form.test.tsx src/pages/sms/channels.test.tsx src/pages/sms/channels.testsend.test.tsx src/services/system src/services/sms src/services/auth src/session tests/noHardcodedText.test.ts src/locales`（`src/pages/user` 也匹配了 `src/pages/users`，多跑了用户页）。结果：46 个文件、1393 条里 1385 条通过、8 条失败；失败都是机器负载高（平均负载约 10，别的代理同时在跑测试）时 30 秒超时或等待超时，没有断言失败：`audit.test.tsx` 3 条、`roles.test.tsx` 3 条、`users/detailTabs.test.tsx` 2 条（用户页，不是本区域）。单独重跑：`npx vitest run src/pages/system/audit.test.tsx` → 24 passed；`npx vitest run src/pages/system/roles.test.tsx src/pages/users/detailTabs.test.tsx` → 57 passed。因此这一组没有失败项，但“一次跑完全绿”我没有拿到，只拿到“失败的都单独重跑通过”。`npx tsc --noEmit` 对本区域路径没有诊断；`npx biome check` 对本区域文件没有错误。
