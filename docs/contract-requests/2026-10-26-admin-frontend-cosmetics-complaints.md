# 给后端的问题：形象与装扮各目录、照片里的人投诉的列表参数、响应形状和几个写操作的答复

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 14（形象与装扮、照片里的人投诉）。契约 §3.6–§3.10、§11.6、§17.4 的"形象与装扮""投诉"两行，以及后端 2026-10-21 的说明（第二节第 1–3 条）和回复（第 5、6、19 条）已经给出：上传三步、请求体字段名、上下架、声明、动作补生成、默认数字人的状态机和投诉证据。下面是它们**没有写清**的地方，前端和假后端按"暂定做法"先做，后端回复后再改。其余接口（上传、默认数字人、动作补生成、投诉证据）不在此列。

## 一、各列表接口分不分页、有哪些筛选参数

契约 §17.4 通则第 1 条写"列表是 `{"items":[…],"total":N}`，不分页的接口只有 `items`"，但没有逐个说明下面这些接口分不分页，规格 5.24 也只说"列表筛选类型、上下架状态、适用风格"，没有参数名。

**我们为什么需要：** 目录页要翻页（服装条目会超过 20 条），筛选要发对参数名，否则筛选静默失效。

**问：**
1. `GET /cosmetics`、`GET /actions`、`GET /declarations`、`GET /renderer-models`、`GET /generation-tasks` 分页吗（`page`、`pageSize`，响应带 `total`）？还是返回全部、只有 `items`？
2. `GET /cosmetics` 的筛选参数叫什么？我们暂定 `kind`（`OUTFIT`、`BACKGROUND`）、`enabled`（`true`、`false`）、`style`（`STYLIZED_3D`、`REALISTIC`，匹配 `compatibleStyles` 包含它的条目）。
3. `GET /generation-tasks` 只有 `status`、`type` 两个筛选参数（契约写 `?status=FAILED&type=`），排序是创建时间倒序吗？
4. `GET /likeness-complaints` 的筛选参数是 `status` 吗？按 `dueAt` 排序是从近到远（升序）吗？
   **现状（2026-11-01）：** 已回答（后端 2026-10-29 清单 a11）：参数是 `status`，取值 `OPEN`（未结案，等于 `RECEIVED` 和 `INVESTIGATING`）或五个状态之一，区分大小写，错误值 400 `INVALID_REQUEST`；排序是 `dueAt` 升序、同时间按 `id`。假后端和页面按此实现。

**暂定做法：**
- 前端总是发 `page`、`pageSize`。响应里有 `total` 就按服务端分页；没有 `total`（返回了全部）就在前端按页切开。这样两种答案都不会让页面少显示条目。
- 筛选参数用上面的暂定名，空值不发。假后端按这些参数过滤、按 `sortOrder`（目录）、创建时间倒序（生成任务）、`dueAt` 升序（投诉）排序。

## 二、目录条目的响应字段和请求体

契约 §17.4 通则说"响应按第 18 章实体的列，去掉 `Hash`、`Enc` 结尾的列，被签名地址替代的存储引用不返回"。`CosmeticItem`、`ActionItem`、`RendererModel`、`DeclarationVersion` 的列都在第 18 章，前端按它们定义类型。没有写清的：

