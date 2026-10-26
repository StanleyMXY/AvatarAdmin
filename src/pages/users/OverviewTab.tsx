import { useIntl } from '@umijs/max';
import { Descriptions, Flex, Tag } from 'antd';
import type { ReactNode } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { MaskedText } from '../../components/MaskedText';
import { StatusTag } from '../../components/StatusTag';
import { USER_STATUSES, type UserDetail } from '../../services/users';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { Cell } from './Cell';
import { STATUS_COLORS } from './statusColors';
import { countText, labelOf } from './text';

/** `user.status` as a tag; a state the page does not know is shown as it came. */
export function useStatusOptions() {
  const intl = useIntl();
  return Object.fromEntries(
    USER_STATUSES.map((status) => [
      status,
      { label: labelOf(intl, 'users.status', status), color: STATUS_COLORS[status] },
    ]),
  );
}

/**
 * 概览: the profile (with the companion name; an empty one is a dash), the state with the ban reason
 * and time, the care data and the asset counts. The e-mail and phone number are what the backend
 * gave: masked, with a note on which permission shows them whole, unless the administrator holds it.
 */
export function OverviewTab({ user }: { user: UserDetail }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const statusOptions = useStatusOptions();
  const when = (value: unknown) => {
    const text = plainText(value);
    return text === '' ? DASH : formatInstant(text, intl.locale);
  };
  const count = (value: unknown) => countText(value, intl.locale);
  const item = (key: string, label: string, content: ReactNode) => ({
    key,
    label,
    children: <span data-testid={`field-${key}`}>{content}</span>,
  });
  const yesNo = (value: unknown) =>
    typeof value === 'boolean' ? t(value ? 'users.common.yes' : 'users.common.no') : DASH;
  const email = plainText(user.email);
  const phone = plainText(user.phone);
  const methods = Array.isArray(user.loginMethods) ? user.loginMethods : [];
  const care = user.companionship ?? ({} as Partial<UserDetail['companionship']>);
  const counts = user.counts ?? ({} as Partial<UserDetail['counts']>);

  const section = (title: string, items: ReturnType<typeof item>[]) => (
    <Descriptions
      bordered
      size="small"
      title={title}
      column={{ xs: 1, md: 2 }}
      items={items}
      styles={{ label: { width: 220 } }}
    />
  );

  return (
    <Flex vertical gap={24}>
      {section(t('users.overview.profile'), [
        item(
          'email',
          t('users.overview.email'),
          <MaskedText value={email} needsCode={email ? 'USER:EMAIL_VIEW' : undefined} />,
        ),
        item('emailVerifiedAt', t('users.overview.emailVerifiedAt'), when(user.emailVerifiedAt)),
        item(
          'phone',
          t('users.overview.phone'),
          <MaskedText value={phone} needsCode={phone ? 'USER:PHONE_VIEW' : undefined} />,
        ),
        item('phoneVerifiedAt', t('users.overview.phoneVerifiedAt'), when(user.phoneVerifiedAt)),
        item(
          'loginMethods',
          t('users.overview.loginMethods'),
          methods.length === 0 ? (
            DASH
          ) : (
            <Flex gap={4} wrap>
              {methods.map((method) => (
                <Tag key={plainText(method)}>{labelOf(intl, 'users.method', method)}</Tag>
              ))}
            </Flex>
          ),
        ),
        item(
          'traffic',
          t('users.overview.traffic'),
          labelOf(intl, 'users.traffic', user.trafficType),
        ),
        item('channel', t('users.overview.channel'), <Cell value={user.channelCode} />),
        item('platform', t('users.overview.platform'), <Cell value={user.registerPlatform} />),
        item('timezone', t('users.overview.timezone'), <Cell value={user.timezone} />),
        item('language', t('users.overview.language'), <Cell value={user.conversationLanguage} />),
        item(
          'companionName',
          t('users.overview.companionName'),
          <Cell value={user.companionName} />,
        ),
        item('persona', t('users.overview.persona'), <Cell value={user.personaModerationStatus} />),
        item(
          'avatarAsset',
          t('users.overview.avatarAsset'),
          <Cell value={user.currentAvatarAssetId} />,
        ),
        item(
          'voiceAsset',
          t('users.overview.voiceAsset'),
          <Cell value={user.currentVoiceAssetId} />,
        ),
        item('lifetimeGrant', t('users.overview.lifetimeGrant'), count(user.lifetimeGrantSeconds)),
        item('lifetimeUsed', t('users.overview.lifetimeUsed'), count(user.lifetimeUsedSeconds)),
        item('priorInvitee', t('users.overview.priorInvitee'), yesNo(user.priorInviteeRewarded)),
        item('inviteRewarded', t('users.overview.inviteRewarded'), count(user.inviteRewardedCount)),
        item('createdAt', t('users.overview.createdAt'), when(user.createdAt)),
      ])}
      {section(t('users.overview.status'), [
        item(
          'state',
          t('users.overview.state'),
          <StatusTag status={plainText(user.status)} options={statusOptions} />,
        ),
        item(
          'banReason',
          t('users.overview.banReason'),
          plainText(user.banReason) === '' ? (
            DASH
          ) : (
            <EllipsisPopoverText text={plainText(user.banReason)} lines={3} width={420} />
          ),
        ),
        item('bannedAt', t('users.overview.bannedAt'), when(user.bannedAt)),
      ])}
      {section(t('users.overview.care'), [
        item('interactions', t('users.overview.interactions'), count(care.interactionCount)),
        item('streak', t('users.overview.streak'), count(care.currentStreak)),
        item('lastDate', t('users.overview.lastDate'), <Cell value={care.lastInteractionDate} />),
        item('lastAt', t('users.overview.lastAt'), when(care.lastInteractionAt)),
      ])}
      {section(t('users.overview.assets'), [
        item('avatars', t('users.overview.avatars'), count(counts.avatars)),
        item('voices', t('users.overview.voices'), count(counts.voices)),
        item('looks', t('users.overview.looks'), count(counts.looks)),
        item('cosmetics', t('users.overview.cosmetics'), count(counts.cosmetics)),
      ])}
    </Flex>
  );
}
