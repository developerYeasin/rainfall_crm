export const WEEK_STATUS_TONE = {
  'টার্গেট অনুযায়ী/এগিয়ে': 'success',
  'সামান্য পিছিয়ে': 'warning',
  'টার্গেটের চেয়ে পিছিয়ে': 'danger',
  'ডেটা নেই': 'muted',
};

export const CLIENT_STATUS_LABEL = {
  lead: 'লিড',
  onboarding: 'অনবোর্ডিং',
  active: 'অ্যাক্টিভ',
  paused: 'পজড',
  churned: 'চার্নড',
};

export const CLIENT_STATUS_TONE = {
  lead: 'info',
  onboarding: 'warning',
  active: 'success',
  paused: 'muted',
  churned: 'danger',
};

export const CYCLE_STATUS_LABEL = { planned: 'পরিকল্পিত', running: 'চলমান', closed: 'সমাপ্ত' };

export const ROLE_LABEL = {
  admin: 'অ্যাডমিন',
  manager: 'ম্যানেজার',
  media_buyer: 'মিডিয়া বায়ার',
  designer: 'ডিজাইনার',
  viewer: 'ভিউয়ার',
  client: 'ক্লায়েন্ট (পোর্টাল)',
};

export const STAFF_ROLES = ['admin', 'manager', 'media_buyer', 'designer', 'viewer'];
/** Who may record sales, stock and expenses in a client's business ledger. */
export const BUSINESS_WRITE_ROLES = ['admin', 'manager', 'media_buyer', 'client'];

export const ORDER_STATUS_LABEL = {
  pre_order: 'প্রি-অর্ডার',
  confirmed: 'কনফার্মড',
  delivered: 'ডেলিভারড',
  returned: 'রিটার্ন',
  cancelled: 'বাতিল',
};

export const ORDER_STATUS_TONE = {
  pre_order: 'info',
  confirmed: 'warning',
  delivered: 'success',
  returned: 'danger',
  cancelled: 'muted',
};

export const EXPENSE_CATEGORY_LABEL = {
  marketing: 'মার্কেটিং / বুস্ট',
  delivery: 'ডেলিভারি / কুরিয়ার',
  packaging: 'প্যাকেজিং',
  salary: 'বেতন',
  rent: 'ভাড়া',
  utility: 'বিল / ইউটিলিটি',
  other: 'অন্যান্য',
};

export const STOCK_STATUS = {
  ok: { label: 'স্টকে আছে', tone: 'success' },
  low: { label: 'কম স্টক', tone: 'warning' },
  out: { label: 'স্টক শেষ', tone: 'danger' },
};

export const CONTENT_STATUS_TONE = {
  'আইডিয়া': 'muted',
  'ড্রাফট': 'info',
  'ডিজাইন': 'info',
  'রিভিউ': 'warning',
  'অ্যাপ্রুভড': 'success',
  'পাবলিশড': 'success',
};
