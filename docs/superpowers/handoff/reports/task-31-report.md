立即修未修 0、记录项 6、未运行 4、阻塞 0

# 任务 31 报告：系统管理（管理员、角色、权限树、审计日志）

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：`ade9368`（主体）和本报告所在的提交（评审前自查后的修正、补测试、问题文件、报告）。本模块 13 个测试文件共 246 个测试全部通过；加上语言文件检查、文字扫描、菜单和路由检查、`mock/auth.mock.test.ts` 一次跑 43 个文件 889 个全部通过。`npx tsc --noEmit` 整个项目 0 个错误，`npx biome check` 本模块路径没有诊断。没有 `hardcodedText.allow.json`（文字扫描没有需要放行的条目）。仓库里我的文件没有隐藏字符或双向控制字符（逐文件按字符类别查过）。

## 做了什么

四个页面，路由取规格 5.0 的"系统管理"四行（应用版本、渠道包是任务 29 的），菜单文字两种语言都有：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/system/admins` 管理员 | `ADMIN:MANAGE`（这一页每个接口都要它，每个按钮都按它显示） | 列：用户名（自己的行带"我"标记）、超级管理员、状态、必须改密码、角色、最近登录、创建时间；新建、编辑（角色多选、超级管理员开关）、启用/停用（停用先问）、重置密码、重置二次验证（先问）、删除（先问）；页面顶部写明各项保护 |
| `/system/roles` 角色 | `ROLE:MANAGE` | 列：名称、备注、权限码数量、创建时间；新建、编辑（名称、备注、可勾选的权限树）、删除（先问；被管理员占用时显示 `ROLE_IN_USE` 的译文） |
| `/system/permissions` 权限树 | `PERMISSION:MANAGE`（读取 `ROLE:MANAGE` 或 `PERMISSION:MANAGE`） | 树形表格：名称（按界面语言，缺则另一种语言，再缺则码）、权限码、类型、排序、来源；新增节点、编辑、删除自定义节点（先问；有子节点显示 `PERMISSION_HAS_CHILDREN` 的译文）；顶部写明自定义节点对现有接口没有效力（中文是规格原句） |
| `/system/audit` 审计日志 | `AUDIT:VIEW` | 只读；筛选管理员、动作、对象类型、对象 ID、UTC 日范围；列管理员（写入当时的用户名）、动作、对象类型、对象 ID、详情、时间 |

**共用件 `PermissionTreeSelect`**（`{ nodes, value, onChange, disabled? }`，在 `src/pages/system/`）：值是完整的、升序的码列表。规则在纯函数 `permissionTree.ts` 里：勾选一个节点同时勾选它和它下面所有可选的后代，然后往上走，某个祖先下面的可选后代都已勾选就也勾上它；取消勾选一个已勾选的节点，去掉它、它的全部后代和它的全部祖先（祖先显示为半选，码不在值里）；一个节点显示"已勾选"当且仅当它的码在值里（所以只持有页面码、没有下面功能码的角色，显示页面已勾、功能未勾，不会被"传导"成全选）；半选 = 不在值里但有后代在值里。能被勾选的码：权限码清单（`permissionCodes.ts`）里的码，和自定义节点（契约 §17.3 允许分配给角色）；标成内置但清单里没有的节点不可选，并从值里去掉。节点名按界面语言取 `nameZh`/`nameEn`，缺一种用另一种，都缺（或只有空白、不是文字）用码。数据不是树（父节点不在列表里、成环、自己在自己下面、码重复）时不会死循环：成环的节点都当根显示。

**管理员页的保护**（每一条在页面和请求层各有一道）：
- 自己的行（用 `me.id` 比，缺 id 时按用户名不分大小写比，两样都没有时当作每一行都是自己的）：停用和删除按钮禁用；编辑对话框里角色选择和超级管理员开关禁用、保存禁用、写明原因；`updateAdmin` 在请求层对自己的行**不发** `roleIds` 和 `superAdmin`，不管表单里有什么（测试让对话框以为不是自己的行，请求体是 `{}`）。
- 最后一个启用的超级管理员：页面读全部管理员（每次 200 条，读完所有页），只有它一个启用的超级管理员时，它的停用、删除按钮禁用，开关不可清除；写操作后重新读。读不到全部管理员时不替后端猜，按钮不禁用，后端拒绝的话显示译文。
- 超级管理员开关只对超级管理员可用；非超级管理员创建时一律发 `superAdmin:false`，编辑时请求体不带它。
- 后端的 403/409 只显示错误码的译文，后面加一句固定的说明（对自己的账号和最后一个启用的超级管理员，后端会拒绝；什么都没有改变），从不显示后端的 `message`（契约没有给这些拒绝专用的错误码，见问题文件）。
- 用户名创建时填，之后只读（去首尾空白后发送）。
- 角色选项来自 `GET /roles?page=1&pageSize=200`（还有就读下一页）。读到 403 时选择器禁用，写明缺 `ROLE:MANAGE`（译名加码）；读失败时写明原因并给"重新读取"；两种情况都不发 `roleIds`（发空数组会拿走全部角色），并把管理员现有的角色以文字列出。
- 密码：创建、重置都是两次输入、`type=password`、`autocomplete=new-password`；规则取 `me.passwordMinLength`（码点数）、不得与用户名相同、两次一致；原样发送，不去空白、不哈希；对话框只在打开时挂载，关闭后表单连同密码一起卸载；请求的地址、页面、`localStorage`、`sessionStorage` 里都没有密码（测试逐项查）；响应里即使带了 `password`、`temporaryPassword`、`initialPassword` 也不读不显示。契约里没有任何接口返回密码，所以没有"显示一次"的对话框。
- 重置密码的对话框写明后果（对方下次登录必须改密码，现有会话立即结束，密码这里和别处都不再显示），按钮是危险色；重置二次验证和删除先问，写明后果。
- `DUPLICATE_RESOURCE` 的 `data.field` 指到同名的表单项（用户名、角色名、权限码），字段明细（`INVALID_REQUEST` 的 `details`）放在对应字段下，没有译文的原因码显示"输入内容不合法"，不显示后端的话。

**审计日志**：`adminUsername` 是写入当时的用户名，直接显示；它是 `null` 时显示管理员 ID 的前 8 位；管理员以后改名、被删，已写的行不变（假后端的测试守着）。详情不管什么类型都走 `plainText`（对象、数组写成 JSON，数字、布尔写成文字，空值是"—"），5000 字符无空格串、阿拉伯语、泰语、emoji 都在单元格里折行，不撑破表格。详情里键名带 password、secret、token、credential、authorization、apikey、cookie、signature、totp 的值，以及文字里"password=…""token: …"这样的写法，显示成 `********`（见变更候选第 2 条）；页面不把任何行写进日志（测试监视 `console`）。整个页面和服务里没有任何会改或删审计行的函数或控件。

## 文件

- 服务：`src/services/system/{index,self,types,system.test}.ts`（15 个测试）
- 假后端：`mock/system.mock.ts`（管理员、角色、权限树的写、审计日志）、`mock/_core/systemData.ts`（状态挂在 `globalThis`，`resetSystemStore()` 重置，管理员仍放在登录用的 `store` 里，建出来的管理员能登录，权限是它的角色的并集）、`mock/system.mock.test.ts`（36 个）；**改了** `mock/system.permissions.mock.ts`（任务 5 建的，只把读取改成读我的状态，键和测试没变，见"需要改共享文件"）
- 路由：`config/routes/system.ts`、`config/routes/system.test.ts`（5 个）
- 文字：`src/locales/{zh-CN,en-US}/system.ts`（两边键相同，检查通过）
- 页面 `src/pages/system/`：`admins`、`roles`、`permissions`、`audit`；对话框 `AdminFormModal`、`ResetPasswordModal`、`RoleModal`、`PermissionNodeModal`；`PermissionTreeSelect`；`AuditAdminFilter`；`PagedTable`；纯函数 `permissionTree`、`permissionRules`、`adminRules`、`auditDetail`、`texts`、`formFailure`；`useRead`；测试：`permissionTree`（23，含对照参考实现的随机测试）、`PermissionTreeSelect`（13）、`adminRules`（9）、`permissionRules`（5）、`auditDetail`（8）、`useRead`（4）、`admins`（53）、`roles`（25）、`permissions`（29）、`audit`（21）
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-system.md`

