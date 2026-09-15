export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEDIA_BUYER: 'media_buyer',
  DESIGNER: 'designer',
  VIEWER: 'viewer',
  /** A client's own login — sees only that client's business portal. */
  CLIENT: 'client',
};

export const ALL_ROLES = Object.values(ROLES);

/** Agency team roles (everyone except client logins). */
export const STAFF_ROLES = ALL_ROLES.filter((role) => role !== ROLES.CLIENT);

/** Roles allowed to create/update/delete business data. */
export const WRITE_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.MEDIA_BUYER];

/** Clients may also record their own sales, stock and expenses. */
export const BUSINESS_WRITE_ROLES = [...WRITE_ROLES, ROLES.CLIENT];

export const ORDER_STATUS = ['pre_order', 'confirmed', 'delivered', 'returned', 'cancelled'];
/** Statuses that count as a sale and take units out of stock. */
export const SOLD_STATUS = ['confirmed', 'delivered'];
export const EXPENSE_CATEGORIES = ['marketing', 'delivery', 'packaging', 'salary', 'rent', 'utility', 'other'];

export const AD_PLATFORMS = ['meta', 'google', 'tiktok'];
export const AGENCY_EXPENSE_CATEGORIES = ['salary', 'software', 'rent', 'utility', 'tax', 'marketing', 'other'];
export const TASK_PRIORITIES = ['low', 'normal', 'high'];
export const MESSAGE_KINDS = ['message', 'announcement', 'note'];
/** Roles that run agency finance (invoices, payments). Agency P&L itself is admin-only. */
export const FINANCE_ROLES = [ROLES.ADMIN, ROLES.MANAGER];

export const CLIENT_STATUS =['lead', 'onboarding', 'active', 'paused', 'churned'];
export const CYCLE_STATUS = ['planned', 'running', 'closed'];
export const PLATFORMS = ['Facebook', 'Instagram', 'Google', 'TikTok', 'YouTube', 'LinkedIn', 'Other'];
export const CONTENT_TYPES = ['পোস্ট', 'রিল/ভিডিও', 'স্টোরি', 'কারোসেল', 'ব্লগ', 'অ্যাড ক্রিয়েটিভ'];
export const CONTENT_STATUS = ['আইডিয়া', 'ড্রাফট', 'ডিজাইন', 'রিভিউ', 'অ্যাপ্রুভড', 'পাবলিশড'];

/** Mirrors the IFS() status formula on the "কন্ট্রোল ইন্সপেকশন শীট" tab. */
export const WEEK_STATUS = {
  NO_DATA: 'ডেটা নেই',
  ON_TRACK: 'টার্গেট অনুযায়ী/এগিয়ে',
  SLIGHTLY_BEHIND: 'সামান্য পিছিয়ে',
  BEHIND: 'টার্গেটের চেয়ে পিছিয়ে',
};

export const COMPLIANCE_FIELDS = [
  'morning_check',
  'ad_monitoring_done',
  'report_updated',
  'client_update_sent',
];
