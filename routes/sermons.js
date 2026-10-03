const express = require('express');
const router = express.Router();
const {
  getSermons, getSermon, getSermonMeta, createSermon, updateSermon, deleteSermon, sermonValidation, createFromAI,
  streamSermonMedia,
} = require('../controllers/sermonController');
const { protect, authorize, churchScope } = require('../middleware/auth');

router.get('/meta', getSermonMeta);
router.get('/:id/media/:kind', streamSermonMedia); // public: R2-hosted audio/video, Range-aware
router.post(
  '/from-ai',
  protect,
  authorize('super_admin', 'church_admin', 'transcriptionist'),
  churchScope,
  createFromAI
);
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
