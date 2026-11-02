改了 6 处、没做 1 处、没运行 3 项、阻塞 0

组 a1，负责编号 10、16、22、44、87、88。分支 claude/jolly-dirac-4pq9g6，不推送。

| 编号 | 答案要求前端改什么 | 状态 | 提交与位置 |
|---|---|---|---|
| 10 | 第 5 次错误码仍是 401 ADMIN_TOTP_INVALID，从第 6 次起密码正确才是 429；密码错误仍是 401 ADMIN_INVALID_CREDENTIALS；绑定超次数是 401 ADMIN_INVALID_TOKEN 回登录第一步；429 区分有无 data.retryAfterSeconds | 已改。假后端按后端行为重写，页面的 429 分钟数和通用文字本来就一致（原有测试保留）。另按负责人授权做了新增行为：第 5 次错误后显示"再输错一次将被暂时锁定" | 87aa3e0。mock/auth.mock.ts 第 33 行起（rejectLocked、wrongCode）、第 84 行（锁检查在密码之后）、第 109 行（绑定步骤不答 429）；src/pages/user/login/index.tsx 第 20 行（次数常量）、第 89 行；两种语言的 auth.login.totpInvalidLast；测试 mock/auth.mock.test.ts、login.test.tsx、enroll.test.tsx（都走假后端） |
| 16 | docs/deploy.md 里 /api/ 的 Cache-Control: no-store 删掉或改成替换；README 相应说明 | 已改（删掉那一行，文字里写明要由 nginx 保证时必须先 proxy_hide_header 再 add_header） | README 在 e61616a。docs/deploy.md 的改动被别的代理的提交 78237b1 一起带进去了（那个提交的路径里含 docs/deploy.md），内容是我的：第 121 行起的一条和 /api/ location 里去掉 add_header。用本机 nginx 加假后端实测：文档配置下响应只有 1 个 Cache-Control，把那行加回去得到 2 个 |
| 22 | 针对自己和最后一个超管都是 409 INVALID_STATE（不是 403）；页面按是不是自己那一行分两句固定话 | 已改 | dff9dc4。mock/system.mock.ts 第 72 行（invalidState）、第 228 行（更新）、第 272 行（状态）及删除；src/pages/system/texts.ts 第 33、55 行；admins.tsx 把 own 传给 protectedFailureText；system.admins.refusedOwnHint、refusedOtherHint；403 的 forbiddenHint 去掉"是你自己的账号" |
| 44 | PUT /admins/{id} 总是发 username 和完整当前 roleIds，只有 superAdmin 可省，自己那一行也发 | 已改 | dff9dc4。src/services/system/index.ts 第 90、104 行（adminPatchBody、updateAdmin）；AdminFormModal.tsx 第 90、95 行（行读不全就不能保存）；假后端缺 username 或 roleIds 答 400 EMPTY_NOT_ALLOWED，同值不算改，自己改角色或标志答 409 |
| 87 | 码规则 [A-Za-z0-9_:#/.-]{1,128}；PUT 必须总带当前 parent；PUT 里 nameZh、nameEn 必填 | 已改。nameZh、nameEn 在 PUT 里本来就总是发且表单必填，只补了测试证据 | 6e99df7。permissionRules.ts 第 39 行（CODE_FORMAT）、第 18 行（buildPermissionPatch 总带 parent）；services/system/index.ts 第 163 行（内置节点发自己的 parent，根节点发 null）；mock/system.mock.ts 第 158、387、420 行；两种语言的 code.invalid、code.dots |
| 88 | 删内置节点是 400、ref 为 code；成环 400、ref 为 parent；改内置父节点 400 | 原本就一致，只补证据：假后端删内置节点已是 400 ref code（提交 2131e91），页面不提供删除并显示通用文字，页面已有成环 400 的测试。新增：假后端 PUT 缺 parent 当 null、只报第一个失败项，成环、不存在的父节点、内置改父节点都是单项 ref parent；另一个 code 是 ref code | 6e99df7。mock/system.mock.test.ts 的 permission tree 一节；页面既有测试 permissions.test.tsx（删除内置节点、成环） |
| 10 的一小项 | 假后端和页面不读 Retry-After 响应头 | 没做。Reply 没有响应头通道，页面也不读头，按分钟数显示已足够 | README 里写明 |

## 请负责人知道的事

- 契约 1.4 节没列管理员二次验证锁定的 429 带 retryAfterSeconds，后端代码带（还带 Retry-After 头）。我按后端行为开发，提交 9216cc8 曾按契约文字去掉，现已改回。请求写在 docs/contract-requests/2026-11-02-new-differences-a1.md 第 1 条。
- #87 里全是点号的码（. 和 ..）页面保留拒绝，比后端严：浏览器会把它们当目录，之后的修改和删除请求会发到别的地址。负责人已同意。写在 new-differences-a1.md 第 3 条。
- #87"坑 1"：码里带 / 的节点，PUT 和 DELETE 在真实后端上很可能调不通（后端自己的推断，未验证）。页面和假后端未做特殊处理。写在 new-differences-a1.md 第 2 条。
- #44 的限制：整条 PUT 必须带当前角色，列表读到的角色已过期时会覆盖别人刚做的变更，这是接口本身的限制，没有处理。
- #22：自己那一行的按钮在页面上是禁用的，所以"自己那一句"只在 texts.test.ts 单元测试；页面级测了"另一行的句子"和对话框里的 409。
- #10 的第 5 次提示按后端默认的 5 次计数，页面不知道配置的 admin.totp_max_failures，所以配置改过时提示可能不准；计数按页面内同一个用户名，换用户名或登录成功就清零。
- 别的代理的提交 3efb4a7 用路径提交时把 src/locales/zh-CN/auth.ts 和 zh-CN/system.ts 里我的改动一起带走了，所以这两个文件没有我自己的提交；内容已在 HEAD。

## 变异检查（每条规则）

在仓库副本里做（不改共享工作区），每条变异都有测试失败：
- 44：不发 username；roleIds 只在改变时发；自己那行发 superAdmin；自己那行发新角色；假后端 roleIds 可省。
- 22：提示不区分自己；假后端自己的状态仍答 403。
- 87：patch 不带 parent；服务对内置节点不发 parent；码字符集放宽；码长度改 100；假后端缺 parent 当不改。
- 88：假后端内置节点可改父；成环 ref 写错；删除内置节点改回 409。
- 10：第 5 次就答 429（5 个测试失败）；锁检查放在密码之前（2 个）；去掉 retryAfterSeconds（6 个）；绑定步骤答 429（1 个）；提示阈值改成 4；换用户名不清零。绑定令牌在第 5 次不作废这一条是等价变异（锁生效后同样作废），预期存活。
- 脚本 scratchpad/mut10.py 和 mut2.py 的前一段（10 的前四项）在共享工作区跑过，其间 mock/auth.mock.ts 被短暂改写，已恢复并核对与好版本一致。

## 运行结果

- 相关目录一次运行（src/pages/system、src/services/system、src/locales、mock/system、mock/auth、src/pages/user、src/session）：1491 通过、35 失败。其中 permissions 和 roles 的失败是机器负载高造成的超时，单独以 maxWorkers=1 重跑这两个文件 100 个全过。
- 没运行（3 项）：src/pages/system/auditDetail.test.ts 的线性计时用例、src/pages/users/list.test.tsx、src/pages/users/detailTabs.test.tsx 在高负载下失败，与本组改动无关（不在本组改动的文件范围内），没有复跑。全量测试和构建按规则没跑。
- tsc 对 src/pages/system、src/services/system、mock/system、mock/auth 无报错；biome check 对改动范围 0 诊断。
- 只覆盖了英文和中文的界面文字；码的字符集测试含泰语、阿拉伯语、越南语、西班牙语字符，用户名和角色名测试数据含泰语、阿拉伯语、印尼语等。
