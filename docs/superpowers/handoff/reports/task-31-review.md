立即修 0、记录 11、变更 3、不是缺陷 8、阻塞 0

# 任务 31 评审：系统管理（管理员、角色、权限树、审计日志）

评审对象：提交 `ade9368`、`54d2632`，分支 `claude/jolly-dirac-4pq9g6`。深度评审（授权判断：谁能在整个后台做什么）。Node 24.22.1。只读：没有改共享检出里的任何源文件；所有复现、变异和我自己写的测试都在 `git archive HEAD` 的拷贝里（`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/t31r/app`，`node_modules` 链接、`src/.umi` 复制），共享检出评审结束时 `git status` 为空。

## 结论先说

- 没有立即修项：自己的行、最后一个启用的超级管理员、`GET /roles` 返回 403 时的 `roleIds`、密码、权限树成环、内置节点、审计日志只读和写入当时的用户名，这几条硬要求我都攻击过，实现是对的（证据见"核实通过"）。
- 最重要的一条是变更 1：勾选树的"取消一个后代就把父节点的码去掉"（任务书的规则）会让角色做不出"页面码加一部分功能码"。规格 5.8 自己就提到"只持有 `MODERATION:VIEW` 的管理员"，仓库自己的假角色"客服"（`USER:VIEW` 加 `USER:BAN`）也做不出来。这条要负责人在角色管理被真人使用之前决定。
- 记录项 11 条里 4 条是我新写的变异存活出来的测试缺口，其余是真实但不影响正确性的小缺陷（见各条的触发步骤和错误结果）。

## 我做了什么

1. 先读 `CLAUDE.md`、执行约定、模块任务说明、任务 31 的任务书、规格 5.16 和 5.0 系统管理行、契约 §17.2–§17.4（系统管理行、通则 2、5、15）、§1.4、§1.9、后端的四份回复、实现者的报告和问题文件，再读 `src/pages/system/`、`src/services/system/`、`mock/system*.ts`、`mock/_core/systemData.ts`、路由和两个语言文件的全部源码。
2. 在拷贝里跑本模块 14 个测试文件（含任务 5 的 `mock/auth.mock.test.ts`、`config/routes/system.test.ts`）：297 个测试全绿。`tests/noHardcodedText.test.ts`（在共享检出里只读跑）31 个绿；语言文件对称检查、路由检查绿；`npx tsc --noEmit` 整个项目除我自己的测试文件外 0 个错误；`npx biome check` 本模块路径无诊断。
3. 我自己写的新测试（都在拷贝的 `src/pages/system/t31r-*.test.ts(x)`，不进仓库）：
   - `t31r-tree-fuzz.test.ts`：对 `PermissionTreeSelect` 的规则写了独立的参考实现（按描述从头写，用嵌套递归，不看实现者的代码结构），随机 4000 棵树（多层、没有码对应的内置节点、重复码、孤儿节点、成环、父节点是自己、值里有未知码）乘每棵 8 次点击，共 32000 步，`toggleCode` 和 `stateOf` 每步都与参考一致；另有 3000 棵树对任务书三条规则（勾父得全部后代；取消一个后代后父码不在值里且父节点半选；值是排序去重的完整列表）的性质检查，和 2000 棵树"任何输入都不抛错、不返回不可选的码"。全部通过。
   - `t31r-tree-dom.test.tsx`：150 棵随机树乘每棵 6 次真实点击复选框，逐个节点比对"勾选/半选/禁用"和 `onChange` 的值，全部通过。
   - `t31r-self-fuzz.test.ts`：自己保护逻辑的性质检查。`adminPatchBody` 对自己的行永远是 `{}`、对别的行只可能有 `roleIds`/`superAdmin`、从不带密码/状态/用户名（3000 组随机补丁通过）；`isLastEnabledSuper` 对 5000 个随机列表与参考一致（通过）；`isOwnAccount` 的性质"用户名相同或 ID 同值就是自己"**不通过**（记录 1）。
   - `t31r-admins.test.tsx`、`t31r-roles.test.tsx`、`t31r-types.test.tsx`、`t31r-types2.test.tsx`、`t31r-select-robust.test.tsx`、`t31r-mask.test.ts`、`t31r-reach.test.ts`、`t31r-pw.test.tsx`：页面级攻击（见各条）。
