const multer = require('multer');
const { MulterError } = multer;
const Announcement = require('../models/Announcement');
const { uploadToR2, getR2Object, deleteFromR2 } = require('../services/r2UploadService');

const ALLOWED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_MB = 5;

// Poster images go into memory and straight to R2, like other uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Poster must be a JPG, PNG, WEBP or GIF image'), false);
  },
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024 },
});

// Parses the optional `image` file and multipart text fields into req.body
const parseAnnouncementForm = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    const message =
      err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? `Poster must be ${MAX_IMAGE_MB} MB or smaller`
        : err.message || 'Invalid upload';
    return res.status(400).json({ success: false, message });
  });
};

// Validates title/description/expiresAt from a multipart body.
// `partial` allows omitted fields (updates); returns { errors, values }.
function readFields(body, { partial = false } = {}) {
  const errors = [];
  const values = {};

  if (body.title !== undefined || !partial) {
    const title = (body.title || '').trim();
    if (!title) errors.push({ field: 'title', message: 'Title is required' });
    values.title = title;
  }
  if (body.description !== undefined || !partial) {
    const description = (body.description || '').trim();
    if (!description) errors.push({ field: 'description', message: 'Description is required' });
    values.description = description;
  }
  if (body.expiresAt !== undefined || !partial) {
    const expiresAt = new Date(body.expiresAt);
    if (!body.expiresAt || Number.isNaN(expiresAt.getTime())) {
      errors.push({ field: 'expiresAt', message: 'A valid expiry date is required' });
    } else if (expiresAt <= new Date()) {
      errors.push({ field: 'expiresAt', message: 'Expiry date must be in the future' });
    } else {
      values.expiresAt = expiresAt;
    }
  }
  return { errors, values };
}

const validationFailed = (res, errors) =>
  res.status(400).json({ success: false, message: errors[0].message, errors });

// church_admin is locked to their church; super_admin may pass one (defaults via the model)
const resolveChurch = (req) =>
  req.user.role !== 'super_admin' ? req.scopedChurchName : (req.body.church || '').trim() || undefined;

const canManage = (req, announcement) =>
  req.user.role === 'super_admin' || announcement.church === req.scopedChurchName;

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/announcements?church=&limit= — only announcements that have not expired
const getActiveAnnouncements = async (req, res, next) => {
  try {
    const filter = { expiresAt: { $gt: new Date() } };
    if (req.query.church) filter.church = req.query.church;
    const limit = Math.min(Number(req.query.limit) || 12, 50);

    const announcements = await Announcement.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, total: announcements.length, data: announcements });
  } catch (error) {
    next(error);
  }
};

// GET /api/announcements/:id/image — streams the poster from R2
const getAnnouncementImage = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id).select('imageKey imageMimeType');
    if (!announcement || !announcement.imageKey) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const object = await getR2Object(announcement.imageKey);
    res.set({
      'Content-Type': announcement.imageMimeType || object.ContentType || 'application/octet-stream',
      // URLs carry ?v=<updatedAt>, so a changed poster gets a new URL
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (object.ContentLength) res.set('Content-Length', String(object.ContentLength));
    object.Body.on('error', next);
    object.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    next(error);
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/announcements/manage — all announcements (including expired) for the admin panel
const getAllAnnouncements = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role !== 'super_admin') filter.church = req.scopedChurchName;
    else if (req.query.church) filter.church = req.query.church;

    const announcements = await Announcement.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, total: announcements.length, data: announcements });
  } catch (error) {
    next(error);
  }
};

const getAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || !canManage(req, announcement)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.json({ success: true, data: announcement });
  } catch (error) {
    next(error);
  }
};

const createAnnouncement = async (req, res, next) => {
  try {
    const { errors, values } = readFields(req.body);
    if (errors.length) return validationFailed(res, errors);

    const doc = { ...values, createdBy: req.user._id };
    const church = resolveChurch(req);
    if (church) doc.church = church;

    if (req.file) {
      const { key } = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, 'announcements');
      doc.imageKey = key;
      doc.imageMimeType = req.file.mimetype;
    }

    const announcement = await Announcement.create(doc);
    res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    next(error);
  }
};

// PUT /api/announcements/:id — multipart; send a new `image` to replace, or removeImage=true to clear
const updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || !canManage(req, announcement)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { errors, values } = readFields(req.body, { partial: true });
    if (errors.length) return validationFailed(res, errors);
    Object.assign(announcement, values);

    const oldKey = announcement.imageKey;
    if (req.file) {
      const { key } = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, 'announcements');
      announcement.imageKey = key;
      announcement.imageMimeType = req.file.mimetype;
    } else if (req.body.removeImage === 'true') {
      announcement.imageKey = '';
      announcement.imageMimeType = '';
    }

    await announcement.save();
    if (oldKey && oldKey !== announcement.imageKey) await deleteFromR2(oldKey);

    res.json({ success: true, data: announcement });
  } catch (error) {
    next(error);
  }
};

const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || !canManage(req, announcement)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    await announcement.deleteOne();
    await deleteFromR2(announcement.imageKey);
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  parseAnnouncementForm,
  getActiveAnnouncements,
  getAnnouncementImage,
  getAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
