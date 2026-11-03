改了 8 处（请求 17、19、22、45、46、60、61、134，落在 6 个提交里）、没做 0 处、没运行 2 项（真实后端联调；真实浏览器逐页检查）、阻塞 0。

负责的请求：17、19、22、45、46、60、61、134。以后端实现说明（`docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`）和更新接口文档为准。开发计划里这几条的段落在本组开工前已经按后端实际行为写好（第 273、653、973 到 980 行等），本组只补了实现时定的细节（见下面“定的取舍”），那几处改动被组 c4 的提交 5ecf207 一起带进去了（同一文件，别的组也在改）。新差异请求在 `docs/contract-requests/2026-11-03-new-differences-c2.md`。

## 对照表

| 请求 | 后端实现说明怎么说 | 前端要改什么 | 状态 | 提交和位置 |
|---|---|---|---|---|
| 17 | 第三节 17 号行；更新接口文档第 2392 行：`/admins`、`/roles` 写入的 403 `ADMIN_FORBIDDEN`，`data.reason` 为六个值之一 | 403 之后的话按 `data.reason` 选，不再按提交的操作推断；六条译文；假后端返回 reason；加“同一操作两种原因文字不同”的测试 | 已改 | 297c0be（和 22 号同一提交，因为两条共用同一批文字、假后端和测试）：`src/pages/system/texts.ts:37`（`withScopeHint`）、`:70`（`protectedFailureText`），`src/locales/{zh-CN,en-US}/system.ts` 的 `system.refusal.*`，`mock/system.mock.ts:82`（先判超级管理员目标，再判权限码）。测试：`src/pages/system/texts.test.ts`；`admins.test.tsx` 重置密码和编辑对话框各一例同一操作两种原因；`roles.test.tsx` 同一保存先后答 `ROLE_NOT_HELD`、`OWN_ROLE`；`mock/system.mock.test.ts` 六种原因 |
| 19 | 第三节 19 号行、第二节第 9 条：`GET /me` 新增 `roleIds`（字符串数组，文本升序），七个字段；`GET /roles` 没有 `heldByMe` | `Me` 类型加 `roleIds`；假后端 `/me` 加；字段由六个变七个的测试；角色页用 `roleIds` 在自己持有的角色行上禁用“编辑”并在行内写原因 | 已改 | 029e87e：`src/services/auth/index.ts:47,66`，`mock/auth.mock.ts:75`，`src/pages/system/roles.tsx:32,51,59,107`，`mock/auth.mock.test.ts`（字段集合加 `roleIds`）、`src/services/auth/auth.test.ts`、`src/pages/system/roles.test.tsx` 新一节。超级管理员不禁用；`roleIds` 缺失时不禁用；“删除”不禁用 |
| 22 | 第三节 22 号行；更新接口文档第 2392 行：`/admins` 写入的 409 `INVALID_STATE`，`data.reason` 为 `SELF_PROTECTED`、`LAST_SUPER_ADMIN`、`CONCURRENT_CHANGE`，与 `data.status` 并存 | 去掉“是不是自己那一行”的两句，按 reason 分三句并加撞车那句；译文三条；假后端同步 | 已改 | 297c0be：`src/pages/system/texts.ts:59`（`withStateHint`），`admins.tsx`、`AdminFormModal.tsx` 去掉 `own` 参数，`mock/system.mock.ts:93,102`（`invalidState`、`meetRace`，测试开关 `systemState.race` 在 `mock/_core/systemData.ts`）。测试：`texts.test.ts`、`admins.test.tsx`（三种原因、无 reason）、`mock/system.mock.test.ts` |
| 45 | 第三节 45 号行；更新接口文档第 2392 行：新接口 `GET /audit-logs/meta`（`AUDIT:VIEW`）返回 `{actions, targetTypes}`，字符编码顺序，大小写原样 | `action`、`targetType` 筛选改为下拉，选项取自此接口，原样使用；假后端造数据（含 `NOTIFICATION` 全大写和首字母大写的驼峰） | 已改 | 86b7a12（和 46 号同一提交，同一页面和同一批文件）：`src/services/system/index.ts:196`（`getAuditMeta`），`src/pages/system/AuditValueFilter.tsx`、`ChoiceOrTyped.tsx`，`audit.tsx`，`mock/_core/auditMeta.ts`，`mock/system.mock.ts:511`。下拉最后一项“其他（手动输入）”（请求文件里写的做法）。测试：`audit.test.tsx`、`system.test.ts`、`mock/system.mock.test.ts` |
| 46 | 第三节 46 号行：新接口 `GET /audit-logs/admins`（`AUDIT:VIEW`）返回 `{items:[{id,username}]}`；`GET /admins` 没放宽 | “操作者”筛选改为下拉，已删除管理员保留手输；页面用新接口不用 `/admins`；去掉“无 `ADMIN:MANAGE` 就隐藏”的规则 | 已改 | 86b7a12：`src/services/system/index.ts:209`（`listAuditAdmins`），`src/pages/system/AuditAdminFilter.tsx`，`mock/system.mock.ts:515`。测试：只有 `AUDIT:VIEW` 的人能看到下拉且不请求 `/admins`；“其他”输入 9999 发 `adminId=9999`；列表读失败时退回输入框 |
| 60 | 第三节 60 号行；更新接口文档第 2457 行：`GET /users/{id}` 新增 `deletion`（null 或 `{id,status,executeAfter,requestedBy,requestedByUsername,createdAt}`） | 详情概览直接显示到哪天、谁发起，不再另查删除列表 | 已改 | 6e08ce3：`src/services/users/types.ts`（`OpenDeletion`），`src/pages/users/OverviewTab.tsx:31`（`requesterWords`），`mock/users.mock.ts:122`（`openDeletion`），测试 `src/pages/users/detailDeletion.test.tsx`、`mock/users.mock.test.ts`。`requestedByUsername` 为 null 时：`requestedBy` 为 null 写“用户自己”，有值写“已被删除的管理员（编号前 8 位）” |
| 61 | 第三节 61 号行；更新接口文档第 2377 行：`contentType` 参数，非法值 400 `INVALID_REQUEST`，`details=[{ref:'contentType',reason:'OUT_OF_RANGE'}]` | 类型筛选改成发给服务端；去掉页内过滤和那句界面说明 | 已改 | c56e75a：`src/pages/moderation/queue.tsx`（`request` 直接发三个筛选），`src/services/moderation/types.ts`（`ModerationQuery.contentType`），`mock/moderation.mock.ts:191`；删掉语言文件里 `moderation.queue.typeNote`、`typeFilter`。测试：`queue.test.tsx`、`moderation.test.ts`、`mock/moderation.mock.test.ts`（七种、分页总数、非法值） |
| 134 | 第三节 134 号行；更新接口文档第 2377 行：`FILE` 响应带 `expiresAt`（UTC），`TEXT` 没有 | 过期前主动重新取；“快到期才重取、没到期不重取”的逻辑和测试 | 已改 | 0e9b703：`src/pages/moderation/ContentPanel.tsx:20,27,155`（`RENEW_BEFORE_MS`、`renewDelay`、`renew`），`mock/moderation.mock.ts:225`，`ContentPanel.test.tsx` 新一节 11 例 |

