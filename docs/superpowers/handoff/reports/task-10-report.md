# 任务 10 报告：配置键 schema、配置表单、系统配置页、养成管理页

立即修未修 0、记录项 6、未运行 3、阻塞 0。

提交：`376d1df`（实现）、`105deaa`（评审后的修复）。环境：Node 24.22.1。一次独立评审（28 个变异、Chromium 探针，225 个键的类型和范围全部对照契约）。

## 做了什么

- 键清单：契约 §17.5 的表现在是 **225 行**（计划写的是 224）。`npm run gen:config-keys -- <契约路径>` 生成 `src/pages/config/configKeys.generated.json`（键加编辑权限）和 `mock/_core/configDefaults.generated.json`（假后端报告的默认值）；`npm run check:config-keys -- <契约路径>` 对比契约、生成文件和 `CONFIG_SCHEMA` 的键与编辑权限（三者一致才通过，评审者改掉契约一行后脚本正确报错）。
- `CONFIG_SCHEMA`：每个键一项（类型 `int`/`number`/`string`/`bool`/`json`/`url`、编辑权限、分组、范围、风险标志）；不存默认值（默认值只以 `GET /config` 的 `defaultValue` 为准）；161 个键是 `CONFIG:MANAGE`，其余 64 个属于 10 个模块权限，`CONFIG_HOSTS` 给出各自的承载页面；JSON 键有校验（阶段阈值、里程碑天数、支持语言、国家码、会话语言）。
- `ConfigForm`：按前缀分组；只显示服务器返回的键；每行显示标签、说明、当前值、默认值、"已修改"、更新时间和更新人；保存一次一个键；"恢复默认"只对已修改的行可用且行内确认；后端 `INVALID_REQUEST` 的 `details` 按 `ref` 对到行；响应的 `warnings` 用警告样式显示；六个风险键各有风险文字；`moderation.text_rules` 只读并链接到规则编辑页；`upload.public_base_url` 未配置时写明"广告素材和 APK 上传需要它"；服务器返回而 schema 里没有的键在顶部警告并只读显示。
- 页面：系统配置 `/config`（`CONFIG:MANAGE`）、养成管理 `/companionship`（`COMPANIONSHIP:CONFIG`，一张表单读写阶段阈值、里程碑天数和文字互动间隔，前端校验：阈值整数且 `BONDING` 小于 `CLOSE`，里程碑天数为 1 到 20 个不重复的正整数；写明"改阈值只影响之后的计算，不迁移数据"）。
- `src/locales/{zh-CN,en-US}/config.ts`：225 个键的标签和说明（各 520 条，占位符一致，en-US 无中日韩字符），48 个分组名，6 条风险文字。
- 假后端 `mock/config.mock.ts`：`GET /config` 按键名升序且只含该管理员有权编辑的键（不是 403）；`PUT`/`DELETE` 缺编辑权限 403、键不存在 404；整数键越界 400 且 `details` 是 `[{ref: 键, reason: 'OUT_OF_RANGE'}]`；关系约束（`retry.*`、语音时长、审核分数严格小于、导出超时严格大于租约、`events.ttl_days` 至少比 `stats.land_window_days` 多 30 天、访问令牌不长于刷新令牌）；`DELETE` 回到默认值；`PHONE_LOGIN_DISABLED_ACCOUNTS` 警告带 `count`。
- 辅助：`tests/mockBackend.ts` 让页面测试直接对着假后端的处理函数（`signInAs` 加 `useMockBackend`），后面的模块任务都用它。

## 红到绿

先写测试再实现。相关测试约 290 个通过；`tsc`、`biome` 通过；`check:config-keys` 三者一致。

## 评审与修复

评审者的结论：立即修 3、记录 12、不是缺陷 8。键清单、编辑权限、类型和范围对照契约没有差错；locales 里各约 56 个键对照契约说明列没有写错意思或编造。

立即修 3 条，**全部已修并有测试**：
1. 中文界面里 `moderation.text_rules` 的只读行是病句"请在里编辑/moderation/rules"。已修：句子改成"请在这个页面里编辑：{页面}"，链接在句子里（用 `FormattedMessage`）。
2. 没有值也没有默认值的 JSON 键（如 `memory.tei_allowed_hosts`）一打开就显示红色"JSON 格式不对"。已修（没有值的键允许空）。
3. 假后端 `moderation.review_score` 等于 `block_score` 时返回 200（契约要求严格小于）。已修，并补了 `export.job_timeout_minutes` 严格大于租约、`events.ttl_days` 与 `stats.land_window_days` 的关系、`generation.max_attempts` 1 到 10。

记录项里一并修的：未识别的键现在只读显示（带值，无编辑器）；三个广告和短信警告码补了中英文文字，假后端的码名改成契约的 `AD_SKIP_AFTER_TOO_LONG`；养成管理页保存失败不再丢掉输入，里程碑天数输入非整数时保留原文并拒绝（不再显示 NaN，0 和负数报范围错误）；去掉已弃用的 `addonBefore`；`moderation.text_rules` 的默认值是 `[]`；默认值生成不再带入第三方服务的主机名。

## 仍然记录的 6 项（建议全部修）

1. 假后端对契约还有几条校验没做：`invite.reward_start_at` 早于 `reward_end_at`、`app.display_name` 的 1 到 100 个字符、`auth.phone_login_enabled=true` 的前置条件、`SMS_COUNTRY_UNCOVERED` 警告的触发。模块页面在假后端上见不到这些 400 和警告。
2. 前端 schema 缺契约说明列里写了范围的几个键：`moderation.face_min_det_score`（0.1 到 1）、`generation.mouth_open_min_area`、`generation.mouth_open_min_brightness`（0 到 255）、`app.display_name`、`invite.reward_trigger`（只有 `REGISTER` 和 `FIRST_CALL`，现在是自由文本）。只有后端会拒绝，页面显示后端的错误，不会写错数据。
3. 约 25 个键的说明文字（契约说明列为空或只有"提议"的，如 `admin.jwt_ttl_hours`、`events.max_batch`、`recall.*`、`export.min_interval_hours`）是按键名推的，写得保守；`moderation.block_score`/`review_score` 的"达到这个值就拦截/复核"和 `complaint.likeness_due_hours` 风险文字里的"改大会让逾期投诉更晚被发现"超出契约原文。需要负责人或后端核一遍。
4. 测试缺口：`ConfigRow` 里多条 `details` 按 `ref` 对到行（改成取第一条）测试不变红。
5. `config.jsonInvalid` 这个文字键没有组件使用（`ConfigRow` 用的是 `pages.json.invalid`）。
6. `usage_price.source_url` 在假后端里没有默认值（契约的默认值是第三方服务的地址，没有写进仓库）；页面显示"未配置"，真后端会给出默认地址。

## 未运行（3）

- 只持有 `COMPANIONSHIP:CONFIG` 的管理员在真实浏览器里的表现（假后端没有这样的预置账号，只有 Vitest 里伪造的管理员覆盖）。
- 真后端。
- 全量测试和构建。

## 不是缺陷

schema 比计划多了 `number` 一种类型（给审核分数、嘴部检查阈值、人脸检测分数）；`CONFIG_HOSTS` 是 `Partial<Record<…>>`，测试两个方向都断言了，等价；契约规定的六个风险键都带风险标志，没有其他键带。