4. 变异检查：实现者说的 117 个变异里，我在自己的拷贝里重跑了 56 个（第一轮挑的 44 个覆盖请求层、规则、页面、对话框、勾选树、权限树规则、假后端、审计；第二轮全部 12 个加测试后变红的）。结果：第一轮 44 个里 41 个变红、2 个存活（`rule-last-active`、`form-roles-changed`，都是实现者说的等价变异，我核对过确实等价，见不是缺陷 6）、1 个因代码格式没改成功（`mock-cycle`，用第二轮的改法重跑，变红）；第二轮 12 个全部变红。**另外我自己新想了 12 个变异，4 个存活**（记录 8–11）。合计 68 次变异运行（详见"变异检查"一节）。
5. 真实浏览器：没有做（任务要求不起开发服务器）。所有布局结论只来自单元测试和对样式的阅读，写在"未核实"里。

## 记录（11 条，建议全部修）

每条：位置、触发步骤、错误结果、带着它上线的后果。

1. **对自己那一行的识别：行 ID 不是字符串时，两层保护同时失效。** `src/services/system/self.ts:14`（`if (meId && target.id) return meId === target.id;`）。触发：后端的 `GET /admins` 里 `id` 是数字 `1001`（契约只明说 `GET /me` 的 `id` 是字符串，没写行的 `id` 类型；`normalizeMe` 保证 `me.id` 是字符串或 `undefined`），`me.id` 是 `"1001"`、用户名同为 `root`。两边 ID 都有值，严格比较 `"1001" === 1001` 为假，函数直接返回假，不再比用户名。结果：自己的行没有"我"标记，"停用"和"删除"按钮可点，编辑框里角色和超级管理员开关可用，我在拷贝里改开关保存，请求体是 `PUT /api/admin/admins/1001 {"superAdmin":false}`（`adminPatchBody` 因为 `own` 为假没有去掉它）。我的性质测试 `t31r-self-fuzz.test.ts` 第一条对 5000 组里 1655 组失败，其中本条是 ID 类型不同这一类。后果：只有后端也不拒绝时才有破坏，后端按契约拒绝（403）；前端的两层保护是同一个判断，所以一旦判断落空两层一起落空。修法很小：两边都转成字符串比较，并且 ID 不同时仍比用户名（用户名唯一，且创建后不能改，所以不会误判）。
2. **`PagedTable` 删掉最后一页唯一的一行后显示"无数据"，实际还有数据。** `src/pages/system/PagedTable.tsx:34-36,64-74`（页码状态 `paging.page` 在删除后不回退）。触发：21 个角色、每页 20 条，点第 2 页，只有"Soporte al cliente"一行，删除（先把用户的角色拿掉免得 `ROLE_IN_USE`）。结果：成功提示后表格是空的，占位文字"No data"，分页器高亮第 1 页（antd 把显示页夹回 1，请求仍是第 2 页，得到空的 `items`）；第 1 页的 20 行存在，点一下页码才出现。我在拷贝里复现（`t31r-roles.test.tsx`：`rows after delete 0 … empty text No data … active page 1`）。管理员页同一组件，同样触发。后果：运营以为数据没了；不丢数据，点页码恢复。共用的 `PagedListTable` 没有这个本地副本；记录项"本地版本"（实现者的记录 1）修掉时一并处理。
3. **审计详情的遮蔽有漏：`Authorization: Bearer <令牌>`、被截断或带引号的 JSON 文字、"password is …"都漏。** `src/pages/system/auditDetail.ts:38-41`（`KEY_VALUE` 只吃"键名 + 冒号/等号 + 一个词"）。我对 33 种形状跑了 `detailText`（`t31r-mask.test.ts`）：`'Authorization: Bearer eyJhbGciOi….payload.sig'` 显示成 `Authorization: ******** eyJhbGciOi….payload.sig`（只遮了 `Bearer` 这个词，令牌本身露出来）；`'{"password":"hunter2","a":'`（截断，解析失败）、`'body={"password":"hunter2"}'`、`'password is hunter2'`、`'https://admin:hunter2@example.com/x'` 原样露出；键名是 `old`/`new` 而值是凭据的形状（`{key:'sms.api_secret', old:'abc', new:'def'}`，契约说 `detail` 记"改动前后的值"）完全不遮；非拉丁键名（`пароль`、`รหัสผ่าน`）不遮。后果：契约规定 `detail` 不含凭据，所以这是第二道防线上的洞，不是主要风险；但它是实现者报告里"凭据类值显示成 `********`"这句话的反例，报告和页面注释的措辞需要改成"尽力遮蔽"。和变更 2 一起决定整个遮蔽的做法。
4. **对话框在行数据类型不对时崩溃，表格却不崩。** `src/pages/system/AdminFormModal.tsx:67`（`admin?.roles.map(...)`）、`:133`、`ResetPasswordModal.tsx:45,57`（`{ name: admin.username }` 没经过 `plainText`）。触发：`GET /admins` 的一行没有 `roles`，打开"编辑"：`TypeError: Cannot read properties of undefined (reading 'map')`；一行的 `username` 是对象，打开"编辑"：`Objects are not valid as a React child`（整页白屏）。表格列对同样的数据是防住的（`Array.isArray(row.roles)`、`plainText(row.username)`）。契约保证这两个字段，只有后端出错时触发；任务要求"非字符串值作为 React 子节点要走 `plainText`"，这三处是漏的。
5. **`PermissionTreeSelect` 遇到没有码或码不是字符串的节点就崩。** `src/pages/system/PermissionTreeSelect.tsx:53-55`（`String(item.key)` 去 `byCode.get`，而 `byCode` 的键是原样的码）。触发：节点 `{parent:null,…}` 没有 `code`，或 `code: 12`：`TypeError: Cannot read properties of undefined (reading 'code')`，角色对话框整个崩掉（`t31r-select-robust.test.tsx`）。重复码、名称是对象的节点、孤儿、成环都不崩。契约保证 `code` 是唯一字符串，只有后端出错时触发。
6. **前端码清单里没有的"内置"节点，编辑角色保存时被悄悄去掉授权。** `src/pages/system/permissionTree.ts:25-27`（`isSelectable`）、`RoleModal.tsx:47-58`、`:158-165`。触发：后端先发布了一个新的内置权限码 `NEW:CODE`（`builtin:true`，在 `GET /permissions` 里），前端 `PERMISSION_CODES` 还没更新；某角色持有它；运营只想改这个角色的备注，打开对话框保存。结果：该码显示为禁用的复选框，对话框顶部有警告"…不在权限树里，保存时会被去掉：NEW:CODE"，保存后角色失去这个权限（不勾它也没法保留）。警告文字还说"不在权限树里"，对这种情况（其实在树里）是错的。后果：前后端版本错开的窗口里，改任何一个角色都会拿走后端新码的授权；规格和任务书都没有"清单外的内置节点不可选"这个规则，是实现者加的。修法：不动用户没碰过的码（保留不认识的码），或者让清单外的内置节点也可选。
7. **失败文字：固定说明在不相干的失败后面声称了原因；"原样展示"没做到。** `src/pages/system/texts.ts:38,45-49`、`src/locales/*/system.ts` 的 `system.admins.refusedHint`。触发：`attempt()` 里的所有操作（启用别人、重置别人的二次验证、删除别人）收到 403 `ADMIN_FORBIDDEN` 或 409 `INVALID_STATE`，例如这个管理员的权限刚被撤销，或别的会话已经把那个人启用了。结果：错误译文后面总是加"后端对自己的账号和最后一个启用的超级管理员拒绝这个操作。什么都没有改变。"，说的原因可能不是事实。另外任务书写"后端 403 / 409 原样展示"，实现从不显示后端的 `message`（项目规则是按码取译文，实现者在问题文件里说明了原因），所以真实原因（"不能停用自己"）管理员看不到，只能靠这句猜测的说明。后果：误导，不丢数据。后端给了专用错误码之后这句说明和这条都应该去掉（问题文件第一部分第 1 条）。
8. **测试缺口：`me.superAdmin` 不是严格布尔时的行为没有测试守着。** `src/pages/system/AdminFormModal.tsx:65`。我把 `me?.superAdmin === true` 改成 `me?.superAdmin !== false`（`undefined`、`'true'`、`null` 都当超级管理员），实现者的全部测试仍然全绿（变异存活）。现在的代码是对的（`normalizeMe` 把值变成布尔，`=== true`；我手工让 `superAdmin:'true'`，开关禁用，测试通过），只是没有测试把它钉住。授权判断，补一个测试。
9. **测试缺口：创建管理员对话框的初始密码前后有空白时是否原样发送。** `AdminFormModal.tsx:102`。把 `password: values.password` 改成 `values.password.trim()`，全部测试仍然绿（变异存活）。重置密码对话框有这条测试（同一个变异变红），创建没有，而创建用的密码常量 `correct horse battery 1` 两端没有空白。
10. **测试缺口：行没有 ID、`me.id` 有值时按用户名认自己。** `self.ts:15`。把 `if (meId && target.id) return …` 改成 `if (meId) return meId === target.id`（去掉用户名回退）测试仍然全绿（变异存活）。
11. **测试缺口：`GET /roles` 返回裸 403（没有 `ADMIN_FORBIDDEN` 码，例如网关返回）。** `AdminFormModal.tsx:81`。把 `httpStatus === 403 ||` 去掉，测试仍然全绿（变异存活）。结果（若真的发生）：选择器显示"读取角色失败：…"加"重新读取"，而不是写明缺哪个权限；`roleIds` 仍不发，数据安全。

