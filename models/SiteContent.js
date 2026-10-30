const mongoose = require('mongoose');

const aboutSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 5000, default: '' },
    items: { type: [String], default: [] },
    closing: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { _id: true }
);

const heroImageSchema = new mongoose.Schema(
  {
    storageKey: { type: String, default: '' },
    src: { type: String, default: '' },
    originalName: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const siteContentSchema = new mongoose.Schema(
  {
    churchSlug: { type: String, required: true, unique: true, index: true },
    heroImages: { type: [heroImageSchema], default: [] },
    aboutHeroImageIds: { type: [String], default: [] },
    aboutImages: { type: [heroImageSchema], default: [] },
    about: {
      intro: { type: String, trim: true, maxlength: 5000, default: '' },
      sections: { type: [aboutSectionSchema], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
