import activity from './en-US/activity';
import ads from './en-US/ads';
import analytics from './en-US/analytics';
import appVersions from './en-US/appVersions';
import auth from './en-US/auth';
import avatar from './en-US/avatar';
import campaign from './en-US/campaign';
import channels from './en-US/channels';
import clientConfig from './en-US/clientConfig';
import companionship from './en-US/companionship';
import complaints from './en-US/complaints';
import config from './en-US/config';
import cost from './en-US/cost';
import credits from './en-US/credits';
import dashboard from './en-US/dashboard';
import email from './en-US/email';
import error from './en-US/error';
import invite from './en-US/invite';
import memory from './en-US/memory';
import menu from './en-US/menu';
import moderation from './en-US/moderation';
import monitor from './en-US/monitor';
import notifications from './en-US/notifications';
import pages from './en-US/pages';
import permission from './en-US/permission';
import push from './en-US/push';
import reason from './en-US/reason';
import sessions from './en-US/sessions';
import sms from './en-US/sms';
import stats from './en-US/stats';
import subscriptions from './en-US/subscriptions';
import support from './en-US/support';
import system from './en-US/system';
import users from './en-US/users';

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
