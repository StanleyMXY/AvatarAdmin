import { useIntl } from '@umijs/max';
import { useLatestRead } from '../../hooks/useLatestRead';
import { listAuditAdmins } from '../../services/system';
import { plainText } from '../../utils/plainText';
import { ChoiceOrTyped } from './ChoiceOrTyped';

type Props = { value?: string; onChange?: (value: string | undefined) => void };

// What the backend takes for an id: the most it accepts for a filter on text (the ids are far shorter).
const MAX_ADMIN_ID = 255;

/**
 * The filter "administrator" of the audit log, for everyone who may read the log (`AUDIT:VIEW`): the
 * names come from `GET /audit-logs/admins` (id and user name, nothing else), not from the list of
 * administrators, which needs another permission. The value is the id; the log shows the name of the
 * moment of writing, and the id does not change when the administrator is renamed. An administrator
 * who was deleted is not in the list, the rows they wrote still are: "Other" opens a box for the id.
 * When the list cannot be read only the box for the id is drawn.
 */
export function AuditAdminFilter({ value, onChange }: Props) {
  const intl = useIntl();
  const admins = useLatestRead(listAuditAdmins, { keepWhileReading: true });
  return (
    <ChoiceOrTyped
      value={value}
      onChange={onChange}
      options={(admins.data ?? []).map((admin) => ({
        value: plainText(admin.id),
        label: plainText(admin.username),
      }))}
      loading={admins.loading}
      unavailable={admins.failure !== null}
      label={intl.formatMessage({ id: 'system.audit.filter.admin' })}
      typedLabel={intl.formatMessage({ id: 'system.audit.filter.adminId' })}
      unavailableLabel={intl.formatMessage({ id: 'system.audit.filter.adminId' })}
      placeholder={intl.formatMessage({ id: 'system.audit.filter.adminPick' })}
      otherText={intl.formatMessage({ id: 'system.audit.filter.otherAdmin' })}
      maxLength={MAX_ADMIN_ID}
    />
  );
}
