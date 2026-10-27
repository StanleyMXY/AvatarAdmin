const messages: Record<string, string> = {
  'menu.system.channels': 'Channel packages',
  'channels.new': 'New channel package',
  'channels.empty': 'No channel packages',
  'channels.note':
    'A channel package is the release of one app for one platform and one source. It scopes the versions, the statistics and the campaigns. There is no delete: switch a channel off instead.',
  'channels.col.code': 'Channel code',
  'channels.col.name': 'Name',
  'channels.col.platform': 'Platform',
  'channels.col.distribution': 'Distribution',
  'channels.col.packageName': 'Package name',
  'channels.col.enabled': 'Enabled',
  'channels.col.createdAt': 'Created at',
  'channels.col.actions': 'Actions',
  'channels.platform.ANDROID': 'Android',
  'channels.platform.IOS': 'iOS',
  'channels.distribution.STORE': 'Store',
  'channels.distribution.DIRECT': 'Direct download',
  'channels.action.edit': 'Edit',
  'channels.enabledOf': 'Enabled: {name}',
  'channels.disableAsk':
    'Switch off {name}? It will stop prompting users to update, and no version can be created or activated in it until it is switched on again.',
  'channels.disableConfirm': 'Switch off',
  'channels.saved': 'Saved',
  'channels.created': 'Channel package {code} was created',
  'channels.newTitle': 'New channel package',
  'channels.editTitle': 'Edit channel package {code}',
  'channels.field.code': 'Channel code',
  'channels.field.name': 'Name',
  'channels.field.platform': 'Platform',
  'channels.field.distribution': 'Distribution',
  'channels.field.packageName': 'Package name',
  'channels.codeHelp':
    '2 to 32 characters: lower-case letters, digits, hyphen and underscore. It cannot be changed after the channel is created.',
  'channels.fixedHelp': 'Cannot be changed after the channel is created.',
  'channels.packageHelp':
    'The application id of Android or the bundle id of iOS. The store link of a version is compared with it.',
  'channels.directHelp': 'A direct download is an Android file, so it cannot be used with iOS.',
  'channels.rule.code': 'Use 2 to 32 characters: lower-case letters, digits, hyphen or underscore',
  'channels.rule.codeReserved': 'unknown is reserved for "no channel" in the statistics',
  'channels.rule.codeExists': 'A channel package with this code exists already',
  'channels.rule.nameRequired': 'Enter a name',
  'channels.rule.packageName':
    'A package name is written with letters, digits, dots, hyphens and underscores only',
  'channels.rule.platformRequired': 'Choose a platform',
  'channels.rule.distributionRequired': 'Choose a distribution',
};

export default messages;
