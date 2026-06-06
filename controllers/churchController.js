const { body } = require('express-validator');
const Church = require('../models/Church');
const Sermon = require('../models/Sermon');
const Series = require('../models/Series');
const validate = require('../middleware/validate');

const churchValidation = [
  body('name').trim().notEmpty().withMessage('Church name is required'),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug may only contain lowercase letters, numbers and hyphens'),
  validate,
];

const getAllChurches = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    const churches = await Church.find(filter).sort({ name: 1 }).select('-__v');
    res.json({ success: true, total: churches.length, data: churches });
  } catch (error) {
    next(error);
  }
};

const getChurch = async (req, res, next) => {
  try {
    const church = await Church.findById(req.params.id).select('-__v');
    if (!church) return res.status(404).json({ success: false, message: 'Church not found' });
    res.json({ success: true, data: church });
  } catch (error) {
    next(error);
  }
};

const createChurch = async (req, res, next) => {
  try {
    const church = await Church.create(req.body);
    res.status(201).json({ success: true, data: church });
  } catch (error) {
    next(error);
  }
};

const updateChurch = async (req, res, next) => {
  try {
    // church_admin may only update their own church
    if (req.user.role === 'church_admin') {
      const userChurchId = req.user.church?._id?.toString();
      if (userChurchId !== req.params.id) {
        return res.status(403).json({ success: false, message: 'You can only edit your own church' });
      }
    }
    const church = await Church.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-__v');
    if (!church) return res.status(404).json({ success: false, message: 'Church not found' });
    res.json({ success: true, data: church });
  } catch (error) {
    next(error);
  }
};

const deleteChurch = async (req, res, next) => {
  try {
    const church = await Church.findById(req.params.id);
    if (!church) return res.status(404).json({ success: false, message: 'Church not found' });

    // Safeguard: prevent deletion if sermons exist
    const sermonCount = await Sermon.countDocuments({ church: church.name });
    if (sermonCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${sermonCount} sermon(s) are linked to this church`,
      });
    }

    await church.deleteOne();
    res.json({ success: true, message: 'Church deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getChurchBySlug = async (req, res, next) => {
  try {
    const church = await Church.findOne({ slug: req.params.slug, isActive: true }).select('-__v');
    if (!church) {
      return res.status(404).json({ success: false, message: `No active church found for slug "${req.params.slug}"` });
    }
    res.json({ success: true, data: church });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllChurches, getChurch, getChurchBySlug, createChurch, updateChurch, deleteChurch, churchValidation };
