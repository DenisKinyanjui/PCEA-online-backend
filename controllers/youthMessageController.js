const { body } = require('express-validator');
const YouthMessage = require('../models/YouthMessage');
const validate = require('../middleware/validate');

// Accepts "YYYY-MM-DD" (or any ISO date) and pins it to 12:00 UTC on that calendar day
const toServiceDate = (value) => {
  const day = String(value).slice(0, 10);
  return new Date(`${day}T12:00:00.000Z`);
};

const youthMessageValidation = [
  body('minister').trim().notEmpty().withMessage('Minister name is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('bibleVerse').optional({ values: 'null' }).trim(),
  body('date')
    .notEmpty().withMessage('Date is required')
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}/).withMessage('Date must be YYYY-MM-DD')
    .bail()
    .custom((v) => !Number.isNaN(toServiceDate(v).getTime())).withMessage('Invalid date'),
  validate,
];

// church_admin is locked to their church; super_admin may pass one (defaults via the model)
const resolveChurch = (req) =>
  req.user.role !== 'super_admin' ? req.scopedChurchName : (req.body.church || '').trim() || undefined;

const canManage = (req, doc) =>
  req.user.role === 'super_admin' || doc.church === req.scopedChurchName;

const pickFields = (b) => ({
  minister: b.minister,
  message: b.message,
  bibleVerse: b.bibleVerse || '',
  date: toServiceDate(b.date),
});

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/youth-messages?church=&limit= — latest first (by service date)
const getLatestYouthMessages = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.church) filter.church = req.query.church;
    const limit = Math.min(Number(req.query.limit) || 4, 50);

    const messages = await YouthMessage.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit);
    res.json({ success: true, total: messages.length, data: messages });
  } catch (error) {
    next(error);
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const getAllYouthMessages = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role !== 'super_admin') filter.church = req.scopedChurchName;
    else if (req.query.church) filter.church = req.query.church;

    const messages = await YouthMessage.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, total: messages.length, data: messages });
  } catch (error) {
    next(error);
  }
};

const getYouthMessage = async (req, res, next) => {
  try {
    const doc = await YouthMessage.findById(req.params.id);
    if (!doc || !canManage(req, doc)) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

const createYouthMessage = async (req, res, next) => {
  try {
    const fields = { ...pickFields(req.body), createdBy: req.user._id };
    const church = resolveChurch(req);
    if (church) fields.church = church;

    const doc = await YouthMessage.create(fields);
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

const updateYouthMessage = async (req, res, next) => {
  try {
    const doc = await YouthMessage.findById(req.params.id);
    if (!doc || !canManage(req, doc)) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    Object.assign(doc, pickFields(req.body));
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

const deleteYouthMessage = async (req, res, next) => {
  try {
    const doc = await YouthMessage.findById(req.params.id);
    if (!doc || !canManage(req, doc)) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    await doc.deleteOne();
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  youthMessageValidation,
  getLatestYouthMessages,
  getAllYouthMessages,
  getYouthMessage,
  createYouthMessage,
  updateYouthMessage,
  deleteYouthMessage,
};