## 变更（3 条，需要负责人确认；我没有改）

**变更 1（最重要）：勾选树取消一个后代时把页面码也去掉，做不出"页面码加一部分功能码"的角色。**
- 事实：`permissionTree.ts` 的 `toggleCode`：取消一个已勾选的节点，去掉它、它的全部后代和它的全部祖先；勾选时往上补全。我在真实的内置树上做了广度优先搜索（`t31r-reach.test.ts`，`USER` 这一组）：从空开始，点任意顺序，只能到达 16 种取值——"全部五个 `USER:*`"或"一部分功能码但**没有** `USER:VIEW`"。`{USER:VIEW, USER:BAN}`（页面加封禁，不含邮箱、手机号、导出）到达不了。同样 `{MODERATION:VIEW}` 单独到达不了。
- 端到端复现（`t31r-roles.test.tsx`，角色页打开假数据里的"Soporte al cliente"，它持有 `USER:VIEW` 和 `USER:BAN`）：点"封禁"取消，`USER:VIEW` 一起取消；再点"封禁"勾回，`USER:VIEW` 仍然是空的；保存，请求体 `permissionCodes` 是 `["COMPLAINT:VIEW","NOTIFICATION:VIEW","SESSION:VIEW","STATS:VIEW","SUPPORT:MANAGE","SUPPORT:VIEW","USER:BAN"]`，没有 `USER:VIEW`——这个角色的人打不开用户页了。
- 对照契约：§17.3 写"权限码精确匹配，没有父子继承；给角色分配权限时，前端勾选父节点会同时勾选全部子节点，保存的是完整的码列表"，只写了勾选，没写取消。页面码 `USER:VIEW` 是页面的 `access` 码，功能码是各按钮的码（契约 §17.3 "每个页面对应一个 `MENU` 节点，该页面的接口权限码是它的 `FUNCTION` 子节点"）。规格 5.8 明写"只持有 `MODERATION:VIEW` 的管理员看到记录字段和无权查看内容的提示"，规格 3.4 / 契约 §17.3 的"建角色时每个模块的查看权限和该模块的操作权限一起授予"是一种做法，但规格 3.4 也说前端不拦截、按各自的码显示。两种读法下，这棵树都应该能表达"页面码加一部分功能码"，否则邮箱、手机号、导出这类涉及个人信息的功能码没法和页面码分开授予（要给 `USER:VIEW` 就必须同时给 `USER:EMAIL_VIEW`、`USER:PHONE_VIEW`、`USER:EXPORT`）。
- 为什么是变更不是缺陷：这个规则是任务书原文的要求（"取消一个后代，父节点变半选并从值里去掉"，来自 antd 树的默认行为），实现与它完全一致；改它就是改被规定的行为，要先由负责人确认。实现者在变更候选 1 里已经指出。
- 带着它上线的后果：运营按最小权限建角色时，要么给全组（含个人信息码，隐私暴露），要么只给功能码不给页面码（角色拿到了却打不开页面）；编辑已有的"页面加部分功能"角色，碰一下其中一个功能就会悄悄拿走页面码（界面上父节点只是变成半选，保存前没有任何"页面码将被拿走"的提示）。
- 需要确认的设计点：（a）取消后代时保留祖先的码（值里的祖先码与后代是否全选无关），祖先复选框用三种状态表示"自己的码在值里、后代只有一部分"；（b）还是保持现状但在保存前列出"将被去掉的码"。我倾向 a。选定后改 `permissionTree.ts` 的取消分支和对应测试，规格 5.16 也该写明取消时的规则。

