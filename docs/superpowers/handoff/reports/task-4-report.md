# 任务 4 报告：权限码、权限判断、路由装配、菜单

立即修未修 0、记录项 3、未运行 2、阻塞 0。

提交：`4ba5b48`（首次实现）、`040045e`（深度评审后的重做和修复）。环境：Node 24.22.1。

## 文件

- `src/access/permissionCodes.ts`（79 个码，文件头写了取法、日期、数量）、`canAccess.ts`（`canAccess`、`filterMenu`、`AdminRoute`）、`src/access.ts`（Umi 的 access 工厂，`Proxy`，另有 `canAccess(code?)` 给按钮和列用）。
- `src/locales/{zh-CN,en-US}/permission.ts`（79 条名称）、`src/pages/404.tsx`（占位，任务 6 换成真页面）。
- `config/menus.ts`（23 个一级菜单的键和图标、83 条页面路由按规格 5.0 的顺序）、`config/assembleRoutes.ts`（装配和规则）、`config/routes.ts`（装配）、`config/routes/<模块>.ts`（29 个空文件）。
- `scripts/permissionCodes.ts` + `check-permission-codes.ts`，`scripts/routeInventory.ts` + `check-route-inventory.ts`。
- 测试：`src/access/canAccess.test.ts`、`src/locales/permission.test.ts`、`config/routes.test.ts`、`config/assembleRoutes.test.ts`、`config/menus.test.ts`、`scripts/permissionCodes.test.ts`、`scripts/routeInventory.test.ts`。
- 原始输出和排除表：`docs/superpowers/handoff/reports/task-4-permission-codes-raw.txt`（82 个词，每个词的出现次数）、`docs/superpowers/handoff/permission-code-exclusions.txt`（3 个排除词）。

## 权限码

按任务书的节次（规格第 3 到 5 节，契约 §17.3、§17.4、§22.9、§23.6、§24.2、§25.7、§26.3、§28）取反引号里形如 `[A-Z_]+(:[A-Z_]+)+` 的词：82 个，与规划时一致；去掉契约"依据"说明里引用另一个系统的 3 个词（两个带前缀的、一个 `SMS:SEND_RECORD:EXPORT`，已逐个看过上下文），得 79 个。`MEMORY:MODEL_REGISTER`、`MEMORY:MODEL_ASSIGN`、`USER:EMAIL_VIEW`、`USER:PHONE_VIEW` 在内。`npm run check:codes -- <规格> <契约>` 输出 `documents: 82 code-shaped words, 3 excluded, 79 codes; PERMISSION_CODES: 79` 和 `ok`。独立评审者用自己的 awk 重取，结果相同，79 个码全部出现在契约 §17.4 的表里。

## 红到绿

- 红：6 个测试文件都报 `Failed to resolve import ... Does the file exist?`（模块不存在）。
- 绿：`npx vitest run src/access config scripts/routeInventory.test.ts scripts/permissionCodes.test.ts src/locales/permission.test.ts` → 7 个文件、263 个测试通过；`tsc --noEmit` 退出 0；`npm run lint` 干净。
- 路由表数字：规格 5.0 表 73 行，1 行没有页面路由（导出），83 条页面路由，每条路径只出现一次，和计划一致。`npm run check:routes` 在模块文件还是空的时报 83 条缺失、退出 1（预期：模块任务填完才归零）。
- 自己做的变异（改源码副本，看测试是否变红），全部被拦住：前缀匹配、去掉超级管理员、保留空父菜单、不合并分组、重定向写错、章节结束层级、菜单名沿用、菜单顺序、页面顺序、重复路径、全路径通配、`superAdmin` 取真值、检查永远通过。

## 设计：菜单怎么装配（评审后重做，请知悉）

计划没写多个模块共用一个菜单时怎么装配。第一版（同 `path` 的父节点合并子项）被深度评审证明站不住：规格 5.0 里"活动管理"含 `/act/...` 和 `/invite/rewards`，"订阅与额度"含 `/subscriptions/...` 和 `/credits/...`，没有公共前缀，`react-router` 不允许子路径不以父路径开头；"系统监控""系统配置"的页面路径和菜单路径相同，会撞重复检查。

现在的做法：
- 每个一级菜单是一个**没有 `path` 的分组**，用 `menuGroup('<菜单键>', [页面…])` 创建（`config/menus.ts` 里 23 个键和图标，键就是路由 `name`，语言文件用 `menu.<键>` 和 `menu.<键>.<页面 name>`）。同名分组在装配时合并。
- 分组按规格的菜单顺序排，分组里的页面按规格 5.0 表的顺序排，所以和模块任务谁先谁后无关；`config/menus.test.ts` 保证 `ROUTE_ORDER` 和规格表一致、23 个菜单和规格一致、图标真实存在。
- 去掉"参数路由必须排在固定路由后面"这条通用规则（`react-router` 6.3 按静态段优先，实测最坏顺序下 83 条路径全部命中正确页面）；计划要求的 `/users/abuse` 在 `/users/:id` 之前仍有测试。
- 在临时副本里按规格填满 29 个模块文件，评审者和我各验证：`max setup`、`max build` 通过，Umi 生成的路由、`react-router` 的匹配和 `@umijs/route-utils` 的菜单数据都处理无路径分组，`check:routes` 退出 0。
- 加了两个计划类型之外的字段：`AdminRoute.hideInMenu`（详情页 `/users/:id` 要从菜单隐藏）、`AdminRoute.key`（分组的稳定键）；`path` 对分组可省略。

