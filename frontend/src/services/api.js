import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  login: (data) => api.post('/api/login', data, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
  register: (data) => api.post('/api/register', data),
  getMe: () => api.get('/api/users/me'),
  upgrade: () => api.post('/api/upgrade'),
};

export const boards = {
  getAll: () => api.get('/api/boards'),
  create: (name) => api.post('/api/boards', { name }),
  rename: (id, name) => api.put(`/api/boards/${id}`, { name }),
  delete: (id) => api.delete(`/api/boards/${id}`),
  invite: (id, email, role) => api.post(`/api/boards/${id}/invite`, { email, role }),
  getMembers: (id) => api.get(`/api/boards/${id}/members`),
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

//(All API calls separated)