**变更 2：审计详情按键名遮蔽凭据，范围和做法需要负责人定。**
- 现状：键名（去掉非字母、转小写）含 `password`、`secret`、`token`、`credential`、`authorization`、`apikey`、`privatekey`、`cookie`、`signature`、`totp`，或单词是 `pwd`、`otp`、`pass`，整个值（不管是布尔、数字、时间还是字符串）显示 `********`。我的测试输出：`{"mustChangePassword":true}`、`{"tokenVersion":{"old":3,"new":4}}`、`{"totpEnrolledAt":{…}}`、`{"passwordChangedAt":"2026-10-01"}` 全部被遮。这些恰好是重置密码、重置二次验证这类审计行里审计者要看的"改了什么"，而且都不是凭据；同时 `old`/`new` 形状的真凭据不遮（记录 3）。
- 后果：审计者看到 `********` 而不是 `true`/`3→4`；遮蔽给出一种"凭据不会显示"的错觉。契约规定 `detail` 只记改动的字段名和新旧值、不含用户内容，后端本来就不该写凭据。
- 选项：（a）只遮字符串值，不遮布尔、数字、空值和 ISO 时间（最小的改动，消除上面几个误伤）；（b）去掉遮蔽，要求后端保证；（c）保留现状。我倾向 a，并把报告和注释里的措辞改成"尽力遮蔽，后端另有责任"。

