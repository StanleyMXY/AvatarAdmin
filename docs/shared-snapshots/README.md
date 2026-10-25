# 规格和契约的快照

这两份文件是 AvatarApp 仓库 `main`（提交 36626b12）里的原文，逐字节相同（`cmp` 验证过，用 `cp -p` 复制）：

| 文件 | AvatarApp 里的路径 | 该文件在 AvatarApp 的最后一次改动 |
|---|---|---|
| `admin-frontend-design.md` | `docs/admin-frontend-design.md` | 59706fdc |
| `backend-task-java-backend.md` | `docs/backend-task-java-backend.md` | 89c71002 |

**为什么有这份副本：** 负责人不让云端会话访问 AvatarApp 仓库，所以 2026-10-26 决定把这两份拷进本仓库，让云端会话只读本仓库就能对照。

**规则：**
- 这是**只读快照**，不在这里改。计划、任务书、`CLAUDE.md` 里写的"规格""契约"，在本仓库里就读这里的文件；计划里写的 `D:\…\AvatarApp\docs\…` 路径对应这里的同名文件。
- 真正的共享文档是 AvatarApp `main` 上的那两份。两处不一致时，以 AvatarApp `main` 为准。需要改规格或契约的地方，写成完整的变更请求（名称、行为、检查顺序、错误、测试）交给负责人，不要改快照。
- AvatarApp 上的这两份以后有新提交，由负责人用 `cp -p` 整份替换这里的文件并更新上面的表；不要手工合并。
- 文件里出现的参照项目名是原文，不是本仓库的命名；仓库的"不出现参照项目名"检查跳过 `docs/` 目录。
