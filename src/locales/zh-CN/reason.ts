const messages: Record<string, string> = {
  'reason.ACCOUNT_NOT_FOUND': '账号不存在',
  'reason.ACCOUNT_NOT_ACTIVE': '账号状态不是正常',
  'reason.NOT_HTTPS': '链接必须以小写的 https:// 开头',
  'reason.INVALID_HOST': '主机名不合法（国际化域名请写成 xn-- 形式，不能带用户信息）',
  'reason.INVALID_PORT': '端口必须是 1 到 5 位数字',
  'reason.INVALID_PATH': '路径含有不允许的字符（非 ASCII 字符要做百分号编码，不能有空格或反斜杠）',
  'reason.TOO_LONG': '内容过长',
  'reason.INVALID_EMAIL': '邮箱格式不正确',
  'reason.NOT_AN_INTEGER': '必须是整数',
  'reason.OUT_OF_RANGE': '超出允许的范围',
  'reason.NOT_BOOLEAN': '必须是 true 或 false',
  'reason.INVALID_LANGUAGE_TAG': '语言标签不合法',
  'reason.EMPTY_NOT_ALLOWED': '不能为空',
  'reason.INVALID_PATTERN': '正则表达式无法编译',
  'reason.RESOURCE_NOT_FOUND': '引用的对象不存在',
  'reason.DUPLICATE': '这一项重复了，每项只能出现一次',
  'reason.INVALID_CHARACTER': '文字含有不允许的字符（空字符 U+0000）',
  'reason.INVALID_FORMAT': '格式不对，或含有无法按原样保存的字符',
  'reason.PACKAGE_NAME_NOT_CONFIGURED': '后端没有配置 Google Play 应用包名，不能保存 Play 商店链接',
  'reason.SOURCE_EXPIRED': '补数用的来源数据已过期，无法补数',
  'reason.TOO_SLOW': '这次查询耗时太长，请缩小时间范围后重试',
  'reason.TOO_MANY_EVENTS': '这段时间内要读取的事件太多，请缩小时间范围后重试',
  'reason.REQUIRED': '必填',
  'reason.INVALID_TYPE': '值的类型不对',
  'reason.CONTROL_CHARACTER': '含有不允许的控制字符',
  'reason.IMMUTABLE': '创建后不能修改',
  'reason.NOT_FOUND': '指定的对象不存在',
  'reason.DISABLED': '已停用，不能选择',
  'reason.CURRENCY_MISMATCH': '币种与投放成本使用的币种不一致',
  'reason.LAST_OTP_CHANNEL':
    '这是最后一个启用的验证码通道。手机号登录开启，或存在手机号账号时，必须至少保留一个启用的验证码通道，所以不能删除、停用或改成其他类型。请先启用或新建另一个验证码通道。',
  'reason.COUNTRY_LOSES_OTP_CHANNEL':
    '这次改动之后，现在有启用的验证码通道覆盖的某个国家会没有通道。手机号登录开启，或存在手机号账号时，允许收验证码的每个国家都必须有启用的验证码通道覆盖。请先新建另一个验证码通道，或扩大另一个通道的国家范围。',
  'reason.LAST_OTP_TEMPLATE':
    '这是最后一个启用的验证码模板。手机号登录开启，或存在手机号账号时，必须至少保留一个启用的验证码模板，所以不能删除、停用或改成其他类型。请先启用或新建另一个。',
  'reason.LAST_ENGLISH_FALLBACK_TEMPLATE':
    '这是最后一个启用的、语言为英文（en）、不限国家的验证码模板。手机号登录开启，或存在手机号账号时，必须保留一个，所以不能删除、停用，也不能改它的语言、国家或类型。请先启用或新建另一个。',
  'reason.NEGATIVE': '金额小于 0。',
  'reason.TOO_MANY_DECIMALS': '金额的小数超过两位。',
};

export default messages;
