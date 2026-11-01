// Texts of the overview (/dashboard, keys menu.dashboard.* and dashboard.*) and, because the
// statistics menu has no language file that the daily and retention report may write, the menu
// titles and texts of those two reports (keys menu.stats.*, stat.daily.*, stat.retention.*,
// stat.reactivation.*). Every key is defined once.
const messages: Record<string, string> = {
  'menu.stats.daily': 'Daily report',
  'menu.stats.retention': 'Retention report',

  'stat.daily.tab.trend': 'Trend chart',
  'stat.daily.tab.detail': 'Data detail',
  'stat.daily.metrics': 'Metrics',
  'stat.daily.metricsPlaceholder': 'Choose the metrics to draw',
  'stat.daily.noPlatformOption': 'no platform dimension',
  'stat.daily.noPlatformNote':
    'These metrics have no platform dimension. They have a value only when the platform is All; here they show a dash.',
  'stat.daily.backfilled': 'Back-filled',
  'stat.daily.date': 'Date (UTC)',

  'stat.daily.col.dau': 'DAU',
  'stat.daily.col.dau.tip':
    'Accounts with any client event that day. Events the backend produces itself do not count.',
  'stat.daily.col.wau': 'WAU',
  'stat.daily.col.wau.tip':
    'Distinct accounts with any client event in the last 7 UTC days up to and including this day. Distinct counts cannot be added across days.',
  'stat.daily.col.mau': 'MAU',
  'stat.daily.col.mau.tip':
    'Distinct accounts with any client event in the last 30 UTC days up to and including this day. Distinct counts cannot be added across days.',
  'stat.daily.col.dauDevices': 'Device DAU',
  'stat.daily.col.dauDevices.tip':
    'Distinct devices with any client event that day, including anonymous devices that have no account yet.',
  'stat.daily.col.newAccountsRegistered': 'New accounts',
  'stat.daily.col.guestDevicesNew': 'New guest devices',
  'stat.daily.col.guestDevicesNew.tip':
    'Counted on the day a device first appears; reinstalling the app creates a new device record.',
  'stat.daily.col.guestDevicesConverted': 'Guest devices signed up',
  'stat.daily.col.avatarCreatedAccounts': 'Accounts that created an avatar',
  'stat.daily.col.voiceClonedAccounts': 'Accounts that cloned a voice',
  'stat.daily.col.sessionStartedAccounts': 'Accounts that started a call',
  'stat.daily.col.sessionsConnected': 'Calls connected',
  'stat.daily.col.sessionsConnected.tip':
    'Calls of accounts only; guest calls have their own column.',
  'stat.daily.col.accountsWithCall': 'Accounts with a call',
  'stat.daily.col.callMinutesTotal': 'Call minutes',
  'stat.daily.col.callMinutesPerAccount': 'Minutes per caller',
  'stat.daily.col.messagesUser': 'User messages',
  'stat.daily.col.messagesAssistant': 'Assistant messages',
  'stat.daily.col.newSubscriptions': 'New subscriptions',
  'stat.daily.col.activeSubscriptions': 'Active subscriptions',
  'stat.daily.col.activeSubscriptions.tip':
    'Active subscriptions at the end of the day (a day-end snapshot, production only). Today and days without a snapshot show a dash; a value marked Back-filled is an approximation from the current state. For a channel package the number is always a dash (the snapshot has no channel), which is not a missing snapshot.',
  'stat.daily.col.creditPurchases': 'Credit purchases',
  'stat.daily.col.creditsSpent': 'Credits spent',
  'stat.daily.col.guestSessionsConnected': 'Guest calls connected',
  'stat.daily.col.guestCallMinutesTotal': 'Guest call minutes',

  'stat.retention.tab.active': 'Active retention',
  'stat.retention.tab.call': 'Call retention',
  'stat.retention.tab.reactivation': 'Reactivation',
  'stat.retention.days': 'Retention days',
  'stat.retention.dayOption': 'D{n}',
  'stat.retention.silenceDays': 'Silent days',
  'stat.retention.silenceOption': '{n} days',
  'stat.retention.land.date': 'Check day (UTC)',
  'stat.retention.land.hint': 'Fills the cells of each N that fall on that day, not the whole row.',
  'stat.retention.helper.title': 'How to read this report',
  'stat.retention.helper.content':
    'A cohort is the day the account was registered; the guest period before registration does not count (guests have their own guest retention). Day N means the account was still active on exactly day N after registration, that is, it had any client event that day, not on any day within N days; the percentage is divided by the cohort size. Events the backend produces itself (such as pushes) do not count as activity. A dash means that day has not come yet; it is not 0%. The cohort size is fixed when the cohort day is landed, while D30, D60 and D90 land later and count only the accounts that still exist, so accounts deleted from a cohort afterwards make those cells lower.',

  'stat.reactivation.col.date': 'Day (UTC)',
  'stat.reactivation.col.silentUsers': 'Silent users',
  'stat.reactivation.col.reactivated': 'Reactivated users',
  'stat.reactivation.col.rate': 'Reactivation rate',
  'stat.reactivation.chart.rate': 'Reactivation rate',
  'stat.reactivation.chart.count': 'Reactivated users',
  'stat.reactivation.helper.title': 'How to read this report',
  'stat.reactivation.helper.content':
    'Silent users are accounts registered before the day minus the silent days that had no client event at all in the silent days before the day. Reactivated users are those among them with any client event on the day itself. The rate is reactivated users divided by silent users; with no silent users it is a dash. Events the backend produces itself (such as pushes) do not count as activity. Reactivation is not split by platform.',

  // Overview /dashboard (spec 5.1).
  'menu.dashboard.overview': 'Overview',
  'dashboard.explain.landInterval':
    "Today's figures are provisional and are refreshed every {minutes} minutes.",
  'dashboard.explain.provisional': "Today's figures are provisional.",
  'dashboard.empty': 'No overview card is available for your account.',
  'dashboard.metric.dau': 'Daily active users',
  'dashboard.metric.newAccounts': 'New accounts',
  'dashboard.metric.callMinutes': 'Call minutes',
  'dashboard.metric.d1': 'D1 retention',
  'dashboard.card.newSubscriptions': 'New subscriptions',
  'dashboard.card.guestConverted': 'Guest devices converted',
  'dashboard.card.d1.cohort': 'Cohort {date}',
  'dashboard.card.moderation': 'Moderation backlog',
  'dashboard.card.moderation.caption': 'Longest wait of a pending record',
  'dashboard.card.moderation.none': 'Nothing is waiting.',
  'dashboard.card.moderation.open': 'Open the queue',
  'dashboard.card.alerts': 'Open alerts',
  'dashboard.card.alerts.open': 'View alerts',
  'dashboard.card.loadFailed': 'Failed to load: {message}',
  'dashboard.change.vsYesterday': 'vs yesterday',
  'dashboard.change.vs7Days': 'vs 7 days ago',
  'dashboard.trend.partialFailed':
    'Not shown, because they could not be read: {metrics}. {message}',
  'dashboard.trend.title': 'Trend',
  'dashboard.trend.metrics': 'Metrics',
  'dashboard.trend.lastWeek': '{metric} (same period last week)',
  'dashboard.range.today': 'Today',
  'dashboard.range.last7': 'Last 7 days',
  'dashboard.range.last14': 'Last 14 days',
  'dashboard.range.last30': 'Last 30 days',
  'dashboard.range.custom': 'Custom',
  'dashboard.axis.accounts': 'Accounts',
  'dashboard.axis.minutes': 'Minutes',
  'dashboard.axis.percent': '%',
  'dashboard.platform.title': "Platform split (today's DAU)",
  'dashboard.platform.empty': 'No per-platform active users for today yet.',
  'dashboard.quick.title': 'Quick links',
  'dashboard.quick.daily': 'Daily report',
  'dashboard.quick.retention': 'Retention',
  'dashboard.quick.guest': 'Guest statistics',
  'dashboard.quick.quality': 'Call quality',
  'dashboard.quick.subscriptions': 'Subscription statistics',
};

export default messages;
