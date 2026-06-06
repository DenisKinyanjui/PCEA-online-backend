const express = require('express');
const router = express.Router();
const { uploadAudio, uploadAttachment } = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/auth');

router.post('/audio', protect, authorize('admin', 'transcriptionist'), uploadAudio);
router.post('/attachment', protect, authorize('admin', 'transcriptionist'), uploadAttachment);

module.exports = router;
