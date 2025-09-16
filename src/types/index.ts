export interface User {
  _id: string;
  name: string;
  firstName:string;
  lastName:string;
  email: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  owner: User;
  members: User[];
  color: string;
  createdAt: string;
  updatedAt: string;
  taskCounts?: {
    todo: number;
    'in-progress': number;
    done: number;
  };
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee?: User;
  project: Project;
  dueDate?: string;
  tags: string[];
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export interface ApiResponse<T> {
  message?: string;
  data?: T;
  errors?: Array<{
    msg: string;
    param: string;
    location: string;
  }>;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  token: string;
  user: User;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  project: string;
  status?: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  tags?: string[];
}

export interface SocketEvents {
  'task-created': (task: Task) => void;
  'task-updated': (task: Task) => void;
  'task-deleted': (data: { taskId: string; projectId: string }) => void;
  'project-created': (project: Project) => void;
  'project-updated': (project: Project) => void;
  'project-deleted': (data: { projectId: string }) => void;
  'project-member-added': (data: { project: Project; newMember: User }) => void;
  'project-member-removed': (data: { project: Project; removedMemberId: string }) => void;
}
