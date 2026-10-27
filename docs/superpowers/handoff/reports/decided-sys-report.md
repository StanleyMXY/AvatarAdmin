立即修未修 0、记录项 4、未运行 3、阻塞 0

# 已定变更项报告：区域 sys（系统管理与登录）

分支 `claude/jolly-dirac-4pq9g6`，Node 24.22.1。提交：`13dddb6`（主体）和本报告所在的提交（审计详情的长文本线性化加测试、问题文件一句话更新、本报告）。依据：`docs/superpowers/handoff/decisions-2026-10-27.md`。没有改任何共享文件（`src/components/*` 等）；没有推送。

## 四个数字怎么来的

- **立即修未修 0**：做的过程中自己发现并当场修了一条（见"自检发现"第 1 条：审计详情的地址遮蔽在长文本上是平方级，200000 字符花 27 秒），修了并加了测试。
- **记录项 4**：见"记录项"一节，每条有文件行号和触发步骤。
- **未运行 3**：全量测试（按规矩留到全部任务做完后跑一次）；构建（同上）；中文界面下的真实浏览器检查（只在英文界面里点过，中文只有单元测试覆盖）。另外 `npx tsc --noEmit` 整个项目现在有别的区域的报错（`src/pages/dashboard/*`、`src/utils/settledDay.test.ts` 等，别的代理正在改），我只看了自己路径，0 个。
- **阻塞 0**。

## 逐条做了什么

### 事项 1：超级管理员行对非超级管理员关闭；自己那一行禁用重置密码和重置二次验证

- 新规则 `isClosedTo(row, me)`：`src/pages/system/adminRules.ts`（"这一行是超级管理员，且当前人不是超级管理员"。当前人是不是超级管理员不明（没有 `me`、值不是布尔 `true`）时按"不是"处理，行保持关闭）。
- `src/pages/system/admins.tsx` 的 `actionsOf`：被关闭的行只剩"编辑"（行已停用时再加"启用"）；重置密码、重置二次验证、停用、删除不渲染。其他行五个操作照旧。
- 自己那一行：重置密码、重置二次验证禁用，鼠标放上去显示原因（"不能在这里重置自己的密码。要改自己的密码，请用账户菜单里的“修改密码”。" / "不能重置自己的二次验证，请让另一位管理员来做。"）；中英文都加了（`system.admins.ownResetPasswordReason`、`system.admins.ownResetTotpReason`）。
- 原因的显示方式：禁用的按钮自己收不到鼠标事件，所以标签是 `<Tooltip><span style="pointer-events:auto">…</span></Tooltip>`（`admins.tsx` 里的 `withReason`）。共用的 `RowActions` 没有"禁用原因"这个参数，我没有改它（共享文件），在本地做了一个版本，见"需要改共享文件"。
- 问题文件 `docs/contract-requests/2026-10-21-admin-frontend.md` 第 278 行那条"暂定"改成了已定的做法；问题本身保留，后端仍是最终裁决。
- 测试：`src/pages/system/adminRules.test.ts:53`（`isClosedTo` 的 4 个测试）；`src/pages/system/admins.test.tsx:295`（"超级管理员行对非超级管理员关闭"6 个：四个操作都不画、更多菜单里也没有、普通行五个操作照旧、不发任何写请求、超级管理员对另一个超级管理员全开、`/me` 没说是不是超级管理员时仍关闭）；`admins.test.tsx:373`（"自己不能重置自己的密码和二次验证"5 个：禁用、原因文字、点了不开对话框不发请求、非超级管理员按用户名认出自己、中文原因）。

### 事项 1 的角色页四条之一：自己那一行的"编辑"直接禁用并给原因