## 红到绿

先写测试，再实现，红的原因是"模块不存在"（不是拼写或配置）。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`），输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task31/`：

| 文件 | 红（文件） | 红 | 绿 |
|---|---|---|---|
| `src/services/system/system.test.ts` | `red-service.txt` | `Failed to resolve import "./index"` | 15 |
| `mock/system.mock.test.ts` | `red-mock.txt` | 假后端文件移走后 `Failed to resolve import` | 36 |
| `config/routes/system.test.ts` | `red-routes.txt` | 路由数组为空，4 个断言失败（`expected [] to deeply equal …`） | 5 |
| `permissionTree.test.ts` | `red-tree.txt` | `Failed to resolve import "./permissionTree"` | 23 |
| `PermissionTreeSelect.test.tsx` | `red-treeselect.txt` | `Failed to resolve import "./PermissionTreeSelect"` | 13 |
| `adminRules.test.ts`、`permissionRules.test.ts`、`auditDetail.test.ts` | `red-adminrules.txt`、`red-permissionrules.txt`、`red-auditdetail.txt` | 同上 | 9、5、8 |
| `admins.test.tsx`、`roles.test.tsx` | `red-admins.txt`、`red-roles.txt` | `Failed to resolve import "./admins"`、`"./roles"` | 53、25 |

