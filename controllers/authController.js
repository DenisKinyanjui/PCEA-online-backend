const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const District = require('../models/District');
const Church = require('../models/Church');
const validate = require('../middleware/validate');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  church: user.church
    ? { id: user.church._id, name: user.church.name, slug: user.church.slug }
    : null,
  district: user.district ? { id: user.district._id, name: user.district.name } : null,
});

const registerValidation = [
  body('name').isString().withMessage('Name is required').bail().trim().notEmpty().withMessage('Name is required'),
  body('email').isString().withMessage('Enter a valid email').bail().isEmail().withMessage('Enter a valid email'),
  body('password')
    .isString()
    .withMessage('Password must be at least 8 characters')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('districtId')
    .isString()
    .withMessage('Choose a district or select Not Sure')
    .bail()
    .custom((value) => value === 'not-sure' || /^[a-f\d]{24}$/i.test(value || ''))
    .withMessage('Choose a district or select Not Sure'),
  body('location')
    .if(body('districtId').equals('not-sure'))
    .isString()
    .withMessage('Enter a location between 3 and 300 characters')
    .bail()
    .trim()
    .isLength({ min: 3, max: 300 })
    .withMessage('Enter a location between 3 and 300 characters'),
  validate,
];

const loginValidation = [
  body('email').isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const register = async (req, res, next) => {
  try {
    const { name, email, password, districtId, location } = req.body;
    let district = null;
    let church = null;

    if (districtId !== 'not-sure') {
      district = await District.findOne({ _id: districtId, isActive: true })
        .populate('church', 'name slug _id isActive');
      if (!district || !district.church?.isActive) {
        return res.status(400).json({ success: false, message: 'The selected district is unavailable' });
      }
      church = district.church._id;
    } else {
      church = await Church.findOne({ slug: 'pcea-emmanuel-thome-church', isActive: true }).select('_id');
      if (!church) {
        return res.status(503).json({ success: false, message: 'Church registration is not configured yet' });
      }
      church = church._id;
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'member',
      church,
      district: district?._id ?? null,
      membershipLocation: district ? undefined : location,
    });
    await user.populate([
      { path: 'church', select: 'name slug _id' },
      { path: 'district', select: 'name _id' },
    ]);

    res.status(201).json({
      success: true,
      token: signToken(user._id),
      user: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('church', 'name slug _id')
      .populate('district', 'name _id elderName deacons');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({ success: true, token, user: formatUser(user) });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: formatUser(req.user) });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, registerValidation, login, loginValidation, getMe };
