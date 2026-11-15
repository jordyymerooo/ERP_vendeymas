import { API_BASE_URL } from '../config/api';

export function receiptPdfUrl(path) {
  const receipt = new URL(path, API_BASE_URL);
  const url = new URL(receipt.pathname + receipt.search, API_BASE_URL);
  const token = localStorage.getItem('auth_token');
  if (token) url.searchParams.set('token', token);
  return url.href;
}
