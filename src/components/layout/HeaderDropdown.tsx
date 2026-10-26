import { useIntl } from '@umijs/max';
import { Avatar, Dropdown, Space } from 'antd';

type Props = {
  username: string;
  onChangePassword: () => void;
  onLogout: () => void;
};

/** The first character of the user name, whatever the script (a code point, not a UTF-16 unit). */
const initialOf = (username: string) => Array.from(username)[0]?.toLocaleUpperCase() ?? '·';

/** The avatar with its menu: change password and sign out. */
export function HeaderDropdown({ username, onChangePassword, onLogout }: Props) {
  const intl = useIntl();
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
      <Space style={{ cursor: 'pointer' }}>
        <Avatar size="small" data-testid="header-avatar">
          {initialOf(username)}
        </Avatar>
        <span>{username}</span>
      </Space>
    </Dropdown>
  );
}
