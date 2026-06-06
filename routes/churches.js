const express = require('express');
const router = express.Router();
const {
  getAllChurches, getChurch, getChurchBySlug, createChurch, updateChurch, deleteChurch, churchValidation,
} = require('../controllers/churchController');
const { protect, authorize } = require('../middleware/auth');

// Public read endpoints
router.get('/by-slug/:slug', getChurchBySlug);
router.get('/', getAllChurches);
router.get('/:id', getChurch);

// Protected write endpoints
router.post('/', protect, authorize('super_admin'), churchValidation, createChurch);
router.put('/:id', protect, authorize('super_admin', 'church_admin'), updateChurch);
router.delete('/:id', protect, authorize('super_admin'), deleteChurch);

module.exports = router;
