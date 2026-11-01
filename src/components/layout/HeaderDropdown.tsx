import { useIntl } from '@umijs/max';
import { Avatar, Dropdown, Grid, Space } from 'antd';
import { useModeTokens } from '../../theme/modes';

type Props = {
  username: string;
  onChangePassword: () => void;
  onLogout: () => void;
};

/** The first character of the user name, whatever the script (a code point, not a UTF-16 unit). */
const initialOf = (username: string) => Array.from(username)[0]?.toLocaleUpperCase() ?? '·';

/**
 * The avatar with its menu: change password and sign out. On a phone-width window the user name is
 * left out of the header (the language and theme switches and the avatar are all that fit); it stays
 * the name of the button, for a screen reader and as the hover text.
 */
export function HeaderDropdown({ username, onChangePassword, onLogout }: Props) {
  const intl = useIntl();
  const phone = Grid.useBreakpoint().xs === true;
  const tokens = useModeTokens();
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'password',
            label: intl.formatMessage({ id: 'pages.header.changePassword' }),
            onClick: onChangePassword,
          },
          {
            key: 'logout',
            label: intl.formatMessage({ id: 'pages.header.logout' }),
            onClick: onLogout,
          },
        ],
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-label={username || undefined}
        title={username || undefined}
        style={{
          cursor: 'pointer',
          background: 'none',
          border: 0,
          padding: 0,
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <Space>
          {/* The default grey avatar carries a white letter at 1.8:1; the primary colour carries the text of a primary button */}
          <Avatar
            size="small"
            data-testid="header-avatar"
            style={{ background: tokens.colorPrimary, color: tokens.colorTextOnPrimary }}
          >
            {initialOf(username)}
          </Avatar>
          {phone ? null : <span>{username}</span>}
        </Space>
      </button>
    </Dropdown>
  );
}
