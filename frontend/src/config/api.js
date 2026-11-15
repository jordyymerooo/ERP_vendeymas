import axios from 'axios';
import { installMutationDeduplication } from '../api/mutationDeduplication';

const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const localBaseUrl = `http://${hostname}:8000/api`;
const configuredUrl = new URL(import.meta.env.VITE_API_URL?.trim() || localBaseUrl, localBaseUrl);
const staleLanHost = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(configuredUrl.hostname) &&
  configuredUrl.hostname !== hostname;
const dynamicBaseUrl = staleLanHost ? localBaseUrl : configuredUrl.origin + configuredUrl.pathname.replace(/\/+$/, '');

export const API_BASE_URL = dynamicBaseUrl.replace(/\/api$/, '');
export const API_TIMEOUT = 10000;

// Existing calls on the default client include the /api prefix.
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = API_TIMEOUT;
installMutationDeduplication(axios);

export default axios;
