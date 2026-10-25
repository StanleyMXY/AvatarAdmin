# 后端写给管理端前端的文件（快照）

这四份是 AvatarBackend 会话写给管理端前端会话的文件，是契约没定的接口和**全部响应字段名**的依据（字段名以它们为准）。AvatarBackend 的远程仓库没有这些文件，所以在这里放一份快照，让没有本机文件的会话也能读到。

| 文件 | 来源（AvatarBackend 最后一次改它的提交） | 内容 |
|---|---|---|
| `2026-10-21-avatar-backend-note-for-avataradmin.md` | 52e75ed | 说明：上传先上传后创建、目录和渲染模型、默认数字人、`/config`、归因、审核内容转写、广告报表渠道筛选 |
| `2026-10-21-avatar-backend-reply-to-avataradmin.md` | 57c388c（对应 4e1f538） | 对管理端前端 11 条问题和响应字段表的逐条回复 |
| `2026-10-21-avatar-backend-reply-2-to-avataradmin.md` | 409126c | 邮件模板占位符每项带花括号 |
| `2026-10-22-avatar-backend-reply-3-to-avataradmin-upload-limits.md` | afe2764 | `GET /api/admin/meta` 新增八个上传限制字段，六个上传入口的提前检查 |

**规则：** 这些文件是快照，不在这里改。后端以后若有新的回复，是新的文件；管理端前端有新问题，写新的文件放到 `docs/contract-requests/`，不改这里的任何一份。契约和管理端前端设计（在 AvatarApp 仓库）仍然只读，且**不复制进本仓库**。
