const { body } = require('express-validator');
const Series = require('../models/Series');
const validate = require('../middleware/validate');

const seriesValidation = [
  body('name').trim().notEmpty().withMessage('Series name is required'),
  validate,
];

const getAllSeries = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.church) filter.church = { $regex: req.query.church, $options: 'i' };
    const series = await Series.find(filter).sort({ name: 1 }).select('-__v');
    res.json({ success: true, total: series.length, data: series });
  } catch (error) {
    next(error);
  }
};

const createSeries = async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (req.user.role !== 'super_admin') body.church = req.scopedChurchName;
    const series = await Series.create(body);
    res.status(201).json({ success: true, data: series });
  } catch (error) {
    next(error);
  }
};

const updateSeries = async (req, res, next) => {
  try {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ success: false, message: 'Series not found' });

    if (req.user.role !== 'super_admin' && series.church !== req.scopedChurchName) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this series' });
    }

    const body = { ...req.body };
    if (req.user.role !== 'super_admin') body.church = req.scopedChurchName;

    const updated = await Series.findByIdAndUpdate(req.params.id, body, {
      new: true, runValidators: true,
    }).select('-__v');

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteSeries = async (req, res, next) => {
  try {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ success: false, message: 'Series not found' });

    if (req.user.role !== 'super_admin' && series.church !== req.scopedChurchName) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this series' });
    }

    await series.deleteOne();
    res.json({ success: true, message: 'Series deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllSeries, createSeries, updateSeries, deleteSeries, seriesValidation };
