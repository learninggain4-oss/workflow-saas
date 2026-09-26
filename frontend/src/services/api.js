// frontend/src/services/api.js - FULL FIXED FOR OWNER ROLE CHANGE + ROLE LOGIN CHECK
import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');

  if (typeof window!== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  return 'https://workflow-saas-cof-z.onrender.com';
};

const API_URL = getApiBaseUrl();

/**
 * The API host this build is actually talking to.
 *
 * Worth surfacing in error messages: when the API is unreachable the browser
 * often reports a generic network failure, because a response that omits CORS
 * headers (which a crashed or misrouted service does) is blocked before
 * JavaScript can read its status. Without the resolved host, a user cannot tell
 * a dead local backend from a wrong remote one. Note this value is inlined at
 * build time, so it reflects the build, not the current environment.
 */
export const apiBaseUrl = () => API_URL;
export const apiSource = import.meta.env.VITE_API_URL ? 'VITE_API_URL' : 'fallback';

// A silently chosen API host is a real source of confusion: an unconfigured
// frontend quietly talks to whatever the hardcoded fallback is. Make it loud.
if (!import.meta.env.VITE_API_URL) {
  console.warn(
    `[api] VITE_API_URL is not set, so requests are going to the built-in fallback ${API_URL}. ` +
    'Set VITE_API_URL in your environment and rebuild - it is inlined at build time, not read at runtime.'
  );
}

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const normalizeRole = (role) => String(role || 'editor').trim().toLowerCase();

export const auth = {
  // accepts both URLSearchParams and object { username/email, password, role }
  login: (data) => {
    let formData;
    if (data instanceof URLSearchParams) {
      formData = data;
      // ensure role in URLSearchParams is lowercased - for role correct check
      if (formData.has('role')) {
        formData.set('role', normalizeRole(formData.get('role')));
      }
    } else {
      formData = new URLSearchParams();
      const username = data.username || data.email || '';
      formData.append('username', username.toLowerCase());
      formData.append('password', data.password || '');
      if (data.role) {
        formData.append('role', normalizeRole(data.role));
      }
    }
    return api.post('/api/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },
  // role included in register payload
  register: (data) => {
    const payload = {
      email: String(data.email || '').toLowerCase(),
      password: data.password,
      name: data.name || data.email?.split('@')[0],
      role: normalizeRole(data.role || 'editor'),
    };
    return api.post('/api/register', payload);
  },
  getMe: () => api.get('/api/users/me'),
  updateProfile: (data) => api.put('/api/users/me', data),
  // NOTE: the old `upgrade: () => api.post('/api/upgrade')` was removed along
  // with the endpoint. It let any authenticated caller grant themselves Pro.
  // Billing now goes through the `billing` service and the Paddle webhook.
};

export const admin = {
  getUsers: () => api.get('/api/admin/users'),
  // normalize role + encode userId - owner can change any role
  updateUserRole: (userId, role) => api.put(`/api/admin/users/${encodeURIComponent(userId)}`, { role: normalizeRole(role) }),
  deleteUser: (userId) => api.delete(`/api/admin/users/${encodeURIComponent(userId)}`),
};

export const boards = {
  getAll: () => api.get('/api/boards'),
  create: (name) => api.post('/api/boards', { name }),
  rename: (id, name) => api.put(`/api/boards/${id}`, { name }),
  delete: (id) => api.delete(`/api/boards/${id}`),
  // email lowercased + role normalized + password included for invite email
  invite: (id, email, role, password = '') => api.post(`/api/boards/${id}/invite`, {
    email: String(email).toLowerCase(),
    role: normalizeRole(role),
    password
  }),
  getMembers: (id) => api.get(`/api/boards/${id}/members`),
  // MAIN FIX - accept both string role and object {role, permissions}, normalize, encode userId
  updateMemberRole: (boardId, userId, roleData) => {
    let payload;
    if (typeof roleData === 'string') {
      payload = { role: normalizeRole(roleData) };
    } else if (roleData && typeof roleData === 'object') {
      payload = {...roleData };
      if (payload.role) payload.role = normalizeRole(payload.role);
    } else {
      payload = { role: 'editor' };
    }
    return api.put(`/api/boards/${boardId}/members/${encodeURIComponent(userId)}`, payload);
  },
  removeMember: (boardId, userId) => api.delete(`/api/boards/${boardId}/members/${encodeURIComponent(userId)}`),
  getActivities: (id) => api.get(`/api/boards/${id}/activities`),
  exportCSV: (id) => api.get(`/api/boards/${id}/export`, { responseType: 'blob' }),
};

export const tasks = {
  getAll: (boardId) => api.get(`/api/tasks?board_id=${boardId}`),
  create: (data) => api.post('/api/tasks', data),
  update: (id, data) => api.put(`/api/tasks/${id}`, data),
  delete: (id) => api.delete(`/api/tasks/${id}`),
  getActivities: (id) => api.get(`/api/tasks/${id}/activities`),
};

export const automations = {
  getAll: (boardId) => api.get(`/api/boards/${boardId}/automations`),
  create: (boardId, data) => api.post(`/api/boards/${boardId}/automations`, data),
  update: (boardId, ruleId, data) => api.put(`/api/boards/${boardId}/automations/${ruleId}`, data),
  delete: (boardId, ruleId) => api.delete(`/api/boards/${boardId}/automations/${ruleId}`),
};

export const boardChat = {
  getMessages: (boardId) => api.get(`/api/boards/${boardId}/messages`),
  sendMessage: (boardId, text) => api.post(`/api/boards/${boardId}/messages`, { text }),
};

export const integrations = {
  // Returns { providers, integrations }. The response contains no credentials -
  // only which fields are configured.
  getAll: (boardId) => api.get(`/api/boards/${boardId}/integrations`),
  connect: (boardId, provider, config) => api.post(`/api/boards/${boardId}/integrations`, { provider, config }),
  disconnect: (boardId, provider) => api.delete(`/api/boards/${boardId}/integrations/${provider}`),
  test: (boardId, provider) => api.post(`/api/boards/${boardId}/integrations/${provider}/test`),
};

export const billing = {
  // Authoritative state, written only by the verified Paddle webhook.
  getSubscription: () => api.get('/api/billing/subscription'),
  getInvoices: () => api.get('/api/billing/invoices'),
  // Returns a short-lived Paddle client token. The Paddle API key stays server-side.
  createCheckout: () => api.post('/api/billing/paddle/checkout'),
};

export const subtasks = {
  getAll: (taskId) => api.get(`/api/tasks/${taskId}/subtasks`),
  create: (taskId, title) => api.post(`/api/tasks/${taskId}/subtasks`, { title }),
  update: (id, is_completed) => api.put(`/api/subtasks/${id}`, { is_completed }),
  delete: (id) => api.delete(`/api/subtasks/${id}`),
};

export const comments = {
  getAll: (taskId) => api.get(`/api/tasks/${taskId}/comments`),
  create: (taskId, text) => api.post(`/api/tasks/${taskId}/comments`, { text }),
};

export const notifs = {
  getAll: () => api.get('/api/notifications'),
  markRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

export const uploadFile = (formData) => api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const WS_BASE = API_URL.replace("https://", "wss://").replace("http://", "ws://");

export default api;