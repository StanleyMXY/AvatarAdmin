const messages: Record<string, string> = {
  // ---- menu ----
  'menu.email.templates': '邮件模板',

  // ---- the page ----
  'email.templates.note':
    '系统发出的每封邮件只有一份文案，只有英文。模板由系统声明：可以编辑，也可以恢复默认，不能新增或删除。',
  'email.templates.empty': '没有模板',
  'email.templates.col.code': '模板',
  'email.templates.col.subject': '主题',
  'email.templates.col.status': '状态',
  'email.templates.col.updatedBy': '最后修改人',
  'email.templates.col.updatedAt': '最后修改时间',
  'email.templates.col.actions': '操作',
  'email.templates.status.modified': '已修改',
  'email.templates.status.default': '默认',
  'email.templates.edit': '编辑',
  'email.code.REGISTER_CODE': '注册验证码',
  'email.code.PASSWORD_RESET': '密码重置',
  'email.code.DELETION_CONFIRM': '网页删除账号的确认邮件',
  'email.code.PASSWORD_CHANGED': '密码已更改的通知',
  'email.code.LIKENESS_COMPLAINT_RECEIVED': '照片投诉的收到确认',

  // ---- what a placeholder stands for (the name between the braces) ----
  'email.placeholder.code': '验证码',
  'email.placeholder.minutes': '验证码或链接的有效分钟数',
  'email.placeholder.appName': '应用名称',
  'email.placeholder.resetLink': '重置密码的完整链接，由系统生成',
  'email.placeholder.confirmLink': '确认删除账号的链接',
  'email.placeholder.subscriptionNotice': '由系统填入订阅说明，账号没有订阅时填空；不能删掉',
  'email.placeholder.time': '更改发生的时间',

  // ---- the editor ----
  'email.templates.editTitle': '编辑模板',
  'email.templates.field.code': '模板',
  'email.templates.field.subject': '主题',
  'email.templates.field.body': '正文',
  'email.templates.subjectCount': '{count} / {max}',
  'email.templates.subjectInvalid': '主题需要 1 到 200 个字符',
  'email.templates.bodyRequired': '请填写正文',
  'email.templates.placeholders': '可用的占位符：',
  'email.templates.required': '正文里必须有：',
  'email.templates.requiredNone': '无',
  'email.templates.missing': '正文里缺少 {list}。要和列出的写得完全一样：带花括号，大小写相同。',
  'email.templates.defaultTitle': '默认文案',
  'email.templates.restore': '恢复默认',
  'email.templates.restoreAsk': '恢复默认文案？这个模板已保存的文案会被替换。',
  'email.templates.notChanged': '这个模板没有改过：现在用的就是默认文案。',
  'email.templates.saved': '已保存',
  'email.templates.restored': '已恢复默认文案',
};

export default messages;
