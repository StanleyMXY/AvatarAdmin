const messages: Record<string, string> = {
  // ---- menu ----
  'menu.email.templates': 'Email templates',

  // ---- the page ----
  'email.templates.note':
    'Every e-mail the system sends has one text, in English only. The templates are declared by the system: they can be edited and restored to the default, and cannot be added or deleted.',
  'email.templates.empty': 'No templates',
  'email.templates.col.code': 'Template',
  'email.templates.col.subject': 'Subject',
  'email.templates.col.status': 'Status',
  'email.templates.col.updatedBy': 'Last changed by',
  'email.templates.col.updatedAt': 'Last changed at',
  'email.templates.col.actions': 'Actions',
  'email.templates.status.modified': 'Changed',
  'email.templates.status.default': 'Default',
  'email.templates.edit': 'Edit',
  'email.code.REGISTER_CODE': 'Verification code for registration',
  'email.code.PASSWORD_RESET': 'Password reset',
  'email.code.DELETION_CONFIRM': 'Confirmation of deleting an account on the web',
  'email.code.PASSWORD_CHANGED': 'Notice that the password was changed',
  'email.code.LIKENESS_COMPLAINT_RECEIVED':
    'Confirmation that a complaint about a photo was received',
  'email.code.LOGIN_METHOD_ADDED':
    'Notice that a sign-in method was added (sent to the account e-mail after a sign-in method is added to the account: Google linked automatically, or the user adding Google sign-in after logging in)',

  // ---- what a placeholder stands for (the name between the braces) ----
  'email.placeholder.code': 'the verification code',
  'email.placeholder.minutes': 'how many minutes the code or the link works',
  'email.placeholder.appName': 'the name of the app',
  'email.placeholder.resetLink': 'the whole link to reset the password, made by the system',
  'email.placeholder.confirmLink': 'the link to confirm the deletion of the account',
  'email.placeholder.subscriptionNotice':
    'filled in by the system with the subscription notice, and left empty when the account has no subscription; it cannot be removed',
  'email.placeholder.method': 'the name of the sign-in method',
  'email.placeholder.time': 'the time of the change',

  // ---- the editor ----
  'email.templates.editTitle': 'Edit template',
  'email.templates.field.code': 'Template',
  'email.templates.field.subject': 'Subject',
  'email.templates.field.body': 'Body',
  'email.templates.subjectCount': '{count} / {max}',
  'email.templates.subjectInvalid': 'The subject must be 1 to 200 characters',
  'email.templates.bodyRequired': 'Enter the body',
  'email.templates.placeholders': 'Placeholders you can use:',
  'email.templates.required': 'Must be in the body:',
  'email.templates.requiredNone': 'none',
  'email.templates.missing':
    'The body is missing {list}. Write it exactly as listed, with the braces and in the same case.',
  'email.templates.defaultTitle': 'Default text',
  'email.templates.restore': 'Restore default',
  'email.templates.restoreAsk':
    'Restore the default text? The text saved for this template is replaced.',
  'email.templates.notChanged':
    'This template has not been changed: it already has the default text.',
  'email.templates.saved': 'Saved',
  'email.templates.restored': 'Restored the default text',
};

export default messages;
