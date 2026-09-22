// src/services/api.js - UPDATED FOR ROLE SELECT AT SIGN IN
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

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  // UPDATED: accepts both URLSearchParams and object { username/email, password, role }
  login: (data) => {
    let formData;
    if (data instanceof URLSearchParams) {
      formData = data;
    } else {
      formData = new URLSearchParams();
      const username = data.username || data.email || '';
      formData.append('username', username);
      formData.append('password', data.password || '');
      if (data.role) {
        formData.append('role', String(data.role).toLowerCase());
      }
    }
    return api.post('/api/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },
  // UPDATED: role included in register payload
  register: (data) => {
    // Expected: { email, password, name, role }
    const payload = {
      email: data.email,
      password: data.password,
      name: data.name || data.email?.split('@')[0],
      role: data.role || 'editor',
    };
    return api.post('/api/register', payload);
  },
  getMe: () => api.get('/api/users/me'),
  updateProfile: (data) => api.put('/api/users/me', data),
  upgrade: () => api.post('/api/upgrade'),
};

export const admin = {
  getUsers: () => api.get('/api/admin/users'),
  updateUserRole: (userId, role) => api.put(`/api/admin/users/${userId}`, { role }),
  deleteUser: (userId) => api.delete(`/api/admin/users/${userId}`),
};

export const boards = {
  getAll: () => api.get('/api/boards'),
  create: (name) => api.post('/api/boards', { name }),
  rename: (id, name) => api.put(`/api/boards/${id}`, { name }),
  delete: (id) => api.delete(`/api/boards/${id}`),
  invite: (id, email, role, password = '') => api.post(`/api/boards/${id}/invite`, { email, role, password }),
  getMembers: (id) => api.get(`/api/boards/${id}/members`),
  updateMemberRole: (boardId, userId, role) => api.put(`/api/boards/${boardId}/members/${userId}`, { role }),
  removeMember: (boardId, userId) => api.delete(`/api/boards/${boardId}/members/${userId}`),
  getActivities: (id) => api.get(`/api/boards/${id}/activities`),
  exportCSV: (id) => api.get(`/api/boards/${id}/export`, { responseType: 'blob' }),
};

export const tasks = {
  getAll: (boardId) => api.get(`/api/tasks?board_id=${boardId}`),
  create: (data) => api.post('/api/tasks', data),
  update: (id, data) => api.put(`/api/tasks/${id}`, data),
  delete: (id) => api.delete(`/api/tasks/${id}`),
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