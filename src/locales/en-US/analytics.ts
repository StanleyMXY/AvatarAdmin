const messages: Record<string, string> = {
  'menu.analytics.summary': 'Event summary',
  'menu.analytics.detail': 'Event detail',
  'menu.analytics.funnel': 'Funnels',

  'analytics.common.query': 'Query',
  'analytics.common.eventName': 'Event name',

  'analytics.summary.pv': 'Triggers (pv)',
  'analytics.summary.uv': 'Distinct accounts (uv)',
  'analytics.summary.total': '{count} event names',
  'analytics.summary.empty': 'No events in this range',
  'analytics.summary.tip':
    'Read live from the event log, so there is no landing bar. Triggers count every event; distinct accounts count each signed-in account once.',

  'analytics.detail.accountId': 'Account ID',
  'analytics.detail.deviceId': 'Device ID',
  'analytics.detail.eventPlaceholder': 'Type or choose an event name',
  'analytics.detail.col.account': 'Account',
  'analytics.detail.col.device': 'Device',
  'analytics.detail.col.receivedAt': 'Received at',
  'analytics.detail.col.clientTime': 'Client time',
  'analytics.detail.col.platform': 'Platform',
  'analytics.detail.col.appVersion': 'App version',
  'analytics.detail.col.country': 'Country',
  'analytics.detail.col.ip': 'IP',
  'analytics.detail.receivedAtTip':
    'Time the server received the event; the statistics use this time',
  'analytics.detail.clientTimeTip':
    'Reported by the client itself, not trustworthy; for troubleshooting only',
  'analytics.detail.ipTip':
    'Shown as the backend sends it: masked unless you hold the permission to see whole IP addresses',
  'analytics.detail.params': 'Params',
  'analytics.detail.context': 'Context',
  'analytics.detail.empty': 'No events match',

  'analytics.funnel.saved': 'Saved funnel',
  'analytics.funnel.savedPlaceholder': 'Choose a saved funnel',
  'analytics.funnel.preset': 'System preset',
  'analytics.funnel.steps': 'Steps',
  'analytics.funnel.stepsPlaceholder': 'Choose or type event names, in order',
  'analytics.funnel.window': 'Window (hours)',
  'analytics.funnel.windowTip':
    'The longest time allowed between two neighbouring steps for the same account',
  'analytics.funnel.saveAs': 'Save as…',
  'analytics.funnel.edit': 'Edit',
  'analytics.funnel.delete': 'Delete',
  'analytics.funnel.deleteConfirm': 'Delete the funnel "{name}"?',
  'analytics.funnel.problem.stepCount': 'A funnel needs 2 to 10 steps',
  'analytics.funnel.problem.comma': 'An event name cannot contain a comma',
  'analytics.funnel.problem.empty': 'A step cannot be empty',
  'analytics.funnel.problem.window': 'The window is 1 to 720 hours',
  'analytics.funnel.dialog.saveAs': 'Save as a new funnel',
  'analytics.funnel.dialog.edit': 'Edit funnel',
  'analytics.funnel.dialog.hint':
    'The steps and the window now in the form are saved under this name.',
  'analytics.funnel.dialog.name': 'Name',
  'analytics.funnel.dialog.nameRequired': 'Enter a name',
  'analytics.funnel.dialog.nameLength': 'The name is at most {max} characters',
  'analytics.funnel.dialog.save': 'Save',
  'analytics.funnel.savedOk': 'Funnel saved',
  'analytics.funnel.updatedOk': 'Funnel updated',
  'analytics.funnel.deletedOk': 'Funnel deleted',
  'analytics.funnel.result.title': 'Steps and conversion',
  'analytics.funnel.result.chart': 'Funnel chart',
  'analytics.funnel.result.step': 'Step',
  'analytics.funnel.result.count': 'Distinct accounts',
  'analytics.funnel.result.conversion': 'Conversion from previous step',
  'analytics.funnel.result.empty': 'Choose the steps and press Query',
  'analytics.funnel.help.title': 'How the funnel counts',
  'analytics.funnel.help.order':
    'The same account has to complete the steps in order within the window to count. The window is the longest time allowed between two neighbouring steps.',
  'analytics.funnel.help.days':
    'Distinct counts are not added up across days: for a range of several days, the result is the number of distinct accounts in the whole range.',
  'analytics.funnel.help.anonymous':
    'Events without an account (before sign-up) are joined to the account that the same device signed in with.',
};

export default messages;
