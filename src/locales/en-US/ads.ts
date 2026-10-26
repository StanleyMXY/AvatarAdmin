// The title of the in-app ad menu and every text of its five pages (campaigns, placements with the
// global settings, units, creatives, the ad report).
const messages: Record<string, string> = {
  'menu.ads.campaigns': 'Campaigns',
  'menu.ads.placements': 'Placements and global settings',
  'menu.ads.units': 'Units',
  'menu.ads.creatives': 'Creatives',
  'menu.ads.report': 'Ad report',

  'ads.common.search': 'Search',
  'ads.common.actions': 'Actions',
  'ads.common.edit': 'Edit',
  'ads.common.delete': 'Delete',
  'ads.common.saved': 'Saved',
  'ads.common.wholeNumber': 'Enter a whole number',

  'ads.checklist.title':
    'Delivery checklist (when it is set up but there is no ad, check these five layers in order)',
  'ads.checklist.intro':
    'For an ad to be delivered, all five layers below must be in order; if any one is not, the app gets no ad. Check them in this order:',
  'ads.checklist.layer1': 'The master switch ads.enabled is on (it is off by default)',
  'ads.checklist.layer2': 'The placement is enabled',
  'ads.checklist.layer3':
    'The campaign is "Running" and the current time is within its start and end times',
  'ads.checklist.layer4': 'The unit is "Running"',
  'ads.checklist.layer5': 'The creative is "Approved" and its serving status is "Running"',
  'ads.checklist.otherReasons':
    'An account whose subscription has the "remove ads" entitlement (the feature switch ads.removed) sees no ads either, and neither does an account that has used up its rewards of the day on the rewarded placement (the frequency cap).',
  'ads.checklist.guest':
    'A guest gets only the two placements app_open and call_end. Testing history_feed or reward_credits as a guest and seeing no ad is normal (the reason is NOT_FOR_GUEST).',

  'ads.status.campaign.DRAFT': 'Draft',
  'ads.status.campaign.ACTIVE': 'Running',
  'ads.status.campaign.PAUSED': 'Paused',
  'ads.status.campaign.ENDED': 'Ended',

  'ads.campaigns.autoEnd': 'When the end time passes, the backend ends the campaign by itself.',
  'ads.campaigns.new': 'New campaign',
  'ads.campaigns.newTitle': 'New campaign',
  'ads.campaigns.editTitle': 'Edit campaign',
  'ads.campaigns.empty': 'No campaigns',
  'ads.campaigns.filter.name': 'Name',
  'ads.campaigns.filter.status': 'Status',
  'ads.campaigns.col.name': 'Name',
  'ads.campaigns.col.status': 'Status',
  'ads.campaigns.col.priority': 'Priority',
  'ads.campaigns.col.startAt': 'Start time',
  'ads.campaigns.col.endAt': 'End time',
  'ads.campaigns.col.createdBy': 'Created by',
  'ads.campaigns.col.updatedAt': 'Updated at',
  'ads.campaigns.activate': 'Activate',
  'ads.campaigns.pause': 'Pause',
  'ads.campaigns.resume': 'Resume',
  'ads.campaigns.end': 'End',
  'ads.campaigns.activateAsk': 'Activate this campaign?',
  'ads.campaigns.pauseAsk': 'Pause this campaign? Its ads stop being served.',
  'ads.campaigns.resumeAsk': 'Resume this campaign?',
  'ads.campaigns.endAsk': 'End this campaign? An ended campaign cannot be changed or restarted.',
  'ads.campaigns.deleteAsk':
    'Delete this campaign? Only a draft, or an ended one without units, can be deleted.',
  'ads.campaigns.hasUnits': 'This campaign has units; delete them first.',
  'ads.campaigns.field.name': 'Name',
  'ads.campaigns.field.description': 'Description',
  'ads.campaigns.field.priority': 'Priority',
  'ads.campaigns.field.startAt': 'Start time',
  'ads.campaigns.field.endAt': 'End time',
  'ads.campaigns.nameRequired': 'Enter a name',
  'ads.campaigns.priorityHelp': 'The smaller the number, the higher the priority (default 100).',
  'ads.campaigns.endBeforeStart': 'The end must not be before the start',
  'ads.campaigns.timeHelp':
    'Times are entered and shown in the time zone of your browser ({zone}). Without a start time the campaign starts at once; without an end time it never ends.',

  'ads.format.SPLASH': 'Splash',
  'ads.format.INTERSTITIAL': 'Interstitial',
  'ads.format.NATIVE': 'Native',
  'ads.format.REWARDED': 'Rewarded',

  'ads.placements.note.master':
    'The master switch is off by default (ads.enabled). While it is off, the app hides all placements.',
  'ads.placements.note.testing':
    'To test back to back you can set the frequency cap and the cooldown to 0 (no limit) for a while; set them back when you are done.',
  'ads.placements.note.counting':
    'The frequency cap is counted by impressions: an ad that was prefetched but not shown does not use the allowance.',
  'ads.placements.globalTitle': 'Global ad settings',
  'ads.placements.tableTitle': 'Placements',
  'ads.placements.empty': 'No placements',
  'ads.placements.warn.skipAfter':
    'Full-screen ads must be easy to close. A skip countdown over 5 seconds risks breaking the Google Play ads policy. (It does not stop a save.)',
  'ads.placements.warn.forceClose':
    'Forced close (ads.force_close_seconds) is 0, so a splash or interstitial creative that cannot be skipped has no way to be closed. There {count, plural, one {is # creative} other {are # creatives}} without a skip on those placements now.',
  'ads.placements.warn.forceCloseUnknown':
    'Forced close (ads.force_close_seconds) is 0. A splash or interstitial creative that cannot be skipped has no way to be closed; this cannot be checked here without the ADS:CREATIVE permission.',
  'ads.placements.col.slotKey': 'Slot key',
  'ads.placements.col.format': 'Format',
  'ads.placements.col.name': 'Name',
  'ads.placements.col.enabled': 'Enabled',
  'ads.placements.col.frequencyCap': 'Frequency cap',
  'ads.placements.col.cooldown': 'Cooldown (minutes)',
  'ads.placements.col.reward': 'Reward credits',
  'ads.placements.col.spec': 'Creative spec',
  'ads.placements.enabledOf': 'Enabled: {slot}',
  'ads.placements.capNote':
    'Impressions per account per local day, 0 = no limit; guests have no cap.',
  'ads.placements.capNoteRewarded':
    'Also the most rewards an account can get in a day; cannot be 0.',
  'ads.placements.noCooldown': '0 (no cooldown)',
  'ads.placements.dailyMax':
    'Most credits an account can earn from ads a day = frequency cap × reward credits = {cap} × {reward} = {total}',
  'ads.placements.specShortSide': 'shorter side ≥ {pixels} px',
  'ads.placements.specMaxBytes': 'max {size}',
  'ads.placements.editTitle': 'Edit placement: {slot}',
  'ads.placements.field.frequencyCap': 'Frequency cap',
  'ads.placements.field.cooldown': 'Cooldown (minutes)',
  'ads.placements.field.rewardCredits': 'Reward credits',
  'ads.placements.capHelp':
    'The most impressions an account gets per local day, 0 = no limit; guests have no cap. For testing it can be set to 0 for a while; set it back afterwards.',
  'ads.placements.capHelpRewarded':
    'The rewarded placement cannot be 0: it is also the most rewards an account can get in a day.',
  'ads.placements.cooldownHelp':
    'The least number of minutes between two impressions, 0 = no cooldown. For testing it can be set to 0 for a while; set it back afterwards.',
  'ads.placements.cooldownNone':
    'The rewarded placement is started by the user and has no cooldown.',
  'ads.placements.rewardedCapZero':
    'The rewarded placement cannot have a cap of 0: it is also the number of rewards a day',
  'ads.placements.rewardPositive': 'The reward must be more than 0',

  'ads.targeting.platforms': 'Platforms',
  'ads.targeting.geo': 'Countries',
  'ads.targeting.osVersionMin': 'Lowest system version',
  'ads.targeting.appVersionMin': 'Lowest app version',
  'ads.targeting.languages': 'Languages',
  'ads.targeting.dayParts': 'Time ranges',
  'ads.targeting.geoNotConfigured':
    'Geo targeting is not set up yet; countries set here will not match.',
  'ads.targeting.geoPlaceholder':
    'Type a two-letter country code and press Enter, for example TH, ID, VN',
  'ads.targeting.geoHelp':
    'The country is worked out by the server from the IP address of the client, not reported by the client; with no country found nothing matches. Empty means no limit.',
  'ads.targeting.versionHelp':
    'A version of numbers separated by dots, for example 13 or 1.2.0; a version at least this high matches. Empty means no limit.',
  'ads.targeting.languagesPlaceholder':
    'Type a language code and press Enter, for example th, ar, zh-Hans',
  'ads.targeting.languagesHelp':
    'Compared by the main language subtag (en matches en-US). Empty means no limit.',
  'ads.targeting.dayPartsHelp':
    'The ranges are in the local time of the user (a guest has no time zone and gets UTC), both ends included; a start after the end crosses midnight. Empty means all day.',
  'ads.targeting.start': 'Start',
  'ads.targeting.end': 'End',
  'ads.targeting.overnight': 'Across midnight',
  'ads.targeting.remove': 'Remove',
  'ads.targeting.addRange': 'Add a time range',
  'ads.targeting.error.country': 'A country code is two capital letters, for example TH',
  'ads.targeting.error.version': 'A version is numbers separated by dots, for example 13 or 1.2.0',
  'ads.targeting.error.language': 'That is not a valid language tag (35 characters at most)',
  'ads.targeting.error.dayPart':
    'Fill in both the start and the end of a range, as H:mm, for example 8:00',
  'ads.targeting.summary.none': 'No limit',
  'ads.targeting.summary.platforms': 'Platforms: {value}',
  'ads.targeting.summary.geo': 'Countries: {value}',
  'ads.targeting.summary.osVersionMin': 'System ≥ {value}',
  'ads.targeting.summary.appVersionMin': 'App ≥ {value}',
  'ads.targeting.summary.languages': 'Languages: {value}',
  'ads.targeting.summary.dayParts': 'Time ranges: {value}',

  'ads.common.needsPermission': 'Needs the {code} permission',
  'ads.common.optionsFailed': 'The choices could not be read',
  'ads.common.wholeFrom0': 'Enter a whole number, 0 or more',
  'ads.common.wholeFrom1': 'Enter a whole number, 1 or more',

  'ads.status.unit.DRAFT': 'Draft',
  'ads.status.unit.ACTIVE': 'Running',
  'ads.status.unit.PAUSED': 'Paused',

  'ads.units.new': 'New unit',
  'ads.units.newTitle': 'New unit',
  'ads.units.editTitle': 'Edit unit',
  'ads.units.empty': 'No units',
  'ads.units.filter.campaign': 'Campaign',
  'ads.units.filter.placement': 'Placement',
  'ads.units.filter.status': 'Status',
  'ads.units.filter.name': 'Name',
  'ads.units.col.name': 'Name',
  'ads.units.col.campaign': 'Campaign',
  'ads.units.col.placement': 'Placement',
  'ads.units.col.status': 'Status',
  'ads.units.col.weight': 'Weight',
  'ads.units.col.dailyCap': 'Daily cap',
  'ads.units.col.targeting': 'Targeting',
  'ads.units.neverSelected': 'Never selected',
  'ads.units.noLimit': '0 (no limit)',
  'ads.units.activate': 'Activate',
  'ads.units.pause': 'Pause',
  'ads.units.resume': 'Resume',
  'ads.units.activateAsk': 'Activate this unit?',
  'ads.units.pauseAsk': 'Pause this unit?',
  'ads.units.resumeAsk': 'Resume this unit?',
  'ads.units.deleteAsk': 'Delete this unit? Only a draft unit without creatives can be deleted.',
  'ads.units.field.campaign': 'Campaign',
  'ads.units.field.placement': 'Placement',
  'ads.units.field.name': 'Name',
  'ads.units.field.weight': 'Weight',
  'ads.units.field.dailyCap': 'Daily cap',
  'ads.units.field.targeting': 'Targeting',
  'ads.units.fixedHelp':
    'The campaign and the placement are chosen when the unit is made and cannot be changed afterwards.',
  'ads.units.campaignRequired': 'Choose a campaign',
  'ads.units.placementRequired': 'Choose a placement',
  'ads.units.nameRequired': 'Enter a name',
  'ads.units.endedCampaign': '{name} (ended)',
  'ads.units.weightHelp':
    'Units of the same priority are chosen at random by weight; 0 means the unit is never chosen.',
  'ads.units.dailyCapHelp':
    'The most impressions a day, all accounts and guests together; 0 = no limit.',
  'ads.targeting.invalid': 'Some fields of the targeting are not valid',

  'ads.status.review.DRAFT': 'Draft',
  'ads.status.review.APPROVED': 'Approved',
  'ads.status.review.REJECTED': 'Rejected',
  'ads.status.serving.ACTIVE': 'Running',
  'ads.status.serving.PAUSED': 'Paused',

  'ads.creatives.new': 'New creative',
  'ads.creatives.newTitle': 'New creative',
  'ads.creatives.editTitle': 'Edit creative',
  'ads.creatives.empty': 'No creatives',
  'ads.creatives.weightNote':
    'Approved creatives that are running under one unit are chosen at random by weight. For an A/B test of creatives, use the weights to split the traffic. The weight of a creative that is already live cannot be changed.',
  'ads.creatives.filter.unit': 'Unit',
  'ads.creatives.filter.campaign': 'Campaign',
  'ads.creatives.filter.review': 'Review status',
  'ads.creatives.filter.serving': 'Serving status',
  'ads.creatives.filter.type': 'Type',
  'ads.creatives.col.thumbnail': 'Thumbnail',
  'ads.creatives.col.unit': 'Unit',
  'ads.creatives.col.type': 'Type',
  'ads.creatives.col.language': 'Language',
  'ads.creatives.col.review': 'Review status',
  'ads.creatives.col.serving': 'Serving status',
  'ads.creatives.col.weight': 'Weight',
  'ads.creatives.type.IMAGE': 'Image',
  'ads.creatives.type.VIDEO': 'Video',
  'ads.creatives.allLanguages': 'All languages',
  'ads.creatives.approve': 'Approve',
  'ads.creatives.reject': 'Reject',
  'ads.creatives.approveAsk':
    'Approve this creative? An approved creative cannot be edited or deleted, only paused.',
  'ads.creatives.deleteAsk':
    'Delete this creative? Only a draft or a rejected creative can be deleted.',
  'ads.creatives.approvedHint': 'To change the content, make a new creative and pause this one.',
  'ads.creatives.servingOf': 'Serving: {unit}',
  'ads.creatives.rejectTitle': 'Reject creative',
  'ads.creatives.rejectNote': 'Note',
  'ads.creatives.rejectHint':
    'Say why it is rejected; the note is kept with the creative. A rejected creative can be changed, and goes back to a draft when it is saved.',

  'ads.creatives.field.unit': 'Unit',
  'ads.creatives.field.file': 'File',
  'ads.creatives.field.clickAction': 'Click action',
  'ads.creatives.field.clickTarget': 'Click target',
  'ads.creatives.field.language': 'Language',
  'ads.creatives.field.weight': 'Weight',
  'ads.creatives.field.skippable': 'Skippable',
  'ads.creatives.field.reward': 'Reward threshold (seconds)',
  'ads.creatives.field.title': 'Title',
  'ads.creatives.field.body': 'Body',
  'ads.creatives.field.ctaText': 'Button text',
  'ads.creatives.field.advertiser': 'Advertiser',
  'ads.creatives.unitRequired': 'Choose a unit',
  'ads.creatives.unitPlacement': 'Placement: {slot} ({format})',
  'ads.creatives.fileHelp':
    'Upload the file first, then submit; the form sends only the id the upload returned. The size, the dimensions and the duration are read by the server and are read-only here. An upload that is not submitted is removed after 24 hours, and one upload can be used once.',
  'ads.creatives.uploadWait': 'Uploading; the form can be submitted when it is done.',
  'ads.creatives.uploadFirst': 'Upload the file first',
  'ads.creatives.fileRejected': 'The backend did not accept the uploaded file. Upload it again.',
  'ads.creatives.uploadUnavailable':
    'Set upload.public_base_url in the system configuration before uploading ad media.',
  'ads.creatives.openConfig': 'Open the system configuration',
  'ads.creatives.media.type': 'Type',
  'ads.creatives.media.dimensions': 'Dimensions',
  'ads.creatives.media.dimensionsValue': '{width} × {height} px',
  'ads.creatives.media.bytes': 'File size',
  'ads.creatives.media.duration': 'Duration',
  'ads.creatives.media.seconds': '{seconds} s',
  'ads.creatives.media.current': 'Current file. Upload a new file to replace it.',
  'ads.creatives.spec.fits': 'The file fits the placement {slot}.',
  'ads.creatives.spec.misses': 'The file does not fit the placement {slot}:',
  'ads.creatives.spec.ratio': 'The ratio {actual} is not within {percent}% of {wanted}.',
  'ads.creatives.spec.shortSide':
    'The shorter side is {actual} px; at least {wanted} px is needed.',
  'ads.creatives.spec.bytes': 'The file is {actual}; at most {wanted} is allowed.',
  'ads.creatives.spec.unknown':
    'The placement of this unit cannot be read, so the file cannot be compared with the placement spec here; the server checks it.',
  'ads.creatives.action.OPEN_URL': 'Open a web address',
  'ads.creatives.action.DEEP_LINK': 'Open a link inside the app (deep link)',
  'ads.creatives.action.IN_APP_ROUTE': 'Open a screen of the app',
  'ads.creatives.deepLinkRequired': 'Enter the link',
  'ads.creatives.languageHelp':
    '* means all languages; or a language code, matched by the main language subtag (th matches th-TH).',
  'ads.creatives.languageInvalid': 'Enter * or a language code such as th or ar-SA',
  'ads.creatives.weightHelp':
    'Approved creatives that are running under one unit are chosen at random by weight; 0 means never.',
  'ads.creatives.skippableHelp': 'Skippable by default.',
  'ads.creatives.policyWarning':
    'Full-screen ads must be easy to close; a creative that cannot be skipped risks breaking the Google Play ads policy. You can still save it.',
  'ads.creatives.rewardHelp':
    'Required for a creative on a rewarded placement: 5 to 30 seconds, and for a video not more than its length (a picture has no length limit). It cannot be cleared once saved.',
  'ads.creatives.rewardHelpUnknown':
    'Only for a creative on a rewarded placement: 5 to 30 seconds, and for a video not more than its length.',
  'ads.creatives.rewardRange': 'Enter 5 to 30 seconds',
  'ads.creatives.rewardOverVideo':
    'The threshold cannot be longer than the video ({seconds} seconds)',
  'ads.creatives.titleRequired': 'A native placement needs a title',
  'ads.creatives.ctaRequired': 'A native placement needs a button text',
  'ads.creatives.warning.AD_NOT_SKIPPABLE':
    'Saved. A full-screen ad should be easy to close: a creative that cannot be skipped risks breaking the Google Play ads policy.',
  'ads.creatives.warning.AD_SKIP_AFTER_TOO_LONG':
    'Saved. The skip countdown (ads.skip_after_seconds) is over 5 seconds, which risks breaking the Google Play ads policy.',
  'ads.creatives.warning.UNKNOWN': 'Saved, with a warning: {message}',

  'ads.report.seconds': 's',
  'ads.report.empty': 'No data',
  'ads.report.trendTitle': 'Impressions and clicks per UTC day (counts)',
  'ads.report.col.date': 'Date (UTC)',
  'ads.report.col.impressions': 'Impressions',
  'ads.report.col.guestImpressions': 'Guest impressions',
  'ads.report.col.starts': 'Video starts',
  'ads.report.col.clicks': 'Clicks',
  'ads.report.col.ctr': 'Click rate',
  'ads.report.col.completions': 'Video completions',
  'ads.report.col.completionRate': 'Completion rate',
  'ads.report.col.skips': 'Video skips',
  'ads.report.col.errors': 'Errors',
  'ads.report.col.viewableImpressions': 'Viewable impressions',
  'ads.report.col.nonViewableImpressions': 'Not viewable impressions',
  'ads.report.col.undeterminedImpressions': 'Undetermined viewability',
  'ads.report.col.viewableRate': 'Viewable rate',
  'ads.report.col.measurableRate': 'Measurable rate',
  'ads.report.col.avgWatchSeconds': 'Average watch time',
  'ads.report.col.slot': 'Slot',
  'ads.report.col.reason': 'Reason',
  'ads.report.col.count': 'Count',
  'ads.report.card.impressions': 'Impressions',
  'ads.report.card.guestImpressions': 'Guest impressions',
  'ads.report.card.starts': 'Video starts',
  'ads.report.card.clicks': 'Clicks',
  'ads.report.card.completions': 'Video completions',
  'ads.report.card.skips': 'Video skips',
  'ads.report.card.viewableImpressions': 'Viewable impressions',
  'ads.report.card.nonViewableImpressions': 'Not viewable impressions',
  'ads.report.card.undeterminedImpressions': 'Undetermined viewability',
  'ads.report.card.ctr': 'Click rate',
  'ads.report.card.completionRate': 'Completion rate',
  'ads.report.card.viewableRate': 'Viewable rate',
  'ads.report.card.measurableRate': 'Measurable rate',
  'ads.report.card.avgWatchSeconds': 'Average watch time',
  'ads.report.tip.impressions':
    'How many times an ad was shown (an ad that was prefetched but not shown does not count).',
  'ads.report.tip.guestImpressions':
    'Impressions by guests (no account). They are already included in the impressions above.',
  'ads.report.tip.starts': 'Videos that started playing (video creatives only).',
  'ads.report.tip.clicks': 'Clicks on an ad.',
  'ads.report.tip.completions': 'Videos played to the end (video creatives only).',
  'ads.report.tip.skips': 'Videos that were skipped (video creatives only).',
  'ads.report.tip.viewableImpressions': 'Impressions that met the viewability threshold.',
  'ads.report.tip.nonViewableImpressions':
    'Impressions that did not meet the viewability threshold.',
  'ads.report.tip.undeterminedImpressions':
    'Impressions whose viewability is not known = max(0, impressions − viewable − not viewable).',
  'ads.report.tip.ctr': 'Click rate = clicks ÷ impressions.',
  'ads.report.tip.completionRate': 'Completion rate = video completions ÷ video starts.',
  'ads.report.tip.viewableRate': 'Viewable rate = viewable ÷ (viewable + not viewable).',
  'ads.report.tip.measurableRate': 'Measurable rate = (viewable + not viewable) ÷ impressions.',
  'ads.report.tip.avgWatchSeconds': 'Average watch time = total watch seconds ÷ video starts.',
  'ads.report.tab.placement': 'By placement',
  'ads.report.tab.campaign': 'By campaign',
  'ads.report.tab.creative': 'By creative',
  'ads.report.tab.country': 'By country',
  'ads.report.dimension.by-placement': 'Placement',
  'ads.report.dimension.by-campaign': 'Campaign',
  'ads.report.dimension.by-creative': 'Creative',
  'ads.report.dimension.by-country': 'Country',
  'ads.report.countryUnknown': 'Unknown',
  'ads.report.nofillTitle': 'Reasons for no ad',
  'ads.report.nofillNote':
    'This table is the total of all platforms and all channels, or of what the filters above select. To look at one platform or one channel, use the platform and channel filters above; the table has no columns for them.',
  'ads.report.reason.GLOBAL_OFF': 'The master switch ads.enabled is off.',
  'ads.report.reason.ENTITLEMENT_OFF':
    'The account has the "remove ads" entitlement (the feature switch ads.removed).',
  'ads.report.reason.PLACEMENT_OFF':
    'The placement is not enabled, or the slot key that was asked for does not exist.',
  'ads.report.reason.NOT_FOR_GUEST':
    'A guest asked for history_feed or reward_credits; those two placements are for accounts only.',
  'ads.report.reason.FREQ_CAP':
    'The frequency cap of the day is used up (on the rewarded placement, the rewards granted and the ones still pending count too).',
  'ads.report.reason.COOLDOWN_SUPPRESSED':
    'The request came during the cooldown: the ad was still served, with a delay.',
  'ads.report.reason.NO_ELIGIBLE_UNIT':
    'There is no unit to serve: none that is running in a running campaign, or the weights of the chosen group are all 0.',
  'ads.report.reason.TARGETING_MISS':
    'The targeting (or the surfaces) of the unit did not match the request.',
  'ads.report.reason.UNIT_DAILY_CAP': 'The daily cap of the unit is used up.',
  'ads.report.reason.NO_CREATIVE':
    'The unit has no approved, running creative for the language of the request.',
  'ads.report.reason.META_WRITE_FAIL':
    'The record of the impression could not be written, so no ad was served.',
};

export default messages;
