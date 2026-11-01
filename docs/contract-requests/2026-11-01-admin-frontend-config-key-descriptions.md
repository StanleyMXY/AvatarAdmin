# 给后端：系统配置页里 14 个设置项的说明，契约没有写，前端按键名写了一句，请核对

日期：2026-11-01。来源：前端任务 10 的记录项（"约 25 个键的说明文字是按键名推的"）。

## 为什么要问

契约 17.5 的表里，下面 14 个键的"说明"一栏是空的（别的键写了"提议"和一句用途，前端照抄）。系统配置页每个键都要给运营看一句"这个键管什么"，前端只能按键名、默认值和它所在的章节猜一句，写得保守（只说键名本身说的意思，不加后果）。猜错了运营会按错的意思去改值，所以请后端逐条看一遍：对的回"对"，不对的回一句正确的话（中英文都可以，前端自己译）。

不阻塞：当前页面照现在的话显示，后端回复后前端只改语言文件。

## 14 个键

| 键 | 默认值 | 契约章节 | 前端现在写的话（英文） |
|---|---|---|---|
| `admin.jwt_ttl_hours` | 8 | 17.2 | How long an administrator sign-in stays valid, in hours. After that the administrator has to sign in again. |
| `generation.poll_interval_seconds` | 5 | 3.5 | How often the result of a generation job is polled, in seconds. |
| `chat.history_max_limit` | 200 | 5.2 | Maximum number of messages returned in one request for chat history. |
| `events.max_batch` | 100 | 7.1 | Maximum number of events in a single event upload request. |
| `events.max_body_kb` | 512 | 7.1 | Largest request body for one event upload, in KB. |
| `recall.scan_interval_minutes` | 10 | 8.4 | How often users who should receive a recall push are looked up, in minutes. |
| `recall.window_minutes` | 60 | 8.4 | Time window after the set hour in which recall pushes may be sent, in minutes. |
| `recall.inactive_hours` | 24 | 8.4 | How many hours of inactivity put a user in the recall group, in hours. |
| `recall.streak_min_days` | 7 | 8.4 | Number of consecutive days of use a user needs before streak-based recall applies, in days. |
| `milestone.days` | `[7,30,100]` | 6.3 | Days of companionship that count as milestones, as a JSON array, for example the 7th, 30th and 100th day. |
| `support.rate_limit_per_hour` | 10 | 12 | Number of support requests allowed per hour. Requests above it are rate limited. |
| `export.min_interval_hours` | 24 | 13.3 | Minimum time between two data exports for the same user, in hours. |
| `export.ttl_hours` | 24 | 13.3 | How long an export file is available for download, in hours. It is cleaned up after that. |
| `ads.preload_enabled` | `true` | 22.10 | Whether the client preloads ad media. |

## 要后端回答的

1. 每一行的话和真实行为是否一致（"对"或改写的一句）。
2. 其中有单位或方向容易搞反的：`recall.window_minutes`（是"设定小时之后"的窗口，还是以设定小时为中心）、`recall.inactive_hours`（"连续多少小时没有活跃"从哪一刻起算）、`recall.streak_min_days`（"达到"是大于等于还是大于）、`export.min_interval_hours`（按用户还是按管理员，哪个导出）、`support.rate_limit_per_hour`（按账号还是按 IP）、`events.max_body_kb`（1 KB 是 1000 还是 1024 字节）。
3. 另外前端在 `moderation.block_score`、`moderation.review_score` 和 `complaint.likeness_due_hours` 的说明里，已经删掉了契约原文之外的推断（"达到这个值就拦截"、"改大会更晚发现"），只留契约的话；如果后端愿意确认分数和阈值的方向（分数大于等于拦截阈值才拦截吗），前端可以把方向写回说明里。
