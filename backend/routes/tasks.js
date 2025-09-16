const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tasks
// @desc    Get tasks with optional filtering
// @access  Private
router.get('/', [
  auth,
  query('project').optional().isMongoId().withMessage('Invalid project ID'),
  query('status').optional().isIn(['todo', 'in-progress', 'done']).withMessage('Invalid status'),
  query('assignee').optional().isMongoId().withMessage('Invalid assignee ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { project, status, assignee } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (project) {
      // Check if user has access to this project
      const projectDoc = await Project.findOne({
        _id: project,
        $or: [
          { owner: req.user._id },
          { members: req.user._id }
        ]
      });
      
      if (!projectDoc) {
        return res.status(404).json({ message: 'Project not found or access denied' });
      }
      
      filter.project = project;
    } else {
      // If no project specified, get tasks from all user's projects
      const userProjects = await Project.find({
        $or: [
          { owner: req.user._id },
          { members: req.user._id }
        ]
      }).select('_id');
      
      filter.project = { $in: userProjects.map(p => p._id) };
    }
    
    if (status) filter.status = status;
    if (assignee) filter.assignee = assignee;

    const tasks = await Task.find(filter)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'name color')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to the project
    const project = await Project.findOne({
      _id: task.project._id,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private
router.post('/', [
  auth,
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Task title is required and must be less than 200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('project').isMongoId().withMessage('Valid project ID is required'),
  body('status').optional().isIn(['todo', 'in-progress', 'done']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('assignee').optional().isMongoId().withMessage('Invalid assignee ID'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date format'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, description, project, status, priority, assignee, dueDate, tags } = req.body;

    // Check if user has access to the project
    const projectDoc = await Project.findOne({
      _id: project,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    // If assignee is specified, verify they are a member of the project
    if (assignee) {
      if (!projectDoc.members.includes(assignee)) {
        return res.status(400).json({ message: 'Assignee must be a member of the project' });
      }
    }

    const task = new Task({
      title,
      description,
      project,
      status: status || 'todo',
      priority: priority || 'medium',
      assignee,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags: tags || [],
      createdBy: req.user._id
    });

    await task.save();
    await task.populate('project', 'name color');
    await task.populate('assignee', 'name email avatar');
    await task.populate('createdBy', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project}`).emit('task-created', task);

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private
router.put('/:id', [
  auth,
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Task title must be less than 200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('status').optional().isIn(['todo', 'in-progress', 'done']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('assignee').optional().isMongoId().withMessage('Invalid assignee ID'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date format'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to the project
    const project = await Project.findOne({
      _id: task.project,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    const { title, description, status, priority, assignee, dueDate, tags } = req.body;

    // If assignee is being changed, verify they are a member of the project
    if (assignee && !project.members.includes(assignee)) {
      return res.status(400).json({ message: 'Assignee must be a member of the project' });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignee !== undefined) task.assignee = assignee;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (tags !== undefined) task.tags = tags;

    await task.save();
    await task.populate('project', 'name color');
    await task.populate('assignee', 'name email avatar');
    await task.populate('createdBy', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${task.project._id}`).emit('task-updated', task);

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to the project
    const project = await Project.findOne({
      _id: task.project,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    // Emit real-time update before deletion
    const io = req.app.get('io');
    io.to(`project-${task.project}`).emit('task-deleted', { taskId: task._id, projectId: task.project });

    await Task.findByIdAndDelete(task._id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/project/:projectId
// @desc    Get all tasks for a specific project
// @access  Private
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if user has access to the project
    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const tasks = await Task.find({ project: projectId })
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('Get project tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
