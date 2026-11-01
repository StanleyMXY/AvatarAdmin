// The texts of the system management pages: administrators, roles, the permission tree and the audit
// log (spec 5.16). The menu names of the pages of this menu that belong to other modules (app
// versions, channel packages) are in their own files.
const messages: Record<string, string> = {
  'menu.system.admins': 'Administrators',
  'menu.system.roles': 'Roles',
  'menu.system.permissions': 'Permission tree',
  'menu.system.audit': 'Audit log',

  // ---- shared by the four pages ----
  'system.common.edit': 'Edit',
  'system.common.delete': 'Delete',
  'system.common.save': 'Save',
  'system.common.cancel': 'Cancel',
  'system.common.yes': 'Yes',
  'system.common.no': 'No',
  'system.common.saved': 'Saved',
  'system.common.deleted': 'Deleted',
  'system.common.readFailed': 'Could not read: {message}',
  'system.sentences': '{first} {second}',
  'system.scopeHint':
    'Administrators can only grant permissions they hold. You cannot change a role you hold, and you can only change roles and administrators whose permissions you all hold. Nothing was changed.',

  // ---- administrators ----
  'system.admins.note':
    'You cannot change your own roles, super administrator flag or status, and you cannot delete your own account. The last enabled super administrator cannot be disabled or deleted, and its flag cannot be cleared. Only a super administrator sets or clears the super administrator flag.',
  'system.admins.refusedHint':
    'The backend refused this and nothing was changed. Possible reasons: it is your own account; it is the last enabled super administrator; or the account was changed by someone else meanwhile (read the list again).',
  'system.admins.forbiddenHint':
    'The backend refused this and nothing was changed. Possible reasons: it is your own account; administrators can only grant permissions they hold; and can only act on administrators whose permissions they all hold.',
  'system.admins.new': 'New administrator',
  'system.admins.you': 'You',
  'system.admins.col.username': 'User name',
  'system.admins.col.superAdmin': 'Super administrator',
  'system.admins.col.status': 'Status',
  'system.admins.col.mustChangePassword': 'Must change password',
  'system.admins.col.roles': 'Roles',
  'system.admins.col.lastLoginAt': 'Last sign-in',
  'system.admins.col.createdAt': 'Created',
  'system.admins.col.actions': 'Actions',
  'system.admins.status.ACTIVE': 'Enabled',
  'system.admins.status.DISABLED': 'Disabled',
  'system.admins.superYes': 'Super administrator',
  'system.admins.noRoles': 'No roles',
  'system.admins.disable': 'Disable',
  'system.admins.enable': 'Enable',
  'system.admins.disableAsk':
    'Disable {name}? Their sessions end now and they cannot sign in until you enable them again.',
  'system.admins.resetPassword': 'Reset password',
  'system.admins.resetTotp': 'Reset two-factor',
  'system.admins.resetTotpAsk':
    'Reset two-factor of {name}? Their authenticator is removed and their sessions end now; they bind a new authenticator at the next sign-in.',
  'system.admins.deleteAsk':
    'Delete {name}? This cannot be undone. The rows of the audit log they wrote stay and keep their name.',
  'system.admins.disabledDone': 'Disabled',
  'system.admins.enabledDone': 'Enabled',
  'system.admins.resetTotpDone': 'Two-factor reset',
  'system.admins.createTitle': 'New administrator',
  'system.admins.editTitle': 'Edit administrator: {name}',
  'system.admins.field.username': 'User name',
  'system.admins.field.usernameReadOnly':
    'The user name cannot be changed after the account is made.',
  'system.admins.field.usernameRequired': 'Enter a user name',
  'system.admins.field.password': 'Initial password',
  'system.admins.field.passwordConfirm': 'Repeat the password',
  'system.admins.field.passwordHint':
    'At least {min} characters, not the same as the user name. The administrator must change it at the first sign-in. It is sent as typed and is not shown again.',
  'system.admins.field.passwordHintNoMin':
    'Not the same as the user name. The administrator must change it at the first sign-in. It is sent as typed and is not shown again.',
  'system.admins.field.roles': 'Roles',
  'system.admins.field.rolesPlaceholder': 'Choose roles',
  'system.admins.field.rolesLoading': 'Reading the roles…',
  'system.admins.field.rolesForbidden':
    'The roles cannot be read: this needs the permission {permission} ({code}).',
  'system.admins.field.rolesFailed': 'The roles could not be read: {message}',
  'system.admins.field.rolesRetry': 'Read again',
  'system.admins.field.rolesCurrent': 'Current roles: {names}',
  'system.admins.field.superAdmin': 'Super administrator',
  'system.admins.field.superAdminHint':
    'A super administrator passes every permission check. Only a super administrator can set or clear this.',
  'system.admins.superNeedsSuper': 'Only a super administrator can change this.',
  'system.admins.superLast':
    'This is the last enabled super administrator: the flag cannot be cleared.',
  'system.admins.ownResetPasswordReason':
    'You cannot reset your own password here. To change your own password, use Change password in the account menu.',
  'system.admins.ownResetTotpReason':
    'You cannot reset your own two-factor authentication. Ask another administrator to do it.',
  'system.admins.ownDisableReason': 'You cannot disable or delete your own account.',
  'system.admins.lastSuperReason':
    'This is the last enabled super administrator: it cannot be disabled or deleted.',
  'system.admins.closedNote': 'Only a super administrator can act on this account.',
  'system.admins.ownReasons': '{note} {disable}',
  'system.admins.ownNote':
    'This is your own account: you cannot change your own roles or super administrator flag.',
  'system.admins.createDone':
    'The administrator was made. They must change the password at the first sign-in.',
  'system.admins.resetTitle': 'Reset password: {name}',
  'system.admins.resetNote':
    'This sets a new password for {name}. They must change it at the next sign-in and every session of theirs ends now. Tell them the password yourself: it is not shown again, here or anywhere.',
  'system.admins.resetField': 'New password',
  'system.admins.resetOk': 'Reset password',
  'system.admins.resetDone': 'The password was reset. {name} must change it at the next sign-in.',

  // ---- roles ----
  'system.roles.note':
    'The permissions of a role are replaced as a whole when you save. Checking a node checks everything below it and the pages it is on. Unchecking a function keeps the page it belongs to, so a role can hold a page with only some of its functions; unchecking the page takes the page and everything below it. Custom nodes cannot be given to a role.',
  'system.roles.new': 'New role',
  'system.roles.col.name': 'Name',
  'system.roles.col.remark': 'Remark',
  'system.roles.col.permissions': 'Permissions',
  'system.roles.col.createdAt': 'Created',
  'system.roles.col.actions': 'Actions',
  'system.roles.count': '{count, plural, one {# code} other {# codes}}',
  'system.roles.deleteAsk': 'Delete the role {name}? Its permission grants are deleted with it.',
  'system.roles.createTitle': 'New role',
  'system.roles.editTitle': 'Edit role: {name}',
  'system.roles.field.name': 'Name',
  'system.roles.field.nameRequired': 'Enter a name',
  'system.roles.field.remark': 'Remark',
  'system.roles.field.permissions': 'Permissions',
  'system.roles.selected': '{count, plural, one {# code chosen} other {# codes chosen}}',
  'system.roles.treeFailed': 'The permission tree could not be read: {message}',
  'system.roles.treeRetry': 'Read again',
  'system.roles.treeLoading': 'Reading the permission tree…',
  'system.roles.withoutPage':
    'These permissions are given without the page they are on, so the people who hold them cannot open the page: {codes}. Check the page to give it too.',
  'system.roles.notHeld':
    'This role has permissions you do not hold: {codes}. You cannot save changes to it.',
  'system.roles.notHeldMany':
    'This role has permissions you do not hold: {codes} and others, {count} in total. You cannot save changes to it.',
  'system.roles.unknownCodes':
    'These codes of the role cannot be given to a role (custom nodes and codes the application does not know) and will be dropped when you save: {codes}',

  // ---- permission tree ----
  'system.permissions.note':
    'Custom nodes group permissions or keep a place for pages that come later. They cannot be given to roles and have no effect on the existing endpoints: the endpoints and pages check only the built-in permission codes of the system.',
  'system.permissions.new': 'New node',
  'system.permissions.col.name': 'Name',
  'system.permissions.col.code': 'Permission code',
  'system.permissions.col.type': 'Type',
  'system.permissions.col.sortOrder': 'Order',
  'system.permissions.col.builtin': 'Source',
  'system.permissions.col.actions': 'Actions',
  'system.permissions.type.MENU': 'Menu',
  'system.permissions.type.FUNCTION': 'Function',
  'system.permissions.builtin': 'Built-in',
  'system.permissions.custom': 'Custom',
  'system.permissions.deleteAsk': 'Delete the node {code}? Roles lose it.',
  'system.permissions.createTitle': 'New node',
  'system.permissions.editTitle': 'Edit node: {code}',
  'system.permissions.builtinNote':
    'A built-in node can change only its names and its order. Its code and parent are fixed and it cannot be deleted.',
  'system.permissions.field.code': 'Permission code',
  'system.permissions.field.codeHint': 'Cannot be changed after the node is made.',
  'system.permissions.field.code.required': 'Enter a code',
  'system.permissions.field.code.invalid':
    'The code cannot contain spaces or control characters, and is at most 100 characters.',
  'system.permissions.field.code.dots': 'The code cannot start or end with a dot.',
  'system.permissions.field.code.taken': 'A node with this code exists already.',
  'system.permissions.field.type': 'Type',
  'system.permissions.field.parent': 'Parent node',
  'system.permissions.field.parentNone': 'No parent (a root)',
  'system.permissions.field.parentHint':
    'A node cannot be moved under itself or under one of its own descendants.',
  'system.permissions.field.parentLoop':
    'A node cannot be put under itself or under its own descendant.',
  'system.permissions.field.nameZh': 'Name (Chinese)',
  'system.permissions.field.nameEn': 'Name (English)',
  'system.permissions.field.nameRequired': 'Enter a name',
  'system.permissions.field.sortOrder': 'Order',
  'system.permissions.field.sortOrderRequired': 'Enter a whole number',
  'system.permissions.empty': 'There are no nodes.',

  // ---- the check box tree ----
  'system.tree.label': 'Permission tree',

  // ---- audit log ----
  'system.audit.note':
    'Every write and every viewing of a user file is recorded. The administrator column is the name at the time of writing: it does not change when the administrator is renamed or deleted. Times in the filter are UTC days.',
  'system.audit.col.admin': 'Administrator',
  'system.audit.col.action': 'Action',
  'system.audit.col.targetType': 'Object type',
  'system.audit.col.targetId': 'Object ID',
  'system.audit.col.detail': 'Detail',
  'system.audit.col.createdAt': 'Time',
  'system.audit.filter.admin': 'Administrator',
  'system.audit.filter.adminId': 'Administrator ID',
  'system.audit.filter.adminPick': 'Choose an administrator',
  'system.audit.filter.range': 'Time range (UTC)',
};

export default messages;
