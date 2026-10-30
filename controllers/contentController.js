const multer = require('multer');
const SiteContent = require('../models/SiteContent');
const { uploadToR2, getR2Object, deleteFromR2 } = require('../services/r2UploadService');

const CHURCH_SLUG = 'pcea-emmanuel-thome-church';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Images must be JPG, PNG, or WEBP files'));
  },
  limits: { fileSize: MAX_IMAGE_BYTES },
});

const parseHeroImage = (req, res, next) => {
  imageUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Images must be 5 MB or smaller'
      : error.message || 'Invalid image upload';
    return res.status(400).json({ success: false, message });
  });
};

function imagePath(image) {
  return image.storageKey
    ? `/content/hero-images/${image._id}/image?v=${new Date(image.updatedAt || Date.now()).getTime()}`
    : image.src;
}

function serializeContent(content) {
  const data = content.toObject ? content.toObject() : content;
  const selectedHeroImages = data.heroImages.filter((image) =>
    data.aboutHeroImageIds.includes(String(image._id))
  );
  return {
    about: data.about,
    heroImages: data.heroImages.map((image) => ({
      _id: image._id,
      src: imagePath(image),
      originalName: image.originalName,
      mimeType: image.mimeType,
    })),
    aboutHeroImageIds: data.aboutHeroImageIds,
    aboutUploadedImages: data.aboutImages.map((image) => ({
      _id: image._id,
      src: imagePath(image),
      originalName: image.originalName,
      mimeType: image.mimeType,
    })),
    aboutImages: [
      ...selectedHeroImages,
      ...data.aboutImages,
    ].map((image) => ({
      _id: image._id,
      src: imagePath(image),
      originalName: image.originalName,
      mimeType: image.mimeType,
    })),
  };
}

const getPublicContent = async (req, res, next) => {
  try {
    const content = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
    res.json({ success: true, data: content ? serializeContent(content) : null });
  } catch (error) {
    next(error);
  }
};

const getManagedContent = async (req, res, next) => {
  try {
    let content = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
    if (!content) {
      content = await SiteContent.create({ churchSlug: CHURCH_SLUG });
    }
    res.json({ success: true, data: serializeContent(content) });
  } catch (error) {
    next(error);
  }
};

const updateAboutContent = async (req, res, next) => {
  try {
    const about = req.body?.about;
    if (!about || typeof about.intro !== 'string' || !Array.isArray(about.sections)) {
      return res.status(400).json({ success: false, message: 'About page intro and sections are required' });
    }
    if (about.intro.length > 5000 || about.sections.length > 20) {
      return res.status(400).json({ success: false, message: 'About page content exceeds allowed limits' });
    }

    const sections = [];
    for (const section of about.sections) {
      if (
        !section ||
        typeof section.title !== 'string' ||
        section.title.trim().length === 0 ||
        section.title.length > 120 ||
        typeof (section.body ?? '') !== 'string' ||
        (section.body ?? '').length > 5000 ||
        typeof (section.closing ?? '') !== 'string' ||
        (section.closing ?? '').length > 2000 ||
        !Array.isArray(section.items ?? []) ||
        (section.items ?? []).length > 30 ||
        (section.items ?? []).some((item) => typeof item !== 'string' || item.length > 500)
      ) {
        return res.status(400).json({ success: false, message: 'One or more About page sections are invalid' });
      }
      sections.push({
        title: section.title.trim(),
        body: section.body ?? '',
        items: section.items ?? [],
        closing: section.closing ?? '',
      });
    }

    const content = await SiteContent.findOneAndUpdate(
      { churchSlug: CHURCH_SLUG },
      { $set: { about: { intro: about.intro, sections } } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: serializeContent(content) });
  } catch (error) {
    next(error);
  }
};

