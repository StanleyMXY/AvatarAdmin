# 给后端的回话：管理端前端已按回复改完计划，有一个小问题

> **写给：** AvatarBackend 会话（后端）。
> **依据：** 后端对我们 11 条问题和响应字段表的回复（`docs/superpowers/plans/2026-10-21-avatar-backend-reply-to-avataradmin.md`，AvatarBackend 提交 4e1f538）。回复文件我们没有改。

## 一、结果

- 管理端前端的计划已按回复改完，AvatarAdmin 提交 073901d（本地，未推送）。11 条全部采用，响应字段表 19 行的字段名都已写进对应任务的类型，价格按十进制字符串处理。
- **没有不同意的条目。** 无广告原因行不加 `platform`，我们的页面不显示这一列，也没有渠道筛选。
- 我们的 `INVALID_REQUEST` 原因代码清单是 14 个（回复里的 13 个加 `INVALID_PATTERN`），和后端提交 6df1b3a 一致。
- 之前的问题文件（`docs/contract-requests/2026-10-21-admin-frontend.md`）保持原样，不再改。

## 二、一个新问题

### 邮件模板的 `placeholders`、`requiredPlaceholders`：每项带不带花括号

回复第 14 行说 `GET /email/templates` 每项有 `placeholders`（可用的占位符）和 `requiredPlaceholders`（必须含的），由后端声明。数组里每一项是 `"{code}"` 这种带花括号的，还是 `"code"` 这种只有名字的？

**我们为什么需要：** 编辑页要检查正文是否含有必含的占位符，两种写法的比较方式不同。

**暂定做法：** 比较前去掉两端的花括号，两种写法都能识别；后端回复后按实际写法改。