没有留下单独 RED 输出文件的两个页面测试（`permissions.test.tsx`、`audit.test.tsx`）和 `useRead.test.tsx` 也是先写测试：权限树页和审计页的测试先于页面写好，页面写好后第一次运行的失败都是测试里的字符串或选择器问题（见下），不是功能缺失之外的原因。（诚实地说：这三个我没有把实现移走再跑一遍留证据。）

写测试和实现时测试自己找到的问题：
- 真实浏览器之前，单元测试就发现 antd 的主按钮在 `loading` 状态下可访问名称变成"loading Save"（happy-dom 里动画不结束），测试里按钮用 `/Save$/` 匹配。
- 本版本的 ProTable 搜索表单里自定义控件要写 `formItemRender`，不是 `renderFormItem`（用 `renderFormItem` 时被静默忽略，管理员筛选变成普通文本框）；测试发现后改正，注释里没有写，因为是库的版本问题。
- 下拉列表默认虚拟滚动，只渲染十来个选项，"选项里没有自己和后代"的测试无法扫描；父节点下拉关掉虚拟滚动（节点不到 200 个）。
- 测试里 ProTable 的"查询/展开"按钮是中文（测试没有 antd 的语言设置），按钮用中英文都匹配的正则。

## 真实浏览器检查

Playwright（Chromium，浏览器时区 `Pacific/Auckland`）对着 `PORT=8331` 的 `npm run dev:mock`，在 `scratchpad/task31/app`（仓库拷贝，`config/config.ts` 里关了 MFSU、换了缓存目录，`node_modules` 是链接，`src/.umi` 一起复制）里跑。脚本 `browser/t31-browser.cjs`、日志 `browser/t31-browser.log`、截图 `browser/t31-*.png`。服务按监听进程的 PID 停掉（第一次 18454、第二次 26766，都核对了它的工作目录是我的拷贝），端口 8331 已空。看到的：

- 菜单：系统管理下六项（管理员、角色、权限树、应用版本、渠道包、审计日志），顺序对。四个页面都没有页面级横向滚动，390 像素宽也没有。
- 管理员：表头和规格一致；自己的行"停用"禁用、"删除"（在"更多"里）`aria-disabled`、编辑对话框里角色和开关禁用、保存禁用；新建（泰语名字加数字后缀、两个角色）的请求体是 `{"username":…,"password":…,"roleIds":["1","2"],"superAdmin":false}`，创建后页面和 `localStorage`/`sessionStorage` 里都没有密码；重复用户名（`SUPPORT`）错误出现在用户名字段下；停用前的问题、停用、启用的请求；重置二次验证的问题和请求；重置密码对话框、请求体 `{"newPassword":…}`、之后页面里没有密码；删除。
- 角色：勾选"查看用户"得到"5 codes chosen"，取消"封禁"后父节点是半选、保存的请求只有三个子码（父码不在里面）；删除仍被占用的角色显示 `ROLE_IN_USE` 的译文，行还在。
- 权限树：79 行内置节点；顶部的说明；新建三层自定义节点（A、B 在 A 下、C 在 B 下）；编辑 A 时父节点选项里没有 A、B、C 自己；删除 A 显示 `PERMISSION_HAS_CHILDREN` 的译文；删除 C 的请求地址是 `/api/admin/permissions/CUSTOM%3AC…`；内置行没有"删除"；编辑内置节点时码和父节点禁用。
- 审计：六列；详情里的假凭据（`facebookAccessToken`、`password`）显示成 `********`，页面 HTML 里找不到 `EAAB-secret` 和 `hunter2`；按动作筛选的请求参数对；展开后五个筛选都在。
- zh-CN：四个页面的表头都是中文。
- 控制台：只有登录第一步的 401 和我故意触发的三个 409（`ROLE_IN_USE`、`PERMISSION_HAS_CHILDREN`、重复用户名）。第一次浏览器检查还看到 antd 的 `maskClosable` 已弃用警告，已改成 `mask={{ closable: false }}`；还发现管理员页和角色页多出一块空的搜索表单（共用表格组件没有关闭搜索表单的选项），已换成本地的 `PagedTable`（见记录项 1）。
- 看了截图：管理员页、自己的编辑对话框、新建对话框（角色下拉在泰语、中文、阿拉伯语名字下正常）、角色对话框（树、半选）、整棵权限树、审计页、390 宽的管理员页。

