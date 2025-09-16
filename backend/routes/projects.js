const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/projects
// @desc    Get all projects for the authenticated user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    })
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar')
    .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    })
    .populate('owner', 'name email avatar')
    .populate('members', 'name email avatar');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get task counts by status
    const taskCounts = await Task.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const counts = {
      todo: 0,
      'in-progress': 0,
      done: 0
    };

    taskCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    res.json({
      ...project.toObject(),
      taskCounts: counts
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', [
  auth,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Project name is required and must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, color } = req.body;

    const project = new Project({
      name,
      description,
      color: color || '#3B82F6',
      owner: req.user._id
    });

    await project.save();
    await project.populate('owner', 'name email avatar');
    await project.populate('members', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-created', project);

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update a project
// @access  Private
router.put('/:id', [
  auth,
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Project name must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const { name, description, color } = req.body;
    
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (color) project.color = color;

    await project.save();
    await project.populate('owner', 'name email avatar');
    await project.populate('members', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-updated', project);

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete a project
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    // Delete all tasks in the project
    await Task.deleteMany({ project: project._id });

    // Emit real-time update before deletion
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-deleted', { projectId: project._id });

    await Project.findByIdAndDelete(project._id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects/:id/members
// @desc    Add member to project
// @access  Private
router.post('/:id/members', [
  auth,
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const User = require('../models/User');
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (project.members.includes(user._id)) {
      return res.status(400).json({ message: 'User is already a member of this project' });
    }

    project.members.push(user._id);
    await project.save();
    await project.populate('owner', 'name email avatar');
    await project.populate('members', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-member-added', {
      project,
      newMember: { id: user._id, name: user.name, email: user.email, avatar: user.avatar }
    });

    res.json(project);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/projects/:id/members/:memberId
// @desc    Remove member from project
// @access  Private
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    if (req.params.memberId === project.owner.toString()) {
      return res.status(400).json({ message: 'Cannot remove project owner' });
    }

    project.members = project.members.filter(
      memberId => memberId.toString() !== req.params.memberId
    );
    
    await project.save();
    await project.populate('owner', 'name email avatar');
    await project.populate('members', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-member-removed', {
      project,
      removedMemberId: req.params.memberId
    });

    res.json(project);
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
