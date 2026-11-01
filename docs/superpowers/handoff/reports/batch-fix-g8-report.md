立即修未修 0、记录项 3、未运行 3、阻塞 0

# 批量修复 g8：任务 32 的记录项、计划和文档里的过时说法、浏览器里补看

分支 `claude/jolly-dirac-4pq9g6`。范围：任务 32 的验收报告（3 条记录项）、走查报告（4 条）、55 条代码检查警告；计划里 7 处"原样展示后端文字"；README 和 `docs/deploy.md`；`docs/contract-requests/` 里已过时的"暂定"；用真实浏览器补看中文界面和浅色、深青主题。

## 一、记录项逐条核对

| 记录项 | 状态 | 提交或证据 |
|---|---|---|
| 验收 1：已经显示在屏幕上的表单校验提示换语言后仍是旧语言 | 已不存在 | `src/locales/switch.test.tsx:57`、`:67` 已是普通用例，没有 `it.fails`；共用组件在 `src/hooks/useRevalidateOnLocaleChange.tsx:38`（`dcd6186`） |
| 验收 2：假后端读"用户详情的形象与服装"页签不写审计行 | 已修 | `69317e9`：`mock/avatar.mock.ts` 读 `GET /accounts/:id/avatars` 时，对每个显示的形象写一行 `USER_VIEW_AVATAR`（目标类型 `AVATAR_ASSET`，目标是形象编号，写在读的人名下）；无形象的账号和被拒的读不写。测试在 `mock/avatar.mock.test.ts`，先红后绿（实现前断言得到 `[]`） |
| 验收 3：八个报表页的表格没有逐页的加载态测试 | 已修 | `e2946b6`：`src/pages/reportLoading.test.tsx`，八个用例各自"扣住全部请求 → 有转圈、没有行 → 放行 → 有行、没有转圈"。变异：把八个页面各自的转圈去掉，八个用例都变红（逐个跑过） |
| 走查 1：四个页面的浏览器标签标题是别的页面的标题 | 已不存在 | `45fd538` 已修；这次在真实浏览器里中文下读到 `账号删除任务 - Admin`、`站内通知 - Admin`（`/users/deletions`、`/users/notifications`），审核两页同理 |
| 走查 2：登录、绑定、改密码三页有 8 像素边距和竖向滚动条 | 已修 | `2b7b205`：`src/pages/user/AuthFrame.tsx` 改成固定铺满窗口、内部滚动、卡片用自动边距居中。浏览器里量：修前 1440x900 文档高 948 大于 900、390x844 为 892 大于 844；修后 900 对 900、844 对 844。测试 `src/pages/user/AuthFrame.test.tsx`，变异（改回 `relative` 加 `minHeight`）变红 |
| 走查 3：390 宽度下页头右侧超出窗口、用户名被截 | 已修 | `2b7b205`：`src/components/layout/HeaderDropdown.tsx` 在 576 像素以下不画用户名，名字留作按钮的名称和悬停文字。浏览器截图：头像完整。测试在 `src/components/layout/layout.test.tsx`，变异（去掉判断）变红 |
| 走查 4：`/push/stats` 开发模式下 antd 的 `rowKey` 废弃警告 | 已修 | `f769492`：`rowKey="__key"`；新测试读控制台并检查两行同日同原因键不重复，修前红 |
| 55 条代码检查警告（50 条非空断言、4 条可选链、1 条未使用的导入） | 已修 | `0f88533`：非空断言换成 `tests/must.ts` 的 `must()`（找不到时报出找的是什么，带自己的测试 `tests/must.test.ts`）；`mock/ads.mock.ts` 的四处 `a && a.every(…)` 改成可选链；`creatives.test.tsx` 去掉未用的导入。`npx biome check .` 现在整个仓库 0 条诊断 |
| 计划里 7 处"原样展示后端文字或 `message`" | 已修（文字和一处代码） | 计划改在 `fe28cb0`（被别的会话的提交带上）。先对照了代码：默认数字人名字必填、推送图片上传、短信渠道和模板、邮件缺占位符、管理员 403/409，页面本来就是按码翻译、不显示 `message`，只改文字。唯一不一致的是记忆档位的 `MEMORY_MODEL_CONFLICT`，页面显示了记忆服务那句只有一种语言的 `data.detail`：改为只显示按码翻译的文字（`c2f7473`，`src/pages/memory/ModelForm.tsx`，两条测试先红后绿）；要显示"原来登记的维度"需要后端给结构化字段，写成问题文件 `docs/contract-requests/2026-11-01-admin-frontend-translated-error-texts.md`，按最小做法继续，不算阻塞 |
| README 里和现状不符 | 已修 | `ebaad9f`（被别的会话的提交带上）：开头说规格和契约"没有拷进来"，其实 `docs/shared-snapshots/` 有只读快照；脚本表缺 `gen:permission-tree`、`gen:config-keys`。预置账号的权限、79 个权限码、`supportedLocales` 的七个值都核对过，一致 |
| `docs/deploy.md` 里和现状不符 | 已修 | `8c17b86`：页面现在在 `<head>` 里加载 `public/preload-theme.js`（`00b1113`），文档没提；补写它不带哈希、随 `index.html` 发布、在示例里落在最后的 `location /` 带 `no-cache`、被 `script-src 'self'` 允许。其余（缓存规则、nginx 示例、检查清单、Node 版本、构建变量）核对过，没有发现不符；没有重新用 nginx 验证 |
| 问题文件里已过时的"暂定" | 已修一部分，其余见"未运行" | 见第三节 |

