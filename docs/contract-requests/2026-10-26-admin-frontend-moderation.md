# 给后端的问题：审核队列的内容类型筛选、记录的字段形状、判定的响应和备注长度、统计的几处口径

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 15（内容审核）。契约 §11.2、§11.4、§17.4 内容审核行和后端的回复第 8 条、说明第 6 条已经给出规则词表的接口、内容接口的响应和统计的响应；下面几处两处都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。

## 一、`GET /moderation/records` 能不能按内容类型筛选

契约 §17.4 只写了 `GET /moderation/records?status=&source=`，规格 5.8 和任务要求队列的内容类型含 `AVATAR_IMAGE`、`ACTION_CLIP`（队列有七种内容类型，运营需要只看某一种，例如只看生成的动作片段）。

**问：** 是否支持 `contentType=<七个值之一>` 这个查询参数？不在范围内是否 400 `INVALID_REQUEST`（`details` 的 `ref` 为 `contentType`，原因 `OUT_OF_RANGE`）？

**暂定做法：** 页面选了内容类型就发 `contentType=…`，没选不发；假后端按这个过滤。若后端不支持这个参数，页面的这个筛选就不起作用（不会报错，只是不过滤），需要后端支持或我们去掉这个筛选。

## 二、`GET /moderation/records` 和 `GET /moderation/records/{id}` 的字段

契约 §18 给了 `ModerationRecord` 的列：`id`、`accountId`（可空）、`contentType`、`contentRef`、`source`、`autoLevel`、`categories`、`score`、`providerRef`、`status`、`reporterReason`、`reporterDetail`、`reviewedBy`、`reviewedAt`、`note`、`createdAt`；后端回复第 2 条说 `reviewedBy` 旁另给 `reviewedByUsername`（管理员已删除时为 `null`）。没有写：

1. `categories` 的 JSON 类型：是字符串数组（例如 `["RULE:<id>","sexual"]`），还是逗号分隔的字符串？
2. `autoLevel`、`score` 在 `source=REPORT` 的记录上是 `null` 吗？
3. 列表响应是 `{items,total}`（通则）。`GET /moderation/records/{id}` 的 `data` 是不是同一个形状（单条记录）？
4. 队列"等待时长"没有字段：页面用 `createdAt` 和浏览器的当前时间算，只对 `PENDING_REVIEW` 的记录显示。若后端想直接给出等待秒数，请告诉我们字段名。

**暂定做法：** `categories` 按字符串数组（`null` 或空显示"—"），`autoLevel`、`score` 为 `null` 时显示"—"，详情是同一个形状；等待时长在前端算。

## 三、`POST /moderation/records/{id}/decision` 的响应和 `note` 的长度

契约只写了请求 `{decision, note}`，没有写响应的 `data`，也没有写 `note` 的长度范围。

**问：** 响应 `data` 是更新后的记录，还是 `null`？`note` 最长多少个码点（我们按管理端其他文字字段的做法，去首尾空白后按码点计）？

**暂定做法：** 页面不读响应，成功后重新取一次记录；`note` 去首尾空白后拒绝时至少 1 个、最多 500 个码点（通过时可以不填，空的不发这个字段）；假后端按这个返回 400 `INVALID_REQUEST`（`ref` 为 `note`，原因 `EMPTY_NOT_ALLOWED` 或 `TOO_LONG`）。检查先后我们暂定为：参数检查（400）、记录是否存在（404）、状态（409 `INVALID_STATE`，`data.status` 是当前状态）。

## 四、`GET /moderation/stats` 的口径

契约写了响应形状 `{"items":[{"statDate","contentType","source","created","approved","rejected","blocked"}],"avgHandleSeconds","oldestPendingSeconds"}`。没有写：

1. `approved`、`rejected` 是算在记录的创建日，还是处理日（`reviewedAt` 的 UTC 日）？
2. `avgHandleSeconds` 是所选范围内处理的记录的平均值，还是所选范围内创建的记录的平均值？
3. `oldestPendingSeconds` 是不是不管所选范围、总是当前最老的待处理记录（队列页顶部要显示它，我们用当天一天的范围去取）？
4. 没有任何记录的日子是整行没有，还是各数为 0？

**暂定做法：** `created`、`blocked` 算创建日，`approved`、`rejected` 算处理日；`avgHandleSeconds` 取范围内处理的记录；`oldestPendingSeconds` 与范围无关；没有记录的日子没有行。页面把 `items` 按日期倒序显示，合计在浏览器里加；`null` 显示"—"。队列页每次取列表时用"今天（UTC）"到"今天（UTC）"取一次，只读 `oldestPendingSeconds`。

## 五、内容接口的签名地址

契约和后端的说明写了地址是短时效签名地址，有效期取 `moderation.content_url_ttl_seconds`。响应里没有过期时间。页面不知道什么时候过期，所以做法是：每次打开详情重新取；播放器加载失败时自动重新取一次，再失败就提示并给"重新取内容"的按钮。

**问：** 能否在 `FILE` 响应里加一个过期时刻（例如 `expiresAt`）？有了它页面可以在过期前主动重新取，不必靠播放器的失败来发现。不加也能用，这是一条建议，不阻塞。

## 六、规则词表 `moderation.text_rules` 和 `GET /config`

`moderation.text_rules` 既是配置键（`GET /config` 里有一行，页面只读并指向规则页），又有专用的 `GET/PUT /moderation/text-rules`。**问：** 两边读到的是同一份数据吗（规则页保存后，`GET /config` 里该键的值同步变化）？假后端目前不同步（规则页和 `GET /config` 各读各的）。

核对于 2026-11-01