## 评审（深度，不同上下文，133 个变异；之后复审）

首次评审：立即修 3、记录 8、不是缺陷 8、未运行 2。三个立即修都在 `040045e` 修了，复审确认。

立即修（已修）：
1. 四个菜单写不成合法路由表（见上）。后果：模块任务 10、11、15、16、23、24 要么写出让整个应用崩溃的路由表，要么过不了 `routes.test.ts`，而共享文件只有地基任务能改。
2. 通用的"参数路由在后"规则和跨模块合并必然冲突（`/users/notifications comes after /users/:id`）。
3. `check-route-inventory` 的命令行用例依赖所有路由文件为空，第一个模块填了就变红。现在报告逻辑是纯函数 `runRouteInventory`，用例用夹具。

首次评审的记录项里，已一并修掉的：`superAdmin` 用真值判断（现在严格等于 `true`，加了测试）；`SUBSCRIPTION:GRANT` 和 `COMPLAINT:MANAGE` 的名称偏弱（现在写明还能撤销权益和处理订阅事件、删除查到的形象）；`permissionCodes.ts` 头注释的命令与原始文件不符；菜单合并只比较名称和图标（改成 `menuGroup` 后不可能不一致）；跨模块合并后子项顺序和规格不一致（现在按规格排序）；没有测试保证 29 个模块文件都被 `config/routes.ts` 导入（已加）；一些 `canAccess`、`access` 的测试缺口（已加）。

### 记录（3 项，建议最后一批全部修）

1. `config/routes.test.ts` 里"所有 access 都是权限码""根重定向在菜单之前""`/users/abuse` 在 `/users/:id` 之前""`problemsIn` 为空"这几条，在模块路由文件还是空的时候是空转，模块填完才有意义。步骤：在 `config/routes.test.ts` 里把 `routes` 换成任意错误的表，这几条仍通过。后果：模块任务写错 `access` 时要靠 `routes.test.ts` 在那个任务里变红才能发现；任务 32 的 `check:routes` 也会查。
2. 变异后仍通过的几处：`isMenuEntry` 里 `redirect`、`layout: false` 两个条件（现有用例靠"没有 name"排除）；`filterMenu` 对 `routes: []` 的父菜单的行为；`flattenPages` 去掉 `component`、`redirect` 要求；`problemsIn` 的几个分支缺同级两个固定页的夹具；`access(undefined).canAccess(undefined)` 之外的几个组合。后果：以后改这些行时测试不报。
3. 检查脚本的测试缺口：`compareRoutes` 把缺失的路由同时算成 `accessMismatch`、`prefixes` 不作用于 `pages` 这两种变异没有测试拦住；`check-permission-codes` 对"过期的排除项"退出 1 的分支没有测试。后果：脚本被改坏时不会发现。

### 不是缺陷（8 项）

`Proxy` 版 access 与 Umi 的配合没问题（Umi 只做 `access[code]` 并看结果类型，`constructor`、`__proto__`、`then`、`toString` 等键对无权限者都是 `false`）；`DRAMA:` 开头的词只在 `docs/` 下的排除表和原始输出里（约定允许 `docs/`），`src`、`config`、`scripts` 里没有；`canAccess` 传入 0 或 NaN 返回 true（类型是 `string | undefined`，传不进来）；`problemsIn` 不报大小写或末尾斜杠不同的重复路径（路径逐字取自规格，清单检查按精确路径比对）；没有 `access` 的路由 Umi 不调用 access（"只需登录"是否放行取决于任务 7 的登录守卫，**任务 7 要查**）；`hideInMenu` 是详情路由需要的；脚本传入不存在的文件时输出 ENOENT 堆栈（退出码 1，错误可见）；`access.ts` 里 `toJSON` 分支是死代码（已无害）。

### 未运行（2 项）

1. 浏览器里 ProLayout 对无路径分组的实际渲染（`max dev`，Mako 打包器）：只验证了 Umi 生成的路由、`react-router` 的匹配和 `@umijs/route-utils` 的菜单数据，以及 `max build`。
2. 标签页（任务 6 的 TabManager）：还不存在，任务 6 要用 `menu.<键>.<name>` 和分组结构验证。

## 给后面任务的提醒

- 模块任务：路由文件写成 `export default [menuGroup('<菜单键>', [页面…])]`，页面路径和 `name` 逐行取自规格 5.0，不用管菜单顺序和与别的模块共用菜单；用 `npm run check:routes -- docs/shared-snapshots/admin-frontend-design.md --prefix /你的路径` 看自己那一块。
- 任务 6：语言文件要有 `menu.<菜单键>`（23 个）和 `menu.<菜单键>.<页面 name>`；`filterMenu` 已处理分组、`hideInMenu`、无 `name` 的路由；404 页面换掉占位。
- 任务 7：`access` 工厂吃 `initialState.me`（`{superAdmin, permissions}`）；登录守卫要覆盖"只需登录"的路由。