## 变异检查

脚本 `t31-mutate.py`（在拷贝里改一处判断，只跑守这条判断的测试文件，`--bail 1`，再还原），列表 `muts.json`、`muts-r2.json`，输出 `mut-out-*.jsonl`、`mut-out-r2.jsonl`。第一轮 117 个：95 个变红，21 个存活，1 个因代码被格式化成多行没有改成功。处理：

- **加测试后变红（11 个）：** 自己的行停用和删除只靠"最后一个超级管理员"而不是靠"自己"（前两轮测试里自己的行恰好也是最后一个）：新测试用两个超级管理员；自己的行开关禁用不靠"最后一个"；对话框被告知是最后一个时开关禁用并写明；写操作后不重读全部管理员；用户名两端的空白（含全角空格）不去掉；字段明细的原因码没有译文时显示后端的话；角色里不在树里的码在没碰树时仍被发出；权限树对话框里父节点的提交前检查（别人同时把节点移到它下面）；详情的深度上限（旧测试的叶子是凭据键，被遮住，测不出来）；没有 `ADMIN:MANAGE` 时仍去读管理员列表；假后端的成环检查（重跑，替换文字改对了）。
- **删掉冗余代码：** 两个密码对话框提交成功后"把表单里的密码清空"：对话框随即卸载，没有任何可观察的差别，所以删掉，注释说明靠卸载。
- **等价变异，不是缺陷（8 个）：**
  1. `adminRules.ts:isLastEnabledSuper` 去掉行自己 `status === 'ACTIVE'` 的判断：已停用的行不可能是"启用的超级管理员里唯一的一个"，结果不变。
  2. `AdminFormModal.tsx` 的 `rolesChanged` 去掉 `!rolesLocked`、`flagChanged` 去掉 `!flagLocked`：控件禁用时值保持原值，比较结果相同。
  3. `AdminFormModal.tsx` 创建时 `superAdmin: canSetSuper && …` 去掉 `canSetSuper`：非超级管理员的开关禁用，值保持 `false`。
  4. `admins.tsx`、`roles.tsx`、`permissions.tsx` 的 `if (!canManage/canWrite) return []`：没有权限时操作列整列不渲染，这一行从不被调用（"没有权限不画按钮"由列和工具栏的条件、以及三个"没有权限仍有行"的测试守着，分别变异过，变红）。
  5. `useRead.ts` 去掉卸载时的清理：卸载后 React 忽略晚到的状态更新。
- **第一轮变红的重要变异（摘要）：** 请求层自己行的去除、识别自己的三种方式（id、用户名大小写、什么都不知道时当作自己）、内置节点不发 `parent`、路径编码、密码不去空白（创建、重置）、角色每页 200；最后一个超级管理员的计数、读不到全部时的行为；密码规则（同用户名、长度按码点、差一、两次一致）；每个确认（停用、重置二次验证、删除、角色删除）；每个写按钮的权限（新建、行操作，三页）；开关只对超级管理员、最后一个、自己；角色选择器自己、读不到；用户名只读；`roleIds` 读不到时不发；保存在没改动时禁用；403 判断；失败文字加固定说明；重复字段映射；失败不显示后端 `message`（管理员、角色、权限树、删除）；重置的说明；角色树没读到时保存禁用、备注去空白；整套树规则（取消时去祖先、去后代，勾选时加后代，向上补全的三种坏法，半选，自定义可选，任意可选，内置判断两种、名称语言、回退、空白名、成环数据、候选父节点、自己、后代、排序、点不可选的节点）；权限树页的删除内置、新建按钮、展开、删除失败文字、对话框里父节点、码、类型的禁用、选项范围；权限规则的内置父节点、成环、"只在父节点变了才发"、码的空白字符、码重复；审计的遮蔽（键名、文字、JSON 字符串）、`plainText`、范围转换、去空白、管理员名回退、折行；`useRead` 的旧答案；假后端的自己、状态、删除、最后一个、超级管理员、角色在用、有子节点、内置删除、内置父节点、重复用户名、读角色的权限、读权限树的权限。

