const messages: Record<string, string> = {
  'menu.config.backend': '后端参数',
  'config.group.auth': '认证与令牌',
  'config.group.guest': '游客',
  'config.group.admin': '管理端',
  'config.group.ratelimit': '请求限流',
  'config.group.integrity': '设备校验',
  'config.group.internal': '内部调用',
  'config.group.email': '邮件',
  'config.group.abuse': '防滥用',
  'config.group.tokens': '令牌清理',
  'config.group.maintenance': '数据维护',
  'config.group.call': '通话告警',
  'config.group.persona': '人设',
  'config.group.chat': '文字对话',
  'config.group.upload': '文件上传',
  'config.group.voice': '语音',
  'config.group.generation': '形象生成',
  'config.group.avatar': '形象',
  'config.group.render': '渲染',
  'config.group.retry': '失败重试',
  'config.group.attribution': '归因',
  'config.group.events': '事件上报',
  'config.group.export': '数据导出',
  'config.group.recall': '召回推送',
  'config.group.app': '应用信息',
  'config.group.push': '推送',
  'config.group.invite': '邀请',
  'config.group.tasks': '任务',
  'config.group.companionship': '陪伴',
  'config.group.milestone': '纪念日',
  'config.group.moderation': '内容审核',
  'config.group.memory': '记忆',
  'config.group.complaint': '投诉',
  'config.group.support': '客服',
  'config.group.deletion': '账号删除',
  'config.group.pipeline_metrics': '流水线指标',
  'config.group.monitor': '监控',
  'config.group.usage': '用量',
  'config.group.entitlement': '权益',
  'config.group.credits': '额度',
  'config.group.usage_price': '用量价格',
  'config.group.subscription': '订阅',
  'config.group.session': '通话会话',
  'config.group.stats': '统计',
  'config.group.analytics': '分析',
  'config.group.ads': '广告',
  'config.group.sms': '短信',
  'config.group.appversion': '应用版本',
  'config.group.notification': '站内通知',
  'config.unknownGroup': '未识别的配置项（只读）',
  'config.unset': '未配置',
  'config.default': '默认值',
  'config.modified': '已修改',
  'config.updatedAt': '更新时间',
  'config.updatedBy': '更新人',
  'config.reset': '恢复默认',
  'config.resetConfirm': '恢复为默认值？',
  'config.save': '保存',
  'config.saved': '已保存',
  'config.unknownKeys': '存在未识别的配置项：{keys}',
  'config.editedElsewhere': '请在这个页面里编辑：{page}',
  'config.warning.AD_SKIP_AFTER_TOO_LONG':
    '跳过倒计时超过 5 秒，可能不符合商店对全屏广告可以关闭的要求',
  'config.warning.AD_FORCE_CLOSE_DISABLED':
    '强制关闭已设为 0（不启用），非激励广告没有兜底的关闭按钮',
  'config.warning.SMS_COUNTRY_UNCOVERED': '白名单里有国家没有启用的短信通道覆盖',
  'config.requiresUploadBase': '广告素材和 APK 上传需要它',
  'config.warning.PHONE_LOGIN_DISABLED_ACCOUNTS': '关闭手机号登录后，仍有 {count} 个手机号账号',
  'config.warning.UNKNOWN': '保存成功，但有提醒',
  'config.auth.access_ttl_minutes.label': '访问令牌有效期',
  'config.auth.access_ttl_minutes.desc':
    '登录后访问令牌的有效期，单位分钟，游客凭据也使用这个值。必须不大于刷新令牌有效期换算成的分钟数，否则保存失败。',
  'config.auth.refresh_ttl_days.label': '刷新令牌有效期',
  'config.auth.refresh_ttl_days.desc':
    '刷新令牌的有效期，单位天。按天换算成分钟后不得小于访问令牌有效期（向上取整），否则保存失败。',
  'config.auth.refresh_reuse_grace_seconds.label': '刷新令牌重放宽限',
  'config.auth.refresh_reuse_grace_seconds.desc':
    '刷新令牌轮换后允许重放的宽限时间，单位秒。宽限内重复使用旧令牌会返回与第一次相同的令牌对，不判为盗用。',
  'config.guest.call_minutes_total.label': '游客通话总额度',
  'config.guest.call_minutes_total.desc':
    '每台游客设备终身一次性的通话额度，单位分钟。没有代码默认值，数值由产品和运营决定；未配置按 0 处理，游客不能通话。只影响之后发放的设备，已有设备的额度不变。',
  'config.guest.call_minutes_total.risk':
    '未配置时游客不能通话。重装应用可以重置游客额度，所以要设得很小。',
  'config.auth.reset_token_ttl_minutes.label': '密码重置令牌有效期',
  'config.auth.reset_token_ttl_minutes.desc': '密码重置链接里令牌的有效期，单位分钟。',
  'config.admin.jwt_ttl_hours.label': '管理员登录有效期',
  'config.admin.jwt_ttl_hours.desc': '管理员登录凭据的有效期，单位小时，到期需要重新登录。',
  'config.admin.rate_limit_per_min.label': '管理端每分钟请求上限',
  'config.admin.rate_limit_per_min.desc': '管理端接口每分钟允许的请求数，超出后请求被限流。',
  'config.ratelimit.guest_per_ip_per_hour.label': '游客登录每 IP 每小时上限',
  'config.ratelimit.guest_per_ip_per_hour.desc':
    '同一 IP 每小时最多创建几次游客凭据，超出后被限流。',
  'config.guest.session_retention_days.label': '游客会话保留天数',
  'config.guest.session_retention_days.desc': '游客会话记录保留多少天，到期后清理，单位天。',
  'config.integrity.check_enabled.label': '设备校验开关',
  'config.integrity.check_enabled.desc':
    '游客凭据和新建账号时是否校验设备。非生产环境可以关闭；生产环境保存为关闭会被拒绝。',
  'config.ratelimit.guest_per_device_per_hour.label': '游客登录每设备每小时上限',
  'config.ratelimit.guest_per_device_per_hour.desc':
    '同一设备每小时最多创建几次游客凭据，超出后被限流。',
  'config.ratelimit.register_per_ip_per_hour.label': '注册每 IP 每小时上限',
  'config.ratelimit.register_per_ip_per_hour.desc':
    '同一 IP 每小时最多发起几次注册，超出后被限流。',
  'config.ratelimit.email_otp_per_ip_per_hour.label': '邮箱验证码 IP 小时上限',
  'config.ratelimit.email_otp_per_ip_per_hour.desc':
    '同一 IP 每小时最多请求几次邮箱验证码，超出后被限流。',
  'config.ratelimit.reset_confirm_per_ip_per_hour.label': '重置确认每 IP 每小时上限',
  'config.ratelimit.reset_confirm_per_ip_per_hour.desc':
    '同一 IP 每小时最多提交几次密码重置确认，超出后被限流。',
  'config.ratelimit.deletion_confirm_per_ip_per_hour.label': '删除确认每 IP 每小时上限',
  'config.ratelimit.deletion_confirm_per_ip_per_hour.desc':
    '同一 IP 每小时最多提交几次账号删除确认，超出后被限流。',
  'config.ratelimit.api_per_account_per_min.label': '账号接口每分钟上限',
  'config.ratelimit.api_per_account_per_min.desc':
    '每个已登录账号每分钟允许的请求数，是所有已登录接口的兜底限制。',
  'config.internal.signature_window_seconds.label': '内部调用签名时间窗',
  'config.internal.signature_window_seconds.desc':
    '内部服务调用签名里时间戳允许的偏差窗口，单位秒，超出窗口的调用被拒绝。',
  'config.ratelimit.sensitive_per_account_per_hour.label': '敏感操作每账号每小时上限',
  'config.ratelimit.sensitive_per_account_per_hour.desc':
    '每个账号每小时最多执行几次敏感操作，超出后被限流。',
  'config.ratelimit.login_per_ip_per_hour.label': '登录每 IP 每小时上限',
  'config.ratelimit.login_per_ip_per_hour.desc':
    '同一 IP 每小时跨邮箱的登录请求总数，用来防止密码喷洒，超出后被限流。',
  'config.auth.login_max_failures_per_account.label': '登录失败次数上限',
  'config.auth.login_max_failures_per_account.desc':
    '一个账号在统计窗口内最多允许登录失败几次，达到后拒绝继续尝试。',
  'config.auth.login_failure_window_minutes.label': '登录失败统计窗口',
  'config.auth.login_failure_window_minutes.desc': '统计登录失败次数的时间窗口，单位分钟。',
  'config.auth.password_max_length.label': '密码最大长度',
  'config.auth.password_max_length.desc':
    '密码允许的最大长度，用来防止超长密码拖慢哈希。必须不小于 8，否则保存失败。',
  'config.auth.log_retention_days.label': '认证日志保留天数',
  'config.auth.log_retention_days.desc':
    '认证事件日志保留多少天，单位天。保留期记入每条记录，改配置只影响之后写入的记录。',
  'config.email.link_base_url.label': '邮件链接根地址',
  'config.email.link_base_url.desc':
    '邮件里链接的根地址，必须是 https、不带末尾斜杠，可以带路径前缀，例如 https://example.com/m。未配置时，需要链接的邮件（密码重置、删除确认）发不出去。链接只使用这个配置，不使用请求的 Host 头。',
  'config.abuse.audit_retention_days.label': '注册审计保留天数',
  'config.abuse.audit_retention_days.desc': '注册审计记录保留多少天，单位天。',
  'config.tokens.cleanup_grace_days.label': '令牌清理延后天数',
  'config.tokens.cleanup_grace_days.desc':
    '过期的刷新令牌、过期或已使用的重置令牌和删除确认令牌，在清理前多保留的天数。',
  'config.maintenance.done_job_retention_days.label': '已完成任务保留天数',
  'config.maintenance.done_job_retention_days.desc': '已完成的外部删除任务保留多少天，单位天。',
  'config.maintenance.resolved_alert_retention_days.label': '已解决告警保留天数',
  'config.maintenance.resolved_alert_retention_days.desc': '已解决的后台告警保留多少天，单位天。',
  'config.abuse.cluster_min_free_accounts.label': '多开聚类最少免费账号数',
  'config.abuse.cluster_min_free_accounts.desc':
    '多开检测默认只列出免费账号数不小于这个值的聚类，单位个。',
  'config.call.free_daily_alert_minutes.label': '免费通话每日告警分钟数',
  'config.call.free_daily_alert_minutes.desc':
    '当天免费通话（免费账号和游客）总分钟数达到这个值时写后台告警，只告警不拒绝通话。未配置则不告警。',
  'config.email.otp_ttl_seconds.label': '邮箱验证码有效期',
  'config.email.otp_ttl_seconds.desc': '邮箱验证码的有效期，单位秒。',
  'config.email.otp_resend_seconds.label': '邮箱验证码重发间隔',
  'config.email.otp_resend_seconds.desc': '同一邮箱两次发送验证码的最小间隔，单位秒。',
  'config.email.otp_max_attempts.label': '邮箱验证码最多错误次数',
  'config.email.otp_max_attempts.desc': '一个邮箱验证码最多允许输错几次，超过后该验证码作废。',
  'config.email.max_per_address_per_day.label': '邮箱每日发送上限',
  'config.email.max_per_address_per_day.desc': '同一邮箱在滚动 24 小时内最多发送几封邮件。',
  'config.ratelimit.login_per_min.label': '登录每分钟上限',
  'config.ratelimit.login_per_min.desc':
    '每分钟允许的登录请求数。邮箱登录按 IP 加邮箱计，手机号登录按 IP 加号码计，共用这个值。',
  'config.ratelimit.refresh_per_min.label': '令牌刷新每分钟上限',
  'config.ratelimit.refresh_per_min.desc': '每分钟允许的令牌刷新请求数，超出后被限流。',
  'config.ratelimit.reset_per_ip_per_hour.label': '密码重置每 IP 每小时上限',
  'config.ratelimit.reset_per_ip_per_hour.desc':
    '同一 IP 每小时最多发起几次密码重置，超出后被限流。',
  'config.ratelimit.push_token_per_ip_per_hour.label': '推送令牌登记 IP 小时上限',
  'config.ratelimit.push_token_per_ip_per_hour.desc':
    '同一 IP 每小时最多为游客登记几次推送令牌，超出后被限流。',
  'config.ratelimit.chat_per_account_per_min.label': '文字对话每账号每分钟上限',
  'config.ratelimit.chat_per_account_per_min.desc':
    '每个账号每分钟最多发起几次文字对话，只用来防脚本；成本上限靠文字额度控制。',
  'config.ratelimit.link_mail_per_email_per_hour.label': '带链接邮件每邮箱每小时上限',
  'config.ratelimit.link_mail_per_email_per_hour.desc':
    '同一邮箱每小时最多触发几封带链接的邮件（密码重置、网页删除确认）。超出时仍返回成功，但不发信。',
  'config.ratelimit.public_deletion_per_ip_per_hour.label': '公开删除请求 IP 小时上限',
  'config.ratelimit.public_deletion_per_ip_per_hour.desc':
    '同一 IP 每小时最多提交几次网页上的账号删除请求，超出后被限流。',
  'config.persona.max_length.label': '人设最大长度',
  'config.persona.max_length.desc': '数字人人设文字允许的最大长度，按 Unicode 码点计。',
  'config.chat.conversation_languages.label': '会话语言清单',
  'config.chat.conversation_languages.desc':
    '允许用户选择的会话语言，用语言代码的列表表示。列表必须包含 en（会话语言的回退值），否则保存失败。保存后客户端配置缓存同时失效。',
  'config.chat.conversation_languages.risk':
    '不能比 AvatarAgent 的识别服务和合成服务都会说的语言更长。往里加新语言之前，先确认这两个服务都支持，否则用户会得到一个静默说英语的数字人。',
  'config.upload.max_bytes.label': '上传文件大小上限',
  'config.upload.max_bytes.desc': '普通上传文件的大小上限，单位字节。',
  'config.voice.transcript_max_chars.label': '语音转写最大字数',
  'config.voice.transcript_max_chars.desc':
    '语音转写文字允许的最大字符数，必须在 1 到 1000 之间（合成服务只接受 1 到 1000 个字符）。保存后客户端配置缓存同时失效。',
  'config.generation.poll_interval_seconds.label': '生成结果轮询间隔',
  'config.generation.poll_interval_seconds.desc': '查询生成任务结果的轮询间隔，单位秒。',
  'config.generation.voice_timeout_seconds.label': '声音生成超时',
  'config.generation.voice_timeout_seconds.desc':
    '声音生成任务的最长等待时间，单位秒，超过后任务失败。',
  'config.generation.voice_min_seconds.label': '声音样本最短时长',
  'config.generation.voice_min_seconds.desc':
    '声音样本的最短时长，单位秒，必须与合成服务的限制一致。必须在 1 到 30 之间且不大于最长时长，否则保存失败。保存后客户端配置缓存同时失效。',
  'config.generation.voice_max_seconds.label': '声音样本最长时长',
  'config.generation.voice_max_seconds.desc':
    '声音样本的最长时长，单位秒。必须在 1 到 30 之间且不小于最短时长，否则保存失败。保存后客户端配置缓存同时失效。',
  'config.generation.avatar_timeout_minutes.label': '形象生成超时',
  'config.generation.avatar_timeout_minutes.desc':
    '形象、外观、外观重新准备、动作片段任务从提交起的最长等待时间，单位分钟。形象生成可能排队；等待复核的时间不计入。',
  'config.generation.max_attempts.label': '形象生成最多尝试次数',
  'config.generation.max_attempts.desc':
    '一次形象生成总共最多尝试几次（含第一次）。每次尝试做一次图像编辑，任何一项自动检查不合格都会作废这一次；用完仍不合格则任务失败。必须是 1 到 10 的整数，范围外的值会让每个生成任务提交失败。随提交请求传给形象生成服务。',
  'config.generation.reprepare_max_attempts.label': '外观资源包重试上限',
  'config.generation.reprepare_max_attempts.desc':
    '某个外观的某个格式版本的驱动资源包准备失败多少次后不再自动重试，并写告警。两次重试之间按重试起点和上限做指数退避。',
  'config.avatar.download_url_ttl_seconds.label': '形象下载地址有效期',
  'config.avatar.download_url_ttl_seconds.desc':
    '外观标准图、动作片段、驱动资源包和渲染模型的签名下载地址的有效期，单位秒。应当够慢速网络下载完，又不让地址长期有效。',
  'config.generation.mouth_open_min_area.label': '露齿检查最小面积',
  'config.generation.mouth_open_min_area.desc':
    '露齿检查：嘴唇内缘多边形面积除以两眼外眼角距离的平方，没有单位，与图片分辨率无关。建议值 0.035（半身构图实测）；换图像编辑模型、提示词或构图后要重测。必须是大于 0 的数字。它和最小亮度任一未配置时，不会向形象生成服务提交任务，上传形象、新建外观会失败。',
  'config.generation.mouth_open_min_brightness.label': '露齿检查最小亮度',
  'config.generation.mouth_open_min_brightness.desc':
    '露齿检查：嘴唇内缘范围内像素 RGB 三通道的平均亮度，取值 0 到 255。建议值 50；偏高会误挡肤色很深、暖光下明显露齿的图片。必须是 0 到 255 之间的数字。未配置时的后果同最小面积：不提交生成任务。',
  'config.generation.ai_label_enabled.label': 'AI 生成标记',
  'config.generation.ai_label_enabled.desc':
    '生成的标准图和动作片段是否写入机器可读的 AI 生成标记。具体合规要求还需核实。',
  'config.avatar.realistic_enabled.label': '允许写实风格',
  'config.avatar.realistic_enabled.desc':
    '是否允许上传写实（REALISTIC）风格的形象。关闭后上传写实风格会被拒绝，上传选项里也不再出现它。',
  'config.avatar.declaration_required.label': '必须勾选上传声明',
  'config.avatar.declaration_required.desc':
    '上传形象时是否必须勾选声明。关闭后客户端不显示声明，也可以不传声明版本。',
  'config.avatar.source_photo_retention_days.label': '原照保留天数',
  'config.avatar.source_photo_retention_days.desc':
    '形象原照保留多少天，单位天。0 表示随形象的生命周期保留。大于 0 时从形象生成成功起算，到期由每天一次的清理任务删除原照。代价：之后换装只能从当前外观的标准图出发；收到照片里的人投诉时无法用原照比对，只能人工查找。',
  'config.avatar.deletion_due_hours.label': '形象删除时限',
  'config.avatar.deletion_due_hours.desc':
    '删除形象、外观或账号后，文件以及形象生成服务里的副本必须在多少小时内删完，单位小时。外部删除任务超过这个时限仍未完成就写告警。',
  'config.avatar.look_credit_price.label': '新建外观额度价格',
  'config.avatar.look_credit_price.desc':
    '新建一个外观消耗的额度数。0 表示免费；已开通免费新建外观的账号不收。',
  'config.render.cloud_enabled.label': '开放云端渲染',
  'config.render.cloud_enabled.desc':
    '这套部署是否开放云端渲染档，还需要账号的云端渲染功能开关同时满足。云端渲染使用与手机相同的渲染模型格式。',
  'config.render.cloud_enabled.risk': '打开后会产生服务器成本，默认关闭。',
  'config.retry.initial_seconds.label': '重试起点间隔',
  'config.retry.initial_seconds.desc':
    '账号删除、外部删除、客服转发、外观资源包准备失败后，指数退避的起点间隔，单位秒。',
  'config.retry.max_seconds.label': '重试最长间隔',
  'config.retry.max_seconds.desc': '指数退避的间隔上限，单位秒。',
  'config.retry.max_attempts.label': '客服转发最多重试次数',
  'config.retry.max_attempts.desc':
    '客服转发连续失败多少次后标记为失败。账号删除不受这个限制：不会放弃，只告警。',
  'config.chat.history_max_limit.label': '聊天记录单次最多条数',
  'config.chat.history_max_limit.desc': '拉取聊天记录时单次最多返回的消息条数。',
  'config.chat.messages_max_batch.label': '消息单次写入条数上限',
  'config.chat.messages_max_batch.desc': '一次写入请求最多包含的消息条数。',
  'config.chat.message_max_chars.label': '单条消息字数上限',
  'config.chat.message_max_chars.desc':
    '单条消息允许的最大字符数，文字对话里用户发的消息同样适用。',
  'config.chat.turn_timeout_seconds.label': '文字对话单轮超时',
  'config.chat.turn_timeout_seconds.desc':
    '一轮文字对话从调用智能体到收到结束信号的最长时间，单位秒，超时算失败。',
  'config.chat.turn_lock_grace_seconds.label': '文字轮次锁额外时长',
  'config.chat.turn_lock_grace_seconds.desc':
    '文字对话轮次的锁和清扫，在单轮超时之外多留的时间（用于收尾和写入记忆），单位秒。',
  'config.chat.ingest_timeout_seconds.label': '写入记忆超时',
  'config.chat.ingest_timeout_seconds.desc':
    '一轮对话完成后写入记忆的最长等待时间，单位秒；失败不重试。',
  'config.chat.sse_keepalive_seconds.label': '流式响应保活间隔',
  'config.chat.sse_keepalive_seconds.desc': '流式响应发送保活信号的间隔，单位秒。',
  'config.chat.turn_sweep_seconds.label': '超时轮次扫描间隔',
  'config.chat.turn_sweep_seconds.desc':
    '扫描并把超时仍在等待中的文字轮次标记为失败的间隔，单位秒。',
  'config.chat.text_context_messages.label': '文字对话上下文条数',
  'config.chat.text_context_messages.desc':
    '文字对话调用智能体时带上的最近消息条数（包含通话期间的消息）。它直接决定每轮对话的模型输入成本。',
  'config.attribution.link_base_url.label': '归因链接根地址',
  'config.attribution.link_base_url.desc':
    '归因链接的根地址，必须是 https、不带末尾斜杠。未配置时，后台拿不到完整的归因链接。',
  'config.attribution.play_store_url.label': 'Android 商店页链接',
  'config.attribution.play_store_url.desc':
    'Android 应用商店里本应用详情页的链接，必须是 https，并带 id=包名 参数。未配置时，Android 的归因链接返回 404。',
  'config.attribution.other_platform_url.label': '非 Android 跳转地址',
  'config.attribution.other_platform_url.desc':
    '非 Android 设备打开归因链接时的跳转地址，必须是 https。未配置时，这些设备得到 404，也不记录点击。',
  'config.attribution.click_retention_days.label': '点击记录保留天数',
  'config.attribution.click_retention_days.desc':
    '点击记录保留多少天，单位天。不小于 1，且不小于指纹匹配窗口换算成天数（向上取整）的值，否则保存失败。保留期记入每条记录，改配置只影响之后写入的记录。',
  'config.attribution.fingerprint_window_hours.label': '指纹匹配窗口',
  'config.attribution.fingerprint_window_hours.desc':
    '指纹兜底匹配的窗口：从点击到认领之间最长允许多久，单位小时。不得超过点击记录保留天数换算成的小时数，否则保存失败。',
  'config.attribution.record_retention_days.label': '归因记录保留天数',
  'config.attribution.record_retention_days.desc':
    '没有账号的归因记录和认领记录保留多少天，单位天，不小于 1。',
  'config.attribution.cost_currency.label': '投放成本币种',
  'config.attribution.cost_currency.desc':
    '投放成本使用的币种，ISO 4217 三位字母代码。整个系统只用一种币种，所以可以直接计算单次获客成本。只要有成本行就不能改：先逐行删除成本，再改。',
  'config.attribution.cost_batch_max.label': '成本批量录入行数上限',
  'config.attribution.cost_batch_max.desc': '批量录入投放成本时一次最多允许几行。',
  'config.attribution.click_expired_keep_days.label': '过期点击额外保留天数',
  'config.attribution.click_expired_keep_days.desc':
    '点击记录的匹配有效期结束后，再保留多少天才物理删除，单位天。',
  'config.ratelimit.attribution_click_per_ip_per_hour.label': '归因点击每 IP 每小时上限',
  'config.ratelimit.attribution_click_per_ip_per_hour.desc':
    '同一 IP 每小时最多记录几次归因点击，超出后被限流。',
  'config.ratelimit.attribution_claim_per_ip_per_hour.label': '归因认领每 IP 每小时上限',
  'config.ratelimit.attribution_claim_per_ip_per_hour.desc':
    '同一 IP 每小时最多提交几次归因认领，超出后被限流。',
  'config.ratelimit.invite_event_per_ip_per_hour.label': '邀请事件每 IP 每小时上限',
  'config.ratelimit.invite_event_per_ip_per_hour.desc':
    '同一 IP 每小时最多提交几次邀请事件，超出后被限流。',
  'config.events.max_batch.label': '事件单次上报条数上限',
  'config.events.max_batch.desc': '一次事件上报请求最多包含的事件条数。',
  'config.export.max_rows.label': '导出最大行数',
  'config.export.max_rows.desc': '一次导出最多包含的行数。',
  'config.ratelimit.export_per_admin_per_hour.label': '导出每管理员每小时上限',
  'config.ratelimit.export_per_admin_per_hour.desc':
    '每个管理员每小时最多发起几次导出，超出后被限流。',
  'config.events.max_body_kb.label': '事件上报请求体上限',
  'config.events.max_body_kb.desc': '一次事件上报请求体的大小上限，单位 KB。',
  'config.events.rate_limit_per_min.label': '事件上报每分钟上限',
  'config.events.rate_limit_per_min.desc': '事件上报每分钟允许的请求数，按设备和按账号各自计算。',
  'config.events.ttl_days.label': '事件保留天数',
  'config.events.ttl_days.desc':
    '事件记录保留多少天，单位天。写入时算出每条记录的到期时间，修改只影响之后写入的记录。必须不小于 30 加统计回溯天数（回溯天数默认 3，所以默认下限是 33），否则保存失败。',
  'config.recall.scan_interval_minutes.label': '召回扫描间隔',
  'config.recall.scan_interval_minutes.desc': '扫描需要召回的用户的间隔，单位分钟。',
  'config.recall.local_send_hour.label': '召回推送当地小时',
  'config.recall.local_send_hour.desc': '召回推送在用户当地时间的几点发送，取值为小时（0 到 23）。',
  'config.recall.window_minutes.label': '召回发送窗口',
  'config.recall.window_minutes.desc': '召回推送在设定小时之后允许发送的时间窗口，单位分钟。',
  'config.recall.min_gap_hours.label': '召回推送最小间隔',
  'config.recall.min_gap_hours.desc': '与上一次召回推送的最小间隔，单位小时。故意设得小于 24。',
  'config.recall.inactive_hours.label': '召回未活跃小时数',
  'config.recall.inactive_hours.desc': '用户连续多少小时没有活跃就进入召回范围，单位小时。',
  'config.recall.streak_min_days.label': '召回连续天数下限',
  'config.recall.streak_min_days.desc':
    '用户的连续使用天数达到多少天才触发连续使用类召回，单位天。',
  'config.app.display_name.label': '应用显示名称',
  'config.app.display_name.desc':
    '邮件模板里应用名称占位符的取值。保存时去掉首尾空白后必须是 1 到 100 个字符，否则保存失败。产品名尚未确定，先用工作名。',
  'config.app.supported_locales.label': '支持的界面语言',
  'config.app.supported_locales.desc':
    '界面和通知（推送、站内通知、客户端配置）支持的语言清单，用语言代码的列表表示。语言的通知模板文件要先随版本发布，才能把它加进来（比较不区分大小写，整个标签要匹配），所以先发布文件再加语言。不必先建召回模板：召回触发原因在某种语言下没有模板时，发送时回退到推送默认语言。',
  'config.push.default_locale.label': '推送默认语言',
  'config.push.default_locale.desc':
    '归一化后没有对应模板时回退使用的语言。要改它，先在推送模板页为每个有启用模板的召回原因启用新语言的模板，再改默认语言。',
  'config.push.schedule_scan_seconds.label': '周期推送扫描间隔',
  'config.push.schedule_scan_seconds.desc': '扫描并生成周期推送任务的间隔，单位秒。',
  'config.push.guest_token_retention_days.label': '游客推送令牌保留天数',
  'config.push.guest_token_retention_days.desc': '游客的推送令牌多少天没有更新就清理，单位天。',
  'config.push.schedule_catchup_minutes.label': '周期推送补发时间',
  'config.push.schedule_catchup_minutes.desc':
    '停机后，周期推送最多补发多久以内错过的那一次，单位分钟。',
  'config.invite.reward_enabled.label': '邀请奖励总开关',
  'config.invite.reward_enabled.desc': '邀请奖励的总开关，关闭后不发放任何邀请奖励。',
  'config.invite.inviter_reward_credits.label': '邀请人奖励额度',
  'config.invite.inviter_reward_credits.desc':
    '邀请人每次得到的额度数，0 表示邀请人这一边不发放。发放时记入邀请记录，之后修改只影响之后的发放。',
  'config.invite.invitee_reward_credits.label': '被邀请人奖励额度',
  'config.invite.invitee_reward_credits.desc':
    '被邀请人得到的额度数，0 表示被邀请人这一边不发放。发放时记入邀请记录，之后修改只影响之后的发放。',
  'config.invite.reward_trigger.label': '邀请奖励触发时机',
  'config.invite.reward_trigger.desc':
    '什么时候评估并发放邀请奖励：REGISTER 是被邀请人注册成功时，FIRST_CALL 是被邀请人第一次满足最短时长的通话结束时。',
  'config.invite.first_call_min_seconds.label': '首次通话最短秒数',
  'config.invite.first_call_min_seconds.desc':
    '触发条件为首次通话时，通话至少要多长才算数，单位秒。',
  'config.invite.max_rewarded_per_inviter.label': '每个邀请人最多奖励次数',
  'config.invite.max_rewarded_per_inviter.desc': '每个邀请人最多能获得几次奖励，0 表示不限。',
  'config.invite.chain_max_depth.label': '邀请链最大深度',
  'config.invite.chain_max_depth.desc': '邀请链查询允许的最大层数。查询没有指定深度时默认取 3。',
  'config.tasks.sweep_seconds.label': '任务过期清扫间隔',
  'config.tasks.sweep_seconds.desc': '把已过期的可领取任务标记为过期的清扫间隔，单位秒。',
  'config.invite.reward_start_at.label': '邀请奖励开始时间',
  'config.invite.reward_start_at.desc':
    '奖励活动的开始时间（UTC，ISO-8601 格式），留空表示不限。评估时按当时的时间判断。与结束时间都有值时，开始必须早于结束，否则保存失败。',
  'config.invite.reward_end_at.label': '邀请奖励结束时间',
  'config.invite.reward_end_at.desc':
    '奖励活动的结束时间（UTC，ISO-8601 格式），留空表示不限。与开始时间都有值时，结束必须晚于开始，否则保存失败。',
  'config.companionship.text_burst_minutes.label': '文字互动合并间隔',
  'config.companionship.text_burst_minutes.desc':
    '两条文字消息相隔不超过这么多分钟，就算同一次互动，单位分钟。',
  'config.companionship.stage_thresholds.label': '陪伴阶段积分门槛',
  'config.companionship.stage_thresholds.desc':
    '陪伴阶段的积分门槛，用 JSON 对象表示，例如 BONDING 和 CLOSE 各对应一个积分值。积分低于 BONDING 的值时为 SEEDLING 阶段。',
  'config.milestone.days.label': '纪念日天数',
  'config.milestone.days.desc':
    '陪伴纪念日的天数清单，用 JSON 数组表示，例如满 7、30、100 天时触发纪念日。',
  'config.moderation.block_score.label': '审核拦截分数',
  'config.moderation.block_score.desc':
    '把审核服务返回的分数映射为“拦截”级别的阈值，复核分数是比它低的那个阈值。取值随审核服务选型确定，没有默认值。生产环境未配置时，依赖审核的用户端接口不可用，生成任务也不处理；管理端不受影响，应先在管理端配置，再让用户端上线。',
  'config.moderation.review_score.label': '审核复核分数',
  'config.moderation.review_score.desc':
    '把审核服务返回的分数映射为“复核”级别的阈值，必须小于拦截分数。取值随审核服务选型确定，没有默认值。未配置时的后果与拦截分数相同。',
  'config.moderation.call_timeout_seconds.label': '审核调用超时',
  'config.moderation.call_timeout_seconds.desc':
    '一次调用审核服务的超时时间，单位秒，超时按中风险处理（伴侣名字除外）。',
  'config.memory.tei_allowed_hosts.label': '嵌入服务允许主机',
  'config.memory.tei_allowed_hosts.desc':
    '注册向量嵌入模型时，嵌入服务地址允许使用的主机白名单。未配置时不能注册模型。',
  'config.moderation.text_rules.label': '文字审核规则词表',
  'config.moderation.text_rules.desc': '运营维护的文字审核规则词表，也可以在文字规则页面里编辑。',
  'config.moderation.text_rules_max.label': '规则词表最大条数',
  'config.moderation.text_rules_max.desc': '规则词表最多允许的条数。',
  'config.moderation.age_check_enabled.label': '年龄检查开关',
  'config.moderation.age_check_enabled.desc':
    '是否按年龄拒绝照片（判为明显未成年则拒绝）。人脸检测总是执行，不受它控制。随提交请求传给形象生成服务。',
  'config.moderation.underage_reject_below_age.label': '未成年拒绝年龄',
  'config.moderation.underage_reject_below_age.desc':
    '估计岁数低于这个值就判为明显未成年并拒绝，单位岁，必须是 0 到 100 的整数。生成图也使用这个门槛。随提交请求传给形象生成服务。',
  'config.moderation.underage_reject_below_age.risk':
    '默认值 16 是推断得来的。请用目标市场人群的照片实测人脸分析模型的年龄误差后再调整。风格化之后估计的年龄普遍偏小，实测中生成图比原照小约 5 至 14 岁；只测了成年人，未成年人的表现没有测。',
  'config.moderation.face_min_det_score.label': '人脸检测分数门槛',
  'config.moderation.face_min_det_score.desc':
    '人脸检测分数的门槛，低于它就不算检测到人脸，取值 0.1 到 1（含两端）；低于 0.1 的值不起作用，会被拒绝。随提交请求传给形象生成服务。',
  'config.moderation.generated_output_review.label': '审核生成结果',
  'config.moderation.generated_output_review.desc': '是否审核生成的标准图和动作片段。',
  'config.complaint.likeness_due_hours.label': '肖像投诉处理时限',
  'config.complaint.likeness_due_hours.desc':
    '照片里的人投诉的处理时限，单位小时，超过时限会写告警。',
  'config.complaint.likeness_due_hours.risk':
    '照片里的人的投诉必须在这个时间内处理（默认 48 小时），超过会写告警。',
  'config.complaint.retention_days.label': '投诉记录保留天数',
  'config.complaint.retention_days.desc':
    '投诉记录（含投诉人的邮箱和证据）及其处理记录，从结案起保留多少天，单位天，到期由每天一次的清理任务一起删除。没有结案的投诉不会删除。',
  'config.support.rate_limit_per_hour.label': '客服请求每小时上限',
  'config.support.rate_limit_per_hour.desc': '客服相关请求每小时允许的次数，超出后被限流。',
  'config.export.min_interval_hours.label': '导出最小间隔',
  'config.export.min_interval_hours.desc': '同一用户两次数据导出之间的最小间隔，单位小时。',
  'config.export.ttl_hours.label': '导出文件有效期',
  'config.export.ttl_hours.desc': '导出文件可供下载的时间，单位小时，到期后清理。',
  'config.export.job_timeout_minutes.label': '导出任务超时',
  'config.export.job_timeout_minutes.desc':
    '导出任务从创建起的最长时间，单位分钟，超过后任务置为失败（超时）。必须大于认领租期。',
  'config.export.lease_minutes.label': '导出任务认领租期',
  'config.export.lease_minutes.desc':
    '导出任务被认领后的租期，单位分钟，超过后其他实例可以重新认领。',
  'config.export.max_attempts.label': '导出任务最多尝试次数',
  'config.export.max_attempts.desc': '导出任务某一步失败后最多尝试几次。',
  'config.export.sweep_minutes.label': '导出文件清扫间隔',
  'config.export.sweep_minutes.desc': '清理已过期导出文件的间隔，单位分钟。',
  'config.export.memory_timeout_seconds.label': '导出取记忆超时',
  'config.export.memory_timeout_seconds.desc': '导出时从记忆服务取回全部记忆的总超时，单位秒。',
  'config.deletion.alert_after_failures.label': '删除失败告警次数',
  'config.deletion.alert_after_failures.desc':
    '账号删除失败次数达到这个值时在后台告警一次，之后继续重试。',
  'config.deletion.web_token_ttl_minutes.label': '网页删除令牌有效期',
  'config.deletion.web_token_ttl_minutes.desc': '网页删除确认令牌的有效期，单位分钟。',
  'config.deletion.grace_days.label': '账号删除宽限天数',
  'config.deletion.grace_days.desc':
    '申请删除账号后的宽限期，单位天，范围 1 到 30。记入每条删除申请，之后修改不影响已经申请的。保存后客户端配置缓存同时失效。',
  'config.deletion.abuse_marker_retention_days.label': '防滥用标记保留天数',
  'config.deletion.abuse_marker_retention_days.desc':
    '账号删除后保留的防滥用标记的保留天数，单位天。记入每条标记，之后修改只影响之后写入的。',
  'config.deletion.lease_minutes.label': '删除执行器认领租期',
  'config.deletion.lease_minutes.desc':
    '删除执行器认领任务的租期，单位分钟，超过后其他实例可以重新认领。',
  'config.deletion.tombstone_retention_days.label': '购买墓碑保留天数',
  'config.deletion.tombstone_retention_days.desc':
    '没有账号的一次性购买墓碑的保留天数，单位天，与防滥用标记保留天数一致。要大于商店重发通知和对账补漏的时间窗。',
  'config.pipeline_metrics.retention_days.label': '流水线指标保留天数',
  'config.pipeline_metrics.retention_days.desc': '流水线监控指标保留多少天，单位天。',
  'config.monitor.max_range_days.label': '监控查询最大跨度',
  'config.monitor.max_range_days.desc': '流水线监控查询允许的最大时间范围，单位天。',
  'config.monitor.max_points.label': '监控查询最大点数',
  'config.monitor.max_points.desc': '流水线监控查询一次最多返回的数据点数。',
  'config.usage.max_batch.label': '用量上报单次条数上限',
  'config.usage.max_batch.desc': '内部用量上报接口一次最多接收的记录条数。',
  'config.usage.max_tokens_per_record.label': '单条用量 token 上限',
  'config.usage.max_tokens_per_record.desc': '一条用量记录里每个 token 字段允许的最大值。',
  'config.usage.max_quantity_per_record.label': '单条用量数量上限',
  'config.usage.max_quantity_per_record.desc': '非大模型用量记录中数量字段允许的最大值。',
  'config.entitlement.limit_max.label': '额度类权益最大值',
  'config.entitlement.limit_max.desc': '额度类（LIMIT）功能值允许的最大整数。',
  'config.credits.spend_max_quantity.label': '单次扣额度最大数量',
  'config.credits.spend_max_quantity.desc': '一次扣减额度允许的最大数量。',
  'config.usage.rate_limit_per_min.label': '用量上报每分钟上限',
  'config.usage.rate_limit_per_min.desc':
    '每个调用方每分钟最多允许几次用量上报请求，超出后被限流。',
  'config.usage.retention_days.label': '用量原始记录保留天数',
  'config.usage.retention_days.desc':
    '用量原始记录保留多少天，单位天；日汇总表永久保留。保留期记入每条记录，改配置只影响之后写入的记录。',
  'config.usage_price.sync_enabled.label': '价格同步开关',
  'config.usage_price.sync_enabled.desc': '价格同步任务的开关，关闭后不再自动同步价格。',
  'config.usage_price.sync_hour_utc.label': '价格同步时刻',
  'config.usage_price.sync_hour_utc.desc': '每天几点（UTC）同步价格，取值为小时（0 到 23）。',
  'config.usage_price.default_currency.label': '同步价格默认币种',
  'config.usage_price.default_currency.desc':
    '同步生成的价格行使用的币种，因为价格来源的接口不提供币种。它必须在价格允许的币种里：要改它，先把新币种加进允许列表。',
  'config.usage_price.allowed_currencies.label': '价格允许的币种',
  'config.usage_price.allowed_currencies.desc':
    '价格行允许使用的币种清单，用币种代码的列表表示，目前只存美元、不做换算。手填和确认价格时币种不在清单里会被拒绝。同步价格默认币种必须留在清单里：要把它去掉，先改默认币种。',
  'config.usage_price.max_bands.label': '价格最大档位数',
  'config.usage_price.max_bands.desc': '一个价格批次最多允许的档位数。',
  'config.usage_price.source_url.label': '价格来源地址',
  'config.usage_price.source_url.desc':
    '价格同步使用的价格接口地址。必须是 https，且主机在适配器声明的白名单内，否则保存失败，以防密钥被发到别处。',
  'config.subscription.accept_sandbox.label': '接受沙盒购买',
  'config.subscription.accept_sandbox.desc':
    '沙盒或测试购买是否发放权益（订阅和额度都适用）。默认开启，因为商店审核和测试账号用沙盒购买测试生产后端。沙盒订阅不计入统计。',
  'config.subscription.reconcile_interval_minutes.label': '订阅对账间隔',
  'config.subscription.reconcile_interval_minutes.desc': '与商店对账订阅状态的间隔，单位分钟。',
  'config.subscription.orphan_retention_days.label': '无账号订阅保留天数',
  'config.subscription.orphan_retention_days.desc':
    '没有账号且已终结的订阅记录保留多少天，单位天。',
  'config.subscription.unacked_alert_hours.label': '订阅未确认告警小时数',
  'config.subscription.unacked_alert_hours.desc':
    '订阅购买超过这么多小时仍未确认就写告警，单位小时。部分商店会在 3 天后自动退款，所以要在此之前处理。',
  'config.entitlement.expiry_scan_minutes.label': '权益到期扫描间隔',
  'config.entitlement.expiry_scan_minutes.desc': '扫描限时权益是否到期的间隔，单位分钟。',
  'config.credits.unconsumed_alert_hours.label': '额度购买未消耗告警小时数',
  'config.credits.unconsumed_alert_hours.desc':
    '额度购买超过这么多小时仍未消耗就写告警，单位小时。',
  'config.session.deadline_scan_seconds.label': '通话到点扫描间隔',
  'config.session.deadline_scan_seconds.desc': '扫描并强制结束已到时间的通话的间隔，单位秒。',
  'config.session.max_duration_minutes.label': '单次通话最长时长',
  'config.session.max_duration_minutes.desc':
    '单次通话的硬上限，单位分钟，所有账号都适用。也是通话结束通知丢失时兜底收尾的依据。',
  'config.session.agent_join_timeout_seconds.label': '等待智能体加入超时',
  'config.session.agent_join_timeout_seconds.desc':
    '发出加入指令后，等待智能体进入房间的最长时间，单位秒。',
  'config.session.agent_join_retries.label': '智能体加入重试次数',
  'config.session.agent_join_retries.desc': '等不到智能体加入时，重新发出加入指令的次数。',
  'config.session.user_join_timeout_seconds.label': '等待用户进入超时',
  'config.session.user_join_timeout_seconds.desc':
    '智能体已加入后，用户一直没有进入房间多久，就把这个通话当作没有开始并删除，单位秒，不计额度。',
  'config.session.user_leave_grace_seconds.label': '用户离开后关房间宽限',
  'config.session.user_leave_grace_seconds.desc':
    '用户离开房间后等多久才关闭房间，单位秒，给重连留出时间。',
  'config.session.liveness_check_seconds.label': '通话存活检查间隔',
  'config.session.liveness_check_seconds.desc':
    '对进行中的通话核对房间里是否还有用户的间隔，单位秒，用来兜底用户离开通知丢失的情况。',
  'config.chat.sync_overlap_seconds.label': '增量同步回看秒数',
  'config.chat.sync_overlap_seconds.desc': '按更新时间做增量同步时多回看的秒数，单位秒。',
  'config.push.task_lease_minutes.label': '推送任务认领租期',
  'config.push.task_lease_minutes.desc':
    '推送任务被认领后的租期，单位分钟，超过后其他实例可以重新认领。',
  'config.push.task_image_retention_days.label': '推送任务图片保留天数',
  'config.push.task_image_retention_days.desc': '推送任务进入终态后，保留它的图片多少天，单位天。',
  'config.chat.model_tiers_allowed.label': '允许的模型档位',
  'config.chat.model_tiers_allowed.desc': '文字对话允许使用的模型档位名，用档位名的列表表示。',
  'config.chat.model_tiers_allowed.risk':
    '增加新档位前，必须先在 AvatarAgent 的 LLM_TIERS 里加同名档位并部署，再把名字加到这里。顺序反过来的话，被分到新档位的用户会静默使用 standard，只有智能体的错误日志能看出来。',
  'config.stats.land_window_days.label': '统计回溯天数',
  'config.stats.land_window_days.desc':
    '汇总任务每次重算最近几天的数据，单位天。迟到的数据（例如跨午夜才结束的通话）在窗口内会被自动纳入。',
  'config.stats.land_interval_minutes.label': '当天统计刷新间隔',
  'config.stats.land_interval_minutes.desc': '当天数据的刷新间隔，单位分钟。',
  'config.admin.totp_enroll_ttl_minutes.label': '二次验证绑定令牌有效期',
  'config.admin.totp_enroll_ttl_minutes.desc': '绑定二次验证所用一次性令牌的有效期，单位分钟。',
  'config.admin.totp_max_failures.label': '二次验证最多错误次数',
  'config.admin.totp_max_failures.desc': '管理员连续输错几次验证码后被锁定。',
  'config.admin.totp_lockout_minutes.label': '二次验证锁定时长',
  'config.admin.totp_lockout_minutes.desc': '二次验证被锁定后的锁定时长，单位分钟。',
  'config.stats.max_range_days.label': '统计查询最大跨度',
  'config.stats.max_range_days.desc': '汇总类报表单次查询允许的最大时间跨度，单位天。',
  'config.analytics.live_max_range_days.label': '实时分析最大跨度',
  'config.analytics.live_max_range_days.desc':
    '直接查询事件日志的接口（事件明细、事件汇总、事件名、漏斗）允许的最大时间跨度，单位天。',
  'config.admin.totp_required.label': '管理员必须二次验证',
  'config.admin.totp_required.desc':
    '管理员登录是否必须二次验证。生产环境不能关闭：关闭后服务拒绝启动，保存为关闭也会被拒绝。仅非生产环境可以关闭，此时登录只校验用户名和密码，忽略验证码和绑定状态。',
  'config.admin.password_min_length.label': '管理员密码最小长度',
  'config.admin.password_min_length.desc': '管理员密码允许的最小长度。',
  'config.admin.permission_cache_seconds.label': '权限缓存时长',
  'config.admin.permission_cache_seconds.desc':
    '管理员权限的缓存时间，单位秒；权限变更最长要过这么久才会在缓存里生效。',
  'config.ratelimit.admin_login_per_min.label': '管理员登录每分钟上限',
  'config.ratelimit.admin_login_per_min.desc':
    '管理员登录每分钟允许的请求数，按 IP 加用户名计，超出后被限流。',
  'config.moderation.content_url_ttl_seconds.label': '审核内容地址有效期',
  'config.moderation.content_url_ttl_seconds.desc': '审核内容的签名地址有效期，单位秒。',
  'config.upload.push_image_max_bytes.label': '推送图片大小上限',
  'config.upload.push_image_max_bytes.desc': '推送图片的大小上限，单位字节。',
  'config.ads.enabled.label': '应用内广告总开关',
  'config.ads.enabled.desc':
    '应用内广告的全局总开关。账号级的去广告权益是另一个功能开关，两者互不相同。',
  'config.ads.preload_enabled.label': '广告预加载',
  'config.ads.preload_enabled.desc': '是否在客户端预加载广告素材。',
  'config.ads.preload_ttl_minutes.label': '预加载有效期',
  'config.ads.preload_ttl_minutes.desc': '预加载的广告素材有效期，单位分钟，范围 1 到 240。',
  'config.ads.skip_after_seconds.label': '广告可跳过等待时间',
  'config.ads.skip_after_seconds.desc':
    '广告展示多少秒后可以跳过，单位秒，范围 0 到 60。为了满足应用商店对全屏广告可关闭的要求，应保持较小；超过 5 时后台会提示警告。',
  'config.ads.force_close_seconds.label': '广告强制关闭秒数',
  'config.ads.force_close_seconds.desc':
    '非激励广告展示满这么多秒后，无论素材是否可跳过都强制出现关闭按钮，单位秒，范围 0 到 60。0 表示不启用这个兜底。',
  'config.ads.history_feed_interval.label': '聊天记录广告间隔',
  'config.ads.history_feed_interval.desc': '聊天记录列表里每隔多少条插入一个广告，范围 3 到 50。',
  'config.ads.call_end_interval.label': '通话结束插屏间隔',
  'config.ads.call_end_interval.desc':
    '每隔多少次通话结束展示一次插屏广告，范围 0 到 999。0 表示不展示通话结束插屏。',
  'config.ads.log_retention_days.label': '广告展示记录保留天数',
  'config.ads.log_retention_days.desc':
    '广告展示记录保留多少天，单位天。保留期记入每条记录，改配置只影响之后写入的记录。',
  'config.ads.creative_aspect_tolerance_percent.label': '素材宽高比允许误差',
  'config.ads.creative_aspect_tolerance_percent.desc':
    '广告素材的宽高比与广告位要求之间允许的相对误差，单位百分比。',
  'config.ads.reward_complete_grace_seconds.label': '激励广告完成宽限',
  'config.ads.reward_complete_grace_seconds.desc':
    '激励广告展示后，超过奖励时长加上这个宽限仍没有终态事件，就视为作废并释放名额，单位秒。',
  'config.upload.orphan_hours.label': '孤立上传清理时限',
  'config.upload.orphan_hours.desc': '上传后没有被素材或版本使用的文件，多久后清理，单位小时。',
  'config.upload.ad_media_max_bytes.label': '广告素材大小上限',
  'config.upload.ad_media_max_bytes.desc': '广告素材上传的大小上限，单位字节。',
  'config.upload.public_base_url.label': '上传文件对外根地址',
  'config.upload.public_base_url.desc':
    '上传文件（广告素材、缩略图、APK）的对外根地址，必须是 https、不带末尾斜杠，可以带路径前缀。未配置时，广告素材和 APK 上传不可用。拼出的地址是公开的，不签名、不过期。',
  'config.upload.render_asset_max_bytes.label': '渲染资源单文件上限',
  'config.upload.render_asset_max_bytes.desc':
    '渲染模型 zip 上传的单文件上限，单位字节，整数且不小于 1。从形象生成服务取回的每个产物文件（外观标准图、驱动资源包、动作片段）也受它限制。',
  'config.auth.phone_login_enabled.label': '手机号登录开关',
  'config.auth.phone_login_enabled.desc':
    '是否开放手机号登录。设为开启时要求已配置短信允许的国家码和每日短信总量上限，且至少有一个启用的短信通道，否则保存失败；开启期间清空这两项、停用或删除最后一个启用的通道同样会被拒绝。保存后客户端配置缓存同时失效。关闭它不影响已有手机号账号删除自己的账号。',
  'config.sms.otp_ttl_seconds.label': '短信验证码有效期',
  'config.sms.otp_ttl_seconds.desc': '短信验证码的有效期，单位秒。',
  'config.sms.otp_resend_seconds.label': '短信验证码重发间隔',
  'config.sms.otp_resend_seconds.desc': '同一号码两次发送验证码的最小间隔，单位秒。',
  'config.sms.otp_max_attempts.label': '短信验证码最多错误次数',
  'config.sms.otp_max_attempts.desc': '一个短信验证码最多允许输错几次。',
  'config.sms.max_per_phone_per_day.label': '号码每日短信上限',
  'config.sms.max_per_phone_per_day.desc': '同一号码在滚动 24 小时内最多发送几条短信，不是自然日。',
  'config.ratelimit.otp_per_ip_per_hour.label': '短信验证码 IP 小时上限',
  'config.ratelimit.otp_per_ip_per_hour.desc':
    '同一 IP 每小时最多请求几次短信验证码，超出后被限流。',
  'config.sms.allowed_country_codes.label': '短信允许的国家码',
  'config.sms.allowed_country_codes.desc':
    '允许发送短信的国家码清单（ISO 国家码）。为空时无法开启手机号登录。',
  'config.sms.daily_global_cap.label': '每日短信总量上限',
  'config.sms.daily_global_cap.desc':
    '每日短信发送总量的上限，达到后拒绝发送并写告警。为空时无法开启手机号登录。',
  'config.sms.send_timeout_ms.label': '短信发送超时',
  'config.sms.send_timeout_ms.desc': '一次短信发送的超时时间，单位毫秒。',
  'config.sms.record_retention_days.label': '短信记录保留天数',
  'config.sms.record_retention_days.desc': '短信发送记录保留多少天，单位天。',
  'config.sms.dlr_max_skew_seconds.label': '送达回执时间偏差上限',
  'config.sms.dlr_max_skew_seconds.desc':
    '短信送达回执的时间戳允许与当前时间相差的最大秒数，单位秒。',
  'config.sms.dlr_pending_seconds.label': '送达回执等待时长',
  'config.sms.dlr_pending_seconds.desc': '短信发出后等待送达回执的时长，单位秒。',
  'config.sms.test_per_day.label': '测试短信每管理员每日上限',
  'config.sms.test_per_day.desc': '每个管理员每天最多发送几条测试短信。',
  'config.appversion.cache_seconds.label': '版本信息缓存时长',
  'config.appversion.cache_seconds.desc':
    '应用版本信息的缓存兜底有效期，单位秒；版本状态变化时会主动清除缓存。',
  'config.upload.apk_max_bytes.label': 'APK 大小上限',
  'config.upload.apk_max_bytes.desc':
    'APK 上传的大小上限，单位字节。反向代理的请求体上限要同步放宽。',
  'config.ratelimit.public_config_per_min.label': '公开配置每 IP 每分钟上限',
  'config.ratelimit.public_config_per_min.desc':
    '应用版本和客户端配置这两个公开接口，每个 IP 每分钟允许的请求数，超出后被限流。',
  'config.ratelimit.likeness_complaint_per_ip_per_hour.label': '肖像投诉每 IP 每小时上限',
  'config.ratelimit.likeness_complaint_per_ip_per_hour.desc':
    '同一 IP 每小时最多提交几次肖像投诉，超出后被限流。',
  'config.ratelimit.sms_dlr_per_min.label': '短信回执每 IP 每分钟上限',
  'config.ratelimit.sms_dlr_per_min.desc':
    '短信送达回执接口每个 IP 每分钟允许的请求数，超出后被限流。',
  'config.notification.max_recipients.label': '通知最大收件人数',
  'config.notification.max_recipients.desc': '一次通知最多可以发给多少个收件人。',
  'config.notification.read_retention_days.label': '已读通知保留天数',
  'config.notification.read_retention_days.desc': '已读的站内通知保留多少天，单位天。',
  'config.notification.unread_retention_days.label': '未读通知保留天数',
  'config.notification.unread_retention_days.desc': '未读的站内通知保留多少天，单位天。',
  'config.notification.max_per_account.label': '每账号通知条数上限',
  'config.notification.max_per_account.desc': '每个账号最多保留多少条站内通知。',
  'config.chat.moderation_global_concurrency.label': '每个实例同时在途的审核调用上限',
  'config.chat.moderation_global_concurrency.desc':
    '每个应用实例（app、worker 各自计数）同时在途的内容审核服务调用上限，所有调用方合计。等空位的时间计入该次调用自己的期限（审核调用超时；聊天批次还有聊天审核期限），超时按审核服务超时处理，该内容进入复核。批次内部的并发（聊天审核并发数）不受影响。这是每个实例各自的上限，不是整个集群共用；改动在下一次等待时生效。',
  'config.export.parallelism.label': '同时组装的导出任务数',
  'config.export.parallelism.desc':
    '后台数据导出同时组装的任务数上限，每个导出任务可能占两个数据库连接。每轮导出开始时读取，保存后从下一轮生效。',
  'config.ratelimit.apk_download_per_ip_per_min.label': 'APK 下载每 IP 每分钟次数',
  'config.ratelimit.apk_download_per_ip_per_min.desc':
    'APK 下载每个 IP 每分钟允许的次数。GET、HEAD、带 Range 的请求各算一次。超出答 429；手机端自更新按响应里的等待时间退避。',
  'config.ratelimit.push_image_per_ip_per_min.label': '推送图片每 IP 每分钟次数',
  'config.ratelimit.push_image_per_ip_per_min.desc': '推送图片每个 IP 每分钟允许的请求次数。',
  'config.ratelimit.ad_media_per_ip_per_min.label': '广告素材每 IP 每分钟次数',
  'config.ratelimit.ad_media_per_ip_per_min.desc':
    '广告素材及缩略图每个 IP 每分钟允许的请求次数，素材和缩略图共用一个计数器。',
  'config.analytics.funnel_max_concurrency.label': '同时计算的漏斗个数上限',
  'config.analytics.funnel_max_concurrency.desc':
    '一个管理端实例同时计算的漏斗个数上限，每次计算最多读 20 万条事件，约 100 MB。超出时漏斗请求答 429，页面提示稍后再试。按实例计数，不是整个集群共用；每次漏斗请求都读取，保存后下一次请求生效。',
  'config.integrity.app_attest_max_keys_per_device.label': '每台设备的设备认证密钥数上限',
  'config.integrity.app_attest_max_keys_per_device.desc':
    '同一个设备标识 30 天内最多认证几个 iOS 设备认证密钥；再多一个，手机端得到 403 DEVICE_INTEGRITY_FAILED。系统在重装、从备份恢复、换机时会生成新密钥；手机端没收到响应时的原样重发不计入。',
  'config.ratelimit.app_attest_challenge_per_ip_per_hour.label': '设备认证挑战每 IP 每小时次数',
  'config.ratelimit.app_attest_challenge_per_ip_per_hour.desc':
    '设备认证挑战请求每个 IP 每小时允许的次数。默认是游客每 IP 限额的 3 倍（一次 iOS 游客创建要一个认证挑战和一个断言挑战）。',
  'config.ratelimit.app_attest_key_per_ip_per_hour.label': '设备认证密钥登记每 IP 每小时次数',
  'config.ratelimit.app_attest_key_per_ip_per_hour.desc':
    '设备认证密钥登记每个 IP 每小时允许的次数。默认与游客每 IP 每小时限额相同。',
  'config.integrity.app_attest_unsupported_allowed.label': '允许不支持设备认证的 iOS 设备',
  'config.integrity.app_attest_unsupported_allowed.desc':
    '开（默认）：不能使用设备认证的 iOS 设备可以创建游客凭据和新账号，作为未经认证的 iOS 设备；已经认证过密钥的设备标识、以及游客记录是 Android 的设备标识不能这样做；原有的按 IP、按设备限流照常。关：这些设备得到 403 DEVICE_INTEGRITY_FAILED，不能创建游客凭据和新账号。Android 不受影响。每次校验时读取，保存后下一次请求生效。',
  'config.events.store_client_ip.label': '事件记录客户端 IP',
  'config.events.store_client_ip.desc':
    '开（默认）：每条埋点事件存客户端 IP。关：新写入的事件不存 IP（埋点列表里这些事件的 IP 一栏为空），国家仍照常由 IP 推出，所以国家统计不变；已经存下的 IP 到事件过期（事件保留天数）才消失。每次写入时读取，保存后下一批事件生效。',
  'config.ads.store_client_ip.label': '广告展示记录客户端 IP',
  'config.ads.store_client_ip.desc':
    '开（默认）：每条广告展示记录存客户端 IP。关：新写入的展示记录不存 IP（按预加载期限保存的展示元数据也不再带 IP），国家、平台、渠道等照常；已经存下的 IP 到记录过期（广告日志保留天数）才消失。每次写入时读取，保存后下一条记录生效。',
  'config.attribution.store_click_ip.label': '归因点击记录客户端 IP',
  'config.attribution.store_click_ip.desc':
    '开（默认）：每条自建归因的点击记录存客户端 IP。关：新点击不存 IP（点击明细里这些点击的 IP 一栏为空）；自建归因里靠 IP 的指纹匹配对这些点击不再生效（按点击编号的匹配不受影响），所以关掉后安装只能靠点击编号归因。已经存下的点击保留 IP 到被清除（点击保留天数加过期后保留天数）。这个键用归因权限编辑。每次写入点击时读取，保存后下一次点击生效。',
  'config.chat.message_retention_days.label': '聊天消息保留天数',
  'config.chat.message_retention_days.desc':
    '聊天消息和账号已结束的通话记录保留多少天。0（默认）表示保留到账号删除。大于 0 时必须不小于 32，且大于统计回溯天数；每天一次的清理任务（03:30 UTC）删除早于该天数的消息和通话记录，开着或未结算的会话、待人工复核的消息、待处理的文字轮、账号订阅当前周期内的行不删。之后用户的聊天历史、数据导出里没有这些消息，后台的会话列表变短，待复核的已删消息在后台看不到内容；已落地的统计和记忆服务不受影响。每次运行读取，保存后下一次运行生效。',
  'config.voice.source_sample_retention_days.label': '声音样本原文件保留天数',
  'config.voice.source_sample_retention_days.desc':
    '声音样本原文件（和任务上的转写）保留多少天，从音色创建起算。0（默认）表示随音色的生命周期。大于 0：到期由每天一次的清理任务删除，音色本身继续可用；之后数据导出里没有该音色的原始录音，音色在合成服务里丢失时无法用样本重建，待复核的被举报音色没有样本可听（有待复核记录的音色不删）。每次运行读取。',
  'config.guest.device_retention_days.label': '游客设备记录保留天数',
  'config.guest.device_retention_days.desc':
    '游客设备记录从最后一次出现起保留多少天。0（默认）表示不删除。大于 0 时必须不小于 91 加统计回溯天数；到期由每天一次的清理任务删除（仍有未结束游客会话的设备不删）。已落地的统计不变。每次运行读取。',
  'config.guest.device_retention_days.risk':
    '游客额度记在设备记录上。记录删除后，该设备下次出现按新设备处理并重新发放额度，所以设得太短会让游客额度被绕过。',
  'config.support.feedback_retention_days.label': '客服反馈保留天数',
  'config.support.feedback_retention_days.desc':
    '客服反馈（含用户原文）保留多少天，从提交起算。0（默认）表示保留到账号删除。大于 0：到期由每天一次的清理任务删除，不分转发状态（待转发、已转发、失败）；还没转发的被删后不会再转发；已经转发给第三方客服工具的副本在对方系统里，这里删不掉。后台客服列表只显示剩下的。每次运行读取。',
  'config.moderation.record_retention_days.label': '审核记录保留天数',
  'config.moderation.record_retention_days.desc':
    '审核记录保留多少天，从创建起算。0（默认）表示不删除。大于 0：到期由每天一次的清理任务删除，状态为待复核（PENDING_REVIEW）的永远不删。之后审核统计里被删日期的数字变小（统计是读记录实时算的），已删的记录在后台打不开。这个键用内容审核权限编辑。每次运行读取。',
  'config.push.task_poll_seconds.label': '推送任务轮询间隔',
  'config.push.task_poll_seconds.desc': '推送任务执行器查找到期任务的间隔，单位秒。',
  'config.memory.call_timeout_seconds.label': '记忆服务调用超时',
  'config.memory.call_timeout_seconds.desc': '调用记忆服务最长等待多少秒，超时放弃。',
  'config.attribution.postback_enabled.label': '转化回传开关',
  'config.attribution.postback_enabled.desc':
    '把广告投放活动的转化回传给广告平台的开关。默认关闭。',
  'config.attribution.facebook_graph_version.label': '广告平台接口版本',
  'config.attribution.facebook_graph_version.desc':
    '转化回传使用的广告平台接口版本，写法是字母 v、两位数字、一个点、一位数字，例如 v26.0。',
  'config.ratelimit.events_per_ip_per_minute.label': '事件上报每 IP 每分钟次数',
  'config.ratelimit.events_per_ip_per_minute.desc':
    '事件上报请求每个 IP 每分钟允许的次数，超出会被限流。',
  'config.chat.moderation_concurrency.label': '聊天批次内的审核并发数',
  'config.chat.moderation_concurrency.desc':
    '一批聊天消息送审时，批次内部同时进行的审核调用数。整个实例的总上限（每个实例同时在途的审核调用上限）另算。',
  'config.chat.moderation_deadline_ms.label': '聊天审核期限',
  'config.chat.moderation_deadline_ms.desc':
    '一批聊天消息等待审核结果的最长时间，单位毫秒（100 到 2500）。超时该内容进入复核。',
  'config.push.schedule_catchup_minutes.hint':
    '规则：catch-up 分钟数×60 须 ≥ 600 + 轮询秒数；默认值下至少 11。',
  'config.push.task_poll_seconds.hint':
    '规则：catch-up 分钟数×60 须 ≥ 600 + 轮询秒数；默认值下至少 11。',
  'config.app.supported_locales.reject.OUT_OF_RANGE':
    '没有保存。每种语言都要先有随版本发布的通知模板文件。先让文件随版本发布，再把语言加进来。',
  'config.refusal.missingLanguages': '没有模板文件的语言：{languages}',
  'config.refusal.unknownReason':
    '没有保存。服务端拒绝了这次修改，原因是本页还没有对应说明的一种。请对照该配置项说明里的规则检查。',
  'config.usage_price.default_currency.reject.OUT_OF_RANGE':
    '允许的币种必须包含默认币种。要改默认币种，先把新币种加进允许列表；要把当前默认币种从列表里去掉，先改默认币种。',
  'config.usage_price.allowed_currencies.reject.OUT_OF_RANGE':
    '允许的币种必须包含默认币种。要改默认币种，先把新币种加进允许列表；要把当前默认币种从列表里去掉，先改默认币种。',
  'config.push.schedule_catchup_minutes.reject.OUT_OF_RANGE':
    '没有保存。取值必须在 1 到 10080 之间，并且 catch-up 分钟数×60 须 ≥ 600 + 推送任务轮询秒数（默认轮询下至少 11）。',
  'config.push.task_poll_seconds.reject.OUT_OF_RANGE':
    '没有保存。取值不能小于 1，并且 catch-up 分钟数×60 须保持 ≥ 600 + 这个轮询秒数。',
  'config.chat.message_retention_days.reject.OUT_OF_RANGE':
    '没有保存。填 0（保留到账号删除），或不小于 32 天且大于统计回溯天数（stats.land_window_days）。',
  'config.guest.device_retention_days.reject.OUT_OF_RANGE':
    '没有保存。填 0（不删除），或不小于 91 加统计回溯天数（stats.land_window_days）。',
  'config.events.ttl_days.reject.OUT_OF_RANGE':
    '没有保存。事件保留天数必须不小于 30 加统计回溯天数（stats.land_window_days）。',
  'config.stats.land_window_days.reject.OUT_OF_RANGE':
    '没有保存。回溯天数不能小于 1，并且要小于依赖它的几项：事件保留天数（不小于 30 加回溯天数）、聊天消息保留天数（大于回溯天数）、游客设备记录保留天数（不小于 91 加回溯天数）。',
  'config.refusal.SmsTemplate.EMPTY_NOT_ALLOWED':
    '还不能开启手机号登录：必须至少有一个启用的验证码短信模板，语言为 en（en-GB、en-US 不算），且不限国家。请先在“短信模板”里新增或启用一个，再重试。',
  'config.push.default_locale.reject.OUT_OF_RANGE':
    '默认语言不能改为 {lang}：这些召回原因有启用的模板、但没有 {lang} 的启用模板：{reasons}。先为每个原因启用 {lang} 的模板。',
  'config.push.default_locale.reject.OUT_OF_RANGE.general':
    '默认语言还不能改为这种语言：每个有启用模板的召回原因都要有这种语言的启用模板。先在推送模板页为它们启用该语言的模板，再改默认语言。',
};

export default messages;
