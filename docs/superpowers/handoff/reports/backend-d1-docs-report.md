立即修未修 0、记录项 1、未运行 3、阻塞 0

# 后端第一批交付：文档区域（docs）报告

范围：任务 1 到 4（计划、变更请求、第 4 节核对、部署文档）。任务 5（汇总各区域报告）等主会话通知后再做；第 4 节第 1 条（页面现在都有代码，哪些文件已按清单改）要等其他区域提交后补。这两项和"没有用真实后端和证书验证 nginx"算作未运行 3 项（见最后一节）。

本区域没有写业务代码，也没有改 `docs/shared-snapshots/` 和 `docs/backend-inputs/`。

## 1. 并入计划（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`）

计划只写依赖顺序，没有加阶段或里程碑，没有加计划外的功能；每一条是对应任务的接口、测试或界面文字。已知错误码时界面只显示按码翻译的文字、不附后端 `message`（负责人已定）写进了"错误文字"一行（第 32 行），清单 a1 写的"展示后端 message"据此改成"按页面自己知道的操作加后端结构化字段显示"。

清单第 5.1 节第 1 条的任务对应，我逐个对照了计划里的任务正文，全部成立（没有找到应当归别的任务的行）。下面是每行落在计划的哪里（行号是修改后的计划文件）：

| 清单行 | 计划位置 | 内容 |
|---|---|---|
| a1 | 任务 31，第 898 行；任务 3，第 253 行 | 五类 403 `ADMIN_FORBIDDEN` 授予规则；前端不复刻、不预先禁用；按提交的操作显示原因文字；假后端实现五类检查 |
| a2 | 任务 7，第 363 行 | 登录时密钥解不开答 `ADMIN_TOTP_INVALID`，提示补"联系超级管理员重置二次验证" |
| a3 | 任务 7，第 366 行 | 绑定时解不开答 `ADMIN_INVALID_TOKEN`，`enrollToken` 作废、回登录页，不显示"验证码错误" |
| a4 | 任务 10，第 471 行、第 473 行 | `data.missingLanguages`；语言文件先发布、再加语言 |
| a5 | 任务 22，第 729 行；任务 10，第 471 行 | `{defaultLocale, reason}`；`push.default_locale` 的 `data.defaultLocale`、`data.reasons`；三种情形不读 `message`，用一条通用做法文字 |
| a6 | 任务 28，第 846 行；任务 10，第 471 行 | `ref` 是 `SmsTemplate` 时文字显示在提交的那一行 |
| a7 | 任务 19，第 685 行 | 详情抽屉显示 `maxDurationMinutes` |
| a8 | 任务 10，第 472 行；任务 26，第 813 行 | 两个币种键互为关系键、两行都显示错误；确认批次时币种在允许列表里，检查顺序 |
| a9 | 任务 10，第 472 行；任务 25，第 790 行 | 成本币种锁、操作顺序、不承诺事务 |
| a10 | 任务 20，第 699 行 | 429 无 `data` 无 `Retry-After`：不显示倒计时、不自动重试、已保存漏斗选择后的自动查询不循环 |
| a11 | 任务 14，第 587 行 | 状态筛选"未结案"发 `OPEN`；`open`、逗号、空白是 400 |
| a12 | 任务 11，第 517 行 | 标价十进制字符串、不经浮点；`null` 显示"—" |
| a13 | 任务 15，第 607 行 | 形近字折叠说明（`SUBSTRING`、`WORD`，`REGEX` 不折叠）和已知副作用 |
| a14 | 任务 22，第 728 行 | `missingLocales`：信息格子"回退到默认语言"，不标红，所有列都缺时标"没有启用的模板" |
| b1 | 任务 13，第 549 行 | `SUPPORT_FORWARD_FAILED`，重试自动关闭 |
| b2 | 任务 13，第 550 行；任务 25，第 791 行 | 两个固定 `detail`；更正（后来的原因替换 `detail`）；重新填写令牌或像素编号关闭告警 |
| c1 | 任务 28，第 850 行、第 851 行 | 第六个模板 `LOGIN_METHOD_ADDED`，占位符、必含项、中文用途说明；NUL 400 |
| e1 | 任务 22，第 729 行 | 规则、运营怎么用写成页面顶部文字；前端不复刻 |
| e2 | 任务 28，第 846 行 | 合格模板定义（`en` 不分大小写、国家为空）、守卫条件、先判旧守卫 |
| e3 | 任务 10，第 473 行 | 顺序：文件随版本发布 → 加语言 |
| e4 | 任务 25，第 790 行 | 同 a9 |
| e5 | 任务 10，第 472 行 | 同 a8 |
| e6 | 任务 7，第 369 行 | 前端做法不变，不加轮询 |
| W2a 短信渠道凭据 | 任务 28，第 845 行 | 请求体任何时候不出现 `null` 凭据值 |
| W2a 告警筛选 | 任务 13，第 548 行 | "全部"不带参数，空字符串不发 |
| W2a 审计日志长度 | 任务 31，第 902 行 | 64、64、255 |
| W2a 权限节点类型 | 任务 31，第 901 行 | 编辑时类型只读 |
| W2a 邮件模板 NUL | 任务 28，第 851 行 | 假后端 400，不另写前端检查 |
| GROUP A 第 18 种告警 | 任务 13，第 544 行、第 551 行 | `STAT_RELAND_FAILED`，18 种常量表 |
| GROUP A 封禁 | 任务 16，第 627 行；任务 19，第 685 行 | 确认文字、`BANNED` 结束原因 |
| GROUP A 推送任务 | 任务 22，第 732 行 | `CANCELLED` 加 `MISSED` |
| GROUP A 上传无长度 | 任务 3，第 252 行 | 前端不受影响，不写界面文字 |
| GROUP A 仅客户端 | 不并入 | 手机端普通 403 页面改为 `FORBIDDEN`，不是管理端接口 |
| GROUP B 设置范围 | 任务 10，第 470 行；任务 22 | `chat.moderation_deadline_ms` 100 到 2500、`recall.*` 1 到 1440、`push.schedule_catchup_minutes` 1 到 10080 加关系规则、两个字段都写提示 |
| GROUP B 记忆截断 | 任务 13，第 543 行、第 552 行 | `truncated`、`totalCount` |
| GROUP B 投放效果范围错误 | 任务 25，第 792 行 | 新的 `ref` 和原因 |