1. **渲染模型的 `fileRef`**：第 18 章 `RendererModel` 有 `fileRef`，它是存储引用，但响应没有用签名地址替代它（通则第 3 条只列了 `previewRef`、`iconRef`、`sourceImageRef`、`AvatarLook.previewRef`）。管理端要不要收到 `fileRef`？我们暂定不使用它，页面不显示。
2. **`names`、`texts` 的语言标签**：我们用 `GET /meta` 的 `supportedLocales`（如 `en`、`zh-Hans`）加 `en` 作为表单里的语言框，已存在条目里的其他标签也保留。名称至少要有一种语言非空；**`en` 是不是必填**（目录接口对客户端按 `Accept-Language` 回退到 `en`）？暂定不强制，只要求至少一种语言非空。
3. **`POST /cosmetics`、`POST /actions` 的请求体**：我们发 `key`、`kind`（动作没有）、`names`、`generationSpec`（动作另有 `description`）、`compatibleStyles`、`surfaces`、`creditPrice`（服装；`null` 表示不能用额度兑换）、`isFree`、`isDefault`、`triggerableBy`（动作）、`sortOrder`、`enabled`，加 `previewUploadId`/`iconUploadId`。预览图和图标创建时必填吗（第 18 章这两列没有标"可空"，我们暂定必填，前端创建时没有上传就不提交）？`enabled` 创建时能带吗（暂定能，新建表单默认 `false`）？
4. **`PUT /cosmetics/{id}`、`PUT /actions/{id}` 的请求体**：我们发除 `key`、`kind`、`enabled` 之外的全部可编辑字段（整体替换，`creditPrice: null` 表示清除价格），`previewUploadId`/`iconUploadId` 只在换了图时才带。`key` 创建后不可改（契约第 18 章），`kind` 我们也按创建后只读处理（契约没有写它能不能改）。请确认这个请求体可以接受，特别是 `kind` 不带。
5. **默认条目**：每种 `kind` 一个 `isDefault=true` 的免费条目。把另一个条目设为默认时，旧的默认条目的 `isDefault` 是自动取消，还是返回 409？`isDefault` 为真而 `isFree` 为假是 400 吗（假后端暂定 400，`details` 的 `ref` 为 `isDefault`）？
6. **长度和格式**：`key`、`names` 每个值、动作的 `description`、声明的 `version` 和 `texts` 每个值的长度上限和字符规则契约没有写（只有 `generationSpec` 的 1..2000 码点）。前端只检查非空和 `generationSpec` 的长度，其余交给后端的 400（页面显示按错误码和原因码翻译的文字，不显示后端的 `message`）。
7. **声明版本**：`version` 的格式是什么（自由文本，还是日期加序号）？重复是 409 `DUPLICATE_RESOURCE` 吗（`data.field` 是什么）？`activeFrom` 在从未设为生效的版本上是 `null` 吗？暂定都是：自由文本，重复 409 且 `data.field` 为 `version`，没生效过的版本 `activeFrom` 为 `null`。

## 三、几个写操作的响应

契约只写了请求，没有写成功时的 `data`：
- `PUT /likeness-complaints/{id}/status`、`POST /likeness-complaints/{id}/remove-avatars`：成功后返回什么（更新后的投诉详情，还是空）？
- `POST /accounts/{id}/cosmetics`：返回新建的 `AccountCosmetic` 行吗？重复赠送同一件是 409 `DUPLICATE_RESOURCE` 吗？条目不存在是 404 吗？
- `PUT /declarations/{version}/activate`、`PUT …/enabled`：返回更新后的行吗？

**暂定做法：** 前端不使用这些响应的内容，写操作成功后重新读取列表（和详情），所以任何答案都不影响页面。假后端返回更新后的行（投诉返回更新后的详情），赠送重复返回 409 `DUPLICATE_RESOURCE`（`data.field` 为 `itemId`）。

## 四、`INVALID_STATE` 的 `data.status`

契约 §1.4 写 409 `INVALID_STATE` 的 `data.status` 是当前状态。默认数字人的生成、设为生效、删除、改名，以及投诉的流转和删除形象，前端在拒绝时展示这个当前状态。**问：** 动作补生成遇到已停用的动作返回 409 时，`data` 里有没有状态？`PUT /default-avatars/{id}` 改名在哪些状态下会被拒绝（我们暂定生成中的不显示"改名"按钮，其余状态都显示）？对已经生效的默认数字人再调 `activate`，是幂等成功还是 409？

**暂定做法：** `data.status` 缺失时，页面只显示 `error.INVALID_STATE` 的通用文字；假后端对已停用的动作返回 `data.status` 为 `DISABLED`，对已生效的默认数字人再激活返回成功不变。

## 五、`GET /accounts/{id}/avatars` 的 `isCurrent`

后端回复第 7 条的字段表里，形象有 `isCurrent`，外观没有；`currentLookId` 在形象上。前端按字段表定义类型（`AccountAvatars`），`isCurrent` 的含义我们理解为"这个形象是账号当前使用的形象（`User.currentAvatarAssetId`）"。如果不是，请告知。

## 六、带签名地址的读接口不要被浏览器缓存

投诉证据（`GET /likeness-complaints/{id}/evidence/{index}`）、形象与外观目录（`GET /cosmetics`、`/actions`、`/renderer-models`）、默认数字人（`GET /default-avatars`）、账号的形象（`GET /accounts/{id}/avatars`）的响应里有签名地址，有效期很短；证据和账号形象的每次读取还要写审计日志。契约没有写这些 GET 的 `Cache-Control`。

**问：** 这些响应能不能都带 `Cache-Control: no-store`？

**我们为什么需要：** 若后端回了可缓存的头（例如 `max-age`），管理员在有效期内再点同一个证据文件，请求到不了后端：那次查看没有审计记录，页面还会复用已经快过期的签名地址。

**暂定做法：** 前端对这几个读请求都带 `cache: 'no-store'`（浏览器的请求选项），所以不依赖后端的头；后端补上 `Cache-Control: no-store` 是同一件事的第二层保险（代理和别的客户端也不会缓存）。
