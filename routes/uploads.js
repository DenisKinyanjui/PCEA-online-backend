const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  uploadAudio,
  uploadAttachment,
  aiUpload,
  triggerAIProcess,
  getAIStatus,
} = require('../controllers/uploadController');
const { protect, authorize, churchScope } = require('../middleware/auth');

const aiProcessLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Too many AI processing requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Existing routes
router.post('/audio', protect, authorize('admin', 'transcriptionist'), uploadAudio);
router.post('/attachment', protect, authorize('admin', 'transcriptionist'), uploadAttachment);

// AI pipeline routes
router.post(
  '/ai-upload',
  protect,
  authorize('super_admin', 'church_admin', 'transcriptionist'),
  churchScope,
  aiUpload
);

router.post(
  '/ai-process',
  protect,
  authorize('super_admin', 'church_admin', 'transcriptionist'),
  aiProcessLimiter,
  triggerAIProcess
);

router.get(
  '/status/:id',
  protect,
  authorize('super_admin', 'church_admin', 'transcriptionist'),
  getAIStatus
);

module.exports = router;
