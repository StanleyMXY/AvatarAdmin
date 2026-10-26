# 给后端的问题：系统管理（管理员、角色、权限树、审计日志）的请求体、错误码和参数

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 31（系统管理）。契约 §17.2–§17.4 的"系统管理"行和字段表第 2、15 条写了接口、权限和响应列；下面几处两处都没有写请求体细节、错误码或参数格式。前端和假后端按"暂定做法"先做，后端回复后再改。没有一条是阻塞。

## 一、管理员 `/admins`

1. **"不能修改自己的角色和 `superAdmin`""不能停用或删除自己""最后一个启用的超级管理员不能停用、删除、清除标志"这几种拒绝，返回什么错误码？** 契约只写"不能"，错误码表里没有对应的码。前端按"错误码已知时只显示译文"显示，所以需要码。**暂定：** 针对自己的拒绝是 403 `ADMIN_FORBIDDEN`，针对最后一个超级管理员的拒绝是 409 `INVALID_STATE`（`data.status` 是当前状态）。这两个码的译文只说"没有权限"和"状态不允许"，看不出原因，所以页面在这两种拒绝后面加一句固定的话（"后端对自己的账号和最后一个启用的超级管理员拒绝这个操作，什么都没有改变"）。**请求：** 给专用的错误码（例如 `ADMIN_SELF_PROTECTED`、`LAST_SUPER_ADMIN`），前端加译文后去掉那句固定的话。
2. **`PUT /admins/{id}` 的请求体。** 契约写 `{"username","roleIds","superAdmin"}`，没写哪些可省略。**暂定：** 页面不发 `username`（创建后只读）；只发有改动的 `roleIds`（整体替换该管理员的角色集合）和 `superAdmin`；管理员自己的那一行**一个都不发**（页面禁用了控件，请求层也不发）；不是超级管理员的人不发 `superAdmin`；读不到角色列表时不发 `roleIds`（发 `[]` 会拿走全部角色）。**请求：** 确认缺省字段表示"不改"，而不是"清空"；确认 `username` 不需要带。
3. **自己的行带了 `roleIds` 或 `superAdmin` 时（即使值没变）是否一律拒绝？** 假后端按"带了就拒绝"做。请确认。
4. **`POST /admins`、`PUT /admins/{id}`、`POST …/status` 的响应形状。** **暂定：** 创建和修改返回一行 `GET /admins` 里的那种对象；状态、重置密码、重置二次验证、删除返回 `null`。页面只用它们判断成功，不读任何密码字段。**请确认后端从不在响应里返回密码或临时密码**（契约规定密码由创建者设置，没有"生成初始密码"的接口，所以页面没有"显示一次的密码"对话框）。
5. **用户名、密码的规则。** 契约写密码至少 `admin.password_min_length`、不得与用户名相同，没写用户名的长度和字符、没写创建和重置时 400 `details` 的 `ref`。**暂定：** 页面只检查用户名不为空（去首尾空白），不限制长度和字符；密码按 `GET /me` 的 `passwordMinLength`（按码点数）、不得与用户名相同、两次输入一致检查；创建时密码问题的 `ref` 是 `password`，重置时是 `newPassword`，用户名的是 `username`，角色的是 `roleIds`。
6. **`DUPLICATE_RESOURCE` 的 `data.field`。** 契约只写用户名冲突是 409 `DUPLICATE_RESOURCE`。**暂定：** `data.field` 是 `username`（管理员）、`name`（角色）、`code`（权限节点），页面把译文放在同名的表单项下面；不认识的 `field` 只显示在对话框底部。
7. **任务书与契约在"谁能读 `GET /roles`"上不一致。** 任务书写"要 `ROLE:MANAGE`，只有 `ADMIN:MANAGE` 的管理员收到 403"；契约 §17.4 附·通则第 5 条和后端第一份回复写 `GET /roles` 另允许 `ADMIN:MANAGE`（管理员表单选角色用）。页面按后者做（假后端也如此），同时两种情况都处理：收到 403 时角色选择器禁用并写明缺 `ROLE:MANAGE`，且不发 `roleIds`。
8. **`passwordMinLength` 的位置。** 任务书写它在 `GET /meta`（`useAdminMeta()`），实际在 `GET /me`（后端第一份回复，`Me.passwordMinLength`）；页面读 `me`，两处都没有时不检查长度。

