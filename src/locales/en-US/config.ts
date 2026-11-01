const messages: Record<string, string> = {
  'menu.config.backend': 'Backend parameters',
  'config.group.auth': 'Authentication and tokens',
  'config.group.guest': 'Guests',
  'config.group.admin': 'Admin site',
  'config.group.ratelimit': 'Rate limits',
  'config.group.integrity': 'Device integrity',
  'config.group.internal': 'Internal calls',
  'config.group.email': 'Email',
  'config.group.abuse': 'Abuse prevention',
  'config.group.tokens': 'Token cleanup',
  'config.group.maintenance': 'Data maintenance',
  'config.group.call': 'Call alerts',
  'config.group.persona': 'Persona',
  'config.group.chat': 'Text chat',
  'config.group.upload': 'Uploads',
  'config.group.voice': 'Voice',
  'config.group.generation': 'Avatar generation',
  'config.group.avatar': 'Avatars',
  'config.group.render': 'Rendering',
  'config.group.retry': 'Retries',
  'config.group.attribution': 'Attribution',
  'config.group.events': 'Event upload',
  'config.group.export': 'Exports',
  'config.group.recall': 'Recall push',
  'config.group.app': 'App info',
  'config.group.push': 'Push',
  'config.group.invite': 'Invites',
  'config.group.tasks': 'Tasks',
  'config.group.companionship': 'Companionship',
  'config.group.milestone': 'Milestones',
  'config.group.moderation': 'Moderation',
  'config.group.memory': 'Memory',
  'config.group.complaint': 'Complaints',
  'config.group.support': 'Support',
  'config.group.deletion': 'Account deletion',
  'config.group.pipeline_metrics': 'Pipeline metrics',
  'config.group.monitor': 'Monitoring',
  'config.group.usage': 'Usage',
  'config.group.entitlement': 'Entitlements',
  'config.group.credits': 'Credits',
  'config.group.usage_price': 'Usage prices',
  'config.group.subscription': 'Subscriptions',
  'config.group.session': 'Call sessions',
  'config.group.stats': 'Statistics',
  'config.group.analytics': 'Analytics',
  'config.group.ads': 'Ads',
  'config.group.sms': 'SMS',
  'config.group.appversion': 'App versions',
  'config.group.notification': 'Notifications',
  'config.unknownGroup': 'Unrecognised settings (read only)',
  'config.unset': 'Not set',
  'config.default': 'Default',
  'config.modified': 'Modified',
  'config.updatedAt': 'Updated',
  'config.updatedBy': 'Updated by',
  'config.reset': 'Reset to default',
  'config.resetConfirm': 'Reset to the default value?',
  'config.save': 'Save',
  'config.saved': 'Saved',
  'config.unknownKeys': 'Unrecognised settings: {keys}',
  'config.editedElsewhere': 'Edit it on this page: {page}',
  'config.warning.AD_SKIP_AFTER_TOO_LONG':
    'The skip delay is over 5 seconds, which may break store rules that full-screen ads must be closable',
  'config.warning.AD_FORCE_CLOSE_DISABLED':
    'Forced close is set to 0 (off), so ads that are not rewarded have no fallback close button',
  'config.warning.SMS_COUNTRY_UNCOVERED':
    'A country in the allow list has no enabled SMS channel covering it',
  'config.requiresUploadBase': 'Ad media and APK uploads need it',
  'config.jsonInvalid': 'Not valid JSON',
  'config.warning.PHONE_LOGIN_DISABLED_ACCOUNTS':
    'Phone sign-in is now off, but {count} phone-number accounts exist',
  'config.warning.UNKNOWN': 'Saved, with a warning',
  'config.auth.access_ttl_minutes.label': 'Access token lifetime',
  'config.auth.access_ttl_minutes.desc':
    'How long an access token stays valid after sign-in, in minutes. Guest credentials use the same value. It must not exceed the refresh token lifetime converted to minutes, or the save is rejected.',
  'config.auth.refresh_ttl_days.label': 'Refresh token lifetime',
  'config.auth.refresh_ttl_days.desc':
    'How long a refresh token stays valid, in days. Converted to minutes (rounded up), it must not be smaller than the access token lifetime, or the save is rejected.',
  'config.auth.refresh_reuse_grace_seconds.label': 'Refresh token replay grace',
  'config.auth.refresh_reuse_grace_seconds.desc':
    'Grace period after a refresh token is rotated, in seconds. Within it, reusing the old token returns the same token pair as the first time and is not treated as theft.',
  'config.guest.call_minutes_total.label': 'Guest total call allowance',
  'config.guest.call_minutes_total.desc':
    'One-time lifetime call allowance for each guest device, in minutes. There is no built-in default; product and operations decide the value. If it is not set it counts as 0 and guests cannot make calls. It only affects devices granted afterwards; the allowance of existing devices does not change.',
  'config.guest.call_minutes_total.risk':
    'If it is not set, guests cannot make calls. Reinstalling the app resets a guest allowance, so keep the value very small.',
  'config.auth.reset_token_ttl_minutes.label': 'Password reset token lifetime',
  'config.auth.reset_token_ttl_minutes.desc':
    'How long the token in a password reset link stays valid, in minutes.',
  'config.admin.jwt_ttl_hours.label': 'Admin sign-in lifetime',
  'config.admin.jwt_ttl_hours.desc':
    'How long an administrator sign-in stays valid, in hours. After that the administrator has to sign in again.',
  'config.admin.rate_limit_per_min.label': 'Admin requests per minute',
  'config.admin.rate_limit_per_min.desc':
    'Number of admin API requests allowed per minute. Requests above it are rate limited.',
  'config.ratelimit.guest_per_ip_per_hour.label': 'Guest sign-ins per IP per hour',
  'config.ratelimit.guest_per_ip_per_hour.desc':
    'Maximum number of guest credentials one IP address can create per hour. Requests above it are rate limited.',
  'config.guest.session_retention_days.label': 'Guest session retention',
  'config.guest.session_retention_days.desc':
    'How many days guest session records are kept before they are cleaned up, in days.',
  'config.integrity.check_enabled.label': 'Device integrity check',
  'config.integrity.check_enabled.desc':
    'Whether devices are verified when guest credentials are issued and accounts are created. It may be turned off outside production; saving it as off in production is rejected.',
  'config.ratelimit.guest_per_device_per_hour.label': 'Guest sign-ins per device per hour',
  'config.ratelimit.guest_per_device_per_hour.desc':
    'Maximum number of guest credentials one device can create per hour. Requests above it are rate limited.',
  'config.ratelimit.register_per_ip_per_hour.label': 'Registrations per IP per hour',
  'config.ratelimit.register_per_ip_per_hour.desc':
    'Maximum number of sign-up requests from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.email_otp_per_ip_per_hour.label': 'Email codes per IP per hour',
  'config.ratelimit.email_otp_per_ip_per_hour.desc':
    'Maximum number of email verification code requests from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.reset_confirm_per_ip_per_hour.label': 'Reset confirmations per IP per hour',
  'config.ratelimit.reset_confirm_per_ip_per_hour.desc':
    'Maximum number of password reset confirmations from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.deletion_confirm_per_ip_per_hour.label':
    'Deletion confirmations per IP per hour',
  'config.ratelimit.deletion_confirm_per_ip_per_hour.desc':
    'Maximum number of account deletion confirmations from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.api_per_account_per_min.label': 'API requests per account per minute',
  'config.ratelimit.api_per_account_per_min.desc':
    'Number of requests each signed-in account may send per minute. It is the catch-all limit for every signed-in endpoint.',
  'config.internal.signature_window_seconds.label': 'Internal call signature window',
  'config.internal.signature_window_seconds.desc':
    'How far the timestamp in an internal call signature may differ from the current time, in seconds. Calls outside the window are rejected.',
  'config.ratelimit.sensitive_per_account_per_hour.label': 'Sensitive actions per account per hour',
  'config.ratelimit.sensitive_per_account_per_hour.desc':
    'Maximum number of sensitive actions one account can perform per hour. Requests above it are rate limited.',
  'config.ratelimit.login_per_ip_per_hour.label': 'Sign-ins per IP per hour',
  'config.ratelimit.login_per_ip_per_hour.desc':
    'Total sign-in requests from one IP address per hour across all emails, to stop password spraying. Requests above it are rate limited.',
  'config.auth.login_max_failures_per_account.label': 'Maximum sign-in failures',
  'config.auth.login_max_failures_per_account.desc':
    'Number of failed sign-ins one account may have within the failure window before further attempts are refused.',
  'config.auth.login_failure_window_minutes.label': 'Sign-in failure window',
  'config.auth.login_failure_window_minutes.desc':
    'The time window in which failed sign-ins are counted, in minutes.',
  'config.auth.password_max_length.label': 'Maximum password length',
  'config.auth.password_max_length.desc':
    'Longest password allowed, to keep very long passwords from slowing down hashing. It must be at least 8, or the save is rejected.',
  'config.auth.log_retention_days.label': 'Auth log retention',
  'config.auth.log_retention_days.desc':
    'How many days authentication event logs are kept, in days. The expiry is stored on each record, so a change only affects records written afterwards.',
  'config.email.link_base_url.label': 'Email link base URL',
  'config.email.link_base_url.desc':
    'Root address of the links in emails. It must be https, have no trailing slash, and may include a path prefix such as https://example.com/m. If it is not set, emails that need a link (password reset, deletion confirmation) cannot be sent. Links use only this setting, never the Host header of the request.',
  'config.abuse.audit_retention_days.label': 'Sign-up audit retention',
  'config.abuse.audit_retention_days.desc':
    'How many days sign-up audit records are kept, in days.',
  'config.tokens.cleanup_grace_days.label': 'Token cleanup grace',
  'config.tokens.cleanup_grace_days.desc':
    'Extra days to keep expired refresh tokens and expired or used reset and deletion confirmation tokens before cleaning them up, in days.',
  'config.maintenance.done_job_retention_days.label': 'Finished job retention',
  'config.maintenance.done_job_retention_days.desc':
    'How many days finished external deletion jobs are kept, in days.',
  'config.maintenance.resolved_alert_retention_days.label': 'Resolved alert retention',
  'config.maintenance.resolved_alert_retention_days.desc':
    'How many days resolved admin alerts are kept, in days.',
  'config.abuse.cluster_min_free_accounts.label': 'Minimum free accounts per cluster',
  'config.abuse.cluster_min_free_accounts.desc':
    'Multi-account detection lists only clusters with at least this many free accounts by default.',
  'config.call.free_daily_alert_minutes.label': 'Daily free call alert threshold',
  'config.call.free_daily_alert_minutes.desc':
    'When the total minutes of free calls (free accounts and guests) in a day reach this value, an admin alert is written. Calls are not refused. If it is not set, no alert is written.',
  'config.email.otp_ttl_seconds.label': 'Email code lifetime',
  'config.email.otp_ttl_seconds.desc':
    'How long an email verification code stays valid, in seconds.',
  'config.email.otp_resend_seconds.label': 'Email code resend interval',
  'config.email.otp_resend_seconds.desc':
    'Minimum time between two verification codes sent to the same email address, in seconds.',
  'config.email.otp_max_attempts.label': 'Email code maximum attempts',
  'config.email.otp_max_attempts.desc':
    'How many wrong entries one email verification code allows before it is no longer accepted.',
  'config.email.max_per_address_per_day.label': 'Emails per address per day',
  'config.email.max_per_address_per_day.desc':
    'Maximum number of emails sent to one address within a rolling 24 hours.',
  'config.ratelimit.login_per_min.label': 'Sign-ins per minute',
  'config.ratelimit.login_per_min.desc':
    'Number of sign-in requests allowed per minute. Email sign-in is counted per IP and email, phone sign-in per IP and number; both use this value.',
  'config.ratelimit.refresh_per_min.label': 'Token refreshes per minute',
  'config.ratelimit.refresh_per_min.desc':
    'Number of token refresh requests allowed per minute. Requests above it are rate limited.',
  'config.ratelimit.reset_per_ip_per_hour.label': 'Password resets per IP per hour',
  'config.ratelimit.reset_per_ip_per_hour.desc':
    'Maximum number of password reset requests from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.push_token_per_ip_per_hour.label': 'Push token registrations per IP per hour',
  'config.ratelimit.push_token_per_ip_per_hour.desc':
    'Maximum number of guest push token registrations from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.chat_per_account_per_min.label': 'Chat requests per account per minute',
  'config.ratelimit.chat_per_account_per_min.desc':
    'Maximum number of text chat requests per account per minute. It only guards against scripts; cost is capped by the text quota.',
  'config.ratelimit.link_mail_per_email_per_hour.label': 'Link emails per address per hour',
  'config.ratelimit.link_mail_per_email_per_hour.desc':
    'Maximum number of emails with a link (password reset, web deletion confirmation) one address can trigger per hour. Above it the request still succeeds but no email is sent.',
  'config.ratelimit.public_deletion_per_ip_per_hour.label':
    'Public deletion requests per IP per hour',
  'config.ratelimit.public_deletion_per_ip_per_hour.desc':
    'Maximum number of account deletion requests from the public web page per IP address per hour. Requests above it are rate limited.',
  'config.persona.max_length.label': 'Maximum persona length',
  'config.persona.max_length.desc': 'Longest persona text allowed, counted in Unicode code points.',
  'config.chat.conversation_languages.label': 'Conversation languages',
  'config.chat.conversation_languages.desc':
    'Languages users may pick for a conversation, as a list of language codes. The list must include en (the fallback language), or the save is rejected. Saving also invalidates the client config cache.',
  'config.chat.conversation_languages.risk':
    'The list must not be longer than the languages that both the AvatarAgent recognition service and speech synthesis service can speak. Before adding a language, confirm both services support it; otherwise users get an avatar that silently speaks English.',
  'config.upload.max_bytes.label': 'Maximum upload size',
  'config.upload.max_bytes.desc': 'Largest ordinary upload allowed, in bytes.',
  'config.voice.transcript_max_chars.label': 'Maximum voice transcript length',
  'config.voice.transcript_max_chars.desc':
    'Longest voice transcript allowed, in characters. It must be between 1 and 1000, because the speech synthesis service accepts only 1 to 1000 characters. Saving also invalidates the client config cache.',
  'config.generation.poll_interval_seconds.label': 'Generation poll interval',
  'config.generation.poll_interval_seconds.desc':
    'How often the result of a generation job is polled, in seconds.',
  'config.generation.voice_timeout_seconds.label': 'Voice generation timeout',
  'config.generation.voice_timeout_seconds.desc':
    'Longest wait for a voice generation job, in seconds. After that the job fails.',
  'config.generation.voice_min_seconds.label': 'Minimum voice sample length',
  'config.generation.voice_min_seconds.desc':
    'Shortest voice sample accepted, in seconds. It must match the limit of the speech synthesis service, be between 1 and 30, and not exceed the maximum length, or the save is rejected. Saving also invalidates the client config cache.',
  'config.generation.voice_max_seconds.label': 'Maximum voice sample length',
  'config.generation.voice_max_seconds.desc':
    'Longest voice sample accepted, in seconds. It must be between 1 and 30 and not smaller than the minimum length, or the save is rejected. Saving also invalidates the client config cache.',
  'config.generation.avatar_timeout_minutes.label': 'Avatar generation timeout',
  'config.generation.avatar_timeout_minutes.desc':
    'Longest time from submission for avatar, look, look re-prepare and action clip jobs, in minutes. Avatar generation can queue; time spent waiting for review does not count.',
  'config.generation.max_attempts.label': 'Avatar generation maximum attempts',
  'config.generation.max_attempts.desc':
    'Total attempts allowed for one avatar generation, including the first. Each attempt runs one image edit, and failing any automatic check voids it; if all attempts fail the job fails. It must be an integer from 1 to 10; values outside that range make every generation job fail to submit. It is passed to the avatar generation service with each request.',
  'config.generation.reprepare_max_attempts.label': 'Look package retry limit',
  'config.generation.reprepare_max_attempts.desc':
    'How many times preparing a look driving package (for one look and format version) may fail before automatic retries stop and an alert is written. Retries back off exponentially between the retry start and maximum delays.',
  'config.avatar.download_url_ttl_seconds.label': 'Avatar download link lifetime',
  'config.avatar.download_url_ttl_seconds.desc':
    'How long signed download links stay valid for look images, action clips, driving packages and render models, in seconds. It should be long enough for a slow network to finish, but not leave links valid for long.',
  'config.generation.mouth_open_min_area.label': 'Mouth-open minimum area',
  'config.generation.mouth_open_min_area.desc':
    'Teeth-visible check: area inside the inner lip outline divided by the square of the distance between the outer eye corners. It has no unit and does not depend on image resolution. Suggested value 0.035 (measured on half-body framing); measure again after changing the image editing model, prompt or framing. It must be a number greater than 0. If this or the minimum brightness is not set, no jobs are submitted to the avatar generation service and avatar uploads and new looks fail.',
  'config.generation.mouth_open_min_brightness.label': 'Mouth-open minimum brightness',
  'config.generation.mouth_open_min_brightness.desc':
    'Teeth-visible check: average RGB value of the pixels inside the inner lip outline, from 0 to 255. Suggested value 50; a higher value wrongly rejects images of very dark skin in warm light where the teeth are clearly visible. It must be a number from 0 to 255. If it is not set the effect is the same as for the minimum area: no generation jobs are submitted.',
  'config.generation.ai_label_enabled.label': 'AI-generated label',
  'config.generation.ai_label_enabled.desc':
    'Whether generated look images and action clips carry a machine-readable AI-generated marker. The exact compliance requirements are still to be verified.',
  'config.avatar.realistic_enabled.label': 'Allow realistic style',
  'config.avatar.realistic_enabled.desc':
    'Whether realistic-style avatars (REALISTIC) can be uploaded. When off, uploading that style is rejected and it no longer appears in the upload options.',
  'config.avatar.declaration_required.label': 'Require upload declaration',
  'config.avatar.declaration_required.desc':
    'Whether users must tick the declaration when uploading an avatar. When off, the client does not show it and the declaration version may be omitted.',
  'config.avatar.source_photo_retention_days.label': 'Source photo retention',
  'config.avatar.source_photo_retention_days.desc':
    'How many days the original photo of an avatar is kept, in days. 0 keeps it for the lifetime of the avatar. A value above 0 counts from the moment the avatar was generated, and a daily cleanup job deletes the photo when it expires. Trade-offs: later outfit changes can only start from the current look image, and when a complaint comes from the person in a photo the original cannot be compared and must be searched manually.',
  'config.avatar.deletion_due_hours.label': 'Avatar deletion deadline',
  'config.avatar.deletion_due_hours.desc':
    'How many hours after an avatar, look or account is deleted its files and copies in the avatar generation service must be gone, in hours. If an external deletion job is still unfinished after this time, an alert is written.',
  'config.avatar.look_credit_price.label': 'New look credit price',
  'config.avatar.look_credit_price.desc':
    'Credits spent to create a look. 0 means free. Accounts that have free look creation are not charged.',
  'config.render.cloud_enabled.label': 'Enable cloud rendering',
  'config.render.cloud_enabled.desc':
    'Whether this deployment offers the cloud rendering tier; the account feature switch for cloud rendering must also be on. Cloud rendering uses the same render model format as phones.',
  'config.render.cloud_enabled.risk': 'Turning this on creates server costs. It is off by default.',
  'config.retry.initial_seconds.label': 'Retry initial delay',
  'config.retry.initial_seconds.desc':
    'Starting delay of the exponential backoff after account deletion, external deletion, support forwarding and look package preparation fail, in seconds.',
  'config.retry.max_seconds.label': 'Retry maximum delay',
  'config.retry.max_seconds.desc': 'Upper limit of the exponential backoff delay, in seconds.',
  'config.retry.max_attempts.label': 'Support forwarding maximum attempts',
  'config.retry.max_attempts.desc':
    'How many consecutive failures mark a support forwarding as failed. Account deletion is not limited by this: it never gives up and only raises an alert.',
  'config.chat.history_max_limit.label': 'Chat history page size limit',
  'config.chat.history_max_limit.desc':
    'Maximum number of messages returned in one request for chat history.',
  'config.chat.messages_max_batch.label': 'Messages per write batch',
  'config.chat.messages_max_batch.desc': 'Maximum number of messages in a single write request.',
  'config.chat.message_max_chars.label': 'Maximum message length',
  'config.chat.message_max_chars.desc':
    'Longest single message allowed, in characters. It also applies to user messages in text chat.',
  'config.chat.turn_timeout_seconds.label': 'Chat turn timeout',
  'config.chat.turn_timeout_seconds.desc':
    'Longest time for one text chat turn from calling the agent to receiving its done signal, in seconds. A turn that takes longer counts as failed.',
  'config.chat.turn_lock_grace_seconds.label': 'Chat turn lock grace',
  'config.chat.turn_lock_grace_seconds.desc':
    'Extra time, beyond the chat turn timeout, that a text turn keeps its lock and sweep protection for wrap-up and memory ingestion, in seconds.',
  'config.chat.ingest_timeout_seconds.label': 'Memory ingestion timeout',
  'config.chat.ingest_timeout_seconds.desc':
    'Longest wait for writing a finished turn into memory, in seconds. A failure is not retried.',
  'config.chat.sse_keepalive_seconds.label': 'Streaming keep-alive interval',
  'config.chat.sse_keepalive_seconds.desc':
    'How often a keep-alive signal is sent on a streaming response, in seconds.',
  'config.chat.turn_sweep_seconds.label': 'Timed-out turn sweep interval',
  'config.chat.turn_sweep_seconds.desc':
    'How often pending text turns that have timed out are found and marked failed, in seconds.',
  'config.chat.text_context_messages.label': 'Chat context messages',
  'config.chat.text_context_messages.desc':
    'Number of recent messages (including those from calls) sent to the agent with each text chat turn. It directly drives the model input cost of every turn.',
  'config.attribution.link_base_url.label': 'Attribution link base URL',
  'config.attribution.link_base_url.desc':
    'Root address of attribution links. It must be https and have no trailing slash. If it is not set, the admin site cannot show complete attribution links.',
  'config.attribution.play_store_url.label': 'Android store page URL',
  'config.attribution.play_store_url.desc':
    'Link to the app details page in the Android store; it must be https and carry an id= parameter with the package name. If it is not set, attribution links on Android return 404.',
  'config.attribution.other_platform_url.label': 'Non-Android redirect URL',
  'config.attribution.other_platform_url.desc':
    'Address that devices other than Android are sent to when they open an attribution link; it must be https. If it is not set, those devices get 404 and the click is not recorded.',
  'config.attribution.click_retention_days.label': 'Click record retention',
  'config.attribution.click_retention_days.desc':
    'How many days click records are kept, in days. At least 1 and not smaller than the fingerprint match window converted to days (rounded up), or the save is rejected. The expiry is stored on each record, so a change only affects records written afterwards.',
  'config.attribution.fingerprint_window_hours.label': 'Fingerprint match window',
  'config.attribution.fingerprint_window_hours.desc':
    'Window for fallback fingerprint matching: the longest time from a click to its claim, in hours. It must not exceed the click retention converted to hours, or the save is rejected.',
  'config.attribution.record_retention_days.label': 'Attribution record retention',
  'config.attribution.record_retention_days.desc':
    'How many days attribution and claim records without an account are kept, in days. At least 1.',
  'config.attribution.cost_currency.label': 'Ad cost currency',
  'config.attribution.cost_currency.desc':
    'Currency of ad spend as a three-letter ISO 4217 code. The whole system uses one currency, so cost per acquisition can be calculated directly. It cannot be changed while any cost row exists: delete the costs one by one first, then change it.',
  'config.attribution.cost_batch_max.label': 'Cost entry batch size',
  'config.attribution.cost_batch_max.desc': 'Maximum number of rows in one bulk entry of ad costs.',
  'config.attribution.click_expired_keep_days.label': 'Expired click keep days',
  'config.attribution.click_expired_keep_days.desc':
    'How many days a click record is kept after its matching period ends before it is physically deleted, in days.',
  'config.ratelimit.attribution_click_per_ip_per_hour.label': 'Attribution clicks per IP per hour',
  'config.ratelimit.attribution_click_per_ip_per_hour.desc':
    'Maximum number of attribution clicks from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.attribution_claim_per_ip_per_hour.label': 'Attribution claims per IP per hour',
  'config.ratelimit.attribution_claim_per_ip_per_hour.desc':
    'Maximum number of attribution claims from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.invite_event_per_ip_per_hour.label': 'Invite events per IP per hour',
  'config.ratelimit.invite_event_per_ip_per_hour.desc':
    'Maximum number of invite events from one IP address per hour. Requests above it are rate limited.',
  'config.events.max_batch.label': 'Events per upload batch',
  'config.events.max_batch.desc': 'Maximum number of events in a single event upload request.',
  'config.export.max_rows.label': 'Maximum export rows',
  'config.export.max_rows.desc': 'Maximum number of rows in a single export.',
  'config.ratelimit.export_per_admin_per_hour.label': 'Exports per admin per hour',
  'config.ratelimit.export_per_admin_per_hour.desc':
    'Maximum number of exports one administrator can start per hour. Requests above it are rate limited.',
  'config.events.max_body_kb.label': 'Event upload size limit',
  'config.events.max_body_kb.desc': 'Largest request body for one event upload, in KB.',
  'config.events.rate_limit_per_min.label': 'Event uploads per minute',
  'config.events.rate_limit_per_min.desc':
    'Number of event upload requests allowed per minute, counted separately per device and per account.',
  'config.events.ttl_days.label': 'Event retention',
  'config.events.ttl_days.desc':
    'How many days event records are kept, in days. The expiry is computed when each record is written, so a change only affects records written afterwards. It must be at least 30 plus the statistics look-back days (3 by default, so the default minimum is 33), or the save is rejected.',
  'config.recall.scan_interval_minutes.label': 'Recall scan interval',
  'config.recall.scan_interval_minutes.desc':
    'How often users who should receive a recall push are looked up, in minutes.',
  'config.recall.local_send_hour.label': 'Recall push local hour',
  'config.recall.local_send_hour.desc':
    'The hour of the day, in the user local time (0 to 23), at which recall pushes are sent.',
  'config.recall.window_minutes.label': 'Recall send window',
  'config.recall.window_minutes.desc':
    'Time window after the set hour in which recall pushes may be sent, in minutes.',
  'config.recall.min_gap_hours.label': 'Recall minimum gap',
  'config.recall.min_gap_hours.desc':
    'Minimum time since the previous recall push, in hours. It is deliberately set below 24.',
  'config.recall.inactive_hours.label': 'Recall inactivity threshold',
  'config.recall.inactive_hours.desc':
    'How many hours of inactivity put a user in the recall group, in hours.',
  'config.recall.streak_min_days.label': 'Recall minimum streak days',
  'config.recall.streak_min_days.desc':
    'Number of consecutive days of use a user needs before streak-based recall applies, in days.',
  'config.app.display_name.label': 'App display name',
  'config.app.display_name.desc':
    'The value used for the app name placeholder in email templates. After trimming spaces it must be 1 to 100 characters, or the save is rejected. The product name is not final, so a working name is used for now.',
  'config.app.supported_locales.label': 'Supported languages',
  'config.app.supported_locales.desc':
    'Languages supported by the interface and notifications (push, in-app notifications, client config), as a list of language codes. A language can be added only after its notification template file ships with the app version (the check ignores case and compares the whole tag), so ship the file first and add the language afterwards. Recall templates are not needed first: a recall trigger without a template in a language falls back to the push default language.',
  'config.push.default_locale.label': 'Push default language',
  'config.push.default_locale.desc':
    'Language used as the fallback when no template exists for the normalised language. To change it, first enable a template in the new language for every recall reason that has an enabled template (on the push templates page), then change the default language.',
  'config.push.schedule_scan_seconds.label': 'Scheduled push scan interval',
  'config.push.schedule_scan_seconds.desc':
    'How often scheduled push jobs are looked up and created, in seconds.',
  'config.push.guest_token_retention_days.label': 'Guest push token retention',
  'config.push.guest_token_retention_days.desc':
    'How many days a guest push token can go without an update before it is cleaned up, in days.',
  'config.push.schedule_catchup_minutes.label': 'Scheduled push catch-up',
  'config.push.schedule_catchup_minutes.desc':
    'After downtime, how far back a missed scheduled push is still sent, in minutes.',
  'config.invite.reward_enabled.label': 'Invite rewards',
  'config.invite.reward_enabled.desc':
    'Master switch for invite rewards. When off, no invite rewards are granted.',
  'config.invite.inviter_reward_credits.label': 'Inviter reward credits',
  'config.invite.inviter_reward_credits.desc':
    'Credits the inviter receives each time; 0 means the inviter side gets nothing. The amount is stored on the invite record when granted, so a change only affects later grants.',
  'config.invite.invitee_reward_credits.label': 'Invitee reward credits',
  'config.invite.invitee_reward_credits.desc':
    'Credits the invited user receives; 0 means the invitee side gets nothing. The amount is stored on the invite record when granted, so a change only affects later grants.',
  'config.invite.reward_trigger.label': 'Invite reward trigger',
  'config.invite.reward_trigger.desc':
    'When an invite reward is evaluated: REGISTER is when the invited user signs up successfully, FIRST_CALL is when the invited user first finishes a call that meets the minimum length.',
  'config.invite.first_call_min_seconds.label': 'First call minimum length',
  'config.invite.first_call_min_seconds.desc':
    'When the trigger is the first call, how long the call must last to count, in seconds.',
  'config.invite.max_rewarded_per_inviter.label': 'Maximum rewards per inviter',
  'config.invite.max_rewarded_per_inviter.desc':
    'How many times one inviter can be rewarded; 0 means no limit.',
  'config.invite.chain_max_depth.label': 'Invite chain maximum depth',
  'config.invite.chain_max_depth.desc':
    'Deepest level the invite chain query may go. When a query gives no depth, 3 is used.',
  'config.tasks.sweep_seconds.label': 'Task expiry sweep interval',
  'config.tasks.sweep_seconds.desc':
    'How often claimable tasks that have expired are marked as expired, in seconds.',
  'config.invite.reward_start_at.label': 'Invite reward start time',
  'config.invite.reward_start_at.desc':
    'Start of the reward campaign (UTC, ISO-8601); leave empty for no limit. It is checked against the time of each evaluation. When both start and end are set, the start must be earlier than the end, or the save is rejected.',
  'config.invite.reward_end_at.label': 'Invite reward end time',
  'config.invite.reward_end_at.desc':
    'End of the reward campaign (UTC, ISO-8601); leave empty for no limit. When both start and end are set, the end must be later than the start, or the save is rejected.',
  'config.companionship.text_burst_minutes.label': 'Text interaction gap',
  'config.companionship.text_burst_minutes.desc':
    'Two text messages sent no further apart than this count as one interaction, in minutes.',
  'config.companionship.stage_thresholds.label': 'Companionship stage thresholds',
  'config.companionship.stage_thresholds.desc':
    'Score thresholds for the companionship stages, as a JSON object with a score for BONDING and one for CLOSE. A score below the BONDING value is the SEEDLING stage.',
  'config.milestone.days.label': 'Milestone days',
  'config.milestone.days.desc':
    'Days of companionship that count as milestones, as a JSON array, for example the 7th, 30th and 100th day.',
  'config.moderation.block_score.label': 'Moderation block score',
  'config.moderation.block_score.desc':
    'The threshold that maps the score returned by the moderation service to the block level; the review score is the lower threshold. The value depends on the chosen moderation service and has no default. In production, if it is not set, user-facing endpoints that depend on moderation are unavailable and generation jobs are not processed; the admin site is not affected, so configure it here first and then bring the user side online.',
  'config.moderation.review_score.label': 'Moderation review score',
  'config.moderation.review_score.desc':
    'The threshold that maps the score returned by the moderation service to the review level. It must be lower than the block score. The value depends on the chosen moderation service and has no default. If it is not set the consequences are the same as for the block score.',
  'config.moderation.call_timeout_seconds.label': 'Moderation call timeout',
  'config.moderation.call_timeout_seconds.desc':
    'Timeout for one call to the moderation service, in seconds. A timeout is treated as medium risk (companion names are the exception).',
  'config.memory.tei_allowed_hosts.label': 'Allowed embedding hosts',
  'config.memory.tei_allowed_hosts.desc':
    'Allowlist of hosts that the embedding service address may use when an embedding model is registered. If it is not set, no model can be registered.',
  'config.moderation.text_rules.label': 'Text moderation rules',
  'config.moderation.text_rules.desc':
    'The rule word list that operations maintain for text moderation. It can also be edited on the text rules page.',
  'config.moderation.text_rules_max.label': 'Maximum text rules',
  'config.moderation.text_rules_max.desc': 'Maximum number of entries in the rule word list.',
  'config.moderation.age_check_enabled.label': 'Age check',
  'config.moderation.age_check_enabled.desc':
    'Whether photos are rejected based on age (clearly underage is rejected). Face detection always runs and is not controlled by this. It is passed to the avatar generation service with each request.',
  'config.moderation.underage_reject_below_age.label': 'Underage rejection age',
  'config.moderation.underage_reject_below_age.desc':
    'A photo whose estimated age is below this value is judged clearly underage and rejected, in years. It must be an integer from 0 to 100. Generated images use the same threshold. It is passed to the avatar generation service with each request.',
  'config.moderation.underage_reject_below_age.risk':
    'The default of 16 is an estimate, not a measured value. Measure the age error of the face analysis model on photos of people in your target market before changing it. Estimated age is generally lower after stylisation: in tests the generated image looked about 5 to 14 years younger than the original photo. Only adults were tested; behaviour for minors was not measured.',
  'config.moderation.face_min_det_score.label': 'Face detection minimum score',
  'config.moderation.face_min_det_score.desc':
    'Minimum face detection score; anything below it does not count as a detected face. It must be between 0.1 and 1 inclusive; values below 0.1 have no effect and are rejected. It is passed to the avatar generation service with each request.',
  'config.moderation.generated_output_review.label': 'Review generated output',
  'config.moderation.generated_output_review.desc':
    'Whether generated look images and action clips are reviewed.',
  'config.complaint.likeness_due_hours.label': 'Likeness complaint deadline',
  'config.complaint.likeness_due_hours.desc':
    'Time allowed to handle a complaint from the person in a photo, in hours. An alert is written when it is exceeded.',
  'config.complaint.likeness_due_hours.risk':
    'A complaint from the person in a photo must be handled within this time (the default is 48 hours); an alert is written when it is exceeded.',
  'config.complaint.retention_days.label': 'Complaint record retention',
  'config.complaint.retention_days.desc':
    'How many days a complaint record (including the complainant email and evidence) and its handling history are kept after the case is closed, in days. A daily cleanup job deletes them together when they expire. Complaints that are not closed are never deleted.',
  'config.support.rate_limit_per_hour.label': 'Support requests per hour',
  'config.support.rate_limit_per_hour.desc':
    'Number of support requests allowed per hour. Requests above it are rate limited.',
  'config.export.min_interval_hours.label': 'Export minimum interval',
  'config.export.min_interval_hours.desc':
    'Minimum time between two data exports for the same user, in hours.',
  'config.export.ttl_hours.label': 'Export file lifetime',
  'config.export.ttl_hours.desc':
    'How long an export file is available for download, in hours. It is cleaned up after that.',
  'config.export.job_timeout_minutes.label': 'Export job timeout',
  'config.export.job_timeout_minutes.desc':
    'Longest time an export job may run from creation, in minutes. After that it is marked failed (timeout). It must be greater than the claim lease.',
  'config.export.lease_minutes.label': 'Export claim lease',
  'config.export.lease_minutes.desc':
    'How long a claimed export job stays reserved, in minutes. After that another instance can claim it again.',
  'config.export.max_attempts.label': 'Export maximum attempts',
  'config.export.max_attempts.desc':
    'How many times a step of an export job is tried after failing.',
  'config.export.sweep_minutes.label': 'Export cleanup interval',
  'config.export.sweep_minutes.desc': 'How often expired export files are cleaned up, in minutes.',
  'config.export.memory_timeout_seconds.label': 'Export memory fetch timeout',
  'config.export.memory_timeout_seconds.desc':
    'Total timeout for fetching all memories from the memory service during an export, in seconds.',
  'config.deletion.alert_after_failures.label': 'Deletion failure alert count',
  'config.deletion.alert_after_failures.desc':
    'When the number of failed attempts of an account deletion reaches this value, one admin alert is written; retries continue afterwards.',
  'config.deletion.web_token_ttl_minutes.label': 'Web deletion token lifetime',
  'config.deletion.web_token_ttl_minutes.desc':
    'How long the token for confirming a deletion on the web stays valid, in minutes.',
  'config.deletion.grace_days.label': 'Account deletion grace period',
  'config.deletion.grace_days.desc':
    'Grace period after an account deletion request, in days, from 1 to 30. It is stored on each request, so a change does not affect requests already made. Saving also invalidates the client config cache.',
  'config.deletion.abuse_marker_retention_days.label': 'Abuse marker retention',
  'config.deletion.abuse_marker_retention_days.desc':
    'How many days the anti-abuse marker kept after an account deletion is retained, in days. The expiry is stored on each marker, so a change only affects markers written afterwards.',
  'config.deletion.lease_minutes.label': 'Deletion claim lease',
  'config.deletion.lease_minutes.desc':
    'How long a claimed deletion job stays reserved, in minutes. After that another instance can claim it again.',
  'config.deletion.tombstone_retention_days.label': 'Purchase tombstone retention',
  'config.deletion.tombstone_retention_days.desc':
    'How many days the tombstone of a one-time purchase without an account is kept, in days; keep it in line with the abuse marker retention. It must be longer than the window in which the store may resend notifications and reconciliation fills gaps.',
  'config.pipeline_metrics.retention_days.label': 'Pipeline metrics retention',
  'config.pipeline_metrics.retention_days.desc':
    'How many days pipeline monitoring metrics are kept, in days.',
  'config.monitor.max_range_days.label': 'Monitor query maximum range',
  'config.monitor.max_range_days.desc':
    'Longest time range a pipeline monitoring query may cover, in days.',
  'config.monitor.max_points.label': 'Monitor query maximum points',
  'config.monitor.max_points.desc':
    'Maximum number of data points one pipeline monitoring query returns.',
  'config.usage.max_batch.label': 'Usage records per batch',
  'config.usage.max_batch.desc':
    'Maximum number of records the internal usage reporting endpoint accepts in one call.',
  'config.usage.max_tokens_per_record.label': 'Maximum tokens per usage record',
  'config.usage.max_tokens_per_record.desc':
    'Largest value allowed for each token field in one usage record.',
  'config.usage.max_quantity_per_record.label': 'Maximum quantity per usage record',
  'config.usage.max_quantity_per_record.desc':
    'Largest quantity allowed in a usage record that is not for a language model.',
  'config.entitlement.limit_max.label': 'Maximum limit entitlement value',
  'config.entitlement.limit_max.desc':
    'Largest integer allowed for a limit-type (LIMIT) feature value.',
  'config.credits.spend_max_quantity.label': 'Maximum credits per spend',
  'config.credits.spend_max_quantity.desc': 'Largest quantity allowed in a single credit spend.',
  'config.usage.rate_limit_per_min.label': 'Usage requests per minute',
  'config.usage.rate_limit_per_min.desc':
    'Number of usage reporting requests each caller may send per minute. Requests above it are rate limited.',
  'config.usage.retention_days.label': 'Usage record retention',
  'config.usage.retention_days.desc':
    'How many days raw usage records are kept, in days; the daily summary table is kept permanently. The expiry is stored on each record, so a change only affects records written afterwards.',
  'config.usage_price.sync_enabled.label': 'Price sync',
  'config.usage_price.sync_enabled.desc':
    'Switch for the price sync job. When off, prices are no longer synced automatically.',
  'config.usage_price.sync_hour_utc.label': 'Price sync hour (UTC)',
  'config.usage_price.sync_hour_utc.desc':
    'The hour of the day (UTC, 0 to 23) at which prices are synced.',
  'config.usage_price.default_currency.label': 'Default synced price currency',
  'config.usage_price.default_currency.desc':
    'Currency of the price rows created by sync, because the price source does not provide a currency. It must be one of the allowed price currencies: to change it, add the new currency to the allowed list first.',
  'config.usage_price.allowed_currencies.label': 'Allowed price currencies',
  'config.usage_price.allowed_currencies.desc':
    'Currencies allowed for price rows, as a list of currency codes. Only USD is stored and nothing is converted. A currency that is not in the list is rejected when prices are entered or confirmed. The default currency must stay in the list: to take it out, change the default currency first.',
  'config.usage_price.max_bands.label': 'Maximum price bands',
  'config.usage_price.max_bands.desc': 'Maximum number of bands in one price batch.',
  'config.usage_price.source_url.label': 'Price source URL',
  'config.usage_price.source_url.desc':
    'Address of the price endpoint used by price sync. It must be https and its host must be on the allowlist declared by the adapter, or the save is rejected, so that keys are never sent elsewhere.',
  'config.subscription.accept_sandbox.label': 'Accept sandbox purchases',
  'config.subscription.accept_sandbox.desc':
    'Whether sandbox or test purchases grant entitlements (both subscriptions and credits). It is on by default because store review and test accounts test the production backend with sandbox purchases. Sandbox subscriptions are not counted in statistics.',
  'config.subscription.reconcile_interval_minutes.label': 'Subscription reconciliation interval',
  'config.subscription.reconcile_interval_minutes.desc':
    'How often subscription status is reconciled with the store, in minutes.',
  'config.subscription.orphan_retention_days.label': 'Orphan subscription retention',
  'config.subscription.orphan_retention_days.desc':
    'How many days finished subscription records without an account are kept, in days.',
  'config.subscription.unacked_alert_hours.label': 'Unacknowledged subscription alert',
  'config.subscription.unacked_alert_hours.desc':
    'An alert is written when a subscription purchase has stayed unacknowledged for this many hours, in hours. Some stores refund it automatically after 3 days, so handle it before then.',
  'config.entitlement.expiry_scan_minutes.label': 'Entitlement expiry scan interval',
  'config.entitlement.expiry_scan_minutes.desc':
    'How often time-limited entitlements are checked for expiry, in minutes.',
  'config.credits.unconsumed_alert_hours.label': 'Unconsumed credit purchase alert',
  'config.credits.unconsumed_alert_hours.desc':
    'An alert is written when a credit purchase has stayed unconsumed for this many hours, in hours.',
  'config.session.deadline_scan_seconds.label': 'Call deadline scan interval',
  'config.session.deadline_scan_seconds.desc':
    'How often calls that have reached their time limit are found and ended, in seconds.',
  'config.session.max_duration_minutes.label': 'Maximum call length',
  'config.session.max_duration_minutes.desc':
    'Hard limit on a single call, in minutes, for all accounts. It is also what closes a call when the end-of-call notification is lost.',
  'config.session.agent_join_timeout_seconds.label': 'Agent join timeout',
  'config.session.agent_join_timeout_seconds.desc':
    'Longest wait for the agent to join the room after it is told to, in seconds.',
  'config.session.agent_join_retries.label': 'Agent join retries',
  'config.session.agent_join_retries.desc':
    'How many times the join instruction is sent again when the agent does not join.',
  'config.session.user_join_timeout_seconds.label': 'User join timeout',
  'config.session.user_join_timeout_seconds.desc':
    'How long after the agent has joined the room the user may stay out before the call is treated as never started and deleted, in seconds. No allowance is charged.',
  'config.session.user_leave_grace_seconds.label': 'User leave grace',
  'config.session.user_leave_grace_seconds.desc':
    'How long to wait before closing the room after the user leaves, in seconds, to leave time for reconnecting.',
  'config.session.liveness_check_seconds.label': 'Call liveness check interval',
  'config.session.liveness_check_seconds.desc':
    'How often an ongoing call is checked for a user still being in the room, in seconds. It covers the case where the user-left notification is lost.',
  'config.chat.sync_overlap_seconds.label': 'Sync look-back',
  'config.chat.sync_overlap_seconds.desc':
    'How many extra seconds an incremental sync by update time looks back, in seconds.',
  'config.push.task_lease_minutes.label': 'Push job claim lease',
  'config.push.task_lease_minutes.desc':
    'How long a claimed push job stays reserved, in minutes. After that another instance can claim it again.',
  'config.push.task_image_retention_days.label': 'Push job image retention',
  'config.push.task_image_retention_days.desc':
    'How many days the image of a push job is kept after the job reaches a final state, in days.',
  'config.chat.model_tiers_allowed.label': 'Allowed model tiers',
  'config.chat.model_tiers_allowed.desc':
    'Names of the model tiers that text chat may use, as a list of tier names.',
  'config.chat.model_tiers_allowed.risk':
    'Before adding a tier, first add a tier with the same name to LLM_TIERS in AvatarAgent and deploy it, then add the name here. In the other order, users assigned to the new tier silently get standard, and only the agent error log shows it.',
  'config.stats.land_window_days.label': 'Statistics look-back days',
  'config.stats.land_window_days.desc':
    'How many recent days each summary job recalculates, in days. Late data, such as a call that ends after midnight, is included automatically within the window.',
  'config.stats.land_interval_minutes.label': 'Today statistics refresh interval',
  'config.stats.land_interval_minutes.desc':
    'How often today statistics are refreshed, in minutes.',
  'config.admin.totp_enroll_ttl_minutes.label': 'Two-factor enrolment token lifetime',
  'config.admin.totp_enroll_ttl_minutes.desc':
    'How long the one-time token used to set up two-factor authentication stays valid, in minutes.',
  'config.admin.totp_max_failures.label': 'Two-factor maximum failures',
  'config.admin.totp_max_failures.desc':
    'How many wrong verification codes in a row lock an administrator out.',
  'config.admin.totp_lockout_minutes.label': 'Two-factor lockout length',
  'config.admin.totp_lockout_minutes.desc':
    'How long an administrator stays locked out after too many wrong codes, in minutes.',
  'config.stats.max_range_days.label': 'Statistics maximum range',
  'config.stats.max_range_days.desc':
    'Longest time span one summary report query may cover, in days.',
  'config.analytics.live_max_range_days.label': 'Live analytics maximum range',
  'config.analytics.live_max_range_days.desc':
    'Longest time span allowed for queries that read the event log directly (event details, event summary, event names, funnels), in days.',
  'config.admin.totp_required.label': 'Require admin two-factor',
  'config.admin.totp_required.desc':
    'Whether administrator sign-in requires two-factor authentication. It cannot be turned off in production: the service refuses to start and saving it as off is rejected. Outside production it may be off, and then sign-in checks only the username and password and ignores the code and enrolment state.',
  'config.admin.password_min_length.label': 'Admin minimum password length',
  'config.admin.password_min_length.desc': 'Shortest password allowed for administrators.',
  'config.admin.permission_cache_seconds.label': 'Permission cache time',
  'config.admin.permission_cache_seconds.desc':
    'How long administrator permissions are cached, in seconds. A permission change may take up to this long to show up.',
  'config.ratelimit.admin_login_per_min.label': 'Admin sign-ins per minute',
  'config.ratelimit.admin_login_per_min.desc':
    'Number of administrator sign-in requests allowed per minute, counted per IP and username. Requests above it are rate limited.',
  'config.moderation.content_url_ttl_seconds.label': 'Moderation content link lifetime',
  'config.moderation.content_url_ttl_seconds.desc':
    'How long the signed address of content under review stays valid, in seconds.',
  'config.upload.push_image_max_bytes.label': 'Maximum push image size',
  'config.upload.push_image_max_bytes.desc': 'Largest push image allowed, in bytes.',
  'config.ads.enabled.label': 'In-app ads',
  'config.ads.enabled.desc':
    'Global master switch for in-app ads. Ad removal for an individual account is a separate feature switch.',
  'config.ads.preload_enabled.label': 'Ad preloading',
  'config.ads.preload_enabled.desc': 'Whether the client preloads ad media.',
  'config.ads.preload_ttl_minutes.label': 'Ad preload lifetime',
  'config.ads.preload_ttl_minutes.desc':
    'How long preloaded ad media stays valid, in minutes, from 1 to 240.',
  'config.ads.skip_after_seconds.label': 'Ad skip delay',
  'config.ads.skip_after_seconds.desc':
    'Seconds after which an ad can be skipped, from 0 to 60. To meet app store rules that full-screen ads must be closable, keep it small; above 5 the admin site shows a warning.',
  'config.ads.force_close_seconds.label': 'Ad forced close delay',
  'config.ads.force_close_seconds.desc':
    'Seconds after which a non-rewarded ad always shows a close button, whether or not its media is skippable, from 0 to 60. 0 turns this fallback off.',
  'config.ads.history_feed_interval.label': 'History feed ad interval',
  'config.ads.history_feed_interval.desc':
    'One ad is placed after this many items in the chat history list, from 3 to 50.',
  'config.ads.call_end_interval.label': 'Call-end ad interval',
  'config.ads.call_end_interval.desc':
    'An interstitial ad is shown after this many ended calls, from 0 to 999. 0 means no interstitial after calls.',
  'config.ads.log_retention_days.label': 'Ad impression log retention',
  'config.ads.log_retention_days.desc':
    'How many days ad impression records are kept, in days. The expiry is stored on each record, so a change only affects records written afterwards.',
  'config.ads.creative_aspect_tolerance_percent.label': 'Creative aspect ratio tolerance',
  'config.ads.creative_aspect_tolerance_percent.desc':
    'Relative difference allowed between the aspect ratio of an ad creative and what the placement requires, in percent.',
  'config.ads.reward_complete_grace_seconds.label': 'Rewarded ad completion grace',
  'config.ads.reward_complete_grace_seconds.desc':
    'If a rewarded ad has no final event after its reward duration plus this grace, it is treated as void and its slot is released, in seconds.',
  'config.upload.orphan_hours.label': 'Orphan upload cleanup time',
  'config.upload.orphan_hours.desc':
    'How long a file that was uploaded but is not used by any creative or version is kept before cleanup, in hours.',
  'config.upload.ad_media_max_bytes.label': 'Maximum ad media size',
  'config.upload.ad_media_max_bytes.desc': 'Largest ad media upload allowed, in bytes.',
  'config.upload.public_base_url.label': 'Upload public base URL',
  'config.upload.public_base_url.desc':
    'Public root address of uploaded files (ad media, thumbnails, APKs). It must be https, have no trailing slash, and may include a path prefix. If it is not set, ad media and APK uploads are unavailable. The resulting links are public, unsigned and never expire.',
  'config.upload.render_asset_max_bytes.label': 'Maximum render asset size',
  'config.upload.render_asset_max_bytes.desc':
    'Largest single file for a render model zip upload, in bytes, an integer of at least 1. It also limits each result file fetched from the avatar generation service (look image, driving package, action clip).',
  'config.auth.phone_login_enabled.label': 'Phone sign-in',
  'config.auth.phone_login_enabled.desc':
    'Whether phone-number sign-in is open. To turn it on, the allowed SMS country codes and the daily SMS cap must be configured and at least one SMS channel must be enabled, or the save is rejected; while it is on, clearing those two settings or disabling or deleting the last enabled channel is also rejected. Saving also invalidates the client config cache. Turning it off does not stop existing phone-number accounts from deleting themselves.',
  'config.sms.otp_ttl_seconds.label': 'SMS code lifetime',
  'config.sms.otp_ttl_seconds.desc': 'How long an SMS verification code stays valid, in seconds.',
  'config.sms.otp_resend_seconds.label': 'SMS code resend interval',
  'config.sms.otp_resend_seconds.desc':
    'Minimum time between two verification codes sent to the same number, in seconds.',
  'config.sms.otp_max_attempts.label': 'SMS code maximum attempts',
  'config.sms.otp_max_attempts.desc': 'How many wrong entries one SMS verification code allows.',
  'config.sms.max_per_phone_per_day.label': 'SMS per number per day',
  'config.sms.max_per_phone_per_day.desc':
    'Maximum number of SMS messages sent to one number within a rolling 24 hours, not a calendar day.',
  'config.ratelimit.otp_per_ip_per_hour.label': 'SMS codes per IP per hour',
  'config.ratelimit.otp_per_ip_per_hour.desc':
    'Maximum number of SMS verification code requests from one IP address per hour. Requests above it are rate limited.',
  'config.sms.allowed_country_codes.label': 'Allowed SMS country codes',
  'config.sms.allowed_country_codes.desc':
    'Country codes (ISO) that SMS may be sent to. While it is empty, phone sign-in cannot be turned on.',
  'config.sms.daily_global_cap.label': 'Daily SMS cap',
  'config.sms.daily_global_cap.desc':
    'Upper limit of SMS messages sent per day. When reached, sending is refused and an alert is written. While it is empty, phone sign-in cannot be turned on.',
  'config.sms.send_timeout_ms.label': 'SMS send timeout',
  'config.sms.send_timeout_ms.desc': 'Timeout for sending one SMS, in milliseconds.',
  'config.sms.record_retention_days.label': 'SMS record retention',
  'config.sms.record_retention_days.desc': 'How many days SMS send records are kept, in days.',
  'config.sms.dlr_max_skew_seconds.label': 'Delivery receipt time skew',
  'config.sms.dlr_max_skew_seconds.desc':
    'Largest difference allowed between the timestamp of an SMS delivery receipt and the current time, in seconds.',
  'config.sms.dlr_pending_seconds.label': 'Delivery receipt wait',
  'config.sms.dlr_pending_seconds.desc':
    'How long to wait for a delivery receipt after an SMS is sent, in seconds.',
  'config.sms.test_per_day.label': 'Test SMS per admin per day',
  'config.sms.test_per_day.desc':
    'Maximum number of test SMS messages each administrator can send per day.',
  'config.appversion.cache_seconds.label': 'App version cache time',
  'config.appversion.cache_seconds.desc':
    'Fallback lifetime of the cached app version information, in seconds. The cache is also cleared when a version status changes.',
  'config.upload.apk_max_bytes.label': 'Maximum APK size',
  'config.upload.apk_max_bytes.desc':
    'Largest APK upload allowed, in bytes. The request body limit of the reverse proxy must be raised to match.',
  'config.ratelimit.public_config_per_min.label': 'Public config requests per IP per minute',
  'config.ratelimit.public_config_per_min.desc':
    'Number of requests per IP address per minute allowed on the public app version and client config endpoints. Requests above it are rate limited.',
  'config.ratelimit.likeness_complaint_per_ip_per_hour.label':
    'Likeness complaints per IP per hour',
  'config.ratelimit.likeness_complaint_per_ip_per_hour.desc':
    'Maximum number of likeness complaints from one IP address per hour. Requests above it are rate limited.',
  'config.ratelimit.sms_dlr_per_min.label': 'SMS receipts per IP per minute',
  'config.ratelimit.sms_dlr_per_min.desc':
    'Number of SMS delivery receipt requests per IP address per minute. Requests above it are rate limited.',
  'config.notification.max_recipients.label': 'Notification maximum recipients',
  'config.notification.max_recipients.desc':
    'Maximum number of recipients one notification can be sent to.',
  'config.notification.read_retention_days.label': 'Read notification retention',
  'config.notification.read_retention_days.desc':
    'How many days read in-app notifications are kept, in days.',
  'config.notification.unread_retention_days.label': 'Unread notification retention',
  'config.notification.unread_retention_days.desc':
    'How many days unread in-app notifications are kept, in days.',
  'config.notification.max_per_account.label': 'Notifications per account limit',
  'config.notification.max_per_account.desc':
    'Maximum number of in-app notifications kept for one account.',
  'config.chat.moderation_global_concurrency.label': 'Moderation calls in flight per instance',
  'config.chat.moderation_global_concurrency.desc':
    "Most calls to the content moderation service in flight at once on one app or worker instance, all callers together. The time spent waiting for a free place counts against the call's own deadline (the moderation call timeout and, for chat batches, the chat moderation deadline); a call that runs out of time is treated as a moderation service timeout, so the content goes to review. The limit inside one batch (chat moderation concurrency) is separate. The limit is per instance, not shared by the cluster; a change applies from the next wait.",
  'config.export.parallelism.label': 'Export tasks assembled at once',
  'config.export.parallelism.desc':
    'Most data export tasks assembled at the same time. Each task can hold two database connections. It is read when each export round starts, so a change applies from the next round.',
  'config.ratelimit.apk_download_per_ip_per_min.label': 'APK downloads per IP per minute',
  'config.ratelimit.apk_download_per_ip_per_min.desc':
    "Number of APK download requests per IP address per minute. GET, HEAD and requests with a Range header each count once. Requests above it are answered 429; the app's self-update waits as the response says.",
  'config.ratelimit.push_image_per_ip_per_min.label': 'Push image requests per IP per minute',
  'config.ratelimit.push_image_per_ip_per_min.desc':
    'Number of requests for push notification images per IP address per minute.',
  'config.ratelimit.ad_media_per_ip_per_min.label': 'Ad media requests per IP per minute',
  'config.ratelimit.ad_media_per_ip_per_min.desc':
    'Number of requests for ad media and its thumbnails per IP address per minute. Media and thumbnail share one counter.',
  'config.analytics.funnel_max_concurrency.label': 'Funnel calculations at once',
  'config.analytics.funnel_max_concurrency.desc':
    'Most funnel calculations one admin instance runs at the same time. Each reads up to 200,000 events, about 100 MB. Above it a funnel request is answered 429 and the page asks you to try again later. It is counted per instance, not for the cluster, and read on every funnel request.',
  'config.integrity.app_attest_max_keys_per_device.label': 'Device attestation keys per device',
  'config.integrity.app_attest_max_keys_per_device.desc':
    'Most iOS device attestation keys one device identifier may attest within 30 days. One more is refused with 403 DEVICE_INTEGRITY_FAILED. The platform creates a new key on reinstall, restore from backup and a change of phone; a repeat of a request whose answer was lost does not count.',
  'config.ratelimit.app_attest_challenge_per_ip_per_hour.label':
    'Device attestation challenges per IP per hour',
  'config.ratelimit.app_attest_challenge_per_ip_per_hour.desc':
    'Number of device attestation challenge requests per IP address per hour. The default is three times the guest limit per IP, because creating one iOS guest takes one attestation challenge and one assertion challenge.',
  'config.ratelimit.app_attest_key_per_ip_per_hour.label':
    'Device attestation key registrations per IP per hour',
  'config.ratelimit.app_attest_key_per_ip_per_hour.desc':
    'Number of device attestation key registrations per IP address per hour. The default is the same as the guest limit per IP per hour.',
  'config.integrity.app_attest_unsupported_allowed.label':
    'Allow iOS devices without device attestation',
  'config.integrity.app_attest_unsupported_allowed.desc':
    'On (default): an iOS device that cannot use device attestation may create guest credentials and new accounts as an unattested iOS device. A device identifier that has already attested a key, and one whose guest record is Android, may not; the usual limits per IP and per device still apply. Off: such devices get 403 DEVICE_INTEGRITY_FAILED and cannot create guest credentials or new accounts. Android is not affected. Read on every check, so a change applies from the next request.',
  'config.events.store_client_ip.label': 'Store client IP on events',
  'config.events.store_client_ip.desc':
    'On (default): every analytics event stores the client IP. Off: new events store no IP (the IP column of the event list is empty for them); the country is still derived from the IP, so country statistics do not change. IPs already stored stay until the event expires (event retention). Read on every write, so a change applies from the next batch.',
  'config.ads.store_client_ip.label': 'Store client IP on ad impressions',
  'config.ads.store_client_ip.desc':
    'On (default): every ad impression record stores the client IP. Off: new impression records store no IP (neither does the impression metadata kept for preloading); country, platform, channel and the rest are unchanged. IPs already stored stay until the record expires (ad log retention). Read on every write, so a change applies from the next record.',
  'config.attribution.store_click_ip.label': 'Store client IP on attribution clicks',
  'config.attribution.store_click_ip.desc':
    'On (default): every click of the built-in attribution stores the client IP. Off: new clicks store no IP (the IP column of the click details is empty for them). Fingerprint matching, which needs the IP, then no longer applies to these clicks, so an install can only be attributed by its click id. Stored IPs stay until the click is purged (click retention plus the days kept after expiry). This key is edited with the attribution permission. Read on every click, so a change applies from the next click.',
  'config.chat.message_retention_days.label': 'Chat message retention',
  'config.chat.message_retention_days.desc':
    "How many days chat messages and the records of ended calls are kept. 0 (default) keeps them until the account is deleted. Above 0 it must be at least 32 and more than the statistics look-back days; a daily clean-up (03:30 UTC) then deletes older messages and call records, except open or unsettled sessions, messages waiting for manual review, pending text turns and rows inside the current subscription period of the account. After that the user's chat history and data export no longer hold these messages, the session list gets shorter and a deleted message under review shows no content; landed statistics and the memory service are not affected. Read on every run.",
  'config.voice.source_sample_retention_days.label': 'Voice sample retention',
  'config.voice.source_sample_retention_days.desc':
    'How many days the original voice sample file (and its transcript on the task) is kept, counted from when the voice was created. 0 (default) keeps it as long as the voice lives. Above 0 a daily clean-up deletes it and the voice stays usable. After that data exports no longer hold the original recording, a voice lost in the synthesis service cannot be rebuilt from the sample, and a reported voice under review has no sample to listen to (a voice with a record waiting for review is not deleted). Read on every run.',
  'config.guest.device_retention_days.label': 'Guest device record retention',
  'config.guest.device_retention_days.desc':
    'How many days a guest device record is kept after it was last seen. 0 (default) never deletes it. Above 0 it must be at least 91 plus the statistics look-back days; a daily clean-up deletes expired records (a device that still has an unfinished guest session is kept). Landed statistics do not change. Read on every run.',
  'config.guest.device_retention_days.risk':
    'The guest allowance is recorded on the device record. Once the record is deleted, the device is treated as a new device the next time it appears and receives a new allowance, so a period that is too short lets guests get the allowance again.',
  'config.support.feedback_retention_days.label': 'Support feedback retention',
  'config.support.feedback_retention_days.desc':
    "How many days support feedback (with the user's own text) is kept, counted from when it was submitted. 0 (default) keeps it until the account is deleted. Above 0 a daily clean-up deletes it, whatever its forwarding state (waiting, forwarded, failed); feedback not forwarded yet is never forwarded once deleted, and copies already sent to a third-party support tool are in that system and cannot be deleted here. The support list shows what is left. Read on every run.",
  'config.moderation.record_retention_days.label': 'Moderation record retention',
  'config.moderation.record_retention_days.desc':
    'How many days moderation records are kept, counted from when they were created. 0 (default) never deletes them. Above 0 a daily clean-up deletes them, except records waiting for review (PENDING_REVIEW). After that the moderation statistics show smaller numbers for the days deleted, because they are computed from the records, and deleted records cannot be opened. This key is edited with the moderation permission. Read on every run.',
  'config.push.task_poll_seconds.label': 'Push task poll interval',
  'config.push.task_poll_seconds.desc':
    'How often the push worker looks for push tasks that are due, in seconds.',
  'config.memory.call_timeout_seconds.label': 'Memory service call timeout',
  'config.memory.call_timeout_seconds.desc':
    'How long a call to the memory service may take before it is given up, in seconds.',
  'config.attribution.postback_enabled.label': 'Conversion postback',
  'config.attribution.postback_enabled.desc':
    'Switch for sending the conversions of ad campaigns back to the ad platform (postback). Off by default.',
  'config.attribution.facebook_graph_version.label': 'Ad platform API version',
  'config.attribution.facebook_graph_version.desc':
    'Version of the ad platform interface used for the postback, written as a v, two digits, a dot and one digit, for example v26.0.',
  'config.ratelimit.events_per_ip_per_minute.label': 'Event uploads per IP per minute',
  'config.ratelimit.events_per_ip_per_minute.desc':
    'Number of event upload requests per IP address per minute. Requests above it are rate limited.',
  'config.chat.moderation_concurrency.label': 'Moderation calls inside one chat batch',
  'config.chat.moderation_concurrency.desc':
    'How many calls to the moderation service one batch of chat messages makes at the same time. The limit for all calls of one instance (moderation calls in flight per instance) is separate.',
  'config.chat.moderation_deadline_ms.label': 'Chat moderation deadline',
  'config.chat.moderation_deadline_ms.desc':
    'How long a batch of chat messages waits for moderation, in milliseconds (100 to 2500). When the time runs out, the content goes to review.',
  'config.push.schedule_catchup_minutes.hint':
    'Rule: catch-up minutes × 60 must be at least 600 + poll seconds; with the default values the catch-up must be at least 11.',
  'config.push.task_poll_seconds.hint':
    'Rule: catch-up minutes × 60 must be at least 600 + poll seconds; with the default values the catch-up must be at least 11.',
  'config.app.supported_locales.reject.OUT_OF_RANGE':
    'Not saved. Every language needs a notification template file that ships with the app version. Ship the file first, then add the language.',
  'config.refusal.missingLanguages': 'Languages without a template file: {languages}',
  'config.refusal.unknownReason':
    'Not saved. The service refused this change for a reason this page has no words for yet. Check the rules in the description of the setting.',
  'config.usage_price.default_currency.reject.OUT_OF_RANGE':
    'The allowed currencies must contain the default currency. To change the default, add the new currency to the allowed list first; to take the current default out of the list, change the default first.',
  'config.usage_price.allowed_currencies.reject.OUT_OF_RANGE':
    'The allowed currencies must contain the default currency. To change the default, add the new currency to the allowed list first; to take the current default out of the list, change the default first.',
  'config.push.schedule_catchup_minutes.reject.OUT_OF_RANGE':
    'Not saved. The value must be 1 to 10080, and catch-up minutes × 60 must be at least 600 + the push task poll seconds (at least 11 with the default poll).',
  'config.push.task_poll_seconds.reject.OUT_OF_RANGE':
    'Not saved. The value must be at least 1, and catch-up minutes × 60 must stay at least 600 + these poll seconds.',
  'config.chat.message_retention_days.reject.OUT_OF_RANGE':
    'Not saved. Use 0 (keep until the account is deleted), or at least 32 days and more than the statistics look-back days (stats.land_window_days).',
  'config.guest.device_retention_days.reject.OUT_OF_RANGE':
    'Not saved. Use 0 (never delete), or at least 91 days plus the statistics look-back days (stats.land_window_days).',
  'config.events.ttl_days.reject.OUT_OF_RANGE':
    'Not saved. Event retention must be at least 30 days plus the statistics look-back days (stats.land_window_days).',
  'config.stats.land_window_days.reject.OUT_OF_RANGE':
    'Not saved. The look-back must be at least 1 and must stay below what depends on it: event retention (at least 30 plus the look-back), chat message retention (more than the look-back) and guest device retention (at least 91 plus the look-back).',
  'config.refusal.SmsTemplate.EMPTY_NOT_ALLOWED':
    'Phone sign-in cannot be turned on yet. There must be at least one enabled OTP SMS template in language en (not en-GB or en-US) with no country set. Add or enable one under SMS templates, then try again.',
  'config.push.default_locale.reject.OUT_OF_RANGE':
    'The default language cannot be changed to {lang}: these recall reasons have enabled templates but none in {lang}: {reasons}. Enable a {lang} template for each of them first.',
  'config.push.default_locale.reject.OUT_OF_RANGE.general':
    'The default language cannot be changed to this language yet: every recall reason with an enabled template needs an enabled template in it. Enable those templates on the push templates page first, then change the default language.',
};

export default messages;
