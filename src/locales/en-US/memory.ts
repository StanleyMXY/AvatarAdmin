const messages: Record<string, string> = {
  'menu.memory.tiers': 'Tiers',
  'menu.memory.models': 'Embedding models',

  'memory.common.yes': 'Yes',
  'memory.common.no': 'No',

  'memory.tier.col.name': 'Tier',
  'memory.tier.col.topK': 'Results (topK)',
  'memory.tier.col.recencyEnabled': 'Recency channel',
  'memory.tier.col.recencyCount': 'Recency items',
  'memory.tier.col.consolidationEnabled': 'Consolidation',
  'memory.tier.col.consolidationThreshold': 'Consolidation threshold',
  'memory.tier.col.actions': 'Actions',
  'memory.tier.detail': 'Details',
  'memory.tier.detailTitle': 'Tier {name}',
  'memory.tier.edit': 'Edit',
  'memory.tier.editTitle': 'Edit tier {name}',
  'memory.tier.create': 'New tier',
  'memory.tier.createTitle': 'New tier',
  'memory.tier.impact': 'A change takes effect at once for every account on this tier.',
  'memory.tier.createNote':
    'A name that is not in the list creates a new tier. Tiers cannot be deleted, so a mistaken one stays.',
  'memory.tier.name': 'Tier name',
  'memory.tier.nameHelp': 'Letters, digits, underscore and hyphen only, 1 to 64 characters.',
  'memory.tier.nameInvalid':
    'The tier name may use letters, digits, underscore and hyphen only, 1 to 64 characters',
  'memory.tier.topKHelp': 'A whole number from 1 to 100',
  'memory.tier.recencyCountHelp': 'A whole number from 0 to 100',
  'memory.tier.thresholdHelp': 'A whole number from 1 to 100000',
  'memory.tier.intInvalid': 'Enter a whole number from {min} to {max}',
  'memory.tier.confirmCreate':
    'A new tier {name} will be created. A tier cannot be deleted afterwards. Create it?',
  'memory.tier.confirmReplace':
    'Tier {name} already exists. Saving replaces all five of its settings, at once for every account on it. Replace it?',
  'memory.tier.saved': 'Tier saved',
  'memory.tier.nothingChanged': 'Nothing changed',
  'memory.tier.created': 'Tier created',
  'memory.tier.empty': 'There are no tiers yet',
  'memory.tier.defaultsFrom':
    'The settings start from the values of the default tier; change them as needed.',
  'memory.tier.save': 'Save',

  'memory.model.col.name': 'Model',
  'memory.model.col.teiBaseUrl': 'TEI address',
  'memory.model.col.dimensions': 'Dimensions',
  'memory.model.register': 'Register a model',
  'memory.model.registerTitle': 'Register an embedding model',
  'memory.model.startTeiFirst': 'Start the TEI container first, then register the model.',
  'memory.model.name': 'Model name',
  'memory.model.nameHelp': 'Letters, digits, underscore and hyphen only, 1 to 64 characters.',
  'memory.model.nameInvalid':
    'The model name may use letters, digits, underscore and hyphen only, 1 to 64 characters',
  'memory.model.teiBaseUrl': 'TEI address',
  'memory.model.teiBaseUrlHelp':
    'A full address that starts with http:// or https://, without a user name or password; the host must be on the allowed list.',
  'memory.model.teiBaseUrlInvalid':
    'Enter an address that starts with http:// or https://, without a user name or password',
  'memory.model.dimensions': 'Dimensions',
  'memory.model.dimensionsHelp':
    'A whole number from 1 to 8192. A registered name keeps its dimensions; to change them, use a new name.',
  'memory.model.dimensionsInvalid': 'Enter a whole number from 1 to 8192',
  'memory.model.submit': 'Register',
  'memory.model.registered': 'Model registered',
  'memory.model.conflictTitle': 'A model with this name is registered with other dimensions',
  'memory.model.empty': 'No model is registered yet',
  'memory.model.params': 'Parameters',

  'memory.account.title': 'Memory',
  'memory.account.tier': 'Tier',
  'memory.account.tierName': 'Current tier',
  'memory.account.tierNone': 'No tier has been assigned yet; the default tier applies',
  'memory.account.syncStatus': 'Sync status',
  'memory.account.syncStatus.PENDING': 'Waiting to sync',
  'memory.account.syncStatus.SYNCED': 'Synced',
  'memory.account.syncStatus.FAILED': 'Sync failed',
  'memory.account.assignedAt': 'Last sync',
  'memory.account.lastError': 'Last error',
  'memory.account.tierNote':
    'The tier follows the entitlements and cannot be assigned by hand; to give this account a higher tier, grant a time-limited entitlement.',
  'memory.account.model': 'Embedding model',
  'memory.account.currentModel': 'Current model: {name}',
  'memory.account.defaultModel': 'No assignment yet; the default model {name} is used',
  'memory.account.history': 'Assignment history',
  'memory.account.truncated': 'Only the newest {shown} are shown, {total} in total.',
  'memory.account.truncatedNoTotal': 'Only the newest {shown} are shown.',
  'memory.account.col.model': 'Model',
  'memory.account.col.assignedBy': 'Assigned by',
  'memory.account.col.assignedAt': 'Assigned at',
  'memory.account.assignWarning':
    'Switching the model only affects new writes; vectors of the existing history are not computed again. Each model has its own vector table and search uses the account’s current model, so after a switch old memories will most likely not be found until the data is migrated by hand.',
  'memory.account.chooseModel': 'Choose a model',
  'memory.account.assign': 'Assign model',
  'memory.account.assignConfirm':
    'Change the embedding model of this account to {name}? Old memories will most likely not be found.',
  'memory.account.assigned': 'Model assigned',
  'memory.account.blocked':
    'The account is waiting for deletion or being deleted, so a model cannot be assigned.',
  'memory.account.noModels': 'There is no model to choose',
};

export default messages;