## 二、角色 `/roles`

1. **请求体。** 契约写 `{"name","remark","permissionCodes":[…]}`。**暂定：** `PUT` 是整体替换（页面总是发完整的三项，`remark` 空时发 `null`）；`permissionCodes` 可以是空数组；`name` 去首尾空白后不能为空；名称唯一（大小写是否敏感请说明，假后端不敏感）；名称和备注的长度没有写，页面不限制。
2. **自定义节点的码能否放进 `permissionCodes`？** 契约 §17.3 写能，"给角色分配不存在的权限码 400"。页面允许勾选自定义节点和真实权限码清单里的码，不允许勾选"标成内置但页面的码清单里没有"的节点。

## 三、权限树 `/permissions`

1. **`POST`、`PUT` 的请求体。** **暂定：** 创建 `{code, parent, type, sortOrder, nameZh, nameEn}`（`parent` 为根时 `null`）；修改 `{nameZh, nameEn, sortOrder}`，自定义节点且改了父节点时另带 `parent`；内置节点永远不带 `parent`；`code` 和 `type` 创建后不改，所以修改里不带。**请确认**修改时 `type` 确实不能改。
2. **码、名称、排序的限制。** 契约没有写码的格式和长度、名称长度、`sortOrder` 的范围。**暂定：** 页面要求码去首尾空白后不为空、不含空白或控制字符或格式字符（含零宽和双向控制）、至多 100 个码点；名称不为空；排序是整数。
3. **把节点移到自己或自己后代下面（会成环）时返回什么？** **暂定：** 400 `INVALID_REQUEST`，`data.details` 为 `[{ref:'parent', reason:'OUT_OF_RANGE'}]`。页面的父节点选项里本来就没有自己和后代，所以正常使用碰不到；请确认后端同样拒绝。
4. **改内置节点的父节点、删除内置节点时返回什么？** **暂定：** 改父节点 400 `INVALID_REQUEST`（`ref: 'parent'`）；删除内置节点 409 `INVALID_STATE`。页面不提供这两个操作。
5. **`GET /permissions` 每项的字段。** 契约写 `[{code,parent,type,sortOrder,nameZh,nameEn,builtin}]`，字段表第 2 条又说 `AdminPermission.createdBy` 有对应的 `createdByUsername`。**暂定：** 响应是 `{items:[…]}`（不分页），页面只读契约写明的七个字段；`builtin` 不是 `false` 的节点（含缺失）一律按内置处理：不删除、不改父节点。
6. **`DELETE` 一个有子节点的节点**是 409 `PERMISSION_HAS_CHILDREN`（契约已写），页面显示它的译文。

## 四、审计日志 `/audit-logs`

1. **`from`、`to` 的格式和含义。** 契约只写 `from=&to=`。**暂定：** ISO-8601 时刻（UTC），`from` 含、`to` 不含；页面把所选的 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，页面注明是 UTC。
2. **`adminId`、`action`、`targetType`、`targetId` 是精确匹配吗？** **暂定：** 都是精确匹配，页面只去首尾空白。**请求：** 给出 `action` 和 `targetType` 的取值清单，页面可以做成下拉。
3. **`detail` 的类型。** 契约没写（字符串还是 JSON）。**暂定：** 页面当作"类型不定"：字符串原样显示，对象和数组写成 JSON，其他值写成文字。**请确认 `detail` 里从不写密码、令牌、验证码、凭据**（契约写 `detail` 只记改动的字段名和新旧值）；页面另外把键名带 password、secret、token、credential、authorization、apikey、cookie、signature、totp 的值，和文字里"password=…""token: …"这样的写法，显示成 `********`，是第二道防线，不是对后端的要求的替代。页面不把任何行写进日志。
4. **`adminUsername` 为 `null` 的行。** 契约写"可空"。页面显示管理员 ID 的前 8 位；管理员已被删除或改名的行显示写入时的名字，不变。**请确认**管理员过滤用的是 ID，改名后仍能筛到旧行。
5. **能不能按"管理员"下拉筛选，而不需要 `ADMIN:MANAGE`？** 只有 `AUDIT:VIEW` 的管理员读不到管理员列表，页面让他输入管理员 ID。如果要给他下拉，需要一个只读的管理员名单接口（`id`、`username`）。
