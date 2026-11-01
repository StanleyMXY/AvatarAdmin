const messages: Record<string, string> = {
  'menu.complaints.likeness': '照片里的人投诉',

  'complaints.findNote':
    '怎么找到对应的形象还没有定：在法律意见出来之前，只能按投诉人提供的上传者信息人工查找。',
  'complaints.params': '参数',
  'complaints.overdue': '已超期',
  'complaints.detail': '详情',
  'complaints.detail.title': '投诉',

  'complaints.col.id': '投诉 ID',
  'complaints.col.contactEmail': '联系邮箱',
  'complaints.col.receivedAt': '收到时间',
  'complaints.col.dueAt': '到期时间',
  'complaints.col.resolvedAt': '结案时间',
  'complaints.col.status': '状态',
  'complaints.col.handledBy': '处理人',
  'complaints.col.description': '说明',
  'complaints.col.relatedAvatars': '关联的形象 ID',
  'complaints.col.actions': '操作',

  'complaints.status.RECEIVED': '已收到',
  'complaints.status.INVESTIGATING': '调查中',
  'complaints.status.RESOLVED_REMOVED': '已删除形象',
  'complaints.status.RESOLVED_NOT_FOUND': '查无此形象',
  'complaints.status.REJECTED': '驳回',
  // a choice of the filter only, not a state a complaint has: received and investigating together
  'complaints.filter.OPEN': '未结案',

  'complaints.evidence.title': '证据文件',
  'complaints.evidence.none': '没有证据文件。',
  'complaints.evidence.logged': '查看证据文件会被记录到审计日志，每次都记。',
  'complaints.evidence.file': '文件 {n}',
  'complaints.evidence.notFound': '证据不存在。',
  'complaints.evidence.badAddress': '文件地址不是可以打开的地址。',
  'complaints.evidence.unsupported': '这种类型的文件不能在这里查看。',

  'complaints.event.title': '处理记录',
  'complaints.event.time': '时间',
  'complaints.event.change': '变化',
  'complaints.event.note': '备注',
  'complaints.event.admin': '管理员',
  'complaints.event.empty': '还没有变化。',

  'complaints.manage.title': '处理',
  'complaints.status.newStatus': '新状态',
  'complaints.status.note': '备注',
  'complaints.status.noteHint': '选填，最多 {max} 个字符。',
  'complaints.status.submit': '更改状态',
  'complaints.status.saved': '状态已更改。',
  'complaints.note.length': '备注最多 {max} 个字符。',
  'complaints.remove.intro': '按形象 ID 删除查到的形象（可以填多个）。删除后这条投诉算已结案。',
  'complaints.remove.ids': '形象 ID',
  'complaints.remove.placeholder': '输入或粘贴一个 ID 后按回车',
  'complaints.remove.button': '删除形象',
  'complaints.remove.confirm':
    '会删除这些形象及其全部外观、动作片段和文件，上传者会收到内容被拒的站内通知，不能撤销。',
  'complaints.remove.done': '形象已删除。',
};

export default messages;