另外并入的有：
- 清单 (d)（d1–d18 和 7 个早期额外键，共 25 个）：不在你交代的行里，但 GROUP B 改了其中的范围，且计划任务 10 原来的"键清单只从契约 17.5 生成"会让这些键落到"未识别的配置项"。所以在任务 10 加了 `CONFIG_PRE_ADOPTION_KEYS`、25 个键的类型、范围、编辑权限、检查脚本的额外检查，并把任务 15、22、25 里"该码的 N 个键"的数字改成"契约表 N 个加额外键"（`MODERATION:CONFIG` 11、`PUSH:CONFIG` 13、`ATTRIBUTION:MANAGE` 12）；关键设计点里两行同步（第 54、55 行）。d11–d13 的 IP 为空显示"—"写在任务 20（第 698 行）和任务 25（第 787 行）。
- 关键设计点第 37 行：原来写"五个邮件模板、14 种告警规格已按契约改好"，改成"后端现在是六个模板和 18 种告警，规格和契约还没改，计划先按后端的现状做"，指向两份变更请求。
- 任务 32 步骤 4、5：加变更请求的位置和 `/api/` 不加安全头的验证（见第 4 节）。

## 2. 变更请求（`docs/contract-requests/` 新文件，名称带 2026-10-31）

| 文件 | 内容 |
|---|---|
| `2026-10-31-design-doc-changes-from-backend-d1.md` | 清单 5.2 那份"给改设计文档的人"，加上 2026-10-31 追加的三节，共 16 条（每条：位置和现在的文字、改成什么、行为、检查顺序、错误、测试），含第 12 节验收清单的新增和扩展行（逐行写明哪些是扩、哪些是新增）；最后列"疑似后端内部机制、没有抄进去的句子"7 条和"待后端确认的点"5 条 |
| `2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md` | 17.4 告警类型 14 → 18（四种新类型的 `refType`、`refId`、`accountId`、`detail`、打开、自动解决、手动解决）、`GET /alerts` 参数校验、重试联动；17.5 补 25 个键（7 个早期键、d1–d9、d10–d18）的默认值、范围、编辑权限、说明，改 3 个键的范围（GROUP B）和 `push.schedule_catchup_minutes` 与 `push.task_poll_seconds` 的保存规则，补保存失败的新 `data` 字段表，预告 `moderation.model_check_enabled`；17.4 其他行变化的对照表 |
| `2026-10-31-backend-question-static-files-and-security-headers.md` | 第 4 节第 10 条：静态文件会不会由后端 admin 应用提供；安全响应头具体是哪六个、加在哪些响应上；后端有没有给 `/api/admin/**` 设 `Cache-Control` |

