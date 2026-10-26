// Menu title and all texts of the guest statistics page (/stat/guest).
const messages: Record<string, string> = {
  'menu.stats.guest': 'Guest statistics',

  'stat.guest.devicesNote':
    'Guests have no account on the server: this page counts devices, not accounts.',
  'stat.guest.tab.daily': 'Guest daily',
  'stat.guest.tab.cohort': 'Conversion cohorts',
  'stat.guest.tab.retention': 'Guest retention',
  'stat.guest.tab.quota': 'Allowance use',

  'stat.guest.land.date': 'Check day (UTC)',
  'stat.guest.land.hint':
    'The guest daily report recomputes that day. Conversion cohorts and guest retention fill the cells of each N that fall on that day; they do not recompute a whole row.',

  'stat.guest.daily.date': 'Date',
  'stat.guest.daily.new': 'New guest devices',
  'stat.guest.daily.new.tip':
    'Counted on the day a device first appears; reinstalling the app creates a new device record.',
  'stat.guest.daily.converted': 'Guest devices converted',
  'stat.guest.daily.converted.tip':
    'Devices that registered an account on this day; they did not necessarily first appear on this day.',
  'stat.guest.daily.rate': 'Conversion rate of the day',
  'stat.guest.daily.rate.tip':
    'Devices converted today ÷ guest devices new today. This is not the conversion rate of one batch of devices: the devices that converted may have appeared days ago, so it can exceed 100%. For the progress of one batch see Conversion cohorts. Not shown when no device is new.',

  'stat.guest.cohort.date': 'Day the device first appeared',
  'stat.guest.cohort.size': 'Devices in cohort',
  'stat.guest.cohort.cell': '{count} · {percent}',
  'stat.guest.cohort.cellDelta': '{count} · {percent} ({delta})',
  'stat.guest.cohort.note':
    'Each cell is the number of devices of the cohort that have converted by then and its share of the cohort; the plus is the devices added since the previous column. A dash means that day has not come yet.',
  'stat.guest.cohort.distribution': 'Time to convert',
  'stat.guest.cohort.distribution.tip':
    'Each bucket is the difference of two neighbouring columns, summed over the cohorts. Cells that are not due yet are not counted, so late conversions are not under-counted.',
  'stat.guest.cohort.stack': 'Time to convert by cohort day',
  'stat.guest.cohort.stack.tip': 'Not split by source: the guest conversion table has no source.',
  'stat.guest.bucket.D0': 'Same day',
  'stat.guest.bucket.D1': 'D1',
  'stat.guest.bucket.D2': 'D2',
  'stat.guest.bucket.D3': 'D3',
  'stat.guest.bucket.D4-D5': 'D4–D5',
  'stat.guest.bucket.D6-D7': 'D6–D7',
  'stat.guest.bucket.D8-D14': 'D8–D14',
  'stat.guest.bucket.D15-D30': 'D15–D30',
  'stat.guest.segment.D0': 'Same day',
  'stat.guest.segment.D1': 'Next day',
  'stat.guest.segment.D2': 'Day 2',
  'stat.guest.segment.D3-later': 'Day 3 and later',

  'stat.guest.retention.cohortDate': 'Day the device first appeared',
  'stat.guest.retention.cohortSize': 'Devices',
  'stat.guest.retention.days': 'Retention days',
  'stat.guest.retention.note':
    'The cohort is the day a device first appeared. Devices that have since registered an account are still counted; devices that did not pass device verification are not included. Dn means the device sent any client event on day N, and the percentage is over the devices in the cohort.',

  'stat.guest.quota.configured': 'Current guest allowance',
  'stat.guest.quota.configured.tip':
    'It only affects devices issued later; devices already issued keep the allowance they were given.',
  'stat.guest.quota.notConfigured': 'Not configured, guests cannot call',
  'stat.guest.quota.minutes': '{n} min',
  'stat.guest.quota.devices': 'Devices',
  'stat.guest.quota.noGrant': 'Devices without an allowance',
  'stat.guest.quota.noGrant.tip': 'Devices whose granted allowance is empty or 0.',
  'stat.guest.quota.neverCalled': 'Never called',
  'stat.guest.quota.neverCalled.tip':
    'Devices with an allowance that used none of it ÷ (devices − devices without an allowance).',
  'stat.guest.quota.exhausted': 'Used up the allowance',
  'stat.guest.quota.exhausted.tip':
    'Devices whose used seconds reached the allowance ÷ (devices − devices without an allowance).',
  'stat.guest.quota.avgUsed': 'Average minutes used',
  'stat.guest.quota.avgUsed.tip': 'Average time used by the devices that have an allowance.',
  'stat.guest.quota.configLink': 'Change the guest call allowance in System settings',
  'stat.guest.quota.chart': 'Devices by share of the allowance used',
  'stat.guest.quota.table': 'Conversion by bucket',
  'stat.guest.quota.bucket': 'Bucket',
  'stat.guest.quota.bucket.tip':
    'Each device is put in a bucket against the allowance it was given; changing the allowance only affects devices issued later.',
  'stat.guest.quota.bucket.ZERO': 'Unused',
  'stat.guest.quota.bucket.LE_25': '0–25%',
  'stat.guest.quota.bucket.LE_50': '25%–50%',
  'stat.guest.quota.bucket.LE_75': '50%–75%',
  'stat.guest.quota.bucket.LT_100': '75%–100% (excl.)',
  'stat.guest.quota.bucket.GE_100': 'Used up (≥100%)',
  'stat.guest.quota.col.devices': 'Devices',
  'stat.guest.quota.col.converted': 'Devices converted',
  'stat.guest.quota.col.converted.tip': 'Converted means the device later registered an account.',
  'stat.guest.quota.col.rate': 'Conversion rate',
};

export default messages;
