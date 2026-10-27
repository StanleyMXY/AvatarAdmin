立即修未修 0、记录项 6、未运行 2、阻塞 0

# 任务 15：内容审核

## 做了什么

审核队列、审核详情、文本规则、审核统计四个页面（四条路由），接口函数、假后端、两种语言的文字和测试。`getModerationContent(id)`、`decideModeration(id, { decision, note? })`、`getModerationStats({ from, to })` 都在 `src/services/moderation/index.ts`，签名按任务书，总览任务可以直接导入。

要点：
- 详情的内容区只对持有 `MODERATION:REVIEW` 的管理员取内容；没有这个码时只显示记录字段和"无权查看内容"，不发取内容的请求。`BLOCKED` 的记录显示"自动拦截，未保存原文"，也不发请求；其余记录取内容，404 `CONTENT_NOT_STORED`（例如名字已被用户改过的伴侣名字记录）时没有内容区，只显示 `error.CONTENT_NOT_STORED` 的译文。
- 内容按 `mediaType` 选图片、音频、视频播放器；文件地址只作为媒体元素的 `src`，不进地址栏、链接、`console`。每次进入详情重新取，不缓存；播放器加载失败时自动重新取一次（地址过期），再失败提示并给"重新取内容"按钮。`FILE` 响应带 `text` 时在播放器下方显示（`EllipsisPopoverText`），没有就没有这一块。页面写明"查看会被记录"。
- 举报来源的记录显示举报理由（五个取值都有译文）和补充说明（`EllipsisPopoverText`）。
- 判定：确认弹窗先显示这次判定对该类内容的后果（契约 §11.4 的效果表，七种内容类型各一条；照片和声音样本来自举报或投诉时是"已有资产"的那一行），拒绝时备注必填（`trimSpec` 后至少 1 个码点），通过时选填，最多 500 个码点；连点只发一次；按钮只对持有 `MODERATION:REVIEW` 且记录是待复核时渲染。
- 队列：后端的顺序（待处理按等待时长从长到短在前），顶部显示最老一条的等待时长（取 `getModerationStats` 的 `oldestPendingSeconds`，用当天 UTC 日的范围取；`null` 显示"当前没有待处理的记录"），来源含"投诉"，内容类型含 `AVATAR_IMAGE`、`ACTION_CLIP`，等待时长一列只对待复核的行显示。
- 文本规则：词表编辑器（匹配文本 1..200 个码点、三种匹配方式、两种级别、备注 ≤200 个码点），页面说明规范化、正则时间预算、命中拦截不再发给审核服务；`REGEX` 用 `new RegExp` 只给不阻止保存的提示；`PUT` 整表替换，按下标把错误对到行，条数超限（`items`）显示在整张表上，失败时页面保持编辑内容；删除一行只是从草稿里去掉（行内确认），点"保存词表"才生效。参数区 `<ConfigForm editPermission="MODERATION:CONFIG" />`。
- 审核统计：UTC 日范围（默认最近 7 个 UTC 日），四个合计、平均处理时长、当前最老待处理的等待时长（`null` 显示"—"），按日、内容类型、来源的表。

## 改了哪些文件

- `src/services/moderation/index.ts`、`types.ts`、`moderation.test.ts`
- `src/pages/moderation/`：`queue.tsx`、`detail.tsx`、`ContentPanel.tsx`、`DecisionModal.tsx`、`rules.tsx`、`stats.tsx`、`ruleRows.ts`、`effects.ts`、`duration.ts`、`options.ts`、`testSetup.ts` 和各自的测试（`queue`、`detail`、`rules`、`stats`、`ruleRows`、`effects`、`duration`）
- `mock/moderation.mock.ts`、`mock/_core/moderationData.ts`、`mock/moderation.mock.test.ts`
- `config/routes/moderation.ts`、`config/routes/moderation.test.ts`
- `src/locales/zh-CN/moderation.ts`、`src/locales/en-US/moderation.ts`
- `docs/contract-requests/2026-10-26-admin-frontend-moderation.md`、本报告

没有改共享文件，没有 `hardcodedText.allow.json`（不需要）。

## 红到绿

先写测试的只有假后端：`npx vitest run mock/moderation.mock.test.ts` 在 `mock/moderation.mock.ts` 不存在时失败（`Failed to resolve import "./moderation.mock"`，因功能不存在），实现后 40 个通过，后来又加了 1 个（现 41）。**服务、页面、路由的测试是在实现之后写的**，没有做 RED；这一部分的把关靠下面的变异检查（每个关键判断拿掉或反过来，看测试是否变红）。

最后一次运行：`npx vitest run src/pages/moderation src/services/moderation mock/moderation.mock.test.ts config/routes/moderation.test.ts src/locales tests/noHardcodedText.test.ts`，14 个文件、600 个测试全部通过（其中本任务 186 个：详情 58、队列 12、规则 21、统计 7、规则行 14、时长 17、效果 4、服务 6、假后端 41、路由 6）。`npx tsc --noEmit` 在本任务路径下 0 个报错，`npx biome check` 本任务路径干净。

