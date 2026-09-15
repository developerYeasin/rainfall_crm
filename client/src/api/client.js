import axios from 'axios';
import { t } from '@/i18n/index.jsx';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const tokenStore = {
  get access() {
    return localStorage.getItem('rf_access');
  },
  get refresh() {
    return localStorage.getItem('rf_refresh');
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem('rf_access', accessToken);
    if (refreshToken) localStorage.setItem('rf_refresh', refreshToken);
  },
  clear() {
    localStorage.removeItem('rf_access');
    localStorage.removeItem('rf_refresh');
  },
};

export const api = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // One silent refresh attempt per failed request, shared across concurrent 401s.
    // /auth/me must refresh too, or reopening the app after the access token expires logs the user out.
    const skipRefresh = /\/auth\/(login|refresh|logout)/.test(original.url || '');
    if (status === 401 && !original._retried && tokenStore.refresh && !skipRefresh) {
      original._retried = true;
      try {
        refreshing =
          refreshing ||
          axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: tokenStore.refresh }).finally(() => {
            refreshing = null;
          });
        const { data } = await refreshing;
        tokenStore.set(data.data);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = '/login';
      }
    }

    const message = t(error.response?.data?.message || error.message || 'সার্ভার এরর');
    return Promise.reject(Object.assign(new Error(message), { details: error.response?.data?.details, status }));
  },
);

export const unwrap = (res) => res.data.data;
export const unwrapList = (res) => ({ rows: res.data.data, meta: res.data.meta });
