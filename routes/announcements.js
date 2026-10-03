const express = require('express');
const router = express.Router();
const {
  parseAnnouncementForm,
  getActiveAnnouncements,
  getAnnouncementImage,
  getAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcementController');
const { protect, authorize, churchScope } = require('../middleware/auth');

const manage = [protect, authorize('super_admin', 'church_admin'), churchScope];

// Admin endpoints (declared before /:id routes so "manage" isn't read as an id)
router.get('/manage', ...manage, getAllAnnouncements);
router.get('/manage/:id', ...manage, getAnnouncement);

// Public read endpoints
router.get('/', getActiveAnnouncements);
router.get('/:id/image', getAnnouncementImage);

// Protected write endpoints (multipart/form-data with optional `image`)
router.post('/', ...manage, parseAnnouncementForm, createAnnouncement);
router.put('/:id', ...manage, parseAnnouncementForm, updateAnnouncement);
router.delete('/:id', ...manage, deleteAnnouncement);

module.exports = router;
