const express = require('express');
const router = express.Router();
const { login, loginValidation, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);

module.exports = router;
