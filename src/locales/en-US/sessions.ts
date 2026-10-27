// Menu titles and all texts of the call pages: the session list (with its details drawer), call
// analytics and call quality.
const messages: Record<string, string> = {
  'menu.sessions.list': 'Session list',
  'menu.sessions.analytics': 'Call analytics',
  'menu.sessions.quality': 'Call quality',

  'sessions.common.guest': 'Guest',
  'sessions.common.yes': 'Yes',
  'sessions.common.no': 'No',
  'sessions.common.date': 'Date (UTC)',
  'sessions.unit.seconds': '{value} s',
  'sessions.duration.hms': '{h} h {m} min {s} s',
  'sessions.duration.ms': '{m} min {s} s',
  'sessions.duration.s': '{s} s',
  'sessions.ongoing': 'In progress',

  'sessions.endReason.DEADLINE': 'Reached the deadline',
  'sessions.endReason.USER_LEFT': 'User left',
  'sessions.endReason.ROOM_FINISHED': 'Room closed',
  'sessions.endReason.BANNED': 'Account banned',
  'sessions.endReason.SUPERSEDED': 'Replaced by a new call',
  'sessions.renderMode.DEVICE': 'Rendered on the device',
  'sessions.renderMode.CLOUD': 'Rendered in the cloud',
  'sessions.renderMode.NONE': 'Still image with audio',

  'sessions.list.note':
    'Guest sessions have no account. Their device is shown by its first 8 characters only.',
  'sessions.list.col.id': 'Session ID',
  'sessions.list.col.accountId': 'Account ID',
  'sessions.list.col.device': 'Device',
  'sessions.list.col.requestedAt': 'Requested at',
  'sessions.list.col.startedAt': 'Started at',
  'sessions.list.col.endedAt': 'Ended at',
  'sessions.list.col.duration': 'Duration',
  'sessions.list.col.modelTier': 'Model tier',
  'sessions.list.col.language': 'Language',
  'sessions.list.filter.guest': 'Guest session',
  'sessions.list.filter.ongoing': 'In progress',
  'sessions.list.filter.deadline': 'Forced end at the deadline',
  'sessions.list.filter.range': 'Requested at (UTC days)',
  'sessions.list.rangeNote':
    'The range is in UTC days: from 00:00 UTC of the first day to the end of the last day.',

  'sessions.detail.title': 'Session details',
  'sessions.detail.id': 'Session ID',
  'sessions.detail.accountId': 'Account ID',
  'sessions.detail.device': 'Device',
  'sessions.detail.freeTier': 'Free tier',
  'sessions.detail.roomName': 'Room',
  'sessions.detail.requestedAt': 'Requested at',
  'sessions.detail.timezone': 'Time zone',
  'sessions.detail.modelTier': 'Model tier',
  'sessions.detail.language': 'Language',
  'sessions.detail.renderMode': 'Render mode',
  'sessions.detail.deadlineAt': 'Deadline',
  'sessions.detail.startedAt': 'Started at',
  'sessions.detail.agentJoinedAt': 'Agent joined at',
  'sessions.detail.userJoinedAt': 'User joined at',
  'sessions.detail.userLeftAt': 'User left at',
  'sessions.detail.endedAt': 'Ended at',
  'sessions.detail.duration': 'Duration',
  'sessions.detail.endReason': 'End reason',

  'sessions.analytics.note':
    'Calls and accounts count account sessions only. Guest calls are in the daily report.',
  'sessions.analytics.col.calls': 'Calls connected',
  'sessions.analytics.col.callers': 'Accounts with a call',
  'sessions.analytics.col.minutes': 'Total call minutes',
  'sessions.analytics.col.minutesPerCaller': 'Minutes per caller',
  'sessions.analytics.col.minutesPerCaller.tip':
    'Call seconds / 60 / accounts with a call. A dash when nobody called.',
  'sessions.analytics.col.callsPerCaller': 'Calls per caller',
  'sessions.analytics.col.callsPerCaller.tip':
    'Calls connected / accounts with a call. A dash when nobody called.',
  'sessions.analytics.chart.y': 'Count / minutes',

  'stat.sessionQuality.helper.title': 'How to read this report',
  'stat.sessionQuality.helper.content':
    'Connect success rate = connected / (connected + agent unavailable). Calls blocked by a limit and users who never joined are not failures of the service, so they are counted apart. Connect time runs from the request until the agent joins the room, for connected calls only. Each call is in exactly one of the four time buckets, so the four buckets add up to the connected calls. A card gets a red frame when the figure is past its limit.',

  'sessions.quality.card.successRate': 'Connect success rate',
  'sessions.quality.card.successRate.tip':
    'connected / (connected + agent unavailable), over the whole range.',
  'sessions.quality.card.avgJoin': 'Average connect time',
  'sessions.quality.card.avgJoin.tip':
    'Sum of the connect times / connected calls, from the request until the agent joined.',
  'sessions.quality.card.le2': 'Connected within 2 s',
  'sessions.quality.card.le2.tip':
    'Connected calls that took 2 seconds or less, as a share of the connected calls.',
  'sessions.quality.card.gt10': 'Connected after more than 10 s',
  'sessions.quality.card.gt10.tip':
    'Connected calls that took more than 10 seconds, as a share of the connected calls.',
  'sessions.quality.card.limitReached': 'Calls blocked by a limit',
  'sessions.quality.card.limitReached.tip':
    'Start attempts refused because the call allowance was used up. Not a failure of the service.',
  'sessions.quality.card.notJoined': 'Users who never joined',
  'sessions.quality.card.notJoined.tip':
    'Calls dropped because the user never entered the room. Not a failure of the service.',
  'sessions.quality.card.limitMin': 'Red frame below {limit}',
  'sessions.quality.card.limitMax': 'Red frame above {limit}',

  'sessions.quality.chart.rate': 'Connect success rate by day',
  'sessions.quality.chart.rate.y': 'Success rate (%)',
  'sessions.quality.chart.buckets': 'Connect time by day',
  'sessions.quality.chart.buckets.y': 'Connected calls (count)',
  'sessions.quality.bucket.joinLe2s': '≤2 s',
  'sessions.quality.bucket.joinLe5s': '2–5 s',
  'sessions.quality.bucket.joinLe10s': '5–10 s',
  'sessions.quality.bucket.joinGt10s': '>10 s',

  'sessions.quality.col.connected': 'Connected',
  'sessions.quality.col.agentUnavailable': 'Agent unavailable',
  'sessions.quality.col.successRate': 'Success rate',
  'sessions.quality.col.avgJoin': 'Average connect time',
  'sessions.quality.col.limitReached': 'Blocked by a limit',
  'sessions.quality.col.notJoined': 'Never joined',
};

export default messages;
