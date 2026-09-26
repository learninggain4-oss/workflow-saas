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

// A silently chosen API host is a real source of confusion: an unconfigured
// frontend quietly talks to whatever the hardcoded fallback is. Make it loud.
if (!import.meta.env.VITE_API_URL) {
  console.warn(
    `[api] VITE_API_URL is not set, so requests are going to the built-in fallback ${API_URL}. ` +
    'Set VITE_API_URL in your environment and rebuild - it is inlined at build time, not read at runtime.'
  );
}

// A cross-origin API host needs that frontend origin in the backend's
// ALLOWED_ORIGINS, or every response comes back without an
// Access-Control-Allow-Origin header - and a 500 then reaches the browser as an
// opaque "Network Error" with no readable body. Name both hosts up front.
if (import.meta.env.DEV && typeof window !== 'undefined' && !API_URL.includes(window.location.hostname)) {
  console.warn(
    `[api] frontend origin ${window.location.origin} is cross-origin to API ${API_URL}. ` +
    `Add ${window.location.origin} to the backend's ALLOWED_ORIGINS (comma-separated), otherwise CORS will block the responses.`
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
  // No `upgrade` helper here. The server still exposes POST /api/upgrade, which
  // sets subscription_tier="pro" for any authenticated caller with no payment -
  // it should not be driven from the client, and it is a known open issue.
};

export const admin = {
  getUsers: () => api.get('/api/admin/users'),
  // normalize role + encode userId - owner can change any role
  updateUserRole: (userId, role) => api.put(`/api/admin/users/${encodeURIComponent(userId)}`, { role: normalizeRole(role) }),
  deleteUser: (userId) => api.delete(`/api/admin/users/${encodeURIComponent(userId)}`),
};

export const boards = {
  getAll: () => api.get('/api/boards'),
  // Accepts a bare name (sidebar) or a { name, description } payload (templates).
  // The request body must always match schemas.BoardCreate: `name` is a string,
  // never a nested object, otherwise the API answers 422.
  create: (nameOrPayload) => {
    const payload = typeof nameOrPayload === 'string'
      ? { name: nameOrPayload }
      : { name: nameOrPayload?.name, description: nameOrPayload?.description ?? '' };
    return api.post('/api/boards', payload);
  },
  // Atomic: board + all template tasks in one server transaction (§4.2).
  createFromTemplate: (templateId, name) => api.post('/api/boards/from-template', {
    template_id: templateId,
    name: (name || '').trim() || undefined,
  }),
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

export const onboarding = {
  // Read-only: the server derives every step from rows that already exist, so
  // there is nothing to write and no way for the page to show stale progress.
  get: () => api.get('/api/onboarding'),
};

export const automations = {  getAll: (boardId) => api.get(`/api/boards/${boardId}/automations`),
  create: (boardId, data) => api.post(`/api/boards/${boardId}/automations`, data),
  update: (boardId, ruleId, data) => api.put(`/api/boards/${boardId}/automations/${ruleId}`, data),
  delete: (boardId, ruleId) => api.delete(`/api/boards/${boardId}/automations/${ruleId}`),
};

export const boardChat = {
  getMessages: (boardId) => api.get(`/api/boards/${boardId}/messages`),
  sendMessage: (boardId, text) => api.post(`/api/boards/${boardId}/messages`, { text }),
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

export const templates = {
  getAll: () => api.get('/api/templates'),
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