import { API_BASE_URL } from '../config/api';

export function authenticatedApiUrl(path) {
  const apiBase = new URL(API_BASE_URL || window.location.origin);
  const requested = new URL(path, apiBase);
  const url = new URL(apiBase.origin);
  const basePath = apiBase.pathname.replace(/\/$/, '');
  const pathname = requested.pathname.replace(/^\/+/, '/');
  url.pathname = basePath && !pathname.startsWith(basePath + '/') ? basePath + pathname : pathname;
  url.search = requested.search;
  const token = localStorage.getItem('auth_token');
  if (token) url.searchParams.set('token', token);
  return API_BASE_URL ? url.href : url.pathname + url.search;
}

export const receiptPdfUrl = authenticatedApiUrl;