提交说明和提交内容不完全对应的几处，是共享的暂存区和 `git commit -- 路径` 的并发造成的：`69317e9` 里还带着 `2026-10-26-admin-frontend-sms-email.md` 的改动；`c2f7473` 里还带着别的会话已暂存的 `src/pages/system/PermissionTreeSelect.test.tsx` 和 `permissionTree.test.ts`；`0f88533` 用单独的暂存区做成（别的会话在 `creatives.test.tsx`、`report.test.tsx` 等同一批文件里有未提交的改动，没有带进去）。

## 二、浏览器里补看的结果

做法：把仓库在 `HEAD` 的内容拷到草稿目录（`/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/g8w`），开发模式假后端 `npm run dev:mock`（端口 8388），Chromium 1440x900，界面语言简体中文，用 `root` 登录；拷贝里换上了我改的几个文件再复查。中文界面浅色和深青两个主题各看了 38 个页面（共 76 张截图，存在草稿目录的 `g8w-shots/`）：总览、用户列表、多开检测、账号删除任务、站内通知、后端参数、客户端配置、管理员、角色、权限树、审计日志、管线监控、告警、推送模板、手动推送任务、发送记录、推送效果、短信渠道、短信模板、短信记录、成本报表、价格、广告计划、广告位、广告单元、广告素材、广告报表、投放效果、投放账户与成本、归因明细、归因参数、订阅列表、额度包、日报、通话质量、邮件模板、渠道包、应用版本。

- 每个页面浏览器标题都是中文页面名，`<html lang>` 是 `zh-CN`；没有漏翻的键（扫到的 `app.display_name`、`app.example.play` 等是配置键和示例包名本身）；没有横向滚动；没有意外的控制台错误（登录时的 401 是要验证码的预期回答；修前 `/push/stats` 的 `rowKey` 警告已随 `f769492` 消失）。两个主题我都没有发现色彩上的问题（卡片、表格、图表、标签颜色都随主题变；截图我逐张看了十几张代表性的，其余靠上面的脚本检查）。
- 切换：英文界面里点"简体中文"，菜单、页签标题、浏览器标题、`lang` 同时变，页面没有重载；浅色、深青、暗蓝来回点，标记变量一直在，没有横向滚动。
- 页面浏览一轮里有两次浏览器页面崩溃（机器负载 30 以上，Chromium 内存不够），分批重跑后 76 个页面都有截图；其中浅色的"管理员、角色、权限树、审计日志、管线监控、告警、推送模板"七页的逐页检查数据来自上一轮同样的走查（截图是这轮的）。

发现的缺陷：

1. 已修：登录页边距、窄屏页头（上表）。
2. 记录项 1：**表格的操作列在 1440 宽度下在可见范围之外**。表格在容器里横向滚动（`overflow-x: auto`，能滚到），但操作列没有固定在右边，要先滚动才看得到按钮。我用 Chromium 量了表头最后一格（"操作"）的右边缘和表格容器右边缘的差：邮件模板 269 像素（`/email/templates`，模板说明那一列太宽，"状态"那列也被截）、广告单元 197（`/ads/units`）、告警 75（`/monitor/alerts`，"解决时间"被截）、短信模板 28（`/sms/templates`，"删除"只露一半）；`/ads/creatives` 刚好 0；投放账户与成本页（`/campaign/accounts`）是固定在右边的，正常。后果：运营找不到编辑、解决、删除按钮，要想到横向滚动。位置：各页面的操作列定义（如 `src/pages/sms/templates.tsx`、`src/pages/ads/units.tsx`、`src/pages/monitor/alerts.tsx`、`src/pages/email/templates.tsx`）；`src/pages/push/templates.tsx:148` 和投放账户页已经用 `fixed: 'right'`。建议全部修：操作列加 `fixed: 'right'`，各加一条测试读列定义（改页面外观，不是我这个范围的文件，没有改）。

## 三、问题文件里已过时的"暂定"（只改我方描述，没有替后端编内容）

先把"暂定"全部过一遍，只对能对着代码和后端文件核对的条目改，其他留着：

- 后端 2026-10-29 清单已回答的：推送第一节第 2、6、7 条（响应是 `{items, missingLocales}`、规则改为只要求默认语言、拒绝的 `data` 是 `{defaultLocale, reason}`）；短信第一节第 1 条（凭据现在是名称到值的映射）；投诉第 4 条（`status` 参数和 `OPEN`）；订阅第七节（Google 标价是十进制字符串）；通话详情多 `maxDurationMinutes`。
- 已被代码或负责人 2026-10-27 的决定取代的：系统文件里"对超级管理员那一行页面不改动"（现在整行对非超级管理员关闭）、角色勾选自定义节点（现在不能勾）、审计详情遮蔽（现在只遮文字值）；归因文件里"`ConfigRow` 会附后端 `message`"（已改正）；推送第六节"假后端的触发原因写错"（已改正）；短信里"共享文件本任务不改"一句。
- 与"错误码已知时只显示译文"不一致的说法：投诉目录第 6 条、订阅第八节、监控时间范围、记忆第四节，都改成现在的做法。

