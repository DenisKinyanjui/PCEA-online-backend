const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, userValidation } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('super_admin', 'church_admin'));

router.route('/')
  .get(getUsers)
  .post(authorize('super_admin'), userValidation, createUser);

router.route('/:id')
  .put(authorize('super_admin'), userValidation, updateUser)
  .delete(authorize('super_admin'), deleteUser);

module.exports = router;
