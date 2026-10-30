const express = require('express');
const router = express.Router();
const {
  getPublicContent,
  getManagedContent,
  updateAboutContent,
  parseHeroImage,
  addHeroImage,
  deleteHeroImage,
  updateAboutHeroImages,
  addAboutImage,
  deleteAboutImage,
  getHeroImage,
} = require('../controllers/contentController');
const { protect, authorize } = require('../middleware/auth');

const manage = [protect, authorize('super_admin', 'church_admin')];

router.get('/', getPublicContent);
router.get('/hero-images/:imageId/image', getHeroImage);
router.get('/manage', ...manage, getManagedContent);
router.put('/manage/about', ...manage, updateAboutContent);
router.post('/manage/hero-images', ...manage, parseHeroImage, addHeroImage);
router.delete('/manage/hero-images/:imageId', ...manage, deleteHeroImage);
router.put('/manage/about/hero-images', ...manage, updateAboutHeroImages);
router.post('/manage/about/images', ...manage, parseHeroImage, addAboutImage);
router.delete('/manage/about/images/:imageId', ...manage, deleteAboutImage);

module.exports = router;