中途有一次全量文字扫描失败，原因是我的测试里有原始的不间断空格（biome 把转义改成了字面字符），已改成 `String.fromCharCode`；另一次整批运行里队列的一个选项列表测试偶发失败（机器负载高），已改成 `waitFor`，之后连续多次通过。

## 真实浏览器检查（Playwright，端口 8315，登录 root）

开发服务器没有在共用检出里起，而是起在任务目录里的一份副本（`…/scratchpad/t15/app`，`node_modules` 用硬链接，复制前后都没有往原 `node_modules` 里写）：原因和任务 12 的报告记录项 5 一样，这个检出里同时有别的会话的 `max dev`，共用 `src/.umi`。副本里的开发服务器按监听进程的 PID 停掉了（4164、7566、11849 三个，各是一次重启的监听进程，另有一个孤立的 esbuild 子进程 11885），都成功，没有被拒绝；最后端口 8315 没有监听。

看了四个页面的英文、队列和详情和规则的中文、手机宽度 390（五个页面都没有横向滚动）。点了：
- 队列：顶部"最老一条等待 3 d 4 h"；来源选项含"投诉"、内容类型含"生成的标准图""动作片段"，筛选后各剩 1 行；打开详情。
- 详情：图片真的加载了（`naturalWidth` > 0）；地址栏没有 `sig=`，整页 HTML 里 `sig=` 只出现一次且在 `img` 的 `src` 上，没有链接；音频时长 1 秒、转写文字显示在播放器下面；视频 96x96、1 秒；泰语、阿拉伯语、5000 字符无空格串的内容和举报补充说明都不撑破页面；自动拦截和"原文已不存在"两种没有内容区。
- 过期：用 `page.route` 让第一次图片请求回 403，页面自动重新取了一次内容（共 2 次请求），图片加载成功。
- 判定：拒绝弹窗先显示 persona 拒绝的后果；空备注被拒；填备注后双击确认，只发了 1 个 POST（`{"decision":"REJECT","note":"ไม่เหมาะสม 😀"}`），页面显示"已拒绝"、按钮消失；通过不填备注成功；另一处先通过了同一条后，本页再拒绝显示 `error.INVALID_STATE` 的译文并保持弹窗。
- 规则：加泰语规则，加一条不能编译的 `REGEX`（页面给出不阻止保存的提示），保存时后端 400，错误显示在那一行、输入的内容都还在；改正后保存成功，重新加载泰语规则还在；参数区 10 个键。
- 统计页、中文的队列/详情/规则页。
- 控制台错误只有预期的失败请求：登录第一步的 401、被我拦成 403 的图片地址、404（`CONTENT_NOT_STORED`）、409（重复判定）、400（规则保存）。

真实浏览器里看到并改掉的：
1. 规则表的匹配文本、备注输入框没有固定宽度，表格被撑得很宽，阿拉伯语的输入内容贴在最右边，后面的列要横向滚才看到：给两个单元格固定宽度（320、220），长提示换行。
2. 队列的列太多，"等待时长"和"创建时间"在右侧固定的"查看"列下面被盖住：去掉"查看"列的固定，把状态、等待时长调到来源后面。（我一度以为是 ProTable 列键重复造成列丢失，查清后不是，是横向滚动；留下的 `key` 无害。）

## 变异检查

共 30 个，对权限显示、状态、校验、防重复、编号、UTC 日、后端检查各拿掉或反过来：

- 直接变红（25）：没有 REVIEW 也取内容；按钮不看 REVIEW；按钮不看待复核状态；拒绝不要备注；照片/声音来自举报的效果句丢掉；规则的 `id` 不发；匹配文本上限放宽到 201；`items` 的错误放到某一行；通过/拒绝的备注不去首尾空白（服务层）；转写文字不显示；假后端拒绝不要备注；假后端允许重复判定；播放器失败后不重新取；规则页路由权限降成 VIEW；队列顶部改取本地日；`REGEX` 提示变成阻止保存；空的时长显示成"0 s"；统计的默认范围改成本地日；`BLOCKED` 记录也取内容；`BLOCKED` 不显示"自动拦截"文字；假后端超过条数上限不检查；假后端不沿用旧 `id`；队列顶部不读统计；举报卡片不显示；删除一行立即保存。
- 第一轮存活后补强（3）：
  - 判定弹窗的连点保护：测试原来三次同步点击，表单的校验会把前两次合成一次，拿掉保护也过；改成"第一个请求在途时再点"，拿掉保护后变红。
  - 词表保存的连点保护：第一轮的变异写成了空改动（自己的错），重做后变红。
  - 假后端对 `BLOCKED` 记录取内容：种子数据里这条本来就没有内容，变异等价；加了"即使有存内容也回 404"的测试，变红。
