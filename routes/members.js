const express = require('express');
const router = express.Router();
const {
  getDistrictMembers,
  getMembersForAdmin,
  updateMember,
  deleteMember,
  memberUpdateValidation,
} = require('../controllers/memberController');
const { protect, authorize } = require('../middleware/auth');

router.get('/district', protect, authorize('member'), getDistrictMembers);
router.get('/admin', protect, authorize('super_admin', 'church_admin'), getMembersForAdmin);
router.put('/admin/:id', protect, authorize('super_admin', 'church_admin'), memberUpdateValidation, updateMember);
router.delete('/admin/:id', protect, authorize('super_admin', 'church_admin'), deleteMember);

module.exports = router;
