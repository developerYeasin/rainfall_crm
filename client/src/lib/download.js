import { api } from '@/api/client.js';

/**
 * Downloads an authenticated file (xlsx/pdf). A plain <a href> can't carry the bearer token,
 * so the file is fetched as a blob and saved through a temporary object URL.
 */
export const downloadFile = async (url, params, filename) => {
  const res = await api.get(url, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const name = filename || disposition.match(/filename="?([^"]+)"?/)?.[1] || 'download';
  const href = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
};
