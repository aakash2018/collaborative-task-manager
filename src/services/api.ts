import axios, { AxiosResponse } from 'axios';
import { 
  User, 
  Project, 
  Task, 
  LoginResponse, 
  RegisterResponse, 
  CreateProjectData, 
  CreateTaskData, 
  UpdateTaskData,
  ApiResponse 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response: AxiosResponse<LoginResponse> = await api.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  register: async (name: string, email: string, password: string): Promise<RegisterResponse> => {
    const response: AxiosResponse<RegisterResponse> = await api.post('/auth/register', {
      name,
      email,
      password,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response: AxiosResponse<{ user: User }> = await api.get('/auth/me');
    return response.data;
  },
};

// Projects API
export const projectsAPI = {
  getProjects: async (): Promise<Project[]> => {
    const response: AxiosResponse<Project[]> = await api.get('/projects');
    return response.data;
  },

  getProject: async (id: string): Promise<Project> => {
    const response: AxiosResponse<Project> = await api.get(`/projects/${id}`);
    return response.data;
  },

  createProject: async (data: CreateProjectData): Promise<Project> => {
    const response: AxiosResponse<Project> = await api.post('/projects', data);
    return response.data;
  },

  updateProject: async (id: string, data: Partial<CreateProjectData>): Promise<Project> => {
    const response: AxiosResponse<Project> = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  deleteProject: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/projects/${id}`);
    return response.data;
  },

  addMember: async (projectId: string, email: string): Promise<Project> => {
    const response: AxiosResponse<Project> = await api.post(`/projects/${projectId}/members`, {
      email,
    });
    return response.data;
  },

  removeMember: async (projectId: string, memberId: string): Promise<Project> => {
    const response: AxiosResponse<Project> = await api.delete(`/projects/${projectId}/members/${memberId}`);
    return response.data;
  },
};

// Tasks API
export const tasksAPI = {
  getTasks: async (params?: {
    project?: string;
    status?: string;
    assignee?: string;
  }): Promise<Task[]> => {
    const response: AxiosResponse<Task[]> = await api.get('/tasks', { params });
    return response.data;
  },

  getTask: async (id: string): Promise<Task> => {
    const response: AxiosResponse<Task> = await api.get(`/tasks/${id}`);
    return response.data;
  },

  getProjectTasks: async (projectId: string): Promise<Task[]> => {
    const response: AxiosResponse<Task[]> = await api.get(`/tasks/project/${projectId}`);
    return response.data;
  },

  createTask: async (data: CreateTaskData): Promise<Task> => {
    const response: AxiosResponse<Task> = await api.post('/tasks', data);
    return response.data;
  },

  updateTask: async (id: string, data: UpdateTaskData): Promise<Task> => {
    const response: AxiosResponse<Task> = await api.put(`/tasks/${id}`, data);
    return response.data;
  },

  deleteTask: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/tasks/${id}`);
    return response.data;
  },
};

export default api;