- `admins.tsx` 的 `edit` 动作：自己那一行 `disabled`，原因用已有的 `system.admins.ownNote`（"这是你自己的账号：不能修改自己的角色和超级管理员标志。"）。编辑对话框里对自己的锁定保留（防第二层）。
- 测试：`admins.test.tsx:963`（自己的行"编辑"禁用、点了不开对话框、悬停出原因、不发请求）、`:976`（对话框被直接打开时仍锁角色和开关并写明原因）、`:1015`（`/me` 没有 id 时按用户名认出自己，"编辑"同样禁用）。原来三个通过点"编辑"打开自己那行对话框的测试改成了这三种写法。
- 因为超级管理员行现在对非超级管理员关闭，"最后一个启用的超级管理员"这条页面保护对"不是自己的行"已经到不了（能看到别人的超级管理员行的只有超级管理员，那时至少有两个启用的超级管理员）；仍有用的是自己那行和列表过期时。原来五个以非超级管理员身份点 root 行停用/删除的测试改成了新语义（见 `admins.test.tsx:196` 起）。

### 事项 2：权限树取消规则

- `src/pages/system/permissionTree.ts` 的 `toggleCode`：取消一个已勾选的节点，只去掉它自己和它的全部后代；祖先的码保留。取消祖先本身时，祖先和它的全部后代一起去掉。勾选的规则不变（勾选节点勾它和全部可选后代，再往上补全"后代全勾"的祖先）。
- 编辑已有的"页面码加一部分功能码"角色：碰一下某个功能，页面码不会被拿走（`roles.test.tsx:369` 用假数据里的"Soporte al cliente"：取消"封禁"后保存，请求里有 `USER:VIEW`、没有 `USER:BAN`）。
- 测试：`permissionTree.test.ts:220`（取消一个后代，父节点保留）、`:229`（页面加一个功能，取消该功能后页面码在）、`:236`（深层节点取消后上面全部保留）、`:245`（从空开始点击能到达"只有页面"和"页面加任意部分功能"，用广度优先搜索）、`:284`（取消父节点去掉父和全部后代、不动别的）；随机树对照实现（400 棵树乘 12 次点击）的参考实现和性质检查按新规则改写；`PermissionTreeSelect.test.tsx:83、:95`、`roles.test.tsx:201、:369`。
- 我对规则的理解：决定写"祖先只在它的所有后代都未选、且用户自己取消祖先时才去掉"，我实现为"用户取消祖先本身时，祖先连同全部后代去掉"（标准的级联取消）；用户取消后代，祖先一律保留。

### 角色页四条

1. **自己那行编辑禁用**：见上。
2. **自定义节点不能勾给角色**：`permissionTree.ts` 的 `isSelectable` 改成"只有真实权限码清单里的码"（自定义节点和清单外的内置节点不可选；后者原来就不可选，没有动）。勾选父节点不会带上自定义后代；角色里已有的自定义节点码，编辑时显示在警告里并在保存时去掉（警告文字改成"…不能分配给角色（自定义节点和应用不认识的码），保存时会被去掉：{codes}"）。三处提示文字中英文都改了（角色页、权限树页顶部、警告）。测试：`permissionTree.test.ts:140、:206`，`PermissionTreeSelect.test.tsx:157、:166`，`roles.test.tsx:221、:247、:422`，`permissions.test.tsx` 顶部文字两条。
3. **新建节点排序默认放同级末尾**：`permissionRules.ts` 的 `nextSortOrder(nodes, parent)`（同一个父节点下最后一个的排序加 1，没有同级时为 1；按树画出来的同级算，孤儿算根；非数字忽略；不超过安全整数）；`PermissionNodeModal.tsx`：新建时排序初值是根的末尾，选了父节点后跟着变，用户自己改过排序之后不再跟着变。测试：`permissionRules.test.ts:90`（5 个）、`permissions.test.tsx:414、:429、:437、:453`（页面：根末尾、选了 `USER:VIEW` 变 6、无子节点的父节点下为 1、不动手时发出的就是默认值且排在最后、手填的值不被覆盖）。
4. **审计的"管理员"筛选无权限一律隐藏**：`audit.tsx` 把这一列在没有 `ADMIN:MANAGE` 时设为 `search: false`；`AuditAdminFilter.tsx` 没有权限时返回空（以前是一个"管理员 ID"输入框）。有 `ADMIN:MANAGE` 但读不到管理员列表时仍给输入框（那不是无权限）。测试：`audit.test.tsx:293`（没有权限：下拉和输入框都没有，搜索表单里没有"Administrator"，请求没有 `adminId`）、`:307`（单独渲染筛选组件也什么都不画、不请求管理员列表）、`:318`（有权限但列表读失败时保留输入框）。

