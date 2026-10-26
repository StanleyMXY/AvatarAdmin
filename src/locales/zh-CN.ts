import activity from './zh-CN/activity';
import ads from './zh-CN/ads';
import analytics from './zh-CN/analytics';
import appVersions from './zh-CN/appVersions';
import auth from './zh-CN/auth';
import avatar from './zh-CN/avatar';
import campaign from './zh-CN/campaign';
import channels from './zh-CN/channels';
import clientConfig from './zh-CN/clientConfig';
import companionship from './zh-CN/companionship';
import complaints from './zh-CN/complaints';
import config from './zh-CN/config';
import cost from './zh-CN/cost';
import credits from './zh-CN/credits';
import dashboard from './zh-CN/dashboard';
import email from './zh-CN/email';
import error from './zh-CN/error';
import guestStats from './zh-CN/guestStats';
import invite from './zh-CN/invite';
import memory from './zh-CN/memory';
import menu from './zh-CN/menu';
import moderation from './zh-CN/moderation';
import monitor from './zh-CN/monitor';
import notifications from './zh-CN/notifications';
import pages from './zh-CN/pages';
import permission from './zh-CN/permission';
import push from './zh-CN/push';
import reason from './zh-CN/reason';
import sessions from './zh-CN/sessions';
import sms from './zh-CN/sms';
import stats from './zh-CN/stats';
import subscriptions from './zh-CN/subscriptions';
import support from './zh-CN/support';
import system from './zh-CN/system';
import users from './zh-CN/users';

// All the language files of this language in one flat object. A key must be defined in one file only;
// src/locales/parity.test.ts checks that, and that both languages have the same keys.
export default {
  ...activity,
  ...ads,
  ...analytics,
  ...appVersions,
  ...auth,
  ...avatar,
  ...campaign,
  ...channels,
  ...clientConfig,
  ...companionship,
  ...complaints,
  ...config,
  ...cost,
  ...credits,
  ...dashboard,
  ...email,
  ...guestStats,
  ...invite,
  ...memory,
  ...moderation,
  ...monitor,
  ...notifications,
  ...push,
  ...sessions,
  ...sms,
  ...stats,
  ...subscriptions,
  ...support,
  ...system,
  ...users,
  ...error,
  ...reason,
  ...permission,
  ...pages,
  ...menu,
} as Record<string, string>;