清单没有给出的内容，变更请求里都明写"清单没有给出"，没有替后端编：`SUBSCRIPTION_EVENT_FAILED` 的各列、各保存规则的检查顺序、四类授予规则各路由的检查顺序、审计日志长度的计数单位、已发出一部分的推送任务在停机后显示什么。设计文档请求里没有写后端实现细节。

## 3. 第 4 节"没有核实的"10 条

以下核对的是本仓库已提交的状态（HEAD `d095202`）和此刻工作区里别的区域尚未提交的改动，两者不同时分别写明。

1. **页面有没有代码：** 待补（其他区域提交后补）。已知：HEAD 的 `src/pages` 下有 `activity`、`ads`、`analytics`、`appVersions`、`avatar`、`campaign`、`channels`、`clientConfig`、`companionship`、`complaints`、`config`、`cost`、`credits`、`dashboard`、`email`、`invite`、`memory`、`moderation`、`monitor`、`notifications`、`push`、`sessions`、`sms`、`stat`、`subscriptions`、`support`、`system`、`user`、`users` 等目录；清单写"只有登录页"已过时。
2. **设置页怎么建：** 成立，且清单预言的后果在 HEAD 上确实发生。`src/pages/config/configSchema.ts` 手写 schema，`configKeys.generated.json` 从契约生成（现在契约快照表有 225 行，计划写的 224 是规划时的数）；`scripts/check-config-keys.ts`（HEAD 版）只比较契约表、生成文件、schema 三者，已不是占位文件；`ConfigForm.tsx`（HEAD 第 98–140 行）对不在 schema 里的键显示"存在未识别的配置项"并只读。验证：HEAD 的 `configSchema.ts` 对 `export.parallelism`、`analytics.funnel_max_concurrency` 的 `grep -c` 为 0，即后端已返回的 25 个键在 HEAD 上都会落到"未识别"。此刻工作区里配置区域在修（`npm run check:config-keys` 现在输出 `backend extra keys: 25, schema: 250`，是它的未提交改动，不是我的）。
3. **任务对应：** 逐个读了计划任务 7、10、11、13、14、15、19、20、22、25、26、28、31 的正文，清单 5.1 的对应全部成立；补充：a5 的 `push.default_locale` 和 a6 的 `auth.phone_login_enabled` 同时落在任务 10（共用的设置表单）；封禁文字（GROUP A）在任务 16；403 和上传的备注在任务 3；任务 20、25 各多一条 IP 为空。
4. **Google 标价在统计页显示不显示：** 显示，HEAD 就有。`src/pages/subscriptions/stats.tsx` 第 168–170 行有"标价"列（语言键 `subscriptions.stats.listPrice`），读 `listPriceAmount`、`listPriceCurrency`（`src/services/subscriptions/types.ts` 第 151–152 行，HEAD 类型是 `number | string | null`）。**发现一个缺陷：** HEAD 的 `formatListPrice` 把金额用 `Number(amount)` 转成浮点再用 `Intl.NumberFormat` 格式化（HEAD 版第 15–29 行），清单 a12 要求十进制字符串不经浮点；`"12345678.1234567890"` 会丢精度，币种格式默认两位小数会把 `"24.999"` 四舍五入。分类：立即修（金额显示错误）。归订阅区域处理：此刻工作区里它已经改成字符串路径（未提交），所以不计入我的未修数；请主会话在汇总时确认该区域提交了带测试的修复。
5. **`/me` 的 `permissions` 是否等于"持有的权限码"：** 本仓库核实不了后端；能核实的是前端没有依赖它：HEAD 的 `PermissionTreeSelect.tsx` 的属性只有 `nodes`、`value`、`onChange`、`disabled`，没有"操作者持有"的输入，所以前端没有按操作者的权限预先禁用树节点；403 由后端裁决，前端按操作显示原因。契约快照第 2261 行和后端第一份回复第 41 行只说 `permissions` 是权限码数组，没有说是并集。结论：不影响前端，未核实后端。
6. **`SUBSCRIPTION_EVENT_FAILED` 的细节：** 仓库里没有。`grep -rn SUBSCRIPTION_EVENT_FAILED src mock` 在 HEAD 为 0；契约快照和设计快照里也没有。计划只给类型名称，`detail` 和关联对象原样显示（任务 13 第 544 行）；契约变更请求里该类型的各列写"清单没有给出"，请后端补。
7. **契约、设计文档会不会收到写进 17.4 的请求：** 快照里没有（`POSTBACK_CREDENTIAL_FAILED`、`SUPPORT_FORWARD_FAILED`、`STAT_RELAND_FAILED`、`SUBSCRIPTION_EVENT_FAILED` 在两份快照里都是 0 次；契约列 14 种，设计第 342 行列 14 种），`docs/backend-inputs/` 里也没有这样的请求。所以我写了契约变更请求（第 2 节第二个文件）。
8. **设计文档第 12 节验收清单的现有内容：** 逐行读完。有行的：登录、令牌过期、漏斗、系统配置、管理员、活动管理、成本、投放管理、短信管理、额度、渠道包、应用版本、站内通知、客户端配置、形象与装扮、投诉、投诉处理；**没有行的：邮件模板（与清单一致）、告警、推送模板、通话详情、订阅统计、文本规则**（清单只说了邮件）。变更请求第 16 条据此分成"扩"和"新增"。
9. **后端运行行为：** 本仓库核实不了。能说的是：假后端（`mock/`）和计划里的测试都是按清单写的，没有对着真后端跑过；前端因此依赖的后端行为有：错误码和 `data` 字段名（`missingLanguages`、`defaultLocale`、`reasons`、`details[].ref` 的取值）、`GET /config` 返回 25 个额外键、各规则的检查顺序。真后端上线后要对一遍。
10. **静态文件是否可能由后端 admin 应用提供：** 本仓库核实不了，已写成给后端的问题文件 `docs/contract-requests/2026-10-31-backend-question-static-files-and-security-headers.md`；`docs/deploy.md` 先写明"静态文件由反向代理提供，不要由后端的 admin 应用提供"，等答复。

