const messages: Record<string, string> = {
  'menu.moderation.queue': 'Review queue',
  'menu.moderation.detail': 'Review detail',
  'menu.moderation.rules': 'Text rules',
  'menu.moderation.stats': 'Moderation statistics',

  'moderation.contentType.AVATAR': 'Avatar photo',
  'moderation.contentType.VOICE': 'Voice sample',
  'moderation.contentType.MESSAGE': 'Message',
  'moderation.contentType.PERSONA': 'Persona',
  'moderation.contentType.COMPANION_NAME': 'Companion name',
  'moderation.contentType.AVATAR_IMAGE': 'Generated standard image',
  'moderation.contentType.ACTION_CLIP': 'Action clip',

  'moderation.source.AUTO': 'Automatic',
  'moderation.source.REPORT': 'Report',
  'moderation.source.COMPLAINT': 'Complaint',

  'moderation.status.PENDING_REVIEW': 'Waiting for review',
  'moderation.status.APPROVED': 'Approved',
  'moderation.status.REJECTED': 'Rejected',
  'moderation.status.BLOCKED': 'Blocked automatically',

  'moderation.autoLevel.PASS': 'Passed',
  'moderation.autoLevel.REVIEW': 'Medium risk',
  'moderation.autoLevel.BLOCK': 'High risk',

  'moderation.reporterReason.SEXUAL': 'Sexual content',
  'moderation.reporterReason.HARASSMENT': 'Harassment',
  'moderation.reporterReason.VIOLENCE': 'Violence',
  'moderation.reporterReason.SELF_HARM': 'Self-harm',
  'moderation.reporterReason.OTHER': 'Other',

  'moderation.field.id': 'Record ID',
  'moderation.field.accountId': 'Account ID',
  'moderation.field.contentType': 'Content type',
  'moderation.field.contentRef': 'Content reference',
  'moderation.field.source': 'Source',
  'moderation.field.autoLevel': 'Automatic level',
  'moderation.field.categories': 'Categories',
  'moderation.field.score': 'Score',
  'moderation.field.providerRef': 'Service reference',
  'moderation.field.status': 'Status',
  'moderation.field.waiting': 'Waiting',
  'moderation.field.createdAt': 'Created',
  'moderation.field.reporterReason': 'Report reason',
  'moderation.field.reporterDetail': 'Additional detail',
  'moderation.field.reviewedBy': 'Handled by',
  'moderation.field.reviewedAt': 'Handled at',
  'moderation.field.note': 'Handling note',
  'moderation.field.deletedAccount': 'Account deleted',

  'moderation.duration.days': '{n} d',
  'moderation.duration.hours': '{n} h',
  'moderation.duration.minutes': '{n} min',
  'moderation.duration.seconds': '{n} s',

  'moderation.queue.oldest': 'The oldest waiting record has waited {duration}',
  'moderation.queue.oldestNone': 'No record is waiting',
  'moderation.queue.oldestFailed':
    'The waiting time of the oldest record could not be read: {message}',
  'moderation.queue.note':
    'Records that wait come first, the longest waiting at the top. Reports must really be handled.',
  'moderation.queue.view': 'Open',

  'moderation.detail.back': 'Back to the review queue',
  'moderation.detail.record': 'Record',
  'moderation.detail.report': 'Report',
  'moderation.detail.review': 'Outcome',
  'moderation.detail.notFound': 'There is no such moderation record',
  'moderation.detail.loadFailed': 'The moderation record could not be loaded: {message}',
  'moderation.detail.invalidAddress': 'This address is not a moderation record',

  'moderation.content.title': 'Reviewed content',
  'moderation.content.audited': 'Viewing is recorded: every view is written to the audit log.',
  'moderation.content.noPermission':
    'You may not view the content: it needs the permission to review moderation records.',
  'moderation.content.blocked': 'Blocked automatically; the original was not stored.',
  'moderation.content.loading': 'Loading the content…',
  'moderation.content.failed': 'The content could not be loaded: {message}',
  'moderation.content.reload': 'Load the content again',
  'moderation.content.mediaFailed':
    'The file did not play. Its address is valid for a short time only, so load the content again.',
  'moderation.content.unsupportedMedia': 'This page cannot preview this kind of file: {mediaType}',
  'moderation.content.imageAlt': 'The reviewed image',
  'moderation.content.companionNote': "This is the user's name now.",
  'moderation.content.attachedText': 'Text that belongs to the file (transcript)',

  'moderation.decision.approve': 'Approve',
  'moderation.decision.reject': 'Reject',
  'moderation.decision.approveTitle': 'Approve this record',
  'moderation.decision.rejectTitle': 'Reject this record',
  'moderation.decision.consequence': 'What this decision does:',
  'moderation.decision.noteApprove': 'Note (optional)',
  'moderation.decision.noteReject': 'Note for the rejection (required)',
  'moderation.decision.noteRequired': 'A note is required to reject',
  'moderation.decision.noteLength': 'The note can have at most {max} characters',
  'moderation.decision.confirmApprove': 'Confirm approval',
  'moderation.decision.confirmReject': 'Confirm rejection',
  'moderation.decision.approved': 'Approved',
  'moderation.decision.rejected': 'Rejected',
  'moderation.decision.stateChanged':
    'Someone else handled this record first. Its state now: {status}.',

  'moderation.effect.AVATAR.APPROVE': 'The upload task goes on to generate the avatar.',
  'moderation.effect.AVATAR.REJECT':
    "The upload task fails (content rejected) and the user's original photo is deleted.",
  'moderation.effect.AVATAR.REPORTED.APPROVE': 'The report is closed; the asset does not change.',
  'moderation.effect.AVATAR.REPORTED.REJECT':
    'The avatar asset is deleted, with its looks and action clips; the current avatar is cleared if it points to it, the files are deleted and the deletion of data held by outside services starts. The owner of the asset gets a moderation rejection notice.',
  'moderation.effect.VOICE.APPROVE': 'The upload task goes on.',
  'moderation.effect.VOICE.REJECT':
    "The upload task fails (content rejected) and the user's original voice sample is deleted.",
  'moderation.effect.VOICE.REPORTED.APPROVE': 'The report is closed; the asset does not change.',
  'moderation.effect.VOICE.REPORTED.REJECT':
    'The voice asset is deleted: the current voice is cleared if it points to it, the file is deleted and the deletion of data held by outside services starts. The owner of the asset gets a moderation rejection notice.',
  'moderation.effect.MESSAGE.APPROVE': 'The message does not change.',
  'moderation.effect.MESSAGE.REJECT':
    'The message is hidden and is synced to the clients as a tombstone.',
  'moderation.effect.PERSONA.APPROVE':
    'The pending persona replaces the persona in force (only if the user has not submitted a newer version; otherwise the record is only closed).',
  'moderation.effect.PERSONA.REJECT':
    "The pending persona is cleared, the user's persona review status becomes rejected and the user gets a moderation rejection notice (if the user has submitted a new version, the record is only closed and no notice is sent).",
  'moderation.effect.COMPANION_NAME.APPROVE': 'The name does not change.',
  'moderation.effect.COMPANION_NAME.REJECT':
    "The user's companion name is cleared and the user gets a moderation rejection notice (if the user has changed the name since, the record is only closed and no notice is sent).",
  'moderation.effect.AVATAR_IMAGE.APPROVE':
    'The generated standard image becomes the avatar or look.',
  'moderation.effect.AVATAR_IMAGE.REJECT':
    'The generation task fails (content rejected) and the result is deleted.',
  'moderation.effect.ACTION_CLIP.APPROVE': 'The action clip becomes available.',
  'moderation.effect.ACTION_CLIP.REJECT':
    'The action clip fails and its file is deleted; no in-app notice is sent.',
  'moderation.effect.UNKNOWN':
    'This page does not know what this content type does; the rules of the backend apply.',

  'moderation.rules.title': 'Text rule list',
  'moderation.rules.intro':
    'Text moderation runs this list first and then calls the moderation service. The text under review is normalised before matching: letter case is ignored and zero-width characters are removed. A regular expression has a running-time budget; one that runs over it counts as matching at the level "send to review". Content that matches a rule at "block" is not sent to the moderation service. The list has at most moderation.text_rules_max rules.',
  'moderation.rules.help.SUBSTRING':
    'Substring: matches when the text contains this string. Fits Chinese, Thai and other scripts without spaces. After normalising, look-alike letters of another script are folded and compared as the same character.',
  'moderation.rules.help.WORD':
    'Whole word: matches only when the characters before and after are not letters or digits. Fits Latin and other scripts with spaces. After normalising, look-alike letters of another script are folded and compared as the same character.',
  'moderation.rules.help.REGEX':
    'Regular expression: the backend checks on save whether it compiles (it uses Java syntax). Look-alike letters are not folded; the normalised text is matched as it is.',
  'moderation.rules.foldingNote':
    'Look-alike folding: after normalising, Substring and Whole word rules also fold look-alike letters of another script into one character (for example Cyrillic а, с, о, Greek ο, and the Turkish dotless ı folded to i). So the rule \u201cсука\u201d written in Cyrillic matches both \u201cсука\u201d and \u201cСУКА\u201d, and a word written with look-alike letters in place of Latin ones matches the rule written in Latin. ASCII letters and letters inside one script are not folded. Regular expression rules are not folded. Known side effects: the all-capitals Russian word КОТ matches the rule kot, and the Turkish rule sik matches \u201csık sık\u201d. On save, a Substring or Whole word text that is empty after normalising and folding (for example only zero-width characters) is refused.',
  'moderation.rules.patternFoldsEmpty':
    'The match text is empty once it is normalised and folded (for example it holds only zero-width characters). Write actual text.',
  'moderation.rules.index': 'No.',
  'moderation.rules.pattern': 'Match text',
  'moderation.rules.matchMode': 'Match mode',
  'moderation.rules.level': 'Level',
  'moderation.rules.note': 'Note',
  'moderation.rules.actions': 'Actions',
  'moderation.rules.matchMode.SUBSTRING': 'Substring',
  'moderation.rules.matchMode.WORD': 'Whole word',
  'moderation.rules.matchMode.REGEX': 'Regular expression',
  'moderation.rules.level.REVIEW': 'Send to review',
  'moderation.rules.level.BLOCK': 'Block',
  'moderation.rules.add': 'Add a rule',
  'moderation.rules.remove': 'Remove',
  'moderation.rules.removeConfirm':
    'Take this rule out of the list? It is not deleted until you press Save.',
  'moderation.rules.save': 'Save the list',
  'moderation.rules.discard': 'Discard changes',
  'moderation.rules.conflict': 'Modified by someone else',
  'moderation.rules.conflictDetail':
    'The rule list was saved by someone else after you opened it, so your changes were not saved. Reload shows the list they saved; what you changed here is then dropped.',
  'moderation.rules.conflictReload': 'Reload',
  'moderation.rules.saved': 'The list is saved',
  'moderation.rules.empty': 'The list is empty, so there is no rule layer.',
  'moderation.rules.unsaved': 'There are unsaved changes',
  'moderation.rules.count': '{count} rules',
  'moderation.rules.loadFailed': 'The list could not be loaded: {message}',
  'moderation.rules.saveFailed': 'Nothing was saved: {message}',
  'moderation.rules.fixRows': '{count} rows need to be corrected first; nothing was saved.',
  'moderation.rules.patternLength':
    'The match text needs 1 to {max} characters (without the white space at its ends)',
  'moderation.rules.noteLength': 'The note can have at most {max} characters',
  'moderation.rules.regexHint':
    'This browser cannot compile this regular expression. The backend uses Java syntax, which differs; the backend decides whether it is valid, and saving is not blocked here.',
  'moderation.rules.tableError': 'A problem with the list as a whole: {message}',
  'moderation.rules.params': 'Parameters',
  'moderation.rules.paramsNote':
    'The other moderation parameters. The rule list itself is edited in the table above.',

  'moderation.stats.created': 'New',
  'moderation.stats.approved': 'Approved',
  'moderation.stats.rejected': 'Rejected',
  'moderation.stats.blocked': 'Blocked automatically',
  'moderation.stats.avgHandle': 'Average handling time',
  'moderation.stats.avgHandleTip':
    'The average time from creation to handling of the records that were handled.',
  'moderation.stats.oldestPending': 'Longest wait of a record now waiting',
  'moderation.stats.byDay': 'By day, content type and source',
  'moderation.stats.date': 'Date (UTC)',
  'moderation.stats.empty': 'No records in this range',
  'moderation.stats.loadFailed': 'The moderation statistics could not be loaded: {message}',
};

export default messages;
