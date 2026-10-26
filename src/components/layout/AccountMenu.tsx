import { useState } from 'react';
import { useSession } from '../../session/useSession';
import { ChangePasswordModal } from './ChangePasswordModal';
import { HeaderDropdown } from './HeaderDropdown';

/** The avatar menu of the header with its change-password dialog. Shown for any signed-in account, also when the server sent no user name. */
export function AccountMenu() {
  const { me, signOut } = useSession();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  return (
    <>
      <HeaderDropdown
        username={me.username ?? ''}
        onChangePassword={() => setOpen(true)}
        onLogout={signOut}
      />
      <ChangePasswordModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
