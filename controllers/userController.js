const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');

const userValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['super_admin', 'church_admin', 'transcriptionist']).withMessage('Invalid role'),
  validate,
];

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  church: user.church
    ? { id: user.church._id, name: user.church.name, slug: user.church.slug }
    : null,
  createdAt: user.createdAt,
});

const getUsers = async (req, res, next) => {
  try {
    const filter = {};
    // church_admin can only see users in their church
    if (req.user.role === 'church_admin') {
      filter.church = req.user.church._id;
    }
    const users = await User.find(filter)
      .populate('church', 'name slug _id')
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, total: users.length, data: users.map(formatUser) });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, church } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required for new users' });
    }
    if (['church_admin', 'transcriptionist'].includes(role) && !church) {
      return res.status(400).json({ success: false, message: 'A church must be assigned for this role' });
    }

    const user = await User.create({ name, email, password, role, church: church || null });
    await user.populate('church', 'name slug _id');

    res.status(201).json({ success: true, data: formatUser(user) });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, email, password, role, church } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Prevent demoting the last super_admin
    if (user.role === 'super_admin' && role && role !== 'super_admin') {
      const superAdminCount = await User.countDocuments({ role: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the last super admin' });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;
    if (role) user.role = role;
    if (role === 'super_admin') {
      user.church = null;
    } else if (church !== undefined) {
      user.church = church || null;
    }

    await user.save();
    await user.populate('church', 'name slug _id');

    res.json({ success: true, data: formatUser(user) });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Cannot delete yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    // Cannot delete the last super_admin
    if (user.role === 'super_admin') {
      const count = await User.countDocuments({ role: 'super_admin' });
      if (count <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last super admin' });
      }
    }

    await user.deleteOne();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, userValidation };
