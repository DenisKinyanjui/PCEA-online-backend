const express = require('express');
const router = express.Router();
const {
  getSermons, getSermon, getSermonMeta, createSermon, updateSermon, deleteSermon, sermonValidation,
} = require('../controllers/sermonController');
const { protect, authorize, churchScope } = require('../middleware/auth');

router.get('/meta', getSermonMeta);
router.route('/').get(getSermons).post(
  protect,
  authorize('super_admin', 'church_admin', 'transcriptionist'),
  churchScope,
  sermonValidation,
  createSermon
);
router.route('/:id')
  .get(getSermon)
  .put(protect, authorize('super_admin', 'church_admin', 'transcriptionist'), churchScope, updateSermon)
  .delete(protect, authorize('super_admin', 'church_admin'), churchScope, deleteSermon);

module.exports = router;
