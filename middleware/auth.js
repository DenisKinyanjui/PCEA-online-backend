const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id)
      .select('-password')
      .populate('church', 'name slug _id');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
  }
};

// Role-based authorization
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized to access this route`,
    });
  }
  next();
};

// Ensures church_admin / transcriptionist have a church assigned.
// Injects req.scopedChurchName for downstream controllers to use.
const churchScope = (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  if (!req.user.church) {
    return res.status(403).json({ success: false, message: 'No church assigned to this account' });
  }
  req.scopedChurchName = req.user.church.name;
  next();
};

module.exports = { protect, authorize, churchScope };