### 权限隐私：审计详情遮蔽

- `src/pages/system/auditDetail.ts` 重写：只遮字符串值；键名匹配敏感词时（任意深度、数组里），其下的字符串遮成 `********`；数字、布尔、空值照原样（`tokenVersion: 3`、`mustChangePassword: true`、`{old:3,new:4}` 都保留）。
- 键名敏感词：password、passwd、passcode、passphrase、secret、token、credential、authorization、apikey、privatekey、cookie、signature、totp；整词 pwd、otp、pass、pin；"code"只在带验证类词时算（verification/verify/sms/email/phone/mfa/auth/captcha/security/confirm/reset/recovery/backup/login/activation，且没有 country/area/error/status 等排除词），所以权限码 `code: "USER:VIEW"`、`permissionCodes`、`errorCode`、`countryCode` 不遮。多语言键名：俄语、泰语、阿拉伯语、西班牙语（含无波浪线）、印尼语、越南语、简繁中文（匹配前去掉重音和组合符号）。
- 补漏网：`{key:'sms.api_secret', old, new}` 这类"设置名是凭据时，同级的 old/new/value/from/to/before/after 一并遮"；`{"sms.api_secret":{old,new}}` 这类以凭据为键的变更表整体遮；自由文本里：`Authorization: Bearer …`（连同 Bearer 一起遮）、`Basic`、`password is …`、被截断或带引号的 JSON、`body={"password":…}`、`https://用户:密码@主机`、带空格的引号值、`cookie: sid=…; …`、`otp:`、`verification code:`、`pin`、`pwd=`、泰语/俄语/中文关键词（含全角冒号）。自由文本里不遮：值是 true/false/null；键以 version/count/length/ttl 等结尾且值是纯数字（`tokenVersion: 4`）。
- 注释和函数说明改成"尽力遮蔽，后端另有责任"（原来的措辞说"凭据类值显示成 ********"）。
- 33 种形状：`auditDetail.test.ts:245` 起的 34 个表驱动例子（8 个结构化、26 个文本，含 4 个"不该遮"的反例），加上 `:90`（只遮字符串）、`:133`（old/new）、`:174`（多语言键名 9 种 + 反例）、`:199`（验证码和权限码）、"长文本线性"（200000 字符的几种形状，防止查找变成平方级）。
- 保留"要求后端保证不返回凭据"的问题文件条目，没有改。

### 全局：强制改密码页加"退出登录"入口

- `src/pages/user/change-password/index.tsx`：表单下面一个链接式按钮，文字用已有的 `pages.header.logout`（"退出登录"/"Sign out"，不用新键），点击调 `useSession().signOut`（清令牌、清已记住的标签页、清会话里的账号、回登录页；不发请求）。
- 测试：`src/pages/user/change-password/changePassword.test.tsx:74`（令牌和标签页被清、跳登录页、不发任何请求）、`:87`（账号被清，页面不再显示表单）、`:96`（中文）。

## RED 到 GREEN