**变更 3：有 `ADMIN:MANAGE` 但不是超级管理员的人，页面上可以对超级管理员做重置密码、重置二次验证、停用、删除、改角色。**
- 事实：`admins.tsx` 的 `actionsOf` 对行没有任何"这行是超级管理员"的判断；假后端（`mock/system.mock.ts`）也只在"设置/清除 `superAdmin` 标志"时要求请求者是超级管理员（`:166`）。契约 §17.4 系统管理行只写了标志必须由超级管理员设置，没写别的动作。
- 后果：非超级管理员的 `ADMIN:MANAGE` 持有者可以对一个超级管理员重置密码、重置二次验证，然后自己登录绑定新的验证器，等于接管超级管理员账号（后端若按契约逐字实现，也拦不住）。这个提权路径在契约层面，不是前端能单独封住的。
- 需要确认：（a）向后端提问（写成 `docs/contract-requests/` 里的问题）：对超级管理员的任何写操作是否也只允许超级管理员；（b）前端对"当前管理员不是超级管理员、这一行是超级管理员"的行隐藏或禁用这些操作（只是第二道防线，后端是最终裁决）。问题文件现在没有这一条。

## 不是缺陷（8 条）

1. **自定义节点可以勾给角色。** 实现者的报告写"任务书写只有真实权限码清单里的码可以被勾选"，任务书 31 的原文（`bash brief.sh 31`）没有这句话。契约 §17.3 写"自定义节点能分配给角色……它们对现有接口没有效力"，规格 5.16 的页面顶部文字也这样说，`isSelectable`（`permissionTree.ts:25-27`）让清单里的码和自定义节点可选，正确。（清单外的内置节点不可选这一部分见记录 6。）
2. **`PUT /admins/{id}` 只发有改动的 `roleIds` 和 `superAdmin`，不带 `username`。** 契约写请求体是 `{"username","roleIds","superAdmin"}`，没写哪些可省略、缺省是"不改"还是"清空"。按 `CLAUDE.md`，契约的缺口不是阻塞：问题文件第一部分第 2 条已写，页面按最小做法（不发没改的字段，读不到角色时绝不发 `roleIds: []`）。我核对了：别的行读不到角色（403）时，请求体只有 `{superAdmin}` 或者根本不发（保存键禁用）；`adminPatchBody` 的变异"没改动时发空数组"被测试抓住（变红）。**提醒**：如果后端把缺省字段当"清空"，只改超级管理员标志会拿走这个人的全部角色。这条必须在真后端联调前得到回答，我在报告开头没有把它算作缺陷，只是请负责人记在联调清单里。
3. **权限树的成环检查不能发现别人刚做的移动；实现者报告把它说得过头了。** `PermissionNodeModal.tsx` 的候选父节点和 `buildPermissionPatch` 用页面最近一次读到的 `nodes`；页面只在自己写操作之后重读，没有轮询，所以"别人同时把节点移到它下面"的测试（`permissions.test.tsx:528`）是通过替换组件的 `nodes` 属性模拟的，真实页面里别人的移动要到自己下一次重读才看得到。前端不可能比后端更新；后端的成环处理是问题文件第三部分第 3 条（假后端做了成环检查，我用变异 `mock-cycle` 验证，变红）。如果真后端不检查成环，页面对成环数据也不会死循环（`buildIndex` 把成环的节点都当根，我的随机测试覆盖了）。
4. **改了任务 5 的 `mock/system.permissions.mock.ts`。** 文件名属于这个模块的假后端家族，改动只有读取来源（`permissionNodes()` 改成 `systemState.nodes`），实现者在报告里写明了并说明回退办法。`mock/auth.mock.test.ts` 的 `GET /permissions` 三条（79 项和字段集、没有两个权限之一时 403、任一权限都可读）我在拷贝里原样跑过，全绿，提交里没有改这个测试文件。
5. **"Facebook"出现在假数据和测试里。** `mock/_core/systemData.ts:168`、`auditDetail.test.ts:27,37` 的键名 `facebookAccessToken` 是契约字段名（`facebookAccessTokenSet`），不是参照项目或第三方产品被引用；仓库里别的模块也在用。
6. **两个存活的变异是等价变异。** `adminRules.ts` 的 `isLastEnabledSuper` 去掉行自己的 `status === 'ACTIVE'`：已停用的行不可能是启用的超级管理员里唯一的一个（唯一的那个必是启用的），结果不变。`AdminFormModal.tsx` 的 `rolesChanged` 去掉 `!rolesLocked`：控件禁用时值保持原值，没有别的路径能在禁用时改值，比较结果相同。（我新想的 4 个存活变异不是等价的，是记录 8–11。）
7. **实现者的变更候选 4–7 不是缺陷。** 4（自己的行编辑框仍能打开、控件禁用并写明原因）符合任务书"对自己的行这两项禁用"；5（重置自己的密码、二次验证没有禁用）规格和契约都没有禁止；6（审计的"管理员"筛选对有 `ADMIN:MANAGE` 的人是下拉、其余是输入 ID）是对"只有 `AUDIT:VIEW` 读不到管理员列表"的合理处理；7（新建权限节点排序默认 0）规格没有规定。
8. **"最后一个启用的超级管理员"依赖页面读到的列表，列表过期时的行为。** 列表过期且多出一个超级管理员（别人刚启用了另一个）时，页面保守地继续禁用按钮，刷新或下一次写操作后恢复；列表过期且少了一个时按钮可点，后端返回 409，页面显示译文，不会改变任何东西（实现者的测试 `shows the backend refusal… 409 INVALID_STATE` 覆盖）。读不到全部管理员时不替后端猜（实现者的记录 4，行为与说明一致）。`loadAll` 最多读 50 页（一万个管理员），再多就把已读到的当全部，只会让按钮多禁用，不现实。我用 51 个管理员、第二个超级管理员在第 3 页的情形验证了两个方向（`t31r-admins.test.tsx` paging）：有第二个启用的超级管理员时 root 的停用可点，第二个是停用状态时 root 的停用被禁用。

