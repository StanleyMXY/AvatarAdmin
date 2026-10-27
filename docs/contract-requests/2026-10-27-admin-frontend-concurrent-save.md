# 给后端和改契约的人：整体替换式保存的版本检查（规则词表加 `expectedUpdatedAt`，客户端配置沿用已有请求）

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端，变更项决定 `docs/superpowers/handoff/decisions-2026-10-27.md` 第 3 条（客户端配置和审核规则词表并发保存会静默覆盖）。

## 一、前端现在做到哪一层

两个页面的保存都是"整体替换"：客户端配置抽屉的 `PUT /client-config/{key}` 替换这个键的全部语言值，审核规则词表的 `PUT /moderation/text-rules` 替换整张词表。两个管理员同时打开，后保存的会把先保存的人新加的语言或新加的规则静默删掉。

前端在每次保存前先重新读取一次，和打开时读到的内容比较：

- 客户端配置：读 `GET /client-config`，取该键，和打开时的 `updatedAt` 比较（两边都有 `updatedAt` 就比它；任何一边没有就比各语言的值）。
- 规则词表：`GET /moderation/text-rules` 现在没有时间字段，比较每条规则的 `id`、`pattern`、`matchMode`、`level`、`note` 和顺序。

不一致就不发 `PUT`，提示"已被他人修改"，给"重新载入"按钮（读取最新内容，放弃本地改动）。读取失败也不发 `PUT`，显示错误码对应的文字。

这一层有一个读和写之间的时间窗（两次请求之间别人保存仍会被覆盖），只有后端在 `PUT` 里比较才能关上。前端**现在不发** `expectedUpdatedAt`：后端还没承诺接受它，发一个未知字段可能让整个保存被拒。后端支持后，前端把它加到请求体里，并把 409 `INVALID_STATE` 也按"已被他人修改"处理，是一处小改动。

## 二、客户端配置

已有完整的变更请求，不重复：`docs/contract-requests/2026-10-21-admin-frontend.md` 第 4.4 条（`PUT /client-config/{key}` 加 `expectedUpdatedAt`，409 `INVALID_STATE`，`data` 带当前的 `updatedAt`）。假后端已按那一条实现（`mock/clientConfig.mock.ts`），带 `expectedUpdatedAt` 的请求和不带的都按那一条的测试清单测过（`mock/clientConfig.mock.test.ts`）。

4.4 里写"`POST …/reset` 要不要同样接受它，由改契约的人定"。重置会删掉这个键的全部语言值，也会删掉别人刚保存的值。前端的重置现在和保存做同一层检查：重置前重读这个键，和抽屉打开时读到的版本比较，不一致就不发重置，提示"已被他人修改"并给"重新载入"；读和写之间仍有时间窗，只有后端比较才能关上。希望一起定：重置也接受 `expectedUpdatedAt`，规则和 `PUT` 相同（与键当前的最近更新时间不同，含 `null` 的两种情形，返回 409 `INVALID_STATE`，`data` 带当前的 `updatedAt`，什么都不删）。假后端已按此实现。前端现在同样不把 `expectedUpdatedAt` 放进重置请求，原因同 `PUT`。

## 三、规则词表（新的请求）

- **名称：** `GET /moderation/text-rules` 返回词表的 `updatedAt`；`PUT /moderation/text-rules` 接受 `expectedUpdatedAt`。
- **现状：** 契约 11.2、17.4：`GET` 返回 `{items:[{id, pattern, matchMode, level, note}]}`，`PUT` 请求体 `{items:[…]}` 整体替换，没有"我读到的版本"，也没有词表的更新时间。
- **行为：**
  - `GET` 的响应加 `updatedAt`：词表最近一次被保存的时刻（UTC，ISO 8601）；从没保存过（词表为空且从没写过）时为 `null`。
  - `PUT` 的请求体可选加 `expectedUpdatedAt`：取 `GET` 的 `updatedAt`。带了它，且与库里词表当前的 `updatedAt` 不同（含"传了时刻但库里没有""传了 `null` 但库里已有"），返回 409 `INVALID_STATE`，整张词表什么都不改，`data` 里带当前的 `updatedAt`；不带它，行为和今天完全一样（向后兼容）。
  - `PUT` 成功的响应也带新的 `updatedAt`，页面保存后用它当下一次的版本。
  - 保存一张和现有内容完全相同的词表，`updatedAt` 是否更新由后端定；页面两种都能处理。
- **检查顺序（提议）：** 权限（403）→ `expectedUpdatedAt` 比较（409 `INVALID_STATE`）→ `items` 逐项校验（400 `INVALID_REQUEST`，`details` 的 `ref` 是下标，同 11.2）→ 在一个事务里整体替换并更新 `updatedAt`。比较放在校验之前，是为了让"别人改过"先于"你的某一行写错"被看到。
- **错误：** 409 `INVALID_STATE`（已有的码）。
- **测试：** 带的值与库里相同时成功；别人先保存后，用旧的 `expectedUpdatedAt` 保存得 409，且库里是别人保存的那一份；库里没有时传 `null` 成功、传一个时刻得 409；库里已有时传 `null` 得 409；不带该字段时保存成功（兼容）；409 之后没有任何一条规则被改动；成功的响应带新的 `updatedAt`，且比旧的晚。
- **前端配合：** 拿到后页面读 `updatedAt` 当版本（有就比它，没有仍比内容），`PUT` 带 `expectedUpdatedAt`，409 时和现在的比较失败走同一个提示和"重新载入"。
