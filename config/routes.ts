import { assembleRoutes } from './assembleRoutes';
import activity from './routes/activity';
import ads from './routes/ads';
import analytics from './routes/analytics';
import appVersions from './routes/appVersions';
import auth from './routes/auth';
import avatar from './routes/avatar';
import campaign from './routes/campaign';
import channels from './routes/channels';
import clientConfig from './routes/clientConfig';
import companionship from './routes/companionship';
import complaints from './routes/complaints';
import config from './routes/config';
import cost from './routes/cost';
import credits from './routes/credits';
import dashboard from './routes/dashboard';
import email from './routes/email';
import invite from './routes/invite';
import memory from './routes/memory';
import moderation from './routes/moderation';
import monitor from './routes/monitor';
import notifications from './routes/notifications';
import push from './routes/push';
import sessions from './routes/sessions';
import sms from './routes/sms';
import stats from './routes/stats';
import subscriptions from './routes/subscriptions';
import support from './routes/support';
import system from './routes/system';
import users from './routes/users';

// Assembly only. The modules are listed in the order of the menu in spec 5.0; the menu order is
// the array order. A module that adds pages to another module's menu repeats that menu entry
// (same path, name and icon) with its own children; see `mergeMenus`.
export default assembleRoutes({
  auth,
  modules: [
    dashboard, // 总览
    users, // 用户
    notifications, //   (站内通知 joins the 用户 menu)
    moderation, // 内容审核
    avatar, // 形象与装扮
    complaints, // 投诉
    sessions, // 通话
    companionship, // 养成管理
    subscriptions, // 订阅与额度
    credits, //   (额度页面 join the 订阅与额度 menu)
    ads, // 应用内广告
    push, // 推送
    invite, // 邀请 (and 奖励设置 in the 活动管理 menu)
    activity, // 活动管理
    campaign, // 投放管理
    stats, // 统计报表
    analytics, // 埋点管理
    support, // 客服
    memory, // 记忆服务
    monitor, // 系统监控
    cost, // 成本
    config, // 系统配置
    clientConfig, //   (客户端配置 joins the 系统配置 menu)
    email, // 邮件模板
    sms, // 短信管理
    system, // 系统管理
    appVersions, //   (应用版本 joins the 系统管理 menu)
    channels, //   (渠道包 joins the 系统管理 menu)
  ],
});