## 核实通过（不是发现，列出我攻击过但没有问题的地方）

- **自己那一行**：`me` 整体缺失时每一行都当成自己的（角色、开关、停用、删除全禁用）；`me.id` 缺失时按用户名不分大小写；`me.superAdmin` 是 `'true'` 时开关禁用；非超级管理员只有 `ADMIN:MANAGE` 且 `GET /roles` 403 时角色选择器禁用并写明缺 `ROLE:MANAGE`，保存键禁用，没有任何写请求；超级管理员在同样的 403 下只改开关，请求体只有 `{"superAdmin":true}`，没有 `roleIds`（用 `roleIds: []` 拿走角色的路径没有）。账号切换：页面卸载重挂，没有跨账号的缓存状态（`useRead` 都是组件内状态）。
- **PUT 请求体**：只含 `roleIds`/`superAdmin`，从不带 `username`、`status`、`password`；`updateAdmin` 对自己的行在请求层再去掉一次；变异"没有 `roleIds` 时发 `[]`"、"读不到角色仍发 `roleIds`"都被测试抓住。
- **密码**：创建和重置原样发送，两端空白不去（变异抓住重置，创建的缺口是记录 9）；输入 `type=password`、`autoComplete=new-password`；失败后取消再打开，DOM（去掉输入框后）、`sessionStorage`、`localStorage`、地址、请求地址里都没有密码（`t31r-pw.test.tsx`，后端错误的 `message` 里还回显了密码，页面也不显示）；没有 `console` 调用。规则取 `me.passwordMinLength`（码点数）。
- **"没有任何接口返回密码，所以没有显示一次的对话框"**：我在契约全文和后端四份回复里搜了"临时密码、temporaryPassword、initialPassword、生成密码、随机密码、generatedPassword"，没有匹配；契约写"创建时由创建者设置初始密码""重置密码 `{newPassword}`"，两个密码都由管理员自己输入，不需要显示一次。这个说法成立。
- **权限树页**：内置节点只能改名称和排序（码、类型、父节点禁用，请求层不带 `parent`），没有删除；自定义节点可改父节点、可删除；候选父节点排除自己和全部后代；`PERMISSION_HAS_CHILDREN` 显示译文；顶部说明的中文是规格 5.16 的原句；写按钮都按 `PERMISSION:MANAGE`；读取假后端要 `ROLE:MANAGE` 或 `PERMISSION:MANAGE`。
- **角色**：`ROLE_IN_USE` 显示译文；重复名字的 `DUPLICATE_RESOURCE` 的 `data.field` 指到"名称"；权限码数量显示为完整数量。
- **审计日志**：页面和服务里没有任何会改或删的函数或控件；筛选管理员、动作、对象类型、对象 ID、UTC 日范围（`[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`）；管理员列显示 `adminUsername`，为 `null` 时 ID 前 8 位；"改成当前名字"的变异（`text-admin-label`、`audit-name`）变红；详情一律过 `plainText`；5000 字符、阿拉伯语、泰语、emoji 在单元格里走 `EllipsisPopoverText`（`overflowWrap: anywhere`）。
- **逐句对照规格 5.16 和任务书**：管理员的列、表单（用户名创建后只读、初始密码规则同 3.3、角色多选、超级管理员标志）、行操作（启用/停用、重置密码、重置二次验证、删除）；角色的新建、编辑、删除、勾选树、整体替换；权限树的列（名称按界面语言、权限码、类型、排序、是否内置）、新增节点的六个字段、内置/自定义的编辑规则、行内确认的删除、顶部说明；审计的五个筛选和六列；任务书的树组件属性、名称回退（缺一种用另一种，都缺显示码）、各条测试要求。没有发现规格或任务书写了而页面没有的元素。
- **每个写按钮的权限码**：管理员页每个接口都要 `ADMIN:MANAGE`，按钮都按它；角色页 `ROLE:MANAGE`；权限树页 `PERMISSION:MANAGE`；审计页无写操作。重复点击：行内确认和对话框用 `useSingleFlight`，菜单里的动作用 `runOnce`；晚到的读取由 `useRead` 的"最新的算"处理；对话框只在打开时挂载（创建、编辑、重置密码、角色、权限节点五个都是 `dialog !== null` 条件渲染），编辑对话框按行 ID 作 `key`。
- **隐藏字符、第三方名、语言**：本次两个提交的 41 个文件逐字符查 Unicode 类别 Cf/Cc/Z，没有原始隐藏或双向控制字符；en-US 里没有中日韩字符，没有韩文；没有 `console` 调用；zh-CN 和 en-US 键对称（`parity.test.ts` 绿）；文字扫描绿。
- **共享文件**：除上面不是缺陷 4 的文件外，两个提交没有改 `tests/stubs/*`、`src/components/*`、`src/utils/*`、`src/request/*`、`src/session/*`、`mock/_core/*` 的现有文件（`mock/_core/systemData.ts` 是任务书允许的本模块辅助文件）。