## 4. 部署文档（`docs/deploy.md`）：`/api/` 的安全头，以及实测中发现的另外三个问题

方法：在本机装了 nginx 1.24.0，从 `docs/deploy.md` 取出示例配置，换成本机路径和端口，起一个固定返回 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Content-Security-Policy: default-src 'none'` 的假后端，用 `nginx -t` 和 `curl -i` 逐个地址看响应头（脚本和配置在草稿目录，不进仓库）。

结果：

- **清单 item-06 的问题（`/api/` 会不会重复安全头）：** 原示例里 `/api/` 有自己的 `add_header Cache-Control`，所以不继承 `server` 一级的三个头，`/api/admin/me` 的响应里 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 各一次（来自假后端）。证实了你说的"location 里的 add_header 覆盖 server 级别的"。同时验证了反面：把 `/api/` 里那一行去掉，这三个头各出现两次。所以这个不重复依赖于 `/api/` 里恰好有一条 `add_header`，很脆弱。**改法：** `server` 一级不放任何 `add_header`，每个 location 自己写需要的头；`/api/` 里只留 `Cache-Control`，文档里写明原因和"后端自己加了安全头"，并在"发布后的检查"里加用 `curl -i` 看 `/api/` 响应每个安全头和 `Cache-Control` 只出现一次。
- **立即修 1（已修）：示例配置过不了 `nginx -t`。** 带内容哈希的 location 的正则 `~* \.[0-9a-f]{8}\.…$` 含花括号，没有加引号，nginx 报 `unknown directive "8}\.(?:[a-z]+\.)?(?:js|css)$"`。文档原来写"没有在 nginx 里实际运行验证过"。已给正则加引号，`nginx -t` 通过。
- **立即修 2（已修）：入口页没有 `X-Frame-Options`。** 原示例把 `X-Frame-Options "DENY"` 只写在 `server` 一级，`/`、`/index.html` 都有自己的 `add_header`，所以不继承；实测 `/` 的响应没有这个头（`/api/` 响应里的是后端的）。已在 `/`、`/index.html` 里加上。
- **立即修 3（已修）：内容安全策略的示例放错位置也不生效。** 文档没说这条 `add_header` 写在哪；实测写在 `server` 一级时 `/` 的响应里没有 `Content-Security-Policy`（同一原因）。已写明放在 `location = /index.html` 和 `location /` 里，不放 `server` 一级，不放 `/api/`；实测放对位置后 `/`、`/index.html`、`/users/42` 都有。
- **立即修 4（已修）：带哈希的脚本的 404 带一年缓存。** 原示例 `Cache-Control "public, max-age=31536000, immutable" always`，找不到的哈希文件返回 404 时也带这个头，发布中途（新入口已换、新文件还没传完）会被浏览器记住 404。已去掉 `always`（实测 404 不再带该头，200 仍带）。
- `/logo.svg` 一类静态文件的 location 补了 `nosniff` 和 `Referrer-Policy`。
- 文档里"没有在 nginx 里实际运行验证过"改成"语法和响应头已在 nginx 1.24 上验证；没有验证的是证书、HTTP/2 和真实后端"。

用修改后的 `docs/deploy.md` 示例（含放在 location 里的内容安全策略）重新提取配置，`nginx -t` 通过，响应头与上面一致：`/api/admin/me` 只有后端的四个头加 `Cache-Control: no-store`；`/`、`/index.html`、`/users/42` 有 `nosniff`、`X-Frame-Options`、`Referrer-Policy`、`Cache-Control: no-cache`（和内容安全策略）；哈希脚本 200 带长缓存，404 不带；深层地址回退到 `index.html`。测试结束后 nginx 和假后端进程都已停掉。

## 5. 记录项（1）

1. 计划里有几处写的是"原样展示后端文字 / `message`"，与负责人"已知错误码只显示按码翻译的文字"的规则不一致：任务 13 第 554 行（`MEMORY_MODEL_CONFLICT` 原样展示 `detail`）、任务 14 第 584 行（名字必填后端 400 原样展示）、任务 22 第 730 行（后端错误原样展示）、任务 28 第 845、847、849 行（渠道、模板、邮件的 `INVALID_REQUEST`）、任务 31 第 899 行（后端 403 / 409 原样展示）。这些是我这次修改之前就有的文字，对应的页面已经实现；我没有改它们，因为改之前要先对照代码，看页面是否已按规则做。触发：在这些页面让后端返回对应错误，看是否出现英文原句。建议全部按规则改写并以页面测试为准。

## 6. 未运行（3）

1. 第 4 节第 1 条（页面现在都有代码，哪些文件已按清单改）：等其他区域提交后补。
2. 任务 5（汇总各区域报告 `backend-d1-*-report.md`）：等主会话通知。
3. nginx 示例没有用真实的后端、TLS 证书和 HTTP/2 验证，也没有在预发环境走过深层地址刷新、导出、上传。

## 7. 对主会话的提示

- 变更请求第 8.1 条和计划任务 22 引用了"需要结构化字段才能区分三种召回模板被拒情形"的问题文件，该文件由推送区域写；汇总时请确认它存在并把计划里"见问题文件"改成具体文件名。
- 订阅区域的 `formatListPrice` 缺陷见第 3 节第 4 条。
- 计划任务 31 里 a1 的五类文字是页面按提交的操作选择的，系统管理区域的实现如果用了别的分法，汇总时以代码为准改计划。
