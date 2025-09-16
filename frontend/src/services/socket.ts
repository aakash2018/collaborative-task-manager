import { io, Socket } from 'socket.io-client';
import { Task, Project, User, SocketEvents } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Task events
    this.socket.on('task-created', (task: Task) => {
      this.emit('task-created', task);
    });

    this.socket.on('task-updated', (task: Task) => {
      this.emit('task-updated', task);
    });

    this.socket.on('task-deleted', (data: { taskId: string; projectId: string }) => {
      this.emit('task-deleted', data);
    });

    // Project events
    this.socket.on('project-created', (project: Project) => {
      this.emit('project-created', project);
    });

    this.socket.on('project-updated', (project: Project) => {
      this.emit('project-updated', project);
    });

    this.socket.on('project-deleted', (data: { projectId: string }) => {
      this.emit('project-deleted', data);
    });

    this.socket.on('project-member-added', (data: { project: Project; newMember: User }) => {
      this.emit('project-member-added', data);
    });

    this.socket.on('project-member-removed', (data: { project: Project; removedMemberId: string }) => {
      this.emit('project-member-removed', data);
    });
  }

  // Join a project room to receive updates
  joinProject(projectId: string): void {
    if (this.socket) {
      this.socket.emit('join-project', projectId);
    }
  }

  // Leave a project room
  leaveProject(projectId: string): void {
    if (this.socket) {
      this.socket.emit('leave-project', projectId);
    }
  }

  // Event subscription methods
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit<K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          (callback as any)(data);
        } catch (error) {
          console.error(`Error in socket event listener for ${event}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
