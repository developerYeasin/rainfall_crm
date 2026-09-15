import { api, unwrap, unwrapList } from './client.js';

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  register: (payload) => api.post('/auth/register', payload).then(unwrap),
  changePassword: (payload) => api.patch('/auth/password', payload).then(unwrap),
};

export const metaApi = {
  get: () => api.get('/meta').then(unwrap),
};

export const clientsApi = {
  list: (params) => api.get('/clients', { params }).then(unwrapList),
  get: (id) => api.get(`/clients/${id}`).then(unwrap),
  create: (payload) => api.post('/clients', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/clients/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/clients/${id}`),
};

export const cyclesApi = {
  list: (params) => api.get('/cycles', { params }).then(unwrapList),
  get: (id) => api.get(`/cycles/${id}`).then(unwrap),
  projection: (id) => api.get(`/cycles/${id}/projection`).then(unwrap),
  create: (payload) => api.post('/cycles', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/cycles/${id}`, payload).then(unwrap),
  updateWeek: ({ id, weekNo, ...payload }) => api.patch(`/cycles/${id}/weeks/${weekNo}`, payload).then(unwrap),
  remove: (id) => api.delete(`/cycles/${id}`),
};

export const performanceApi = {
  list: (params) => api.get('/performance', { params }).then(unwrapList),
  breakdown: (cycleId) => api.get('/performance/breakdown', { params: { cycle_id: cycleId } }).then(unwrap),
  create: (payload) => api.post('/performance', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/performance/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/performance/${id}`),
};

export const controlApi = {
  get: (cycleId) => api.get('/control', { params: { cycle_id: cycleId } }).then(unwrap),
};

export const tasksApi = {
  list: (params) => api.get('/tasks', { params }).then(unwrapList),
  create: (payload) => api.post('/tasks', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/tasks/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/tasks/${id}`),
};

export const contentApi = {
  list: (params) => api.get('/content', { params }).then(unwrapList),
  create: (payload) => api.post('/content', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/content/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/content/${id}`),
};

export const dashboardApi = {
  overview: () => api.get('/dashboard/overview').then(unwrap),
  cycle: (cycleId) => api.get('/dashboard/cycle', { params: { cycle_id: cycleId } }).then(unwrap),
};

/** Staff pass the client they are viewing; for client logins the server ignores it and uses their own. */
const scoped = (clientId, params) => ({ params: { ...params, client_id: clientId } });

export const businessApi = {
  profile: (clientId) => api.get('/business/profile', scoped(clientId)).then(unwrap),
  summary: (clientId, range) => api.get('/business/summary', scoped(clientId, range)).then(unwrap),

  products: (clientId) => api.get('/business/products', scoped(clientId)).then(unwrap),
  createProduct: (clientId, payload) => api.post('/business/products', payload, scoped(clientId)).then(unwrap),
  updateProduct: (clientId, { id, ...payload }) =>
    api.patch(`/business/products/${id}`, payload, scoped(clientId)).then(unwrap),
  removeProduct: (clientId, id) => api.delete(`/business/products/${id}`, scoped(clientId)),

  purchases: (clientId, range) => api.get('/business/purchases', scoped(clientId, range)).then(unwrap),
  createPurchase: (clientId, payload) => api.post('/business/purchases', payload, scoped(clientId)).then(unwrap),
  removePurchase: (clientId, id) => api.delete(`/business/purchases/${id}`, scoped(clientId)),

  orders: (clientId, params) => api.get('/business/orders', scoped(clientId, params)).then(unwrapList),
  createOrder: (clientId, payload) => api.post('/business/orders', payload, scoped(clientId)).then(unwrap),
  updateOrder: (clientId, { id, ...payload }) =>
    api.patch(`/business/orders/${id}`, payload, scoped(clientId)).then(unwrap),
  removeOrder: (clientId, id) => api.delete(`/business/orders/${id}`, scoped(clientId)),

  expenses: (clientId, params) => api.get('/business/expenses', scoped(clientId, params)).then(unwrapList),
  createExpense: (clientId, payload) => api.post('/business/expenses', payload, scoped(clientId)).then(unwrap),
  updateExpense: (clientId, { id, ...payload }) =>
    api.patch(`/business/expenses/${id}`, payload, scoped(clientId)).then(unwrap),
  removeExpense: (clientId, id) => api.delete(`/business/expenses/${id}`, scoped(clientId)),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }).then(unwrapList),
  update: ({ id, ...payload }) => api.patch(`/users/${id}`, payload).then(unwrap),
  deactivate: (id) => api.delete(`/users/${id}`),
};

export const activityApi = {
  list: (params) => api.get('/activity', { params }).then(unwrapList),
};

/** Client-dashboard modules next to the ledger — same client scoping as businessApi. */
export const portalApi = {
  ads: (clientId, params) => api.get('/business/ads', scoped(clientId, params)).then(unwrap),
  accounting: (clientId, year) => api.get('/business/accounting', scoped(clientId, { year })).then(unwrap),
  invoices: (clientId) => api.get('/business/invoices', scoped(clientId)).then(unwrapList),
  messages: (clientId) => api.get('/business/messages', scoped(clientId)).then(unwrap),
  sendMessage: (clientId, payload) => api.post('/business/messages', payload, scoped(clientId)).then(unwrap),
  exportPath: (clientId, file, params) => ({ url: `/business/export/${file}`, params: { ...params, client_id: clientId } }),
};

export const adAccountsApi = {
  list: (params) => api.get('/ad-accounts', { params }).then(unwrap),
  create: (payload) => api.post('/ad-accounts', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/ad-accounts/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/ad-accounts/${id}`),
  sync: (id) => api.post(`/ad-accounts/${id}/sync`).then(unwrap),
};

export const financeApi = {
  invoices: (params) => api.get('/finance/invoices', { params }).then(unwrapList),
  invoice: (id) => api.get(`/finance/invoices/${id}`).then(unwrap),
  createInvoice: (payload) => api.post('/finance/invoices', payload).then(unwrap),
  updateInvoice: ({ id, ...payload }) => api.patch(`/finance/invoices/${id}`, payload).then(unwrap),
  addPayment: ({ id, ...payload }) => api.post(`/finance/invoices/${id}/payments`, payload).then(unwrap),
  removePayment: (id) => api.delete(`/finance/payments/${id}`),
  expenses: (params) => api.get('/finance/expenses', { params }).then(unwrap),
  createExpense: (payload) => api.post('/finance/expenses', payload).then(unwrap),
  removeExpense: (id) => api.delete(`/finance/expenses/${id}`),
  pnl: (year) => api.get('/finance/pnl', { params: { year } }).then(unwrap),
};

export const clientStaffApi = {
  list: (clientId) => api.get(`/clients/${clientId}/staff`).then(unwrap),
  set: (clientId, userIds) => api.put(`/clients/${clientId}/staff`, { user_ids: userIds }).then(unwrap),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then(unwrapList),
  read: (id) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
};

export const agencyTasksApi = {
  list: (params) => api.get('/agency-tasks', { params }).then(unwrap),
  create: (payload) => api.post('/agency-tasks', payload).then(unwrap),
  update: ({ id, ...payload }) => api.patch(`/agency-tasks/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/agency-tasks/${id}`),
};

export const teamApi = {
  list: () => api.get('/team').then(unwrap),
};
