import type { AdminRoute } from '../src/access/canAccess';

// The first-level menus of spec table 5.0, in the order of the table. A menu is a group without a
// path of its own: its pages can have any path (the activity menu holds /act/... and /invite/rewards,
// the subscription menu holds /subscriptions/... and /credits/...). The key is the route `name`, so the
// texts are `menu.<key>` and `menu.<key>.<child name>` in the language files. Several modules can add
// pages to one menu; they all build it with `menuGroup`, so name and icon cannot differ.
export const MENUS = {
  dashboard: 'DashboardOutlined', // 总览
  users: 'UserOutlined', // 用户
  moderation: 'SafetyCertificateOutlined', // 内容审核
  avatar: 'SkinOutlined', // 形象与装扮
  complaints: 'WarningOutlined', // 投诉
  sessions: 'PhoneOutlined', // 通话
  companionship: 'HeartOutlined', // 养成管理
  subscriptions: 'CreditCardOutlined', // 订阅与额度
  ads: 'FundProjectionScreenOutlined', // 应用内广告
  push: 'BellOutlined', // 推送
  invite: 'GiftOutlined', // 邀请
  activity: 'CalendarOutlined', // 活动管理
  campaign: 'RiseOutlined', // 投放管理
  stats: 'BarChartOutlined', // 统计报表
  analytics: 'LineChartOutlined', // 埋点管理
  support: 'CustomerServiceOutlined', // 客服
  memory: 'DatabaseOutlined', // 记忆服务
  monitor: 'MonitorOutlined', // 系统监控
  cost: 'DollarOutlined', // 成本
  config: 'SettingOutlined', // 系统配置
  email: 'MailOutlined', // 邮件模板
  sms: 'MessageOutlined', // 短信管理
  system: 'ToolOutlined', // 系统管理
} as const;

export type MenuKey = keyof typeof MENUS;

export function menuGroup(key: MenuKey, routes: AdminRoute[]): AdminRoute {
  return { key, name: key, icon: MENUS[key], routes };
}

// Every page route of spec table 5.0 in the order of the table (83 paths). The pages of a menu are
// shown in this order whichever module adds them. Read from the spec snapshot by
// scripts/routeInventory.ts; config/menus.test.ts keeps the two equal.
export const ROUTE_ORDER: readonly string[] = [
  '/dashboard',
  '/users/list',
  '/users/abuse',
  '/users/:id',
  '/users/deletions',
  '/users/notifications',
  '/moderation/queue',
  '/moderation/:id',
  '/moderation/rules',
  '/moderation/stats',
  '/avatar/cosmetics',
  '/avatar/actions',
  '/avatar/declarations',
  '/avatar/renderer-models',
  '/avatar/generation-tasks',
  '/avatar/default-avatars',
  '/complaints/likeness',
  '/sessions/list',
  '/sessions/analytics',
  '/sessions/quality',
  '/companionship',
  '/subscriptions/list',
  '/subscriptions/entitlements',
  '/subscriptions/gates',
  '/subscriptions/products',
  '/subscriptions/events',
  '/subscriptions/stats',
  '/credits/products',
  '/credits/requests',
  '/credits/accounts',
  '/credits/transactions',
  '/credits/stats',
  '/ads/campaigns',
  '/ads/placements',
  '/ads/units',
  '/ads/creatives',
  '/ads/report',
  '/push/templates',
  '/push/tasks',
  '/push/schedules',
  '/push/records',
  '/push/stats',
  '/push/recall',
  '/invite/codes',
  '/invite/records',
  '/invite/stats',
  '/invite/share-stats',
  '/act/act-signin-config',
  '/act/act-signin-record',
  '/act/act-signin-stats',
  '/act/act-task-config',
  '/act/act-task-record',
  '/act/act-task-stats',
  '/invite/rewards',
  '/campaign/stats',
  '/campaign/accounts',
  '/campaign/attribution',
  '/campaign/settings',
  '/stat/daily',
  '/stat/retention',
  '/stat/guest',
  '/analytics/summary',
  '/analytics/detail',
  '/analytics/funnel',
  '/support/feedback',
  '/memory/tiers',
  '/memory/models',
  '/monitor',
  '/monitor/alerts',
  '/cost/report',
  '/cost/prices',
  '/config',
  '/config/client',
  '/email/templates',
  '/sms/channels',
  '/sms/templates',
  '/sms/records',
  '/system/admins',
  '/system/roles',
  '/system/permissions',
  '/system/app-versions',
  '/system/channels',
  '/system/audit',
];