## 变异检查（我跑的 68 次）

- 实现者的第一轮（`muts.json`）挑 44 个：`svc-own-strip`、`svc-own-nothing-known`、`svc-own-id`、`svc-own-name-case`、`svc-builtin-parent`、`svc-password-trim`、`svc-encode`、`rule-last-count`、`rule-last-unknown`、`rule-pw-min-off-by-one`、`page-admin-disable-last`、`page-admin-own-by-id`、`page-admin-disable-own`、`form-roles-own`、`form-roles-unreadable`、`form-flag-own`、`form-flag-super`、`tree-*` 十项（取消去祖先/去后代、勾选加后代、向上补全两种坏法、半选、自定义可选、不可选节点被点、候选父节点、父节点是后代）、`prules-builtin-parent`、`prules-loop`、`prules-moved`、`mock-self-put`、`mock-self-status`、`mock-self-delete`、`mock-last-status`、`mock-last-delete`、`audit-mask-key`、`audit-mask-text`、`audit-name`、`pnode-parent-builtin`、`pnode-code-readonly` 等：41 变红，2 存活（等价，不是缺陷 6），1 没改成功（`mock-cycle`）。
- 第二轮（`muts-r2.json`）12 个全部重跑，全部变红（`page-admin-disable-own`、`page-admin-delete-own`、`form-flag-own`、`form-flag-last`、`form-username-trim`、`formfail-message`、`page-admin-no-reload-all`、`role-dropped`、`pnode-guard`、`audit-depth`、`audit-adminId-filter`、`mock-cycle`）。
- 我自己新想的 12 个：`adminPatchBody` 没有 `roleIds` 时发 `[]`（变红）、编辑对话框总是发 `roleIds`（变红）、重置密码对话框去空白（变红）、`isLastEnabledSuper` 读不到列表时当成最后一个（变红）、`wouldCreateCycle` 去掉"父节点是自己"（变红）、角色删除去掉确认（变红）、审计的管理员 ID 不去空白（变红）、假后端 `GET /roles` 只要 `ROLE:MANAGE`（变红）；存活 4 个：创建对话框去空白（记录 9）、`me.superAdmin !== false`（记录 8）、`isOwnAccount` 去掉用户名回退（记录 10）、`GET /roles` 裸 403（记录 11）。