RED 日志在会话的临时目录（`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/sys/red-*.txt`，不进仓库）；下面是摘要。命令都带 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`。

| 命令 | RED（功能还不存在时） | GREEN |
|---|---|---|
| `npx vitest run src/pages/system/permissionTree.test.ts` | 9 个失败、18 个通过（取消保留祖先、自定义节点不可选、可达性等） | 27 通过 |
| `npx vitest run src/pages/system/permissionRules.test.ts src/pages/system/PermissionTreeSelect.test.tsx` | 5 个失败（`nextSortOrder` 还没有）；树的规则当时已改，所以选择器测试已绿 | 26 通过 |
| `npx vitest run src/pages/system/roles.test.tsx src/pages/system/permissions.test.tsx` | 7 个失败（两处提示文字、新建节点排序 3 个、自定义节点不可勾、警告文字）；树的规则当时已改，所以"取消后代保留父"那几个已绿 | 全绿（见最后一行） |
| `npx vitest run src/pages/system/auditDetail.test.ts` | 39 个失败、25 通过 | 64 通过 |
| `npx vitest run src/pages/system/admins.test.tsx` | 11 个失败、54 通过（关闭行 3、自己的重置 5、自己的编辑 3） | 全绿 |
| 把 `audit.tsx`、`AuditAdminFilter.tsx`、`change-password/index.tsx` 临时换回改动前的版本，跑 `npx vitest run src/pages/system/audit.test.tsx src/pages/user/change-password` | 5 个失败（退出登录 3、审计筛选隐藏 2），"有权限但列表读失败时保留输入框"在旧版里本来就通过 | 全绿 |

这三个文件的 RED 是事后用旧版本换回去取得的（先写了测试和实现再取的证据），不是先于实现跑出来的；其余行是先于实现跑的。

最终运行：`npx vitest run src/pages/system src/services/system src/pages/user src/locales tests/noHardcodedText mock/system`，结果 1023 通过、1 个失败（`src/pages/users/detailTabs.test.tsx` 的"登录事件"测试，不是我的区域：`src/pages/user` 这个路径前缀顺带匹配到了 `src/pages/users`，那个目录里没有我的改动也没有未提交的改动，我没有去查它为什么失败）。其中包含 `src/locales/parity.test.ts`（中英文键相同、占位符相同）和 `tests/noHardcodedText.test.ts`（禁止写死文字扫描）：都通过。
`npx biome check src/pages/system src/pages/user src/locales/en-US/system.ts src/locales/zh-CN/system.ts`：无诊断。`npx tsc --noEmit`：我的路径 0 个。

## 变异检查（"把规则删掉，测试必须失败"）

写了一个脚本（在临时目录，不进仓库）：每次把源文件里的一处精确替换掉，跑相关测试，再还原源文件；46 个变异，**46 个全部被测试抓住（变红），0 个存活**；跑完 `git status` 确认源文件已还原。

| 规则 | 变异（共 46） | 结果 |
|---|---|---|
| 取消保留祖先 | 取消时又去掉祖先；取消时不去掉后代；`isSelectable` 恒为真；`isSelectable` 改成"清单内或 builtin 为 false" | 4 个全红 |
| 超级管理员行关闭 | `isClosedTo` 恒为假；当前人不明时算不关闭；普通行也关闭；超级管理员看也关闭；页面里 `closed` 恒为假；页面里对所有超级管理员行关闭；关闭的行仍留删除/停用/重置密码/重置二次验证（4 个） | 10 个全红 |
| 自己的行 | 重置密码不禁用；重置二次验证不禁用；编辑不禁用；禁用原因不显示 | 4 个全红 |
| 审计遮蔽 | 数字/布尔也遮；不继承（凭据键下的字符串）；去掉同级设置名规则；去掉地址里的密码；去掉 Bearer 等前缀；引号必须闭合；去掉 true/false 豁免；去掉"计数类键的数字"豁免；去掉泰语键；验证码的上下文词去掉；验证码排除词去掉；验证码规则关闭；去掉 `pin`；字符串不再遮；整段文字里的键值对遮蔽关闭；地址前缀不设上限；键后缀不设上限（后两个由"长文本线性"那条抓住） | 17 个全红 |
| 新建节点排序 | 没有同级时给 0；不加 1；所有同级都按根算；对话框初值 0；父节点变了覆盖手填的值；父节点变了不跟着变 | 6 个全红 |
| 审计管理员筛选 | 一直显示该列；组件里去掉权限检查；该列一直隐藏（有权限时也隐藏） | 3 个全红 |
| 退出登录 | 按钮点了没反应 | 红（2 个测试） |
| 角色里的自定义节点码 | 编辑时把自定义节点码当可保留 | 红 |

## 真实浏览器检查

假后端 `PORT=8431 BROWSER=none npm run dev:mock`，Playwright（Chromium）。脚本在临时目录。用 `root` 通过接口新建一个只有 `ADMIN:MANAGE`、`ROLE:MANAGE`、`AUDIT:VIEW` 的角色和账号 `ops`，另一个只有 `AUDIT:VIEW` 的账号 `aud`，各自登录（绑定验证器、强制改密码）。结果（只有英文界面）：

- root 的管理员页：自己那行"编辑"禁用，悬停显示原因（Chromium 里禁用的按钮里的 `span` 确实收到了悬停）；"更多"菜单里重置密码、重置二次验证、删除灰掉，悬停重置密码出现原因文字；点灰掉的项不开对话框。
- `ops`（非超级管理员）：root 那行只有"编辑"（没有停用、更多）；自己那行"编辑、停用、更多"（编辑、停用灰）；reviewer 那行"编辑、停用、更多"。
- 角色页：自定义节点的复选框禁用；勾 `USER:VIEW` 再取消 `USER:BAN`，`USER:VIEW` 仍勾着。
- 权限树页：新建节点，排序初值 901（接口里刚建的自定义节点是 900）。
- 审计页：root 有"Administrator"下拉；`aud`（只有 `AUDIT:VIEW`）的搜索表单只有"动作、对象类型、对象 ID、时间范围"；假数据里带 `password`、`facebookAccessToken` 的行显示 `********`，页面上找不到 `hunter2`、`secret-token`。
- 强制改密码页：有"Sign out"，点了令牌清空、回登录页。
- 控制台：只有登录前的两条 401（登录流程本身的正常应答）；没有别的错误。
- 看了截图：布局正常（"更多"菜单旁的原因提示、改密码页的退出登录链接）。
- 服务已按监听进程的 PID 停掉。

## 覆盖的语言

- 界面文字：中文和英文都有（语言文件键相同，占位符相同，扫描通过）。
- 测试数据：审计遮蔽覆盖英语、俄语、泰语、阿拉伯语、西班牙语、印尼语、越南语、中文的键名和文本（以及 emoji、5000 以上字符的长串）；管理员页和角色页原有的测试里已有七种语言的名字，我没有动。
- 只覆盖中文和英文的检查：真实浏览器检查只在英文界面做；"原因文字"的中文只有单元测试。

## 自检发现（按 CLAUDE.md 分类）

1. **立即修（已修）：审计详情里"地址中的密码"的遮蔽，在长文本上是平方级。** `src/pages/system/auditDetail.ts` 的地址正则 `[a-z0-9+.-]*` 没有上限，对 `'a-'` 重复 100000 次（200000 字符）要 27 秒，浏览器会卡住；审计表的详情是任意长度的文字。我自己加的"长文本线性"测试抓住了它。修：方案名和用户名部分加上限；测试覆盖五种形状（无空格长串、很多分隔符、`token ` 重复、`token-` 重复、`http://u:` 重复、值不结束的 JSON）；变异（去掉两处上限）都被这条测试抓住。
2. 其余见"记录项"和"没做的"。

