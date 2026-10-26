# 给后端的问题：权限树的响应形状、改密码的校验错误、验证码锁定的细节和权限树的父节点

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 5（假后端）。两个接口在契约 §17.2、§17.3、§17.4 和后端的回复里都没有写出响应或错误的具体形状，假后端按下面"暂定做法"先做，后端回复后再改。

## 一、`GET /api/admin/permissions` 的响应形状

契约 §17.3 写了节点字段（`code`、`parent`、`type`（`MENU` 或 `FUNCTION`）、`sortOrder`、`nameZh`、`nameEn`、`builtin`），后端回复写了每个节点另有 `createdByUsername`；§17.4 写了接口和读写权限，但没有写响应 `data` 的形状。

**我们为什么需要：** 角色编辑页的权限树选择、权限树管理页（任务 31）都要读它；`POST/PUT /permissions` 的请求体和删除时的 409 `PERMISSION_HAS_CHILDREN` 也要同一套字段。

**问：** 响应 `data` 是不是 `{"items":[节点…]}`（平铺，不分页，按 `sortOrder` 升序，用 `parent` 指向父节点的 `code`）？还是嵌套树，或者裸数组？`MENU` 节点的 `parent` 是 `null` 吗？

**暂定做法：** `{"items":[…]}`，平铺，`MENU` 节点 `parent` 为 `null`，`FUNCTION` 节点的 `parent` 是所属 `MENU` 节点的 `code`；每个节点是 `{code, parent, type, sortOrder, nameZh, nameEn, builtin, createdByUsername}`。这与 `GET /config` 的 `{"items":[…]}` 一致。

## 二、`POST /api/admin/auth/change-password` 的失败形状

§17.2 写了成功的行为（令牌全部失效、不返回新令牌）和规则（新密码至少 `admin.password_min_length` 个字符、不得与用户名相同），没写失败时返回什么。

**我们为什么需要：** 改密码页要把错误放到对应的输入框旁；"旧密码错"和"新密码不合规"需要被区分，文字不同。

**问：**
1. 旧密码错：是 401 `ADMIN_INVALID_CREDENTIALS` 吗？（注意：401 `ADMIN_INVALID_TOKEN` 才会让前端回登录页，旧密码错不能是它。）
2. 新密码太短、与用户名相同：是 400 `INVALID_REQUEST` 加 `data.details` 吗？`ref` 是 `newPassword` 吗？`reason` 用哪个代码？现有的 14 个原因代码里最接近的是 `OUT_OF_RANGE`（太短）；"与用户名相同"没有合适的代码。
3. 密码长度按码点还是 UTF-16 单位计？（其他文本字段按契约 §1.9 去空白后按码点计。）

**暂定做法：** 旧密码错 → 401 `ADMIN_INVALID_CREDENTIALS`；新密码太短或等于用户名 → 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"newPassword","reason":"OUT_OF_RANGE"}]`；长度按码点计。前端本身也在提交前检查这两条（长度来自 `GET /me` 的 `passwordMinLength`），所以后端的这个错误只在前端检查漏掉时才会出现。

## 三、验证码锁定（`admin.totp_max_failures`）的响应

§17.2 写了"同一用户名连续 `admin.totp_max_failures` 次验证码错误，`admin.totp_lockout_minutes` 分钟内拒绝该用户名的登录（429 `RATE_LIMITED`）"，§1.4 写"其他限流的 429 没有 `data`，也不带 `Retry-After`"，只列了几处带 `retryAfterSeconds` 的 429，管理员锁定不在其中。

**问：** (1) 第 5 次错误验证码本身返回 401 `ADMIN_TOTP_INVALID`、之后的登录返回 429，还是第 5 次就返回 429？(2) 这个 429 带不带 `data.retryAfterSeconds`？(3) 被锁定期间，密码错的登录请求返回 429 还是 401 `ADMIN_INVALID_CREDENTIALS`？(4) 绑定（`enroll`）一步里超过次数后，是返回 429，还是 401 `ADMIN_INVALID_TOKEN`（令牌作废）？

**我们为什么需要：** 登录页要决定提示"请 N 分钟后再试"还是通用的"请求过于频繁"。

**暂定做法（假后端和前端）：** 第 5 次错误就返回 429 且带 `data.retryAfterSeconds`；锁定期间不论密码对错都返回 429（按用户名锁）；`enroll` 超过次数时第 5 次返回 429、令牌作废，之后用同一令牌返回 401 `ADMIN_INVALID_TOKEN`。前端读 `retryAfterSeconds`，没有时显示通用文字。

## 四、权限树里几个码的父节点

契约 §17.3 说内置节点的父子关系"以 `docs/admin-frontend-design.md` 的表为准"。规格 5.0 表里，`COSMETIC:GRANT` 只出现在"用户详情"行（页面权限 `USER:VIEW`），`STATS:EXPORT`、`STATS:LAND` 只出现在成本报表、广告报表等行，表没有明确它们属于哪个页面。

**问：** 后端实际写入的父节点是什么？尤其是 `COSMETIC:GRANT`（`COSMETIC:MANAGE` 的子节点，还是 `USER:VIEW` 的）、`STATS:EXPORT`、`STATS:LAND`（`STATS:VIEW` 的子节点，还是各自页面的）。另外 `SUBSCRIPTION:CONFIG` 既是"额度包"页的页面权限，又是权益定义、功能开关、商品映射三页的"保存"权限，它是 MENU 还是 FUNCTION？

**我们为什么需要：** 角色编辑页"勾选父节点同时勾选全部子节点"的行为取决于它。

**暂定做法：** 假后端把这几个码挂在同领域的页面下（`COSMETIC:GRANT` → `COSMETIC:MANAGE`，`STATS:EXPORT`/`STATS:LAND` → `STATS:VIEW`），`SUBSCRIPTION:CONFIG` 是 MENU。前端不写死任何父子关系，全部用 `GET /permissions` 返回的 `parent`。