提交：`c2f7473`、`69317e9`、`ebaad9f`、`62ac944`、`8938752`、`0a3d9f3`（后几个是别的会话的提交带上了我的改动）。

## 四、新发现，按 CLAUDE.md 分类

- 记录项 2：`src/components/layout/ChangePasswordForm.tsx:53`：改密码被拒时，对 `INVALID_REQUEST` 把后端的 `message` 接在译文后面（`${text}: ${error.message}`）。触发：在改密码对话框里让后端返回 400 `INVALID_REQUEST`，看到英文句子拼在中文译文后面。与"错误码已知时只显示译文"不一致。前端自己已经按长度和"等于用户名"先检查，所以平时出现不了；建议全部修：去掉拼接，加一条中文界面下不含英文句子的测试。这是登录和会话区的文件，我没有改。
- 记录项 3：`src/pages/reportLoading.test.tsx` 里"价格按模型"的用例直接渲染 `<ModelsTab onlyUnpricedInitially={false} />`。成本区有未提交的改动（`src/pages/cost/ModelsTab.tsx` 新增必填的 `kept` 属性、`src/hooks/useKeptState.ts` 是未跟踪文件）；它提交的那一刻，这个用例的类型检查会报 `Property 'kept' is missing`（我试过：传 `kept={{ current: {} } as Kept}` 即可，但现在提交会让 `HEAD` 引用一个还不存在的模块，所以没有提交）。建议：成本区提交时同步改这一行。
- 没有立即修的项。别的会话在这期间新增的检查警告（`src/pages/subscriptions/entitlements.test.tsx:494` 的非空断言、`tests/umiStub.test.tsx` 等的组件定义在函数里）我看到过，到最后一次 `npx biome check .` 时已经被他们清掉，整个仓库 0 条诊断。

## 五、测试

先说负载：这台机器同时有二三十个 vitest 进程，平均负载 18 到 40，很多用例在并行整批里因为 `findBy`、`waitFor` 的等待超时而失败，和我的改动无关（只是 `!` 换成 `must()`、可选链、去掉没用的导入）。办法：对 `HEAD` 导出的干净拷贝（只含我的改动）单独跑，把测试超时放到 180 秒、并行数降到 2 到 3。

- 干净拷贝：`mock/ads.mock.test.ts`、`tests/must.test.ts`、广告的计划、广告位、单元、素材、报表测试、`src/pages/appVersions`、`src/pages/channels/channels.test.tsx`：整批并行时 19 个失败（全是超时），把计划、广告位、素材、报表四个文件在负载降下来后单独重跑：4 个文件 183 个用例全部成功。
- 工作区：`src/pages/user`（登录、绑定、改密码）、`src/components/layout`：149 个成功，1 个是我自己新测试里 `inset` 的写法在 happy-dom 里是 `0` 不是 `0px`（已改成接受两种），之后单独跑通过；`src/pages/user/AuthFrame.test.tsx`、`layout.test.tsx` 单独跑通过。
- 假后端、审计、记忆、推送效果、报表加载态、用户详情的受影响测试：负载高时整批跑有 10 个因等待超时失败（审计 7、记忆档位 1、用户详情页签 1、记忆模型 1），把审计、记忆、用户详情各自在降低并行数后重跑：审计 26 个、记忆加用户详情 128 个全部成功；`mock/avatar.mock.test.ts`、推送效果、`reportLoading.test.tsx` 在各自的提交前单独跑过成功。
- 没有跑全量测试和 `npm run build`（按约定留到最后）。

## 六、未运行

1. 问题文件里其余的"暂定"（`docs/contract-requests/` 里约 230 条，我核对并更新了约 20 条）没有逐条对照代码；剩下的要逐页读代码才能判断是否过时。
2. `docs/deploy.md` 的 nginx 示例没有重新用 nginx 验证，也没有重新做 `npm run build`，所以文档里的哈希文件名例子没有对着新的构建核对。
3. 用 support、finance、reviewer 登录的菜单和无权限页，这轮没有重新走（上轮走查已覆盖，`task-32-walkthrough.md` 第二节）；这轮只用 root 看了中文和两个主题。

浏览器进程：开发服务器是 `npm run dev:mock` 在草稿目录拷贝里启动（端口 8388），用完已按进程号（17974）停掉；Chromium 由脚本自己关。

## 七、给主会话的提示

- 共享暂存区会让 `git commit -- 路径` 把别的会话已暂存的文件带进去（`c2f7473`、`69317e9` 就是），也会让别的会话的提交带上我在同一个文件里的未提交改动（计划、README、几个问题文件）。我没有回退任何别人的内容。
- `tests/must.ts` 是新增的共用测试小工具；别的测试文件里想去掉非空断言可以直接用。