## 记录项（4）

1. **自己那行和最后一个启用的超级管理员的"停用""删除"按钮禁用了，但没有原因。** `src/pages/system/admins.tsx` 的 `disable`、`remove` 动作（`withReason` 没有套）。触发：用 root 登录，看 root 那行，把鼠标放在灰掉的"停用"上。结果：没有提示，只有表格上方那条总说明。任务只要求编辑、重置密码、重置二次验证写原因，所以没加。
2. **禁用按钮上的原因只在鼠标悬停时出现，键盘和触屏看不到。** `admins.tsx` 的 `withReason`（禁用的按钮取不到焦点，触屏没有悬停）。触发：用键盘（Tab）或手机浏览器看自己那一行的灰按钮。结果：看不到原因。修法要么给共用的 `RowActions` 加"禁用原因"参数并改成可聚焦，要么把原因写在行内；见"需要改共享文件"。
3. **审计详情里键名是凭据词的时间字符串也被遮。** `auditDetail.ts` 的 `maskDetail`。触发：详情是 `{"passwordChangedAt":"2026-10-01"}` 或 `{"totpEnrolledAt":{"old":null,"new":"2026-10-01T00:00:00Z"}}`。结果：显示 `********` 而不是日期（审计的人想看"什么时候改的"）。这是"只遮字符串"这条决定的直接后果；任务 31 评审的选项里有"ISO 时间也不遮"，决定里没有，所以没做。
4. **以数字形式写进审计详情的凭据不遮。** `auditDetail.ts`。触发：详情是 `{"otp":123456}`（数字，不是字符串）。结果：原样显示。这是"布尔、数字不遮"这条决定的直接后果；防线仍是后端不写凭据（问题文件保留）。自由文本里 `otp: 123456` 会遮。

