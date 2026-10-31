const messages: Record<string, string> = {
  'menu.complaints.likeness': 'Likeness complaints',

  'complaints.findNote':
    'How to find the avatar a complaint is about has not been decided: until the legal advice is in, it can only be found by hand from the uploader information the complainant gives.',
  'complaints.params': 'Parameters',
  'complaints.overdue': 'Overdue',
  'complaints.detail': 'Details',
  'complaints.detail.title': 'Complaint',

  'complaints.col.id': 'Complaint ID',
  'complaints.col.contactEmail': 'Contact email',
  'complaints.col.receivedAt': 'Received at',
  'complaints.col.dueAt': 'Due at',
  'complaints.col.resolvedAt': 'Closed at',
  'complaints.col.status': 'State',
  'complaints.col.handledBy': 'Handled by',
  'complaints.col.description': 'Description',
  'complaints.col.relatedAvatars': 'Related avatar IDs',
  'complaints.col.actions': 'Actions',

  'complaints.status.RECEIVED': 'Received',
  'complaints.status.INVESTIGATING': 'Investigating',
  'complaints.status.RESOLVED_REMOVED': 'Avatars removed',
  'complaints.status.RESOLVED_NOT_FOUND': 'No such avatar found',
  'complaints.status.REJECTED': 'Rejected',
  // a choice of the filter only, not a state a complaint has: received and investigating together
  'complaints.filter.OPEN': 'Not closed',

  'complaints.evidence.title': 'Evidence',
  'complaints.evidence.none': 'No evidence files.',
  'complaints.evidence.logged': 'Viewing a file is written to the audit log, every time.',
  'complaints.evidence.file': 'File {n}',
  'complaints.evidence.notFound': 'The evidence does not exist.',
  'complaints.evidence.badAddress': 'The file address is not one that can be opened.',
  'complaints.evidence.open': 'Open the file',

  'complaints.event.title': 'History',
  'complaints.event.time': 'Time',
  'complaints.event.change': 'Change',
  'complaints.event.note': 'Note',
  'complaints.event.admin': 'Administrator',
  'complaints.event.empty': 'No change yet.',

  'complaints.manage.title': 'Handle',
  'complaints.status.newStatus': 'New state',
  'complaints.status.note': 'Note',
  'complaints.status.noteHint': 'Optional, up to {max} characters.',
  'complaints.status.submit': 'Change state',
  'complaints.status.saved': 'The state was changed.',
  'complaints.note.length': 'The note can have at most {max} characters.',
  'complaints.remove.intro':
    'Remove the avatars you found, by their IDs (several allowed). The complaint then counts as closed.',
  'complaints.remove.ids': 'Avatar IDs',
  'complaints.remove.placeholder': 'Type or paste an ID and press Enter',
  'complaints.remove.button': 'Remove avatars',
  'complaints.remove.confirm':
    'This deletes these avatars with all their looks, action clips and files, and the uploader gets an in-app notice that the content was rejected. It cannot be undone.',
  'complaints.remove.done': 'The avatars were removed.',
};

export default messages;
