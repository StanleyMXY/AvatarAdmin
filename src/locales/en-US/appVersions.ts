const messages: Record<string, string> = {
  'menu.system.appVersions': 'App versions',
  'appVersions.rules.title': 'How a client decides whether to prompt an update',
  'appVersions.rules.none':
    'The client version number is equal to or higher than the active version: no prompt.',
  'appVersions.rules.optional':
    'It is between the minimum version number and the active version: optional update.',
  'appVersions.rules.forced': 'It is lower than the minimum version number: forced update.',
  'appVersions.rules.atMinimum': 'It is equal to the minimum version number: optional update.',
  'appVersions.filter.channel': 'Channel package',
  'appVersions.filter.platform': 'Platform',
  'appVersions.filter.status': 'Status',
  'appVersions.search': 'Search',
  'appVersions.new': 'New version',
  'appVersions.empty': 'No versions',
  'appVersions.col.channel': 'Channel package',
  'appVersions.col.platform': 'Platform',
  'appVersions.col.versionName': 'Version name',
  'appVersions.col.versionCode': 'Version number',
  'appVersions.col.minVersionCode': 'Minimum version number',
  'appVersions.col.status': 'Status',
  'appVersions.col.link': 'Store link or APK',
  'appVersions.col.createdBy': 'Created by',
  'appVersions.col.activatedAt': 'Activated at',
  'appVersions.col.actions': 'Actions',
  'appVersions.platform.ANDROID': 'Android',
  'appVersions.platform.IOS': 'iOS',
  'appVersions.distribution.STORE': 'Store',
  'appVersions.distribution.DIRECT': 'Direct download',
  'appVersions.status.DRAFT': 'Draft',
  'appVersions.status.ACTIVE': 'Active',
  'appVersions.status.ARCHIVED': 'Archived',
  'appVersions.file.summary': '{size} · SHA-256 {sha}',
  'appVersions.file.openLink': 'Open the store page',
  'appVersions.action.edit': 'Edit',
  'appVersions.action.activate': 'Activate',
  'appVersions.action.delete': 'Delete',
  'appVersions.action.deactivate': 'Take down',
  'appVersions.deleteAsk': 'Delete this draft?',
  'appVersions.deactivateAsk':
    'After it is taken down, this channel will no longer prompt users to update',
  'appVersions.saved': 'Saved',
  'appVersions.deleted': 'The draft was deleted',
  'appVersions.deactivated': 'Version {name} was taken down',
  'appVersions.activated': 'Version {name} is now active',
  'appVersions.newTitle': 'New version',
  'appVersions.editTitle': 'Edit draft',
  'appVersions.field.channel': 'Channel package',
  'appVersions.field.versionName': 'Version name',
  'appVersions.field.versionCode': 'Version number',
  'appVersions.field.minVersionCode': 'Minimum version number',
  'appVersions.field.changelog': 'Update notes',
  'appVersions.field.storeUrl': 'Store link',
  'appVersions.field.apk': 'APK file',
  'appVersions.channelFixed': 'The channel package cannot be changed after the version is created.',
  'appVersions.channelRequired': 'Choose a channel package',
  'appVersions.channelOff': '{name} (switched off)',
  'appVersions.channelLoadFailed': 'The channel packages could not be read: {message}',
  'appVersions.channelDetails': '{platform} · {distribution}',
  'appVersions.versionNameHelp': 'Written x.y.z, for example 1.2.3.',
  'appVersions.versionCodeHelp':
    'A whole number: the versionCode of Android, the build number of iOS.',
  'appVersions.activeHint':
    'The version active in this channel now: {code}. It comes from the list for your information; the server decides.',
  'appVersions.activeNone': 'No version is active in this channel.',
  'appVersions.activeUnknown':
    'The versions of this channel could not be read, so the version number is not compared here; the server decides.',
  'appVersions.floorHint':
    'A new number must be higher than the highest number of the other versions of this channel (drafts and taken-down versions included): {max}. From the list, for your information.',
  'appVersions.minVersionCodeHelp':
    'Users whose version number is lower than this will be forced to update.',
  'appVersions.changelogHelp': 'One tab for each language. English is required.',
  'appVersions.changelogRequiredTab': 'required',
  'appVersions.storeUrlHelpAndroid':
    'Use https:// then play.google.com/store/apps/details?id={package}. Only hl and gl may be added.',
  'appVersions.storeUrlHelpIos':
    'An App Store link: https:// then apps.apple.com/us/app/name/id123456789 or apps.apple.com/app/id123456789.',
  'appVersions.storeUrlHelpUnknownPackage': 'the package name of the channel',
  'appVersions.storeUrlRequired': 'Enter the store link',
  'appVersions.apk.url': 'Address',
  'appVersions.apk.size': 'Size',
  'appVersions.apk.sha256': 'SHA-256',
  'appVersions.apk.help':
    'Upload the APK first. It must carry a v2 or later signature. The address, size and checksum are read from the file by the server and cannot be edited.',
  'appVersions.apk.current': 'The file this draft has now. Choose another file to replace it.',
  'appVersions.apk.wait': 'The file is still uploading. The form can be sent when it is done.',
  'appVersions.apk.required': 'Upload the APK first',
  'appVersions.apk.rejected':
    'The server did not accept this file for the version. Upload it again.',
  'appVersions.state.DISABLED':
    'This channel package is switched off, so versions cannot be added, edited or activated in it. Switch the channel package on first.',
  'appVersions.state.version':
    'The state of this version is "{state}" now, and this action is not possible in that state. Reload the list to see the current state.',
  'appVersions.state.CONSUMED':
    'This APK upload has already been used by another version. Upload the file again.',
  'appVersions.ref.status': 'New state',
  'appVersions.ref.confirmStoreLive': 'Store confirmation',
  'appVersions.refusalLine': '{field}: {reason}',
  'appVersions.noteRefused': 'The notes of this language were refused. Open the tab to see why.',
  'appVersions.changelogLanguageReason': '{language}: {reason}',
  'appVersions.activate.confirmRequired':
    'Tick the box to confirm that the new version is already visible to users in the store.',
  'appVersions.apk.unavailable': 'Set upload.public_base_url in the system configuration first.',
  'appVersions.apk.openConfig': 'Open the system configuration',
  'appVersions.rule.versionName':
    'Write the version name as x.y.z, three numbers separated by dots, at most 32 characters',
  'appVersions.rule.versionCodeWhole': 'Enter a whole number from 1 to 2147483647',
  'appVersions.rule.versionCodeAbove':
    'It must be higher than {max}, the highest version number of the other versions of this channel (drafts and taken-down versions included)',
  'appVersions.rule.minWhole': 'Enter a whole number from 1 to 2147483647',
  'appVersions.rule.minAbove': 'It must not be higher than the version number {versionCode}',
  'appVersions.rule.changelogEn': 'The English update notes are required',
  'appVersions.rule.changelogTooLong': 'The notes in {tag} have more than 4000 characters',
  'appVersions.rule.changelogTooMany': 'The notes can have at most 30 languages',
  'appVersions.rule.changelogKey':
    'The language {tag} is not a language tag of at most 35 characters, such as th, zh-Hans or es-419',
  'appVersions.storeUrl.empty': 'Enter the store link',
  'appVersions.storeUrl.platform': 'The platform of the channel is not known',
  'appVersions.storeUrl.androidHost': 'The host must be exactly play.google.com',
  'appVersions.storeUrl.iosHost': 'The host must be exactly apps.apple.com',
  'appVersions.storeUrl.port': 'A port is not allowed',
  'appVersions.storeUrl.fragment': 'A fragment (#…) is not allowed',
  'appVersions.storeUrl.androidPath': 'The path must be /store/apps/details',
  'appVersions.storeUrl.iosPath':
    'The path must look like /us/app/name/id123456789 or /app/id123456789',
  'appVersions.storeUrl.queryKey': 'Only the parameters id, hl and gl are allowed',
  'appVersions.storeUrl.duplicateParam': 'A parameter may appear only once',
  'appVersions.storeUrl.idMissing': 'The link needs the parameter id',
  'appVersions.storeUrl.idMismatch': 'The id must be the package name of the channel',
  'appVersions.storeUrl.idInvalid': 'The id does not look like an application id',
  'appVersions.storeUrl.langParam': 'hl and gl take a language or region such as en, pt-BR or US',
  'appVersions.activate.title': 'Activate version {name}',
  'appVersions.activate.submit': 'Activate',
  'appVersions.activate.only':
    'After activation this will be the only active version of the channel {channel}.',
  'appVersions.activate.consequence':
    'Every user of the channel is told that a new version is available and is taken to the store. If the new version is not yet visible to users in the store, they reach a store page without it, and a user who is forced to update cannot use the app until it appears.',
  'appVersions.activate.confirmLive': 'The new version is already visible to users in the store',
  'appVersions.activate.reading':
    'Reading the version that is active in this channel now. Activating is possible when it is back.',
  'appVersions.activate.strong':
    'Warning: the minimum version number {min} is higher than the version number {active} that is active now. Users who already have the newest version will be forced to update, and they cannot use the app until the new version can be installed from the store.',
  'appVersions.activate.strongUnknown':
    'The version active now could not be read, so it is not known whether the minimum version number {min} forces users who have the newest version to update. Check it before you confirm.',
  'appVersions.activate.minimum':
    'Users whose version number is lower than {min} will be forced to update.',
  'appVersions.activate.direct':
    'After activation, users of this channel will be prompted to download this APK.',
  'appVersions.activate.notAbove':
    'The version number {code} is not higher than {max}, the highest number of the versions of this channel that have been active (taken-down ones included). The server will refuse it.',
};

export default messages;
