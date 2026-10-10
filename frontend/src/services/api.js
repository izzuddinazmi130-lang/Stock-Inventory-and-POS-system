import axios from 'axios';
import { progressStart, progressDone } from '../components/TopProgress';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Top loading bar: count requests while they are in flight
api.interceptors.request.use((config) => { progressStart(); return config; }, (error) => { progressDone(); return Promise.reject(error); });

// Interceptor for handling 401 errors
api.interceptors.response.use(
  (response) => { progressDone(); return response; },
  (error) => {
    progressDone();
    if (error.response && error.response.status === 401) {
      // Redirect to login if unauthorized and not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
