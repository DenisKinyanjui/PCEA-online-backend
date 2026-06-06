const path = require('path');
const multer = require('multer');
const { MulterError } = multer;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedAudio = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'];
  const allowedDocs = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  if ([...allowedAudio, ...allowedDocs].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

const handleUploadError = (err, res) => {
  if (err instanceof MulterError || err.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  return res.status(500).json({ success: false, message: 'Upload failed' });
};

const uploadAudio = [
  (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
      if (err) return handleUploadError(err, res);
      if (!req.file) return res.status(400).json({ success: false, message: 'No audio file uploaded' });
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      res.json({ success: true, url: fileUrl, filename: req.file.filename });
    });
  },
];

const uploadAttachment = [
  (req, res, next) => {
    upload.single('attachment')(req, res, (err) => {
      if (err) return handleUploadError(err, res);
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
      });
    });
  },
];

module.exports = { uploadAudio, uploadAttachment };