## 未核实

- 真实浏览器里的布局（390 像素宽、5000 字符无空格串在审计日志的"动作""对象类型""对象 ID"三列和权限树的"权限码"列：这几列用的是 `overflowWrap: anywhere` 的 `span`，没有宽度上限，而表格 `scroll.x` 是 `max-content`，我认为一个 5000 字符的值会把这一列撑到几千像素宽；这些列在契约里是系统生成的标识，不是任意文字，所以我没有把它写成发现。管理员名、角色名、备注、节点名、详情走 `EllipsisPopoverText`，有宽度）。
- 非 Chromium 浏览器、真后端。
- 实现者的真实浏览器检查我没有重做。

## 给负责人的三个决定

1. 变更 1（勾选树取消时的规则）：在角色管理被真人用来建最小权限角色之前定。
2. 变更 3（非超级管理员对超级管理员的重置/停用）：需要同时问后端。
3. 联调前向后端确认：`PUT /admins/{id}` 缺省字段的含义（不是缺陷 2）。

## 主会话复核（处理结果）

- 记录 1（行 ID 是数字、`me.id` 是字符串时，自己那一行的两层保护同时失效）：自保护是任务书的硬要求，按"权限判断"的深度评审标准改判为**立即修**，已修：`isOwnAccount` 把两边的 ID 都按文字比较。新测试覆盖数字对文字和文字对数字，修复前变红。
- 变更 3（只有 `ADMIN:MANAGE` 的管理员可对超级管理员重置密码和二次验证，等于接管）：这是契约层面的缺口，已写进问题文件（补充一节）向后端提问；前端是否多挡一层是新增行为，等负责人决定。**建议你重点看这一条。**
- 变更 1（勾选树取消后代会连页面码一起去掉，做不出"页面码加一部分功能码"的角色）：同意评审判为变更，任务书原文如此，建议在角色管理被真人使用之前定。
- 其余记录项进批量修复。
