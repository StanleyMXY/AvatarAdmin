const messages: Record<string, string> = {
  // ---- menu ----
  'menu.users.notifications': 'In-app notifications',

  // ---- the page ----
  'notifications.page.scope':
    'Messages here go to the accounts you name. To message all users, use a manual push task in Push management.',
  'notifications.page.scopeLink': 'Open manual push tasks',
  'notifications.page.timeNote': 'The time range counts UTC days.',
  'notifications.filter.accountId': 'Account ID',
  'notifications.filter.category': 'Category',
  'notifications.filter.isRead': 'Read state',
  'notifications.filter.range': 'Time range (UTC)',
  'notifications.filter.search': 'Search',
  'notifications.send.open': 'Send notifications',
  'notifications.read.yes': 'Read',
  'notifications.read.no': 'Unread',
  'notifications.category.ADMIN': 'Sent by an operator',
  'notifications.category.SYSTEM_EVENT': 'System event',
  'notifications.col.accountId': 'Account ID',
  'notifications.col.category': 'Category',
  'notifications.col.title': 'Title (en)',
  'notifications.col.isRead': 'Read',
  'notifications.col.sentBy': 'Sent by',
  'notifications.col.createdAt': 'Created at',
  'notifications.col.actions': 'Actions',
  'notifications.system': 'System',
  'notifications.details': 'Details',
  'notifications.empty': 'No notifications match',
  'notifications.link.summary': '{kind}: {target}',

  // ---- the detail ----
  'notifications.detail.title': 'Notification {id}',
  'notifications.detail.account': 'Account ID',
  'notifications.detail.category': 'Category',
  'notifications.detail.isRead': 'Read',
  'notifications.detail.sentBy': 'Sent by',
  'notifications.detail.createdAt': 'Created at',
  'notifications.detail.link': 'Where it opens',
  'notifications.detail.templateKey': 'Template key',
  'notifications.detail.templateParams': 'Template parameters',
  'notifications.detail.languages': 'Title and body in every language',
  'notifications.detail.titleLabel': 'Title',
  'notifications.detail.bodyLabel': 'Body',
  'notifications.detail.noTexts':
    'A system event has no text per language: when the recipient reads it, the system makes the text from the template key and parameters in his language.',
  'notifications.detail.noTemplate': 'A message sent by an operator uses no template.',

  // ---- the send dialog ----
  'notifications.send.title': 'Send in-app notifications',
  'notifications.send.scope':
    'This goes only to the accounts named below. To message all users, use a manual push task in Push management.',
  'notifications.send.recipients': 'Recipients',
  'notifications.send.recipientsHelp': 'One account ID per line; an ID written twice counts once.',
  'notifications.send.recipientsPlaceholder': 'Account IDs, one per line',
  'notifications.send.recipientsCount': '{count, plural, one {# account} other {# accounts}}',
  'notifications.send.recipientsRepeated':
    '{count, plural, one {# repeated line was merged} other {# repeated lines were merged}}',
  'notifications.send.recipientsRequired': 'Enter at least one account ID',
  'notifications.send.recipientsTooMany': 'At most {max} accounts at a time; there are {count}',
  'notifications.send.texts': 'Title and body',
  'notifications.send.textsHelp':
    'Write one text per language; en is required. The title has at most 100 characters and the body at most 500 (counted without the whitespace at both ends).',
  'notifications.send.tabRequired': '{locale} (required)',
  'notifications.send.tabError': 'has an error',
  'notifications.send.titleLabel': 'Title ({locale})',
  'notifications.send.bodyLabel': 'Body ({locale})',
  'notifications.send.counter': '{count} / {max}',
  'notifications.send.titleTooLong': 'The title has at most {max} characters; it has {count}',
  'notifications.send.bodyTooLong': 'The body has at most {max} characters; it has {count}',
  'notifications.send.addLanguage': 'Add language',
  'notifications.send.languagePlaceholder': 'Language tag, for example th or zh-Hans',
  'notifications.send.languageInvalid':
    'Not a valid language tag (for example th or zh-Hans, at most 35 characters)',
  'notifications.send.languageDuplicate': 'This language is already added',
  'notifications.send.removeLanguage': 'Remove {locale}',
  'notifications.send.link': 'Where it opens',
  'notifications.send.push': 'Also send a push',
  'notifications.send.pushHelp':
    "The push follows each user's announcement notification preference; a user who has turned it off only gets the inbox message.",
  'notifications.send.submit': 'Send',
  'notifications.send.done': 'Sent {count, plural, one {# notification} other {# notifications}}',
  'notifications.send.notSent': 'This batch was not sent: not one notification was written.',
  'notifications.send.badAccounts':
    'These accounts cannot receive a message; fix them and send again:',
  'notifications.send.detailLine': '{field}: {reason}',
  'notifications.send.accountLine': 'Account {id}: {reason}',
  'notifications.send.maybeSent':
    'No answer came back, so it is not known whether this batch was sent. Check the list before you send it again.',
  'notifications.send.ref.accountIds': 'Recipients',
  'notifications.send.ref.titleI18n': 'Title',
  'notifications.send.ref.bodyI18n': 'Body',
  'notifications.send.ref.linkType': 'Link type',
  'notifications.send.ref.linkTarget': 'Link target',
};

export default messages;