- 等价（1）：页面层把判定备注改成不去空白，测试不红，因为 `decideModeration` 本身也会去（服务层的同一个变异是红的）。
- 另有一个我删掉的变异（"列键"）：见上，不是缺陷。

## 覆盖的语言

界面文字只有 zh-CN 和 en-US（键相同，`src/locales/parity.test.ts` 通过）。假数据和测试覆盖泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，另有 5000 字符无空格串（泰文、阿拉伯文、字母 x）和 emoji：队列的类别、详情的文本内容和举报补充说明、转写文字、判定备注、规则的匹配文本和备注。没有只覆盖中文的结论。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-moderation.md`，六条：（一）队列能不能按 `contentType` 筛选（契约只有 `status`、`source`）；（二）记录的字段形状（`categories` 的类型、`autoLevel`/`score` 在举报记录上为 `null` 吗、详情的形状、等待时长没有字段）；（三）判定的响应和 `note` 长度、检查先后；（四）统计的口径（通过/拒绝算创建日还是处理日、平均时长的范围、最老待处理是否与范围无关）；（五）建议在 `FILE` 响应里加过期时刻；（六）`moderation.text_rules` 的配置键和专用接口是否同一份数据。都写了暂定做法，假后端和前端按暂定做法做。

## 需要改共享文件

1. `src/pages/config/ConfigForm.tsx`：`<ConfigForm editPermission="MODERATION:CONFIG" />` 渲染该码的 10 个键，其中 `moderation.text_rules` 一行是"只读，指向 /moderation/rules"，而这个参数区就在 /moderation/rules 这个页面上，所以这一行是指向本页自己的链接。任务书说参数区只渲染另外 9 个键；ConfigForm 没有"排除某些键"的参数。建议加一个可选的 `exclude?: string[]`。本任务按任务书原样用，没有改。
2. `tests/stubs/umi-max.tsx` 没有 `useParams`：详情页从 `useLocation().pathname` 取记录 id（`recordIdFromPath`，有测试），在真实 Umi 里同样成立，不阻塞。如果以后多个详情页都要取路由参数，建议桩里补 `useParams`。

## 规格需要在 main 上修改的地方

没有新的冲突。规格 5.8 的队列只写了筛选状态和来源，任务书要求内容类型也能筛选，契约没有这个参数，见问题文件第一条。

## 记录项（6 条）

1. `src/pages/moderation/rules.tsx` 的参数区：`moderation.text_rules` 一行是指向本页的只读链接（见"需要改共享文件"第 1 条）。触发：打开 /moderation/rules，滚到"参数"，看到一行指向自己的链接。后果：多一行没用的说明，不影响正确性。
2. `mock/moderation.mock.ts`（`PUT /moderation/text-rules`）：假后端的词表不同步到 `GET /config` 的 `moderation.text_rules`。触发：在规则页保存后，用 root 打开 /config 看该键，仍是默认的 `[]`。真后端是否同步见问题文件第六条。
3. `src/pages/moderation/rules.tsx`：编辑了词表但没保存就离开页面（点别的菜单、关标签）没有提示，编辑内容丢失。触发：添加一行，点菜单"审核队列"。
4. `src/pages/moderation/ContentPanel.tsx:101-119`（取内容的 effect）：每次取内容后端写一条审计日志，播放器失败后的自动重新取会多写一条；另外 Umi 开发模式若开了 React 严格模式，进入详情会取两次（我还没查清这个项目的开发配置有没有开严格模式）。触发：详情页里让图片地址失效。
5. `src/pages/moderation/effects.ts`：来源为投诉（`COMPLAINT`）的照片或声音记录，按"已有资产"（举报）那一行显示后果。契约 §11.4 只写了"已有资产（来自举报）"，投诉来源的这个判断是我的推断；投诉来源的记录按 §11.6 是删除形象之后写的、供统计，通常不是待复核。
6. 详情的标签页标题都是"审核详情"，不带记录 ID（任务 6 报告里已记过"参数路由的标签标题"，这里只是看到了）。触发：连着打开两条记录，标签栏有两个同名标签。

## 未运行（2 条）

1. 独立评审：本任务是页面、假后端、新增测试，按约定做一次独立评审；我这个会话没有子代理工具，没有做，需要主会话另开一个只读 diff 的会话评审。
2. 签名地址真正过期：假后端的地址 5 分钟后失效（`SIGNATURE_TTL_MS`），浏览器里没有等满，用 `page.route` 让一次图片请求回 403 来模拟；测试里用 `expireSignedAddresses()` 测了假后端本身。另外没有对着真后端跑（后端还没上线）。

## 变更候选（不是遗留项，要先和负责人确认再做）

1. 队列的等待时长列和顶部的最老一条改用后端给的秒数字段（问题文件第二条），而不是用浏览器的时钟算。
2. 详情页的"上一条 / 下一条待处理"（按队列顺序连着处理）：规格和计划都没有写，没做。
