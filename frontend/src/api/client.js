import axios from 'axios';

const API_BASE = '/api/v1';

// Create an Axios instance
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('api_cortex_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Auth Helpers
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('api_cortex_token', token);
  } else {
    localStorage.removeItem('api_cortex_token');
  }
};

export const getAuthToken = () => localStorage.getItem('api_cortex_token');

export const authAPI = {
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data?.access_token) {
      setAuthToken(res.data.access_token);
    }
    return res.data;
  },
  register: async (email, password, fullName) => {
    const res = await apiClient.post('/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  logout: () => {
    setAuthToken(null);
  }
};

// System Health & Dashboard Summary
export const dashboardAPI = {
  getHealth: async () => {
    const res = await axios.get('/api/v1/health');
    return res.data;
  },
  getSummary: async (projectId = null) => {
    const params = projectId ? { project_id: projectId } : {};
    const res = await apiClient.get('/dashboard/summary', { params });
    console.log("Summary response:", res.data);
    return res.data;
  },
  getMetricsText: async () => {
    const res = await axios.get('/metrics', { responseType: 'text' });
    return res.data;
  }
};

// Projects / Workspaces CRUD
export const projectsAPI = {
  getAll: async () => {
    const res = await apiClient.get('/projects/');
    console.log("Projects response:", res.data);
    return Array.isArray(res.data) ? res.data : (res.data.projects || []);
  },
  getById: async (id) => {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/projects/', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await apiClient.put(`/projects/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/projects/${id}`);
    return res.data;
  }
};

// Target API Configurations CRUD & Manual Trigger
export const apiConfigsAPI = {
  getAll: async (projectId = null) => {
    const params = projectId ? { project_id: projectId } : {};
    const res = await apiClient.get('/apis/', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await apiClient.get(`/apis/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/apis/', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await apiClient.put(`/apis/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/apis/${id}`);
    return res.data;
  },
  triggerCheck: async (id) => {
    const res = await apiClient.post(`/apis/${id}/trigger`);
    return res.data;
  }
};

// Issues & Gemini AI Diagnoses
export const issuesAPI = {
  getAll: async (params = {}) => {
    const res = await apiClient.get('/issues/', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await apiClient.get(`/issues/${id}`);
    return res.data;
  },
  diagnose: async (id) => {
    const res = await apiClient.post(`/issues/${id}/diagnose`);
    return res.data;
  },
  getDiagnosis: async (id) => {
    const res = await apiClient.get(`/issues/${id}/diagnosis`);
    return res.data;
  }
};

// Monitoring History Logs
export const monitoringAPI = {
  getLogs: async (params = {}) => {
    const res = await apiClient.get('/monitoring/logs', { params });
    return res.data;
  }
};

export default apiClient;
