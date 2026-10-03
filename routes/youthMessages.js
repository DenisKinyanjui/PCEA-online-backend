const express = require('express');
const router = express.Router();
const {
  youthMessageValidation,
  getLatestYouthMessages,
  getAllYouthMessages,
  getYouthMessage,
  createYouthMessage,
  updateYouthMessage,
  deleteYouthMessage,
} = require('../controllers/youthMessageController');
const { protect, authorize, churchScope } = require('../middleware/auth');

const manage = [protect, authorize('super_admin', 'church_admin'), churchScope];

// Admin endpoints (declared before /:id routes so "manage" isn't read as an id)
router.get('/manage', ...manage, getAllYouthMessages);
router.get('/manage/:id', ...manage, getYouthMessage);

// Public read endpoint
router.get('/', getLatestYouthMessages);

// Protected write endpoints
router.post('/', ...manage, youthMessageValidation, createYouthMessage);
router.put('/:id', ...manage, youthMessageValidation, updateYouthMessage);
router.delete('/:id', ...manage, deleteYouthMessage);

module.exports = router;
