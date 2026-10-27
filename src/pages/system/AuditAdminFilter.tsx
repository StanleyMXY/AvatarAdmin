import { useAccess, useIntl } from '@umijs/max';
import { Input, Select } from 'antd';
import { loadAllAdmins } from '../../services/system';
import { useRead } from './useRead';

type Props = { value?: string; onChange?: (value: string | undefined) => void };

/**
 * The filter "administrator" of the audit log. An administrator who may list the administrators
 * (ADMIN:MANAGE) picks one by name; the value is the id; when that list cannot be read they type the
 * id. Anyone else gets no filter at all (nothing is drawn). The log shows the name of the moment of
 * writing; the filter works on the id, which does not change when the administrator is renamed.
 */
export function AuditAdminFilter({ value, onChange }: Props) {
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  if (!access.canAccess('ADMIN:MANAGE')) return null;
  return <PickByName value={value} onChange={onChange} />;
}

function PickByName({ value, onChange }: Props) {
  const intl = useIntl();
  const admins = useRead(loadAllAdmins);
  if (admins.state.status === 'failed') {
    return (
      <Input
        aria-label={intl.formatMessage({ id: 'system.audit.filter.adminId' })}
        value={value ?? ''}
        allowClear
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  }
  return (
    <Select
      aria-label={intl.formatMessage({ id: 'system.audit.filter.admin' })}
      showSearch
      allowClear
      optionFilterProp="label"
      value={value === '' ? undefined : value}
      loading={admins.state.status === 'loading'}
      placeholder={intl.formatMessage({ id: 'system.audit.filter.adminPick' })}
      options={(admins.state.data ?? []).map((admin) => ({
        value: admin.id,
        label: String(admin.username),
      }))}
      onChange={(next) => onChange?.(next)}
    />
  );
}
