# 2026-11-02 后端回答与契约文字、现有假设的新差异（组 a1）

这份文件只记录差异；前端当前按后端实际行为开发。契约（`docs/shared-snapshots/` 里的快照）不改。

## 1. 管理员二次验证锁定的 429（后端回答第 10 条）

- 后端回答：这个 429 带 `data.retryAfterSeconds`（整数秒，至少 1），并同时带 `Retry-After` 响应头（`AdminAuthService.java:412-419`，测试 `AdminAuthIT.java:281-284`）。
- 契约第 1.4 节（新版接口文档第 111 行）只把用户登录锁定、用量接口、导出最小间隔列为带 `retryAfterSeconds` 的，并写其他限流的 429 不带 `Retry-After`。后端回答自己也把它列为"接口文档与代码矛盾"，建议由改契约的人在第 111 行补上"管理员二次验证锁定"。
- 前端做法：假后端和页面按代码行为（有 `retryAfterSeconds` 就写分钟数，没有就用通用文字）；不读 `Retry-After` 头。契约补上之前这个差异一直存在；上一次提交（9216cc8）按契约文字去掉了假后端里的 `retryAfterSeconds`，现已按后端回答改回。
- 请求：由负责人决定谁在 AvatarApp 的 main 上把"管理员二次验证锁定"补进第 111 行的名单（名称：管理员登录的二次验证锁定；行为：429 `RATE_LIMITED`，`data.retryAfterSeconds` 为整数秒，同时带 `Retry-After`；检查顺序：登录限流、密码、停用、锁定、二次验证；错误：只有密码正确才答 429，密码错误仍是 401 `ADMIN_INVALID_CREDENTIALS`；测试：第 5 次错误码仍是 401 `ADMIN_TOTP_INVALID`，第 6 次起 429）。