## 没做的和原因

- **"编辑"和"启用"对超级管理员行没有关**（变更候选，没有做）：决定只列了重置密码、重置二次验证、停用、删除。非超级管理员仍能点超级管理员行的"编辑"（改角色，对超级管理员没有实际权限意义，开关本来就禁用）和已停用超级管理员行的"启用"（只是把账号重新启用，不能改密码）。按"低权限管理员不得操作高权限账号"的同一原则，业界通行做法大概也会关；需要你确认再做，工作量很小（`actionsOf` 里 `closed` 分支去掉 `edit` 和 `enable`，并改 4 个测试）。
- **勾选一个功能时不会自动勾上它所在的页面**（变更候选）：决定第 2 条依据里有"能进功能必须能进它所在的页面"，但规则只写了取消。现在从空开始只勾一个功能，页面码不在值里，页面显示半选，保存出来的角色拿到了功能却进不了页面。是否改成"勾功能时同时勾上祖先"，要你确认。
- **未知的内置码**（任务 31 评审记录 6，原来就有的）：后端新发布的内置权限码，前端清单还没有时，编辑角色保存会把它去掉；我没有动（不在这次的清单里）。
- **共用 `PagedTable` 在最后一页删光后显示空**（任务 31 评审记录 2，原来就有的）：没有动。

## 需要改共享文件

- `src/components/RowActions.tsx`：给 `RowAction` 加一个可选的 `disabledReason`，禁用时用悬停并且可聚焦的方式显示（解决记录项 1 和 2）。我在 `admins.tsx` 里用标签里的 `Tooltip` 做了本地版本，没有改共享文件。

## 规格和契约在 AvatarApp main 上需要改的地方（变更请求）

1. **契约 §17.3 和规格 5.16 的"自定义节点能分配给角色"这句话和负责人 2026-10-27 的决定相反。** 要改的名称：权限树里自定义节点的用途。行为：自定义节点只用来给权限分组或为以后的页面预留，**不能分配给角色**（只有内置节点可以）。检查顺序：`PUT /roles/{id}`、`POST /roles` 收到的 `permissionCodes` 里含有自定义节点码时，后端应按"不是内置节点"拒绝（建议 400 `INVALID_REQUEST`，`details` 的 `ref` 为 `permissionCodes`，原因为现有的 `OUT_OF_RANGE` 或新增一个原因码）；前端已经不发。错误：同上。测试：角色保存带自定义节点码返回 400；角色已有的自定义节点码在节点被删除时照旧清理。前端现在对这种情况只是不让勾，并在编辑时警告"保存时会被去掉"。
2. **契约 §17.3 "勾选父节点会同时勾选全部子节点，保存的是完整的码列表"只写了勾选，没写取消**：建议补一句"取消一个后代时保留祖先的码；取消祖先本身时一并取消它的全部后代"，规格 5.16 的页面顶部文字也一样。
3. **规格 5.16 的审计日志条目没有写详情的遮蔽规则**：建议写明"页面只遮字符串值，键名匹配凭据词；数字和布尔不遮；后端不得把凭据写进 `detail`"。

## 问题文件

没有新增问题文件。`docs/contract-requests/2026-10-21-admin-frontend.md` 第 278 行的"暂定"一句改成了已定的做法（问题保留）。第 2.2 节和第四部分第 2 条（非超级管理员能不能操作超级管理员账号）、审计详情不写凭据的条目都保留，没有改。
