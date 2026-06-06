const express = require('express');
const router = express.Router();
const {
  getAllSeries, createSeries, updateSeries, deleteSeries, seriesValidation,
} = require('../controllers/seriesController');
const { protect, authorize, churchScope } = require('../middleware/auth');

router.route('/')
  .get(getAllSeries)
  .post(protect, authorize('super_admin', 'church_admin'), churchScope, seriesValidation, createSeries);

router.route('/:id')
  .put(protect, authorize('super_admin', 'church_admin'), churchScope, updateSeries)
  .delete(protect, authorize('super_admin', 'church_admin'), churchScope, deleteSeries);

module.exports = router;
