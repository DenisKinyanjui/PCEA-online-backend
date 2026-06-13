const multer = require('multer');
const { MulterError } = multer;
const { uploadToR2 } = require('../services/r2UploadService');

const ALLOWED_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'];
const ALLOWED_DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const ALLOWED_ALL = new Set([...ALLOWED_AUDIO, ...ALLOWED_DOCS]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_ALL.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' not allowed`), false);
  }
};

// All files go into memory — immediately streamed to R2, never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

const handleUploadError = (err, res) => {
  if (err instanceof MulterError || err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  return res.status(500).json({ success: false, message: 'Upload failed' });
};

// ── Existing upload handlers (sermon form media / attachments) ────────────────

const uploadAudio = [
  (req, res, next) => {
    upload.single('audio')(req, res, async (err) => {
      if (err) return handleUploadError(err, res);
      if (!req.file) return res.status(400).json({ success: false, message: 'No audio file uploaded' });

      try {
        const { key, url } = await uploadToR2(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          'audio'
        );
        res.json({ success: true, url, key });
      } catch (e) {
        next(e);
      }
    });
  },
];

const uploadAttachment = [
  (req, res, next) => {
    upload.single('attachment')(req, res, async (err) => {
      if (err) return handleUploadError(err, res);
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      try {
        const { key, url } = await uploadToR2(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          'attachments'
        );
        res.json({
          success: true,
          url,
          key,
          originalName: req.file.originalname,
          fileType: req.file.mimetype,
        });
      } catch (e) {
        next(e);
      }
    });
  },
];

// ── AI pipeline upload ────────────────────────────────────────────────────────

// Step 1: Upload file to R2, create SermonJob, return jobId (does NOT call OpenAI yet)
const aiUpload = [
  (req, res, next) => {
    upload.single('file')(req, res, async (err) => {
      if (err) return handleUploadError(err, res);
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      const isAudio = ALLOWED_AUDIO.includes(req.file.mimetype);

      try {
        const { key, url } = await uploadToR2(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          isAudio ? 'audio' : 'documents'
        );

        const SermonJob = require('../models/SermonJob');
        const church =
          req.user.role !== 'super_admin'
            ? req.scopedChurchName
            : req.body.church || '';

        const job = await SermonJob.create({
          sourceFileUrl: url,
          sourceFileKey: key,
          sourceFileType: isAudio ? 'audio' : 'document',
          originalFileName: req.file.originalname,
          userPrompt: '',
          church,
          uploadedBy: req.user._id,
          status: 'uploaded',
        });

        res.json({
          success: true,
          jobId: job._id,
          fileUrl: url,
          fileType: isAudio ? 'audio' : 'document',
          originalFileName: req.file.originalname,
        });
      } catch (e) {
        next(e);
      }
    });
  },
];

// Step 2: Confirm + trigger AI processing for an existing job
const triggerAIProcess = async (req, res, next) => {
  try {
    const { jobId, userPrompt } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'jobId is required' });
    }

    const SermonJob = require('../models/SermonJob');
    const job = await SermonJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Processing job not found' });
    }

    if (req.user.role !== 'super_admin' && String(job.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to process this job' });
    }

    if (job.status === 'processing') {
      return res.status(409).json({ success: false, message: 'Job is already processing' });
    }

    if (job.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Job has already completed' });
    }

    if (userPrompt !== undefined) {
      job.userPrompt = String(userPrompt).slice(0, 1000);
    }

    const resetStage = () => ({ status: 'pending', error: '' });
    job.stages = {
      transcribing: resetStage(),
      analyzing: resetStage(),
      structuring: resetStage(),
      saving: resetStage(),
    };
    job.status = 'uploaded';
    job.errorMessage = '';
    await job.save();

    const { runPipeline } = require('../services/aiSermonPipeline');
    runPipeline(String(job._id)).catch(console.error);

    res.json({ success: true, message: 'AI processing started', jobId: job._id });
  } catch (err) {
    next(err);
  }
};

// Step 3: Poll job status
const getAIStatus = async (req, res, next) => {
  try {
    const SermonJob = require('../models/SermonJob');
    const job = await SermonJob.findById(req.params.id).select('-sourceFilePath -sourceFileKey');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Processing job not found' });
    }

    if (req.user.role !== 'super_admin' && String(job.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadAudio, uploadAttachment, aiUpload, triggerAIProcess, getAIStatus };
