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
};

export default messages;
