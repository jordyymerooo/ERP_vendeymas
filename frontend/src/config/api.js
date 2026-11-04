import axios from 'axios';

// Detecta automáticamente si se está navegando desde localhost o desde la IP local de la red Wi-Fi (celular/tablet)
export const API_BASE_URL = typeof window !== 'undefined' && window.location?.hostname
  ? `http://${window.location.hostname}:8000`
  : 'http://localhost:8000';

axios.defaults.baseURL = API_BASE_URL;

export default axios;
