# 后端写给管理端前端的文件（快照）

这几份是 AvatarBackend 会话写给管理端前端会话的文件，是契约没定的接口和**全部响应字段名**的依据（字段名以它们为准）。AvatarBackend 的远程仓库没有这些文件，所以在这里放一份快照，让没有本机文件的会话也能读到。

| 文件 | 来源（AvatarBackend 最后一次改它的提交） | 内容 |
|---|---|---|
| `2026-10-21-avatar-backend-note-for-avataradmin.md` | 52e75ed | 说明：上传先上传后创建、目录和渲染模型、默认数字人、`/config`、归因、审核内容转写、广告报表渠道筛选 |
| `2026-10-21-avatar-backend-reply-to-avataradmin.md` | 57c388c（对应 4e1f538） | 对管理端前端 11 条问题和响应字段表的逐条回复 |
| `2026-10-21-avatar-backend-reply-2-to-avataradmin.md` | 409126c | 邮件模板占位符每项带花括号 |
| `2026-10-22-avatar-backend-reply-3-to-avataradmin-upload-limits.md` | afe2764 | `GET /api/admin/meta` 新增八个上传限制字段，六个上传入口的提前检查 |
| `2026-10-29-avatar-backend-d1-admin-frontend-changes.md` | 负责人从后端会话取得（2026-10-31 放入；后端合并提交 89370b6 及之后的 2026-10-30、10-31 追加） | 后端第一批交付给管理端前端的改动清单：22 个改变前端的请求（逐行 a1–a14、b1–b2、c1、d1–d18、e1–e6）、11 个不改变的、预告、未核实项，以及 2026-10-31 追加的 W2a、GROUP A、GROUP B |
| `2026-11-02-avatar-backend-answers-to-avataradmin-questions.md` | 负责人从后端会话取得（2026-11-02 放入） | 后端对 `docs/contract-requests/for-backend.md` 里 140 条问题的回答：第一节 49 条前端要改，第二、三节向后端提出的改动请求（后端还没改），第四节 17 条没有完全核实 |
| `2026-11-02-backend-task-java-backend-e07469d1.md` | AvatarApp main 提交 e07469d1 的 `docs/backend-task-java-backend.md` | 新版接口文档。答案文档里的“接口文档第 N 行”指这一份。`docs/shared-snapshots/` 里的旧快照没有更新（只读，由负责人决定），行号对不上时以这一份为准 |

**规则：** 这些文件是快照，不在这里改。后端以后若有新的回复，是新的文件；管理端前端有新问题，写新的文件放到 `docs/contract-requests/`，不改这里的任何一份。契约和管理端前端设计的快照在 `docs/shared-snapshots/`，同样只读。
