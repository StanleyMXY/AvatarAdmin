const messages: Record<string, string> = {
  // ---- menu ----
  'menu.config.client': 'Client configuration',

  // ---- the page ----
  'clientConfig.page.notice': 'A link entry that is not configured is not shown in the app.',
  'clientConfig.page.hint':
    'Click a row to edit it. The values of a key in all its languages are saved as a whole.',
  'clientConfig.col.key': 'Key',
  'clientConfig.col.desc': 'Description',
  'clientConfig.col.type': 'Type',
  'clientConfig.col.localized': 'Per language',
  'clientConfig.col.configured': 'Configured',
  'clientConfig.col.usage': 'Where the client uses it',
  'clientConfig.col.actions': 'Actions',
  'clientConfig.yes': 'Yes',
  'clientConfig.no': 'No',
  'clientConfig.configured.yes': 'Configured',
  'clientConfig.configured.no': 'Not configured',
  'clientConfig.readOnly.tag': 'Read only',
  'clientConfig.readOnly.note':
    'Decided by the {source} setting; change it in System configuration',
  'clientConfig.readOnly.noteGeneric':
    'Decided by the system configuration; change it in System configuration',
  'clientConfig.readOnly.link': 'Open System configuration',
  'clientConfig.derived.note':
    'This key is a list derived by the system; it cannot be edited here.',
  'clientConfig.type.URL': 'Link (URL)',
  'clientConfig.type.EMAIL': 'E-mail (EMAIL)',
  'clientConfig.type.STRING': 'Text (STRING)',
  'clientConfig.type.BOOLEAN': 'Switch (BOOLEAN)',
  'clientConfig.type.INT': 'Integer (INT)',
  'clientConfig.type.STRING_LIST': 'Text list (STRING_LIST)',
  'clientConfig.edit': 'Edit',
  'clientConfig.view': 'View',
  'clientConfig.empty': 'No registered keys',

  // ---- the editor ----
  'clientConfig.editor.title': 'Client configuration: {key}',
  'clientConfig.editor.default': 'Default',
  'clientConfig.editor.defaultHelp':
    'The value without a language; it is used when another language has none of its own.',
  'clientConfig.editor.notLocalized':
    'This key is not per language; it has only the default value.',
  'clientConfig.editor.empty': 'This key has no value yet.',
  'clientConfig.editor.addDefault': 'Add the default value',
  'clientConfig.editor.addLanguage': 'Add language',
  'clientConfig.editor.languagePlaceholder': 'Language tag, for example th or zh-Hans',
  'clientConfig.editor.languageInvalid':
    'Not a valid language tag (for example th or zh-Hans, at most 35 characters)',
  'clientConfig.editor.languageDuplicate': 'This language is already added',
  'clientConfig.editor.removeLanguage': 'Remove the value of this language',
  'clientConfig.editor.removeHelp': 'After saving, this language uses the default value.',
  'clientConfig.editor.valueLabel': 'Value ({language})',
  'clientConfig.editor.valueOn': 'On',
  'clientConfig.editor.valueOff': 'Off',
  'clientConfig.editor.urlPlaceholder': 'https://…',
  'clientConfig.editor.tabError': 'has an error',
  'clientConfig.editor.problems':
    '{count, plural, one {# language has} other {# languages have}} a value that did not pass the check; the whole key was not saved.',
  'clientConfig.editor.noValue': 'At least one value is needed; to delete all values, use Reset.',
  'clientConfig.editor.refused': 'The backend did not accept it; the whole key was not saved.',
  'clientConfig.editor.save': 'Save',
  'clientConfig.editor.conflict': 'Modified by someone else',
  'clientConfig.editor.conflictDetail':
    'This key was changed by someone else after you opened it, so your changes were not saved. Reload shows what they saved; what you changed here is then dropped.',
  'clientConfig.editor.conflictReload': 'Reload',
  'clientConfig.editor.saved': 'Saved',
  'clientConfig.editor.unchanged': 'No changes',
  'clientConfig.editor.updated': 'Last changed by {who}, {when}',
  'clientConfig.editor.values': 'Values by language',
  'clientConfig.problem.READ_ONLY': 'This key is not edited here',

  // ---- reset ----
  'clientConfig.reset.button': 'Reset',
  'clientConfig.reset.confirm':
    'Delete the values of {key} in every language? The client goes back to the default.',
  'clientConfig.reset.done': 'Reset done',
  'clientConfig.reset.nothing': 'This key is not configured; there is no value to reset.',

  // ---- the preview ----
  'clientConfig.preview.title': 'Preview',
  'clientConfig.preview.help': 'Pick a language to see the value the client really gets.',
  'clientConfig.preview.language': 'Language',
  'clientConfig.preview.value': 'The value the client gets',
  'clientConfig.preview.source': 'Source',
  'clientConfig.preview.source.LANGUAGE': 'That language',
  'clientConfig.preview.source.DEFAULT': 'Default value',
  'clientConfig.preview.source.UNSET': 'Not configured',
  'clientConfig.preview.from.LANGUAGE': 'Taken from the value of language {tag}',
  'clientConfig.preview.from.DEFAULT_ROW': 'Taken from the default value without a language',
  'clientConfig.preview.from.DEFAULT_REGISTERED': 'Taken from the registered default',
  'clientConfig.preview.from.UNSET': 'No value: the client treats it as "entry not shown"',
  'clientConfig.preview.unsaved': 'The preview includes changes that are not saved yet.',

  // ---- the registered keys: what each is, where the client uses it, where a read-only one comes from ----
  'clientConfig.privacyPolicyUrl.desc': 'Link to the privacy policy page, per language',
  'clientConfig.privacyPolicyUrl.usage':
    'The privacy policy entry on the sign-in page and in settings',
  'clientConfig.termsOfServiceUrl.desc': 'Link to the terms of service page, per language',
  'clientConfig.termsOfServiceUrl.usage':
    'The terms of service entry on the sign-in page and in settings',
  'clientConfig.communityGuidelinesUrl.desc': 'Link to the community guidelines page, per language',
  'clientConfig.communityGuidelinesUrl.usage':
    'The community guidelines entry on the report page and in settings',
  'clientConfig.supportUrl.desc': 'Link to the help and feedback page, per language',
  'clientConfig.supportUrl.usage':
    'The help and feedback entry in settings; the appeal entry of the banned page when there is no support e-mail',
  'clientConfig.supportEmail.desc': 'Support e-mail address',
  'clientConfig.supportEmail.usage':
    'The support e-mail entry; the appeal entry of the banned page prefers it',
  'clientConfig.accountDeletionUrl.desc':
    'Link to the page for deleting an account on the web, per language',
  'clientConfig.accountDeletionUrl.usage':
    'The "delete account on the web" entry in settings and the delete entry of the banned page',
  'clientConfig.inviteLinkBase.desc':
    'Root address of the invitation link: the server adds "?code=" and the invitation code to it. It must not have a query or a fragment',
  'clientConfig.inviteLinkBase.usage':
    'The server builds the invitation link, the client does not; without it the invitation link is empty and the invitation entry is not available',
  'clientConfig.inviteShareText.desc':
    "Share text of the invitation page, per language. The only placeholders are '{link}' (the invitation link) and '{code}' (the invitation code); any other placeholder in braces is refused; at most 500 characters",
  'clientConfig.inviteShareText.usage':
    "The share text of the invitation page; when the text has no '{link}', the client adds the invitation link on a new line after it",
  'clientConfig.inviteShareTitle.desc':
    'Title of the share dialog of the invitation page, per language, at most 200 characters',
  'clientConfig.inviteShareTitle.usage':
    'The title of the share dialog of the invitation page; without it the client uses its own text',
  'clientConfig.phoneLoginEnabled.desc': 'Whether sign-in with a phone number is on',
  'clientConfig.phoneLoginEnabled.usage': 'Whether the sign-in page shows the phone number entry',
  'clientConfig.phoneLoginEnabled.source': 'auth.phone_login_enabled',
  'clientConfig.accountDeletionGraceDays.desc': 'Days of grace before an account is deleted',
  'clientConfig.accountDeletionGraceDays.usage':
    'The deletion confirmation page writes the days of grace',
  'clientConfig.accountDeletionGraceDays.source': 'deletion.grace_days',
  'clientConfig.conversationLanguages.desc': 'Languages a call can use',
  'clientConfig.conversationLanguages.usage':
    'A guest must give a valid language to start a call and gets the list from here before sign-in; a signed-in user still gets it from the language endpoint',
  'clientConfig.conversationLanguages.source': 'chat.conversation_languages',
  'clientConfig.voiceTranscriptMaxChars.desc':
    'Most characters of the text read aloud on the voice cloning page',
  'clientConfig.voiceTranscriptMaxChars.usage':
    'The character limit of the text box for the reading text on the voice cloning page; the client warns above it',
  'clientConfig.voiceTranscriptMaxChars.source': 'voice.transcript_max_chars',
  'clientConfig.voiceMinSeconds.desc': 'Shortest recording or chosen audio, in seconds',
  'clientConfig.voiceMinSeconds.usage':
    'The shortest recording or chosen audio on the voice cloning page; below it the client warns and does not upload',
  'clientConfig.voiceMinSeconds.source': 'generation.voice_min_seconds',
  'clientConfig.voiceMaxSeconds.desc': 'Longest recording or chosen audio, in seconds',
  'clientConfig.voiceMaxSeconds.usage':
    'The longest recording (recording stops by itself then) and chosen audio; above it the client warns and does not upload',
  'clientConfig.voiceMaxSeconds.source': 'generation.voice_max_seconds',
  'clientConfig.drivingLookaheadMs.desc':
    'Audio the client must have received before a speech starts to play, in milliseconds',
  'clientConfig.drivingLookaheadMs.usage':
    'The phone works out the mouth shape from the audio: before a speech starts, the client needs at least this many milliseconds of its beginning',
  'clientConfig.renderTierLocalMinFps.desc':
    'Device tier: lowest average frame rate of the local speed test',
  'clientConfig.renderTierLocalMinFps.usage':
    'The local render tier is used only when the local test reaches this average frame rate',
  'clientConfig.renderTierMaxMemoryMb.desc':
    'Device tier: memory threshold for local rendering, in MB',
  'clientConfig.renderTierMaxMemoryMb.usage':
    'Device tier: the memory threshold for local rendering',
  'clientConfig.avatarCacheMaxMb.desc':
    'Largest local cache for drive packages and action clips, in MB',
  'clientConfig.avatarCacheMaxMb.usage':
    'The total local cache of drive packages and action clips; the least recently used go first, the current look never',
};

export default messages;
