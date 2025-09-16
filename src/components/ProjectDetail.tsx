import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI, tasksAPI } from '../services/api';
import { Project, Task, CreateTaskData, UpdateTaskData, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket, useSocketConnection } from '../hooks/useSocket';
import { Plus, UserPlus, Filter, Calendar, X, CheckCircle2, CircleDot, CircleDashed } from 'lucide-react';

const statusLabels: Record<Task['status'], { label: string; color: string }> = {
  'todo': { label: 'Todo', color: 'bg-gray-100 text-gray-800' },
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  'done': { label: 'Done', color: 'bg-green-100 text-green-800' },
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinProject, leaveProject } = useSocketConnection();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [newTask, setNewTask] = useState<Partial<CreateTaskData>>({
    title: '',
    description: '',
    project: id || '',
    status: 'todo',
    priority: 'medium',
    assignee: undefined,
    dueDate: undefined,
    tags: [],
  });
  const [memberEmail, setMemberEmail] = useState('');
  const [filters, setFilters] = useState<{ status?: Task['status']; assignee?: string }>({});

  useEffect(() => {
    if (!id) return;
    fetchProject();
    fetchTasks();
    joinProject(id);
    return () => leaveProject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProject = async () => {
    if (!id) return;
    try {
      const data = await projectsAPI.getProject(id);
      console.log(data);
      setProject(data);
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };

  const fetchTasks = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await tasksAPI.getProjectTasks(id);
      console.log(data);
      setTasks(data);

    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Socket event handlers
  useSocket('task-created', (task) => {
    console.log(task);
    if (task.project._id === id) {
      setTasks((prev) => {
        const exists = prev.some(t => t._id === task._id);
        if (exists) return prev;
        return [task, ...prev];
      });
    };
  }, [id]);
  useSocket('task-updated', (task) => {
    if (task.project._id === id) setTasks((prev) => prev.map(t => t._id === task._id ? task : t));
  }, [id]);
  useSocket('task-deleted', ({ taskId, projectId }) => {
    if (projectId === id) setTasks((prev) => prev.filter(t => t._id !== taskId));
  }, [id]);
  useSocket('project-updated', (proj) => {
    if (proj._id === id) setProject(proj);
  }, [id]);
  useSocket('project-member-added', ({ project: proj }) => {
    if (proj._id === id) setProject(proj);
  }, [id]);
  useSocket('project-member-removed', ({ project: proj }) => {
    if (proj._id === id) setProject(proj);
  }, [id]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      console.log(t, "filterTasks");
      if (filters.status && t.status !== filters.status) return false;
      if (filters.assignee && t.assignee?._id !== filters.assignee) return false;
      return true;
    });
  }, [tasks, filters]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTask.title) return;
    try {
      const payload: CreateTaskData = {
        title: newTask.title!,
        description: newTask.description || '',
        project: id,
        status: (newTask.status as Task['status']) || 'todo',
        priority: (newTask.priority as Task['priority']) || 'medium',
        assignee: newTask.assignee,
        dueDate: newTask.dueDate,
        tags: newTask.tags || [],
      };
      const task = await tasksAPI.createTask(payload);
      // setTasks((prev) => [task, ...prev]);
      setTasks((prev) => {
        const exists = prev.some(t => t._id === task._id);
        if (exists) return prev;
        return [task, ...prev];
      });
      setShowTaskModal(false);
      setNewTask({ title: '', description: '', project: id, status: 'todo', priority: 'medium', tags: [] });
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: UpdateTaskData) => {
    try {
      const updated = await tasksAPI.updateTask(taskId, updates);
      setTasks((prev) => prev.map(t => t._id === taskId ? updated : t));

    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await tasksAPI.deleteTask(taskId);
      setTasks((prev) => prev.filter(t => t._id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !memberEmail) return;
    try {
      const proj = await projectsAPI.addMember(id, memberEmail);
      setProject(proj);
      setMemberEmail('');
      setShowMemberModal(false);
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: project.color }} />
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMemberModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </button>
              <button
                onClick={() => setShowTaskModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg p-4 shadow flex flex-wrap items-center gap-3">
          <div className="flex items-center text-gray-700">
            <Filter className="h-4 w-4 mr-2" /> Filters:
          </div>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as Task['status'] | undefined })}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="todo">Todo</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <select
            value={filters.assignee || ''}
            onChange={(e) => setFilters({ ...filters, assignee: e.target.value || undefined })}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="">All Assignees</option>
            {project.members.map((m: User) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
          {(filters.status || filters.assignee) && (
            <button
              onClick={() => setFilters({})}
              className="ml-auto text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Tasks */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['todo', 'in-progress', 'done'] as Task['status'][]).map((status) => (
            <div key={status} className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex items-center justify-between">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusLabels[status].color}`}>
                  {statusLabels[status].label}
                </div>
              </div>
              <div className="p-4 space-y-3 min-h-[120px]">
                {filteredTasks
                  .filter(t => t.status === status)
                  .map(task => (
                    <div key={task._id} className="border rounded-md p-3 hover:shadow">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-gray-900">{task.title} </h4>
                        <button onClick={() => handleDeleteTask(task._id)} className="text-gray-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description} </p>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-2">
                          {task.priority === 'high' && <CircleDot className="h-4 w-4 text-red-500" />}
                          {task.priority === 'medium' && <CircleDashed className="h-4 w-4 text-yellow-500" />}
                          {task.priority === 'low' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {task.assignee && (<span>{task.assignee.name}</span>)}
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center"><Calendar className="h-4 w-4 mr-1" />{new Date(task.dueDate).toLocaleDateString()}</div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center space-x-2">
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTask(task._id, { status: e.target.value as Task['status'] })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                        >
                          <option value="todo">Todo</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        <select
                          value={task.priority}
                          onChange={(e) => handleUpdateTask(task._id, { priority: e.target.value as Task['priority'] })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <select
                          value={task.assignee?._id || ''}
                          onChange={(e) => handleUpdateTask(task._id, { assignee: e.target.value || undefined })}
                          className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                        >
                          <option value="">Unassigned</option>
                          {project.members.map((m: User) => (
                            <option key={m._id} value={m._id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Task</h3>
              <form onSubmit={handleCreateTask}>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newTask.title || ''}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Task title"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newTask.description || ''}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Task description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={newTask.status}
                      onChange={(e) => setNewTask({ ...newTask, status: e.target.value as Task['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="todo">Todo</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assignee </label>
                    <select
                      value={newTask.assignee || ''}
                      onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Unassigned</option>
                      {project.members.map((m: User) => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={newTask.dueDate || ''}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-4">
                  <button type="button" className="px-4 py-2 text-sm bg-gray-100 rounded-md" onClick={() => setShowTaskModal(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-green-600 text-white rounded-md">Create Task</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Project Member</h3>
              <form onSubmit={handleAddMember}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member Email</label>
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" className="px-4 py-2 text-sm bg-gray-100 rounded-md" onClick={() => setShowMemberModal(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md">Add Member</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;


