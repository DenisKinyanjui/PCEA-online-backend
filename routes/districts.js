const express = require('express');
const router = express.Router();
const {
  getDistricts,
  getAdminDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  districtValidation,
} = require('../controllers/districtController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getDistricts);
router.get('/manage', protect, authorize('super_admin', 'church_admin'), getAdminDistricts);
router.post('/', protect, authorize('super_admin', 'church_admin'), districtValidation, createDistrict);
router.put('/:id', protect, authorize('super_admin', 'church_admin'), districtValidation, updateDistrict);
router.delete('/:id', protect, authorize('super_admin', 'church_admin'), deleteDistrict);

module.exports = router;
