// Menu title and all texts of the guest statistics page (/stat/guest).
const messages: Record<string, string> = {
  'menu.stats.guest': '游客统计',

  'stat.guest.devicesNote': '游客在服务端没有账号，这里统计的是设备，不是账号。',
  'stat.guest.tab.daily': '游客日报',
  'stat.guest.tab.cohort': '转化进度队列',
  'stat.guest.tab.retention': '游客留存',
  'stat.guest.tab.quota': '额度使用',

  'stat.guest.land.date': '检查日（UTC）',
  'stat.guest.land.hint':
    '游客日报重算该日的汇总；转化进度和游客留存会回填该日对应的各个 N 的格子，不是整行重算。',

  'stat.guest.daily.date': '日期',
  'stat.guest.daily.new': '新增游客设备',
  'stat.guest.daily.new.tip': '按设备第一次出现的日期计，重装应用会产生新的设备记录。',
  'stat.guest.daily.converted': '游客设备转注册',
  'stat.guest.daily.converted.tip': '当天转注册的设备数，这些设备不一定是当天新增的。',
  'stat.guest.daily.rate': '当日转化率',
  'stat.guest.daily.rate.tip':
    '今天转注册的设备数 ÷ 今天新增的游客设备数。这不是同一批设备的转化率：转注册的设备可能是前几天出现的，所以可能超过 100%；同一批设备的转化进度看“转化进度队列”。新增为 0 时不显示。',

  'stat.guest.cohort.date': '设备首次出现日',
  'stat.guest.cohort.size': '基数设备数',
  'stat.guest.cohort.cell': '{count} · {percent}',
  'stat.guest.cohort.cellDelta': '{count} · {percent}（{delta}）',
  'stat.guest.cohort.note':
    '每格是该队列累计转注册的设备数和占基数的百分比，括号里的加号是比前一列新增的设备数；“—”表示这一天还没到。',
  'stat.guest.cohort.distribution': '转化耗时分布',
  'stat.guest.cohort.distribution.tip':
    '各档是相邻两列累计值之差，按各队列求和；还没到期的格子不计入，避免低估延迟转化。',
  'stat.guest.cohort.stack': '按队列日的转化耗时构成',
  'stat.guest.cohort.stack.tip': '不是按来源分：游客转化表没有来源维度。',
  'stat.guest.bucket.D0': '同日',
  'stat.guest.bucket.D1': 'D1',
  'stat.guest.bucket.D2': 'D2',
  'stat.guest.bucket.D3': 'D3',
  'stat.guest.bucket.D4-D5': 'D4–D5',
  'stat.guest.bucket.D6-D7': 'D6–D7',
  'stat.guest.bucket.D8-D14': 'D8–D14',
  'stat.guest.bucket.D15-D30': 'D15–D30',
  'stat.guest.segment.D0': '同日',
  'stat.guest.segment.D1': '次日',
  'stat.guest.segment.D2': '第 2 日',
  'stat.guest.segment.D3-later': '第 3 日及以后',

  'stat.guest.retention.cohortDate': '设备首次出现日',
  'stat.guest.retention.cohortSize': '设备数',
  'stat.guest.retention.days': '留存天数',
  'stat.guest.retention.note':
    'cohort 是设备第一次出现的那一天，已转注册的设备照常计入，没有通过设备校验的设备不在内。Dn 表示第 N 天当天设备仍有任意客户端事件，百分比的分母是基数设备数。',

  'stat.guest.quota.configured': '当前游客额度',
  'stat.guest.quota.configured.tip': '只影响之后发放的设备，已发放的设备按各自发放时的额度计。',
  'stat.guest.quota.notConfigured': '未配置，游客不能通话',
  'stat.guest.quota.minutes': '{n} 分钟',
  'stat.guest.quota.devices': '设备数',
  'stat.guest.quota.noGrant': '没有额度的设备数',
  'stat.guest.quota.noGrant.tip': '发放的额度为空或为 0 的设备。',
  'stat.guest.quota.neverCalled': '从未通话占比',
  'stat.guest.quota.neverCalled.tip': '有额度而一秒都没用的设备数 ÷（设备数 − 没有额度的设备数）。',
  'stat.guest.quota.exhausted': '用完额度占比',
  'stat.guest.quota.exhausted.tip': '已用秒数不小于额度的设备数 ÷（设备数 − 没有额度的设备数）。',
  'stat.guest.quota.avgUsed': '人均已用分钟',
  'stat.guest.quota.avgUsed.tip': '有额度的设备的平均已用时长。',
  'stat.guest.quota.configLink': '去系统配置修改游客通话总额度',
  'stat.guest.quota.chart': '按已用额度分档的设备数',
  'stat.guest.quota.table': '分档转化',
  'stat.guest.quota.bucket': '档位',
  'stat.guest.quota.bucket.tip':
    '每台设备按发放时的额度分档，运营改过额度数值只影响之后发放的设备。',
  'stat.guest.quota.bucket.ZERO': '未使用',
  'stat.guest.quota.bucket.LE_25': '0–25%',
  'stat.guest.quota.bucket.LE_50': '25%–50%',
  'stat.guest.quota.bucket.LE_75': '50%–75%',
  'stat.guest.quota.bucket.LT_100': '75%–100%（不含）',
  'stat.guest.quota.bucket.GE_100': '用完（≥100%）',
  'stat.guest.quota.col.devices': '设备数',
  'stat.guest.quota.col.converted': '转注册设备数',
  'stat.guest.quota.col.converted.tip': '转注册指这台设备后来注册了账号。',
  'stat.guest.quota.col.rate': '转化率',
};

export default messages;