const addHeroImage = async (req, res, next) => {
  let uploadedKey;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image to upload' });
    const content = await SiteContent.findOneAndUpdate(
      { churchSlug: CHURCH_SLUG },
      { $setOnInsert: { churchSlug: CHURCH_SLUG } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    if (content.heroImages.length >= 20) {
      return res.status(400).json({ success: false, message: 'A maximum of 20 hero images is allowed' });
    }
    const uploaded = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, 'hero');
    uploadedKey = uploaded.key;
    content.heroImages.push({
      storageKey: uploaded.key,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    await content.save();
    res.status(201).json({ success: true, data: serializeContent(content) });
  } catch (error) {
    if (uploadedKey) await deleteFromR2(uploadedKey);
    next(error);
  }
};

const deleteHeroImage = async (req, res, next) => {
  try {
    const content = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
    if (!content) return res.status(404).json({ success: false, message: 'Hero image not found' });
    const image = content.heroImages.id(req.params.imageId);
    if (!image) return res.status(404).json({ success: false, message: 'Hero image not found' });
    const { storageKey } = image;
    image.deleteOne();
    content.aboutHeroImageIds = content.aboutHeroImageIds.filter(
      (imageId) => imageId !== String(req.params.imageId)
    );
    await content.save();
    await deleteFromR2(storageKey);
    res.json({ success: true, data: serializeContent(content) });
  } catch (error) {
    next(error);
  }
};

const updateAboutHeroImages = async (req, res, next) => {
  try {
    const imageIds = req.body?.imageIds;
    if (!Array.isArray(imageIds) || imageIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ success: false, message: 'A list of hero image IDs is required' });
    }
    const content = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
    if (!content) return res.status(404).json({ success: false, message: 'Site content not found' });
    const validIds = new Set(content.heroImages.map((image) => String(image._id)));
    if (imageIds.some((id) => !validIds.has(id)) || new Set(imageIds).size !== imageIds.length) {
      return res.status(400).json({ success: false, message: 'One or more selected hero images are invalid' });
    }
    if (imageIds.length + content.aboutImages.length > 20) {
      return res.status(400).json({ success: false, message: 'A maximum of 20 About page images is allowed' });
    }

    content.aboutHeroImageIds = imageIds;
    await content.save();
    res.json({ success: true, data: serializeContent(content) });
  } catch (error) {
    next(error);
  }
};

const addAboutImage = async (req, res, next) => {
  let uploadedKey;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image to upload' });
    const content = await SiteContent.findOneAndUpdate(
      { churchSlug: CHURCH_SLUG },
      { $setOnInsert: { churchSlug: CHURCH_SLUG } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    if (content.aboutImages.length + content.aboutHeroImageIds.length >= 20) {
      return res.status(400).json({ success: false, message: 'A maximum of 20 About page images is allowed' });
    }

    const uploaded = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, 'about');
    uploadedKey = uploaded.key;
    content.aboutImages.push({
      storageKey: uploaded.key,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    await content.save();
    res.status(201).json({ success: true, data: serializeContent(content) });
  } catch (error) {
    if (uploadedKey) await deleteFromR2(uploadedKey);
    next(error);
  }
};

const deleteAboutImage = async (req, res, next) => {
  try {
    const content = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
    if (!content) return res.status(404).json({ success: false, message: 'About image not found' });
    const image = content.aboutImages.id(req.params.imageId);
    if (!image) return res.status(404).json({ success: false, message: 'About image not found' });
    const { storageKey } = image;
    image.deleteOne();
    await content.save();
    await deleteFromR2(storageKey);
    res.json({ success: true, data: serializeContent(content) });
  } catch (error) {
    next(error);
  }
};

const getHeroImage = async (req, res, next) => {
  try {
    const content = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
    const image = content?.heroImages.id(req.params.imageId) || content?.aboutImages.id(req.params.imageId);
    if (!image?.storageKey) return res.status(404).json({ success: false, message: 'Image not found' });

    const object = await getR2Object(image.storageKey);
    res.set({
      'Content-Type': image.mimeType || object.ContentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (object.ContentLength) res.set('Content-Length', String(object.ContentLength));
    object.Body.on('error', next);
    object.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey') return res.status(404).json({ success: false, message: 'Image not found' });
    next(error);
  }
};

module.exports = {
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
};