## 定的取舍（没有规格依据，按通行做法）

- 17、22：reason 缺失或不认识时只显示按码翻译的文字，不附后端 `message`；旧的两条通用话（`system.scopeHint`、`system.admins.forbiddenHint`）和两条按“是不是自己”的话（`refusedOwnHint`、`refusedOtherHint`）已删。
- 22：假后端按契约顺序判（超级管理员目标 403 先于权限码 403，改角色先于改标志）。`LAST_SUPER_ADMIN` 和 `CONCURRENT_CHANGE` 一个请求一个请求地做遇不到（见新差异请求第 1 条），假后端用测试开关 `systemState.race` 触发。
- 19：超级管理员不预先禁用；只禁“编辑”，不禁“删除”。
- 45、46：保留“其他（手动输入）”（请求文件里写的做法）；选项很长，用可搜索下拉；两个筛选共用一个 `ChoiceOrTyped`。
- 134：过期前 30 秒重取（剩余不足 60 秒取一半，最少 1 秒）；标签页不可见时不取，可见后再取；正在播放时每 5 秒再看，停下后才换地址；重取失败保留已显示的内容、不弹错也不自动再试；`expiresAt` 缺失、不是时间、已过去都不安排。用浏览器时钟算（见新差异请求第 5 条）。
- 提交合并：17 与 22、45 与 46 各合成一个提交，因为共用同一批文字、假后端、测试文件，拆不开又不破坏中间状态。

## 深度自检（变异检查）

权限判断和审计相关，做了变异：每个都故意改坏、跑对应测试、确认变红后恢复。

- 17/22：`withScopeHint` 恒不加句子（2 例变红）；`withStateHint` 恒不加句子（1 例）；认可任何 reason 值（1 例）；假后端去掉超级管理员目标检查（3 例）；假后端把自己的 409 reason 改成 `LAST_SUPER_ADMIN`（2 例）。
- 19：去掉 `disabled`（3 例）；对超级管理员也禁用（1 例）；`normalizeMe` 不过滤非文本（1 例）。
- 45/46：`ChoiceOrTyped` 把选中的值转小写（“大小写原样”测试变红）。
- 60：去掉“用户自己”分支（2 例）；去掉名字分支（1 例）；假后端把已完成的任务也当作未结束（2 例）。
- 61：页面不发 `contentType`（2 例）；假后端不筛选（1 例）。
- 134：改成到期才取（4 例）；改成立刻取（2 例）；去掉标签页不可见判断（1 例）；去掉播放中判断（1 例）；去掉“无法解析”判断（1 例）；去掉“已过去”判断（1 例）。

## 检查结果

- 相关测试：见交给主会话的消息里的数字（`mock/{system,auth,users,moderation}`、`src/pages/{system,users,moderation}`、`src/services/{system,auth,moderation,users}`、`src/locales`、`tests`、`storedFailureText`）。负载高时 `roles.test.tsx` 里权限树的几个用例会撞上文件里写死的 30 秒超时（`vi.setConfig`），负载低时全过；不是代码问题。
- `tsc --noEmit`：本组文件 0 错误；全仓库还有别的组文件里的错误（`src/pages/activity/failureLanguage.test.tsx`、`src/pages/campaign/accounts.batch.test.tsx`），不是本组的。
- `biome check`：本组改过的文件 0 诊断。

## 没运行的

1. 对着真实后端联调（`npm run dev:api`）：这六个提交里的所有结论来自假后端和更新接口文档。
2. 真实浏览器里点一遍：审计日志的下拉在 132 个选项时的手感、角色页行内小字、概览页的删除一节、审核详情页里地址到期前换地址时图片是否闪一下、播放中的声音不被打断。

## 后端没写清的（已写成请求）

`docs/contract-requests/2026-11-03-new-differences-c2.md`：`LAST_SUPER_ADMIN`、`CONCURRENT_CHANGE` 出现的接口；超级管理员的 `roleIds`；输入长度的单位；“未结束的删除”是否含 `FAILED`；`expiresAt` 与浏览器时钟。
