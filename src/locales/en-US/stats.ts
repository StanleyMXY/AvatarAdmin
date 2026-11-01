const messages: Record<string, string> = {
  'stat.common.utcNotice':
    'Statistics days are UTC days and can differ from your local date by one day.',
  'stat.common.query': 'Search',
  'stat.common.today': 'Today (UTC)',
  'stat.common.yesterday': 'Yesterday (UTC)',
  'stat.common.last7': 'Last 7 days',
  'stat.common.last30': 'Last 30 days',
  'stat.common.rangeTooLong': 'At most {days} days at a time',
  'stat.common.platform': 'Platform',
  'stat.common.platform.ALL': 'All',
  'stat.common.platform.ANDROID': 'Android',
  'stat.common.platform.IOS': 'iOS',
  'stat.common.channel': 'Channel package',
  'stat.common.channelAll': 'All',
  'stat.common.channelUnknown': 'Unknown',
  'stat.common.land.date': 'Date (UTC)',
  'stat.common.land.button': 'Re-land this day',
  'stat.common.land.done': 'Re-landed {date}',
  'stat.common.land.nofillSkipped':
    'The table of the reasons for no ad was not recomputed for this day: it is kept for the last 7 UTC days only.',
  'stat.common.land.partial': 'Re-landed: {done}. Stopped at {failed}: {reason}',
  'stat.common.unit.percentPoint': 'pp',
  'stat.common.cohortDate': 'Sign-up day',
  'stat.common.cohortSize': 'Size',
  'stat.common.dayN': 'Day {n}',
  'stat.common.backfilled': 'Back-filled value',
  'stat.common.noPrevious': 'No comparison data',
  'stat.common.provisional': 'Provisional',
  'stat.common.provisional.tip': 'This day (UTC) is not over yet, so the number will still change.',
  'stat.common.provisional.changeTip':
    'One of the two days is not over yet (UTC), so this change is shown in grey and is not judged as a rise or a fall.',
  'stat.common.provisional.chartNote':
    'A hollow point is a provisional value: that day (UTC) is not over yet, so the number will still change.',
  'stat.common.provisional.columnNote':
    'A hollow point (a column with a dashed border) is a provisional value: that day (UTC) is not over yet, so the number will still change.',
};

export default messages;