## 覆盖的语言

界面只有 zh-CN 和 en-US，两边键相同（检查通过）。四个页面各有中文界面的测试（表头、规格原句、操作按钮），其余界面测试用英文。假数据和测试覆盖泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：角色名、管理员用户名、权限节点名、审计的管理员名和详情；另有 5000 字符无空格串（管理员名、角色名、节点名、详情）、300 个泰文字符、emoji（含 ZWJ 序列，源码里用 `String.fromCodePoint` 构造）、类型不对的值（对象当管理员名、数字当对象类型、布尔和列表当详情）。只覆盖中文的检查：无。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-system.md`：管理员（自己、最后一个超级管理员的专用错误码；`PUT` 的请求体和缺省字段的含义；响应形状与"后端从不返回密码"的确认；用户名和密码的规则与 `ref`；`data.field`；任务书与契约在谁能读 `GET /roles` 上的不一致；`passwordMinLength` 实际在 `me` 里）；角色（整体替换、空数组、自定义节点的码）；权限树（请求体、码和名称和排序的限制、成环、改内置节点的父节点、删除内置节点、响应字段、`type` 不可改）；审计日志（`from`/`to` 的格式、过滤是精确匹配、`detail` 的类型与"不含凭据"的确认、`adminUsername` 为 `null`、给只有 `AUDIT:VIEW` 的管理员一个管理员名单）。没有一条是阻塞。

## 需要改共享文件的地方

1. `src/components/PagedListTable.tsx`：加 `search` 选项（`false` 时不画搜索表单）和能把 `defaultCollapsed` 设成 `false`。现在没有可筛选的列时它仍画一块空的搜索卡片（`查询/重置` 两个按钮，没有字段），所以我在 `src/pages/system/PagedTable.tsx` 里写了一个没有搜索表单的本地版本（管理员页和角色页用）。有了选项后可以删掉它。
2. `mock/system.permissions.mock.ts`（任务 5 的文件）：我把读取从"每次现算内置节点"改成"读 `systemState.nodes`"（才能看到页面新增和删除的自定义节点）。它的导出键和 `mock/auth.mock.test.ts` 里的断言不变；如果不接受，回退这一处，影响是权限树页新建的节点刷新后看不到。

## 规格需要在 main 上修改的地方

1. 5.16 管理员：写明"不能停用自己、最后一个启用的超级管理员不能被停用、删除、清除标志、不能修改自己的角色和 `superAdmin`"被拒绝时的错误码（契约错误码表里没有）；写明页面按它们显示译文。
2. 5.16 管理员："初始密码（规则同 3.3）"的最小长度来自 `GET /me` 的 `passwordMinLength`，不是 `GET /meta`。
3. 任务书 31 写"`GET /roles` 要 `ROLE:MANAGE`"，契约 §17.4 附·通则第 5 条写另允许 `ADMIN:MANAGE`；以后者为准，任务书应改。
4. 5.16 角色："勾选父节点同时勾选全部子节点，保存的是完整的码列表"之外，建议写明取消一个后代时父节点的码也从列表里去掉（这是现在的做法，也是任务书要求的），并说明后果：通过这个树不能给角色"页面码加上一部分功能码"以外的组合——见变更候选第 1 条。
5. 5.16 审计日志：写明 `from`/`to` 的格式、`detail` 的类型，以及 `adminId`、`action`、`targetType`、`targetId` 是精确匹配。

## 记录项（6，建议全部修）

1. `src/pages/system/PagedTable.tsx` 是共用表格的本地版本（见"需要改共享文件"第 1 条）。触发：共用 `PagedListTable` 加了选项后，这个文件和它的 `reloadRef` 用法就是重复的。
2. 本模块有一批共用事情的本地副本：`src/pages/system/testSetup.ts` 里的 `overrideFetch`、`holdWrites`、`jsonAnswer`、`settled`（来自短信模块的同名文件），`src/pages/system/formFailure.ts`（短信、邮件模块的同名文件，加了重复字段的映射），`src/pages/system/useRead.ts`（用户模块有同类）。触发：共用的失败文字、读取、测试辅助以后改了，副本不会跟着变。
3. `src/pages/system/audit.tsx`：审计页的筛选表单一开始折叠（`PagedListTable` 的 `defaultCollapsed` 只能是 `true`），只看得到"管理员"和"动作"，对象类型、对象 ID、时间范围要点"展开"。触发：打开审计页。结果：功能都在，但五个筛选里三个默认看不到。
4. `src/pages/system/adminRules.ts:isLastEnabledSuper`：读不到全部管理员（第二次读取失败，或者管理员多于 50 页）时不禁用最后一个超级管理员的按钮，后端拒绝后显示译文。触发：页面读 `GET /admins` 全部页失败而当前页成功。结果：按钮可点，点了得到后端的拒绝文字，不会改变任何东西。
5. `src/pages/system/AdminFormModal.tsx`：`system.admins.superLast`（"这是最后一个启用的超级管理员，不能清除标志"）在正常使用里碰不到——能打开另一个超级管理员的编辑框的人自己就是启用的超级管理员，所以那个超级管理员不可能是最后一个；它只在页面读到的列表过期时出现。测试用直接渲染对话框的办法守着。没有错误结果。
6. 测试输出里偶尔有 React 的 `act(...)` 警告（本模块一次运行 152 条：多数来自 antd 的动画和表单项 `CSSMotion`、`ItemHolder`、`Field`，少数是我的页面在测试结束前后才到的读取结果，`PagedTable`、`AdminsPage`、`PermissionsPage`；没有定位到某个具体测试）。触发：全模块测试输出。结果：测试都通过，只是噪音。

## 变更候选（需要负责人确认，我没有擅自扩大）

1. **勾选树的规则带来的后果（任务书要求的做法）：** 取消一个功能节点会把它的页面节点的码也去掉（父节点变半选，不在值里）。一个持有"查看用户"和"封禁用户"的角色，在树里取消"封禁用户"后，"查看用户"也不在角色里了，管理员得再勾回"查看用户"（这会把它下面的全部功能都勾上）。所以通过这个树无法做出"页面码加一部分功能码"的角色，只能是"页面码单独"（直接勾页面，再取消不要的功能是不行的：取消功能会去掉页面）或"一部分功能码，没有页面码"。如果运营需要后者，规则要改成"取消后代不去掉祖先"；契约 §17.3 写的是"勾选父节点同时勾选全部子节点，保存的是完整的码列表"，没有写取消时父节点的处理。
2. **审计详情里把凭据样的值显示成 `********`：** 任务书写"显示后端给的，但不出现凭据样的值"。我选了遮蔽键名带 password、secret、token 等的值（含文字里"password=…"）。代价：键名里恰好含这些词的正常数据（例如 `tokenVersion`）也被遮住。如果要原样显示，去掉 `auditDetail.ts` 里的 `maskDetail`，把 `detailText` 改成只调 `plainText`。
3. **自定义节点可以勾给角色：** 任务书写"只有真实权限码清单里的码可以被勾选"，契约 §17.3 和规格 5.16 写自定义节点可以分配给角色。我两条都照顾：清单里的码和自定义节点可选，标成内置但清单里没有的节点不可选。
4. **自己的行编辑框仍能打开**（控件禁用、写明原因、保存禁用），而不是把"编辑"按钮禁掉；任务书写的是"对自己的行这两项禁用"。
5. **重置自己的密码、重置自己的二次验证没有禁用**（规格和契约没有禁止；重置后自己的令牌立即失效）。
6. **审计日志的"管理员"筛选**：有 `ADMIN:MANAGE` 时是按名字选的下拉（值是管理员 ID），否则是输入管理员 ID 的文本框（只有 `AUDIT:VIEW` 的管理员读不到管理员列表）。
7. 新建权限节点的排序默认 0（排在最前面）。

## 未运行（4）

- 全量测试和 `npm run build`：按约定留到全部任务做完后跑一次；这里跑了本模块的测试、语言文件和文字扫描、菜单和路由检查、整个项目的 `tsc` 和本模块的 `biome`。
- 真实浏览器里只用 `root` 登录：没有用只有 `ADMIN:MANAGE` 或只有 `ROLE:MANAGE` 的管理员登录点一遍（这些权限组合在页面测试里测过，浏览器里没有）；也没有在浏览器里点审计的时间范围选择和"管理员"下拉。
- 非 Chromium 浏览器（Firefox、Safari）：对话框、下拉、树。
- 对着真后端：请求体、错误码、`PUT` 的语义、`GET /permissions` 的响应形状、审计的参数和 `detail` 的类型，都是按假后端和契约做的（见问题文件）。

## 开发服务器

我起的端口 8331 的服务按监听进程的 PID 停掉（18454、26766），停止后端口无监听；没有被拒绝。
